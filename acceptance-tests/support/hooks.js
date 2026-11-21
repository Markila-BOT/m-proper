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
const { removeScenarioSmokeRows, clearScenarioBrowserState } = require('./cleanup');
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
        ...process.env,
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
        ...process.env,
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
  } catch (error) {
    // A failed boot must not leak what it started.
    await stopAllSpawnedProcesses();
    throw error;
  }

  console.error(
    `[harness] api ${state.apiBaseUrl} · web ${state.webBaseUrl} · chromium ${state.browser ? 'ready' : 'missing'}`
  );
});

Before(async function () {
  // Per-scenario fixtures: a fresh browser page (a fresh context, so
  // browser storage starts empty) keeps scenarios isolated from each
  // other; HTTP state lives on the (fresh) World.
  if (state.browser) {
    this.page = await state.browser.newPage();
  }
});

After(async function () {
  // Per-scenario cleanup: clear the browser-stored state this scenario
  // seeded, close the page, then remove this scenario's smoke rows so the
  // ledger is left as found even when an assertion failed. These are the
  // same helpers the suite's "leaves no trace" scenario invokes to prove
  // the mechanism.
  await clearScenarioBrowserState(this);
  if (this.page) {
    await this.page.close().catch(() => {});
    this.page = null;
  }
  await removeScenarioSmokeRows(this);
});

AfterAll(async function () {
  // Always: sweep leaked probes through the still-running API, close the
  // browser, then stop both processes. Nothing may outlive the run.
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
