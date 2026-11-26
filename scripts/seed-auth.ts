// scripts/seed-auth.ts
/**
 * Creates or finds the Bootstrap owner and the two acceptance-test owners
 * through the Supabase Auth admin API. Idempotent: existing users are reported
 * as found and left untouched; only missing users are created, with their
 * email confirmed so they are usable immediately.
 *
 * THE SERVICE ROLE KEY BELONGS TO THIS SEED STEP AND THE TEST HARNESS ONLY.
 * It must never be placed in web/.env or any runtime configuration. The web
 * carries the project URL and the publishable key; the server carries the
 * issuer, JWKS location, and audience.
 *
 * Configuration (environment only, nothing is read from .env files):
 *   SUPABASE_URL               required — the project URL, https://<ref>.supabase.co
 *                              (http://127.0.0.1:54321 is accepted for a local stack).
 *                              Not DATABASE_URL, which is a postgresql:// URI.
 *   SUPABASE_SERVICE_ROLE_KEY  required — Auth admin API key; read by this process only.
 *   SEED_OWNER_EMAIL           optional — default owner@m-proper.test
 *   SEED_A_EMAIL               optional — default landlord-a@m-proper.test
 *   SEED_B_EMAIL               optional — default landlord-b@m-proper.test
 *   SEED_OWNER_PASSWORD        required — no default; a project that also serves
 *   SEED_A_PASSWORD            required   production must never hold seeded
 *   SEED_B_PASSWORD            required   identities with a published password.
 *
 * Prints a JSON summary on stdout for the migration backfill and the acceptance
 * harness: { bootstrapOwnerId, ownerAId, ownerBId, created: [email], found: [email] }.
 *
 * Usage (from repo root):
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   SEED_OWNER_PASSWORD=... SEED_A_PASSWORD=... SEED_B_PASSWORD=... \
 *   pnpm run seed:auth
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export type IdentityKey = "bootstrapOwner" | "ownerA" | "ownerB";

export interface SeedIdentity {
  key: IdentityKey;
  email: string;
  password: string;
}

export interface SeedConfig {
  url: string;
  serviceRoleKey: string;
  identities: SeedIdentity[];
}

export interface SeedSummary {
  bootstrapOwnerId: string;
  ownerAId: string;
  ownerBId: string;
  created: string[];
  found: string[];
}

interface IdentitySpec {
  key: IdentityKey;
  emailVar: string;
  passwordVar: string;
  defaultEmail: string;
}

const IDENTITY_SPECS: IdentitySpec[] = [
  {
    key: "bootstrapOwner",
    emailVar: "SEED_OWNER_EMAIL",
    passwordVar: "SEED_OWNER_PASSWORD",
    defaultEmail: "owner@m-proper.test",
  },
  {
    key: "ownerA",
    emailVar: "SEED_A_EMAIL",
    passwordVar: "SEED_A_PASSWORD",
    defaultEmail: "landlord-a@m-proper.test",
  },
  {
    key: "ownerB",
    emailVar: "SEED_B_EMAIL",
    passwordVar: "SEED_B_PASSWORD",
    defaultEmail: "landlord-b@m-proper.test",
  },
];

const PER_PAGE = 1000;
const MAX_PAGES = 100;

function required(env: NodeJS.ProcessEnv, name: string, hint: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. ${hint}`);
  }
  return value;
}

function projectUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(
      "SUPABASE_URL must be the Supabase project URL, for example https://<project-ref>.supabase.co.",
    );
  }
  const hosted =
    url.protocol === "https:" &&
    url.hostname.endsWith(".supabase.co") &&
    url.hostname !== "supabase.co";
  const local =
    (url.protocol === "http:" || url.protocol === "https:") &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if (!hosted && !local) {
    throw new Error(
      `SUPABASE_URL does not look like a Supabase project URL (got "${url.protocol}//${url.host}"). ` +
        "Expected https://<project-ref>.supabase.co; DATABASE_URL is a different value.",
    );
  }
  return url.origin;
}

export function resolveConfig(env: NodeJS.ProcessEnv = process.env): SeedConfig {
  const url = projectUrl(
    required(
      env,
      "SUPABASE_URL",
      "Set it to the Supabase project URL, https://<project-ref>.supabase.co.",
    ),
  );
  const serviceRoleKey = required(
    env,
    "SUPABASE_SERVICE_ROLE_KEY",
    "Set it to the Auth admin API service role key; keep it out of the web and API runtimes.",
  );
  const identities = IDENTITY_SPECS.map((spec) => ({
    key: spec.key,
    email: env[spec.emailVar]?.trim() || spec.defaultEmail,
    password: required(
      env,
      spec.passwordVar,
      "Seeded passwords have no default; pass them explicitly for this run only.",
    ),
  }));
  return { url, serviceRoleKey, identities };
}

interface AdminUser {
  id?: string;
  email?: string;
}

async function adminRequest(
  config: SeedConfig,
  fetchImpl: typeof fetch,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(`${config.url}${path}`, {
      method,
      headers: {
        apikey: config.serviceRoleKey,
        authorization: `Bearer ${config.serviceRoleKey}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new Error(
      `Could not reach the Auth admin API at ${config.url} (${method} ${path}): ${reason}`,
    );
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      (payload as { msg?: string; message?: string } | null)?.msg ??
      (payload as { msg?: string; message?: string } | null)?.message ??
      response.statusText ??
      "no details";
    throw new Error(
      `Auth admin API ${method} ${path} failed with ${response.status}: ${detail}`,
    );
  }
  return payload;
}

async function listUsers(
  config: SeedConfig,
  fetchImpl: typeof fetch,
): Promise<AdminUser[]> {
  const users: AdminUser[] = [];
  let page = 1;
  for (;;) {
    const payload = await adminRequest(
      config,
      fetchImpl,
      "GET",
      `/auth/v1/admin/users?page=${page}&per_page=${PER_PAGE}`,
    );
    const batch: AdminUser[] = Array.isArray(payload)
      ? payload
      : ((payload as { users?: AdminUser[] } | null)?.users ?? []);
    users.push(...batch);

    const declared = Array.isArray(payload)
      ? null
      : (payload as { nextPage?: number | null } | null)?.nextPage;
    const nextPage =
      typeof declared === "number" && declared > page
        ? declared
        : declared == null && batch.length === PER_PAGE
          ? page + 1
          : null;
    if (nextPage === null) return users;
    if (nextPage > MAX_PAGES) {
      throw new Error(
        `Auth admin API pagination did not terminate after ${MAX_PAGES} pages.`,
      );
    }
    page = nextPage;
  }
}

export async function seedAuth(
  config: SeedConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<SeedSummary> {
  const users = await listUsers(config, fetchImpl);
  const idsByEmail = new Map<string, string>();
  for (const user of users) {
    if (typeof user?.id === "string" && typeof user.email === "string") {
      idsByEmail.set(user.email.trim().toLowerCase(), user.id);
    }
  }

  const summary: SeedSummary = {
    bootstrapOwnerId: "",
    ownerAId: "",
    ownerBId: "",
    created: [],
    found: [],
  };

  for (const identity of config.identities) {
    const emailKey = identity.email.toLowerCase();
    const existingId = idsByEmail.get(emailKey);
    if (existingId !== undefined) {
      summary[`${identity.key}Id`] = existingId;
      summary.found.push(identity.email);
      continue;
    }

    const created = (await adminRequest(
      config,
      fetchImpl,
      "POST",
      "/auth/v1/admin/users",
      { email: identity.email, password: identity.password, email_confirm: true },
    )) as { id?: unknown } | null;
    const id = created?.id;
    if (typeof id !== "string" || id === "") {
      throw new Error(
        `Auth admin API returned no user id for ${identity.email}.`,
      );
    }
    summary[`${identity.key}Id`] = id;
    summary.created.push(identity.email);
    idsByEmail.set(emailKey, id);
  }

  return summary;
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (invokedDirectly) {
  try {
    const summary = await seedAuth(resolveConfig(process.env));
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`seed-auth: ${message}`);
    process.exitCode = 1;
  }
}
