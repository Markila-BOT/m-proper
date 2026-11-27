'use strict';

// Fixture loader for the deployment, release, and smoke scenarios.
//
// Two committed fixture families live under acceptance-tests/fixtures/:
// production declarations and release plans. Each family has one
// complete.json and a set of small variants that hold only their difference.
// Loading a variant deep-merges it over the complete document, where a JSON
// null removes the key, and writes the merged document to a run-scoped
// temporary directory. The child commands read that file; the committed
// fixtures are never rewritten, and no generated copy lands in the repository
// (extractAll() wipes acceptance-tests/.extracted on every run, so generated
// fixtures deliberately do not live there).
//
// The {STUB} placeholder in a release plan is replaced with the base URL of
// the run's stub server before the plan is written.
//
// See fixtures/README.md for the seam each command must accept and for the
// report each scenario asserts on.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const FIXTURE_ROOT = path.join(__dirname, '..', 'fixtures');
const DECLARATION_DIR = path.join(FIXTURE_ROOT, 'production-declarations');
const PLAN_DIR = path.join(FIXTURE_ROOT, 'release-plans');

// Deliberately fake values. They are distinctive enough that "no configured
// value appears in the output" is a real check, and they are not secrets.
const PRODUCTION_ENV_BASELINE = Object.freeze({
  DATABASE_URL:
    'postgresql://postgres.production:sentinel-runtime-password@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres',
  DIRECT_DATABASE_URL:
    'postgresql://postgres.production:sentinel-migration-password@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres',
  SUPABASE_URL: 'https://production-ref.supabase.co',
  SUPABASE_ANON_KEY: 'sentinel-anon-key-not-a-real-key',
  SUPABASE_SERVICE_ROLE_KEY: 'sentinel-service-role-key-not-a-real-key',
  SUPABASE_JWKS_URL:
    'https://production-ref.supabase.co/auth/v1/.well-known/jwks.json',
  SUPABASE_JWT_ISSUER: 'https://production-ref.supabase.co/auth/v1',
  SUPABASE_JWT_AUD: 'authenticated',
  SMOKE_ACCOUNT_EMAIL: 'smoke-account@m-proper.example',
});

const VALUES_NEVER_PRINTED = Object.values(PRODUCTION_ENV_BASELINE);

let runDir = null;
let fileCounter = 0;

function fixtureRunDir() {
  if (!runDir) {
    runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'm-proper-acceptance-'));
  }
  return runDir;
}

// Objects merge, arrays replace, and the literal "{{remove}}" removes a key
// (so "without a function region" is written as a small variant). null is a
// real value: `auth.captcha: null` means "no CAPTCHA provider", not "absent".
const REMOVE = '{{remove}}';

function deepMerge(base, overlay) {
  if (overlay === REMOVE) return undefined;
  if (overlay === null || overlay === undefined) return overlay;
  if (typeof overlay !== 'object' || Array.isArray(overlay)) return overlay;
  const merged = {
    ...(base && typeof base === 'object' && !Array.isArray(base) ? base : {}),
  };
  for (const [key, value] of Object.entries(overlay)) {
    if (value === REMOVE) {
      delete merged[key];
      continue;
    }
    merged[key] = deepMerge(merged[key], value);
  }
  return merged;
}

function readFixture(dir, name) {
  const file = path.join(dir, `${name}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(
      `Acceptance fixture "${name}" is missing at ${path.relative(process.cwd(), file)}.`
    );
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function loadDeclaration(name = 'complete') {
  const base = readFixture(DECLARATION_DIR, 'complete');
  if (name === 'complete') return base;
  return deepMerge(base, readFixture(DECLARATION_DIR, name));
}

function loadReleasePlan(name = 'complete') {
  const base = readFixture(PLAN_DIR, 'complete');
  if (name === 'complete') return base;
  return deepMerge(base, readFixture(PLAN_DIR, name));
}

function writeRunFile(prefix, name, document) {
  const dir = path.join(fixtureRunDir(), prefix);
  fs.mkdirSync(dir, { recursive: true });
  fileCounter += 1;
  const file = path.join(dir, `${String(fileCounter).padStart(3, '0')}-${name}.json`);
  fs.writeFileSync(file, `${JSON.stringify(document, null, 2)}\n`);
  return file;
}

// The merged declaration as a file the deployment check can read.
function materialiseDeclaration(name = 'complete') {
  return {
    name,
    path: writeRunFile('declarations', name, loadDeclaration(name)),
    declaration: loadDeclaration(name),
  };
}

// The merged release plan as a file the release command and the smoke can
// read, with every {STUB} endpoint pointed at the run's stub server.
function materialiseReleasePlan(name, { stubUrl, overrides = {} } = {}) {
  if (!stubUrl) throw new Error('materialiseReleasePlan needs the stub base URL.');
  const merged = deepMerge(loadReleasePlan(name), overrides);
  const rendered = JSON.parse(JSON.stringify(merged).replaceAll('{{STUB}}', stubUrl));
  return {
    name,
    path: writeRunFile('release-plans', name, rendered),
    plan: rendered,
  };
}

// The production environment the deployment check reads: the fixture baseline
// (fake values), with per-scenario overrides applied last. An empty string
// means "absent" — the check must treat it as a missing variable rather than
// falling back to the operator's shell.
function productionCheckEnvironment(overrides = {}) {
  return { ...PRODUCTION_ENV_BASELINE, ...overrides };
}

// Values a successful deployment check must never echo, whatever it prints.
function configuredValues() {
  return VALUES_NEVER_PRINTED.slice();
}

function removeRunFixtures() {
  if (!runDir) return;
  fs.rmSync(runDir, { recursive: true, force: true });
  runDir = null;
}

module.exports = {
  DECLARATION_DIR,
  PLAN_DIR,
  PRODUCTION_ENV_BASELINE,
  deepMerge,
  loadDeclaration,
  loadReleasePlan,
  materialiseDeclaration,
  materialiseReleasePlan,
  productionCheckEnvironment,
  configuredValues,
  removeRunFixtures,
};
