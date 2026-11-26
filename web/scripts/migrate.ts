// web/scripts/migrate.ts
/**
 * Applies Drizzle migrations over the DIRECT (non-pooled) Postgres connection.
 *
 * Two rules are load-bearing (ADR-0011):
 *
 * - `drizzle-kit push` MUST NOT be run against Supabase. `push` derives DDL
 *   from `db/schema.ts`, which cannot express RLS, the grant revokes, or the
 *   backfill block, and it would emit drops for them.
 * - Migrations are an explicit operator/CI step. They NEVER run at build time
 *   and NEVER run on a request; nothing in the app imports this file.
 *
 * Usage (from the repository root):
 *   pnpm --filter web db:migrate
 *
 * A direct run loads `web/.env`, so the operator can either export
 * `DIRECT_DATABASE_URL` or put it in that file (development only; production
 * reads the platform's environment). The loader never overrides an exported
 * value.
 *
 * `DIRECT_DATABASE_URL` is required and `DATABASE_URL` is never used as a
 * fallback: the runtime URL is pooled and is not a migration target.
 *
 * Frozen baseline: `db/migrations/0000_baseline.sql` reproduces the schema the
 * sqlx migration history already applied. Its journal entry is checked in, and
 * this script records that entry as applied when the database already carries
 * `public.properties` and has no Drizzle history. That is the same row
 * `PgDialect.migrate` writes after running a migration, so the baseline SQL is
 * never executed against an existing database, while a fresh database still
 * receives it.
 */
import { fileURLToPath } from 'node:url'

import { readMigrationFiles } from 'drizzle-orm/migrator'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

import { loadServerEnv } from '../src/lib/server-env.ts'

const MIGRATIONS_FOLDER = fileURLToPath(
  new URL('../db/migrations', import.meta.url),
)
const MIGRATIONS_SCHEMA = 'drizzle'
const MIGRATIONS_TABLE = '__drizzle_migrations'

function requireDirectDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const url = env.DIRECT_DATABASE_URL?.trim()
  if (!url) {
    throw new Error(
      'DIRECT_DATABASE_URL is required: migrations run over the direct (non-pooled) Postgres connection. ' +
        'Refusing to fall back to DATABASE_URL, which is the pooled runtime URL.',
    )
  }
  return url
}

/**
 * Records the frozen baseline as applied when the schema already exists.
 *
 * Returns true when the baseline was adopted. The history table is created with
 * the same DDL as drizzle-orm's PgDialect so both entry points share it.
 */
async function adoptFrozenBaseline(
  sql: postgres.Sql,
  baseline: { hash: string; folderMillis: number },
): Promise<boolean> {
  await sql`create schema if not exists ${sql(MIGRATIONS_SCHEMA)}`
  await sql`
    create table if not exists ${sql(MIGRATIONS_SCHEMA)}.${sql(MIGRATIONS_TABLE)} (
      id serial primary key,
      hash text not null,
      created_at bigint
    )
  `

  const [{ history }] = await sql<{ history: number }[]>`
    select count(*)::int as history
    from ${sql(MIGRATIONS_SCHEMA)}.${sql(MIGRATIONS_TABLE)}
  `
  if (history > 0) {
    return false
  }

  const [{ present }] = await sql<{ present: boolean }[]>`
    select to_regclass('public.properties') is not null as present
  `
  if (!present) {
    return false
  }

  await sql`
    insert into ${sql(MIGRATIONS_SCHEMA)}.${sql(MIGRATIONS_TABLE)} (hash, created_at)
    values (${baseline.hash}, ${baseline.folderMillis})
  `
  return true
}

async function main(): Promise<void> {
  // A direct run reads web/.env so the operator does not have to export the
  // variables by hand. Production runs take the platform's environment only,
  // and process.loadEnvFile never overrides a value that is already set.
  if (process.env.NODE_ENV !== 'production') {
    loadServerEnv()
  }

  const url = requireDirectDatabaseUrl()
  const migrations = readMigrationFiles({ migrationsFolder: MIGRATIONS_FOLDER })
  const baseline = migrations.at(0)
  if (!baseline) {
    throw new Error(`No migrations found in ${MIGRATIONS_FOLDER}.`)
  }

  // The direct connection handles one statement stream; migrations are serial.
  const sql = postgres(url, { max: 1, onnotice: () => undefined })
  try {
    if (await adoptFrozenBaseline(sql, baseline)) {
      console.log(
        'drizzle: adopted the frozen baseline as applied (existing schema, no Drizzle history)',
      )
    }

    await migrate(drizzle(sql), {
      migrationsFolder: MIGRATIONS_FOLDER,
      migrationsSchema: MIGRATIONS_SCHEMA,
      migrationsTable: MIGRATIONS_TABLE,
    })
    console.log('drizzle: migrations applied')
  } finally {
    await sql.end({ timeout: 5 })
  }
}

try {
  await main()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`db:migrate: ${message}`)
  process.exitCode = 1
}
