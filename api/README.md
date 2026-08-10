# api/README.md

# m-proper API (Rust / Axum)

HTTP API for properties, backed by Supabase Postgres via sqlx.

## Prerequisites

- Rust (stable)
- Postgres connection string (`DATABASE_URL`) from Supabase → Project Settings → Database → **URI**
  (must start with `postgresql://`, not the `https://….supabase.co` project URL)

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

## Regenerate TypeScript client

After changing handlers/schemas:

1. Start the API (or run `cargo run` once) so `api/openapi.json` is refreshed
2. From repo root:

```bash
pnpm run generate:api-client
```

This regenerates/validates `web/src/lib/api-client.ts` from `api/openapi.json`.
