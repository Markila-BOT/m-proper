'use strict';

// Page object for the app shell: the root route, the navigation tabs, and
// the properties sidebar. Routes, tab labels and sidebar structure live
// here — the step definitions read as intent and hold no selectors.
//
// ADR-0003 moves the four tabs to real routes; until that change lands they
// are buttons, and this page object is the single place to flip when it
// does.

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
    .getByRole('button', { name: TABS.overview, exact: true })
    .waitFor({ state: 'visible', timeout: WAIT_MS });
}

async function openTab(page, tab) {
  await page.getByRole('button', { name: TABS[tab], exact: true }).click();
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

module.exports = {
  open,
  reload,
  waitForShell,
  openTab,
  waitForSidebarProperties,
  expectSidebarProperty,
  expectSidebarPropertyAbsent,
};
