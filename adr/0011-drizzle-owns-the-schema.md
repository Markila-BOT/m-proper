# 0011 Drizzle owns the schema; hand-authored SQL keeps the security layer

- Status: accepted
- Date: 2026-11-26
- Supersedes: none

## Context and Problem Statement

The only migration runner and the only record of the schema live inside `api/`: `sqlx::migrate!` runs the SQL in `api/migrations/` at boot, and that SQL includes the `auth.users` foreign key, the `owner_id` backfill `DO` block, the RLS policies, and the `revoke all … from anon, authenticated`. Deleting the Rust service removes the runner, the history, and the runbook in `api/README.md`, while Supabase Postgres already carries the applied schema and rows. Something must own the schema afterwards, and it must not silently drop the security layer that ADR-0008 depends on.

## Considered Options

- **Raw SQL files with a small runner**: maximal fidelity to the existing SQL; no typed schema, and a hand-written migration tool.
- **Drizzle's schema as the source of truth, generated with `drizzle-kit push`**: strong typing and no SQL files; `push` derives changes from the TypeScript schema, which cannot express RLS policies, grants, or `DO` blocks and would emit drops for them.
- **Drizzle for types and queries, SQL files as the migration unit**: typed schema and queries; migrations stay SQL, including the hand-authored security statements; a frozen baseline reproduces the applied schema.
- **Keep sqlx**: not available once the Rust service is deleted.

## Decision Outcome

Chosen option: "Drizzle for types and queries, SQL files as the migration unit".

- `db/schema.ts` describes `properties` for typing and queries. It is not the sole authority on the database.
- `db/migrations/` holds SQL. A **frozen baseline** reproduces the schema as already applied and is recorded as applied in Drizzle's journal, so a fresh database and an existing one converge without re-creating tables.
- RLS policies, the `revoke all … from anon, authenticated`, the `auth.users` reference, and the backfill `DO` block stay hand-authored in the migration. `drizzle-kit push` MUST NOT be pointed at Supabase.
- Migrations run through a dedicated script over the **direct** (non-pooled) connection, never at build time and never on a request. The app's runtime connection is pooled.
- The baseline is proven by applying it to a scratch database and diffing the catalog against the live one.

## Pros and Cons

- Positive: typed queries without surrendering the security layer; one migration history outside the deleted crate; an existing database needs no reset.
- Negative: two mental models during the cutover (sqlx history, Drizzle journal); drift between `db/schema.ts` and the SQL is possible and must be reviewed; local development and the acceptance harness gain a migrate step that `cargo run` used to perform implicitly.
- Follow-up: `server-transactions` and `payment-reminders` must express their tables as Drizzle schema plus SQL migrations and rebase before they apply.
