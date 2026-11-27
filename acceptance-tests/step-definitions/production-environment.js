'use strict';

// Step definitions for the production-environment capability.
//
// Every scenario drives the deployment check (`scripts/check-deployment.ts`,
// run as `pnpm run deploy:check`) against a fixture declaration and a fixture
// environment. The scenarios are the check's contract: it names what it
// rejects (region, plan, origin, auth origin, project separation, pooler
// mode, a missing variable) and it never prints a configured value.
//
// The check does not exist yet. Until it does, the command exits
// ERR_PNPM_NO_SCRIPT and each assertion below fails naming the command — the
// red state this change expects, not an undefined step.
//
// The fixture family and the seam the check must accept (a `--declaration`
// argument, or the DEPLOY_DECLARATION environment variable) are documented in
// fixtures/README.md.

const assert = require('node:assert/strict');

const { Given, When, Then } = require('@cucumber/cucumber');

const { REPO_ROOT, runCommand, tailOf } = require('../support/harness');
const {
  materialiseDeclaration,
  productionCheckEnvironment,
  configuredValues,
} = require('../support/production-fixtures');

const DEPLOY_CHECK_SCRIPT = 'deploy:check';
const DECLARATION_FLAG = '--declaration';
const COMMAND = `pnpm run ${DEPLOY_CHECK_SCRIPT}`;

const EXACT_PRODUCTION_ORIGIN = 'https://m-proper.vercel.app';

// The declaration a scenario drives. Givens arrange it; the When materialises
// the merged document and runs the check against it.
function arrange(world, name, { env = {} } = {}) {
  world.declarationFixture = materialiseDeclaration(name);
  world.deploymentEnvOverrides = { ...(world.deploymentEnvOverrides || {}), ...env };
}

function checkOutput(world) {
  const result = world.deploymentCheck;
  assert.ok(
    result,
    `the deployment check has not run in this scenario — "${COMMAND}" must run first`
  );
  return `${result.stdout || ''}\n${result.stderr || ''}`;
}

function assertCheckFailed(world, pattern, what) {
  const result = world.deploymentCheck;
  const output = checkOutput(world);
  assert.notStrictEqual(
    result.code,
    0,
    `the deployment check must fail when ${what}; it exited 0.\n` +
      `Command: ${COMMAND}\nOutput:\n${tailOf(output)}`
  );
  assert.match(
    output,
    pattern,
    `the deployment check must fail naming ${what}, but its output does not.\n` +
      `Command: ${COMMAND} (exit ${result.code})\nOutput:\n${tailOf(output)}`
  );
}

function assertCheckPassed(world, pattern, what) {
  const result = world.deploymentCheck;
  const output = checkOutput(world);
  assert.strictEqual(
    result.code,
    0,
    `the deployment check must accept ${what}, but it exited ${result.code}.\n` +
      `Command: ${COMMAND}\nOutput:\n${tailOf(output)}`
  );
  if (pattern) {
    assert.match(
      output,
      pattern,
      `the deployment check must report ${what}.\n` +
        `Command: ${COMMAND}\nOutput:\n${tailOf(output)}`
    );
  }
}

// ---------------------------------------------------------------------------
// A complete declaration passes
// ---------------------------------------------------------------------------

Given(
  'a production declaration with every required field',
  async function () {
    arrange(this, 'complete');
    const { declaration } = this.declarationFixture;
    assert.strictEqual(declaration.vercel.plan, 'hobby');
    assert.strictEqual(declaration.supabase.plan, 'free');
    assert.strictEqual(declaration.vercel.region, 'sin1');
    assert.strictEqual(declaration.vercel.productionBranch, 'release');
    assert.ok(
      declaration.vercel.origin,
      'the complete declaration must carry a production origin'
    );
  }
);

Given('a production declaration without a function region', async function () {
  arrange(this, 'missing-region');
  assert.strictEqual(
    this.declarationFixture.declaration.vercel.region,
    undefined,
    'the fixture must not declare a function region'
  );
});

Given('a production declaration whose Vercel plan is pro', async function () {
  arrange(this, 'vercel-pro');
  assert.strictEqual(this.declarationFixture.declaration.vercel.plan, 'pro');
});

Given(
  'a production declaration with the Vercel plan hobby and the Supabase plan free',
  async function () {
    arrange(this, 'complete');
    const { declaration } = this.declarationFixture;
    assert.strictEqual(declaration.vercel.plan, 'hobby');
    assert.strictEqual(declaration.supabase.plan, 'free');
  }
);

Given(
  'a production declaration whose origin contains a wildcard',
  async function () {
    arrange(this, 'wildcard-origin');
    assert.match(
      this.declarationFixture.declaration.vercel.origin,
      /\*/,
      'the fixture origin must carry a wildcard'
    );
  }
);

Given(
  'a production declaration whose region is not sin1',
  async function () {
    arrange(this, 'wrong-region');
    assert.notStrictEqual(
      this.declarationFixture.declaration.vercel.region,
      'sin1'
    );
  }
);

// ---------------------------------------------------------------------------
// Production and preview data planes are distinct
// ---------------------------------------------------------------------------

Given(
  'a declaration whose production and preview project references are the same',
  async function () {
    arrange(this, 'shared-production-ref');
    const { supabase } = this.declarationFixture.declaration;
    assert.strictEqual(
      supabase.productionRef,
      supabase.previewRef,
      'the fixture must give production and preview the same project reference'
    );
  }
);

// ---------------------------------------------------------------------------
// The runtime and migration connections are split
// ---------------------------------------------------------------------------

function urlFixture(port) {
  return (
    `postgresql://postgres.production:sentinel-fixture-password` +
    `@aws-0-ap-southeast-1.pooler.supabase.com:${port}/postgres`
  );
}

Given('a transaction-pooler runtime URL on port 6543', async function () {
  arrange(this, 'complete', { env: { DATABASE_URL: urlFixture(6543) } });
  assert.match(this.deploymentEnvOverrides.DATABASE_URL, /:6543\//);
});

Given('a session-pooler migration URL on port 5432', async function () {
  arrange(this, 'complete', {
    env: { DIRECT_DATABASE_URL: urlFixture(5432) },
  });
  assert.match(this.deploymentEnvOverrides.DIRECT_DATABASE_URL, /:5432\//);
});

Given(
  'the same URL for the runtime and the migration connection',
  async function () {
    const shared = urlFixture(5432);
    arrange(this, 'complete', {
      env: { DATABASE_URL: shared, DIRECT_DATABASE_URL: shared },
    });
    assert.strictEqual(
      this.deploymentEnvOverrides.DATABASE_URL,
      this.deploymentEnvOverrides.DIRECT_DATABASE_URL
    );
  }
);

Given('a migration URL on port 6543', async function () {
  arrange(this, 'complete', {
    env: { DIRECT_DATABASE_URL: urlFixture(6543) },
  });
  assert.match(this.deploymentEnvOverrides.DIRECT_DATABASE_URL, /:6543\//);
});

// ---------------------------------------------------------------------------
// The production origin is the only production auth origin
// ---------------------------------------------------------------------------

Given(
  String.raw`the production origin is https:\/\/m-proper.vercel.app`,
  async function () {
    arrange(this, 'complete');
    assert.strictEqual(
      this.declarationFixture.declaration.vercel.origin,
      EXACT_PRODUCTION_ORIGIN
    );
  }
);

Given('the production auth origin is the same exact origin', async function () {
  const { supabase } = this.declarationFixture.declaration;
  assert.deepStrictEqual(
    supabase.redirectAllowlist,
    [EXACT_PRODUCTION_ORIGIN],
    'the fixture redirect allowlist must be exactly the production origin'
  );
  assert.strictEqual(supabase.siteUrl, EXACT_PRODUCTION_ORIGIN);
});

Given(
  'the production auth origin admits a wildcard preview origin',
  async function () {
    arrange(this, 'wildcard-auth-origin');
    assert.ok(
      this.declarationFixture.declaration.supabase.redirectAllowlist.some(
        (origin) => origin.includes('*')
      ),
      'the fixture allowlist must admit a wildcard origin'
    );
  }
);

// ---------------------------------------------------------------------------
// A missing production variable is named before release
// ---------------------------------------------------------------------------

Given(
  'the production environment lacks the Supabase JWKS location',
  async function () {
    arrange(this, 'complete', { env: { SUPABASE_JWKS_URL: '' } });
    assert.strictEqual(this.deploymentEnvOverrides.SUPABASE_JWKS_URL, '');
  }
);

// ---------------------------------------------------------------------------
// Only the production branch deploys production
// ---------------------------------------------------------------------------

Given('the production declaration', async function () {
  arrange(this, 'complete');
  const { vercel } = this.declarationFixture.declaration;
  assert.strictEqual(vercel.productionBranch, 'release');
  assert.strictEqual(vercel.integrationBranch, 'master');
});

// ---------------------------------------------------------------------------
// The check runs
// ---------------------------------------------------------------------------

When('the deployment check runs', async function () {
  const fixture =
    this.declarationFixture || materialiseDeclaration('complete');
  const env = {
    ...process.env,
    ...productionCheckEnvironment(this.deploymentEnvOverrides || {}),
    DEPLOY_DECLARATION: fixture.path,
  };
  this.deploymentCheck = await runCommand(
    'pnpm',
    ['run', DEPLOY_CHECK_SCRIPT, '--', DECLARATION_FLAG, fixture.path],
    { cwd: REPO_ROOT, timeoutMs: 180_000, env }
  );
  console.log(
    `[production-environment] ${COMMAND} on fixture "${fixture.name}" exited ` +
      `${this.deploymentCheck.code}`
  );
});

When(
  'the deployment check inspects the production branch',
  async function () {
    const fixture =
      this.declarationFixture || materialiseDeclaration('complete');
    const env = {
      ...process.env,
      ...productionCheckEnvironment(this.deploymentEnvOverrides || {}),
      DEPLOY_DECLARATION: fixture.path,
    };
    this.deploymentCheck = await runCommand(
      'pnpm',
      ['run', DEPLOY_CHECK_SCRIPT, '--', DECLARATION_FLAG, fixture.path],
      { cwd: REPO_ROOT, timeoutMs: 180_000, env }
    );
  }
);

// ---------------------------------------------------------------------------
// Outcomes
// ---------------------------------------------------------------------------

Then(
  'it reports the project, region, branch, and production origin',
  async function () {
    const { declaration } = this.declarationFixture;
    const output = checkOutput(this);
    for (const [label, value] of [
      ['project', declaration.vercel.project],
      ['region', declaration.vercel.region],
      ['production branch', declaration.vercel.productionBranch],
      ['production origin', declaration.vercel.origin],
    ]) {
      assert.ok(
        output.includes(value),
        `the check must report the ${label} (${value}).\n` +
          `Command: ${COMMAND}\nOutput:\n${tailOf(output)}`
      );
    }
  }
);

Then('it exits successfully', async function () {
  assertCheckPassed(this, null, 'a complete declaration');
});

Then('it fails naming the region', async function () {
  assertCheckFailed(this, /\bregion\b/i, 'the region');
});

Then('it fails naming the Vercel plan', async function () {
  const output = checkOutput(this);
  assertCheckFailed(this, /\bplan\b/i, 'the Vercel plan');
  assert.match(
    output,
    /vercel/i,
    `the failure must say the Vercel plan is the problem.\nOutput:\n${tailOf(output)}`
  );
  assert.match(
    output,
    /\bpro\b/i,
    `the failure must name the offending plan value (pro).\nOutput:\n${tailOf(output)}`
  );
});

Then('it accepts both plans', async function () {
  const output = checkOutput(this);
  assertCheckPassed(this, /\bhobby\b/i, 'the Vercel Hobby plan');
  assert.match(
    output,
    /\bfree\b/i,
    `the check must report the Supabase Free plan.\nOutput:\n${tailOf(output)}`
  );
});

Then('it fails naming the production origin', async function () {
  assertCheckFailed(this, /\borigin\b/i, 'the production origin');
});

Then('it fails naming both environments', async function () {
  const output = checkOutput(this);
  assertCheckFailed(
    this,
    /\bproduction\b/i,
    'the production environment in a shared project reference'
  );
  assert.match(
    output,
    /\bpreview\b/i,
    `the failure must name the preview environment too.\nOutput:\n${tailOf(output)}`
  );
});

Then('it reports both connections as valid', async function () {
  const output = checkOutput(this);
  assertCheckPassed(this, /DATABASE_URL/, 'the runtime connection');
  for (const needle of ['6543', 'DIRECT_DATABASE_URL', '5432', 'valid']) {
    assert.match(
      output,
      new RegExp(needle, 'i'),
      `the check must report ${needle} for the split connections.\n` +
        `Output:\n${tailOf(output)}`
    );
  }
});

Then('it reports that they differ', async function () {
  assert.match(
    checkOutput(this),
    /differ/i,
    `the check must report that the runtime and migration URLs differ.\n` +
      `Output:\n${tailOf(checkOutput(this))}`
  );
});

Then('it fails naming both variables', async function () {
  const output = checkOutput(this);
  assertCheckFailed(this, /DATABASE_URL/, 'the identical runtime URL');
  assert.match(
    output,
    /DIRECT_DATABASE_URL/,
    `the failure must name both variables, but it names only DATABASE_URL.\n` +
      `Output:\n${tailOf(output)}`
  );
});

Then('it fails naming the migration connection', async function () {
  const output = checkOutput(this);
  assertCheckFailed(this, /migration/i, 'the migration connection');
  assert.match(
    output,
    /6543|DIRECT_DATABASE_URL/,
    `the failure must point at the migration URL or its port.\nOutput:\n${tailOf(output)}`
  );
});

Then('it accepts the production auth origin', async function () {
  const output = checkOutput(this);
  assertCheckPassed(this, /auth origin/i, 'the exact production auth origin');
  assert.match(
    output,
    new RegExp(EXACT_PRODUCTION_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `the check must name the exact production origin.\nOutput:\n${tailOf(output)}`
  );
});

Then('it fails naming the production auth origin', async function () {
  assertCheckFailed(this, /auth origin/i, 'the production auth origin');
});

Then('it fails naming that variable', async function () {
  assertCheckFailed(this, /SUPABASE_JWKS_URL/, 'SUPABASE_JWKS_URL');
});

Then('no configured value appears in the output', async function () {
  const output = checkOutput(this);
  const leaked = configuredValues().filter((value) => output.includes(value));
  assert.deepStrictEqual(
    leaked,
    [],
    `the check must never print a configured value, but its output carries ` +
      `${leaked.length} of them.\nOutput:\n${tailOf(output)}`
  );
});

Then(
  'it reports release as the only production branch',
  async function () {
    const output = checkOutput(this);
    assertCheckPassed(
      this,
      /production branch:\s*release/i,
      'release as the production branch'
    );
    assert.match(
      output,
      /only production branch/i,
      `the check must state that release is the only production branch.\n` +
        `Output:\n${tailOf(output)}`
    );
  }
);

Then(
  'it reports that master is an integration branch',
  async function () {
    const output = checkOutput(this);
    assert.match(
      output,
      /integration branch:\s*master/i,
      `the check must report master as an integration branch.\n` +
        `Output:\n${tailOf(output)}`
    );
    assert.doesNotMatch(
      output,
      /production branch:\s*master/i,
      `the check must never report master as a production branch.\n` +
        `Output:\n${tailOf(output)}`
    );
  }
);
