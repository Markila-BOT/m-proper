// scripts/check-deployment.ts
/**
 * The production deployment check.
 *
 * Reads the checked-in production declaration (`deploy/production.json` by
 * default, `--declaration <path>` or `DEPLOY_DECLARATION` to override it) plus
 * the production environment, and enforces the contract the production
 * environment spec records:
 *
 *   - every required field is present and is not a placeholder;
 *   - the Vercel plan is `hobby` and the Supabase plan is `free`;
 *   - the origin is an exact HTTPS origin, the region is `sin1`, the
 *     production branch is `release`, the framework is `tanstack-start`, and
 *     the root directory is `web`;
 *   - production and preview name different Supabase project references;
 *   - `DATABASE_URL` is the transaction pooler on its declared port and
 *     `DIRECT_DATABASE_URL` is the session pooler on its declared port, and
 *     the two differ;
 *   - the production auth origin is exactly the production origin, with no
 *     wildcard;
 *   - production sign-up is closed, or open only with a CAPTCHA provider.
 *
 * THE CHECK NEVER PRINTS A CONFIGURED VALUE. It names variables, fields, plans,
 * ports, and offending declaration values — never the value of `DATABASE_URL`,
 * `DIRECT_DATABASE_URL`, a key, or any other environment variable.
 *
 * Usage (from the repository root):
 *   pnpm run deploy:check
 *   pnpm run deploy:check -- --declaration path/to/declaration.json
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export type DeploymentEnv = Record<string, string | undefined>;

export type Declaration = Record<string, unknown>;

/** The production environment the app, the release, and the smoke require. */
export const REQUIRED_PRODUCTION_VARIABLES = [
  "DATABASE_URL",
  "DIRECT_DATABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_JWKS_URL",
  "SUPABASE_JWT_ISSUER",
  "SUPABASE_JWT_AUD",
  "SMOKE_ACCOUNT_EMAIL",
] as const;

export interface CheckResult {
  ok: boolean;
  lines: string[];
}

const REQUIRED_FIELDS = [
  "vercel.team",
  "vercel.plan",
  "vercel.project",
  "vercel.root",
  "vercel.framework",
  "vercel.productionBranch",
  "vercel.integrationBranch",
  "vercel.region",
  "vercel.origin",
  "supabase.plan",
  "supabase.productionRef",
  "supabase.previewRef",
  "supabase.runtimePort",
  "supabase.migrationPort",
  "supabase.siteUrl",
  "supabase.redirectAllowlist",
  "auth.productionSignup",
  "auth.smtp",
] as const;

const EXPECTED_FRAMEWORK = "tanstack-start";
const EXPECTED_ROOT = "web";
const EXPECTED_REGION = "sin1";
const EXPECTED_PRODUCTION_BRANCH = "release";
const EXPECTED_INTEGRATION_BRANCH = "master";

const DEFAULT_RUNTIME_PORT = 6543;
const DEFAULT_MIGRATION_PORT = 5432;

function isRecord(value: unknown): value is Declaration {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pick(root: unknown, path: string): unknown {
  let cursor: unknown = root;
  for (const key of path.split(".")) {
    if (!isRecord(cursor)) return undefined;
    cursor = cursor[key];
  }
  return cursor;
}

function isPlaceholder(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return trimmed === "" || /\bTODO\b/i.test(trimmed) || trimmed.includes("{{");
}

function readDeclarationFile(file: string): Declaration {
  const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (!isRecord(parsed)) {
    throw new Error(`${file} does not contain a JSON object.`);
  }
  return parsed;
}

/** Reads and parses a declaration file without validating it. */
export function readDeclaration(file: string): Declaration {
  return readDeclarationFile(file);
}

/**
 * A field path that is required, present, and not a placeholder. Returns true
 * when the field is usable; otherwise appends a named failure.
 */
function requireField(
  declaration: Declaration,
  path: string,
  fail: (message: string) => void,
): boolean {
  const value = pick(declaration, path);
  if (value === undefined) {
    fail(`${path} is missing from the production declaration`);
    return false;
  }
  if (value === null) {
    fail(`${path} is null in the production declaration`);
    return false;
  }
  if (isPlaceholder(value)) {
    fail(`${path} is still a placeholder in the production declaration`);
    return false;
  }
  return true;
}

/** Returns why `value` is not an exact HTTPS origin, or null when it is one. */
function originProblem(value: string): string | null {
  if (value.includes("*")) return "it carries a wildcard";
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "it is not a URL";
  }
  if (url.protocol !== "https:") return "it is not HTTPS";
  if (url.port !== "") return "it carries an explicit port";
  if (url.pathname !== "/" || url.search !== "" || url.hash !== "") {
    return "it carries a path, query, or fragment";
  }
  if (value !== url.origin) return "it is not an exact origin";
  return null;
}

interface ConnectionProblem {
  kind: "missing" | "invalid";
  reason: string;
}

/**
 * Describes why an environment variable is not a pooled Postgres connection on
 * the expected port. The reason never includes the URL itself.
 */
function connectionProblem(
  value: string | undefined,
  expectedPort: number,
  mode: "transaction" | "session",
): ConnectionProblem | null {
  if (value === undefined || value.trim() === "") {
    return { kind: "missing", reason: "it is missing from the production environment" };
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { kind: "invalid", reason: "it is not a URL" };
  }
  if (url.protocol !== "postgresql:") {
    return { kind: "invalid", reason: "it is not a postgresql:// URL" };
  }
  if (url.port !== String(expectedPort)) {
    const shown = url.port === "" ? "the default port" : `port ${url.port}`;
    return {
      kind: "invalid",
      reason: `it uses ${shown}, not the ${mode} pooler port ${expectedPort}`,
    };
  }
  return null;
}

function portOf(declaration: Declaration, path: string, fallback: number): number {
  const raw = pick(declaration, path);
  const value = typeof raw === "number" ? raw : Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

/**
 * Validates the declaration and the environment. Pure: the caller prints
 * `lines`. `ok` is true only when every rule holds.
 */
export function checkDeployment(
  declaration: unknown,
  env: DeploymentEnv = process.env,
): CheckResult {
  const lines: string[] = [];
  const failures: string[] = [];
  const pass = (line: string) => lines.push(`[deploy] ${line}`);
  const fail = (message: string) => failures.push(message);

  if (!isRecord(declaration)) {
    return {
      ok: false,
      lines: ["[deploy] error: the production declaration is not a JSON object"],
    };
  }

  // 1. Every required field is present and real.
  const present = new Map<string, boolean>();
  for (const path of REQUIRED_FIELDS) {
    present.set(path, requireField(declaration, path, fail));
  }

  const captcha = pick(declaration, "auth.captcha");
  const captchaConfigured = !(captcha === null || captcha === undefined || captcha === "");

  // 2. The free-tier posture.
  const vercelPlan = pick(declaration, "vercel.plan");
  if (present.get("vercel.plan") && vercelPlan !== "hobby") {
    fail(
      `vercel plan must be "hobby" (the free tier), got "${String(vercelPlan)}"; ` +
        "the release refuses a paid plan until the declaration is deliberately changed",
    );
  }
  const supabasePlan = pick(declaration, "supabase.plan");
  if (present.get("supabase.plan") && supabasePlan !== "free") {
    fail(
      `supabase plan must be "free", got "${String(supabasePlan)}"; ` +
        "the release refuses a paid plan until the declaration is deliberately changed",
    );
  }

  // 3. The origin, region, branch, framework, and root.
  const origin = pick(declaration, "vercel.origin");
  if (present.get("vercel.origin") && typeof origin === "string") {
    const problem = originProblem(origin);
    if (problem !== null) {
      fail(`production origin "${origin}" is refused: ${problem}`);
    }
  }

  const region = pick(declaration, "vercel.region");
  if (present.get("vercel.region") && region !== EXPECTED_REGION) {
    fail(
      `region must be ${EXPECTED_REGION} beside the production database, got "${String(region)}"`,
    );
  }

  const productionBranch = pick(declaration, "vercel.productionBranch");
  if (
    present.get("vercel.productionBranch") &&
    productionBranch !== EXPECTED_PRODUCTION_BRANCH
  ) {
    fail(
      `production branch must be ${EXPECTED_PRODUCTION_BRANCH}, got "${String(productionBranch)}"`,
    );
  }

  const integrationBranch = pick(declaration, "vercel.integrationBranch");
  if (
    present.get("vercel.integrationBranch") &&
    integrationBranch !== EXPECTED_INTEGRATION_BRANCH
  ) {
    fail(
      `integration branch must be ${EXPECTED_INTEGRATION_BRANCH}, got "${String(integrationBranch)}"`,
    );
  }

  const framework = pick(declaration, "vercel.framework");
  if (present.get("vercel.framework") && framework !== EXPECTED_FRAMEWORK) {
    fail(`framework must be ${EXPECTED_FRAMEWORK}, got "${String(framework)}"`);
  }

  const root = pick(declaration, "vercel.root");
  if (present.get("vercel.root") && root !== EXPECTED_ROOT) {
    fail(`root directory must be ${EXPECTED_ROOT}, got "${String(root)}"`);
  }

  // 4. Production and preview data planes are distinct.
  const productionRef = pick(declaration, "supabase.productionRef");
  const previewRef = pick(declaration, "supabase.previewRef");
  if (
    present.get("supabase.productionRef") &&
    present.get("supabase.previewRef") &&
    productionRef === previewRef
  ) {
    fail(
      "supabase productionRef and supabase previewRef are the same value; " +
        "the production and preview environments must use different Supabase projects",
    );
  }

  // 5. The runtime and migration connections are split.
  const runtimePort = portOf(declaration, "supabase.runtimePort", DEFAULT_RUNTIME_PORT);
  const migrationPort = portOf(
    declaration,
    "supabase.migrationPort",
    DEFAULT_MIGRATION_PORT,
  );
  const runtimeUrl = env.DATABASE_URL;
  const migrationUrl = env.DIRECT_DATABASE_URL;

  const runtimeProblem = connectionProblem(runtimeUrl, runtimePort, "transaction");
  if (runtimeProblem !== null) {
    fail(
      `DATABASE_URL is not a valid transaction-pooler runtime connection: ${runtimeProblem.reason}`,
    );
  }
  const migrationProblem = connectionProblem(migrationUrl, migrationPort, "session");
  if (migrationProblem !== null) {
    fail(
      `DIRECT_DATABASE_URL is not a valid session-pooler migration connection: ` +
        `${migrationProblem.reason}`,
    );
  }
  const sharedUrl =
    typeof runtimeUrl === "string" &&
    runtimeUrl.trim() !== "" &&
    runtimeUrl === migrationUrl;
  if (sharedUrl) {
    fail(
      "DATABASE_URL and DIRECT_DATABASE_URL are identical; the runtime and migration " +
        "connections must differ",
    );
  }

  // 6. The production origin is the only production auth origin.
  const siteUrl = pick(declaration, "supabase.siteUrl");
  const allowlist = pick(declaration, "supabase.redirectAllowlist");
  const allowlistOk =
    Array.isArray(allowlist) &&
    allowlist.length > 0 &&
    allowlist.every((entry) => typeof entry === "string");
  if (present.get("supabase.redirectAllowlist") && !allowlistOk) {
    fail("supabase.redirectAllowlist must be a non-empty list of origins");
  }
  if (present.get("supabase.siteUrl") && typeof siteUrl === "string") {
    if (typeof origin === "string" && siteUrl !== origin) {
      fail(
        `production auth origin must be the production origin "${String(origin)}", ` +
          `got "${siteUrl}"`,
      );
    }
    const problem = originProblem(siteUrl);
    if (problem !== null) {
      fail(`production auth origin "${siteUrl}" is refused: ${problem}`);
    }
  }
  if (allowlistOk && typeof origin === "string") {
    const wildcard = (allowlist as string[]).find((entry) => entry.includes("*"));
    if (wildcard !== undefined) {
      fail(
        `production auth origin "${wildcard}" is refused: the production redirect ` +
          "allowlist admits a wildcard preview origin",
      );
    }
    const foreign = (allowlist as string[]).find((entry) => entry !== origin);
    if (foreign !== undefined) {
      fail(
        `production auth origin "${foreign}" is refused: the production redirect ` +
          `allowlist must contain only "${origin}"`,
      );
    }
  }

  // 7. The private-launch sign-up posture.
  const signup = pick(declaration, "auth.productionSignup");
  if (present.get("auth.productionSignup")) {
    if (signup !== "closed" && signup !== "open") {
      fail(`production sign-up must be "closed" or "open", got "${String(signup)}"`);
    }
    if (signup === "open" && !captchaConfigured) {
      fail(
        "auth.captcha is required when production sign-up is open: the auth " +
          "configuration requires a CAPTCHA provider before public sign-up",
      );
    }
  }

  // 8. Every required production variable is present. Names only, never values.
  const missingVariables = REQUIRED_PRODUCTION_VARIABLES.filter((name) => {
    const value = env[name];
    return typeof value !== "string" || value.trim() === "";
  });
  for (const name of missingVariables) {
    fail(`${name} is missing from the production environment`);
  }

  // Report.
  if (failures.length > 0) {
    lines.push(`[deploy] production deployment check: failed (${failures.length})`);
    for (const failure of failures) {
      lines.push(`[deploy] error: ${failure}`);
    }
    return { ok: false, lines };
  }

  const vercelTeam = pick(declaration, "vercel.team");
  const project = pick(declaration, "vercel.project");
  pass(
    `vercel: team ${String(vercelTeam)} · project ${String(project)} · ` +
      `plan ${String(vercelPlan)} (free tier)`,
  );
  pass(`root: ${String(root)} · framework: ${String(framework)}`);
  pass(`region: ${String(region)}`);
  pass(`production branch: ${String(productionBranch)} (the only production branch)`);
  pass(`integration branch: ${String(integrationBranch)}`);
  pass(`production origin: ${String(origin)}`);
  pass(`supabase: plan ${String(supabasePlan)} · production and preview refs are distinct`);
  pass(
    `DATABASE_URL: valid (postgresql:// transaction pooler on port ${runtimePort})`,
  );
  pass(
    `DIRECT_DATABASE_URL: valid (postgresql:// session pooler on port ${migrationPort})`,
  );
  pass("runtime and migration connections differ");
  pass(`production auth origin: ${String(siteUrl)} (exact, no wildcard)`);
  pass(`production sign-up: ${String(signup)}`);
  pass(`production variables: ${REQUIRED_PRODUCTION_VARIABLES.length} present`);
  return { ok: true, lines };
}

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_DECLARATION = resolve(REPO_ROOT, "deploy", "production.json");

function declarationPathFrom(argv: string[], env: DeploymentEnv): string {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--declaration") {
      const next = argv[index + 1];
      if (next !== undefined && next !== "") return resolve(next);
    }
    if (arg.startsWith("--declaration=")) {
      return resolve(arg.slice("--declaration=".length));
    }
  }
  const fromEnv = env.DEPLOY_DECLARATION?.trim();
  return fromEnv ? resolve(fromEnv) : DEFAULT_DECLARATION;
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (invokedDirectly) {
  const file = declarationPathFrom(process.argv.slice(2), process.env);
  try {
    const result = checkDeployment(readDeclaration(file), process.env);
    for (const line of result.lines) {
      if (result.ok) console.log(line);
      else console.error(line);
    }
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[deploy] error: could not read the production declaration: ${reason}`);
    process.exitCode = 1;
  }
}
