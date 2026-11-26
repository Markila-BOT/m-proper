'use strict';

// Acceptance-harness configuration, loaded once from acceptance-tests/.env.local.
//
// The file is gitignored and operator-held. It carries everything the run needs:
//
// - the Supabase admin key used to create, confirm, and remove disposable
//   identities — a secret that belongs to Node only;
// - the seeded identities and their passwords;
// - the app's own server environment (the database URLs and the auth
//   configuration), because the app under test now reads them from the
//   process environment and serves both the pages and `/api/*`.
//
// This module is the only place that reads the file; the admin key and the
// passwords are never logged, printed, or put into an error message. The
// server values are handed to the app child, which needs them; the admin key
// and the seeded passwords never are.
//
// Node 24's process.loadEnvFile() fills process.env without overriding values
// already set, so an operator can still override one variable from the shell.
// The file is loaded lazily and only once; a repeated call returns the same
// frozen snapshot.

const fs = require('node:fs');
const path = require('node:path');

const ACCEPTANCE_ENV_FILE = path.resolve(__dirname, '..', '.env.local');

// The app's server-side environment. The app refuses to serve without these,
// so the preflight names all of them at once before anything boots.
const SERVER_VARIABLES = [
  'DATABASE_URL',
  'DIRECT_DATABASE_URL',
  'SUPABASE_JWKS_URL',
  'SUPABASE_JWT_ISSUER',
  'SUPABASE_JWT_AUD',
];

// What each server name is, for the failure message. Values never appear.
const SERVER_VARIABLE_LABELS = {
  DATABASE_URL: 'the database connection',
  DIRECT_DATABASE_URL: 'the direct database connection for migrations',
  SUPABASE_JWKS_URL: 'the JWKS location',
  SUPABASE_JWT_ISSUER: 'the issuer',
  SUPABASE_JWT_AUD: 'the audience',
};

// Every variable the run needs. Missing names are named in the failure — never
// their values.
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
  ...SERVER_VARIABLES,
];

// The harness-only secrets. They must never reach an app child.
const HARNESS_ONLY_VARIABLES = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SEED_OWNER_PASSWORD',
  'SEED_A_PASSWORD',
  'SEED_B_PASSWORD',
];

let snapshot = null;
let loadFailure = null;

function missingEnvFileError() {
  return new Error(
    `Acceptance harness configuration is missing: ${ACCEPTANCE_ENV_FILE} does not exist. ` +
      `Create it (it is gitignored; never commit it) defining: ${REQUIRED_VARIABLES.join(', ')}. ` +
      'The suite needs the seeded identities, the Supabase admin key, the database URLs, and ' +
      'the auth configuration to sign in, to boot the app, and to remove disposable accounts.'
  );
}

function missingVariablesError(missing) {
  return new Error(
    `Acceptance harness configuration is incomplete: ${ACCEPTANCE_ENV_FILE} does not define ` +
      `${missing.join(', ')}. Add the missing variable(s) to that file; the suite needs the ` +
      'seeded identities for sign-in, the Supabase admin key for disposable accounts, and the ' +
      'server environment (database URLs, JWKS location, issuer, audience) for the app.'
  );
}

// Parses KEY=value lines. Used for the acceptance file fallback and by the
// preflight's standalone child, which must read a chosen file without
// touching the real configuration.
function readEnvFile(filePath) {
  const values = {};
  if (!filePath || !fs.existsSync(filePath)) return values;
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

function parseEnvFileFallback(filePath) {
  // process.loadEnvFile exists on Node 24; this fallback keeps the harness
  // honest on an older runtime without adding a dependency.
  for (const [key, value] of Object.entries(readEnvFile(filePath))) {
    if (process.env[key] === undefined) process.env[key] = value;
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

// ---------------------------------------------------------------------------
// The server environment preflight
// ---------------------------------------------------------------------------
//
// The suite's pre-boot gate: every server name the app needs, from the chosen
// env file with an exported value winning, and one failure naming every
// missing variable at once. `inputs` is injectable so the suite's own
// missing-configuration scenarios can prove the gate as a child process.

function resolveServerEnvironment({ env = process.env, envFile = ACCEPTANCE_ENV_FILE } = {}) {
  const fromFile = readEnvFile(envFile);
  const resolved = {};
  const missing = [];

  for (const name of SERVER_VARIABLES) {
    const value = (env[name] !== undefined ? env[name] : fromFile[name]) || '';
    if (value.trim() === '') {
      missing.push(name);
    } else {
      resolved[name] = value;
    }
  }

  return { env: resolved, missing, envFile };
}

function serverPreflightError(missing, { envFile } = {}) {
  const named = missing.map((name) => `${name} (${SERVER_VARIABLE_LABELS[name] || name})`).join(', ');
  const where = envFile || ACCEPTANCE_ENV_FILE;
  return new Error(
    `Acceptance suite preflight refuses to run any scenario: missing required configuration: ${named}. ` +
      `Add the missing value(s) to ${where}, or export them. ` +
      'The app serves the pages and /api from one process, so it cannot boot without its database ' +
      'connection, JWKS location, issuer, and audience.'
  );
}

function assertServerEnvironment(inputs = {}) {
  const { env, missing, envFile } = resolveServerEnvironment(inputs);
  if (missing.length > 0) throw serverPreflightError(missing, { envFile });
  return env;
}

// The database connection alone, for callers that only need the URL.
function resolveDatabaseUrl(inputs = {}) {
  const { env } = resolveServerEnvironment(inputs);
  return env.DATABASE_URL || null;
}

function assertDatabaseConnection(inputs = {}) {
  const missingDatabase = resolveServerEnvironment(inputs).missing.includes('DATABASE_URL');
  if (missingDatabase) {
    throw serverPreflightError(['DATABASE_URL'], { envFile: inputs.envFile });
  }
  return resolveServerEnvironment(inputs).env.DATABASE_URL;
}

// ---------------------------------------------------------------------------
// The app child environment
// ---------------------------------------------------------------------------
//
// The app child gets the complete server environment — the database URLs and
// the auth configuration — plus the public `VITE_` values, because one process
// now serves the pages and `/api`. It gets neither the Supabase admin key nor
// the seeded passwords: those belong to Node's harness only. `overrides` is
// applied last so a probe can blank or repoint one variable.
function webProcessEnvironment({ base = process.env, overrides = {} } = {}) {
  const env = { ...base };
  for (const name of HARNESS_ONLY_VARIABLES) delete env[name];

  const server = acceptanceEnv();
  for (const name of ['SUPABASE_URL', ...SERVER_VARIABLES]) {
    if (server[name] !== undefined) env[name] = server[name];
  }

  // The public browser configuration (web/.env): Vite reads the file itself,
  // but passing the values states the contract the app child receives.
  const { readPublicWebEnv } = require('./web-bundle');
  for (const [name, value] of Object.entries(readPublicWebEnv())) {
    if (name.startsWith('VITE_')) env[name] = value;
  }

  for (const [name, value] of Object.entries(overrides)) env[name] = value;
  return env;
}

module.exports = {
  ACCEPTANCE_ENV_FILE,
  REQUIRED_VARIABLES,
  SERVER_VARIABLES,
  SERVER_VARIABLE_LABELS,
  HARNESS_ONLY_VARIABLES,
  readEnvFile,
  loadAcceptanceEnv,
  acceptanceEnv,
  resolveServerEnvironment,
  serverPreflightError,
  assertServerEnvironment,
  resolveDatabaseUrl,
  assertDatabaseConnection,
  webProcessEnvironment,
};
