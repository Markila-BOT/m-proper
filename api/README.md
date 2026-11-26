# api/README.md

# m-proper API (Rust / Axum)

HTTP API for properties, backed by Supabase Postgres via sqlx.

## Prerequisites

- Rust 1.85+ / Rust 2024 edition
- Postgres connection string (`DATABASE_URL`) from Supabase → Project Settings → Database → **URI**
  (must start with `postgresql://`, not the `https://….supabase.co` project URL)
- `sqlx-cli` for manual migration commands:

```bash
cargo install sqlx-cli --features postgres
```

## Setup

```bash
cp .env.example .env
# edit DATABASE_URL
```

## Run

From repo root:

```bash
pnpm run dev:api
```

Or:

```bash
cd api && cargo run
```

Default listen address: `http://localhost:3000`

- Health: `GET /health`
- Swagger UI: `http://localhost:3000/swagger-ui`
- OpenAPI JSON: `http://localhost:3000/api-docs/openapi.json` (also written to `api/openapi.json` on startup)

The API runs embedded SQLx migrations from `api/migrations/` during startup. To run them manually:

```bash
cd api && sqlx migrate run
```

## Recovering from the owner backfill abort

`20261125000000_properties_owner_id.sql` gives every property an owner. Existing
rows are assigned to the **Bootstrap owner** (`owner@m-proper.test` by default,
see `scripts/seed-auth.ts` and `design.md` §5). The migration looks that account
up in `auth.users`; if any row is still unowned and the account is missing, it
stops with:

```
ERROR: properties.owner_id backfill aborted: N row(s) have no owner but the
bootstrap owner owner@m-proper.test is absent from auth.users. Seed it, then
rerun this migration: ... pnpm run seed:auth ...
HINT:  The migration never assigns rows to another account; it aborts instead.
```

That abort is deliberate. The migration will not pick "any user" to satisfy
`NOT NULL`, because that would hand one landlord another landlord's records.
Production starts with no property rows, so the branch never runs there; it only
fires in local or acceptance environments that already hold data.

SQLx runs each migration in a transaction, so the abort rolls the whole file
back: no `owner_id` column, index, policy, or revocation is left behind. The
recovery is therefore:

1. Create the bootstrap owner (or confirm its email), using the service role
   key from your shell — never from a checked-in file:

   ```bash
   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
   SEED_OWNER_PASSWORD=... SEED_A_PASSWORD=... SEED_B_PASSWORD=... \
   pnpm run seed:auth
   ```

   `SEED_OWNER_EMAIL` may be set to a different address; if you do, use the same
   address in the SQL below.

2. Rerun the migration:

   ```bash
   cd api && sqlx migrate run
   ```

If the migration has already been applied elsewhere and you are repairing data
instead, the same lookup and assignment run by hand are:

```sql
-- 1. Find the owner. Expect exactly one row; no row means the seed step has not run.
select id from auth.users where lower(email) = lower('owner@m-proper.test');

-- 2. Assign only the unowned rows to that account. Never omit the subquery's
--    email or substitute "some user": an owner is chosen by identity, not guessed.
update properties
   set owner_id = (
       select id from auth.users where lower(email) = lower('owner@m-proper.test')
   )
 where owner_id is null;

-- 3. Only after the update affects every unowned row (0 remaining):
alter table properties alter column owner_id set not null;
```

The Data API stays closed to this table independently of the backfill: the
migration enables RLS with `owner_id = auth.uid()` policies and revokes all
privileges on `properties` from `anon` and `authenticated`. The API keeps
working because it connects as the table owner, which bypasses RLS.

## Real-database ownership test

`tests/ownership.rs` proves the ownership rules that only a real database can
show: a listing scoped to one owner never returns another owner's row, a delete
with the wrong owner bound matches zero rows, the owning delete removes exactly
one, `properties.owner_id` is `NOT NULL`, the `anon`/`authenticated` grants are
gone, and no permissive policy remains on `properties`.

The test is `#[ignore]`d and reads `DATABASE_URL` from the process environment
only — never `api/.env` — so plain `cargo test` stays offline and green. Run it
explicitly:

```bash
cd api
DATABASE_URL='postgresql://…' \
TEST_OWNER_A_ID='…' TEST_OWNER_B_ID='…' \
cargo test --test ownership -- --ignored
```

`TEST_OWNER_A_ID` and `TEST_OWNER_B_ID` are the `ownerAId` / `ownerBId` values
printed by `pnpm run seed:auth`. Apply the migrations first
(`sqlx migrate run`), otherwise the policy check still sees the pre-existing
permissive policy that `20261125000001_properties_drop_permissive_policy.sql`
drops.

The test creates only its own rows, named `ownership-test-<tag>-…`, and deletes
exactly those even when an assertion fails. It never reads, updates, or deletes
an existing row such as `Colinas Verdes`. A missing `DATABASE_URL` or either
owner id prints a skip notice and passes.

## Check

```bash
cd api
cargo check
cargo clippy -- -D warnings
cargo test
```

## Regenerate TypeScript client

After changing handlers/schemas:

1. Export the OpenAPI document (no database or port needed):

```bash
cd api && cargo run -- --dump-openapi
```

   A normal `cargo run` also refreshes `api/openapi.json` on startup.
2. From repo root:

```bash
pnpm run generate:api-client
```

This regenerates/validates `web/src/lib/api-client.ts` from `api/openapi.json`.

The document declares a global `bearer_auth` (HTTP bearer, JWT) security scheme;
every `/properties` operation requires it and documents the `401` and `503`
envelopes. `GET /health` opts out with an empty `security` requirement.
