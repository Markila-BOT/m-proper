// scripts/check-deployment.test.ts
/**
 * Unit tests for the production deployment check.
 *
 * Run: node --experimental-strip-types --test scripts/check-deployment.test.ts
 *
 * The environment is the system boundary, so every test hands the check a
 * plain record; nothing inside the check is mocked. The committed declaration
 * is read from disk because it is the artefact task 2.1 adds.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  REQUIRED_PRODUCTION_VARIABLES,
  checkDeployment,
  readDeclaration,
} from "./check-deployment.ts";

const run = promisify(execFile);
const scriptPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "check-deployment.ts",
);
const declarationPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "deploy",
  "production.json",
);

const SENTINEL_ENV = {
  DATABASE_URL:
    "postgresql://postgres.production:sentinel-runtime-password@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres",
  DIRECT_DATABASE_URL:
    "postgresql://postgres.production:sentinel-migration-password@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
  SUPABASE_URL: "https://production-ref.supabase.co",
  SUPABASE_ANON_KEY: "sentinel-anon-key-not-a-real-key",
  SUPABASE_SERVICE_ROLE_KEY: "sentinel-service-role-key-not-a-real-key",
  SUPABASE_JWKS_URL:
    "https://production-ref.supabase.co/auth/v1/.well-known/jwks.json",
  SUPABASE_JWT_ISSUER: "https://production-ref.supabase.co/auth/v1",
  SUPABASE_JWT_AUD: "authenticated",
  SMOKE_ACCOUNT_EMAIL: "smoke-account@m-proper.example",
} as const;

const ORIGIN = "https://m-proper.vercel.app";

interface DeclarationShape {
  vercel: Record<string, unknown>;
  supabase: Record<string, unknown>;
  auth: Record<string, unknown>;
}

function declaration(): DeclarationShape {
  return structuredClone(readDeclaration(declarationPath));
}

function text(result: { lines: string[] }): string {
  return result.lines.join("\n");
}

function assertOk(result: { ok: boolean; lines: string[] }) {
  assert.equal(result.ok, true, `expected the check to pass:\n${text(result)}`);
}

function assertFails(result: { ok: boolean; lines: string[] }, pattern: RegExp) {
  assert.equal(result.ok, false, `expected the check to fail:\n${text(result)}`);
  assert.match(text(result), pattern);
}

test("a complete declaration passes and names the contract", () => {
  const result = checkDeployment(declaration(), { ...SENTINEL_ENV });
  assertOk(result);
  const output = text(result);
  for (const needle of [
    "m-proper",
    "sin1",
    "production branch: release",
    "only production branch",
    "integration branch: master",
    ORIGIN,
    "hobby",
    "free",
    "valid",
    "6543",
    "5432",
    "differ",
    "auth origin",
    "production sign-up: closed",
  ]) {
    assert.ok(output.includes(needle), `the report must include "${needle}":\n${output}`);
  }
});

test("the committed declaration passes", () => {
  const result = checkDeployment(readDeclaration(declarationPath), { ...SENTINEL_ENV });
  assertOk(result);
});

test("a missing region is named", () => {
  const doc = declaration();
  delete doc.vercel.region;
  assertFails(checkDeployment(doc, { ...SENTINEL_ENV }), /\bregion\b/i);
});

test("every absent field is named at once", () => {
  const doc = declaration();
  delete doc.vercel.region;
  delete doc.vercel.framework;
  delete doc.supabase.previewRef;
  const result = checkDeployment(doc, { ...SENTINEL_ENV });
  assertFails(result, /\bregion\b/i);
  const output = text(result);
  assert.match(output, /framework/i);
  assert.match(output, /previewRef/);
});

test("a placeholder is refused", () => {
  const doc = declaration();
  doc.supabase.productionRef = "TODO";
  assertFails(checkDeployment(doc, { ...SENTINEL_ENV }), /productionRef/);
});

test("a paid Vercel plan is refused and names the offending value", () => {
  const doc = declaration();
  doc.vercel.plan = "pro";
  const result = checkDeployment(doc, { ...SENTINEL_ENV });
  assertFails(result, /\bplan\b/i);
  assert.match(text(result), /vercel/i);
  assert.match(text(result), /\bpro\b/);
});

test("a paid Supabase plan is refused", () => {
  const doc = declaration();
  doc.supabase.plan = "pro";
  assertFails(checkDeployment(doc, { ...SENTINEL_ENV }), /supabase[\s\S]*plan/i);
});

test("a wildcard production origin is refused", () => {
  const doc = declaration();
  doc.vercel.origin = "https://*.vercel.app";
  assertFails(checkDeployment(doc, { ...SENTINEL_ENV }), /\borigin\b/i);
});

test("an origin with a path is refused", () => {
  const doc = declaration();
  doc.vercel.origin = `${ORIGIN}/app`;
  assertFails(checkDeployment(doc, { ...SENTINEL_ENV }), /\borigin\b/i);
});

test("a plain-HTTP origin is refused", () => {
  const doc = declaration();
  doc.vercel.origin = "http://m-proper.vercel.app";
  doc.supabase.siteUrl = "http://m-proper.vercel.app";
  doc.supabase.redirectAllowlist = ["http://m-proper.vercel.app"];
  assertFails(checkDeployment(doc, { ...SENTINEL_ENV }), /\borigin\b/i);
});

test("a region other than sin1 is refused", () => {
  const doc = declaration();
  doc.vercel.region = "iad1";
  assertFails(checkDeployment(doc, { ...SENTINEL_ENV }), /\bregion\b/i);
});

test("a production branch other than release is refused", () => {
  const doc = declaration();
  doc.vercel.productionBranch = "master";
  assertFails(
    checkDeployment(doc, { ...SENTINEL_ENV }),
    /production branch[\s\S]*release/i,
  );
});

test("a framework other than tanstack-start is refused", () => {
  const doc = declaration();
  doc.vercel.framework = "nextjs";
  assertFails(checkDeployment(doc, { ...SENTINEL_ENV }), /framework/i);
});

test("a root other than web is refused", () => {
  const doc = declaration();
  doc.vercel.root = ".";
  assertFails(checkDeployment(doc, { ...SENTINEL_ENV }), /\broot\b/i);
});

test("a shared production and preview project reference is refused", () => {
  const doc = declaration();
  doc.supabase.productionRef = doc.supabase.previewRef;
  const result = checkDeployment(doc, { ...SENTINEL_ENV });
  assertFails(result, /\bproduction\b/i);
  assert.match(text(result), /\bpreview\b/i);
});

test("a runtime URL on the migration port is refused", () => {
  const env = {
    ...SENTINEL_ENV,
    DATABASE_URL: SENTINEL_ENV.DIRECT_DATABASE_URL,
  };
  assertFails(checkDeployment(declaration(), env), /DATABASE_URL[\s\S]*6543/);
});

test("a migration URL on the transaction port is refused", () => {
  const env = {
    ...SENTINEL_ENV,
    DIRECT_DATABASE_URL:
      "postgresql://postgres.production:sentinel@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres",
  };
  const result = checkDeployment(declaration(), env);
  assertFails(result, /migration/i);
  assert.match(text(result), /6543/);
});

test("identical runtime and migration URLs are refused naming both", () => {
  const shared = SENTINEL_ENV.DIRECT_DATABASE_URL;
  const result = checkDeployment(declaration(), {
    ...SENTINEL_ENV,
    DATABASE_URL: shared,
    DIRECT_DATABASE_URL: shared,
  });
  assertFails(result, /DATABASE_URL/);
  assert.match(text(result), /DIRECT_DATABASE_URL/);
});

test("a non-postgresql runtime URL is refused", () => {
  const env = { ...SENTINEL_ENV, DATABASE_URL: "https://production-ref.supabase.co" };
  assertFails(checkDeployment(declaration(), env), /DATABASE_URL/);
});

test("the split connections pass and are reported as differing", () => {
  const result = checkDeployment(declaration(), { ...SENTINEL_ENV });
  assertOk(result);
  const output = text(result);
  assert.match(output, /DATABASE_URL[\s\S]*valid/i);
  assert.match(output, /DIRECT_DATABASE_URL[\s\S]*valid/i);
  assert.match(output, /differ/i);
});

test("an exact production auth origin passes", () => {
  const result = checkDeployment(declaration(), { ...SENTINEL_ENV });
  assertOk(result);
  assert.match(text(result), /auth origin/i);
  assert.ok(text(result).includes(ORIGIN));
});

test("a wildcard production auth origin is refused", () => {
  const doc = declaration();
  doc.supabase.redirectAllowlist = [ORIGIN, "https://*-git-*.vercel.app"];
  assertFails(checkDeployment(doc, { ...SENTINEL_ENV }), /auth origin/i);
});

test("an auth site URL that differs from the production origin is refused", () => {
  const doc = declaration();
  doc.supabase.siteUrl = "https://m-proper-git-preview.vercel.app";
  assertFails(checkDeployment(doc, { ...SENTINEL_ENV }), /auth origin/i);
});

test("open production sign-up without a CAPTCHA provider is refused", () => {
  const doc = declaration();
  doc.auth.productionSignup = "open";
  doc.auth.captcha = null;
  assertFails(checkDeployment(doc, { ...SENTINEL_ENV }), /captcha/i);
});

test("open production sign-up with a CAPTCHA provider passes", () => {
  const doc = declaration();
  doc.auth.productionSignup = "open";
  doc.auth.captcha = "turnstile";
  assertOk(checkDeployment(doc, { ...SENTINEL_ENV }));
});

test("a missing production variable is named", () => {
  const env: Record<string, string> = { ...SENTINEL_ENV };
  delete env.SUPABASE_JWKS_URL;
  const result = checkDeployment(declaration(), env);
  assertFails(result, /SUPABASE_JWKS_URL/);
});

test("an empty production variable counts as missing", () => {
  const result = checkDeployment(declaration(), {
    ...SENTINEL_ENV,
    DIRECT_DATABASE_URL: "",
  });
  assertFails(result, /DIRECT_DATABASE_URL/);
});

test("the report never echoes a configured value", () => {
  const result = checkDeployment(declaration(), { ...SENTINEL_ENV });
  const output = text(result);
  for (const value of Object.values(SENTINEL_ENV)) {
    assert.ok(!output.includes(value), `the report leaked a configured value: ${value}`);
  }
});

test("the failure report never echoes a configured value", () => {
  const result = checkDeployment(declaration(), {
    ...SENTINEL_ENV,
    SUPABASE_JWKS_URL: "",
  });
  const output = text(result);
  for (const value of Object.values(SENTINEL_ENV)) {
    assert.ok(!output.includes(value), `the failure leaked a configured value: ${value}`);
  }
});

test("the required variable list covers the runtime and the smoke", () => {
  for (const name of [
    "DATABASE_URL",
    "DIRECT_DATABASE_URL",
    "SUPABASE_URL",
    "SUPABASE_JWKS_URL",
    "SUPABASE_JWT_ISSUER",
    "SUPABASE_JWT_AUD",
  ]) {
    assert.ok(REQUIRED_PRODUCTION_VARIABLES.includes(name), `${name} must be required`);
  }
});

test("the CLI reads --declaration and exits successfully", async () => {
  const dir = mkdtempSync(join(tmpdir(), "m-proper-declaration-"));
  try {
    const file = join(dir, "declaration.json");
    writeFileSync(file, JSON.stringify(readDeclaration(declarationPath)));
    const { stdout } = await run(
      process.execPath,
      ["--experimental-strip-types", scriptPath, "--declaration", file],
      { env: { PATH: process.env.PATH ?? "", ...SENTINEL_ENV } },
    );
    assert.match(stdout, /production branch: release/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the CLI reads DEPLOY_DECLARATION and fails naming a missing variable", async () => {
  const dir = mkdtempSync(join(tmpdir(), "m-proper-declaration-"));
  try {
    const file = join(dir, "declaration.json");
    writeFileSync(file, JSON.stringify(readDeclaration(declarationPath)));
    const env: Record<string, string> = { PATH: process.env.PATH ?? "", ...SENTINEL_ENV };
    delete env.SUPABASE_JWKS_URL;
    const failure = await run(
      process.execPath,
      ["--experimental-strip-types", scriptPath],
      { env: { ...env, DEPLOY_DECLARATION: file } },
    ).then(
      () => null,
      (error: { code?: number; stdout?: string; stderr?: string }) => error,
    );
    assert.ok(failure, "expected a non-zero exit");
    assert.equal(failure.code, 1);
    assert.match(`${failure.stdout ?? ""}\n${failure.stderr ?? ""}`, /SUPABASE_JWKS_URL/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
