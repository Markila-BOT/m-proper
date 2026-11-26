# Tasks

## 0. Precondition

- [x] 0.1 Archive `landlord-accounts` so its `web-app` and `authentication` deltas are synced into `openspec/specs/`, then run `openspec validate fullstack-tanstack` and confirm no two active changes supersede the same rule

## 1. Schema foundation (Drizzle)

- [x] 1.1 Add `drizzle-orm`, `drizzle-kit`, and the Postgres driver with explicit ranges; add `db/schema.ts` describing `properties` and its `owner_id` reference
- [x] 1.2 Write the frozen baseline SQL that reproduces the applied schema, including the `auth.users` foreign key, the `owner_id` index, the RLS policies, the `revoke all … from anon, authenticated`, and the backfill `DO` block, with the baseline recorded as applied in Drizzle's journal
- [x] 1.3 Add the migrate script over the direct (non-pooled) connection; it must refuse to run without a direct URL and must never be invoked from the request path or the build
- [x] 1.4 Prove the baseline: apply it to a scratch database, diff the catalog against the live schema, and record the diff as empty (columns, constraints, indexes, policies, grants)
- [x] 1.5 Prove convergence: applying the migrations to a database already carrying the sqlx-applied schema succeeds and re-creates nothing

## 2. Identity (cookie verifier)

- [x] 2.1 Port the JWKS verifier to `jose` with unit tests: ES256 only, pinned `iss`/`aud`, expiry with leeway, UUID `sub`, `authenticated` role, anonymous refused, unknown `kid` refetch once, unreachable key set fails closed
- [x] 2.2 Implement the cookie reader with unit tests: name derivation for `sb-<ref>-auth-token`, chunk assembly (`.0`, `.1`), the legacy unchunked name, and malformed input answering 401 rather than throwing
- [x] 2.3 Implement the session helper that returns the verified identity or a 401/503 result, and the CSRF helper (Origin / Sec-Fetch-Site for POST and DELETE) with a test per verb
- [x] 2.4 Unit-test the authorization matrix that replaces `api/src/auth/tests.rs`: valid, no cookie, tampered signature, expired, wrong issuer, wrong audience, wrong role, anonymous, outage

## 3. Routes

- [x] 3.1 Add `/api/health` answering 200 when Postgres answers and 503 with the envelope when it does not, keeping the process serving
- [x] 3.2 Add `GET /api/properties` scoped to the verified owner, ordered active-first then newest-first, with the envelope and the property shape (no owner on the wire)
- [x] 3.3 Add `POST /api/properties` with the existing validation (required name/address/type, the type enum, `units >= 0`), ignoring any body owner, answering 201 with the created property
- [x] 3.4 Add `DELETE /api/properties/:id` matching id and owner, answering 404 for a foreign or unknown row and 400 for an unparsable id
- [x] 3.5 Add `DELETE /api/properties` (no id) answering the 400 envelope, and a fallback so an unmatched `/api/*` answers the JSON envelope rather than the app's HTML not-found
- [x] 3.6 Integration-test the routes against the real database: cross-owner isolation, body-owner ignored, foreign delete 404 identical to unknown, and the Data API still refusing a direct request

## 4. Web client switch

- [x] 4.1 Point `web/src/lib/api-client.ts` at same-origin `/api` routes; remove the base URL, the Bearer header, the retry-on-401 path, and the runtime base-URL override
- [x] 4.2 Confirm the unreachable state still renders when the routes answer 503 or the request aborts, and that no product code reads the removed override key

## 5. Acceptance harness

- [x] 5.0 Load the server environment in development so `process.env` carries the database URL and the auth variables without exporting them by hand; production reads the platform's environment only

- [x] 5.1 Start one process (the app) instead of two; run the migrate step before scenarios; preflight names the database URL, JWKS location, issuer, and audience
- [x] 5.2 Convert the HTTP helpers from Bearer to a cookie session (the signed-in storage state), and keep the second owner working
- [x] 5.3 Replace the second-API probes: spawn a second app instance with a sabotaged environment for the config-refusal and JWKS-outage scenarios, and stop it afterwards
- [x] 5.4 Convert the forged-token scenarios to forged-cookie scenarios, and re-point the unreachable scenario at the routes rather than the removed override
- [x] 5.5 Run the full change-scoped suite and confirm every scenario and step passes, with no disposable users or probe rows left behind

## 6. Deployable artifact

- [x] 6.1 Add the Nitro Vite plugin and the deployment target; document the environment contract (pooled URL for the app, direct URL for migrations, JWKS location, issuer, audience, public browser values)
- [x] 6.2 Prove the built app: start the production build and hit a page, `/api/properties` without a session (401), and `/api/health`; confirm the client bundle carries no secret, database URL, or JWKS location
- [x] 6.3 Confirm the app refuses to serve with a required variable missing, naming it

- [x] 6.4 Define the acceptance steps for the `deployable-artifact` and `dependency-maintenance` scenarios: the built app serves a page and the routes, a missing variable refuses to serve, the bundle carries no secret, the properties round-trip still holds, and the type check catches a drifted shape

## 7. Delete the Rust service

- [x] 7.1 Delete `api/` (crate, migrations, tests, `openapi.json`, Swagger wiring, `api/README.md`) and `scripts/generate-api-client.ts`; remove `dev:api` and `build:api` from the root scripts
- [x] 7.2 Remove the CORS configuration and the `Authorization`-header path from the client, and delete any remaining reference to the retired override key
- [x] 7.3 Rewrite the `openspec/config.yaml` context that asserts "Architecture A: Start is UI shell only — business logic lives in Rust"
- [x] 7.4 Update the glossary (`Access token`, `Identity`, and new terms for the routes and the cookie contract) and both READMEs

## 8. Completion

- [ ] 8.1 Run the web gates: `pnpm --filter web build`, `npx tsc --noEmit`, `npx eslint src`, `npx prettier --check src`, `pnpm test:unit`
- [ ] 8.2 Confirm no `cargo` command is required to build, test, or run the repository, and that the dependency policy covers every new package
- [ ] 8.3 Run `openspec validate fullstack-tanstack` and resolve errors (the fenced-gherkin warnings are the validator's known style notices)
- [ ] 8.4 Confirm ADR-0010 and ADR-0011 are current and that no in-force ADR contradicts the implementation
