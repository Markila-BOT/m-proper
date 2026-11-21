'use strict';

// Database preflight for the acceptance suite: resolves the connection the
// API scenarios need — the DATABASE_URL environment variable when set,
// otherwise the DATABASE_URL line of api/.env — and names the missing
// configuration when neither resolves.
//
// The resolution inputs are injectable ({ env, envFile }) so the suite's own
// "A missing database connection is named" scenario can prove the failure
// with a standalone child process, without touching the real configuration.
// The defaults are exactly what the suite's BeforeAll uses. The resolved
// value is a secret: it is never printed or logged.

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_ENV_FILE = path.resolve(__dirname, '..', '..', 'api', '.env');

function resolveDatabaseUrl({ env = process.env, envFile = DEFAULT_ENV_FILE } = {}) {
  if (env.DATABASE_URL) return env.DATABASE_URL;

  if (fs.existsSync(envFile)) {
    const envFileText = fs.readFileSync(envFile, 'utf8');
    for (const rawLine of envFileText.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (key === 'DATABASE_URL' && value) return value;
    }
  }
  return null;
}

function databasePreflightError() {
  return new Error(
    'Acceptance suite preflight: no database connection is configured. ' +
      'Set DATABASE_URL to a postgresql:// URI (Supabase Database settings, ' +
      'not the project https URL), or put DATABASE_URL in api/.env. ' +
      'The suite refuses to run any scenario without it.'
  );
}

// The suite's pre-boot gate: throws the named error when no connection is
// resolvable, so nothing boots and no scenario runs.
function assertDatabaseConnection(inputs = {}) {
  const databaseUrl = resolveDatabaseUrl(inputs);
  if (!databaseUrl) throw databasePreflightError();
  return databaseUrl;
}

module.exports = {
  DEFAULT_ENV_FILE,
  resolveDatabaseUrl,
  assertDatabaseConnection,
  databasePreflightError,
};

// CLI: node support/preflight.js [envFileOverride]
//
// The suite's pre-boot gate as a standalone process — this is the entry the
// missing-connection scenario spawns. Exits 0 when a connection is
// resolvable (without printing it), exits 1 naming the missing
// configuration otherwise — before any scenario runs and before anything is
// booted.
if (require.main === module) {
  try {
    assertDatabaseConnection({
      envFile: process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_ENV_FILE,
    });
    process.exit(0);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
