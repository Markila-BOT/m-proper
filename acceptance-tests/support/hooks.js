'use strict';

// Acceptance-suite lifecycle: preflight, migration, app boot, browser, teardown.
//
// 1. Preflight FIRST: no complete server environment → the suite refuses to
//    boot anything, naming every missing variable at once.
// 2. Migrate once: `pnpm --filter web db:migrate` over the direct connection.
//    A failed migration stops the run before any scenario.
// 3. Boot the web app — one process, which also serves /api/properties and
//    /api/health — on a harness-chosen port, and wait for /api/health to tell
//    the truth about the database.
// 4. Launch one headless Playwright chromium for the whole suite.
//
// AfterAll always runs: disposable accounts and smoke probes swept through the
// still-running app, browser closed, the process killed (SIGTERM → SIGKILL on
// its process group). A process 'exit' handler SIGKILLs the group even if the
// runner crashes, so nothing the harness booted can outlive the run.

const path = require('node:path');
const { BeforeAll, Before, After, AfterAll, setDefaultTimeout } = require('@cucumber/cucumber');
const {
  REPO_ROOT,
  state,
  isProbeName,
  spawnHarnessProcess,
  stopAllSpawnedProcesses,
  waitForAppHealth,
  probeTcpPort,
  runCommand,
  runPostTeardownChecks,
  tailOf,
} = require('./harness');
const { assertServerEnvironment } = require('./preflight');
const { loadAcceptanceEnv, webProcessEnvironment } = require('./env');
const authState = require('./auth-state');
const identities = require('./identities');
const {
  prepareScenarioStorageState,
  removeScenarioSmokeRows,
  stopScenarioProbeApps,
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

// Applies the Drizzle migrations once, before any scenario. The app never
// migrates: it connects pooled and only reads, so a fresh database would serve
// nothing until this step ran. A non-zero exit stops the run here.
async function migrateDatabase(env) {
  const startedAt = Date.now();
  const result = await runCommand('pnpm', ['--filter', 'web', 'db:migrate'], {
    cwd: REPO_ROOT,
    timeoutMs: 300_000,
    env,
  });
  if (result.code !== 0) {
    throw new Error(
      `The migrate step failed (exit ${result.code}); the suite stops before any scenario.\n` +
        tailOf(`${result.stdout}\n${result.stderr}`, 4000)
    );
  }
  console.error(`[harness] migrations applied in ${Date.now() - startedAt}ms`);
}

BeforeAll(async function () {
  // --- 0. Harness configuration: identities, admin key, server env ---
  // acceptance-tests/.env.local is gitignored and operator-held. Loading it
  // here means every Node-side helper (sign-in, admin calls) sees the same
  // snapshot, and a missing file fails with an actionable message before
  // anything boots. Secrets are never printed.
  loadAcceptanceEnv();

  // --- 1. Server-environment preflight: fail before any boot if incomplete ---
  // The app serves the pages and /api from one process, so it needs the
  // database connection, the JWKS location, the issuer, and the audience.
  // support/preflight.js is the same gate the suite's missing-configuration
  // scenarios spawn as a child process. Values are secrets and never printed.
  const serverEnv = assertServerEnvironment();
  for (const name of [
    'DATABASE_URL',
    'DIRECT_DATABASE_URL',
    'SUPABASE_URL',
    'SUPABASE_JWKS_URL',
    'SUPABASE_JWT_ISSUER',
    'SUPABASE_JWT_AUD',
  ]) {
    if (serverEnv[name] !== undefined) process.env[name] = serverEnv[name];
  }
  state.databaseUrl = serverEnv.DATABASE_URL;

  const appEnv = webProcessEnvironment();

  // --- 2. Migrate before anything serves ---
  await migrateDatabase(appEnv);

  state.webBaseUrl = `http://localhost:${state.webPort}`;

  // The app is not running before the suite starts: record that the harness
  // port was free, then boot from scratch. The lifecycle scenario asserts this
  // recorded fact.
  state.portsFreeBeforeBoot = !(await probeTcpPort(state.webPort));

  try {
    // --- 3. Boot the one process: pages + /api on the same port ---
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
      // The complete server environment (database URLs, JWKS location,
      // issuer, audience) plus the public VITE_ values; neither the admin key
      // nor the seeded passwords reach this child.
      env: appEnv,
    });
    await waitForAppHealth(state.webBaseUrl, 120_000);

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
    `[harness] app ${state.webBaseUrl} (pages + /api) · chromium ${state.browser ? 'ready' : 'missing'}` +
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
  // Second app instances (the key-set-outage probe and the config refusal)
  // are killed here whichever way the scenario ended, before the smoke rows
  // are swept. Forged cookie jars are closed too.
  await stopScenarioProbeApps(this).catch(() => {});
  for (const context of this.httpContexts || []) {
    await api.closeContext(context);
  }
  this.httpContexts = [];
  await removeScenarioSmokeRows(this);
  if (storageLeak) throw storageLeak;
});

AfterAll(async function () {
  // Always: remove every disposable account this run created, sweep leaked
  // probes through the still-running app, close the browser, then stop the
  // app. Nothing may outlive the run.
  //
  // The identity sweep runs first and independently: a failed scenario, a
  // failed browser close, or an app error must never leave a disposable
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
  await api.closeAllContexts();
  await stopAllSpawnedProcesses();
  console.error('[harness] the app is stopped; nothing left listening on the harness port');
  // Registered post-teardown checks ("gone after the run" contracts): each
  // prints PASS, or prints FAIL and marks the run's exit code non-zero.
  await runPostTeardownChecks();
});
