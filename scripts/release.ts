// scripts/release.ts
/**
 * The production release command.
 *
 * One command takes a commit from `master` to production. The body of the
 * release is a fixed sequence, and each stage stops the next:
 *
 *   deploy-check · install · lint · typecheck · unit · build · spec-lint ·
 *   acceptance · tip · backup (pg_dump) · dump (off-machine) · migration ·
 *   release-branch · deployment · smoke
 *
 * Rules that are load-bearing (design §5, §9, §10):
 *
 * - The release gate runs first and stops on the first failure. Nothing is
 *   backed up, migrated, or pushed when a gate step fails.
 * - The gated commit is asserted to still be `origin/master`'s tip before the
 *   backup or the migration.
 * - The backup is a logical `pg_dump` over the session migration connection,
 *   stored off-machine before the migration. A failed dump refuses the
 *   migration; `DATABASE_URL` is never used as a fallback.
 * - `db:migrate` runs over `DIRECT_DATABASE_URL` before `release` advances.
 * - `release` advances only to the gated commit, and the release waits for the
 *   Vercel production deployment whose commit matches it. Another commit, an
 *   errored deployment, or a timeout fails the release.
 * - The live smoke runs after READY. On failure the release prints the
 *   previous production deployment and the rollback action and never runs a
 *   down migration.
 *
 * THE COMMAND RUNNER AND `fetch` ARE INJECTED. The default is the real shell
 * and the global `fetch`; the acceptance suite and the unit tests pass a
 * fixture plan, whose outcomes drive a planned runner. The fixture seam is
 * `--plan <file>` or `RELEASE_PLAN`.
 *
 * Split modes (documented, same default contract):
 *   --mode=full       the default: gates, tip, backup, migration, advance,
 *                     deployment, smoke.
 *   --mode=gate       gates and the tip check only. The `verify` job runs this
 *                     so the expensive acceptance run needs the `test`
 *                     environment's secrets, not production's.
 *   --mode=mutating   the tip check and every mutating stage, without the
 *                     gate. The `release` job runs this after `verify`.
 *
 * Usage (from the repository root):
 *   pnpm run release
 *   pnpm run release -- --mode=mutating
 *   pnpm run release -- --plan path/to/plan.json
 */
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { checkDeployment, readDeclaration } from "./check-deployment.ts";
import { runSmoke } from "./smoke-production.ts";
import type { SmokeConfig, SmokeReport } from "./smoke-production.ts";

export type ReleaseMode = "full" | "gate" | "mutating";
export type ReleaseEnv = Record<string, string | undefined>;

export interface ReleasePlan {
  commit: { gated: string; masterTip: string };
  endpoints?: { origin?: string; vercelApi?: string; supabase?: string };
  connections?: { runtime?: string; migration?: string };
  gates?: Record<string, string>;
  backup?: { result?: string; artifact?: string };
  migration?: { result?: string };
  deployments?: Array<{ id: string; sha: string; state?: string }>;
  previousDeployment?: { id: string; sha: string };
  smoke?: {
    runMarker?: string;
    accountEmail?: string;
    health?: number;
    propertiesUnauthenticated?: number;
    signUp?: string;
    existingRows?: unknown[];
    failStep?: string | null;
  };
  vercelProject?: string;
}

export interface CommandSpec {
  stage: string;
  command: string[];
  cwd?: string;
  env?: ReleaseEnv;
}

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

export type CommandRunner = (spec: CommandSpec) => Promise<CommandResult>;

export interface ReleaseOptions {
  plan?: ReleasePlan;
  mode?: ReleaseMode;
  env?: ReleaseEnv;
  cwd?: string;
  deploymentPollAttempts?: number;
  deploymentPollDelayMs?: number;
}

export interface ReleaseDeps {
  run?: CommandRunner;
  fetchImpl?: typeof fetch;
  runSmoke?: (config: SmokeConfig) => Promise<SmokeReport>;
  log?: (line: string) => void;
  sleep?: (ms: number) => Promise<void>;
}

export interface ReleaseSummary {
  ok: boolean;
  mode: ReleaseMode;
  gatedCommit: string;
  masterTip: string | null;
  stages: string[];
  commands: string[];
  gates: Record<string, "passed" | "failed" | "skipped">;
  backup: "passed" | "failed" | null;
  dumpStored: string | null;
  migration: "passed" | "failed" | null;
  branchAdvancedTo: string | null;
  deploymentRequested: boolean;
  deployment: { id: string; sha: string } | null;
  smoke: { ok: boolean; error: string | null } | null;
  rollbackTarget: { id: string; sha: string } | null;
  rollbackAction: string | null;
  downMigration: false;
  error: string | null;
}

export interface ReleaseResult {
  ok: boolean;
  exitCode: number;
  summary: ReleaseSummary;
  lines: string[];
}

const GATES = [
  { stage: "install", planKey: "install", command: ["pnpm", "install", "--frozen-lockfile"] },
  { stage: "lint", planKey: "lint", command: ["pnpm", "--filter", "web", "lint"] },
  {
    stage: "typecheck",
    planKey: "typecheck",
    command: ["pnpm", "--filter", "web", "exec", "tsc", "--noEmit"],
  },
  { stage: "unit", planKey: "unit", command: ["pnpm", "--filter", "web", "test:unit"] },
  { stage: "build", planKey: "build", command: ["pnpm", "--filter", "web", "build"] },
  { stage: "spec-lint", planKey: "specLint", command: ["npm", "run", "lint:specs"] },
  { stage: "acceptance", planKey: "acceptance", command: ["npm", "run", "test:specs"] },
] as const;

const DEFAULT_ARTIFACT = "m-proper-release-backup";
const DEFAULT_POLL_ATTEMPTS = 60;
const DEFAULT_POLL_DELAY_MS = 5_000;

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_DECLARATION = resolve(REPO_ROOT, "deploy", "production.json");

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

/** The planned command runner: a fixture plan decides every outcome. */
export function planCommandRunner(plan: ReleasePlan): CommandRunner {
  return async ({ stage }) => {
    let passed: boolean;
    switch (stage) {
      case "install":
      case "lint":
      case "typecheck":
      case "unit":
      case "build":
      case "acceptance":
        passed = plan.gates?.[stage] !== "fail";
        break;
      case "spec-lint":
        passed = plan.gates?.specLint !== "fail";
        break;
      case "backup":
        passed = plan.backup?.result !== "fail";
        break;
      case "migration":
        passed = plan.migration?.result !== "fail";
        break;
      default:
        passed = true;
    }
    return passed
      ? { code: 0, stdout: "", stderr: "" }
      : { code: 1, stdout: "", stderr: `planned ${stage} failure` };
  };
}

function shellRunner(cwd: string): CommandRunner {
  return (spec) =>
    new Promise((resolvePromise) => {
      const child = spawn(spec.command[0], spec.command.slice(1), {
        cwd: spec.cwd ?? cwd,
        env: { ...process.env, ...spec.env },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      child.on("error", (error) => {
        resolvePromise({ code: 127, stdout, stderr: `${stderr}${reason(error)}` });
      });
      child.on("close", (code) => {
        resolvePromise({ code: code ?? 1, stdout, stderr });
      });
    });
}

interface Deployment {
  id: string;
  sha: string;
  state: string;
}

function deploymentOf(value: unknown): Deployment | null {
  const record = asRecord(value);
  if (record === null) return null;
  const id = asString(record.id) ?? asString(record.uid);
  if (id === null) return null;
  const meta = asRecord(record.meta);
  const sha = (meta === null ? null : asString(meta.githubCommitSha)) ?? asString(record.sha);
  return {
    id,
    sha: sha ?? "",
    state: asString(record.readyState)?.toUpperCase() ?? "UNKNOWN",
  };
}

/**
 * Applies one release. Pure enough to test: the caller supplies the plan, the
 * environment, the runner, `fetch`, and the smoke, and reads the summary.
 */
export async function runRelease(
  options: ReleaseOptions = {},
  deps: ReleaseDeps = {},
): Promise<ReleaseResult> {
  const env = options.env ?? process.env;
  const mode = options.mode ?? "full";
  const cwd = options.cwd ?? REPO_ROOT;
  const plan = options.plan;
  const usingPlan = plan !== undefined;
  const run = deps.run ?? (usingPlan ? planCommandRunner(plan) : shellRunner(cwd));
  const fetchImpl = deps.fetchImpl ?? fetch;
  const smokeRunner = deps.runSmoke ?? runSmoke;
  const sleep =
    deps.sleep ?? ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)));

  const lines: string[] = [];
  const log = (line: string) => {
    lines.push(line);
    deps.log?.(line);
  };

  const summary: ReleaseSummary = {
    ok: false,
    mode,
    gatedCommit: "",
    masterTip: null,
    stages: [],
    commands: [],
    gates: {},
    backup: null,
    dumpStored: null,
    migration: null,
    branchAdvancedTo: null,
    deploymentRequested: false,
    deployment: null,
    smoke: null,
    rollbackTarget: null,
    rollbackAction: null,
    downMigration: false,
    error: null,
  };

  const runStage = async (spec: CommandSpec): Promise<CommandResult> => {
    summary.commands.push(spec.stage);
    return run(spec);
  };

  const git = async (args: string[]): Promise<string> => {
    const result = await runStage({ stage: "git", command: ["git", ...args], cwd });
    if (result.code !== 0) {
      throw new Error(`git ${args.join(" ")} failed: ${result.stderr.trim()}`);
    }
    return result.stdout.trim();
  };

  const listDeployments = async (): Promise<Deployment[]> => {
    const apiBase = (
      env.VERCEL_API_URL?.trim() ||
      plan?.endpoints?.vercelApi ||
      "https://api.vercel.com"
    ).replace(/\/$/, "");
    const projectId =
      plan?.vercelProject ?? env.VERCEL_PROJECT_ID?.trim() ?? "m-proper";
    const token = env.VERCEL_TOKEN?.trim();
    const url =
      `${apiBase}/v6/deployments?projectId=${encodeURIComponent(projectId)}` +
      "&target=production&limit=20";
    let response: Response;
    try {
      response = await fetchImpl(url, {
        headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
      });
    } catch (error) {
      throw new Error(`the Vercel deployments API is unreachable: ${reason(error)}`);
    }
    if (!response.ok) {
      throw new Error(`the Vercel deployments API answered ${response.status}`);
    }
    const body: unknown = await response.json().catch(() => null);
    const entries = asRecord(body)?.deployments;
    if (!Array.isArray(entries)) return [];
    const deployments: Deployment[] = [];
    for (const entry of entries) {
      const deployment = deploymentOf(entry);
      if (deployment !== null) deployments.push(deployment);
    }
    return deployments;
  };

  const waitForDeployment = async (gated: string): Promise<Deployment> => {
    const attempts = Math.max(1, options.deploymentPollAttempts ?? DEFAULT_POLL_ATTEMPTS);
    const delay = Math.max(0, options.deploymentPollDelayMs ?? DEFAULT_POLL_DELAY_MS);
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const deployments = await listDeployments();
      const errored = deployments.find(
        (entry) => entry.state === "ERROR" || entry.state === "CANCELED",
      );
      if (errored !== undefined) {
        throw new Error(
          `Vercel deployment ${errored.id} for commit ${errored.sha} reported ` +
            `${errored.state}; the gated commit is ${gated}`,
        );
      }
      const ready = deployments.filter((entry) => entry.state === "READY");
      if (ready.length > 0) {
        const matching = ready.find((entry) => entry.sha === gated);
        if (matching !== undefined) {
          log(
            `[release] deployment: ${matching.id} is READY for the gated commit ${gated}`,
          );
          return matching;
        }
        const first = ready[0];
        throw new Error(
          `Vercel reported production deployment ${first.id} for commit ${first.sha}, ` +
            `but the gated commit is ${gated}`,
        );
      }
      if (attempt < attempts) await sleep(delay);
    }
    throw new Error(
      `no READY production deployment for the gated commit ${gated} after ` +
        `${attempts} attempt(s)`,
    );
  };

  const smokeConfig = (): SmokeConfig => {
    const origin =
      env.SMOKE_ORIGIN?.trim() ||
      plan?.endpoints?.origin ||
      declarationOrigin(env);
    const supabaseUrl = env.SUPABASE_URL?.trim() || plan?.endpoints?.supabase;
    if (supabaseUrl === undefined || supabaseUrl === "") {
      throw new Error("SUPABASE_URL is required to run the live smoke.");
    }
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!serviceRoleKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to run the live smoke.");
    }
    const accountEmail =
      env.SMOKE_ACCOUNT_EMAIL?.trim() || plan?.smoke?.accountEmail;
    if (accountEmail === undefined || accountEmail === "") {
      throw new Error("SMOKE_ACCOUNT_EMAIL is required to run the live smoke.");
    }
    return {
      origin,
      supabaseUrl,
      serviceRoleKey,
      accountEmail,
      runMarker:
        plan?.smoke?.runMarker ?? env.SMOKE_RUN_MARKER?.trim() ?? "m-proper-smoke",
      now: () => new Date(),
    };
  };

  try {
    const gated = usingPlan
      ? plan.commit.gated
      : await git(["rev-parse", "HEAD"]);
    summary.gatedCommit = gated;
    log(`[release] gated commit: ${gated}`);

    // The deployment check runs before the backup, the migration, and any
    // deployment. The gate-only mode runs on the `test` environment, which
    // does not hold production values, so the check runs where it matters:
    // before the mutating stages. In plan mode the fixtures exercise it
    // separately.
    if (!usingPlan && mode !== "gate") {
      summary.stages.push("deploy-check");
      const declarationFile = env.DEPLOY_DECLARATION?.trim()
        ? resolve(env.DEPLOY_DECLARATION)
        : DEFAULT_DECLARATION;
      const check = checkDeployment(readDeclaration(declarationFile), env);
      for (const line of check.lines) log(line);
      if (!check.ok) {
        throw new Error(
          "the production deployment check failed; refusing to back up, migrate, or deploy",
        );
      }
    }

    if (mode === "full" || mode === "gate") {
      // 1. The release gate, in its fixed order, stopping on the first failure.
      for (const gate of GATES) {
        summary.stages.push(gate.stage);
        const result = await runStage({ stage: gate.stage, command: [...gate.command], cwd });
        if (result.code !== 0) {
          summary.gates[gate.planKey] = "failed";
          throw new Error(
            `the release gate failed at "${gate.stage}"; stopping before the backup, ` +
              "the migration, and the release branch",
          );
        }
        summary.gates[gate.planKey] = "passed";
        log(`[release] gate: ${gate.stage} passed`);
      }
    }

    // 2. The gated commit must still be the tip of master.
    summary.stages.push("tip");
    let tip: string;
    if (usingPlan) {
      tip = plan.commit.masterTip;
    } else {
      await git(["fetch", "origin", "--quiet"]);
      tip = await git(["rev-parse", "origin/master"]);
    }
    summary.masterTip = tip;
    if (tip !== gated) {
      throw new Error(
        `master advanced after the gates started: the gated commit is ${gated} ` +
          `and the current master tip is ${tip}; aborting before the backup and the migration`,
      );
    }
    log(`[release] tip: origin/master is still the gated commit`);

    if (mode !== "gate") {
      // 3. The session migration connection is required; never fall back.
      const migrationUrl = env.DIRECT_DATABASE_URL?.trim() ?? "";
      const declaredAbsent = plan?.connections?.migration === "absent";
      if (declaredAbsent || migrationUrl === "") {
        throw new Error(
          "DIRECT_DATABASE_URL is missing: the session migration connection is required " +
            "for the pre-release dump and the migration; refusing to fall back to DATABASE_URL",
        );
      }

      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const dumpDir = env.RELEASE_DUMP_DIR?.trim() || join(REPO_ROOT, ".release");
      const dumpPath = join(dumpDir, `m-proper-${stamp}.dump`);

      // 4. Back up before migrating.
      summary.stages.push("backup");
      if (!usingPlan) mkdirSync(dumpDir, { recursive: true });
      const backup = await runStage({
        stage: "backup",
        command: [
          "pg_dump",
          "--format=custom",
          "--no-owner",
          "--no-privileges",
          "--file",
          dumpPath,
        ],
        cwd,
        // libpq reads PGDATABASE as a connection string, so the URL never
        // appears in argv or in a log.
        env: { PGDATABASE: migrationUrl },
      });
      if (backup.code !== 0) {
        summary.backup = "failed";
        throw new Error(
          "the pre-release pg_dump failed; refusing to migrate without a backup",
        );
      }
      summary.backup = "passed";
      log(`[release] backup: pg_dump completed over the session connection`);

      // 5. Store the dump off-machine before changing the schema.
      summary.stages.push("dump");
      if (usingPlan) {
        summary.dumpStored = plan.backup?.artifact ?? `artifact:${DEFAULT_ARTIFACT}`;
      } else {
        const upload = env.RELEASE_DUMP_UPLOAD_COMMAND?.trim();
        const location = env.RELEASE_DUMP_LOCATION?.trim() || `artifact:${DEFAULT_ARTIFACT}`;
        if (!upload) {
          throw new Error(
            "the pre-release dump must be stored off-machine before the migration: " +
              "set RELEASE_DUMP_UPLOAD_COMMAND (use {dump} for the dump file) and " +
              "RELEASE_DUMP_LOCATION",
          );
        }
        const stored = await runStage({
          stage: "dump",
          command: ["sh", "-c", upload.replaceAll("{dump}", dumpPath)],
          cwd,
        });
        if (stored.code !== 0) {
          throw new Error(
            "the pre-release dump could not be stored off-machine; refusing to migrate",
          );
        }
        summary.dumpStored = location;
      }
      log(`[release] dump: stored off-machine at ${summary.dumpStored}`);

      // 6. Migrate over the session connection, before the branch advances.
      summary.stages.push("migration");
      const migrated = await runStage({
        stage: "migration",
        command: ["pnpm", "--filter", "web", "db:migrate"],
        cwd,
        env: { DIRECT_DATABASE_URL: migrationUrl },
      });
      if (migrated.code !== 0) {
        summary.migration = "failed";
        throw new Error(
          "the migration failed; the release branch does not advance and no " +
            "deployment is requested",
        );
      }
      summary.migration = "passed";
      log(`[release] migration: db:migrate applied over the session connection`);

      // 7. Advance release to exactly the gated commit.
      summary.stages.push("release-branch");
      if (!usingPlan) {
        await git(["fetch", "origin", "release", "--quiet"]).catch(() => "");
        // The first release may create `release`; afterwards it must be a
        // fast-forward of the gated commit.
        const existing = await runStage({
          stage: "release-branch-ref",
          command: ["git", "rev-parse", "--verify", "origin/release"],
          cwd,
        });
        if (existing.code === 0) {
          const ancestor = await runStage({
            stage: "release-branch",
            command: ["git", "merge-base", "--is-ancestor", "origin/release", gated],
            cwd,
          });
          if (ancestor.code !== 0) {
            throw new Error(
              `release is not a fast-forward of the gated commit ${gated}; refusing to advance`,
            );
          }
        }
        const pushed = await runStage({
          stage: "release-branch",
          command: ["git", "push", "origin", `${gated}:release`],
          cwd,
        });
        if (pushed.code !== 0) {
          throw new Error(
            `could not advance release to ${gated}: ${pushed.stderr.trim()}`,
          );
        }
      }
      summary.branchAdvancedTo = gated;
      log(`[release] release-branch: release advanced to ${gated}`);

      // 8. Wait for the production deployment whose commit matches.
      summary.stages.push("deployment");
      summary.deploymentRequested = true;
      const previous = usingPlan
        ? plan.previousDeployment
        : (await listDeployments()).find(
            (entry) => entry.state === "READY" && entry.sha !== gated,
          );
      if (previous !== undefined) {
        summary.rollbackTarget = { id: previous.id, sha: previous.sha };
        summary.rollbackAction = `vercel rollback ${previous.id} --yes`;
      }
      const deployment = await waitForDeployment(gated);
      summary.deployment = { id: deployment.id, sha: deployment.sha };

      // 9. Prove the live origin.
      summary.stages.push("smoke");
      const report = await smokeRunner(smokeConfig());
      summary.smoke = { ok: report.ok, error: report.error };
      if (!report.ok) {
        throw new Error(`the live smoke failed: ${report.error ?? "unknown step"}`);
      }
      log("[release] smoke: the live origin answered the round trip");
    }

    summary.ok = true;
    log(`[release] ok: ${summary.gatedCommit} is serving production`);
  } catch (error) {
    summary.ok = false;
    summary.error = reason(error);
    log(`[release] error: ${summary.error}`);
    if (summary.rollbackTarget !== null) {
      log(
        `[release] previous production deployment: ${summary.rollbackTarget.id} ` +
          `(${summary.rollbackTarget.sha})`,
      );
      log(`[release] rollback action: ${summary.rollbackAction}`);
      log(
        "[release] the schema is forward-only: revert or forward-fix master before the " +
          "next release; the database is never rolled back",
      );
    }
  }

  log(`[release] summary: ${JSON.stringify(summary)}`);
  return {
    ok: summary.ok,
    exitCode: summary.ok ? 0 : 1,
    summary,
    lines,
  };
}

function declarationOrigin(env: ReleaseEnv): string {
  const file = env.DEPLOY_DECLARATION?.trim()
    ? resolve(env.DEPLOY_DECLARATION)
    : DEFAULT_DECLARATION;
  const declaration = readDeclaration(file);
  const origin = asString(asRecord(declaration.vercel)?.origin);
  if (origin === null) {
    throw new Error(`${file} does not declare vercel.origin.`);
  }
  return origin;
}

function planPathFrom(argv: string[], env: ReleaseEnv): string | null {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--plan") {
      const next = argv[index + 1];
      if (next !== undefined && next !== "") return resolve(next);
    }
    if (arg.startsWith("--plan=")) return resolve(arg.slice("--plan=".length));
  }
  const fromEnv = env.RELEASE_PLAN?.trim();
  return fromEnv ? resolve(fromEnv) : null;
}

function modeFrom(argv: string[]): ReleaseMode {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const raw =
      arg === "--mode"
        ? argv[index + 1]
        : arg.startsWith("--mode=")
          ? arg.slice("--mode=".length)
          : null;
    if (raw === null) continue;
    if (raw === "full" || raw === "gate" || raw === "mutating") return raw;
    throw new Error(`unknown release mode "${raw}"; use full, gate, or mutating.`);
  }
  return "full";
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (invokedDirectly) {
  try {
    const argv = process.argv.slice(2);
    const planFile = planPathFrom(argv, process.env);
    const plan: ReleasePlan | undefined =
      planFile === null
        ? undefined
        : (JSON.parse(readFileSync(planFile, "utf8")) as ReleasePlan);
    const result = await runRelease({
      plan,
      mode: modeFrom(argv),
      env: process.env,
    });
    for (const line of result.lines) {
      if (result.ok) console.log(line);
      else console.error(line);
    }
    process.exitCode = result.exitCode;
  } catch (error) {
    console.error(`[release] error: ${reason(error)}`);
    process.exitCode = 1;
  }
}
