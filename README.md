# m-proper

Landlord property income/expense tracker.

## Stack

| Layer | Tech |
|-------|------|
| App | TanStack Start · React Query · Tailwind |
| Data | Drizzle → Supabase Postgres |
| Auth | Supabase Auth · session cookie |
| JS tooling | **pnpm** workspace (`web/`) |

## Quick start

### 1. Install

```bash
pnpm install
```

### 2. Configure

```bash
cp web/.env.example web/.env
```

Fill in the public Supabase values, then add the server-only names from the
environment contract in [`web/README.md`](web/README.md): `DATABASE_URL`
(pooled), `SUPABASE_URL`, `SUPABASE_JWKS_URL`, `SUPABASE_JWT_ISSUER`, and
`SUPABASE_JWT_AUD`. Migrations also need `DIRECT_DATABASE_URL`, the non-pooled
connection.

### 3. Migrate

Migrations are an explicit step; they never run during the build or from a
request.

```bash
pnpm --filter web db:migrate
```

### 4. Run

```bash
pnpm dev
# http://localhost:3001
```

The app serves its pages and the `/api` routes on one origin.

## Scripts

| Script | Purpose |
|--------|---------|
| `pnpm dev` | Start the app on port 3001 |
| `pnpm build` | Production build (Nitro output in `web/.output`) |
| `pnpm --filter web db:migrate` | Apply Drizzle migrations over the direct connection |
| `pnpm seed:auth` | Create or find the bootstrap and test owners |
| `pnpm test:scripts` | Unit-test the root scripts |

## Env

- `web/.env` — local development values. See the environment contract in
  [`web/README.md`](web/README.md) for every name. `VITE_`-prefixed values are
  public and reach the browser; every other value stays server-side.
