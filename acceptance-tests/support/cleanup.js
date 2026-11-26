'use strict';

// Per-scenario cleanup contracts, shared by the Before/After hooks and the
// suite's own "Smoke rows and stored state are gone after the run" scenario:
// the scenario invokes the very helpers the hooks run, so it proves the
// mechanism the suite actually uses.
//
// Cleanup owns every kind of state a scenario can create:
//   - smoke properties (deleted through the authenticated API),
//   - browser-stored ledger state,
//   - disposable identities (deleted through the Auth admin API).
// The identity path is guarded by support/identities.js: only addresses with
// the disposable prefix can be removed, so the seeded owners are never at
// risk even if a scenario records the wrong object.

const assert = require('node:assert/strict');

const api = require('./api-client');
const identities = require('./identities');
const { state } = require('./harness');
const authState = require('./auth-state');
const ledgerView = require('../pages/ledger-view');
const shell = require('../pages/app-shell');

// Deletes this scenario's recorded smoke rows through the API client so the
// ledger is left as found even when an assertion failed mid-scenario.
//
// Rows are deleted as the owner who holds them: the primary owner's rows go
// through the default (primary) session, and a row arranged for the second
// owner carries its owner's token. A cross-owner delete would answer 404 and
// leave the row behind.
async function removeScenarioSmokeRows(world) {
  const attempted = new Set();

  for (const entry of world.createdProperties || []) {
    if (!entry || !entry.id || attempted.has(entry.id)) continue;
    attempted.add(entry.id);
    await api
      .deletePropertyById(entry.id, entry.token ? { token: entry.token } : undefined)
      .catch(() => {});
  }

  for (const id of world.createdPropertyIds || []) {
    if (!id || attempted.has(id)) continue;
    attempted.add(id);
    await api.deletePropertyById(id).catch(() => {});
  }

  world.createdProperties = [];
  world.createdPropertyIds = [];
}

// Stops every second API instance the scenario started, then proves nothing is
// still listening on its port. The 503/outage probes must not outlive the
// scenario even when an assertion failed. second-api is required lazily so this
// module stays free of a load-order dependency on the API process plumbing.
async function stopScenarioProbeApis(world) {
  const probes = world.probeApis || [];
  world.probeApis = [];
  const results = [];
  const { stopProbeApi } = require('./second-api');
  for (const probe of probes) {
    try {
      results.push({ port: probe.port, stopped: await stopProbeApi(probe) });
    } catch (error) {
      results.push({ port: probe && probe.port, stopped: false, error: error.message });
    }
  }
  return results;
}

// The Before-side sweep: the cached signed-in storage state is cleaned of
// every ledger-state key before the scenario's context is created from it, so
// a scenario never inherits another's rows. A no-op when chromium is missing
// (no context is created then).
function prepareScenarioStorageState() {
  const storageState = authState.getStorageState({
    origin: state.webBaseUrl,
    identity: 'primary',
  });
  return storageState ? ledgerView.clearLedgerStateFromStorageState(storageState) : null;
}

// Clears the browser-stored state the scenarios seeded — every
// `landlord-transactions*` key (the legacy key and the retired per-account
// keys), the persisted property selection, and the base-URL override the
// unreachable scenario pointed at a dead port — so nothing a scenario stored
// survives the run. A no-op when this scenario never opened a page.
//
// Then it asserts the sweep actually worked: a scenario that leaves a ledger
// key behind fails with the surviving keys named. This is the per-scenario
// proof of the acceptance-suite requirement "Every account ledger is cleared".
async function clearScenarioBrowserState(world) {
  if (!world.page) return { removed: [], remaining: [] };

  // A scenario that never navigated has an about:blank page: no document
  // origin, no localStorage, and nothing a previous scenario could reach.
  if (!/^https?:/i.test(world.page.url())) return { removed: [], remaining: [] };

  const removed = await ledgerView.clearStoredTransactions(world.page).catch(() => []);
  await shell.clearApiBaseUrlOverride(world.page).catch(() => {});

  const remaining = await ledgerView.storedLedgerKeys(world.page).catch((error) => {
    throw new Error(`could not verify the browser's ledger keys after cleanup: ${error.message}`);
  });
  assert.deepStrictEqual(
    remaining,
    [],
    `browser storage still holds ledger key(s) after cleanup: ${remaining.join(', ')} — ` +
      'no landlord-transactions* key or landlord-selected-property entry may survive a scenario'
  );
  return { removed, remaining };
}

// Deletes the disposable identities this scenario created. Runs even when the
// scenario failed; failures are reported but never stop the remaining
// deletes (identities.deleteDisposableUsers attempts every account).
async function removeScenarioDisposableUsers(world) {
  const created = world.disposableIdentities || [];
  if (created.length === 0) return { deleted: [], failed: [] };

  const summary = await identities.deleteDisposableUsers(created.slice());
  world.disposableIdentities = [];

  if (summary.failed.length > 0) {
    console.error(
      `[harness] disposable-account cleanup failed for: ` +
        summary.failed.map((entry) => entry.email || '(unknown email)').join(', ')
    );
  }
  return summary;
}

module.exports = {
  prepareScenarioStorageState,
  removeScenarioSmokeRows,
  stopScenarioProbeApis,
  clearScenarioBrowserState,
  removeScenarioDisposableUsers,
};
