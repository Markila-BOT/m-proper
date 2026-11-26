## 1. Supabase project and seeds (deploy prerequisites)

- [x] 1.1 Configure the project: asymmetric ES256 signing key and JWKS, anonymous sign-ins disabled, the Data API disabled, confirmation templates and a real SMTP provider, sign-up rate limits and a CAPTCHA provider; record which values are production-only and their owner
- [x] 1.2 Add an idempotent seed step that uses the Auth admin API to create or find the bootstrap owner and the two test owners; keep the service key out of the web and API runtimes
- [x] 1.3 Verify the acceptance environment: its Postgres is the Supabase Postgres with `auth.users`, GoTrue is reachable, and the harness holds a service key that creates, confirms, and removes disposable identities. Confirmation stays enabled because the single project also serves production; CAPTCHA stays off so the browser sign-up path is drivable there

## 2. API token verification (red → green)

- [x] 2.1 Add the issuer, JWKS location, and audience configuration; the API refuses to start without them
- [x] 2.2 Implement the JWKS verifier (ES256 only, pinned `iss`/`aud`, expiry leeway, non-empty `sub`, `authenticated` role, no anonymous claim, ten-minute cache, one refetch on an unknown `kid`, fail closed with 503) with an injectable key set and unit tests
- [x] 2.3 Replace the bearer-prefix middleware and the always-fails extractor with the real `Identity` extractor and the 401/503 envelope; apply it to every property route
- [x] 2.4 Add the OpenAPI bearer security scheme and regenerate the client stamp

## 3. Ownership and the closed data path (red → green)

- [x] 3.1 Write the migration: `properties.owner_id` nullable with an index, a lookup backfill that aborts when the bootstrap owner is absent, then `NOT NULL`, RLS policies on `owner_id = auth.uid()`, and revoked `anon`/`authenticated` grants
- [x] 3.2 Scope list/create/delete by the verified subject: create writes it, list filters it, delete matches id and owner and returns 404 for non-owned or unknown; do not add an update route
- [x] 3.3 Add API tests for valid/invalid/expired/forged tokens, the anonymous-user case, cross-owner isolation, 401/404, and the direct Data API refusal; commit

## 4. Web session, guards, and surfaces (red → green)

- [x] 4.1 Add `@supabase/supabase-js` and `@supabase/ssr` at explicit carets; add the project URL and publishable key env; create the browser and server clients and the Start session refresh
- [x] 4.2 Add the public auth routes (sign-in, sign-up, confirm, reset, new-password), the shell guard, the validated same-origin return path, and the header identity/sign-out
- [x] 4.3 Build the auth surfaces in the existing world (paper panels, clear errors naming the recovery, loading states); screenshots at 1440 and 390
- [x] 4.4 Commit

## 5. Authenticated client and sign-out (red → green)

- [x] 5.1 Add the authenticated API wrapper: Bearer token, one refresh-and-retry on 401, sign-out on a second 401 or failed refresh, and the unreachable state on 503; wire the existing calls through it
- [x] 5.2 Clear the query cache, property store, and filter store on sign-out. The ledger's per-account key, the legacy import offer, and the local store's retirement are owned by `server-transactions` (ADR-0009), not by this change
- [x] 5.3 Commit

## 6. Acceptance harness and scenarios (red → green)

- [x] 6.1 Seed identities and session plumbing: sign in the primary owner once and reuse the storage state, the child run signs in on its own ports, the second owner for isolation, disposable identities for sign-out/reset, and removal of every created account
- [x] 6.2 Clear every `landlord-transactions:*` key between scenarios and update the existing scenarios to run signed in
- [ ] 6.3 Write the new scenarios: sign-up/confirmation, sign-in/out, reset, the guard and return-path rejection, 401 refresh/sign-out, cross-owner isolation, sign-out clearing the visible state, and the direct Data API refusal — red, then green
- [ ] 6.4 Run the full suite (existing plus new): every scenario passes, zero pending or undefined, and no account or ledger key is left behind

## 7. Completion

- [x] 7.1 Run `pnpm --filter web build`, `npx tsc --noEmit`, `npx eslint src`, `npx prettier --check src`, `cargo check`, `cargo clippy`, `cargo test`
- [x] 7.2 Record the auth surfaces and the trust boundaries in `web/DESIGN.md`; confirm the ADRs and glossary are current
- [x] 7.3 Rebase the pending `payment-reminders` plan onto this change: its tables gain a required `owner_id`, its requirements gain the owner predicate, and its inserts fail loudly if unowned
- [x] 7.4 Run `openspec validate landlord-accounts` and resolve errors (the fenced-gherkin warnings are the validator's known style notices)
