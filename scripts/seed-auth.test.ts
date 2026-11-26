// scripts/seed-auth.test.ts
/**
 * Unit tests for the Auth admin seed script.
 *
 * Run: node --experimental-strip-types --test scripts/seed-auth.test.ts
 *
 * The Auth admin API is the system boundary, so it is replaced with a fake
 * fetch; nothing inside the script is mocked.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveConfig, seedAuth } from "./seed-auth.ts";

const run = promisify(execFile);
const scriptPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "seed-auth.ts",
);

const serviceKey = "service-role-key-must-never-be-printed";
const baseEnv = {
  SUPABASE_URL: "https://example-ref.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: serviceKey,
  SEED_OWNER_PASSWORD: "owner-password",
  SEED_A_PASSWORD: "owner-a-password",
  SEED_B_PASSWORD: "owner-b-password",
};

type Recorded = { url: string; method: string; body?: unknown };

function fakeFetch(
  handler: (request: Recorded) => { status?: number; body: unknown },
) {
  const calls: Recorded[] = [];
  const impl = async (input: string | URL | Request, init?: RequestInit) => {
    const request: Recorded = {
      url: String(input),
      method: init?.method ?? "GET",
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(request);
    const result = handler(request);
    return new Response(JSON.stringify(result.body), {
      status: result.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  };
  return { calls, impl: impl as unknown as typeof fetch };
}

test("requires SUPABASE_URL", () => {
  const { SUPABASE_URL: _omitted, ...env } = baseEnv;
  assert.throws(() => resolveConfig(env), /SUPABASE_URL/);
});

test("requires the service role key", () => {
  const { SUPABASE_SERVICE_ROLE_KEY: _omitted, ...env } = baseEnv;
  assert.throws(() => resolveConfig(env), /SUPABASE_SERVICE_ROLE_KEY/);
});

test("requires a password for every seeded identity", () => {
  const { SEED_A_PASSWORD: _omitted, ...env } = baseEnv;
  assert.throws(() => resolveConfig(env), /SEED_A_PASSWORD/);
});

test("rejects a URL that is not a Supabase project URL", () => {
  const env = { ...baseEnv, SUPABASE_URL: "postgresql://db.example.com:5432/postgres" };
  assert.throws(() => resolveConfig(env), /SUPABASE_URL/);
});

test("defaults the seeded email addresses", () => {
  const config = resolveConfig(baseEnv);
  assert.deepEqual(
    config.identities.map((identity) => identity.email),
    ["owner@m-proper.test", "landlord-a@m-proper.test", "landlord-b@m-proper.test"],
  );
});

test("honours per-identity email overrides", () => {
  const config = resolveConfig({ ...baseEnv, SEED_OWNER_EMAIL: "boss@example.test" });
  assert.equal(config.identities[0].email, "boss@example.test");
});

test("creates a missing user and reports it", async () => {
  const fake = fakeFetch((request) => {
    if (request.method === "GET") return { body: { users: [], nextPage: null } };
    return {
      body: { id: `id-${(request.body as { email: string }).email}`, email: (request.body as { email: string }).email },
    };
  });

  const summary = await seedAuth(resolveConfig(baseEnv), fake.impl);

  const posts = fake.calls.filter((call) => call.method === "POST");
  assert.equal(posts.length, 3);
  assert.deepEqual(posts[0].body, {
    email: "owner@m-proper.test",
    password: "owner-password",
    email_confirm: true,
  });
  assert.deepEqual(summary.created, [
    "owner@m-proper.test",
    "landlord-a@m-proper.test",
    "landlord-b@m-proper.test",
  ]);
  assert.deepEqual(summary.found, []);
});

test("leaves an existing user untouched and matches the email case-insensitively", async () => {
  const fake = fakeFetch((request) => {
    if (request.method === "GET") {
      return {
        body: {
          users: [{ id: "existing-owner", email: "Owner@M-Proper.test" }],
          nextPage: null,
        },
      };
    }
    return { body: { id: `id-${(request.body as { email: string }).email}` } };
  });

  const summary = await seedAuth(resolveConfig(baseEnv), fake.impl);

  const posts = fake.calls.filter((call) => call.method === "POST");
  assert.deepEqual(
    posts.map((call) => (call.body as { email: string }).email),
    ["landlord-a@m-proper.test", "landlord-b@m-proper.test"],
  );
  assert.equal(summary.bootstrapOwnerId, "existing-owner");
  assert.deepEqual(summary.found, ["owner@m-proper.test"]);
});

test("pages through the existing users", async () => {
  const fake = fakeFetch((request) => {
    if (request.method === "GET") {
      const page = new URL(request.url).searchParams.get("page");
      if (page === "1") {
        return { body: { users: [{ id: "id-a", email: "landlord-a@m-proper.test" }], nextPage: 2 } };
      }
      return {
        body: {
          users: [
            { id: "id-b", email: "landlord-b@m-proper.test" },
            { id: "id-owner", email: "owner@m-proper.test" },
          ],
          nextPage: null,
        },
      };
    }
    return { body: { id: "unexpected" } };
  });

  const summary = await seedAuth(resolveConfig(baseEnv), fake.impl);

  assert.equal(fake.calls.filter((call) => call.method === "POST").length, 0);
  assert.deepEqual(summary, {
    bootstrapOwnerId: "id-owner",
    ownerAId: "id-a",
    ownerBId: "id-b",
    created: [],
    found: [
      "owner@m-proper.test",
      "landlord-a@m-proper.test",
      "landlord-b@m-proper.test",
    ],
  });
});

test("fails with the API message without leaking the service key", async () => {
  const fake = fakeFetch(() => ({
    status: 401,
    body: { message: "invalid JWT: unable to parse or verify signature" },
  }));

  await assert.rejects(seedAuth(resolveConfig(baseEnv), fake.impl), (error: Error) => {
    assert.match(error.message, /401/);
    assert.match(error.message, /invalid JWT/);
    assert.ok(!error.message.includes(serviceKey));
    return true;
  });
});

test("sends the service key as a bearer token to the admin API", async () => {
  const seen: RequestInit[] = [];
  const fake = fakeFetch((request) => {
    if (request.method === "GET") return { body: { users: [], nextPage: null } };
    return { body: { id: "id" } };
  });
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    seen.push(init ?? {});
    return fake.impl(input as string, init);
  }) as unknown as typeof fetch;

  await seedAuth(resolveConfig(baseEnv), impl);

  const headers = new Headers(seen[0].headers);
  assert.equal(headers.get("authorization"), `Bearer ${serviceKey}`);
  assert.equal(headers.get("apikey"), serviceKey);
});

test("exits non-zero with an actionable message when the environment is empty", async () => {
  const error = await run(process.execPath, ["--experimental-strip-types", scriptPath], {
    env: { PATH: process.env.PATH ?? "" },
  }).then(
    () => null,
    (failure: { code?: number; stderr?: string }) => failure,
  );

  assert.ok(error, "expected a non-zero exit");
  assert.equal(error.code, 1);
  assert.match(String(error.stderr), /SUPABASE_URL/);
});
