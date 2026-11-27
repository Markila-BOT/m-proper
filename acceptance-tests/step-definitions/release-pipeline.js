'use strict';

// Step definitions for the release-pipeline capability.
//
// A scenario gives the release command (or the live smoke) a fixture plan and
// a local stub production world, then asserts two things: what the command
// reported, and what it actually did to the stub (how many properties it
// created, which rows it deleted, whether it touched a marker-less row).
//
// The commands — `scripts/release.ts` (`pnpm run release`) and
// `scripts/smoke-production.ts` (`pnpm run smoke:production`) — do not exist
// yet. Until they do, each scenario fails at the command with
// ERR_PNPM_NO_SCRIPT, which is the red state this change expects.
//
// The plan schema, the `--plan`/`RELEASE_PLAN`/`SMOKE_PLAN` seam, and the
// `[release] summary:` / `[smoke] summary:` reports are documented in
// fixtures/README.md.

const assert = require('node:assert/strict');

const { Given, When, Then } = require('@cucumber/cucumber');

const { REPO_ROOT, runCommand, tailOf } = require('../support/harness');
const {
  loadReleasePlan,
  materialiseReleasePlan,
  productionCheckEnvironment,
} = require('../support/production-fixtures');
const { createStubReleaseServer } = require('../support/stub-release-server');

const RELEASE_COMMAND = 'pnpm run release';
const SMOKE_COMMAND = 'pnpm run smoke:production';

function urlOnPort(port) {
  return (
    'postgresql://postgres.production:sentinel-release-password' +
    `@aws-0-ap-southeast-1.pooler.supabase.com:${port}/postgres`
  );
}

// Starts the stub world for the named plan, then materialises the plan with
// its {STUB} endpoints pointed at that stub. The stub reads only the plan's
// `smoke` and `deployments` sections, so the placeholder endpoints are
// harmless while it is being created.
async function arrangeRelease(world, planName) {
  const planForStub = loadReleasePlan(planName);
  const stub = await createStubReleaseServer({ plan: planForStub });
  world.releaseStub = stub;
  world.releaseFixture = materialiseReleasePlan(planName, {
    stubUrl: stub.url,
  });
  return world.releaseFixture;
}

function releaseEnvironment(world) {
  const fixture = world.releaseFixture;
  const env = {
    ...process.env,
    ...productionCheckEnvironment({
      DATABASE_URL: urlOnPort(6543),
      DIRECT_DATABASE_URL: urlOnPort(5432),
      SUPABASE_URL: fixture.plan.endpoints.supabase,
      SUPABASE_SERVICE_ROLE_KEY: 'sentinel-production-service-role-key',
      SMOKE_ACCOUNT_EMAIL: fixture.plan.smoke.accountEmail,
    }),
    RELEASE_PLAN: fixture.path,
    SMOKE_PLAN: fixture.path,
    VERCEL_API_URL: fixture.plan.endpoints.vercelApi,
    SMOKE_ORIGIN: fixture.plan.endpoints.origin,
  };
  if (world.releaseConnections?.migration === 'absent') {
    // The plan says the session connection is not configured. Emptying the
    // variable keeps the operator's shell from supplying one silently.
    env.DIRECT_DATABASE_URL = '';
  }
  return env;
}

async function runReleaseCommand(world) {
  assert.ok(
    world.releaseFixture,
    'a release plan must be arranged by a Given before the command runs'
  );
  world.releaseRun = await runCommand(
    'pnpm',
    ['run', 'release', '--', '--plan', world.releaseFixture.path],
    { cwd: REPO_ROOT, timeoutMs: 5 * 60_000, env: releaseEnvironment(world) }
  );
  console.log(
    `[release-pipeline] ${RELEASE_COMMAND} on plan "${world.releaseFixture.name}" ` +
      `exited ${world.releaseRun.code}`
  );
}

async function runSmokeCommand(world) {
  assert.ok(
    world.releaseFixture,
    'a release plan must be arranged by a Given before the smoke runs'
  );
  world.smokeRun = await runCommand(
    'pnpm',
    ['run', 'smoke:production', '--', '--plan', world.releaseFixture.path],
    { cwd: REPO_ROOT, timeoutMs: 5 * 60_000, env: releaseEnvironment(world) }
  );
  console.log(
    `[release-pipeline] ${SMOKE_COMMAND} on plan "${world.releaseFixture.name}" ` +
      `exited ${world.smokeRun.code}`
  );
}

function outputOf(run, command) {
  assert.ok(
    run,
    `${command} has not run in this scenario — one of the When steps must run it`
  );
  return `${run.stdout || ''}\n${run.stderr || ''}`;
}

// The machine-readable line a command must print. See fixtures/README.md.
function summaryOf(run, kind, command) {
  const output = outputOf(run, command);
  const matches = [...output.matchAll(new RegExp(`\\[${kind}\\]\\s*summary:\\s*(\\{.*\\})`, 'g'))];
  assert.ok(
    matches.length > 0,
    `${command} must print a "${kind}" summary line (${`[${kind}] summary: {…}`}).\n` +
      `Command: ${command} (exit ${run.code})\nOutput:\n${tailOf(output)}`
  );
  const raw = matches[matches.length - 1][1];
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `${command} printed an unparseable "${kind}" summary: ${error.message}\n` +
        `Line: ${tailOf(raw, 2000)}`
    );
  }
}

function releaseSummary(world) {
  return summaryOf(world.releaseRun, 'release', RELEASE_COMMAND);
}

function smokeSummary(world) {
  return summaryOf(world.smokeRun, 'smoke', SMOKE_COMMAND);
}

function stageIndex(summary, stage) {
  const stages = Array.isArray(summary.stages) ? summary.stages : [];
  const index = stages.indexOf(stage);
  assert.notStrictEqual(
    index,
    -1,
    `the release summary must record the "${stage}" stage among ` +
      `[${stages.join(', ')}]`
  );
  return index;
}

function stubSnapshot(world) {
  assert.ok(
    world.releaseStub,
    'the stub production world has not been started in this scenario'
  );
  return world.releaseStub.snapshot();
}

// A stub assertion is only meaningful once the command actually ran: without
// this guard a missing command would look like "created no property" and the
// scenario would fail — or worse, pass — for the wrong reason.
function assertSmokeRan(world, { expectSuccess } = {}) {
  const run = world.smokeRun;
  assert.ok(
    run,
    `${SMOKE_COMMAND} has not run in this scenario — one of the When steps must run it`
  );
  if (expectSuccess === true) {
    assert.strictEqual(
      run.code,
      0,
      `${SMOKE_COMMAND} must complete before its effects on the production world ` +
        `can be asserted; it exited ${run.code}.\n` +
        `Output:\n${tailOf(outputOf(run, SMOKE_COMMAND))}`
    );
  }
  if (expectSuccess === false) {
    assert.notStrictEqual(
      run.code,
      0,
      `${SMOKE_COMMAND} must fail before its effects on the production world are ` +
        `asserted; it exited 0.\nOutput:\n${tailOf(outputOf(run, SMOKE_COMMAND))}`
    );
  }
}

function assertCommandFailed(run, command, pattern, what) {
  const output = outputOf(run, command);
  assert.notStrictEqual(
    run.code,
    0,
    `${command} must fail when ${what}; it exited 0.\nOutput:\n${tailOf(output)}`
  );
  assert.match(
    output,
    pattern,
    `${command} must name ${what}.\nCommand: ${command} (exit ${run.code})\n` +
      `Output:\n${tailOf(output)}`
  );
}

function assertRunFailed(world, pattern, what) {
  assertCommandFailed(world.releaseRun, RELEASE_COMMAND, pattern, what);
}

// ---------------------------------------------------------------------------
// Gate failures
// ---------------------------------------------------------------------------

Given('a release whose unit tests fail', async function () {
  await arrangeRelease(this, 'unit-failure');
  assert.strictEqual(this.releaseFixture.plan.gates.unit, 'fail');
});

Given('a release with every gate step passing', async function () {
  await arrangeRelease(this, 'complete');
  const failing = Object.entries(this.releaseFixture.plan.gates).filter(
    ([, result]) => result !== 'pass'
  );
  assert.deepStrictEqual(failing, [], 'every gate step must pass in this plan');
});

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------

Given('a release whose backup fails', async function () {
  await arrangeRelease(this, 'backup-failure');
  assert.strictEqual(this.releaseFixture.plan.backup.result, 'fail');
});

Given('a release with a successful backup', async function () {
  await arrangeRelease(this, 'complete');
  assert.strictEqual(this.releaseFixture.plan.backup.result, 'pass');
  assert.ok(this.releaseFixture.plan.backup.artifact);
});

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------

Given('a release whose migration fails', async function () {
  await arrangeRelease(this, 'migration-failure');
  assert.strictEqual(this.releaseFixture.plan.migration.result, 'fail');
});

Given('a release without a session migration connection', async function () {
  await arrangeRelease(this, 'without-migration-connection');
  this.releaseConnections = { migration: 'absent' };
  assert.strictEqual(this.releaseFixture.plan.connections.migration, 'absent');
});

// ---------------------------------------------------------------------------
// The gated commit
// ---------------------------------------------------------------------------

Given('master advanced after the gates started', async function () {
  await arrangeRelease(this, 'moved-master');
  const { gated, masterTip } = this.releaseFixture.plan.commit;
  assert.notStrictEqual(
    masterTip,
    gated,
    'the plan must move the master tip away from the gated commit'
  );
});

Given(
  'Vercel reports a production deployment whose commit differs from the gated commit',
  async function () {
    await arrangeRelease(this, 'deployment-commit-mismatch');
    const { gated } = this.releaseFixture.plan.commit;
    const [deployment] = this.releaseFixture.plan.deployments;
    assert.ok(deployment, 'the plan must report one deployment');
    assert.notStrictEqual(
      deployment.sha,
      gated,
      'the reported deployment must be for another commit'
    );
  }
);

// ---------------------------------------------------------------------------
// The live smoke
// ---------------------------------------------------------------------------

Given('the production origin is serving the release', async function () {
  await arrangeRelease(this, 'complete');
  this.expectedSmoke = {
    health: 200,
    properties: 401,
    runMarker: this.releaseFixture.plan.smoke.runMarker,
  };
});

Given('the production health route answers 503', async function () {
  await arrangeRelease(this, 'smoke-health-503');
  assert.strictEqual(this.releaseFixture.plan.smoke.health, 503);
});

Given(
  'a previous run left a property carrying the smoke run marker',
  async function () {
    await arrangeRelease(this, 'smoke-stale-row');
    const { runMarker, existingRows } = this.releaseFixture.plan.smoke;
    this.staleRow = existingRows.find((row) => row.marker);
    this.foreignRow = existingRows.find((row) => !row.marker);
    assert.ok(this.staleRow, 'the plan must seed a row carrying the run marker');
    assert.ok(this.foreignRow, 'the plan must seed a row without the marker');
    assert.ok(
      this.staleRow.name.includes(runMarker),
      'the stale row must carry the smoke run marker in its name'
    );
    assert.ok(
      !this.foreignRow.name.includes(runMarker),
      'the foreign row must not carry the smoke run marker'
    );
  }
);

Given('the live smoke fails after a production deployment', async function () {
  await arrangeRelease(this, 'smoke-failure');
  assert.strictEqual(this.releaseFixture.plan.smoke.failStep, 'round-trip');
});

// ---------------------------------------------------------------------------
// Running the commands
// ---------------------------------------------------------------------------

When('the release command runs', async function () {
  await runReleaseCommand(this);
});

When('the release command rechecks the tip', async function () {
  await runReleaseCommand(this);
});

When('the release waits for readiness', async function () {
  await runReleaseCommand(this);
});

When('the live smoke runs', async function () {
  await runSmokeCommand(this);
});

When('the live smoke starts', async function () {
  await runSmokeCommand(this);
});

When('the release command reports the failure', async function () {
  await runReleaseCommand(this);
});

// ---------------------------------------------------------------------------
// Reported outcomes
// ---------------------------------------------------------------------------

Then('it stops before the backup and migration steps', async function () {
  const summary = releaseSummary(this);
  const stages = Array.isArray(summary.stages) ? summary.stages : [];
  assert.ok(
    !stages.includes('backup') && summary.backup !== 'passed',
    `the release must stop before the backup step; stages were [${stages.join(', ')}] ` +
      `and backup was "${summary.backup}"`
  );
  assert.ok(
    !stages.includes('migration') && summary.migration !== 'passed',
    `the release must stop before the migration step; stages were [${stages.join(', ')}] ` +
      `and migration was "${summary.migration}"`
  );
});

Then('it does not advance the production branch', async function () {
  const summary = releaseSummary(this);
  assert.strictEqual(
    summary.branchAdvancedTo ?? null,
    null,
    `the release branch must not advance, but the summary reports ` +
      `${summary.branchAdvancedTo}`
  );
});

Then(
  'the acceptance run executes before the migration step',
  async function () {
    const summary = releaseSummary(this);
    const acceptance = stageIndex(summary, 'acceptance');
    const migration = stageIndex(summary, 'migration');
    assert.ok(
      acceptance < migration,
      `the main-spec acceptance run must execute before the migration ` +
        `(acceptance at ${acceptance}, migration at ${migration})`
    );
  }
);

Then(
  'the migration step executes before the production branch advances',
  async function () {
    const summary = releaseSummary(this);
    const migration = stageIndex(summary, 'migration');
    const advance = stageIndex(summary, 'release-branch');
    assert.ok(
      migration < advance,
      `the migration must execute before the release branch advances ` +
        `(migration at ${migration}, release-branch at ${advance})`
    );
    assert.ok(
      summary.branchAdvancedTo,
      'the summary must name the commit the release branch advanced to'
    );
  }
);

Then('it stops before the migration step', async function () {
  const summary = releaseSummary(this);
  const stages = Array.isArray(summary.stages) ? summary.stages : [];
  assert.ok(
    !stages.includes('migration') && summary.migration !== 'passed',
    `the release must stop before the migration step; stages were ` +
      `[${stages.join(', ')}] and migration was "${summary.migration}"`
  );
});

Then('the dump is stored off-machine', async function () {
  const summary = releaseSummary(this);
  assert.ok(
    summary.dumpStored,
    'the release summary must report where the dump was stored'
  );
  assert.match(
    String(summary.dumpStored),
    /artifact|s3:|gs:|https?:/i,
    `the dump must be stored off-machine, but the summary reports ` +
      `"${summary.dumpStored}"`
  );
});

Then('the migration runs after the dump', async function () {
  const summary = releaseSummary(this);
  const dump = stageIndex(summary, 'dump');
  const migration = stageIndex(summary, 'migration');
  assert.ok(
    dump < migration,
    `the migration must run after the dump (dump at ${dump}, migration at ${migration})`
  );
});

Then('the production branch does not advance', async function () {
  const summary = releaseSummary(this);
  assert.strictEqual(
    summary.branchAdvancedTo ?? null,
    null,
    `the release branch must not advance, but the summary reports ` +
      `${summary.branchAdvancedTo}`
  );
});

Then('the deployment is not requested', async function () {
  const summary = releaseSummary(this);
  assert.notStrictEqual(
    summary.deploymentRequested,
    true,
    'no deployment may be requested after a failed migration'
  );
});

Then('it fails naming the missing connection', async function () {
  const output = outputOf(this.releaseRun, RELEASE_COMMAND);
  assertRunFailed(
    this,
    /DIRECT_DATABASE_URL|session (migration )?connection/i,
    'the missing session migration connection'
  );
  assert.match(
    output,
    /missing|absent|required|not configured/i,
    `the failure must say the session migration connection is missing.\n` +
      `Output:\n${tailOf(output)}`
  );
});

Then('it does not use the runtime URL as a fallback', async function () {
  const summary = releaseSummary(this);
  assert.ok(
    !(summary.stages || []).includes('migration'),
    'the release must not migrate without a session migration connection'
  );
  assert.strictEqual(
    summary.migration ?? null,
    null,
    `the release must not report a migration without the session connection ` +
      `(got "${summary.migration}")`
  );
});

Then('it aborts before the backup and migration steps', async function () {
  const summary = releaseSummary(this);
  const stages = Array.isArray(summary.stages) ? summary.stages : [];
  assert.ok(
    !stages.includes('backup') && !stages.includes('migration'),
    `the release must abort before the backup and migration; stages were ` +
      `[${stages.join(', ')}]`
  );
});

Then('it names the gated commit and the current tip', async function () {
  const output = outputOf(this.releaseRun, RELEASE_COMMAND);
  const { gated, masterTip } = this.releaseFixture.plan.commit;
  for (const [label, sha] of [
    ['gated commit', gated],
    ['current master tip', masterTip],
  ]) {
    assert.ok(
      output.includes(sha),
      `the abort must name the ${label} (${sha}).\n` +
        `Command: ${RELEASE_COMMAND} (exit ${this.releaseRun.code})\n` +
        `Output:\n${tailOf(output)}`
    );
  }
});

Then('it fails naming both commits', async function () {
  const output = outputOf(this.releaseRun, RELEASE_COMMAND);
  const { gated } = this.releaseFixture.plan.commit;
  const [deployment] = this.releaseFixture.plan.deployments;
  assert.notStrictEqual(
    this.releaseRun.code,
    0,
    `the release must fail when the ready deployment is for another commit.\n` +
      `Output:\n${tailOf(output)}`
  );
  for (const [label, sha] of [
    ['gated commit', gated],
    ['deployed commit', deployment.sha],
  ]) {
    assert.ok(
      output.includes(sha),
      `the failure must name the ${label} (${sha}).\nOutput:\n${tailOf(output)}`
    );
  }
});

// ---------------------------------------------------------------------------
// The live smoke's outcomes
// ---------------------------------------------------------------------------

Then('health answers 200', async function () {
  const summary = smokeSummary(this);
  const steps = summary.steps || {};
  assert.strictEqual(
    Number(steps.health && steps.health.status),
    200,
    `the live smoke must see /api/health answer 200 (got ` +
      `${JSON.stringify(steps.health)}).\nOutput:\n` +
      `${tailOf(outputOf(this.smokeRun, SMOKE_COMMAND))}`
  );
});

Then(
  'the properties list answers 401 without a session',
  async function () {
    const summary = smokeSummary(this);
    const steps = summary.steps || {};
    assert.strictEqual(
      Number(steps.propertiesUnauthenticated && steps.propertiesUnauthenticated.status),
      401,
      `the live smoke must see /api/properties answer 401 without a session ` +
        `(got ${JSON.stringify(steps.propertiesUnauthenticated)})`
    );
  }
);

Then(
  "the smoke account's property is created, listed, and deleted",
  async function () {
    assertSmokeRan(this, { expectSuccess: true });
    const snapshot = stubSnapshot(this);
    assert.strictEqual(
      snapshot.posts.length,
      1,
      `the smoke must create exactly one property, but the stub saw ` +
        `${snapshot.posts.length}`
    );
    const created = snapshot.posts[0];
    assert.ok(
      snapshot.listAnswers.some((answer) => answer.ids.includes(created.id)),
      `the created property ${created.id} must be listed back to the smoke account`
    );
    assert.ok(
      snapshot.deletes.some((entry) => entry.id === created.id),
      `the created property ${created.id} must be deleted before the smoke ends`
    );
    assert.ok(
      !snapshot.rows.some((row) => row.id === created.id),
      `the created property ${created.id} must not survive the smoke`
    );
  }
);

Then('it fails naming the health step', async function () {
  assertCommandFailed(
    this.smokeRun,
    SMOKE_COMMAND,
    /health/i,
    'the failing health step'
  );
  assert.notStrictEqual(
    this.smokeRun.code,
    0,
    `${SMOKE_COMMAND} must exit non-zero when health answers 503`
  );
});

Then('it does not create a property', async function () {
  assertSmokeRan(this, { expectSuccess: false });
  const snapshot = stubSnapshot(this);
  assert.strictEqual(
    snapshot.posts.length,
    0,
    `the smoke must not create a property when health fails, but the stub saw ` +
      `${snapshot.posts.length}: ${snapshot.posts.map((row) => row.id).join(', ')}`
  );
});

Then('it removes that stale property', async function () {
  assertSmokeRan(this, { expectSuccess: true });
  const snapshot = stubSnapshot(this);
  const stale = this.staleRow;
  assert.ok(
    !snapshot.rows.some((row) => row.id === stale.id),
    `the stale property ${stale.id} must be removed before the round trip`
  );
  assert.ok(
    snapshot.deletes.some((entry) => entry.id === stale.id && entry.marker),
    `the stale property ${stale.id} must be deleted through the API, and it ` +
      'carried the run marker'
  );
});

Then('it never removes a property without the marker', async function () {
  assertSmokeRan(this, { expectSuccess: true });
  const snapshot = stubSnapshot(this);
  const foreign = this.foreignRow;
  assert.ok(
    snapshot.rows.some((row) => row.id === foreign.id),
    `the property ${foreign.id} does not carry the smoke's marker and must survive`
  );
  assert.deepStrictEqual(
    snapshot.deletes.filter((entry) => !entry.marker),
    [],
    'the smoke must never delete a property that does not carry its run marker'
  );
});

Then('it prints the previous production deployment', async function () {
  const summary = releaseSummary(this);
  const previous = this.releaseFixture.plan.previousDeployment;
  const output = outputOf(this.releaseRun, RELEASE_COMMAND);
  assert.strictEqual(
    summary.rollbackTarget && summary.rollbackTarget.id,
    previous.id,
    `the failed smoke must name the previous production deployment ` +
      `(${previous.id}), got ${JSON.stringify(summary.rollbackTarget)}`
  );
  assert.ok(
    output.includes(previous.id),
    `the failure output must print the previous deployment ${previous.id}.\n` +
      `Output:\n${tailOf(output)}`
  );
});

Then('it prints the rollback action', async function () {
  const summary = releaseSummary(this);
  const output = outputOf(this.releaseRun, RELEASE_COMMAND);
  assert.ok(
    summary.rollbackAction,
    'the release summary must carry the rollback action'
  );
  assert.match(
    String(summary.rollbackAction),
    /rollback/i,
    `the rollback action must name the rollback, got ` +
      `"${summary.rollbackAction}"`
  );
  assert.match(
    output,
    /rollback/i,
    `the failure output must print the rollback action.\nOutput:\n${tailOf(output)}`
  );
});

Then('it never runs a down migration', async function () {
  const summary = releaseSummary(this);
  const output = outputOf(this.releaseRun, RELEASE_COMMAND);
  assert.strictEqual(
    summary.downMigration,
    false,
    'the release summary must record that no down migration ran'
  );
  assert.doesNotMatch(
    output,
    /down migration:\s*(ran|applied|executed)/i,
    `the release must never run a down migration.\nOutput:\n${tailOf(output)}`
  );
});
