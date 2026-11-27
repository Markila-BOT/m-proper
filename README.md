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
(transaction pooler), `SUPABASE_URL`, `SUPABASE_JWKS_URL`,
`SUPABASE_JWT_ISSUER`, and `SUPABASE_JWT_AUD`. Migrations and the pre-release
dump also need `DIRECT_DATABASE_URL`, the session-pooler connection on port
5432.

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
| `pnpm --filter web db:migrate` | Apply Drizzle migrations over the session pooler |
| `pnpm deploy:check` | Validate `deploy/production.json` and the production environment |
| `pnpm release` | Run the gated production release: gates, backup, migrate, advance, smoke |
| `pnpm smoke:production` | Run the post-deploy live smoke against the production origin |
| `pnpm test:specs` | Run the main-spec acceptance profile |
| `pnpm lint:specs` | Extract and lint the Gherkin specs |
| `pnpm seed:auth` | Create or find the bootstrap and test owners |
| `pnpm test:scripts` | Unit-test the root scripts |

## Production

Production runs on **Vercel Hobby** and **Supabase Free** for now. The checked
declaration is [`deploy/production.json`](deploy/production.json); the
deployment check refuses a paid plan, a wildcard origin, or an inconsistent
connection split.

- **Origin:** `https://m-proper.vercel.app` (the assigned value is recorded in
  the declaration).
- **Data plane:** `m-proper-prod` in `ap-southeast-1`. The app uses the
  transaction pooler on 6543; `db:migrate` and the pre-release `pg_dump` use the
  session pooler on 5432.
- **Release:** the `release` branch is production; `master` only produces
  previews. Run the manual Release workflow (or `pnpm release` from a
  prepared operator environment). It runs the gate, takes and stores the
  pre-release dump, migrates, fast-forwards `release`, waits for the Vercel
  deployment whose commit matches, and runs the live smoke.
- **Rollback:** use Vercel's instant rollback to the previous deployment.
  Migrations are forward-only; revert or forward-fix `master` before the next
  release.
- **Free-tier limits:** the project pauses after seven days without activity
  (the five-minute uptime monitor on `/api/health` keeps it active), has no
  automated backups (the pre-release dump is the copy), and has a 500 MB
  database limit. Upgrade to Pro plus the IPv4 add-on when a limit is reached.
- **Private phase:** production sign-up is closed and the first landlord
  account is created by an operator. `auth-captcha` and a verified sending
  domain are the follow-up that opens public sign-up.

## Legacy decommission

`general-ledger` is superseded by this repository. Before deleting its Vercel
project and GitHub repository, export `git bundle create --all`, record the
digest and an off-machine copy, and confirm the Vercel project owns no live
domain (`general-ledger-two.vercel.app` is already gone;
`general-ledger.vercel.app` is a different project). Delete only after the
domain check and an explicit confirmation. `m-property` is untouched.

## Env

- `web/.env` — local development values. See the environment contract in
  [`web/README.md`](web/README.md) for every name. `VITE_`-prefixed values are
  public and reach the browser; every other value stays server-side.
