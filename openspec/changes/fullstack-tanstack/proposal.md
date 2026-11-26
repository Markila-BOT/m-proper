# fullstack-tanstack

## Why

Two routes are served by two servers in two languages: a Rust Axum API that owns the HTTP contract and the data boundary, and a TanStack Start app that already owns identity, sessions, and every page. That second server is what blocks deployment — it cannot run on the platform the web uses, so it needs its own host, CORS, a hand-maintained client generated from an OpenAPI document, and a Bearer token readable from JavaScript. Landing this before the queued changes is the smallest surface: all three of them are written against the Rust API, so landing them first grows this one.

## Precondition

`landlord-accounts` MUST be archived before this change applies, so its `web-app` and `authentication` deltas are synced into `openspec/specs/`. Both changes would otherwise be authoritative for the same rules at once, which the suite's composition refuses. This is task 0.

## What Changes

- Serve the properties contract from TanStack Start server routes on the app's own origin: `GET`/`POST /api/properties`, `DELETE /api/properties/:id`, and `GET /api/health`. The envelope `{ success, message, data? }`, every status code (200/201/400/401/404/500/503), and every validation rule (required name/address/type, `residential|commercial|lot`, `units >= 0`, unparsable id is 400) are preserved. Two behaviours are explicit obligations, not accidents: `DELETE /api/properties` with no id MUST still answer the 400 envelope, and an unknown `/api/*` path MUST answer the JSON envelope rather than the app's HTML not-found page. **Message text is not contractual**; the envelope and status are.
- Ownership is unchanged from ADR-0008: the owner predicate stays in the query, a foreign row is 404 exactly like an unknown one, and a body `ownerId` is ignored.
- **BREAKING**: identity for those routes comes only from the Supabase session cookie on the same origin. A `jose` verifier ports the JWKS policy — ES256 only, pinned `iss`/`aud`, expiry with leeway, UUID `sub`, `authenticated` role, no anonymous claim, one refetch on an unknown `kid`, 401 for a bad token and 503 fail-closed for an unreachable key set. The cookie contract is part of the work: the `sb-<ref>-auth-token` name, chunk assembly, and a malformed cookie answering 401 rather than throwing. The `Authorization: Bearer` path, the CORS layer, and browser token handling are removed.
- **BREAKING**: cookie identity introduces a CSRF surface that a Bearer header did not have. The change MUST set `Secure` and `SameSite=Lax` on the session cookies and MUST reject a state-changing `/api` request whose `Origin`/`Sec-Fetch-Site` is not the app's own.
- Drizzle replaces sqlx: a TypeScript schema, typed owner-scoped queries, and `drizzle-kit` migrations. The existing SQL is **moved, not re-derived**: RLS policies, the `revoke all … from anon, authenticated`, the `auth.users` foreign key, and the backfill `DO` block stay hand-authored because `drizzle-kit` cannot model them and would emit drops. A baseline equal to the live schema is frozen and marked applied in Drizzle's journal; `drizzle-kit push` MUST NOT be run against Supabase. Migrations run as an explicit step over the direct (non-pooled) connection — never at build time and never on a request — so local development and the acceptance harness gain a migrate step that `cargo run` used to perform implicitly.
- **STRANGLER CUTOVER**: the Node routes are built beside the Rust API, the web and the acceptance harness switch to them, the parity matrix below is proven against the real database, and only then is `api/` deleted.
- **BREAKING**: deleting `api/` removes the Cargo crate, its migrations, its unit tests and the DB-gated `tests/ownership.rs`, `openapi.json`, the Swagger UI, `api/README.md`, and the root `dev:api` / `build:api` scripts.
- **BREAKING**: `openapi.json` and `scripts/generate-api-client.ts` are retired. The domain types and the Drizzle schema become the contract; the route handlers and the client share them so the type check fails on drift. The client keeps its envelope parsing and loses the base URL, the Bearer header, the retry-on-401 path, and the runtime base-URL override — the unreachable state is now driven from the test side.
- The acceptance suite owns one process instead of two, authenticates its HTTP steps with the session cookie, and gains a second app instance with a sabotaged environment for the config-refusal and JWKS-outage probes.
- The app becomes deployable: a Nitro/Vercel target (a new direct dependency), one documented environment contract, and `/api/health` kept as a database **readiness** answer (503 when Postgres is unreachable), not a liveness probe. Creating the production project, SMTP, CAPTCHA, DNS, and the deploy itself are a later change.
- `openspec/config.yaml`'s "Architecture A: Start is UI shell only — business logic lives in Rust" is superseded. A new decision record supersedes ADR-0007 wholly and restates what survives: Supabase Auth as the provider, ES256-only verification, the claim checks, publishable-key-only in the browser, and the 401/503 envelope. ADR-0007's ten-minute cache rationale rested on an edge cache that no longer exists, so the cache rule is re-based or dropped rather than copied.
- `server-transactions` and `payment-reminders` are not rewritten here; they are rebased onto the Node routes and the Drizzle schema before they apply.

## Parity definition of done (before `api/` is deleted)

- Envelope and status for list, create, delete, delete-without-id, and an unknown `/api/*` path.
- Validation: missing fields, the type enum, negative `units`, and an unparsable id.
- Ownership: body owner ignored; list scoped; a foreign delete answers 404 identically to an unknown id; the serialized property carries no owner; cross-owner isolation, ported from `tests/ownership.rs`.
- Auth: a valid cookie, no cookie, a tampered cookie, an expired token, a wrong issuer/audience/role, an anonymous user, and a JWKS outage answering 503.
- The Data API stays closed (no grant for `anon` or `authenticated`).
- The Rust unit tests for validation and the auth decision table exist in Node before the crate is deleted.

## Capabilities

### New Capabilities

- `deployable-artifact`: the production build serves pages and `/api` routes, answers 401/503 on them, fails before serving when a required variable is missing, and ships a client bundle with only public values.

### Modified Capabilities

- `authentication`: the token travels in the session cookie; the verifier's claim rules survive, the Bearer and CORS rules are withdrawn, and the configuration requirement becomes the app's fail-fast server-side environment.
- `web-app`: same-origin calls with no configured API host and no runtime override; the session requirement keeps its name but is now cookie transport with server-owned refresh.
- `acceptance-suite`: one process under test, cookie-authenticated HTTP steps, a second sabotaged instance for config and JWKS probes, and a migrate step before scenarios.
- `dependency-maintenance`: `api/Cargo.toml` leaves the manifest scan, the OpenAPI-regeneration gate is replaced by shared-type checking plus the round-trip, and the Rust check gate becomes the TypeScript and build gates.

`properties` is deliberately not listed: its main spec names no path, only an endpoint, an envelope, and ordering/validation rules, all preserved.

## Non-goals

- No product behaviour change beyond the transport and the CSRF control it requires: no update route, no new fields, no ledger or reminders implementation.
- No production provisioning or deploy: Supabase project creation, SMTP, CAPTCHA, DNS, and the first release belong to a later change.
- No data migration: schema reconciliation only, and no row is re-imported, reshaped, or backfilled.
- No dual-write and no permanent fallback; Rust is deleted, not shadowed behind a flag.
- No API for non-browser clients — no API keys or machine tokens.
- No rewrite of `server-transactions` or `payment-reminders`.
- No observability build-out beyond `/api/health` and logs.
- No rework of the auth flows themselves.

## Impact

- **Code** — `api/` deleted in full; new Start server routes, an identity verifier and cookie parser, a Drizzle schema and migration set, and a migrate script; `web/src/lib/api-client.ts` simplified; root scripts lose the Cargo and generator entries.
- **APIs** — paths move under `/api`; the envelope, status codes, and validation are unchanged; `/swagger-ui` and `/api-docs/openapi.json` disappear.
- **Dependencies** — adds Drizzle, `drizzle-kit`, a Postgres driver, `jose`, and the Nitro target to the Node side; the Rust toolchain leaves the build, test, and CI path.
- **Data** — the applied schema, its policies, and its grants must be reproduced exactly; a drift is a silent correctness bug, not a build error.
- **Acceptance** — one process, cookie-auth steps, a migrate step, and sabotaged-instance probes.
- **Deploy** — pooled connections and a per-instance JWKS cache make a cold start pay both; `/api/health` costs a database round trip per probe.
- **Docs and rules** — `openspec/config.yaml`, a superseding ADR, the glossary, and both READMEs.
- **Losses** — the generated OpenAPI contract, compiled route shapes, the Rust unit tests, and the DB-gated ownership test. Compensation is the ported tests, the shared types, and the parity matrix above.

## Risks accepted

- Parity regressions in validation and status codes that only the suite catches.
- Drizzle disagreeing with the schema `_sqlx_migrations` applied, and `drizzle-kit` emitting a destructive statement if it is ever pointed at the live schema.
- Serverless Postgres: pooler mode, disabled prepared statements, and cold-start latency the Rust process never had.
- Cookie chunking and `${localhost}` vs `127.0.0.1` scope producing a 401 that appears in one environment only.
- Cross-site requests against cookie-authenticated routes if the CSRF control is incomplete.
- A cookie-only API: nothing outside a browser session can call the routes.
- Treating `/api/health` as a liveness probe and restarting a healthy process during a database outage.
