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

const { state, waitFor, probeTcpPort } = require('../support/harness');
const { requirePage } = require('../pages/browser');
const shell = require('../pages/app-shell');
const propertiesView = require('../pages/properties-view');
const addPropertyModal = require('../pages/add-property-modal');
const ledgerView = require('../pages/ledger-view');
const signInPage = require('../pages/sign-in');
const authState = require('../support/auth-state');
const authTokens = require('../support/auth-tokens');
const identities = require('../support/identities');
const api = require('../support/api-client');
const { startAppWithUnreachableJwks, stopProbeApp } = require('../support/second-app');
const webBundle = require('../support/web-bundle');

// --- View properties from API ---
//
// The scenario asserts the application displays what the API returns. It
// must not assert the operator's own ledger rows: their names are the
// operator's data, not the app's contract, and they change (this suite once
// hardcoded four and failed when the operator's ledger shrank to one).

Given('the user opens the application with the properties API available', async function () {
  const health = await this.checkApiHealth();
  assert.strictEqual(health.status, 200, `expected the running app's /api/health to answer 200, got ${health.status}`);
  assert.strictEqual(
    health.body && health.body.success,
    true,
    'expected /api/health success true — the properties routes must be available to the application'
  );

  // Accounts own their rows now, so the landlord the suite signs in as starts
  // with an empty ledger. Arrange one row through the API (registered for the
  // After-hook cleanup) so this scenario has something the API returns to
  // display; the assertion still reads whatever the API lists, never a
  // hardcoded name.
  const arranged = await this.postProbeProperty({ address: 'Acceptance Probe Way 0' });
  assert.ok(
    arranged.status === 201 && arranged.body && arranged.body.data && arranged.body.data.id,
    `arrangement failed: could not create a property for this landlord (${arranged.status})`
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

// --- Same-origin calls need no configured host ---

Given('the web application is deployed at its production origin', async function () {
  // The harness boots one process: the pages and /api share this origin. There
  // is no separate API host, port, or runtime override to configure.
  assert.ok(state.webBaseUrl, 'the harness must have booted the app and recorded its base URL');
  this.deployedOrigin = new URL(state.webBaseUrl).origin;
  const web = await fetch(state.webBaseUrl, { signal: AbortSignal.timeout(10_000) });
  assert.strictEqual(web.status, 200, `the app at ${state.webBaseUrl} must answer 200, got ${web.status}`);

  // Record every request the page sends, so the Then can prove which origin
  // the app's property operations actually target.
  this.pageRequests = [];
  const page = requirePage(this);
  this.landlordPage = page;
  page.on('request', (request) => {
    this.pageRequests.push({ method: request.method(), url: request.url() });
  });
  await shell.open(page);
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
  // Critique round two's truth: the rail audits the BOOK, not the sort —
  // every entry, date ascending, whatever the rows display. This one
  // click flips Date to newest-first, and each row still carries the
  // balance the book's printed (chronological) accumulation owes it, with
  // the caption caveat naming the divergence. The rail stays the audit.
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

// --- The unreachable state speaks where the silent zero used to ---
//
// surface-api-unreachable-state: the harness boots exactly as every other
// scenario, and the test breaks reachability from its own side — every
// `/api/properties` request the page makes is aborted before it leaves the
// browser. That is the network failure the shared state names; no product
// affordance points the client at a dead host any more. The route is lifted
// when the scenario's page closes (and explicitly by the After hook).

Given('the web application is open and the properties API is unreachable', async function () {
  const page = requirePage(this);
  // The rejection must be an observable fact, not an assumption: record every
  // request the page sends, every one that fails, and every one the test
  // aborted.
  this.pageRequests = [];
  this.failedPageRequests = [];
  this.abortedApiRequests = [];
  page.on('request', (request) => {
    this.pageRequests.push({ method: request.method(), url: request.url() });
  });
  page.on('requestfailed', (request) => {
    this.failedPageRequests.push({ url: request.url() });
  });
  await shell.breakPropertiesReachability(page, (url) => this.abortedApiRequests.push(url));
  await shell.open(page);
});

When('the properties fetch rejects', async function () {
  // The properties fetch, aborted by the test's own route handler — the fact
  // the shared state keys on. The query retries once; the first failure is
  // already the proof.
  await waitFor(() => this.abortedApiRequests.length > 0, {
    timeoutMs: 15_000,
    intervalMs: 250,
    label: 'a properties request aborted by the test',
  });
  const aborted = this.abortedApiRequests.slice();
  assert.ok(
    aborted.every((url) => new URL(url).pathname.startsWith('/api/properties')),
    `the aborted requests must be the properties route, saw: ${aborted.join(', ')}`
  );
  assert.ok(
    this.failedPageRequests.some((request) => new URL(request.url).pathname.startsWith('/api/properties')),
    'the page must observe the properties fetch fail'
  );
  console.log(
    `[web-app] the properties fetch rejected (${aborted.length} request(s) aborted by the test)`
  );
});

Then('the shared unreachable state appears at the property rail', async function () {
  const page = requirePage(this);
  const state = await shell.expectUnreachableRailState(page);
  assert.strictEqual(
    await state.getAttribute('role'),
    'status',
    'the shared state must announce itself as a status to assistive technology'
  );
});

Then('the same state appears at the properties register', async function () {
  const page = requirePage(this);
  await propertiesView.open(page);
  const state = await propertiesView.expectUnreachableRegisterState(page);
  assert.strictEqual(
    await state.getAttribute('role'),
    'status',
    "the register's state must announce itself as a status to assistive technology"
  );
});

Then('the same state appears at the totals strip', async function () {
  const page = requirePage(this);
  await ledgerView.open(page);
  const state = await ledgerView.expectUnreachableStripState(page);
  assert.strictEqual(
    await state.getAttribute('role'),
    'status',
    "the strip's state must announce itself as a status to assistive technology"
  );
});

Then('the state names the problem and the recovery', async function () {
  const page = requirePage(this);
  // Never exact strings: the state names the problem (the unreachable
  // connection) and the recovery (what to do), in the app's own words.
  const state = await shell.expectUnreachableRailState(page);
  const line = (await state.innerText()).trim();
  assert.match(
    line,
    /unreachab/i,
    'the state must name the problem — the unreachable connection'
  );
  assert.match(line, /reload/i, 'the state must name the recovery');
});

Then("the empty ledger's zeroed figures do not render as though the ledger were merely empty", async function () {
  const page = requirePage(this);
  // While the state shows, the strip's figures stay unwritten: printing
  // ₱0.00 beside a line that says the figures cannot be verified is the
  // exact lie this scenario forbids. The strip region carries the state
  // and no money figure at all.
  await ledgerView.expectUnreachableStripState(page);
  const stripText = await ledgerView.totalsStrip(page).innerText();
  assert.ok(
    !stripText.includes('₱'),
    `the strip must not print money figures while the state shows, but printed: "${stripText.trim()}"`
  );
});

// ===========================================================================
// landlord-accounts: the authenticated shell, the bearer client, and sign-out
// ===========================================================================
//
// Two environment facts shape these scenarios and are stated where they matter:
//
// 1. The project's ES256 private key is unavailable, so a genuinely expired or
//    rejected access token cannot be minted. The browser's stored session
//    carries the two facts the client reads — `expires_at` and the refresh
//    token — so the harness moves `expires_at` into the past (exactly the
//    refresh an hour of waiting would force) or replaces the access token's
//    signature (exactly the 401 a rejected token would earn), keeping the real
//    refresh token. Nothing is stubbed.
// 2. "Sign-out" is a server function that clears the cookie session; the guard
//    sends the visitor to sign-in on the next navigation (web/src/lib/supabase/
//    sign-out.ts, api-client.ts). The steps therefore assert the signed-out
//    state, then observe the guard on a navigation — the app's documented path.

const LEDGER_PROPERTY_SELECTION_KEY = 'landlord-selected-property';
// Where the flash detector records the previous landlord's markers it saw.
const FLASH_STORAGE_KEY = 'acceptance-previous-account-flash';

function webOrigin() {
  return new URL(state.webBaseUrl).origin;
}

// The properties routes live under /api on the app's own origin. A page on a
// second app instance (the JWKS-outage probe) reaches them on its own port, so
// the path identifies the route, not a separate API origin.
function isPropertiesUrl(url) {
  return /^\/api\/properties(\/|$)/.test(url.pathname);
}

// Records every property request/response the app sends. A scenario owns its
// listeners through its page, and the After hook closes that page. The server
// refreshes the session at the route boundary, so there is no browser-issued
// refresh request to observe.
function watchApi(page, sink) {
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (isPropertiesUrl(url)) {
      sink.propertyRequests.push({ method: request.method(), url: request.url() });
    }
  });
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (isPropertiesUrl(url)) {
      sink.propertyResponses.push({
        method: response.request().method(),
        status: response.status(),
        url: response.url(),
      });
    }
  });
}

function emptyRequestSink() {
  return { propertyRequests: [], propertyResponses: [] };
}

// The app makes an authenticated request through the real Add Property flow:
// a user action that crosses the bearer client, unlike the load-time list
// fetch which has already happened by the time a scenario attaches.
async function triggerAuthenticatedRequest(world, payload) {
  await addPropertyModal.open(world.landlordPage);
  await addPropertyModal.fill(world.landlordPage, payload);
  await addPropertyModal.submit(world.landlordPage);
}

// ---------------------------------------------------------------------------
// The guard and the return target
// ---------------------------------------------------------------------------

Given('the visitor is signed out', async function () {
  const { context, page } = await authState.newUnsignedContext({ browser: state.browser });
  this.extraContext = context;
  this.visitorPage = page;
  assert.strictEqual(
    authState.hasSessionCookie(await context.storageState()),
    false,
    'the visitor must start with no Supabase session cookie'
  );
});

When('the visitor opens a ledger screen', async function () {
  this.intendedScreen = '/transactions';
  await this.visitorPage.goto(new URL(this.intendedScreen, state.webBaseUrl).toString(), {
    waitUntil: 'networkidle',
  });
  await this.visitorPage.waitForURL((url) => url.pathname.startsWith('/sign-in'), {
    timeout: signInPage.WAIT_MS,
  });
  await this.visitorPage
    .getByRole('heading', { level: 1, name: 'Sign in', exact: true })
    .waitFor({ state: 'visible', timeout: signInPage.WAIT_MS });
  this.signInRedirect = new URL(this.visitorPage.url()).searchParams.get('redirect');
});

Then('the app sends the visitor to sign in', async function () {
  assert.ok(signInPage.isSignInUrl(this.visitorPage), 'the guard must land the visitor on sign-in');
  assert.strictEqual(
    new URL(this.visitorPage.url()).searchParams.get('redirect'),
    this.intendedScreen,
    'the sign-in page must carry the intended screen as the return target'
  );
  assert.strictEqual(
    authState.hasSessionCookie(await this.extraContext.storageState()),
    false,
    'the guard must not sign the visitor in'
  );
});

Then('after a successful sign-in it returns to the intended screen', async function () {
  this.visitor = await this.createDisposableIdentity({ confirmed: true });
  await signInPage.submit(this.visitorPage, {
    email: this.visitor.email,
    password: this.visitor.password,
  });

  await this.visitorPage.waitForURL((url) => url.pathname === this.intendedScreen, {
    timeout: signInPage.WAIT_MS,
  });
  await shell.waitForShell(this.visitorPage);
  await shell.expectSignedInAs(this.visitorPage, this.visitor.email);
  // The intended ledger screen really rendered (not just its URL).
  await this.visitorPage
    .locator('main')
    .getByRole('heading', { name: /Transactions/ })
    .first()
    .waitFor({ state: 'visible', timeout: signInPage.WAIT_MS });
  console.log(`[web-app] the signed-out visit to ${this.intendedScreen} returned there after sign-in`);
});

When('the return target is an absolute URL, a protocol-relative path, or has a scheme', async function () {
  // Every shape the one validator must refuse: an absolute URL, a
  // protocol-relative path, and a scheme (which also covers javascript:).
  this.tamperedTargets = [
    'https://evil.example/transactions',
    '//evil.example/transactions',
    'javascript:alert(1)',
  ];
  this.tamperedLandlord = await this.createDisposableIdentity({ confirmed: true });
});

Then('after sign-in the app lands on the default screen, not the target', async function () {
  const page = this.visitorPage;
  const observed = [];

  for (const target of this.tamperedTargets) {
    // Start each attempt signed out so the sign-in form is the one that acts.
    await this.extraContext.clearCookies();
    assert.strictEqual(
      authState.hasSessionCookie(await this.extraContext.storageState()),
      false,
      `the visitor must be signed out before the "${target}" attempt`
    );

    const signInUrl = new URL('/sign-in', state.webBaseUrl);
    signInUrl.searchParams.set('redirect', target);
    await page.goto(signInUrl.toString(), { waitUntil: 'networkidle' });
    await page
      .getByRole('heading', { level: 1, name: 'Sign in', exact: true })
      .waitFor({ state: 'visible', timeout: signInPage.WAIT_MS });

    await signInPage.submit(page, {
      email: this.tamperedLandlord.email,
      password: this.tamperedLandlord.password,
    });
    await page.waitForURL(
      (url) => url.origin === webOrigin() && url.pathname === '/overview',
      { timeout: signInPage.WAIT_MS }
    );
    await shell.waitForShell(page);

    const landed = new URL(page.url());
    observed.push(`${target} -> ${landed.pathname}`);
    assert.strictEqual(landed.origin, webOrigin(), `a tampered target must never leave the app origin: ${target}`);
    assert.notStrictEqual(
      landed.pathname,
      new URL(target, webOrigin()).pathname,
      `the app must not honour the tampered target "${target}"`
    );
  }

  console.log(`[web-app] tampered return targets fell back to the default screen: ${observed.join('; ')}`);
});

Then("the header shows the landlord's email", async function () {
  await shell.expectSignedInAs(this.landlordPage, this.landlord.email);
  await this.landlordPage
    .getByRole('button', { name: 'Sign out', exact: true })
    .waitFor({ state: 'visible', timeout: signInPage.WAIT_MS });
  console.log(`[web-app] the header names ${this.landlord.email} beside the one sign-out control`);
});

Then('the session ends and a protected screen sends the visitor to sign in', async function () {
  assert.strictEqual(
    authState.hasSessionCookie(await this.extraContext.storageState()),
    false,
    'sign-out must clear the cookie session'
  );
  // The guard is the app's documented "next navigation" path: a protected
  // screen now answers with sign-in and a return target.
  await shell.openProtectedPageExpectingSignIn(this.landlordPage, '/overview');
  assert.strictEqual(
    new URL(this.landlordPage.url()).searchParams.get('redirect'),
    '/overview',
    'the guard must carry the protected screen as the return target'
  );
});

// ---------------------------------------------------------------------------
// The bearer client: a valid token, an expiry, a revocation, an outage
// ---------------------------------------------------------------------------

When('the app requests the properties list', async function () {
  const page = this.landlordPage;

  const matchesList = (urlString, method) => {
    const url = new URL(urlString);
    return method === 'GET' && isPropertiesUrl(url) && url.pathname === '/api/properties';
  };

  // The list request the app makes after a successful UI create: the create
  // invalidates the properties query, and the app re-reads the list through the
  // same bearer client. No navigation is involved, so the response body can be
  // read while the document that owns it is alive.
  const requestSeen = new Promise((resolve) => {
    const onRequest = (request) => {
      if (!matchesList(request.url(), request.method())) return;
      page.off('request', onRequest);
      resolve(request.allHeaders().then((headers) => ({ url: request.url(), headers })));
    };
    page.on('request', onRequest);
  });
  const responseSeen = new Promise((resolve) => {
    const onResponse = (response) => {
      if (!matchesList(response.url(), response.request().method())) return;
      page.off('response', onResponse);
      resolve(response.json().then((body) => ({ status: response.status(), body })).catch(() => ({ status: response.status(), body: null })));
    };
    page.on('response', onResponse);
  });

  // The create that triggers the invalidation, through the real modal.
  this.triggerPayload = this.probePayload({ address: 'Acceptance Probe Way Valid Token' });
  await addPropertyModal.submitProperty(page, this.triggerPayload);

  const [request, response] = await Promise.all([requestSeen, responseSeen]);
  this.observedListRequest = { url: request.url, headers: request.headers };
  assert.ok(response.body, `the list response body must be readable (status ${response.status})`);
  this.observedListResponse = response;
  await shell.waitForSidebarProperties(page);
});

Then('the request carries the session cookie', async function () {
  const observed = this.observedListRequest;
  assert.ok(observed, 'the app must have made a properties request first');

  const headers = observed.headers || {};
  const authorization = headers.authorization || headers.Authorization;
  assert.strictEqual(
    authorization,
    undefined,
    `no Authorization header may be sent to the app (saw ${authorization})`
  );

  const cookie = headers.cookie || headers.Cookie || '';
  assert.match(
    cookie,
    /(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=/,
    `the request must carry the Supabase session cookie (saw ${observed.url})`
  );

  // And it is the signed-in landlord's own session: the cookie's token subject
  // is the landlord behind the page.
  const stored = await authState.storedSession(this.landlordPage.context(), state.webBaseUrl);
  assert.ok(stored, 'the page context must hold the session the request carried');
  const claims = authTokens.decode(stored.access_token);
  assert.ok(claims, 'the session cookie token must be a JWT');
  assert.strictEqual(
    claims.payload.sub,
    this.landlord.id,
    'the request must carry the signed-in landlord’s own session'
  );
  assert.ok(
    claims.payload.exp * 1000 > Date.now(),
    'the carried token must still be inside its validity window'
  );
});

Then('the response is accepted', async function () {
  const observed = this.observedListResponse;
  assert.strictEqual(observed.status, 200, `the app must accept the cookie (got ${observed.status})`);
  assert.strictEqual(observed.body.success, true, 'the accepted response must carry success true');
  assert.ok(Array.isArray(observed.body.data), 'the accepted response must carry the property list');
  console.log('[web-app] the app sent the landlord’s session cookie and the app accepted the list request');
});

Then('the request targets the same origin', async function () {
  const observed = this.observedListRequest;
  assert.ok(observed, 'the app must have made a properties request first');
  const url = new URL(observed.url);
  assert.strictEqual(
    url.origin,
    this.deployedOrigin || webOrigin(),
    `the properties request must target the app's own origin (saw ${url.origin})`
  );
  assert.strictEqual(url.pathname, '/api/properties', `the route must be /api/properties (saw ${url.pathname})`);
});

Then('no separate API base URL was configured', async function () {
  assert.strictEqual(
    process.env.VITE_API_BASE_URL,
    undefined,
    'the harness must not configure a separate API base URL for the app'
  );
  const webEnv = webBundle.readPublicWebEnv();
  assert.ok(
    !('VITE_API_BASE_URL' in webEnv),
    'web/.env must not configure a separate API base URL'
  );
  const override = await shell.retiredApiBaseUrlOverride(this.landlordPage);
  assert.strictEqual(
    override,
    null,
    'the retired runtime override must not redirect the calls (and nothing writes it)'
  );
});

Given("the session's access token has expired and the refresh token is valid", async function () {
  this.landlord = await this.createDisposableIdentity({ confirmed: true });
  const session = await authState.newSignedInContext({
    browser: state.browser,
    origin: state.webBaseUrl,
    email: this.landlord.email,
    password: this.landlord.password,
  });
  this.extraContext = session.context;
  this.landlordPage = session.page;

  const before = authState.sessionFromStorageState(session.storageState);
  assert.ok(before && before.access_token && before.refresh_token, 'the sign-in must store a full session');
  this.sessionBeforeExpiry = before;
  this.expiryForced = true;

  // The expiry is forced by rewriting the stored session, not by waiting: the
  // real access token and the real refresh token stay, only `expires_at` moves
  // an hour into the past — the state supabase-js treats as an expired access
  // token. The project's ES256 key is unavailable, so this is how a real
  // expiry is simulated; nothing about the refresh path is stubbed.
  const rewritten = await authState.expireStoredSession(session.context, {
    origin: state.webBaseUrl,
  });
  assert.ok(
    rewritten.expires_at * 1000 < Date.now(),
    'the stored session must say the access token has already expired'
  );
  assert.strictEqual(rewritten.access_token, before.access_token, 'the access token itself is the real one');
  assert.strictEqual(rewritten.refresh_token, before.refresh_token, 'the refresh token is the real one');
});

Given('the session can no longer be refreshed', async function () {
  this.landlord = await this.createDisposableIdentity({ confirmed: true });
  const session = await authState.newSignedInContext({
    browser: state.browser,
    origin: state.webBaseUrl,
    email: this.landlord.email,
    password: this.landlord.password,
  });
  this.extraContext = session.context;
  this.landlordPage = session.page;

  const before = authState.sessionFromStorageState(session.storageState);
  assert.ok(before && before.access_token && before.refresh_token, 'the sign-in must store a full session');
  this.sessionBeforeRevocation = before;
  this.revocationForced = true;

  // Revoke the session for real: the Auth admin API deletes the account, so
  // the stored refresh token can no longer be exchanged.
  await identities.deleteDisposableUser(this.landlord);
  assert.strictEqual(
    await identities.getAdminUser(this.landlord.id),
    null,
    'the disposable account must be gone before its session is used'
  );

  // Move the stored expiry into the past so the server's boundary refresh runs
  // on the next request. The refresh token is dead, so the refresh fails
  // exactly as a genuinely revoked session's would — nothing is stubbed.
  const rewritten = await authState.expireStoredSession(session.context, {
    origin: state.webBaseUrl,
  });
  assert.ok(
    rewritten.expires_at * 1000 < Date.now(),
    'the stored session must say the access token has already expired'
  );
  assert.strictEqual(rewritten.access_token, before.access_token, 'the access token itself is the real one');
});

When('the app makes a request', async function () {
  if (this.outageProbe) {
    // The page's own load-time fetch already targeted the key-set-outage app.
    await waitFor(
      () => this.outageResponses.some((response) => response.path === '/api/properties' && response.status === 503),
      {
        timeoutMs: 30_000,
        label: 'the app’s properties request reached the key-set-outage app and was refused with 503',
      }
    );
    return;
  }

  const page = this.landlordPage;
  this.requestSink = emptyRequestSink();
  watchApi(page, this.requestSink);

  if (this.revocationForced) {
    // The app makes a document request. Its boundary refresh tries the dead
    // refresh token, fails, and clears the session cookies on the response;
    // the guard then has no identity and sends the landlord to sign-in.
    await page.reload({ waitUntil: 'networkidle' });
    await waitFor(
      async () => !authState.hasSessionCookie(await this.extraContext.storageState()),
      {
        timeoutMs: 60_000,
        intervalMs: 500,
        label: 'the server’s failed refresh to clear the session',
      }
    );
    return;
  }

  this.triggerPayload = this.probePayload({ address: 'Acceptance Probe Way Token Refresh' });
  const postSeen = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && isPropertiesUrl(new URL(response.url())),
    { timeout: signInPage.WAIT_MS }
  ).catch(() => null);

  await triggerAuthenticatedRequest(this, this.triggerPayload);

  if (this.expiryForced) {
    // The server refreshes the session at the route boundary before serving
    // the request; the browser makes no refresh call of its own. Wait for the
    // POST to settle and record its envelope and any rotated cookies.
    const response = await postSeen;
    assert.ok(response, 'the app’s POST must have reached the route boundary');
    const headers = await response.allHeaders();
    this.triggerResponse = {
      status: response.status(),
      body: await response.json().catch(() => null),
      setCookie: headers['set-cookie'] || '',
    };
  }
});

Then('the server refreshes the session once and answers with rotated cookies', async function () {
  const sink = this.requestSink;
  assert.ok(sink, 'the app must have made a request first');
  const posts = () => sink.propertyRequests.filter((request) => request.method === 'POST');
  assert.strictEqual(
    posts().length,
    1,
    `the app must make exactly one POST — no client retry (saw ${posts().length})`
  );

  // The response carried the rotated session cookies.
  assert.match(
    this.triggerResponse.setCookie || '',
    /sb-[^=;]+-auth-token(?:\.\d+)?=/,
    `the response must carry the rotated session cookie (saw "${this.triggerResponse.setCookie}")`
  );

  // The stored session really rotated and is valid again: a second refresh
  // would rotate it again, so the value must stay put.
  const rotated = await authState.storedSession(this.extraContext, state.webBaseUrl);
  assert.ok(rotated, 'the refreshed session must be stored in the browser');
  assert.notStrictEqual(
    rotated.access_token,
    this.sessionBeforeExpiry.access_token,
    'the refresh must have rotated the access token'
  );
  assert.ok(rotated.expires_at * 1000 > Date.now(), 'the refreshed session must be valid again');

  await this.landlordPage.waitForTimeout(750);
  const stable = await authState.storedSession(this.extraContext, state.webBaseUrl);
  assert.strictEqual(
    stable.access_token,
    rotated.access_token,
    'the server must refresh once, not in a loop — the rotated token must not change again'
  );
  assert.strictEqual(posts().length, 1, 'no second client round trip may be made');
  console.log('[web-app] the server refreshed the expired session once and rotated the cookies on the response');
});

Then('the request succeeds without a second client round trip', async function () {
  const observed = this.triggerResponse;
  assert.ok(observed, 'the request must have completed');
  assert.strictEqual(observed.status, 201, `the POST must succeed after the boundary refresh (got ${observed.status})`);
  assert.strictEqual(observed.body.success, true, 'the response must carry success true');

  const sink = this.requestSink;
  assert.strictEqual(
    sink.propertyRequests.filter((request) => request.method === 'POST').length,
    1,
    'the request must succeed in one round trip — no retry after the server-side refresh'
  );

  if (observed.body.data && observed.body.data.id) {
    this.createdProperties.push({
      id: observed.body.data.id,
      subject: { storageState: await this.extraContext.storageState() },
    });
  }
});

Then('the landlord is signed out and sent to sign in', async function () {
  // The server's boundary refresh tried the dead refresh token once and
  // failed; its response cleared the session cookies, which is the sign-out.
  // The browser holds no session now, and the guard refuses the next
  // protected screen.
  assert.strictEqual(
    authState.hasSessionCookie(await this.extraContext.storageState()),
    false,
    'the failed refresh must clear the session cookie (the landlord is signed out)'
  );
  assert.strictEqual(
    await authState.storedSession(this.extraContext, state.webBaseUrl),
    null,
    'the browser must hold no Supabase session after the failed refresh'
  );

  // The app's documented path: the guard sends the signed-out visitor to
  // sign-in on the next navigation, carrying the protected screen back.
  await shell.openProtectedPageExpectingSignIn(this.landlordPage, '/overview');
  assert.strictEqual(
    new URL(this.landlordPage.url()).searchParams.get('redirect'),
    '/overview',
    'the guard must carry the protected screen as the return target'
  );
  console.log('[web-app] the failed server-side refresh signed the landlord out; the guard then sent them to sign in');
});

Given('the API cannot verify tokens because the key set is unavailable', async function () {
  // A real second app whose JWKS location is a closed port: every verification
  // fails to fetch a key and fails closed with 503. The page is opened on that
  // instance's own origin, so the app's own client — not a stub — receives the
  // 503. The session cookie is host-scoped, so the signed-in landlord is still
  // signed in there.
  const page = requirePage(this);
  this.outageProbe = await startAppWithUnreachableJwks();
  this.probeApps.push(this.outageProbe);

  this.outageResponses = [];
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (/^\/api\/properties(\/|$)/.test(url.pathname)) {
      this.outageResponses.push({ path: url.pathname, status: response.status() });
    }
  });

  await shell.openAt(page, this.outageProbe.baseUrl);
  assert.ok(!signInPage.isSignInUrl(page), 'the signed-in landlord must still reach the shell');
});

Then('the app shows the unreachable state', async function () {
  const page = requirePage(this);
  const stateElement = await shell.expectUnreachableRailState(page);
  assert.strictEqual(
    await stateElement.getAttribute('role'),
    'status',
    'the shared state must announce itself as a status'
  );
  assert.ok(
    this.outageResponses.some((response) => response.path === '/api/properties' && response.status === 503),
    `the app's properties request must have been refused by the outage app with 503 ` +
      `(observed: ${JSON.stringify(this.outageResponses)})`
  );
});

Then('the session is not cleared', async function () {
  const page = requirePage(this);
  const stored = await authState.storedSession(this.context, state.webBaseUrl);
  assert.ok(stored, 'an auth outage must not clear the session cookie');
  const claims = authTokens.decode(stored.access_token);
  assert.ok(claims, 'the surviving session must carry a JWT');
  assert.strictEqual(
    claims.payload.sub,
    state.auth && state.auth.primaryUserId,
    'the surviving session must still be the signed-in landlord’s'
  );
  assert.ok(
    state.auth && state.auth.primaryEmail,
    'the harness must know the signed-in landlord'
  );
  await shell.expectSignedInAs(page, state.auth.primaryEmail);
  assert.ok(!signInPage.isSignInUrl(page), 'an auth outage must not send the landlord to sign-in');

  // The probe app is this scenario's; stop it and prove its port is free.
  this.probeApps = this.probeApps.filter((probe) => probe !== this.outageProbe);
  const stopped = await stopProbeApp(this.outageProbe);
  assert.strictEqual(stopped, true, `the outage app's port ${this.outageProbe.port} must be free after the scenario`);
  assert.strictEqual(await probeTcpPort(this.outageProbe.port), false, 'nothing may still listen on the outage app port');
  console.log('[web-app] a 503 auth outage mounts the unreachable state and leaves the session intact');
});

// ---------------------------------------------------------------------------
// Sign-out clears the visible state
// ---------------------------------------------------------------------------

// The next account's documents carry a MutationObserver that records any
// sighting of the previous landlord's markers. It starts at document creation,
// so even a pre-hydration flash is caught; the record survives navigations in
// sessionStorage.
async function installFlashDetector(context, markers) {
  await context.addInitScript(
    ({ key, markers: watched }) => {
      try {
        const record = () => {
          const text = document.body ? document.body.innerText : '';
          if (!text) return;
          let seen = [];
          try {
            seen = JSON.parse(window.sessionStorage.getItem(key) || '[]');
          } catch {
            seen = [];
          }
          let changed = false;
          for (const marker of watched) {
            if (text.includes(marker) && !seen.includes(marker)) {
              seen.push(marker);
              changed = true;
            }
          }
          if (changed) window.sessionStorage.setItem(key, JSON.stringify(seen));
        };
        const start = () => {
          record();
          const observer = new MutationObserver(record);
          observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
        };
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', start, { once: true });
        } else {
          start();
        }
      } catch {
        /* storage unavailable: nothing to record through */
      }
    },
    { key: FLASH_STORAGE_KEY, markers }
  );
}

async function flashSeen(page) {
  return page.evaluate((key) => {
    try {
      const raw = window.sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, FLASH_STORAGE_KEY);
}

Given('a signed-in landlord with properties and a ledger on screen', async function () {
  this.landlord = await this.createDisposableIdentity({ confirmed: true });
  const session = await authState.newSignedInContext({
    browser: state.browser,
    origin: state.webBaseUrl,
    email: this.landlord.email,
    password: this.landlord.password,
  });
  this.extraContext = session.context;
  this.landlordPage = session.page;

  const stored = authState.sessionFromStorageState(session.storageState);
  assert.ok(stored && stored.access_token, 'the landlord must hold a real session');
  this.landlordToken = stored.access_token;

  // A property this landlord owns, created with their own cookie session (the
  // After hook deletes it with that state; deleting the account cascades too).
  const owned = await api.postProperty(
    this.probePayload({ address: 'Acceptance Probe Way Sign Out' }),
    { storageState: session.storageState }
  );
  assert.ok(
    owned.status === 201 && owned.body && owned.body.data && owned.body.data.id,
    `arrangement failed: the landlord's property was not created (HTTP ${owned.status})`
  );
  this.landlordProperty = owned.body.data;
  this.createdProperties.push({ id: this.landlordProperty.id, subject: { storageState: session.storageState } });

  // A ledger on screen: entries in the app's own store, then shown in the
  // Transactions view. The description is unique so a flash is detectable.
  this.ledgerMarker = `Acceptance previous account ledger ${Date.now()}`;
  this.ledgerEntries = [
    {
      id: `probe-signout-${Date.now()}`,
      date: '2026-11-05',
      description: this.ledgerMarker,
      category: 'Rent',
      amount: 4200,
      type: 'income',
      property: this.landlordProperty.id,
    },
  ];
  await ledgerView.seedTransactions(this.landlordPage, this.ledgerEntries);
  await shell.reload(this.landlordPage);
  await shell.waitForSidebarProperties(this.landlordPage);
  await shell.expectSidebarProperty(this.landlordPage, this.landlordProperty.name);
  await ledgerView.open(this.landlordPage);
  await ledgerView.expectTransactionVisible(this.landlordPage, this.ledgerEntries[0]);

  // The persisted property selection: choosing the property writes the store's
  // entry, which the sign-out must remove.
  await shell.selectProperty(this.landlordPage, this.landlordProperty.name);
  await waitFor(
    async () =>
      (await ledgerView.storedSelectedProperty(this.landlordPage)) === this.landlordProperty.id,
    {
      timeoutMs: 10_000,
      intervalMs: 250,
      label: 'the property selection to be persisted before the sign-out',
    }
  );
});

Then('the visible ledger, property list, and cached queries are cleared', async function () {
  const page = this.landlordPage;

  // The visible ledger and property list are gone: the signed-out document is
  // the sign-in surface and carries none of the previous landlord's content.
  assert.ok(signInPage.isSignInUrl(page), 'sign-out must have left the ledger for sign-in');
  assert.strictEqual(
    await page.locator('main table tbody tr').count(),
    0,
    'the visible ledger must hold no rows after sign-out'
  );
  assert.strictEqual(
    await page.getByText(this.ledgerMarker, { exact: false }).count(),
    0,
    'no ledger entry may remain on screen after sign-out'
  );
  assert.strictEqual(
    await page.getByRole('button', { name: /All Properties/ }).count(),
    0,
    'the property list must not remain on screen after sign-out'
  );

  // The in-memory property selection's persisted entry is removed.
  const selection = await ledgerView.storedSelectedProperty(page);
  assert.strictEqual(
    selection,
    null,
    `the selected-property storage entry (${LEDGER_PROPERTY_SELECTION_KEY}) must be removed, found "${selection}"`
  );

  // The ledger's storage is the one piece this change deliberately leaves
  // alone: design §6 (and task 5.2) defer re-keying, importing, and retiring
  // the local ledger to server-transactions. What must not survive is the
  // per-account shape; the legacy device-scoped key is the recorded interim
  // risk, and the harness clears it between scenarios.
  const transactionKeys = await ledgerView.storedTransactionKeys(page);
  const perAccountKeys = transactionKeys.filter((key) => key !== ledgerView.STORAGE_KEY);
  assert.deepStrictEqual(
    perAccountKeys,
    [],
    `no per-account ledger key may survive sign-out, found: ${perAccountKeys.join(', ')}`
  );
  if (transactionKeys.includes(ledgerView.STORAGE_KEY)) {
    // Still there by design — assert it is the device ledger's own entry, not
    // a half-cleared or foreign shape.
    const deviceEntries = await ledgerView.storedTransactions(page);
    assert.ok(
      Array.isArray(deviceEntries),
      'the surviving legacy ledger key must still hold the device ledger’s entry array'
    );
  }
  console.log(
    `[web-app] sign-out cleared the visible ledger, the property list, and the selected property; ` +
      `the legacy device ledger key (${transactionKeys.join(', ') || 'none'}) is deferred to server-transactions — ` +
      'design §6 records that a second landlord on this browser can still read it until that change lands'
  );

  // The query cache is empty: the next account's first load is a fresh server
  // read that returns no rows — never the previous landlord's cached list. The
  // body is read inside the handler, while the document that owns it is alive.
  const next = await this.createDisposableIdentity({ confirmed: true });
  await installFlashDetector(this.extraContext, [this.landlordProperty.name, this.ledgerMarker]);

  const listResponse = new Promise((resolve) => {
    const onResponse = (response) => {
      const url = new URL(response.url());
      if (response.request().method() !== 'GET' || !isPropertiesUrl(url)) return;
      page.off('response', onResponse);
      resolve(
        response
          .json()
          .then((body) => ({ status: response.status(), body }))
          .catch(() => ({ status: response.status(), body: null }))
      );
    };
    page.on('response', onResponse);
  });

  await signInPage.submit(page, { email: next.email, password: next.password });
  await page.waitForURL((url) => url.pathname === '/overview', { timeout: signInPage.WAIT_MS });
  await shell.waitForShell(page);

  const response = await listResponse;
  assert.strictEqual(response.status, 200, 'the next account’s fresh list read must succeed');
  assert.ok(response.body, 'the fresh list response body must be readable');
  assert.strictEqual(response.body.success, true, 'the fresh list read must carry success true');
  assert.deepStrictEqual(
    response.body.data,
    [],
    'the next account must load an empty list — a cached previous-account list would mean the cache survived'
  );
  await shell.waitForSidebarProperties(page);
  assert.strictEqual(
    await page.getByText(this.landlordProperty.name, { exact: false }).count(),
    0,
    'the next account must not render the previous landlord’s property'
  );
});

Then("the next account does not see the previous landlord's data flash on screen", async function () {
  const page = this.landlordPage;
  const seen = await flashSeen(page);
  assert.deepStrictEqual(
    seen,
    [],
    `the next account's documents must never render the previous landlord's data, but saw: ${seen.join(', ')}`
  );

  // The previous landlord's server rows are gone from the picker; the next
  // account's screen shows its own empty state.
  await shell.expectSidebarPropertyAbsent(page, this.landlordProperty.name);
  assert.strictEqual(
    await page.getByText(this.ledgerMarker, { exact: false }).count(),
    0,
    'the previous ledger must not appear on the next account’s screen'
  );

  // The detector's record is scenario state; remove it so nothing survives.
  await page.evaluate((key) => window.sessionStorage.removeItem(key), FLASH_STORAGE_KEY);
  console.log('[web-app] the next account’s first paint carried none of the previous landlord’s data');
});

