'use strict';

// Per-scenario cleanup contracts, shared by the After hooks and the suite's
// own "Smoke rows and stored state are gone after the run" scenario: the
// scenario invokes the very helpers the hooks run, so it proves the
// mechanism the suite actually uses.

const api = require('./api-client');
const ledgerView = require('../pages/ledger-view');
const shell = require('../pages/app-shell');

// Deletes this scenario's recorded smoke rows through the API client so the
// ledger is left as found even when an assertion failed mid-scenario.
async function removeScenarioSmokeRows(world) {
  for (const id of world.createdPropertyIds) {
    await api.deletePropertyById(id).catch(() => {});
  }
}

// Clears the browser-stored state the scenarios seeded — the app's own
// transactions storage key, and the base-URL override the unreachable
// scenario pointed at a dead port — so nothing a scenario stored survives
// the run. A no-op when this scenario never opened a page.
async function clearScenarioBrowserState(world) {
  if (world.page) {
    await ledgerView.clearStoredTransactions(world.page).catch(() => {});
    await shell.clearApiBaseUrlOverride(world.page).catch(() => {});
  }
}

module.exports = { removeScenarioSmokeRows, clearScenarioBrowserState };
