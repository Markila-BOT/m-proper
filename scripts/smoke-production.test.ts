// scripts/smoke-production.test.ts
/**
 * Unit tests for the post-deploy live smoke.
 *
 * Run: node --experimental-strip-types --test scripts/smoke-production.test.ts
 *
 * The production origin, Supabase Auth, and the properties API are the system
 * boundary. They are replaced with the same in-process stub the acceptance
 * suite drives, so a test sees both what the smoke reported and what it did.
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

import { runSmoke } from "./smoke-production.ts";

const require = createRequire(import.meta.url);
const { createStubReleaseServer } = require(
  "../acceptance-tests/support/stub-release-server.js",
) as {
  createStubReleaseServer: (input: { plan: unknown }) => Promise<{
    url: string;
    snapshot: () => {
      rows: Array<{ id: string; name: string }>;
      posts: Array<{ id: string; name: string }>;
      deletes: Array<{ id: string; name: string; marker: boolean }>;
      listAnswers: Array<{ ids: string[] }>;
    };
    close: () => Promise<void>;
  }>;
};

const run = promisify(execFile);
const scriptPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "smoke-production.ts",
);

const RUN_MARKER = "m-proper-smoke";
const SERVICE_KEY = "sentinel-production-service-role-key";

function smokePlan(overrides: Record<string, unknown> = {}) {
  return {
    endpoints: { origin: "", vercelApi: "", supabase: "" },
    deployments: [],
    smoke: {
      runMarker: RUN_MARKER,
      accountEmail: "smoke-account@m-proper.example",
      health: 200,
      propertiesUnauthenticated: 401,
      signUp: "refused",
      existingRows: [],
      failStep: null,
      ...overrides,
    },
  };
}

async function withStub<T>(
  plan: ReturnType<typeof smokePlan>,
  exercise: (stub: Awaited<ReturnType<typeof createStubReleaseServer>>) => Promise<T>,
): Promise<T> {
  const stub = await createStubReleaseServer({ plan });
  try {
    return await exercise(stub);
  } finally {
    await stub.close();
  }
}

function config(stubUrl: string, plan: ReturnType<typeof smokePlan>) {
  return {
    origin: stubUrl,
    supabaseUrl: stubUrl,
    serviceRoleKey: SERVICE_KEY,
    accountEmail: plan.smoke.accountEmail,
    runMarker: plan.smoke.runMarker,
    now: () => new Date("2026-11-27T10:00:00.000Z"),
  };
}

test("a healthy production is proven and left clean", async () => {
  const plan = smokePlan();
  await withStub(plan, async (stub) => {
    const report = await runSmoke(config(stub.url, plan));
    assert.equal(report.ok, true, report.error ?? "");
    assert.equal(report.steps.health?.status, 200);
    assert.equal(report.steps.propertiesUnauthenticated?.status, 401);
    const snapshot = stub.snapshot();
    assert.equal(snapshot.posts.length, 1);
    const created = snapshot.posts[0];
    assert.ok(created.name.includes(RUN_MARKER));
    assert.ok(snapshot.listAnswers.some((answer) => answer.ids.includes(created.id)));
    assert.ok(snapshot.deletes.some((entry) => entry.id === created.id));
    assert.ok(!snapshot.rows.some((row) => row.id === created.id));
    assert.equal(report.steps.signUp?.refused, true);
  });
});

test("a health failure is named and no property is created", async () => {
  const plan = smokePlan({ health: 503 });
  await withStub(plan, async (stub) => {
    const report = await runSmoke(config(stub.url, plan));
    assert.equal(report.ok, false);
    assert.match(String(report.error), /health/i);
    assert.equal(report.steps.health?.status, 503);
    assert.equal(stub.snapshot().posts.length, 0);
  });
});

test("an unprotected properties list fails the smoke", async () => {
  const plan = smokePlan({ propertiesUnauthenticated: 200 });
  await withStub(plan, async (stub) => {
    const report = await runSmoke(config(stub.url, plan));
    assert.equal(report.ok, false);
    assert.match(String(report.error), /properties|401/i);
    assert.equal(stub.snapshot().posts.length, 0);
  });
});

test("a stale row carrying the marker is removed first", async () => {
  const plan = smokePlan({
    existingRows: [
      { id: "stub-stale-1", name: `${RUN_MARKER} stale property`, marker: true },
      { id: "stub-foreign-1", name: "Central Park Apartments", marker: false },
    ],
  });
  await withStub(plan, async (stub) => {
    const report = await runSmoke(config(stub.url, plan));
    assert.equal(report.ok, true, report.error ?? "");
    const snapshot = stub.snapshot();
    assert.ok(!snapshot.rows.some((row) => row.id === "stub-stale-1"));
    assert.ok(snapshot.rows.some((row) => row.id === "stub-foreign-1"));
    const stale = snapshot.deletes.find((entry) => entry.id === "stub-stale-1");
    assert.ok(stale, "the stale row must be deleted through the API");
    assert.equal(stale.marker, true);
    assert.deepEqual(
      snapshot.deletes.filter((entry) => !entry.marker),
      [],
      "the smoke must never delete a row without its marker",
    );
  });
});

test("a refused delete fails the smoke and still attempts cleanup", async () => {
  const plan = smokePlan({ failStep: "delete" });
  await withStub(plan, async (stub) => {
    const report = await runSmoke(config(stub.url, plan));
    assert.equal(report.ok, false);
    assert.match(String(report.error), /delete/i);
    assert.equal(stub.snapshot().posts.length, 1);
    assert.ok(String(report.cleanupError).length > 0);
  });
});

test("an open production sign-up fails the smoke", async () => {
  const plan = smokePlan({ signUp: "open" });
  await withStub(plan, async (stub) => {
    const report = await runSmoke(config(stub.url, plan));
    assert.equal(report.ok, false);
    assert.match(String(report.error), /sign-?up/i);
    assert.equal(report.steps.signUp?.refused, false);
    assert.equal(stub.snapshot().rows.length, 0, "the smoke must still be clean");
  });
});

test("a round-trip failure deletes the created property in finally", async () => {
  const plan = smokePlan({ failStep: "round-trip" });
  await withStub(plan, async (stub) => {
    const report = await runSmoke(config(stub.url, plan));
    assert.equal(report.ok, false);
    assert.match(String(report.error), /list|round/i);
    const snapshot = stub.snapshot();
    assert.equal(snapshot.posts.length, 1);
    assert.deepEqual(snapshot.rows, [], "the created row must not survive");
  });
});

test("the CLI reads --plan and prints a smoke summary", async () => {
  const plan = smokePlan();
  await withStub(plan, async (stub) => {
    const dir = mkdtempSync(join(tmpdir(), "m-proper-smoke-"));
    try {
      const rendered = {
        ...plan,
        endpoints: { origin: stub.url, vercelApi: stub.url, supabase: stub.url },
      };
      const file = join(dir, "plan.json");
      writeFileSync(file, JSON.stringify(rendered));
      const { stdout } = await run(
        process.execPath,
        ["--experimental-strip-types", scriptPath, "--plan", file],
        {
          env: {
            PATH: process.env.PATH ?? "",
            SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
            SMOKE_ACCOUNT_EMAIL: rendered.smoke.accountEmail,
            SMOKE_ORIGIN: stub.url,
            SUPABASE_URL: stub.url,
          },
        },
      );
      const match = /\[smoke\] summary: (\{.*\})/.exec(stdout);
      assert.ok(match, `the CLI must print a smoke summary:\n${stdout}`);
      const summary = JSON.parse(match[1]);
      assert.equal(summary.ok, true);
      assert.equal(summary.steps.health.status, 200);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

test("the CLI exits non-zero on a health failure and still prints the summary", async () => {
  const plan = smokePlan({ health: 503 });
  await withStub(plan, async (stub) => {
    const dir = mkdtempSync(join(tmpdir(), "m-proper-smoke-"));
    try {
      const rendered = {
        ...plan,
        endpoints: { origin: stub.url, vercelApi: stub.url, supabase: stub.url },
      };
      const file = join(dir, "plan.json");
      writeFileSync(file, JSON.stringify(rendered));
      const failure = await run(
        process.execPath,
        ["--experimental-strip-types", scriptPath],
        {
          env: {
            PATH: process.env.PATH ?? "",
            SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
            SMOKE_ACCOUNT_EMAIL: rendered.smoke.accountEmail,
            SMOKE_ORIGIN: stub.url,
            SUPABASE_URL: stub.url,
            SMOKE_PLAN: file,
          },
        },
      ).then(
        () => null,
        (error: { code?: number; stdout?: string; stderr?: string }) => error,
      );
      assert.ok(failure, "expected a non-zero exit");
      assert.equal(failure.code, 1);
      const output = `${failure.stdout ?? ""}\n${failure.stderr ?? ""}`;
      assert.match(output, /health/i);
      assert.match(output, /\[smoke\] summary: \{/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
