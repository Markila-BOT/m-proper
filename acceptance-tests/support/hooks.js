'use strict';

// Acceptance-suite lifecycle hooks (scaffold phase).
//
// Live now: the DATABASE_URL preflight — the suite refuses to start any
// scenario when no database connection is resolvable, naming the missing
// configuration instead of failing scenario-by-scenario.
//
// TODO (step-definition phase): app boot/teardown. The harness owns the app
// lifecycle — one command must boot the API and the web dev server on
// harness-chosen ports (PORT override, VITE_API_BASE_URL wiring), drive the
// browser scenarios through Playwright, and shut everything down after the
// run. Until that wiring lands, the Before/After hooks below are empty
// structure only.

const fs = require('node:fs');
const path = require('node:path');
const { BeforeAll, Before, After, AfterAll } = require('@cucumber/cucumber');

// Resolves the database connection the API scenarios need: the DATABASE_URL
// environment variable when set, otherwise the DATABASE_URL line of api/.env.
// The resolved value is treated as a secret: it is never printed or logged.
function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const envPath = path.resolve(__dirname, '..', '..', 'api', '.env');
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    for (const rawLine of envFile.split(/\r?\n/)) {
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

BeforeAll(async function () {
  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    throw new Error(
      'Acceptance suite preflight: no database connection is configured. ' +
        'Set DATABASE_URL to a postgresql:// URI (Supabase Database settings, ' +
        'not the project https URL), or put DATABASE_URL in api/.env. ' +
        'The suite refuses to run any scenario without it.'
    );
  }
  // Expose the resolved connection to the app-boot phase. Never log it.
  process.env.DATABASE_URL = databaseUrl;

  // TODO(step-definition phase): boot the API (cargo run) on a harness-chosen
  // PORT with this DATABASE_URL in its environment, boot the web dev server
  // wired to it via VITE_API_BASE_URL, and launch the Playwright browser.
});

Before(async function () {
  // TODO(step-definition phase): per-scenario fixtures (smoke rows, browser
  // page state). Empty structure in the scaffold.
});

After(async function () {
  // TODO(step-definition phase): per-scenario cleanup (smoke-row removal,
  // browser-stored state). Empty structure in the scaffold.
});

AfterAll(async function () {
  // TODO(step-definition phase): shut the API and the web dev server down and
  // close the Playwright browser — everything the harness booted is down after
  // the run, and only the suite's own smoke rows were ever created.
});
