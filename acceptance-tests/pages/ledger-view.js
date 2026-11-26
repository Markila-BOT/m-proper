'use strict';

// Page object for the ledger — the Transactions view — and the app's
// client-side transaction storage. The storage key and the row structure
// are the app's own (web/src/hooks/useLocalStorage.ts,
// web/src/components/TransactionList.tsx).
//
// redesign-ledger-passbook landed: the ledger is now the passbook table
// (TanStack Table, web/src/components/TransactionList.tsx) with its
// running-balance rail as the rightmost column and sortable column
// headers. The readers below target that table; this file stays the one
// place to adjust when the app's row structure changes again.
//
// Critique round two: the sheet prints one line per row at a fixed column
// budget (table-fixed) — descriptions keep their inner span (readable in
// full even where the cell truncates) and the balance remains the sixth
// cell; the rail now audits the BOOK (every entry, date ascending)
// whatever the view displays, and its caveat opens "Balance follows the
// book", naming why the view diverges (filtered, sorted, or both).

const shell = require('./app-shell');

const WAIT_MS = 20_000;

// The app's own storage key (web/src/transactions/storage.ts).
const STORAGE_KEY = 'landlord-transactions';
// The retired per-account ledger design would have stored one key per
// landlord as `landlord-transactions:<owner>`; the legacy key above has no
// suffix. Both shapes are the suite's ledger state and both are cleared
// between scenarios, whatever the app's current key is.
const LEDGER_KEY_PREFIX = 'landlord-transactions';
// The zustand property store's persisted selection (web/src/stores/propertyStore.ts).
const SELECTED_PROPERTY_KEY = 'landlord-selected-property';

// Every browser key the ledger's state can live under, in one place.
function isLedgerStateKey(key) {
  return (
    typeof key === 'string' &&
    (key.startsWith(LEDGER_KEY_PREFIX) || key === SELECTED_PROPERTY_KEY)
  );
}

function ledgerStateKeysIn(keys) {
  return keys.filter(isLedgerStateKey).sort();
}

async function open(page) {
  await shell.openTab(page, 'transactions');
  await page
    .locator('main')
    .getByRole('heading', { name: /Transactions/ })
    .first()
    .waitFor({ state: 'visible', timeout: WAIT_MS });
}

async function seedTransactions(page, transactions) {
  // Write the app's own storage shape directly: the same array-of-entries
  // form the app's recording flow persists, written from the page so the
  // browser (not the suite) holds the state.
  await page.evaluate(
    ({ key, entries }) => window.localStorage.setItem(key, JSON.stringify(entries)),
    { key: STORAGE_KEY, entries: transactions }
  );
}

async function storedTransactions(page) {
  return page.evaluate(
    (key) => JSON.parse(window.localStorage.getItem(key) ?? 'null'),
    STORAGE_KEY
  );
}

// The persisted selected-property value, exactly as the app stores it (the
// zustand persist envelope's `state.selectedProperty`), or null when no entry
// survives. Used by the sign-out scenario: the session's scope must not
// outlive the sign-out.
async function storedSelectedProperty(page) {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed && parsed.state ? (parsed.state.selectedProperty ?? null) : null;
    } catch {
      return null;
    }
  }, SELECTED_PROPERTY_KEY);
}

// Only the ledger's own storage keys (the legacy `landlord-transactions` and
// the retired `landlord-transactions:<owner>` shape), not the property
// selection. Kept apart so a step can say which state it examined.
async function storedTransactionKeys(page) {
  const keys = await page.evaluate(() => {
    const present = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key) present.push(key);
    }
    return present;
  });
  return keys.filter((key) => key.startsWith(LEDGER_KEY_PREFIX)).sort();
}

async function clearStoredTransactions(page) {
  // Removes every ledger-state key, not only the current one: the legacy
  // `landlord-transactions` entry, any retired `landlord-transactions:<owner>`
  // key, and the persisted property selection. Returns what it removed so the
  // cleanup can report it.
  return page.evaluate(
    ({ ledgerPrefix, selectedKey }) => {
      const keys = [];
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (key && (key.startsWith(ledgerPrefix) || key === selectedKey)) keys.push(key);
      }
      for (const key of keys) window.localStorage.removeItem(key);
      return keys.sort();
    },
    { ledgerPrefix: LEDGER_KEY_PREFIX, selectedKey: SELECTED_PROPERTY_KEY }
  );
}

// The ledger-state keys still present, sorted. The after-cleanup assertion
// reads this and names whatever survived.
async function storedLedgerKeys(page) {
  if (!page || !/^https?:/i.test(page.url())) return [];
  try {
    const keys = await page.evaluate(() => {
      const present = [];
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (key) present.push(key);
      }
      return present;
    });
    return ledgerStateKeysIn(keys);
  } catch (error) {
    // No document origin yet (about:blank): there is no localStorage to read,
    // and therefore no ledger state to survive.
    if (/Access is denied|SecurityError/i.test(error.message)) return [];
    throw error;
  }
}

// Removes ledger-state keys from a Playwright storage state before a context
// is created from it. The cached signed-in state is the only browser state
// that crosses scenarios; stripping the ledger keys here is the Before-side
// sweep, and it leaves later navigations alone (a scenario that seeds rows and
// reloads must keep them until its own cleanup).
function clearLedgerStateFromStorageState(storageState) {
  if (!storageState || !Array.isArray(storageState.origins)) return storageState;
  return {
    ...storageState,
    origins: storageState.origins.map((origin) => ({
      ...origin,
      localStorage: (origin.localStorage || []).filter(({ name }) => !isLedgerStateKey(name)),
    })),
  };
}

// The ledger's entry rows: the first tbody of the passbook table. The rows
// after it are the page's blank printed lines (aria-hidden decoration for
// sparse pages), so every reader of entries — descriptions, balances —
// scopes here. (redesign-ledger-passbook's finish batch added the blank
// ruled tbody; this file is the one place that knows.)
function entryRows(page) {
  return page.locator('main').locator('table tbody').first().locator('tr');
}

async function displayedTransactionDescriptions(page) {
  // The ledger rows name each transaction in the description cell of their
  // table row inside main (the sidebar's property names never match — they
  // sit outside main). The description is the cell's first span; the row's
  // Delete control is a sibling, never part of the name.
  const rows = entryRows(page);
  const count = await rows.count();
  const descriptions = [];
  for (let i = 0; i < count; i += 1) {
    const cell = rows.nth(i).locator('td').nth(1).locator('span').first();
    const text = await cell.innerText();
    descriptions.push(text.trim());
  }
  return descriptions.filter((heading) => heading.length > 0);
}

async function expectTransactionVisible(page, transaction) {
  await page
    .locator('main')
    .getByText(transaction.description, { exact: true })
    .waitFor({ state: 'visible', timeout: WAIT_MS });
}

// --- the redesign-ledger-passbook features (landed: the passbook ledger) ---

async function balanceColumnValues(page) {
  // The running balance renders as the ledger's right-edge rail — the
  // sixth cell of each entry row. The critique pass (6.2) appended a
  // reserved trailing actions cell after it, so the balance is no longer
  // the row's final cell; nth(5) is the balance under both the six- and
  // seven-column row shapes (the blank printed lines below carry none).
  const balanceHeader = page.locator('main').getByText(/balance/i).first();
  await balanceHeader.waitFor({ state: 'visible', timeout: 5000 });
  const rows = entryRows(page);
  const count = await rows.count();
  const values = [];
  for (let i = 0; i < count; i += 1) {
    const cell = rows.nth(i).locator('td').nth(5);
    const text = await cell.innerText();
    values.push(Number(text.replace(/[^0-9.-]/g, '')));
  }
  return values;
}

async function expectBalanceCaveat(page) {
  // The rail's truth, caveat round three: the caption prints whenever the
  // display is not the book's own order — any active filter, any sort that
  // is not date-ascending — and now names WHY ("this view is filtered",
  // "sorted newest first", both). The stable prefix is what the step
  // anchors on; the why-suffix is the app's own words. The caveat line
  // prints above the sheet.
  const caveat = page
    .locator('main')
    .getByText(/balance follows the book/i);
  await caveat.waitFor({ state: 'visible', timeout: 5000 });
  return caveat;
}

async function sortByColumn(page, column) {
  // A sortable column renders its header as a control named by the column.
  // Scope to the table head: the filters above the ledger carry controls
  // whose names can contain a column word (the range picker's "Choose date
  // range" matches \bDate\b), and the header is the only sort control.
  const header = page
    .locator('main thead')
    .getByRole('button', { name: new RegExp(`\\b${column}\\b`, 'i') })
    .first();
  await header.waitFor({ state: 'visible', timeout: 5000 });
  await header.click();
}

// --- the totals strip's unreachable state (surface-api-unreachable-state) ---

function totalsStrip(page) {
  // The strip is the one section inside the view's main region — the
  // ledger sheet and its apparatus are tables and divs, never sections.
  return page.locator('main').locator('section').first();
}

async function expectUnreachableStripState(page) {
  // The strip's mount of the shared state: the scope-note slot carries
  // the state line while the figures stay unwritten — the step reads the
  // region's text to prove no zeroed figure printed beside it.
  const state = totalsStrip(page).locator('[data-unreachable="properties"]');
  await state.waitFor({ state: 'visible', timeout: WAIT_MS });
  return state;
}

module.exports = {
  STORAGE_KEY,
  LEDGER_KEY_PREFIX,
  SELECTED_PROPERTY_KEY,
  open,
  seedTransactions,
  storedTransactions,
  storedSelectedProperty,
  storedTransactionKeys,
  clearStoredTransactions,
  storedLedgerKeys,
  clearLedgerStateFromStorageState,
  entryRows,
  displayedTransactionDescriptions,
  expectTransactionVisible,
  balanceColumnValues,
  expectBalanceCaveat,
  sortByColumn,
  totalsStrip,
  expectUnreachableStripState,
};
