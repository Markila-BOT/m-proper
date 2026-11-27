// web/src/lib/db.ts
/**
 * The request-path Postgres connection: `postgres-js` over the pooled URL,
 * wrapped in Drizzle. Two rules are load-bearing (ADR-0011):
 *
 * - Nothing connects or reads the environment at import time. The pool is
 *   created on first use and a missing `DATABASE_URL` fails that request with a
 *   clear configuration error instead of breaking the module graph.
 * - This URL is pooled, so prepared statements are disabled. Migrations use
 *   `scripts/migrate.ts` and the session-pooler URL; nothing here ever migrates.
 */
import { drizzle } from 'drizzle-orm/postgres-js'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from '../../db/schema.ts'

/** The typed Drizzle handle the route handlers query through. */
export type AppDatabase = PostgresJsDatabase<typeof schema>

/** A small pool: Vercel runs short-lived function instances. */
export const DATABASE_POOL_SIZE = 3

/** Raised when the server environment lacks `DATABASE_URL`. */
export class DatabaseConfigError extends Error {
  readonly missing: string[]

  constructor(missing: string[]) {
    super(
      `The database is not configured: set ${missing.join(', ')}. ` +
        'It must be present in the server environment before the app serves requests.',
    )
    this.name = 'DatabaseConfigError'
    this.missing = missing
  }
}

export interface DatabaseConnection {
  url: string
  client: postgres.Sql
  db: AppDatabase
}

export type DatabaseEnv = Record<string, string | undefined>

/**
 * Reads `DATABASE_URL` when a request needs the database. Reported lazily by
 * design: importing the app must not require a database.
 */
export function readDatabaseUrl(env: DatabaseEnv = process.env): string {
  const url = env.DATABASE_URL?.trim()

  if (!url) {
    throw new DatabaseConfigError(['DATABASE_URL'])
  }

  return url
}

/**
 * Builds the pool and the Drizzle handle. `postgres-js` opens sockets on the
 * first query, not here, so this is safe to call from a request handler.
 */
export function createDatabase(url: string): DatabaseConnection {
  const client = postgres(url, {
    prepare: false,
    max: DATABASE_POOL_SIZE,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => undefined,
  })

  return { url, client, db: drizzle(client, { schema }) }
}

let cached: DatabaseConnection | null = null

/**
 * The process-wide connection for `env`. Rebuilt only when the URL changes, so
 * every request in one function instance shares the same small pool.
 */
export function getDatabase(
  env: DatabaseEnv = process.env,
): DatabaseConnection {
  const url = readDatabaseUrl(env)

  if (cached?.url !== url) {
    cached = createDatabase(url)
  }

  return cached
}

/** Releases the pool. Used by tests and graceful shutdown. */
export async function closeDatabase(): Promise<void> {
  const connection = cached
  cached = null

  if (connection) {
    await connection.client.end({ timeout: 5 })
  }
}

/** The health probe: one trivial round trip, no table access. */
export async function checkDatabase(
  connection: DatabaseConnection = getDatabase(),
): Promise<void> {
  await connection.client`select 1`
}
