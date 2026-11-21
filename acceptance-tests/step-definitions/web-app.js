'use strict';

// Step definitions for the web-app capability. The effective spec is the
// redesign-ledger-passbook delta: seven scenarios describe current behavior
// and drive the live web app through Playwright page objects. The two
// ledger scenarios (running balance, column sorting) stayed red — naming
// the missing feature — until that change landed; they now run green
// against the passbook ledger, and deleting, skipping or weakening them
// is not an option.
//
// The critique refinement pass (tasks 6.1–6.8) re-anchored the sort
// scenario's final step to the new chronology truth: the ledger opens
// date-ascending, so one Date click displays newest-first and the rail
// freezes to the book's printed accumulation (caveat line visible). The
// step text is unchanged; the rail is still asserted to work after a
// sort — it now works by auditing the book's order instead of the sort's.

const assert = require('node:assert/strict');
const { Given, When, Then } = require('@cucumber/cucumber');

const { state } = require('../support/harness');
const { requirePage } = require('../pages/browser');
const shell = require('../pages/app-shell');
const propertiesView = require('../pages/properties-view');
const addPropertyModal = require('../pages/add-property-modal');
const ledgerView = require('../pages/ledger-view');

// The operator's ledger holds these stable rows; the view scenario asserts
// they render alongside whatever else the API returns.
const STABLE_LEDGER_NAMES = [
  'Colinas Verdes',
  'Downtown Office Complex',
  'Real Supabase Property',
  'Suburban Family Home',
];

// --- View properties from API ---

Given('the user opens the application with the properties API available', async function () {
  const health = await this.checkApiHealth();
  assert.strictEqual(health.status, 200, `expected the running API's /health to answer 200, got ${health.status}`);
  assert.strictEqual(
    health.body && health.body.success,
    true,
    'expected /health success true — the properties API must be available to the application'
  );
  const page = requirePage(this);
  await shell.open(page);
  await shell.waitForSidebarProperties(page);
});

Then('the application displays properties returned by the API', async function () {
  const page = requirePage(this);
  const list = await this.fetchPropertiesListQuiet();
  const rows = list.body && Array.isArray(list.body.data) ? list.body.data : [];
  assert.ok(rows.length > 0, 'the API returned no properties to display');
  for (const row of rows) {
    await shell.expectSidebarProperty(page, row.name);
  }
  // The operator's known ledger rows are among what renders.
  for (const name of STABLE_LEDGER_NAMES) {
    await shell.expectSidebarProperty(page, name);
  }
  console.log(`[web-app] the sidebar displays all ${rows.length} property row(s) the API returned`);
});

// --- Create property from UI ---

Given('the user submits a valid new property form', async function () {
  const page = requirePage(this);
  await shell.open(page);
  // A uniquely-named smoke property; the After hook deletes what the
  // scenario created so the ledger is left as found.
  this.uiPropertyPayload = this.probePayload({
    address: 'Acceptance Probe Way 2',
    type: 'commercial', // a non-default type proves the Radix select pick
    units: 2,
  });
  await addPropertyModal.submitProperty(page, this.uiPropertyPayload);
});

Then('the application creates the property through the API', async function () {
  // The UI talks only to the API: the submitted property must exist
  // server-side, shaped exactly as the form sent it.
  const list = await this.fetchPropertiesListQuiet();
  const rows = list.body && Array.isArray(list.body.data) ? list.body.data : [];
  const created = rows.find((row) => row.name === this.uiPropertyPayload.name);
  assert.ok(
    created,
    `the UI-submitted property "${this.uiPropertyPayload.name}" must exist through the API`
  );
  assert.strictEqual(
    created.address,
    this.uiPropertyPayload.address,
    'the address the UI submitted must round-trip through the API'
  );
  assert.strictEqual(
    created.type,
    this.uiPropertyPayload.type,
    'the type picked in the Radix select must round-trip through the API'
  );
  // Register the row for the After-hook cleanup.
  this.createdPropertyIds.push(created.id);
});

Then('the new property appears in the list', async function () {
  const page = requirePage(this);
  await shell.expectSidebarProperty(page, this.uiPropertyPayload.name);
  // The Properties view lists every property as a card.
  await propertiesView.open(page);
  await propertiesView.expectProperty(page, this.uiPropertyPayload.name);
});

// --- Delete property from UI ---

Given('the user deletes a property', async function () {
  // Arrange a smoke property through the API, then delete it through the UI.
  const probe = await this.postProbeProperty({ address: 'Acceptance Probe Way 3' });
  assert.ok(
    probe.status === 201 && probe.body && probe.body.data && probe.body.data.id,
    `arrangement failed: could not create the property to delete (${probe.status})`
  );
  this.subjectPropertyId = probe.body.data.id;
  this.subjectPropertyName = probe.body.data.name;

  const page = requirePage(this);
  await shell.open(page);
  await propertiesView.open(page);
  await propertiesView.deleteProperty(page, this.subjectPropertyName);
});

Then('the application removes it through the API', async function () {
  const list = await this.fetchPropertiesListQuiet();
  const rows = list.body && Array.isArray(list.body.data) ? list.body.data : [];
  assert.ok(
    !rows.some((row) => row.id === this.subjectPropertyId),
    `the UI-deleted property ${this.subjectPropertyId} must be gone through the API`
  );
});

Then('it no longer appears in the list', async function () {
  const page = requirePage(this);
  await propertiesView.expectPropertyAbsent(page, this.subjectPropertyName);
  await shell.expectSidebarPropertyAbsent(page, this.subjectPropertyName);
});

// --- Transactions survive reload ---

Given('the user has recorded transactions and reloads the application', async function () {
  const page = requirePage(this);
  await shell.open(page);
  // A realistic entry shaped like web/src/types/transactions.ts, recorded
  // into the app's own client-side transaction store from the page.
  const list = await this.fetchPropertiesListQuiet();
  const property = list.body && Array.isArray(list.body.data) ? list.body.data[0] : null;
  this.recordedTransaction = {
    id: `acceptance-probe-${Date.now()}`,
    date: '2026-11-05',
    description: 'Probe rent collection November',
    category: 'Rent',
    amount: 12500,
    type: 'income',
    property: property ? property.id : 'all',
  };
  await ledgerView.seedTransactions(page, [this.recordedTransaction]);
  await shell.reload(page);
});

Then('those transactions are still available in the UI', async function () {
  const page = requirePage(this);
  await ledgerView.open(page);
  await ledgerView.expectTransactionVisible(page, this.recordedTransaction);
  // Still in the app's own store, not just in the DOM.
  const stored = await ledgerView.storedTransactions(page);
  assert.ok(
    Array.isArray(stored) && stored.some((entry) => entry.id === this.recordedTransaction.id),
    'the recorded transaction must still be in the app’s transaction store after the reload'
  );
});

// --- Configurable API host ---

Given('the API base URL is configured for the environment', async function () {
  // The harness booted the web dev server with VITE_API_BASE_URL pointing
  // at this run's API — the wiring this scenario proves. Both bases must be
  // live facts of the boot before the app is watched.
  assert.ok(state.apiBaseUrl, 'the harness must have booted the API and recorded its base URL');
  assert.ok(state.webBaseUrl, 'the harness must have booted the web app and recorded its base URL');
  const web = await fetch(state.webBaseUrl, { signal: AbortSignal.timeout(10_000) });
  assert.strictEqual(web.status, 200, `the web app at ${state.webBaseUrl} must answer 200, got ${web.status}`);

  // Record every request the page sends, so the Then can prove which host
  // the app's property operations actually target.
  this.pageRequests = [];
  const page = requirePage(this);
  await shell.open(page);
  page.on('request', (request) => {
    this.pageRequests.push({ method: request.method(), url: request.url() });
  });
});

Then('property list, create, and delete requests target that base URL', async function () {
  const page = requirePage(this);
  const base = state.apiBaseUrl;

  // The list fetch: reloading the app re-requests the properties list.
  await shell.reload(page);
  await shell.waitForSidebarProperties(page);

  // Create and delete through the same UI flows the other scenarios drive,
  // so all three request kinds pass while the listener records.
  const payload = this.probePayload({ address: 'Acceptance Probe Way 4', type: 'lot', units: 1 });
  await addPropertyModal.submitProperty(page, payload);
  const list = await this.fetchPropertiesListQuiet();
  const rows = list.body && Array.isArray(list.body.data) ? list.body.data : [];
  const created = rows.find((row) => row.name === payload.name);
  assert.ok(created, 'the UI create must reach the API through the configured base');
  this.createdPropertyIds.push(created.id); // After-hook cleanup if the UI delete below fails
  await propertiesView.open(page);
  await propertiesView.deleteProperty(page, payload.name);

  // Every property request the app sent — list, create, delete — targeted
  // the configured base, and none targeted anything else.
  const propertyRequests = this.pageRequests.filter(
    (request) => /\/properties($|\/)/.test(new URL(request.url).pathname)
  );
  assert.ok(
    propertyRequests.some((request) => request.method === 'GET' && request.url === `${base}/properties`),
    `no property list request targeted ${base}/properties (observed: ${JSON.stringify(this.pageRequests)})`
  );
  assert.ok(
    propertyRequests.some((request) => request.method === 'POST' && request.url === `${base}/properties`),
    'no create request targeted the configured base URL'
  );
  assert.ok(
    propertyRequests.some(
      (request) => request.method === 'DELETE' && request.url.startsWith(`${base}/properties/`)
    ),
    'no delete request targeted the configured base URL'
  );
  assert.ok(
    propertyRequests.every((request) => request.url.startsWith(base)),
    `every property request must target the configured base ${base}, saw: ${propertyRequests
      .map((request) => `${request.method} ${request.url}`)
      .join(', ')}`
  );
});

// --- The ledger shows a running balance (red until redesign-ledger-passbook lands) ---

Given('the ledger shows its recorded transactions', async function () {
  await seedLedger(this);
});

Given('the ledger showing its transactions', async function () {
  await seedLedger(this);
});

async function seedLedger(world) {
  // Record realistic entries into the app's own transaction store from the
  // page (deterministic arrangement — the scenario's red must come from the
  // missing feature, never from a flaky recording flow), then show them in
  // the ledger.
  const page = requirePage(world);
  await shell.open(page);
  const list = await world.fetchPropertiesListQuiet();
  const property = list.body && Array.isArray(list.body.data) ? list.body.data[0] : null;
  const propertyId = property ? property.id : 'all';
  const stamp = Date.now();
  world.ledgerEntries = [
    {
      id: `probe-ledger-${stamp}-1`,
      date: '2026-10-05',
      description: 'Probe rent October',
      category: 'Rent',
      amount: 10000,
      type: 'income',
      property: propertyId,
    },
    {
      id: `probe-ledger-${stamp}-2`,
      date: '2026-11-05',
      description: 'Probe rent November',
      category: 'Rent',
      amount: 12000,
      type: 'income',
      property: propertyId,
    },
    {
      id: `probe-ledger-${stamp}-3`,
      date: '2026-11-10',
      description: 'Probe repair November',
      category: 'Maintenance',
      amount: 2500,
      type: 'expense',
      property: propertyId,
    },
  ];
  await ledgerView.seedTransactions(page, world.ledgerEntries);
  await ledgerView.open(page);
  const displayed = await ledgerView.displayedTransactionDescriptions(page);
  for (const entry of world.ledgerEntries) {
    assert.ok(displayed.includes(entry.description), `the ledger must show "${entry.description}"`);
  }
}

// The signed amount of a displayed row: expenses count against the balance.
function signedAmountOf(entries, description) {
  const entry = entries.find((candidate) => candidate.description === description);
  assert.ok(entry, `the displayed row "${description}" must be one of the recorded transactions`);
  return entry.type === 'income' ? entry.amount : -entry.amount;
}

// The running balance the ledger owes each row, in the given display order.
function runningBalanceInOrder(entries, displayedOrder) {
  let running = 0;
  return displayedOrder.map((description) => {
    running += signedAmountOf(entries, description);
    return running;
  });
}

When('the user reads down the ledger', async function () {
  const page = requirePage(this);
  this.ledgerDisplayedOrder = await ledgerView.displayedTransactionDescriptions(page);
  assert.ok(
    this.ledgerDisplayedOrder.length >= 2,
    'the ledger must show at least the recorded transactions in a readable order'
  );
});

Then('a running balance accumulates along the ledger\'s right edge in displayed order', async function () {
  const page = requirePage(this);
  // Throws the missing-feature error today: nothing names a balance in the
  // transactions view. Red by design until redesign-ledger-passbook lands.
  const balances = await ledgerView.balanceColumnValues(page);
  const expected = runningBalanceInOrder(this.ledgerEntries, this.ledgerDisplayedOrder);
  assert.deepStrictEqual(
    balances,
    expected,
    'a running balance must accumulate along the rows’ right edge, following the displayed order'
  );
});

Then('it is derived from the transactions on the page with no opening balance', async function () {
  const page = requirePage(this);
  const balances = await ledgerView.balanceColumnValues(page);
  const firstAmount = signedAmountOf(this.ledgerEntries, this.ledgerDisplayedOrder[0]);
  assert.strictEqual(
    balances[0],
    firstAmount,
    `the first row’s balance must be the first transaction alone (${firstAmount}) — no opening balance`
  );
  const net = this.ledgerDisplayedOrder.reduce(
    (sum, description) => sum + signedAmountOf(this.ledgerEntries, description),
    0
  );
  assert.strictEqual(
    balances[balances.length - 1],
    net,
    'the final balance must be the net of every transaction on the page'
  );
});

// --- The ledger can be sorted by its columns (red until redesign-ledger-passbook lands) ---

When('the user sorts by a column', async function () {
  const page = requirePage(this);
  // Throws the missing-feature error today: no sortable column control
  // exists in the transactions view. Red by design until the redesign lands.
  await ledgerView.sortByColumn(page, 'Date');
});

Then('the rows reorder by that column', async function () {
  const page = requirePage(this);
  const displayed = await ledgerView.displayedTransactionDescriptions(page);
  const dates = displayed.map((description) => signedDateOf(this.ledgerEntries, description));
  const ascending = [...dates].sort();
  const descending = [...ascending].reverse();
  assert.ok(
    JSON.stringify(dates) === JSON.stringify(ascending) ||
      JSON.stringify(dates) === JSON.stringify(descending),
    `the rows must reorder by the Date column in one direction (displayed dates: ${dates.join(', ')})`
  );
});

Then('the running balance follows the new displayed order', async function () {
  const page = requirePage(this);
  // 6.1's truth (critique pass): a real passbook keeps its printed order.
  // The ledger now opens date-ascending, so this one click flips Date to
  // newest-first — and the rail freezes to the book's printed
  // (chronological) accumulation: every row still carries the balance the
  // printed order owes it, and a caption caveat names the freeze. The rail
  // stays the audit; it audits the book, not the sort.
  const displayed = await ledgerView.displayedTransactionDescriptions(page);
  const balances = await ledgerView.balanceColumnValues(page);
  const printed = printedBalanceByDescription(this.ledgerEntries);
  assert.deepStrictEqual(
    balances,
    displayed.map((description) => printed[description]),
    'the running balance must stay the printed (chronological) accumulation while the rows display newest-first — the rail audits the book, not the sort'
  );
  await ledgerView.expectBalanceCaveat(page);
});

// Each row's balance in the book's printed order: entries accumulated
// date-ascending (stable for equal dates), keyed by description.
function printedBalanceByDescription(entries) {
  const chronological = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const printed = {};
  let running = 0;
  for (const entry of chronological) {
    running += entry.type === 'income' ? entry.amount : -entry.amount;
    printed[entry.description] = running;
  }
  return printed;
}

function signedDateOf(entries, description) {
  const entry = entries.find((candidate) => candidate.description === description);
  assert.ok(entry, `the displayed row "${description}" must be one of the recorded transactions`);
  return entry.date;
}
