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

const shell = require('./app-shell');

const WAIT_MS = 20_000;

// The app's own storage key (web/src/hooks/useLocalStorage.ts).
const STORAGE_KEY = 'landlord-transactions';

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

async function clearStoredTransactions(page) {
  await page.evaluate((key) => window.localStorage.removeItem(key), STORAGE_KEY);
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
  // 6.1's truth: while the rows display newest-first, the rail freezes to
  // the book's printed (chronological) accumulation and a caption caveat
  // names the freeze. The caveat line prints above the sheet.
  const caveat = page
    .locator('main')
    .getByText(/balance follows the printed order of the book/i);
  await caveat.waitFor({ state: 'visible', timeout: 5000 });
  return caveat;
}

async function sortByColumn(page, column) {
  // A sortable column renders its header as a control named by the column.
  const header = page
    .locator('main')
    .getByRole('button', { name: new RegExp(`\\b${column}\\b`, 'i') })
    .first();
  await header.waitFor({ state: 'visible', timeout: 5000 });
  await header.click();
}

module.exports = {
  open,
  seedTransactions,
  storedTransactions,
  clearStoredTransactions,
  displayedTransactionDescriptions,
  expectTransactionVisible,
  balanceColumnValues,
  expectBalanceCaveat,
  sortByColumn,
};
