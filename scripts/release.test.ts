// scripts/release.test.ts
/**
 * Unit tests for the release pipeline.
 *
 * Run: node --experimental-strip-types --test scripts/release.test.ts
 *
 * A fixture plan decides every gate, backup, migration, and deployment
 * outcome; the live smoke talks to the in-process stub the acceptance suite
 * also uses. The tests assert both the reported summary and that no later
 * stage ran.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { runRelease } from "./release.ts";
import type { ReleaseResult } from "./release.ts";

const require = createRequire(import.meta.url);
const { createStubReleaseServer } = require(
  "../acceptance-tests/support/stub-release-server.js",
) as {
  createStubReleaseServer: (input: { plan: unknown }) => Promise<{
    url: string;
    snapshot: () => { posts: unknown[]; rows: unknown[] };
    close: () => Promise<void>;
  }>;
};

const run = promisify(execFile);
const scriptPath = resolve(dirname(fileURLToPath(import.meta.url)), "release.ts");

const GATED = "4f1c2b9a8e7d6c5b4a39281706f5e4d3c2b1a090";
const PREVIOUS = "0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b";
const OTHER = "7d6c5b4a39281706f5e4d3c2b1a0909e8d7c6b5a";
const SERVICE_KEY = "sentinel-release-service-role-key";

function plan() {
  return {
    commit: { gated: GATED, masterTip: GATED },
    endpoints: { origin: "", vercelApi: "", supabase: "" },
    connections: { runtime: "env", migration: "env" },
    gates: {
      install: "pass",
      lint: "pass",
      typecheck: "pass",
      unit: "pass",
      build: "pass",
      specLint: "pass",
      acceptance: "pass",
    },
    backup: { result: "pass", artifact: "github-artifact:m-proper-release-backup" },
    migration: { result: "pass" },
    deployments: [{ id: "dpl_current", sha: GATED, state: "READY" }],
    previousDeployment: { id: "dpl_previous", sha: PREVIOUS },
    smoke: {
      runMarker: "m-proper-smoke",
      accountEmail: "smoke-account@m-proper.example",
      health: 200,
      propertiesUnauthenticated: 401,
      signUp: "refused",
      existingRows: [],
      failStep: null,
    },
  };
}

type Plan = ReturnType<typeof plan>;

function environment(stubUrl: string) {
  return {
    DATABASE_URL: `postgresql://postgres.production:sentinel@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`,
    DIRECT_DATABASE_URL: `postgresql://postgres.production:sentinel@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`,
    SUPABASE_URL: stubUrl,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
    SMOKE_ACCOUNT_EMAIL: "smoke-account@m-proper.example",
    SMOKE_ORIGIN: stubUrl,
    VERCEL_API_URL: stubUrl,
    VERCEL_PROJECT_ID: "m-proper",
  };
}

async function withStub<T>(
  fixture: Plan,
  exercise: (
    stub: Awaited<ReturnType<typeof createStubReleaseServer>>,
    wired: Plan,
  ) => Promise<T>,
): Promise<T> {
  const stub = await createStubReleaseServer({ plan: fixture });
  try {
    const wired: Plan = {
      ...fixture,
      endpoints: { origin: stub.url, vercelApi: stub.url, supabase: stub.url },
    };
    return await exercise(stub, wired);
  } finally {
    await stub.close();
  }
}

async function release(
  wired: Plan,
  options: {
    mode?: "full" | "gate" | "mutating";
    env?: Record<string, string | undefined>;
    attempts?: number;
  } = {},
): Promise<ReleaseResult> {
  return runRelease(
    {
      plan: wired,
      mode: options.mode ?? "full",
      env: { ...environment(wired.endpoints.origin), ...options.env },
      deploymentPollAttempts: options.attempts ?? 2,
      deploymentPollDelayMs: 0,
    },
    { log: () => undefined },
  );
}

function stageIndex(result: ReleaseResult, stage: string): number {
  const index = result.summary.stages.indexOf(stage);
  assert.notStrictEqual(index, -1, `stages were [${result.summary.stages.join(", ")}]`);
  return index;
}

function output(result: ReleaseResult): string {
  return result.lines.join("\n");
}

test("a complete release runs the fixed sequence and advances release", async () => {
  await withStub(plan(), async (_stub, wired) => {
    const result = await release(wired);
    assert.equal(result.ok, true, output(result));
    assert.equal(result.exitCode, 0);
    assert.ok(stageIndex(result, "acceptance") < stageIndex(result, "migration"));
    assert.ok(stageIndex(result, "migration") < stageIndex(result, "release-branch"));
    assert.ok(stageIndex(result, "dump") < stageIndex(result, "migration"));
    assert.equal(result.summary.branchAdvancedTo, GATED);
    assert.equal(result.summary.deploymentRequested, true);
    assert.match(String(result.summary.dumpStored), /artifact/i);
    assert.equal(result.summary.downMigration, false);
    assert.equal(result.summary.smoke?.ok, true);
  });
});

test("a failing gate stops before the backup and migration", async () => {
  const fixture = plan();
  fixture.gates.unit = "fail";
  await withStub(fixture, async (_stub, wired) => {
    const result = await release(wired);
    assert.equal(result.ok, false);
    assert.notStrictEqual(result.exitCode, 0);
    assert.ok(!result.summary.stages.includes("backup"));
    assert.ok(!result.summary.stages.includes("migration"));
    assert.notEqual(result.summary.backup, "passed");
    assert.notEqual(result.summary.migration, "passed");
    assert.equal(result.summary.branchAdvancedTo, null);
    assert.equal(result.summary.deploymentRequested, false);
    assert.ok(!result.summary.commands.includes("backup"));
  });
});

test("a failed backup stops before the migration", async () => {
  const fixture = plan();
  fixture.backup.result = "fail";
  await withStub(fixture, async (_stub, wired) => {
    const result = await release(wired);
    assert.equal(result.ok, false);
    assert.ok(!result.summary.stages.includes("migration"));
    assert.equal(result.summary.backup, "failed");
    assert.equal(result.summary.branchAdvancedTo, null);
    assert.ok(!result.summary.commands.includes("migration"));
  });
});

test("a failed migration does not advance the branch or request a deployment", async () => {
  const fixture = plan();
  fixture.migration.result = "fail";
  await withStub(fixture, async (stub, wired) => {
    const result = await release(wired);
    assert.equal(result.ok, false);
    assert.equal(result.summary.migration, "failed");
    assert.equal(result.summary.branchAdvancedTo, null);
    assert.equal(result.summary.deploymentRequested, false);
    assert.ok(!result.summary.stages.includes("release-branch"));
    assert.equal(stub.snapshot().posts.length, 0);
  });
});

test("a missing session migration connection is named and never falls back", async () => {
  const fixture = plan();
  fixture.connections.migration = "absent";
  await withStub(fixture, async (_stub, wired) => {
    const result = await release(wired, { env: { DIRECT_DATABASE_URL: "" } });
    assert.equal(result.ok, false);
    assert.match(output(result), /DIRECT_DATABASE_URL/);
    assert.match(output(result), /missing|not configured|required/i);
    assert.ok(!result.summary.stages.includes("migration"));
    assert.equal(result.summary.migration, null);
  });
});

test("a moved master aborts before the backup naming both commits", async () => {
  const fixture = plan();
  fixture.commit.masterTip = OTHER;
  await withStub(fixture, async (_stub, wired) => {
    const result = await release(wired);
    assert.equal(result.ok, false);
    assert.ok(!result.summary.stages.includes("backup"));
    assert.ok(!result.summary.stages.includes("migration"));
    assert.ok(output(result).includes(GATED));
    assert.ok(output(result).includes(OTHER));
  });
});

test("a deployment for another commit is refused naming both", async () => {
  const fixture = plan();
  fixture.deployments = [{ id: "dpl_other_commit", sha: OTHER, state: "READY" }];
  await withStub(fixture, async (_stub, wired) => {
    const result = await release(wired);
    assert.equal(result.ok, false);
    assert.ok(output(result).includes(GATED));
    assert.ok(output(result).includes(OTHER));
    assert.equal(result.summary.smoke, null);
  });
});

test("a deployment that errors fails the release", async () => {
  const fixture = plan();
  fixture.deployments = [{ id: "dpl_current", sha: GATED, state: "ERROR" }];
  await withStub(fixture, async (_stub, wired) => {
    const result = await release(wired);
    assert.equal(result.ok, false);
    assert.match(output(result), /ERROR/);
    assert.equal(result.summary.smoke, null);
  });
});

test("a deployment that never becomes ready times out naming the gated commit", async () => {
  const fixture = plan();
  fixture.deployments = [];
  await withStub(fixture, async (_stub, wired) => {
    const result = await release(wired, { attempts: 2 });
    assert.equal(result.ok, false);
    assert.match(output(result), /READY/);
    assert.ok(output(result).includes(GATED));
    assert.equal(result.summary.smoke, null);
  });
});

test("a failed smoke prints the rollback target and never runs a down migration", async () => {
  const fixture = plan();
  fixture.smoke.failStep = "round-trip";
  await withStub(fixture, async (_stub, wired) => {
    const result = await release(wired);
    assert.equal(result.ok, false);
    assert.equal(result.summary.rollbackTarget?.id, "dpl_previous");
    assert.match(String(result.summary.rollbackAction), /rollback/i);
    assert.ok(output(result).includes("dpl_previous"));
    assert.match(output(result), /rollback/i);
    assert.equal(result.summary.downMigration, false);
    assert.doesNotMatch(output(result), /down migration:\s*(ran|applied|executed)/i);
  });
});

test("mutating mode runs the mutating sequence without the gate", async () => {
  await withStub(plan(), async (_stub, wired) => {
    const result = await release(wired, { mode: "mutating" });
    assert.equal(result.ok, true, output(result));
    for (const gate of ["install", "lint", "typecheck", "unit", "build", "acceptance"]) {
      assert.ok(!result.summary.stages.includes(gate), `${gate} must not run`);
    }
    assert.ok(stageIndex(result, "migration") < stageIndex(result, "release-branch"));
    assert.ok(stageIndex(result, "release-branch") < stageIndex(result, "deployment"));
  });
});

test("gate mode stops after the tip check", async () => {
  await withStub(plan(), async (_stub, wired) => {
    const result = await release(wired, { mode: "gate" });
    assert.equal(result.ok, true, output(result));
    assert.ok(result.summary.stages.includes("acceptance"));
    for (const stage of ["backup", "migration", "release-branch", "deployment", "smoke"]) {
      assert.ok(!result.summary.stages.includes(stage), `${stage} must not run`);
    }
    assert.equal(result.summary.branchAdvancedTo, null);
  });
});

test("the CLI reads --plan and prints a release summary", async () => {
  await withStub(plan(), async (stub, wired) => {
    const dir = mkdtempSync(join(tmpdir(), "m-proper-release-"));
    try {
      const file = join(dir, "plan.json");
      writeFileSync(file, JSON.stringify(wired));
      const { stdout } = await run(
        process.execPath,
        ["--experimental-strip-types", scriptPath, "--plan", file],
        {
          env: {
            PATH: process.env.PATH ?? "",
            ...environment(stub.url),
            RELEASE_PLAN: file,
          },
        },
      );
      const match = /\[release\] summary: (\{.*\})/.exec(stdout);
      assert.ok(match, `the CLI must print a release summary:\n${stdout}`);
      const summary = JSON.parse(match[1]);
      assert.equal(summary.ok, true);
      assert.equal(summary.branchAdvancedTo, GATED);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
