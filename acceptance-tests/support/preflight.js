'use strict';

// The acceptance suite's pre-boot gate: the app under test serves the pages
// and `/api` from one process, so it cannot boot without its database
// connection, JWKS location, issuer, and audience. The gate resolves them
// from the harness's own env file (acceptance-tests/.env.local) — never
// `api/.env`, which no longer configures anything the app reads — and names
// every missing variable at once.
//
// The resolution inputs are injectable ({ env, envFile }) so the suite's own
// missing-configuration scenarios can prove the failure with a standalone
// child process, without touching the real configuration. The resolved
// values include secrets: they are never printed or logged.

const path = require('node:path');

const {
  ACCEPTANCE_ENV_FILE,
  SERVER_VARIABLES,
  resolveServerEnvironment,
  serverPreflightError,
} = require('./env');

const DEFAULT_ENV_FILE = ACCEPTANCE_ENV_FILE;

module.exports = {
  DEFAULT_ENV_FILE,
  SERVER_VARIABLES,
  resolveServerEnvironment,
  assertServerEnvironment: require('./env').assertServerEnvironment,
  resolveDatabaseUrl: require('./env').resolveDatabaseUrl,
  assertDatabaseConnection: require('./env').assertDatabaseConnection,
  serverPreflightError,
};

// CLI: node support/preflight.js [envFileOverride]
//
// The suite's pre-boot gate as a standalone process — this is the entry the
// missing-configuration scenarios spawn. Exits 0 when every server name is
// resolvable (without printing any value), exits 1 naming every missing one
// otherwise — before any scenario runs and before anything is booted.
if (require.main === module) {
  try {
    const envFile = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_ENV_FILE;
    const { missing } = resolveServerEnvironment({ env: process.env, envFile });
    if (missing.length > 0) throw serverPreflightError(missing, { envFile });
    process.exit(0);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
