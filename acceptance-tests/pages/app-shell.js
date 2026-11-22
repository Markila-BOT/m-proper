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
  // networkidle, not just domcontentloaded: the shell is server-rendered,
  // and a tab click that lands before React hydrates is silently dropped.
  // The app's load-time API fetches fire only once hydrated, so waiting for
  // the network to settle is a deterministic interactivity signal.
  await page.goto(state.webBaseUrl, { waitUntil: 'networkidle' });
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

// --- the shared unreachable state (surface-api-unreachable-state) ---

// The app's runtime base-URL override key (web/src/lib/api-client.ts): a
// dev/test affordance the api-client honors ahead of the baked env base.
// Nothing in the product writes it; the unreachable scenario's page load
// does, so the suite never needs a second harness boot to point one page
// at a dead port.
const API_BASE_URL_OVERRIDE_KEY = 'landlord-api-base-url-override';

async function openWithApiBaseUrl(page, baseUrl) {
  // A scenario-local page load with the base URL pointed where the
  // scenario needs it: the override is written before any app code runs,
  // so the page's very first property fetch targets the given base.
  await page.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, value),
    { key: API_BASE_URL_OVERRIDE_KEY, value: baseUrl }
  );
  await open(page);
}

async function clearApiBaseUrlOverride(page) {
  // The After-hook cleanup: the override never outlives its scenario.
  await page.evaluate(
    (key) => window.localStorage.removeItem(key),
    API_BASE_URL_OVERRIDE_KEY
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

module.exports = {
  open,
  reload,
  waitForShell,
  openTab,
  waitForSidebarProperties,
  expectSidebarProperty,
  expectSidebarPropertyAbsent,
  openWithApiBaseUrl,
  clearApiBaseUrlOverride,
  expectUnreachableRailState,
};
