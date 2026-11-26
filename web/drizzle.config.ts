// web/drizzle.config.ts
/**
 * drizzle-kit configuration.
 *
 * `db:generate` writes SQL into `db/migrations`; `db:migrate` (see
 * `scripts/migrate.ts`) applies it. `drizzle-kit push` MUST NOT be run against
 * Supabase: it would derive DDL from `db/schema.ts` and drop the hand-authored
 * RLS policies, grant revokes, and the backfill block ADR-0011 requires.
 *
 * Only the migration commands need a connection string. It is read from
 * `DIRECT_DATABASE_URL` — the direct (non-pooled) connection — and the migrate
 * script refuses to fall back to the pooled `DATABASE_URL`.
 */
import { defineConfig } from 'drizzle-kit'

import { loadServerEnv } from './src/lib/server-env.ts'

// A direct run reads web/.env so `db:generate`/`db:migrate` work without
// exported variables. Production takes the platform's environment only.
if (process.env.NODE_ENV !== 'production') {
  loadServerEnv()
}

const directUrl = process.env.DIRECT_DATABASE_URL ?? ''

export default defineConfig({
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: directUrl },
  migrations: { schema: 'drizzle', table: '__drizzle_migrations' },
  strict: true,
  verbose: true,
})
