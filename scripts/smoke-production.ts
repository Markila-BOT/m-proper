// scripts/smoke-production.ts
/**
 * The post-deploy live smoke.
 *
 * Runs after the Vercel production deployment matching the gated commit is
 * READY. It proves the running origin, not the build:
 *
 *   1. `GET /api/health` answers 200.
 *   2. `GET /api/properties` answers 401 without a session.
 *   3. The dedicated Smoke account gets an admin-generated magic link, the
 *      hashed token is exchanged for a session, and the session is assembled
 *      into the `sb-<ref>-auth-token` cookie the app reads.
 *   4. Rows carrying this run's marker are removed before the round trip.
 *   5. One property is created, listed back, deleted, and confirmed gone.
 *   6. Production sign-up is refused.
 *
 * Cleanup happens in `finally`: the property this run created is deleted even
 * when a step throws, and a row is never deleted unless it carries the run
 * marker (or was created by this run).
 *
 * THE SERVICE ROLE KEY IS READ FROM THE ENVIRONMENT AND NEVER PRINTED. This
 * script lives on the release path only; the fake-credential fixture seam
 * (`--plan` / `SMOKE_PLAN`) exists for the acceptance suite.
 *
 * Usage (from the repository root):
 *   pnpm run smoke:production
 *   pnpm run smoke:production -- --plan path/to/plan.json
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { readDeclaration } from "./check-deployment.ts";
import { sessionCookieName } from "../web/src/lib/auth/cookie.ts";

export type SmokeEnv = Record<string, string | undefined>;

export interface SmokeConfig {
  origin: string;
  supabaseUrl: string;
  serviceRoleKey: string;
  accountEmail: string;
  runMarker: string;
  now?: () => Date;
}

export interface SmokeSteps {
  health: { status: number } | null;
  propertiesUnauthenticated: { status: number } | null;
  magicLink: { status: number; userId: string | null } | null;
  session: { status: number; cookieName: string } | null;
  preClean: { removed: number } | null;
  create: { status: number; id: string } | null;
  list: { status: number; found: boolean } | null;
  delete: { status: number; ok: boolean } | null;
  signUp: { status: number; refused: boolean } | null;
}

export interface SmokeReport {
  ok: boolean;
  error: string | null;
  cleanupError: string | null;
  runMarker: string;
  created: string | null;
  deleted: string[];
  preCleaned: string[];
  steps: SmokeSteps;
}

const HEALTH_PATH = "/api/health";
const PROPERTIES_PATH = "/api/properties";
const DEFAULT_RUN_MARKER = "m-proper-smoke";

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function rowsOf(body: unknown): Array<{ id: string; name: string }> {
  const data = asRecord(body)?.data;
  if (!Array.isArray(data)) return [];
  const rows: Array<{ id: string; name: string }> = [];
  for (const entry of data) {
    const row = asRecord(entry);
    const id = row === null ? null : asString(row.id);
    if (id !== null) {
      rows.push({ id, name: row === null ? "" : String(row.name ?? "") });
    }
  }
  return rows;
}

interface Response_ {
  status: number;
  body: unknown;
}

async function request(
  label: string,
  url: string,
  init: RequestInit = {},
): Promise<Response_> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    throw new Error(`live smoke failed at "${label}": ${reason(error)}`);
  }
  const text = await response.text().catch(() => "");
  let body: unknown = null;
  if (text !== "") {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }
  return { status: response.status, body };
}

function authHeaders(serviceRoleKey: string): Record<string, string> {
  return {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    "content-type": "application/json",
  };
}

/** The `sb-<ref>-auth-token` value `@supabase/ssr` writes. */
function sessionCookie(supabaseUrl: string, session: unknown): string {
  const name = sessionCookieName(supabaseUrl);
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
  return `${name}=${value}`;
}

/**
 * Runs the smoke and reports what happened. Never throws: a failure is
 * `ok: false` with `error`, so the caller can always print the summary.
 */
export async function runSmoke(config: SmokeConfig): Promise<SmokeReport> {
  const marker = config.runMarker.trim() === "" ? DEFAULT_RUN_MARKER : config.runMarker;
  const stamp = (config.now ?? (() => new Date()))()
    .toISOString()
    .replace(/[:.]/g, "-");
  const report: SmokeReport = {
    ok: false,
    error: null,
    cleanupError: null,
    runMarker: marker,
    created: null,
    deleted: [],
    preCleaned: [],
    steps: {
      health: null,
      propertiesUnauthenticated: null,
      magicLink: null,
      session: null,
      preClean: null,
      create: null,
      list: null,
      delete: null,
      signUp: null,
    },
  };
  const origin = config.origin.replace(/\/$/, "");
  const supabaseUrl = config.supabaseUrl.replace(/\/$/, "");
  let cookie: string | null = null;

  try {
    // 1. Health.
    const health = await request("health", `${origin}${HEALTH_PATH}`);
    report.steps.health = { status: health.status };
    if (health.status !== 200) {
      throw new Error(
        `live smoke failed at "health": ${HEALTH_PATH} answered ${health.status}, expected 200`,
      );
    }

    // 2. The properties API requires a session.
    const unauthenticated = await request("properties", `${origin}${PROPERTIES_PATH}`);
    report.steps.propertiesUnauthenticated = { status: unauthenticated.status };
    if (unauthenticated.status !== 401) {
      throw new Error(
        `live smoke failed at "properties": ${PROPERTIES_PATH} answered ` +
          `${unauthenticated.status} without a session, expected 401`,
      );
    }

    // 3. A session for the Smoke account.
    const link = await request(
      "magic link",
      `${supabaseUrl}/auth/v1/admin/generate_link`,
      {
        method: "POST",
        headers: authHeaders(config.serviceRoleKey),
        body: JSON.stringify({ type: "magiclink", email: config.accountEmail }),
      },
    );
    const linkBody = asRecord(link.body);
    const hashedToken = linkBody === null ? null : asString(linkBody.hashed_token);
    const linkUser = linkBody === null ? null : asRecord(linkBody.user);
    report.steps.magicLink = {
      status: link.status,
      userId: linkUser === null ? null : asString(linkUser.id),
    };
    if (link.status !== 200 || hashedToken === null) {
      throw new Error(
        `live smoke failed at "magic link": the Auth admin API answered ${link.status} ` +
          "without a hashed token",
      );
    }

    const verified = await request("session", `${supabaseUrl}/auth/v1/verify`, {
      method: "POST",
      headers: authHeaders(config.serviceRoleKey),
      body: JSON.stringify({ type: "magiclink", token_hash: hashedToken }),
    });
    const session = asRecord(verified.body);
    if (verified.status !== 200 || asString(session?.access_token) === null) {
      throw new Error(
        `live smoke failed at "session": the token exchange answered ${verified.status}`,
      );
    }
    const cookieName = sessionCookieName(supabaseUrl);
    report.steps.session = { status: verified.status, cookieName };
    cookie = sessionCookie(supabaseUrl, verified.body);

    // 4. Pre-clean only rows carrying this run's marker.
    const before = await request("pre-clean", `${origin}${PROPERTIES_PATH}`, {
      headers: { cookie },
    });
    if (before.status !== 200) {
      throw new Error(
        `live smoke failed at "pre-clean": the authenticated list answered ${before.status}`,
      );
    }
    for (const row of rowsOf(before.body)) {
      if (!row.name.includes(marker)) continue;
      const removed = await request(
        "pre-clean",
        `${origin}${PROPERTIES_PATH}/${encodeURIComponent(row.id)}`,
        { method: "DELETE", headers: { cookie } },
      );
      if (removed.status < 200 || removed.status >= 300) {
        throw new Error(
          `live smoke failed at "pre-clean": deleting the stale property ${row.id} ` +
            `answered ${removed.status}`,
        );
      }
      report.preCleaned.push(row.id);
    }
    report.steps.preClean = { removed: report.preCleaned.length };

    // 5. Create, list, delete, confirm gone.
    const created = await request("create", `${origin}${PROPERTIES_PATH}`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        name: `${marker} smoke ${stamp}`,
        address: "1 Smoke Test Lane",
        type: "residential",
      }),
    });
    const createdRow = asRecord(asRecord(created.body)?.data);
    const createdId = createdRow === null ? null : asString(createdRow.id);
    if ((created.status !== 201 && created.status !== 200) || createdId === null) {
      throw new Error(
        `live smoke failed at "create": the API answered ${created.status} without an id`,
      );
    }
    report.created = createdId;
    report.steps.create = { status: created.status, id: createdId };

    const listed = await request("round-trip", `${origin}${PROPERTIES_PATH}`, {
      headers: { cookie },
    });
    const listedIds = rowsOf(listed.body).map((row) => row.id);
    report.steps.list = { status: listed.status, found: listedIds.includes(createdId) };
    if (listed.status !== 200 || !listedIds.includes(createdId)) {
      throw new Error(
        `live smoke failed at "round-trip": the created property ${createdId} was not ` +
          "listed back to the smoke account",
      );
    }

    const deleted = await request(
      "delete",
      `${origin}${PROPERTIES_PATH}/${encodeURIComponent(createdId)}`,
      { method: "DELETE", headers: { cookie } },
    );
    const deleteOk = deleted.status >= 200 && deleted.status < 300;
    report.steps.delete = { status: deleted.status, ok: deleteOk };
    if (!deleteOk) {
      throw new Error(
        `live smoke failed at "delete": deleting ${createdId} answered ${deleted.status}`,
      );
    }
    report.deleted.push(createdId);

    const after = await request("round-trip", `${origin}${PROPERTIES_PATH}`, {
      headers: { cookie },
    });
    if (rowsOf(after.body).some((row) => row.id === createdId)) {
      throw new Error(
        `live smoke failed at "delete": the created property ${createdId} survived deletion`,
      );
    }

    // 6. Production sign-up is closed.
    const signUp = await request("sign-up", `${supabaseUrl}/auth/v1/signup`, {
      method: "POST",
      headers: authHeaders(config.serviceRoleKey),
      body: JSON.stringify({
        email: `m-proper-smoke-signup+${stamp}@example.com`,
        password: `smoke-${stamp}-not-a-real-credential`,
      }),
    });
    const refused = signUp.status >= 400;
    report.steps.signUp = { status: signUp.status, refused };
    if (!refused) {
      throw new Error(
        `live smoke failed at "sign-up": production accepted a public sign-up ` +
          `(${signUp.status}); production must stay closed`,
      );
    }

    report.ok = true;
  } catch (error) {
    report.ok = false;
    report.error = reason(error);
  } finally {
    if (cookie !== null && report.created !== null && !report.deleted.includes(report.created)) {
      const id = report.created;
      try {
        const response = await fetch(
          `${origin}${PROPERTIES_PATH}/${encodeURIComponent(id)}`,
          { method: "DELETE", headers: { cookie } },
        );
        if (response.status >= 200 && response.status < 300) {
          report.deleted.push(id);
        } else {
          report.cleanupError = `cleanup delete for ${id} answered ${response.status}`;
        }
      } catch (error) {
        report.cleanupError = `cleanup delete for ${id} failed: ${reason(error)}`;
      }
    }
  }

  return report;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_DECLARATION = resolve(REPO_ROOT, "deploy", "production.json");

function planPathFrom(argv: string[], env: SmokeEnv): string | null {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--plan") {
      const next = argv[index + 1];
      if (next !== undefined && next !== "") return resolve(next);
    }
    if (arg.startsWith("--plan=")) return resolve(arg.slice("--plan=".length));
  }
  const fromEnv = env.SMOKE_PLAN?.trim();
  return fromEnv ? resolve(fromEnv) : null;
}

function declarationOrigin(env: SmokeEnv): string {
  const file = env.DEPLOY_DECLARATION?.trim()
    ? resolve(env.DEPLOY_DECLARATION)
    : DEFAULT_DECLARATION;
  const declaration = readDeclaration(file);
  const vercel = asRecord(declaration.vercel);
  const origin = vercel === null ? null : asString(vercel.origin);
  if (origin === null) {
    throw new Error(`${file} does not declare vercel.origin.`);
  }
  return origin;
}

function resolveConfig(argv: string[], env: SmokeEnv): SmokeConfig {
  const planFile = planPathFrom(argv, env);
  let plan: Record<string, unknown> | null = null;
  if (planFile !== null) {
    plan = asRecord(JSON.parse(readFileSync(planFile, "utf8")));
    if (plan === null) throw new Error(`${planFile} does not contain a JSON object.`);
  }
  const endpoints =
    plan === null ? null : asRecord((plan as Record<string, unknown>).endpoints);
  const smoke =
    plan === null ? null : asRecord((plan as Record<string, unknown>).smoke);

  const origin =
    env.SMOKE_ORIGIN?.trim() ||
    (endpoints === null ? null : asString(endpoints.origin)) ||
    declarationOrigin(env);
  const supabaseUrl =
    env.SUPABASE_URL?.trim() ||
    (endpoints === null ? null : asString(endpoints.supabase));
  if (supabaseUrl === null || supabaseUrl === "") {
    throw new Error("SUPABASE_URL is required to run the live smoke.");
  }
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to run the live smoke.");
  }
  const accountEmail =
    env.SMOKE_ACCOUNT_EMAIL?.trim() ||
    (smoke === null ? null : asString(smoke.accountEmail));
  if (accountEmail === null || accountEmail === "") {
    throw new Error("SMOKE_ACCOUNT_EMAIL is required to run the live smoke.");
  }
  const runMarker =
    (smoke === null ? null : asString(smoke.runMarker)) ||
    env.SMOKE_RUN_MARKER?.trim() ||
    DEFAULT_RUN_MARKER;

  return {
    origin,
    supabaseUrl,
    serviceRoleKey,
    accountEmail,
    runMarker,
  };
}

export function printSmokeReport(
  report: SmokeReport,
  log: (line: string) => void = console.log,
): void {
  const { steps } = report;
  if (steps.health) log(`[smoke] health: ${steps.health.status}`);
  if (steps.propertiesUnauthenticated) {
    log(`[smoke] properties without a session: ${steps.propertiesUnauthenticated.status}`);
  }
  if (steps.session) log(`[smoke] smoke account: session acquired`);
  if (steps.preClean) log(`[smoke] pre-clean: removed ${steps.preClean.removed} stale row(s)`);
  if (steps.create) log(`[smoke] create: ${steps.create.id}`);
  if (steps.list?.found) log(`[smoke] list: created property listed back`);
  if (steps.delete?.ok) log(`[smoke] delete: ${report.created ?? "created property"} removed`);
  if (steps.signUp) log(`[smoke] sign-up: refused (${steps.signUp.status})`);
  if (report.ok) log(`[smoke] ok: ${report.runMarker}`);
  else log(`[smoke] error: ${report.error}`);
  if (report.cleanupError) log(`[smoke] cleanup: ${report.cleanupError}`);
  log(`[smoke] summary: ${JSON.stringify(report)}`);
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (invokedDirectly) {
  try {
    const config = resolveConfig(process.argv.slice(2), process.env);
    const report = await runSmoke(config);
    printSmokeReport(report, report.ok ? console.log : console.error);
    process.exitCode = report.ok ? 0 : 1;
  } catch (error) {
    console.error(`[smoke] error: ${reason(error)}`);
    process.exitCode = 1;
  }
}
