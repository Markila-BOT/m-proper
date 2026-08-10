## Context

See proposal.md for motivation. Today: Hono/Bun server with three properties routes via `@supabase/supabase-js`; Vite React SPA with React Query; transactions in `localStorage`; empty `openspec/specs/`. Target architecture **A**: TanStack Start as UI shell, Rust Axum as the domain API, sqlx against Supabase Postgres.

## Goals / Non-Goals

**Goals:**
- Stand up Axum + sqlx with properties parity (list/create/delete, same JSON envelope)
- Stand up TanStack Start app that consumes the Rust API; migrate existing UI incrementally
- Strangler: old and new stacks can run side-by-side until cutover
- Establish OpenAPI (or equivalent) → TypeScript client so `shared/` is no longer the API contract
- Document monorepo layout for Cargo + Start

**Non-Goals:**
- Moving transactions to the server
- Auth, RLS hardening, or multi-tenant redesign
- Using TanStack Start server functions as the domain layer (BFF)
- Perfect ID strategy rewrite (may keep UUID for parity; schema TODO can be a follow-up)

## Decisions

### 1. Architecture A — Start shell, Rust owns domain
- **Choice**: Browser/Start calls Rust over HTTP/JSON. Start server functions are not the source of business logic.
- **Why**: Matches “server should be Rust”; avoids splitting domain across two backends.
- **Alternatives**: B (Start BFF → Rust), C (defer Rust, Start + sql only). Rejected for this change.

### 2. Axum + sqlx + Tokio
- **Choice**: Axum for HTTP; sqlx for Postgres; Tokio runtime.
- **Why**: Default Rust web stack; compile-time checked SQL; natural fit with Supabase connection string.
- **Alternatives**: Actix, SeaORM, PostgREST-via-HTTP. Actix fine but Axum is ecosystem-default; SeaORM adds ORM weight; PostgREST duplicates current JS client awkwardness in Rust.

### 3. Supabase as hosted Postgres only (for server)
- **Choice**: `DATABASE_URL` from Supabase; no server-side supabase-js.
- **Why**: Idiomatic Rust data access; keep Supabase hosting/Auth/Storage options for later.
- **Note**: Existing RLS policy (“allow all”) remains until a dedicated auth change.
- **Gotcha**: Use the Database **URI** (postgresql://…), not the Project URL (https://….supabase.co).

### 4. Response/contract parity during cutover
- **Choice**: Keep current envelope `{ success, message, data? }` and camelCase JSON field names on the wire.
- **Why**: Lets Start (or temporary Vite client) swap base URL without rewriting UI mappers.
- **Alternatives**: Redesign API now — deferred to reduce migration risk.

### 5. Type sharing via OpenAPI
- **Choice**: Annotate Axum handlers (e.g. utoipa) → OpenAPI → generate TS client for Start.
- **Why**: Survives polyglot monorepo; replaces `shared/` for API types.
- **Alternatives**: ts-rs only, or hand-sync. Hand-sync OK briefly during spike; OpenAPI is the lasting contract. ts-rs acceptable interim if OpenAPI slows first milestone.

### 6. Monorepo layout
- **Choice**: Keep repo root; add Cargo project (e.g. `api/` or replace `server/` after cutover); new Start app (e.g. `web/` or replace `client/` after cutover). Prefer new dirs during strangler, then delete old.
- **Why**: Parallel run without breaking `bun run dev` until ready.
- **Scripts**: Root scripts for `dev:api` (cargo watch), `dev:web` (Start), keep old scripts until removal.

### 7. Frontend: TanStack Start, Query retained
- **Choice**: File-based routes; reuse React Query patterns; port components (Summary, sidebar, forms, etc.) rather than redesign UI.
- **Why**: Already on Query; Start is Router + SSR optional. For a private dashboard, SSR can stay minimal — Start still chosen for long-term full-stack React story.
- **CORS**: Rust must allow Start origin in dev.

### 8. Package manager: pnpm (not Bun)
- **Choice**: Use pnpm for the JS/TS workspace (`web/`, root scripts). Drop Bun as the primary package manager.
- **Why**: TanStack Start scaffolding/docs lean pnpm; clearer Node-native tooling for Vite/Start; Bun was an artifact of the old bhvr template.
- **Alternatives**: Keep Bun — fine for speed, but adds a second runtime story next to Rust with no strong need.

## Risks / Trade-offs

- **[Polyglot complexity]** → Mitigation: clear package boundaries; one API contract (OpenAPI); document env vars in README.
- **[Parity bugs during strangler]** → Mitigation: golden request/response fixtures from current Hono routes; smoke-test same three endpoints.
- **[sqlx vs existing schema]** → Mitigation: start with existing `properties` table; migrations only when schema must change.
- **[Start learning curve]** → Mitigation: port routes/components incrementally; keep Vite client until Start has property CRUD working.
- **[Losing shared TS constants early]** → Mitigation: duplicate PROPERTY_TYPE enums in Rust + generated/client constants until OpenAPI covers them.

## Migration Plan

1. Scaffold Axum + sqlx; implement properties routes; verify against Supabase (or local Postgres).
2. Point existing Vite client `API_BASE_URL` at Rust; confirm UI parity (optional mid-step).
3. Scaffold TanStack Start; wire generated/hand TS client; port property UI first, then remaining screens.
4. Remove Hono `server/` and Vite `client/` when Start + Rust are default `dev`/`build`.
5. Archive/update OpenSpec main specs on change archive.
6. **Rollback**: Keep old stack in git until cutover commit; revert root scripts / dirs if needed. DB schema unchanged for rollback of API layer.

## Open Questions

- Exact directory names (`api` vs `server-rs`, `web` vs `apps/web`) — decide at scaffold time.
- Whether first milestone ships full OpenAPI codegen or hand-typed client with OpenAPI in milestone 2.
- Dev ports: Rust (e.g. 3000) vs Start (e.g. 3001) — document in README when chosen.
