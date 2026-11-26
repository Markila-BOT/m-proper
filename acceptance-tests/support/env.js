'use strict';

// Acceptance-harness configuration, loaded once from acceptance-tests/.env.local.
//
// The file is gitignored and operator-held. It carries the Supabase admin key
// the harness needs to create, confirm, and remove disposable identities — a
// secret that belongs to Node only and must never reach the browser or either
// app runtime. This module is the only place that reads it; the admin key is
// never logged, printed, or put into an error message.
//
// Node 24's process.loadEnvFile() fills process.env without overriding values
// already set, so an operator can still override one variable from the shell.
// The file is loaded lazily and only once; a repeated call returns the same
// frozen snapshot.

const fs = require('node:fs');
const path = require('node:path');

const ACCEPTANCE_ENV_FILE = path.resolve(__dirname, '..', '.env.local');

// Every variable the identity/session plumbing needs. Missing names are named
// in the failure — never their values.
const REQUIRED_VARIABLES = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'TEST_OWNER_A_ID',
  'TEST_OWNER_B_ID',
  'SEED_OWNER_EMAIL',
  'SEED_OWNER_PASSWORD',
  'SEED_A_EMAIL',
  'SEED_A_PASSWORD',
  'SEED_B_EMAIL',
  'SEED_B_PASSWORD',
];

let snapshot = null;
let loadFailure = null;

function missingEnvFileError() {
  return new Error(
    `Acceptance harness configuration is missing: ${ACCEPTANCE_ENV_FILE} does not exist. ` +
      `Create it (it is gitignored; never commit it) defining: ${REQUIRED_VARIABLES.join(', ')}. ` +
      'The suite needs the seeded identities and the Supabase admin key to sign in and to ' +
      'create and remove disposable accounts.'
  );
}

function missingVariablesError(missing) {
  return new Error(
    `Acceptance harness configuration is incomplete: ${ACCEPTANCE_ENV_FILE} does not define ` +
      `${missing.join(', ')}. Add the missing variable(s) to that file; the suite needs the ` +
      'seeded identities for sign-in and the Supabase admin key for disposable accounts.'
  );
}

function parseEnvFileFallback(filePath) {
  // process.loadEnvFile exists on Node 24; this fallback keeps the harness
  // honest on an older runtime without adding a dependency.
  const text = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function loadAcceptanceEnv() {
  if (snapshot) return snapshot;
  if (loadFailure) throw loadFailure;

  try {
    if (!fs.existsSync(ACCEPTANCE_ENV_FILE)) throw missingEnvFileError();

    if (typeof process.loadEnvFile === 'function') {
      process.loadEnvFile(ACCEPTANCE_ENV_FILE);
    } else {
      parseEnvFileFallback(ACCEPTANCE_ENV_FILE);
    }

    const missing = REQUIRED_VARIABLES.filter((name) => !process.env[name]);
    if (missing.length > 0) throw missingVariablesError(missing);

    snapshot = Object.freeze(
      Object.fromEntries(REQUIRED_VARIABLES.map((name) => [name, process.env[name]]))
    );
    return snapshot;
  } catch (error) {
    loadFailure = error;
    throw error;
  }
}

function acceptanceEnv() {
  return loadAcceptanceEnv();
}

// The app processes' environment: the harness's own Node environment minus
// every secret. The design puts the service key in the seed and the test
// harness only, never in the web or the API runtime. Vite only exposes
// VITE_-prefixed variables, but stripping the admin key and the seeded
// passwords here makes "no secret reaches an app runtime" structural rather
// than incidental.
function appProcessEnvironment(base = process.env) {
  const env = { ...base };
  for (const name of [
    'SUPABASE_SERVICE_ROLE_KEY',
    'SEED_OWNER_PASSWORD',
    'SEED_A_PASSWORD',
    'SEED_B_PASSWORD',
  ]) {
    delete env[name];
  }
  return env;
}

module.exports = {
  ACCEPTANCE_ENV_FILE,
  REQUIRED_VARIABLES,
  loadAcceptanceEnv,
  acceptanceEnv,
  appProcessEnvironment,
};
