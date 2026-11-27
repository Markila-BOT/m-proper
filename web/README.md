# m-proper web

TanStack Start UI for m-proper. Calls the properties routes on its own origin (`/api/properties`, `/api/properties/:id`) with the browser's session cookie, so no API host is configured.

## Develop

```bash
# from repo root
pnpm install
pnpm dev
# http://localhost:3001
```

## Build

```bash
pnpm build
```

`vite build` runs TanStack Start behind Nitro (`nitro/vite`). It emits a Node
server at `.output/server/index.mjs` and client assets under `.output/public`,
which is the output the deployment target runs locally:

```bash
node .output/server/index.mjs
```

On Vercel, Nitro detects the platform and writes the Build Output API tree to
`.vercel/output` instead. The Vercel project's **Root Directory must be `web`**,
so that tree lands where Vercel looks for it. `web/vercel.json` pins the
framework to `tanstack-start` because listing `nitro` directly in
`package.json` would otherwise make Vercel's detector choose the standalone
Nitro framework and run `nitro build` instead of `vite build`.

Migrations are a separate operator/CI step (`pnpm --filter web db:migrate`);
they never run during the build or from a request.

## Environment contract

The app reads two groups of variables. Local development loads `web/.env`;
production reads only the platform's environment. Vite exposes `VITE_`-prefixed
names to the browser, so **no server-only name may be `VITE_`-prefixed**.

### Public — browser (`VITE_`)

Bundled into the client and safe to publish:

| Name                     | Purpose                                  |
| ------------------------ | ---------------------------------------- |
| `VITE_SUPABASE_URL`      | Supabase project URL used by the browser |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable (anon) key          |

These two values are the only configuration the browser bundle carries.

### Server-only — never `VITE_`-prefixed

Required at boot; `src/start.ts` refuses to serve and names every absent one:

| Name                   | Purpose                                                     |
| ---------------------- | ----------------------------------------------------------- |
| `DATABASE_URL`         | Pooled Postgres URL used by the request path                |
| `SUPABASE_URL`         | Project URL; its host also names the session cookie         |
| `SUPABASE_JWKS_URL`    | JWKS endpoint used to verify access tokens                  |
| `SUPABASE_JWT_ISSUER`  | Expected token issuer                                       |
| `SUPABASE_JWT_AUD`     | Expected token audience                                     |

Needed only by the migrate step, never by the running app:

| Name                  | Purpose                                                       |
| --------------------- | ------------------------------------------------------------- |
| `DIRECT_DATABASE_URL` | Session-pooler Postgres URL on 5432 for `db:migrate` and dumps |

`DATABASE_URL` is deliberately not a fallback for migrations: the transaction
pooler on 6543 is not a valid migration target. On the Free plan the IPv6-only
direct host is not used; the session pooler is the IPv4-reachable migration
connection.

## Production

Production is Vercel Hobby plus Supabase Free. The app runs in `sin1`; the
production branch is `release`, and `master` produces previews only. The checked
declaration is [`../deploy/production.json`](../deploy/production.json), and the
release/rollback runbook is in the [root README](../README.md).

Free-tier limits are deliberate: the project pauses after seven days without
activity (the uptime monitor on `/api/health` keeps it active), has no automated
backups (the release takes a `pg_dump` before migrating), and has a 500 MB
database limit. Production sign-up is closed during the private phase; the
first landlord account is created by an operator.

## Lint / format

```bash
pnpm --filter web lint
pnpm --filter web format
pnpm --filter web check
```
