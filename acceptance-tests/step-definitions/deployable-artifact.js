'use strict';

// Step definitions for the deployable-artifact capability.
//
// These scenarios run the *built* app, not the harness's dev server:
// `support/web-bundle.js` builds once per run (cached at web/.output) and
// `support/second-app.js` starts that artifact on a free port with the same
// server environment, then stops it and proves the port is free. The bundle
// scenario reuses the same cached artifact.
//
// The page assertion follows the app's own redirect: an anonymous request to
// `/` is answered with a redirect to a page, and *that* page is HTML. That is
// what "a page request returns HTML" means on this app; a 307 alone would not.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { Given, When, Then } = require('@cucumber/cucumber');

const {
  REPO_ROOT,
  delay,
  probeTcpPort,
  registerPostTeardownCheck,
  runCommand,
  tailOf,
} = require('../support/harness');
const api = require('../support/api-client');
const { assertEnvelope } = require('../support/api-shapes');
const { acceptanceEnv } = require('../support/env');
const {
  buildProductionApp,
  readWebEnv,
  filesContaining,
  filesMatching,
  databasePassword,
} = require('../support/web-bundle');
const {
  startBuiltApp,
  startBuiltAppWithUnreachableDatabase,
  runBuiltAppWithoutVariable,
} = require('../support/second-app');

// ---------------------------------------------------------------------------
// shared helpers
// ---------------------------------------------------------------------------

async function git(args) {
  return runCommand('git', args, { cwd: REPO_ROOT, timeoutMs: 30_000 });
}

async function gitStatus() {
  const result = await git(['status', '--porcelain']);
  assert.strictEqual(result.code, 0, `git status failed:\n${tailOf(result.stderr)}`);
  return result.stdout.trim();
}

// The built app is stopped by the per-scenario After hook (its port is proven
// free there). Register the after-teardown proof so a leak reddens the run even
// though teardown happens after the scenario finishes.
function registerBuiltAppPortCheck(app) {
  registerPostTeardownCheck({
    label: `after teardown the built app port is closed (${app.port})`,
    check: async () => {
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        if (!(await probeTcpPort(app.port))) return true;
        await delay(250);
      }
      return false;
    },
  });
}

// Starts the cached artifact on a fresh port and remembers it for teardown.
async function startProbeBuiltApp(world, { label, waitForHealth = true, unreachableDatabase = false }) {
  await buildProductionApp();
  const app = unreachableDatabase
    ? await startBuiltAppWithUnreachableDatabase()
    : await startBuiltApp({ label, waitForHealth });
  world.probeApps.push(app);
  registerBuiltAppPortCheck(app);
  return app;
}

async function assertPageHtml(app, context) {
  const response = await fetch(`${app.baseUrl}/`, {
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000),
  });
  const body = await response.text();
  const contentType = response.headers.get('content-type') || '';
  assert.strictEqual(
    response.status,
    200,
    `${context}: expected the page to answer 200, got ${response.status} (body: ${body.slice(0, 160)})`
  );
  assert.match(contentType, /text\/html/i, `${context}: the page must answer HTML, got "${contentType}"`);
  assert.match(body, /<!doctype html|<html[\s>]/i, `${context}: the page body must be an HTML document`);
  console.log(
    `[deployable-artifact] the built server answered a page with HTML at ${response.url || '/'} ` +
      `(${body.length} bytes)`
  );
}

// ---------------------------------------------------------------------------
// The built server serves a page and a route
// ---------------------------------------------------------------------------

Given('the repository at its committed state', async function () {
  const rev = await git(['rev-parse', 'HEAD']);
  assert.strictEqual(rev.code, 0, `git rev-parse HEAD failed:\n${tailOf(rev.stderr)}`);

  // The build must run from the repository's own tracked sources. The change
  // under test may still be uncommitted, so this pins HEAD and records the
  // working tree; the build then has to leave that tree exactly as it found it
  // (asserted below). The check gates own the stricter clean-tree demand.
  const tracked = await git([
    'ls-files',
    '--error-unmatch',
    'web/vite.config.ts',
    'web/package.json',
    'package.json',
  ]);
  assert.strictEqual(
    tracked.code,
    0,
    `the app's build inputs must be tracked in HEAD:\n${tailOf(tracked.stderr)}`
  );

  this.repoState = {
    head: rev.stdout.trim(),
    statusBefore: await gitStatus(),
  };
  console.log(
    `[deployable-artifact] building the repository at ${this.repoState.head.slice(0, 12)} ` +
      '(the working tree carries the change under test)'
  );
});

When('the production build runs and its server starts', async function () {
  this.built = await buildProductionApp();
  this.builtApp = await startProbeBuiltApp(this, {
    label: 'built-app-committed-state',
    waitForHealth: true,
  });
});

Then('a page request returns HTML', async function () {
  assert.ok(this.builtApp, 'no built app is running');
  await assertPageHtml(this.builtApp, 'the built app');
});

Then('a request to the properties route returns the JSON envelope', async function () {
  assert.ok(this.builtApp, 'no built app is running');
  const response = await api.getPropertiesList({
    baseUrl: this.builtApp.baseUrl,
    session: false,
  });
  assert.ok(response.body, `expected a JSON envelope, got: ${response.text.slice(0, 160)}`);
  assert.strictEqual(
    typeof response.body.success,
    'boolean',
    'the envelope must carry a boolean success field'
  );
  assert.strictEqual(
    response.body.success,
    false,
    'the anonymous properties request must not succeed'
  );
  assert.ok(
    typeof response.body.message === 'string' && response.body.message.length > 0,
    'the envelope must carry a non-empty message'
  );
  for (const key of Object.keys(response.body)) {
    assert.ok(
      ['success', 'message', 'data'].includes(key),
      `the envelope must carry only success/message/data, found "${key}"`
    );
  }
  console.log(
    `[deployable-artifact] the built app's properties route answered HTTP ${response.status} ` +
      `with the JSON envelope`
  );
});

Then("the platform adapter's output directory is present", async function () {
  const build = this.built;
  assert.ok(build, 'the production build has not run');
  assert.ok(fs.existsSync(build.outputDir), `the adapter output directory is missing: ${build.outputDir}`);
  assert.ok(fs.existsSync(build.serverEntry), `the adapter server entry is missing: ${build.serverEntry}`);
  assert.strictEqual(
    build.adapter && build.adapter.preset,
    'node-server',
    `the adapter manifest must name the node-server preset, got ${JSON.stringify(build.adapter && build.adapter.preset)}`
  );
  assert.ok(
    build.adapter.serverEntry && fs.existsSync(path.join(build.outputDir, build.adapter.serverEntry)),
    'the adapter manifest must name a server entry that exists'
  );
  assert.ok(
    fs.existsSync(path.join(build.outputDir, 'public')),
    'the adapter must emit the client payload beside the server'
  );

  // The build is a production artifact, not a source edit: the tracked tree is
  // exactly as it was before the build.
  const statusAfter = await gitStatus();
  assert.strictEqual(
    statusAfter,
    this.repoState.statusBefore,
    'the production build must not modify a tracked file; git status changed:\n' +
      `before:\n${this.repoState.statusBefore}\nafter:\n${statusAfter}`
  );
  console.log(
    `[deployable-artifact] the adapter output is present at ` +
      `${path.relative(REPO_ROOT, build.outputDir)} (preset ${build.adapter.preset}, ` +
      `build cached in ${build.durationMs}ms)`
  );
});

// ---------------------------------------------------------------------------
// No session is a 401 on the built app
// ---------------------------------------------------------------------------

Given('the built app is running', async function () {
  this.builtApp = await startProbeBuiltApp(this, { label: 'built-app', waitForHealth: true });
});

When('a client requests the properties list without a session cookie', async function () {
  assert.ok(this.builtApp, 'no built app is running');
  this.builtAppResponse = await api.getPropertiesList({
    baseUrl: this.builtApp.baseUrl,
    session: false,
  });
});

Then('the response is {int} with success false', function (status) {
  const response = this.builtAppResponse;
  assert.ok(response, 'no built-app response was recorded');
  assertEnvelope(response, { status, success: false });
  assert.ok(
    !('data' in response.body),
    `the ${status} refusal must carry no data, found ${JSON.stringify(response.body.data)}`
  );
});

// ---------------------------------------------------------------------------
// Health reports database readiness
// ---------------------------------------------------------------------------

Given('the built app is running and the database is unreachable', async function () {
  this.builtApp = await startProbeBuiltApp(this, {
    label: 'built-app-db-unreachable',
    waitForHealth: false,
    unreachableDatabase: true,
  });
});

When('a client requests the health route', async function () {
  assert.ok(this.builtApp, 'no built app is running');
  this.builtAppResponse = await api.getApiHealth({
    baseUrl: this.builtApp.baseUrl,
    session: false,
  });
});

Then('a page request still answers', async function () {
  assert.ok(this.builtApp, 'no built app is running');
  await assertPageHtml(this.builtApp, 'the built app while the database is unreachable');
});

// ---------------------------------------------------------------------------
// A missing JWKS location is named
// ---------------------------------------------------------------------------

Given('the app starts without a JWKS location', async function () {
  // Arrange: the built artifact exists and the one required variable this
  // scenario blanks is recorded. The boot itself is the When step.
  await buildProductionApp();
  this.missingVariable = 'SUPABASE_JWKS_URL';
});

When('it boots', async function () {
  assert.ok(this.missingVariable, 'the scenario must name the variable the app starts without');
  // The built server, the named variable blank. It is stopped inside the
  // helper and its port proven free there; the assertions read the recorded
  // statuses and the child's own output.
  this.configRefusal = await runBuiltAppWithoutVariable(this.missingVariable);
  console.log(
    `[deployable-artifact] the built app booted with ${this.missingVariable} blank ` +
      `(port ${this.configRefusal.port})`
  );
});

Then('it fails before serving any request', function () {
  const refusal = this.configRefusal;
  assert.ok(refusal, 'the built app was never started');
  for (const { path: requestPath, status } of refusal.statuses || []) {
    assert.ok(
      status === null || status >= 500,
      `the app must not serve ${requestPath} without a JWKS location (got HTTP ${status})`
    );
  }
  assert.ok(refusal.stopped, 'the sabotaged built app must be stopped after the probe');
  assert.strictEqual(
    refusal.listening,
    false,
    `the app must leave port ${refusal.port} free after refusing to serve`
  );
  assert.ok(
    !/\bsuccess"?\s*:\s*true/.test(refusal.output),
    `the app must refuse before it serves, but its output shows a successful answer:\n${tailOf(refusal.output)}`
  );
  console.log(
    `[deployable-artifact] no request was served: ${(refusal.statuses || [])
      .map(({ path: p, status }) => `${p} → ${status}`)
      .join(', ')}`
  );
});

Then('the message names the missing variable', function () {
  const refusal = this.configRefusal;
  assert.ok(refusal, 'the built app was never started');
  assert.ok(
    refusal.output.includes('SUPABASE_JWKS_URL'),
    `the failure must name the missing variable SUPABASE_JWKS_URL, got:\n${tailOf(refusal.output)}`
  );
  assert.match(
    refusal.output,
    /refuses to serve/i,
    `the failure must state that the app refuses to serve, got:\n${tailOf(refusal.output)}`
  );
  assert.ok(
    !refusal.output.includes('DATABASE_URL'),
    'the failure must name only the absent variable, not the configured database'
  );
  console.log('[deployable-artifact] the missing JWKS location is named before anything serves');
});

// ---------------------------------------------------------------------------
// The bundle carries only public values
// ---------------------------------------------------------------------------

Given('the production build', async function () {
  this.built = await buildProductionApp();
});

When('the client bundle is inspected', function () {
  assert.ok(this.built, 'the production build has not run');
  this.clientFiles = this.built.clientFiles;
  assert.ok(this.clientFiles.length > 0, 'the production build emitted no client files');
});

Then('it carries no service key, secret key, database URL, or JWKS location', function () {
  const clientFiles = this.clientFiles;
  assert.ok(Array.isArray(clientFiles) && clientFiles.length > 0, 'no client bundle has been inspected');

  const webEnv = readWebEnv();
  const harnessEnv = acceptanceEnv();
  const password = databasePassword(webEnv.DATABASE_URL);

  // By value: the actual secret values the environment holds.
  const forbiddenValues = [
    ['the service key', harnessEnv.SUPABASE_SERVICE_ROLE_KEY],
    ['the database URL', webEnv.DATABASE_URL],
    ['the direct database URL', webEnv.DIRECT_DATABASE_URL],
    ['the JWKS location', webEnv.SUPABASE_JWKS_URL],
    ['the database password', password],
  ];
  for (const [label, value] of forbiddenValues) {
    if (!value) continue;
    assert.deepStrictEqual(
      filesContaining(clientFiles, value),
      [],
      `${label} must never appear in the client bundle`
    );
  }

  // By name: the variables and shapes that carry them.
  const forbiddenMarkers = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'service_role',
    'DATABASE_URL',
    'DIRECT_DATABASE_URL',
    'SUPABASE_JWKS_URL',
    'jwks.json',
    'postgresql://',
  ];
  for (const marker of forbiddenMarkers) {
    assert.deepStrictEqual(
      filesContaining(clientFiles, marker),
      [],
      `the client bundle must not mention "${marker}"`
    );
  }

  // A modern sb_secret_… key is a secret wherever it appears.
  assert.deepStrictEqual(
    filesMatching(clientFiles, /\bsb_secret_[A-Za-z0-9_-]{20,}/),
    [],
    'the client bundle must not carry an sb_secret_ key'
  );

  console.log(
    `[deployable-artifact] ${clientFiles.length} client file(s) carry no service key, secret key, ` +
      'database URL, database password, or JWKS location'
  );
});

Then('it needs no Supabase credential to call the same-origin routes', function () {
  const clientFiles = this.clientFiles;

  // No Supabase client and no bearer-token transport in the browser: the
  // session cookie is httpOnly and the routes are same-origin.
  for (const marker of [
    'createClient',
    '@supabase/supabase-js',
    'supabase-js',
    'Authorization',
    'Bearer',
    'access_token',
  ]) {
    assert.deepStrictEqual(
      filesContaining(clientFiles, marker),
      [],
      `the browser must need no Supabase credential, but the client bundle mentions "${marker}"`
    );
  }

  // The route calls are relative paths on the app's own origin, not another
  // host reached with a credential of its own.
  const routeReferences = filesContaining(clientFiles, '/api/properties');
  assert.ok(
    routeReferences.length > 0,
    'the client bundle must call the same-origin /api/properties route'
  );
  console.log(
    `[deployable-artifact] the client calls /api/properties on its own origin with no Supabase ` +
      `client or bearer token (${routeReferences.length} file(s))`
  );
});
