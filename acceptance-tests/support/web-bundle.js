'use strict';

// The web production build the "Only public auth material reaches the browser"
// scenario inspects.
//
// The harness's web dev server is already running, but a dev-served module is
// not a built bundle. `vite build` here is cheap (about two seconds warm) and
// is written to a scratch outDir under `.extracted/`, so it never touches
// web/dist or any source file. The build uses the same environment the harness
// gives the web process (`appProcessEnvironment`, which strips the admin key
// and the seeded passwords), and Vite loads web/.env as it does for the dev
// server.

const fs = require('node:fs');
const path = require('node:path');

const { REPO_ROOT, runCommand, tailOf } = require('./harness');
const { appProcessEnvironment } = require('./env');

const WEB_DIR = path.join(REPO_ROOT, 'web');
const VITE_BIN = path.join(WEB_DIR, 'node_modules', 'vite', 'bin', 'vite.js');

function webEnvFile() {
  return path.join(WEB_DIR, '.env');
}

// The web app's public environment file, parsed as key/value pairs. Every
// value here is shipped to the browser by design; the scenario asserts that
// only `VITE_`-prefixed names appear at all.
function readPublicWebEnv() {
  const filePath = webEnvFile();
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

async function buildWebBundle(outDir) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const result = await runCommand(
    process.execPath,
    [VITE_BIN, 'build', '--outDir', outDir, '--emptyOutDir'],
    {
      cwd: WEB_DIR,
      timeoutMs: 300_000,
      env: appProcessEnvironment(process.env),
    }
  );
  if (result.code !== 0) {
    throw new Error(`the web production build failed (exit ${result.code}):\n${tailOf(result.stderr)}`);
  }
  return result;
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
// server bundle is not sent to a browser, but it is scanned too — no web
// artifact may carry a secret.
function clientFiles(buildDir) {
  const clientDir = path.join(buildDir, 'client');
  if (!fs.existsSync(clientDir)) {
    throw new Error(`the web build wrote no client payload at ${path.relative(REPO_ROOT, clientDir)}`);
  }
  return filesUnder(clientDir);
}

function allBuildFiles(buildDir) {
  return filesUnder(buildDir);
}

// Files in `files` whose text contains `needle`. Read as utf8: the emitted
// assets are text.
function filesContaining(files, needle) {
  if (typeof needle !== 'string' || needle.length === 0) return [];
  return files.filter((file) => fs.readFileSync(file, 'utf8').includes(needle));
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
  webEnvFile,
  readPublicWebEnv,
  buildWebBundle,
  clientFiles,
  allBuildFiles,
  filesContaining,
  jwtsIn,
};
