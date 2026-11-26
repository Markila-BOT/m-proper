'use strict';

// The web production build the deployable-artifact scenarios inspect and run.
//
// One builder, one artifact. `vite build` runs the Nitro plugin, so the server
// and client output always lands in `web/.output` (the platform adapter's
// output directory); `--outDir` is ignored by Nitro and is not used. The build
// is cached in this module for the life of the run — the first scenario that
// needs it pays the cost, every later scenario reuses the same descriptor:
//
//   web/.output            (gitignored) the cached artifact
//     server/index.mjs     the runnable Node server
//     public/              the browser payload
//     nitro.json           the adapter manifest (preset: node-server)
//
// The build runs with the same stripped environment the harness gives the app
// process (`webProcessEnvironment`, which drops the admin key and the seeded
// passwords); Vite loads web/.env as it does for the dev server. A build never
// writes a tracked file (asserted by the scenario, not assumed here).

const fs = require('node:fs');
const path = require('node:path');

const { REPO_ROOT, runCommand, tailOf } = require('./harness');
const { webProcessEnvironment } = require('./env');

const WEB_DIR = path.join(REPO_ROOT, 'web');
const VITE_BIN = path.join(WEB_DIR, 'node_modules', 'vite', 'bin', 'vite.js');
const OUTPUT_DIR = path.join(WEB_DIR, '.output');
const SERVER_ENTRY = path.join(OUTPUT_DIR, 'server', 'index.mjs');
const ADAPTER_MANIFEST = path.join(OUTPUT_DIR, 'nitro.json');

function webEnvFile() {
  return path.join(WEB_DIR, '.env');
}

// Parses KEY=value lines from web/.env.
function readEnvEntries(filePath) {
  const values = {};
  if (!fs.existsSync(filePath)) return values;
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (key) values[key] = value;
  }
  return values;
}

// Every entry in web/.env, including the server-side names the file holds for
// local development. The bundle scan uses this to prove those *values* never
// reach the browser.
function readWebEnv() {
  return readEnvEntries(webEnvFile());
}

// The web app's public environment: only `VITE_`-prefixed values are shipped
// to the browser, so only those count as public configuration.
function readPublicWebEnv() {
  return Object.fromEntries(
    Object.entries(readWebEnv()).filter(([name]) => name.startsWith('VITE_'))
  );
}

let buildPromise = null;
let buildResult = null;

// Builds the production app once per process and returns the cached
// descriptor. Concurrent callers share the same promise.
async function buildProductionApp() {
  if (buildResult) return buildResult;
  if (buildPromise) return buildPromise;

  buildPromise = (async () => {
    const startedAt = Date.now();
    const result = await runCommand(process.execPath, [VITE_BIN, 'build'], {
      cwd: WEB_DIR,
      timeoutMs: 300_000,
      env: webProcessEnvironment(),
    });
    if (result.code !== 0) {
      throw new Error(`the web production build failed (exit ${result.code}):\n${tailOf(result.stderr)}`);
    }
    if (!fs.existsSync(SERVER_ENTRY)) {
      throw new Error(
        `the production build wrote no server entry at ${path.relative(REPO_ROOT, SERVER_ENTRY)}`
      );
    }
    if (!fs.existsSync(ADAPTER_MANIFEST)) {
      throw new Error(
        `the production build wrote no adapter manifest at ${path.relative(REPO_ROOT, ADAPTER_MANIFEST)}`
      );
    }

    const adapter = JSON.parse(fs.readFileSync(ADAPTER_MANIFEST, 'utf8'));
    buildResult = {
      outputDir: OUTPUT_DIR,
      serverEntry: SERVER_ENTRY,
      adapterManifest: ADAPTER_MANIFEST,
      adapter,
      clientFiles: clientFiles(OUTPUT_DIR),
      allFiles: allBuildFiles(OUTPUT_DIR),
      durationMs: Date.now() - startedAt,
    };
    console.error(
      `[web-bundle] production build cached at ${path.relative(REPO_ROOT, OUTPUT_DIR)} ` +
        `(${buildResult.allFiles.length} file(s), ${buildResult.durationMs}ms; ` +
        `${buildResult.clientFiles.length} client file(s))`
    );
    return buildResult;
  })();

  try {
    return await buildPromise;
  } finally {
    buildPromise = null;
  }
}

// Compatibility wrapper for callers written before the Nitro output moved to
// `web/.output`. The directory argument is accepted but ignored: Nitro owns
// the output location. Returns the same run-scoped descriptor.
async function buildWebBundle() {
  return buildProductionApp();
}

function filesUnder(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...filesUnder(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

// The build's browser payload: everything Vite emitted for the client. The
// Nitro node-server preset writes it to `.output/public` (older presets used
// `.output/client`); both spellings are recognized so the helper names the
// artifact rather than a layout detail.
function clientFiles(buildDir = OUTPUT_DIR) {
  const candidates = [path.join(buildDir, 'public'), path.join(buildDir, 'client')];
  const clientDir = candidates.find((candidate) => fs.existsSync(candidate));
  if (!clientDir) {
    throw new Error(
      `the web build wrote no client payload under ${path.relative(REPO_ROOT, buildDir)}`
    );
  }
  return filesUnder(clientDir);
}

function allBuildFiles(buildDir = OUTPUT_DIR) {
  return filesUnder(buildDir);
}

// Files in `files` whose text contains `needle`. Read as utf8: the emitted
// assets are text.
function filesContaining(files, needle) {
  if (typeof needle !== 'string' || needle.length === 0) return [];
  return files.filter((file) => fs.readFileSync(file, 'utf8').includes(needle));
}

// Files in `files` whose text matches `pattern`. Returns `{ file, match }`.
function filesMatching(files, pattern) {
  const found = [];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const match = pattern.exec(text);
    if (match) found.push({ file, match: match[0] });
  }
  return found;
}

// The password embedded in a postgres URL, for the bundle scan. Returns null
// for a value that is not a URL or carries no password.
function databasePassword(databaseUrl) {
  if (!databaseUrl) return null;
  try {
    return decodeURIComponent(new URL(databaseUrl).password) || null;
  } catch {
    return null;
  }
}

// Every JWT-shaped string in the build, with its decoded payload. Used to
// prove no *service-role* token is shipped — the library's own key-prefix
// constants (e.g. Supabase's client warning about `sb_secret_` keys) are not
// secrets and are not what the scenario forbids.
const JWT_PATTERN = /eyJ[A-Za-z0-9_-]{5,}\.eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g;

function jwtsIn(files) {
  const found = [];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const token of text.match(JWT_PATTERN) || []) {
      let payload = null;
      try {
        payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
      } catch {
        payload = null;
      }
      found.push({ file, token, payload });
    }
  }
  return found;
}

module.exports = {
  WEB_DIR,
  OUTPUT_DIR,
  SERVER_ENTRY,
  ADAPTER_MANIFEST,
  webEnvFile,
  readWebEnv,
  readPublicWebEnv,
  buildProductionApp,
  buildWebBundle,
  clientFiles,
  allBuildFiles,
  filesContaining,
  filesMatching,
  databasePassword,
  jwtsIn,
};
