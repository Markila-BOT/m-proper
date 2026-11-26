'use strict';

// Process plumbing for the two auth-configuration scenarios that need an API
// instance other than the harness's own:
//
//   - scenario "A JWKS outage fails closed" spawns a second API whose
//     SUPABASE_JWKS_URL points at a closed port, so every token verification
//     fails to fetch a key;
//   - scenario "The API refuses to start without auth configuration" runs the
//     API with one required auth variable removed and expects a non-zero exit
//     before it binds a port.
//
// Neither probe touches the harness's API: it keeps serving on its own port
// for the whole run. Every probe runs `cargo run` against the same target
// directory the harness's API used (warm, so no rebuild), on a free port this
// module proves is closed first.

const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');

const {
  REPO_ROOT,
  state,
  spawnHarnessProcess,
  stopSpawnedProcess,
  probeTcpPort,
  waitForApiHealth,
  runCommand,
  tailOf,
} = require('./harness');
const { appProcessEnvironment } = require('./env');

const API_DIR = path.join(REPO_ROOT, 'api');
const API_MANIFEST = path.join(API_DIR, 'Cargo.toml');

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

// The API's own auth material from api/.env. The values are public (issuer and
// audience are pinned identifiers; the JWKS URL is a public location), so they
// are read here to hand the config-refusal probe a complete environment except
// for the variable the scenario removes.
function readApiAuthEnv() {
  const filePath = path.join(API_DIR, '.env');
  const values = {};
  if (fs.existsSync(filePath)) {
    for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (key) values[key] = value;
    }
  }
  return values;
}

// A second API that serves normally but cannot fetch its key set. Issuer and
// audience come from api/.env (as the harness API's do); only the JWKS
// location is replaced with a closed port.
async function startApiWithUnreachableJwks() {
  const port = await freePort();
  await assertPortClosed(port, 'the JWKS-outage API');
  const jwksPort = await freePort();
  await assertPortClosed(jwksPort, 'the closed JWKS port');
  const jwksUrl = `http://127.0.0.1:${jwksPort}/auth/v1/.well-known/jwks.json`;

  const label = `auth-jwks-outage-api-${port}`;
  const child = spawnHarnessProcess({
    label,
    command: 'cargo',
    args: ['run'],
    cwd: API_DIR,
    env: {
      ...appProcessEnvironment(process.env),
      DATABASE_URL: state.databaseUrl,
      PORT: String(port),
      CORS_ORIGINS: state.webBaseUrl,
      SUPABASE_JWKS_URL: jwksUrl,
    },
  });

  const baseUrl = `http://localhost:${port}`;
  try {
    await waitForApiHealth(baseUrl, 90_000);
  } catch (error) {
    await stopSpawnedProcess(child, label);
    throw new Error(
      `${error.message} (log: .extracted/harness-logs/${label}.log; ` +
        `tail: ${tailOf(readLog(label), 600)})`
    );
  }

  return { child, label, port, jwksPort, jwksUrl, baseUrl };
}

function readLog(label) {
  try {
    return fs.readFileSync(path.join(__dirname, '..', '.extracted', 'harness-logs', `${label}.log`), 'utf8');
  } catch {
    return '';
  }
}

// Stop a probe API and prove the port is free again.
async function stopProbeApi(api) {
  await stopSpawnedProcess(api.child, api.label);
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (!(await probeTcpPort(api.port))) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return !(await probeTcpPort(api.port));
}

// Run the API to completion with one required auth variable removed. The
// process runs from a scratch directory with no `.env` in its ancestry, so
// dotenvy cannot silently supply the removed variable from api/.env; every
// other value is passed explicitly.
async function runApiWithoutVariable(variable) {
  const auth = readApiAuthEnv();
  for (const required of ['SUPABASE_JWT_ISSUER', 'SUPABASE_JWKS_URL', 'SUPABASE_JWT_AUD']) {
    if (!auth[required]) {
      throw new Error(
        `api/.env does not define ${required}; the config-refusal probe needs the ` +
          'other auth variables present so the missing one is the only reason to refuse.'
      );
    }
  }

  const scratchDir = path.join(__dirname, '..', '.extracted', `api-config-probe-${variable.toLowerCase()}`);
  fs.mkdirSync(scratchDir, { recursive: true });

  const port = await freePort();
  await assertPortClosed(port, `the config-refusal probe for ${variable}`);

  const env = {
    ...appProcessEnvironment(process.env),
    DATABASE_URL: state.databaseUrl,
    PORT: String(port),
    CORS_ORIGINS: state.webBaseUrl,
    SUPABASE_JWT_ISSUER: auth.SUPABASE_JWT_ISSUER,
    SUPABASE_JWKS_URL: auth.SUPABASE_JWKS_URL,
    SUPABASE_JWT_AUD: auth.SUPABASE_JWT_AUD,
  };
  delete env[variable];

  const result = await runCommand(
    'cargo',
    ['run', '--quiet', '--manifest-path', API_MANIFEST],
    { cwd: scratchDir, timeoutMs: 120_000, env }
  );

  // The child has exited; its port must never have been a listener.
  const listening = await probeTcpPort(port);
  return { ...result, port, listening, variable };
}

module.exports = {
  freePort,
  assertPortClosed,
  startApiWithUnreachableJwks,
  stopProbeApi,
  runApiWithoutVariable,
};
