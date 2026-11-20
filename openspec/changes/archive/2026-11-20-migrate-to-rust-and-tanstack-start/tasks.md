## 1. Rust API scaffold

- [x] 1.1 Create Cargo project at `api/` (Axum + Tokio + serde + tower-http CORS + dotenvy)
- [x] 1.2 Add sqlx with Postgres runtime; load `DATABASE_URL` from env; health check connection on startup
- [x] 1.3 Add root/dev scripts for `dev:api` (e.g. cargo watch) and document required env vars
- [x] 1.4 Define shared JSON envelope types (`success`, `message`, `data`) and property DTOs matching current camelCase wire format

## 2. Properties API parity

- [x] 2.1 Implement `GET /properties` with active-first, created_at-desc ordering via sqlx
- [x] 2.2 Implement `POST /properties` with validation (required fields + type enum) and 201/400 responses
- [x] 2.3 Implement `DELETE /properties/:id` with 400 when id missing and success envelope on delete
- [x] 2.4 Enable CORS for local Start/Vite origins; smoke-test all three endpoints against Supabase Postgres
- [x] 2.5 (Optional mid-step) Point existing Vite `API_BASE_URL` at Rust and confirm UI still works

## 3. API contract for TypeScript

- [x] 3.1 Add OpenAPI annotations (utoipa or equivalent) for properties endpoints and export `openapi.json`
- [x] 3.2 Generate or hand-maintain a TypeScript client consumed by the web app (codegen preferred once OpenAPI is stable)
- [x] 3.3 Document how to regenerate the client after API changes

## 4. TanStack Start web app

- [x] 4.1 Scaffold TanStack Start app at `web/` with React Query and configurable API base URL env
- [x] 4.2 Port layout shell (header, sidebar/property list, navigation tabs) from `client/`
- [x] 4.3 Wire property list/create/delete to the Rust API client; verify refresh-after-mutation
- [x] 4.4 Port transaction UI + localStorage persistence (forms, filters, summary, CSV export) without a transactions API
- [x] 4.5 Add root scripts for `dev:web` / `build:web` and dual-dev with `dev:api`

## 5. Cutover and cleanup

- [x] 5.1 Make Start + Rust the default `dev`/`build` entrypoints in root `package.json` / README
- [x] 5.2 Remove Hono `server/` and Vite `client/` (and unused Bun shared API types) once parity is verified
- [x] 5.3 Update `openspec/config.yaml` context with the new stack (Rust/Axum, TanStack Start, sqlx, Supabase Postgres)
- [x] 5.4 Final smoke: properties CRUD via UI + transactions still persist across reload
- [x] 5.5 Switch JS package manager from Bun to pnpm (`pnpm-workspace.yaml`, root scripts, lockfile)
