'use strict';

// Page object for the ledger — the Transactions view — and the app's
// client-side transaction storage. The storage key and the row structure
// are the app's own (web/src/hooks/useLocalStorage.ts,
// web/src/components/TransactionList.tsx).
//
// The two redesign-ledger-passbook features (running balance, column
// sorting) do not exist yet. Their page-object methods below make an
// honest attempt to find the feature in the live DOM and, when it is
// absent, throw an error that names the missing feature — so those
// scenarios stay red for the right reason and go green without a step
// change once the redesign lands.

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

async function displayedTransactionDescriptions(page) {
  // The ledger rows name each transaction in a level-3 heading inside main
  // (the sidebar's property names never match — they sit outside main).
  const headings = await page
    .locator('main')
    .getByRole('heading', { level: 3 })
    .allTextContents();
  return headings
    .map((heading) => heading.trim())
    .filter((heading) => heading.length > 0 && heading !== 'No transactions yet');
}

async function expectTransactionVisible(page, transaction) {
  await page
    .locator('main')
    .getByText(transaction.description, { exact: true })
    .waitFor({ state: 'visible', timeout: WAIT_MS });
}

// --- the redesign-ledger-passbook features (not implemented yet) ---

const MISSING_BALANCE_MESSAGE =
  'the ledger has no running balance column — nothing in the transactions view names a balance, ' +
  'so no balance accumulates along the rows\' right edge. The running balance is described by ' +
  'openspec/changes/redesign-ledger-passbook (rule "The ledger shows a running balance") and is not ' +
  'implemented in the web app yet; this scenario stays red until that change lands.';

const MISSING_SORT_MESSAGE =
  'the ledger has no sortable column — no control in the transactions view is named by a column, ' +
  'so the rows cannot be sorted. Column sorting is described by ' +
  'openspec/changes/redesign-ledger-passbook (rule "The ledger can be sorted by its columns") and is ' +
  'not implemented in the web app yet; this scenario stays red until that change lands.';

async function balanceColumnValues(page) {
  // Honest attempt: a running balance renders as a column — something in
  // the ledger names "balance" and each row carries a right-edge figure.
  // Today nothing does, and this throws naming the missing feature.
  const balanceHeader = page.locator('main').getByText(/balance/i).first();
  try {
    await balanceHeader.waitFor({ state: 'visible', timeout: 5000 });
  } catch {
    throw new Error(MISSING_BALANCE_MESSAGE);
  }
  // With the feature present: read each row's right-edge balance figure.
  // The row structure is this page object's to maintain — one place to
  // adjust when the redesign lands.
  const rows = page.locator('main').locator('div.divide-y > div');
  const count = await rows.count();
  const values = [];
  for (let i = 0; i < count; i += 1) {
    const cell = rows.nth(i).locator('span').last();
    const text = await cell.innerText();
    values.push(Number(text.replace(/[^0-9.-]/g, '')));
  }
  return values;
}

async function sortByColumn(page, column) {
  // Honest attempt: a sortable column renders its header as a control
  // named by the column. Today no such control exists, and this throws
  // naming the missing feature.
  const header = page
    .locator('main')
    .getByRole('button', { name: new RegExp(`\\b${column}\\b`, 'i') })
    .first();
  try {
    await header.waitFor({ state: 'visible', timeout: 5000 });
  } catch {
    throw new Error(MISSING_SORT_MESSAGE);
  }
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
  sortByColumn,
  MISSING_BALANCE_MESSAGE,
  MISSING_SORT_MESSAGE,
};
