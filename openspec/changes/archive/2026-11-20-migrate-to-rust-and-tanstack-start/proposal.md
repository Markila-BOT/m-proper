## Why

m-proper's current stack (Bun/Hono SPA) is a thin starter that no longer matches the intended long-term architecture. The API surface is still small (properties CRUD only; transactions remain in localStorage), so now is the cheapest moment to move to a Rust domain API and a TanStack Start frontend without rewriting a large product.

## What Changes

- **BREAKING**: Replace the Hono/Bun server with a Rust (Axum) HTTP API as the system of record for server-backed resources
- **BREAKING**: Replace the Vite React SPA (`client/`) with a TanStack Start app (Router + Query; Start server functions stay thin — domain logic lives in Rust)
- Access Postgres via **sqlx** using Supabase's `DATABASE_URL` (keep Supabase as hosted Postgres; drop server-side `@supabase/supabase-js`)
- Preserve existing properties HTTP behavior (list / create / delete) and JSON response shape during the cutover
- Strangler migration: stand up Rust + Start alongside the old stack, then remove Hono and the Vite client once parity is verified
- Replace the TypeScript `shared/` package as the cross-boundary contract with an OpenAPI-generated (or equivalent) TypeScript client from the Rust API
- Update monorepo tooling so Cargo (Rust) and the Start app coexist (workspaces / scripts)

## Capabilities

### New Capabilities

- `properties`: HTTP API for creating, listing, and deleting properties persisted in Postgres
- `web-app`: TanStack Start web client that talks to the Rust API for properties and retains existing client-only transaction UX for this change

### Modified Capabilities

- (none — `openspec/specs/` is empty; behavior is being captured as new specs)

## Impact

- **Removed / replaced**: `server/` (Hono), Vite-based `client/`, Bun-centric shared type package as API contract, server `@supabase/supabase-js`
- **Added**: Rust Axum service, sqlx + migrations, TanStack Start app, OpenAPI → TS client pipeline
- **Unchanged in this change**: Postgres schema hosting on Supabase, transaction localStorage behavior, auth/RLS redesign, multi-user features
- **Follow-up (out of scope)**: Move transactions off localStorage onto the Rust API
