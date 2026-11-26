'use strict';

// Page object for the app shell: the root route, the navigation tabs, and
// the properties sidebar. Routes, tab labels and sidebar structure live
// here — the step definitions read as intent and hold no selectors.
//
// ADR-0003 landed: the four tabs are real routes, so the tab controls are
// router Links (anchors with hrefs) — the locators below target links.

const { state } = require('../support/harness');

const TABS = {
  overview: 'Overview',
  transactions: 'Transactions',
  properties: 'Properties',
};

const WAIT_MS = 20_000;

async function open(page) {
  await openAt(page, state.webBaseUrl);
}

// Opens the app on a named origin — the harness instance, or a second app a
// hostile scenario owns. The session cookie is host-scoped, so the same
// signed-in context reaches a probe instance on another port.
async function openAt(page, baseUrl) {
  // networkidle, not just domcontentloaded: the shell is server-rendered,
  // and a tab click that lands before React hydrates is silently dropped.
  // The app's load-time API fetches fire only once hydrated, so waiting for
  // the network to settle is a deterministic interactivity signal.
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await waitForShell(page);
}

async function reload(page) {
  await page.reload({ waitUntil: 'networkidle' });
  await waitForShell(page);
}

async function waitForShell(page) {
  // Backstop behind the networkidle wait: the shell is interactive once the
  // navigation tabs render. The sidebar property list is still fetching at
  // this point.
  await page
    .getByRole('link', { name: TABS.overview, exact: true })
    .waitFor({ state: 'visible', timeout: WAIT_MS });
}

async function openTab(page, tab) {
  await page.getByRole('link', { name: TABS[tab], exact: true }).click();
}

async function waitForSidebarProperties(page) {
  // The sidebar renders a skeleton while the properties load; the real list
  // is up when its "All Properties" entry renders. Target the entry BUTTON,
  // not a heading: the Overview summary also carries an "All Properties"
  // heading on the default 'all' selection, and the button's accessible name
  // ("All Properties View combined data") is unique.
  await page
    .getByRole('button', { name: /All Properties/ })
    .waitFor({ state: 'visible', timeout: WAIT_MS });
}

async function expectSidebarProperty(page, name) {
  // Sidebar entries are buttons whose accessible name leads with the
  // property name (address and unit details follow it).
  const entry = page.getByRole('button', { name }).first();
  await entry.waitFor({ state: 'visible', timeout: WAIT_MS });
  return entry;
}

async function expectSidebarPropertyAbsent(page, name) {
  const entry = page.getByRole('button', { name }).first();
  await entry.waitFor({ state: 'detached', timeout: WAIT_MS });
}

// Pick a property in the sidebar, which writes the property store's persisted
// selection — the state the sign-out reset must remove.
async function selectProperty(page, name) {
  const entry = await expectSidebarProperty(page, name);
  await entry.click();
}

// --- the shared unreachable state (surface-api-unreachable-state) ---

// The properties routes are on the app's own origin now, so the unreachable
// state is driven from the test side: the page's `/api/properties` requests
// are aborted before the app mounts them, which is exactly the network failure
// the shared state names. Nothing in the product writes a base-URL override.
const PROPERTIES_ROUTE_PATTERN = '**/api/properties';

// The key the retired runtime override used. It is asserted absent, never
// written: the app has no base URL to redirect.
const RETIRED_API_BASE_URL_OVERRIDE_KEY = 'landlord-api-base-url-override';

async function breakPropertiesReachability(page, onAbort = () => {}) {
  await page.route(PROPERTIES_ROUTE_PATTERN, async (route) => {
    onAbort(route.request().url());
    await route.abort('failed');
  });
}

async function restorePropertiesReachability(page) {
  await page.unroute(PROPERTIES_ROUTE_PATTERN);
}

async function retiredApiBaseUrlOverride(page) {
  return page.evaluate(
    (key) => window.localStorage.getItem(key),
    RETIRED_API_BASE_URL_OVERRIDE_KEY
  );
}

async function expectUnreachableRailState(page) {
  // The shared state's rail mount: the nav that carries the entry list
  // carries the state line where the entries would print. The step asserts
  // the marker and role; the copy stays the app's own.
  const state = page
    .locator('nav[aria-label="Properties"]')
    .locator('[data-unreachable="properties"]');
  await state.waitFor({ state: 'visible', timeout: WAIT_MS });
  return state;
}

// --- the signed-in identity and the way out (design §7) ---

// The header names the signed-in landlord beside the one sign-out control.
async function expectSignedInAs(page, email) {
  await page.getByText(email, { exact: true }).first().waitFor({
    state: 'visible',
    timeout: WAIT_MS,
  });
}

// Sign-out is a server function behind the header button; on success the page
// loads /sign-in, so the guard re-reads the cleared cookies on the server.
async function signOut(page) {
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.waitForURL((url) => url.pathname.startsWith('/sign-in'), { timeout: WAIT_MS });
}

// Open a protected route as an unsigned visitor: the shell's beforeLoad guard
// must send them to sign-in instead of rendering the ledger.
async function openProtectedPageExpectingSignIn(page, path = '/overview') {
  await page.goto(new URL(path, state.webBaseUrl).toString(), { waitUntil: 'networkidle' });
  await page.waitForURL((url) => url.pathname.startsWith('/sign-in'), { timeout: WAIT_MS });
  await page
    .getByRole('heading', { level: 1, name: 'Sign in', exact: true })
    .waitFor({ state: 'visible', timeout: WAIT_MS });
}

module.exports = {
  open,
  openAt,
  reload,
  waitForShell,
  openTab,
  waitForSidebarProperties,
  expectSidebarProperty,
  expectSidebarPropertyAbsent,
  selectProperty,
  breakPropertiesReachability,
  restorePropertiesReachability,
  retiredApiBaseUrlOverride,
  expectUnreachableRailState,
  expectSignedInAs,
  signOut,
  openProtectedPageExpectingSignIn,
};
