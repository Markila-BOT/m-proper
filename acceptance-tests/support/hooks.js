'use strict';

// Acceptance-suite lifecycle: preflight, app boot, browser, teardown.
//
// 1. Preflight FIRST: no database connection resolvable → the suite refuses
//    to boot anything, naming the missing configuration.
// 2. Boot the API (`cargo run` from api/, harness-chosen PORT, CORS wired to
//    the harness web origin) and wait for /health to tell the truth.
// 3. Boot the web dev server (vite, harness-chosen port, VITE_API_BASE_URL
//    pointing at the API) and wait for its port to accept connections.
// 4. Launch one headless Playwright chromium for the whole suite.
//
// AfterAll always runs: smoke probes swept through the API, browser closed,
// both processes killed (SIGTERM → SIGKILL on their process groups). A
// process 'exit' handler SIGKILLs the groups even if the runner crashes, so
// nothing the harness booted can outlive the run.

const path = require('node:path');
const { BeforeAll, Before, After, AfterAll, setDefaultTimeout } = require('@cucumber/cucumber');
const {
  REPO_ROOT,
  state,
  isProbeName,
  spawnHarnessProcess,
  stopAllSpawnedProcesses,
  waitForApiHealth,
  waitForTcpPort,
  probeTcpPort,
  runPostTeardownChecks,
  tailOf,
} = require('./harness');
const { assertDatabaseConnection } = require('./preflight');
const { loadAcceptanceEnv, appProcessEnvironment } = require('./env');
const authState = require('./auth-state');
const identities = require('./identities');
const {
  prepareScenarioStorageState,
  removeScenarioSmokeRows,
  stopScenarioProbeApis,
  clearScenarioBrowserState,
  removeScenarioDisposableUsers,
} = require('./cleanup');
const api = require('./api-client');

// Cucumber's default step timeout is 5000ms, which browser flows and the
// suite's own child runs exceed. Every wait inside the harness carries its
// own, much tighter bound (page-object waits, runCommand timeouts, fetch
// aborts), so this outer guard is raised once, here — it exists only so a
// step can never be killed while its own bounded work is still in flight.
// The suite-minus-self child run caps itself at 20 minutes inside
// runCommand, comfortably below this guard.
setDefaultTimeout(25 * 60_000);

// Deletes any smoke probe rows left behind by the run (best effort; the
// per-scenario After hook already removed the recorded ones).
async function sweepProbeProperties() {
  const response = await api.getPropertiesList();
  if (!response.body || !Array.isArray(response.body.data)) return;
  const probes = response.body.data.filter((row) => isProbeName(row.name));
  for (const probe of probes) {
    await api.deletePropertyById(probe.id);
  }
  if (probes.length > 0) {
    console.error(`[harness] swept ${probes.length} leftover smoke row(s): ${probes.map((p) => p.name).join(', ')}`);
  }
}

BeforeAll(async function () {
  // --- 0. Harness configuration: identities and the admin key ---
  // acceptance-tests/.env.local is gitignored and operator-held. Loading it
  // here means every Node-side helper (sign-in, admin calls) sees the same
  // snapshot, and a missing file fails with an actionable message before
  // anything boots. The key itself is never printed.
  loadAcceptanceEnv();

  // --- 1. Database preflight: fail before any boot if absent ---
  // Resolves DATABASE_URL from the environment, otherwise from api/.env;
  // the resolved value is a secret and is never printed. support/preflight.js
  // is the same gate the suite's missing-connection scenario spawns as a
  // child process.
  const databaseUrl = assertDatabaseConnection();
  // Expose the resolved connection to the app-boot phase. Never log it.
  process.env.DATABASE_URL = databaseUrl;
  state.databaseUrl = databaseUrl;

  state.apiBaseUrl = `http://localhost:${state.apiPort}`;
  state.webBaseUrl = `http://localhost:${state.webPort}`;

  // The apps are not running before the suite starts: record that both
  // harness ports were free, then boot from scratch. The lifecycle scenario
  // ("The app is alive for the scenarios and gone after") asserts this
  // recorded fact.
  state.portsFreeBeforeBoot =
    !(await probeTcpPort(state.apiPort)) && !(await probeTcpPort(state.webPort));

  try {
    // --- 2. Boot the API on a harness-chosen port ---
    state.apiProcess = spawnHarnessProcess({
      label: 'api',
      command: 'cargo',
      args: ['run'],
      cwd: path.join(REPO_ROOT, 'api'),
      env: {
        // The API runtime never receives the harness's admin key or seeded
        // passwords; its own api/.env and the harness's port/CORS values are
        // all it needs.
        ...appProcessEnvironment(process.env),
        PORT: String(state.apiPort),
        CORS_ORIGINS: state.webBaseUrl,
      },
    });
    // `cargo run` may rebuild first, so the readiness window is generous.
    await waitForApiHealth(state.apiBaseUrl, 90_000);

    // --- 3. Boot the web dev server wired to the API ---
    state.webProcess = spawnHarnessProcess({
      label: 'web',
      command: process.execPath,
      args: [
        path.join('node_modules', 'vite', 'bin', 'vite.js'),
        'dev',
        '--port',
        String(state.webPort),
        '--strictPort',
      ],
      cwd: path.join(REPO_ROOT, 'web'),
      env: {
        // The web dev server never receives the admin key or seeded
        // passwords; only the public app configuration (web/.env) and the
        // harness API base belong here.
        ...appProcessEnvironment(process.env),
        VITE_API_BASE_URL: state.apiBaseUrl,
      },
    });
    await waitForTcpPort(state.webPort, 60_000, `web dev server on port ${state.webPort}`);

    // --- 4. One headless chromium for the whole suite ---
    try {
      const { chromium } = require('@playwright/test');
      state.browser = await chromium.launch({ headless: true });
    } catch (error) {
      // HTTP-only scenarios still run; browser steps fail with this named cause.
      state.browserLaunchError = error;
      console.error(
        `[harness] chromium not launched: ${error.message}\n` +
          '[harness] run `npx playwright install chromium` inside acceptance-tests/ once.'
      );
    }

    // --- 5. Sign the primary owner in once, through the real page ---
    // The storage state is cached per origin for the whole run; every
    // scenario context reuses it. The suite-minus-self child runs this same
    // hook in its own process against its own web port, so each origin signs
    // in exactly once per run.
    if (state.browser) {
      const session = await authState.ensureSession({
        browser: state.browser,
        origin: state.webBaseUrl,
        identity: 'primary',
      });
      state.auth = {
        primaryOrigin: session.origin,
        primaryEmail: session.email,
        primaryUserId: session.userId,
        signedInAt: session.signedInAt,
      };
    }
  } catch (error) {
    // A failed boot or sign-in must not leak what it started.
    if (state.browser) {
      await state.browser.close().catch(() => {});
      state.browser = null;
    }
    await stopAllSpawnedProcesses();
    throw error;
  }

  console.error(
    `[harness] api ${state.apiBaseUrl} · web ${state.webBaseUrl} · chromium ${state.browser ? 'ready' : 'missing'}` +
      (state.auth ? ` · signed in as ${state.auth.primaryEmail}` : '')
  );
});

Before(async function () {
  // Per-scenario fixtures: a fresh context built from the run's cached
  // storage state keeps scenarios isolated from each other while every one
  // runs as the same signed-in landlord. HTTP state lives on the (fresh)
  // World.
  if (state.browser) {
    // Before: the cached state is stripped of every ledger-state key before
    // the context is created, so no scenario inherits another's rows.
    const storageState = prepareScenarioStorageState();
    this.context = await state.browser.newContext(
      storageState ? { storageState } : undefined
    );
    this.page = await this.context.newPage();
  }
});

After(async function () {
  // Per-scenario cleanup: clear the browser-stored state this scenario
  // seeded, close the page and its context, then remove this scenario's
  // smoke rows and disposable identities so nothing it created survives —
  // even when an assertion failed. These are the same helpers the suite's
  // "leaves no trace" scenario invokes to prove the mechanism.
  //
  // The cleanup asserts no ledger key survives. Its failure must not stop the
  // closes and deletes below (a leaked account or page is worse than a
  // reported storage leak), so it is captured and re-thrown last.
  let storageLeak = null;
  try {
    await clearScenarioBrowserState(this);
  } catch (error) {
    storageLeak = error;
  }
  // The glass scenarios measure at deviceScaleFactor 2, which needs its own
  // browser context (the harness page runs at the default scale). That
  // context is closed here whichever way the scenario ended.
  if (this.extraContext) {
    await this.extraContext.close().catch(() => {});
    this.extraContext = null;
  }
  if (this.page) {
    await this.page.close().catch(() => {});
    this.page = null;
  }
  if (this.context) {
    await this.context.close().catch(() => {});
    this.context = null;
  }
  await removeScenarioDisposableUsers(this);
  // Second API instances (the key-set-outage probe) are killed here whichever
  // way the scenario ended, before the smoke rows are swept.
  await stopScenarioProbeApis(this).catch(() => {});
  await removeScenarioSmokeRows(this);
  if (storageLeak) throw storageLeak;
});

AfterAll(async function () {
  // Always: remove every disposable account this run created, sweep leaked
  // probes through the still-running API, close the browser, then stop both
  // processes. Nothing may outlive the run.
  //
  // The identity sweep runs first and independently: a failed scenario, a
  // failed browser close, or an API error must never leave a disposable
  // account behind. The guard in support/identities.js cannot remove a seeded
  // owner even if one were somehow registered.
  try {
    const summary = await identities.removeAllDisposableUsers();
    if (summary.deleted.length > 0 || summary.failed.length > 0) {
      console.error(
        `[harness] disposable accounts removed: ${summary.deleted.length}` +
          (summary.failed.length > 0
            ? `; failed: ${summary.failed.map((entry) => entry.email || '(unknown)').join(', ')}`
            : '')
      );
    }
    if (summary.failed.length > 0) process.exitCode = 1;
  } catch (error) {
    process.exitCode = 1;
    console.error(`[harness] disposable-account sweep failed: ${tailOf(error.message, 300)}`);
  }

  try {
    await sweepProbeProperties();
  } catch (error) {
    console.error(`[harness] probe sweep skipped: ${tailOf(error.message, 200)}`);
  }
  try {
    if (state.browser) await state.browser.close();
  } catch {
    /* closing an already-closed browser is fine */
  }
  state.browser = null;
  await stopAllSpawnedProcesses();
  console.error('[harness] both processes stopped; nothing left listening on the harness ports');
  // Registered post-teardown checks ("gone after the run" contracts): each
  // prints PASS, or prints FAIL and marks the run's exit code non-zero.
  await runPostTeardownChecks();
});
