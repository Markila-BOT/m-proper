# m-proper

Landlord property income/expense tracker.

## Stack

| Layer | Tech |
|-------|------|
| API | Rust · Axum · sqlx → Supabase Postgres |
| Web | TanStack Start · React Query · Tailwind |
| JS tooling | **pnpm** workspaces (`web/`) |

## Quick start

### 1. API

```bash
cp api/.env.example api/.env
```

In Supabase: **Project Settings → Database → Connection string → URI**  
Paste a `postgresql://…` value (not the `https://….supabase.co` project URL).

```bash
pnpm run dev:api
# http://localhost:3000
# Swagger: http://localhost:3000/swagger-ui
```

### 2. Web

```bash
cp web/.env.example web/.env   # optional; defaults to http://localhost:3000
pnpm install
pnpm run dev:web
# http://localhost:3001
```

### Both

```bash
pnpm run dev
```

### Generate / validate API client

```bash
pnpm run generate:api-client
```

See `api/README.md` for details.

## Scripts

| Script | Purpose |
|--------|---------|
| `pnpm run dev` | Rust API + TanStack Start |
| `pnpm run dev:api` | Axum with cargo-watch |
| `pnpm run dev:web` | Start on port 3001 |
| `pnpm run build` | Release API + web production build |
| `pnpm run generate:api-client` | Validate OpenAPI → stamp TS client |

## Env

- `api/.env` — `DATABASE_URL` (**postgresql://** URI, required), `PORT` (default 3000)
- `web/.env` — `VITE_API_BASE_URL` (default `http://localhost:3000`)
