'use strict';

// Process plumbing for the two hostile scenarios that need a second app
// instance:
//
//   - "A JWKS outage fails closed" spawns a second app whose
//     SUPABASE_JWKS_URL points at a closed port, so every token verification
//     fails to fetch a key;
//   - "The app starts without an issuer or JWKS location" runs the app with
//     one required variable blank and expects every request to fail while the
//     child's own output names the missing variable.
//
// Both use the same process the harness boots: `vite dev` from web/. The
// harness's own instance keeps serving on its port for the whole run. Every
// probe gets a free port this module proves is closed first, and is killed
// with its port proven free again.

const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');

const {
  REPO_ROOT,
  spawnHarnessProcess,
  stopSpawnedProcess,
  probeTcpPort,
  waitFor,
  waitForAppHealth,
  waitForTcpPort,
  tailOf,
} = require('./harness');
const { webProcessEnvironment } = require('./env');
const { buildProductionApp, SERVER_ENTRY } = require('./web-bundle');

const WEB_DIR = path.join(REPO_ROOT, 'web');
const VITE_BIN = path.join(WEB_DIR, 'node_modules', 'vite', 'bin', 'vite.js');

// A port nothing is listening on: bind 0, learn the port, release it.
function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function assertPortClosed(port, label) {
  const answers = await probeTcpPort(port);
  if (answers) {
    throw new Error(`${label}: port ${port} already answers — the probe would not be isolated.`);
  }
}

function readLog(label) {
  try {
    return fs.readFileSync(path.join(__dirname, '..', '.extracted', 'harness-logs', `${label}.log`), 'utf8');
  } catch {
    return '';
  }
}

// Spawns a second app instance on a fresh port with the given environment
// overrides applied to the complete app environment.
async function startSecondApp({ label, overrides = {}, waitForHealth = true } = {}) {
  const port = await freePort();
  await assertPortClosed(port, label);
  const resolvedLabel = `${label}-${port}`;

  const child = spawnHarnessProcess({
    label: resolvedLabel,
    probe: true,
    command: process.execPath,
    args: [VITE_BIN, 'dev', '--port', String(port), '--strictPort'],
    cwd: WEB_DIR,
    env: webProcessEnvironment({ overrides }),
  });

  const baseUrl = `http://localhost:${port}`;
  const app = { child, label: resolvedLabel, port, baseUrl };

  if (waitForHealth) {
    try {
      await waitForAppHealth(baseUrl, 120_000);
    } catch (error) {
      await stopSpawnedProcess(child, resolvedLabel);
      throw new Error(
        `${error.message} (log: .extracted/harness-logs/${resolvedLabel}.log; ` +
          `tail: ${tailOf(readLog(resolvedLabel), 600)})`
      );
    }
  } else {
    await waitForTcpPort(port, 120_000, `${label} on port ${port}`);
  }

  return app;
}

// A second app that serves normally but cannot fetch its key set: only the
// JWKS location is replaced with a closed port.
async function startAppWithUnreachableJwks() {
  const jwksPort = await freePort();
  await assertPortClosed(jwksPort, 'the closed JWKS port');
  const jwksUrl = `http://127.0.0.1:${jwksPort}/auth/v1/.well-known/jwks.json`;

  const app = await startSecondApp({
    label: 'jwks-outage-app',
    overrides: { SUPABASE_JWKS_URL: jwksUrl },
  });

  return { ...app, jwksPort, jwksUrl };
}

// Stop a probe app and prove the port is free again.
async function stopProbeApp(app) {
  await stopSpawnedProcess(app.child, app.label);
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (!(await probeTcpPort(app.port))) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return !(await probeTcpPort(app.port));
}

// Run a second app with one required server variable blank. The app must
// refuse to serve, its own output must name the variable, and its port must be
// free once it has been stopped. Every other server value is passed in full,
// so the blank one is the only reason to refuse.
async function runAppWithoutVariable(variable) {
  const app = await startSecondApp({
    label: `config-refusal-${variable.toLowerCase()}`,
    overrides: { [variable]: '' },
    waitForHealth: false,
  });

  let statuses = null;
  try {
    // Every request must fail: the module graph refuses to initialise, so the
    // dev server answers an error rather than a page or an envelope.
    statuses = [];
    await waitFor(
      async () => {
        const health = await fetch(`${app.baseUrl}/api/health`, {
          signal: AbortSignal.timeout(5000),
        }).then((response) => response.status).catch(() => null);
        const list = await fetch(`${app.baseUrl}/api/properties`, {
          signal: AbortSignal.timeout(5000),
        }).then((response) => response.status).catch(() => null);
        statuses = [
          { path: '/api/health', status: health },
          { path: '/api/properties', status: list },
        ];
        return health !== null || list !== null;
      },
      { timeoutMs: 120_000, intervalMs: 1000, label: `${variable} refusal request` }
    );

    // The child's output names the blank variable; wait for that line rather
    // than racing the dev server's log flush.
    await waitFor(() => readLog(app.label).includes(variable), {
      timeoutMs: 30_000,
      intervalMs: 500,
      label: `the ${app.label} log naming ${variable}`,
    });
  } finally {
    app.stopped = await stopProbeApp(app);
  }

  return {
    ...app,
    variable,
    statuses,
    output: readLog(app.label),
    listening: await probeTcpPort(app.port),
  };
}

// ---------------------------------------------------------------------------
// The built app (deployable-artifact scenarios)
// ---------------------------------------------------------------------------
//
// The deployable-artifact scenarios need the artifact, not the dev server: the
// production build's own server entry (web/.output/server/index.mjs), started
// with the same server environment the harness gives the dev app, on a fresh
// port proven closed first. The build is the run-scoped cache in web-bundle.js,
// so only the first caller pays for it.

async function startBuiltApp({ label = 'built-app', overrides = {}, waitForHealth = true } = {}) {
  const build = await buildProductionApp();
  const port = await freePort();
  await assertPortClosed(port, label);
  const resolvedLabel = `${label}-${port}`;

  const child = spawnHarnessProcess({
    label: resolvedLabel,
    probe: true,
    command: process.execPath,
    // Nitro's node-server preset reads NITRO_PORT or PORT; PORT is the one the
    // harness already speaks.
    args: [SERVER_ENTRY],
    cwd: WEB_DIR,
    env: webProcessEnvironment({ overrides: { ...overrides, PORT: String(port) } }),
  });

  const baseUrl = `http://localhost:${port}`;
  const app = { child, label: resolvedLabel, port, baseUrl, build };

  try {
    if (waitForHealth) {
      await waitForAppHealth(baseUrl, 120_000);
    } else {
      // A sabotaged instance (an unreachable database, a blank variable) never
      // answers a successful health check, so readiness is the listening port.
      await waitForTcpPort(port, 120_000, `${label} on port ${port}`);
    }
  } catch (error) {
    await stopSpawnedProcess(child, resolvedLabel);
    throw new Error(
      `${error.message} (log: .extracted/harness-logs/${resolvedLabel}.log; ` +
        `tail: ${tailOf(readLog(resolvedLabel), 600)})`
    );
  }

  return app;
}

// The built app serving normally but with a database URL nothing listens on:
// the health route must answer 503 while the pages keep serving.
async function startBuiltAppWithUnreachableDatabase() {
  const databasePort = await freePort();
  await assertPortClosed(databasePort, 'the closed database port');
  const databaseUrl = `postgresql://postgres:acceptance@127.0.0.1:${databasePort}/postgres`;

  const app = await startBuiltApp({
    label: 'built-app-db-unreachable',
    overrides: { DATABASE_URL: databaseUrl },
    waitForHealth: false,
  });

  return { ...app, databasePort, databaseUrl };
}

// Run the built app with one required server variable blank. The app must
// refuse to serve (every request answers an error), its own output must name
// the variable, and its port must be free once it has been stopped.
async function runBuiltAppWithoutVariable(variable) {
  const app = await startBuiltApp({
    label: `built-config-refusal-${variable.toLowerCase()}`,
    overrides: { [variable]: '' },
    waitForHealth: false,
  });

  let statuses = null;
  try {
    statuses = [];
    await waitFor(
      async () => {
        const probe = (requestPath) =>
          fetch(`${app.baseUrl}${requestPath}`, {
            redirect: 'manual',
            signal: AbortSignal.timeout(5000),
          })
            .then((response) => response.status)
            .catch(() => null);
        const [page, health, list] = await Promise.all([
          probe('/'),
          probe('/api/health'),
          probe('/api/properties'),
        ]);
        statuses = [
          { path: '/', status: page },
          { path: '/api/health', status: health },
          { path: '/api/properties', status: list },
        ];
        return page !== null && health !== null && list !== null;
      },
      { timeoutMs: 120_000, intervalMs: 1000, label: `${variable} built refusal request` }
    );

    await waitFor(() => readLog(app.label).includes(variable), {
      timeoutMs: 30_000,
      intervalMs: 500,
      label: `the ${app.label} log naming ${variable}`,
    });
  } finally {
    app.stopped = await stopProbeApp(app);
  }

  return {
    ...app,
    variable,
    statuses,
    output: readLog(app.label),
    listening: await probeTcpPort(app.port),
  };
}

module.exports = {
  WEB_DIR,
  freePort,
  assertPortClosed,
  readLog,
  startSecondApp,
  startAppWithUnreachableJwks,
  stopProbeApp,
  runAppWithoutVariable,
  startBuiltApp,
  startBuiltAppWithUnreachableDatabase,
  runBuiltAppWithoutVariable,
};
