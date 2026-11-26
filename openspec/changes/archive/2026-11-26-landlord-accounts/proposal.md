## Why

m-proper stores sensitive financial records with no notion of who owns them: the API is unauthenticated, every property is visible to every caller, and the only boundary between one landlord's money and the internet is obscurity. Supporting more than one landlord means identity and per-owner isolation must exist before any further feature is layered onto shared data.

## What Changes

- Adopt Supabase Auth as the product's **Identity** provider: email/password **Sign-up** with email confirmation, **Sign-in**, sign-out, and **Password reset** for each **Landlord account**. OAuth, passkeys, and MFA are deferred.
- Each landlord account owns its own **Portfolio**; two landlords see disjoint data with no sharing, invitation, or role model.
- The web gains public auth surfaces (sign-in, sign-up, email confirmation, reset request, new-password) and route guards: every existing ledger screen becomes private, an unauthenticated visitor is sent to sign-in, and the return target is a same-origin relative path validated against open redirection.
- Sessions become cookie-based with PKCE and **Refresh token** rotation. The refresh token leaves `localStorage` for `Secure`/`SameSite` cookies; the short-lived **Access token** remains visible to browser JavaScript because it is sent as a Bearer credential. That residual XSS exposure is accepted for this cut; a same-origin proxy that hides the token is later hardening.
- **BREAKING**: every API route requires a valid **Access token**. The Rust API verifies each token against the project **JWKS** — ES256 only, pinned issuer and audience, expiry with leeway, a non-empty subject, the `authenticated` role, and no anonymous-user claim — and rejects anything else with 401. The JWKS is cached for ten minutes, refetched once on an unknown key id, and the API fails closed if no key is available. No route remains callable anonymously.
- **BREAKING**: properties become owner-scoped. A required **Owner ID** is derived from the verified subject, never from the client; list returns only the caller's rows, create writes the caller's id, and delete matches id and owner together. A non-owned row returns 404, not 403, so existence does not leak. The API exposes list, create, and delete only; a future update must adopt the same predicate.
- **BREAKING (migration)**: the existing unowned property is assigned to a **Bootstrap owner** by a seed step that creates the account through the Auth admin API and a migration that looks the owner up and aborts if it is absent. The migration is one-way and makes the owner column `NOT NULL`. Production starts with no rows, so it needs no bootstrap; only environments with pre-existing data do.
- The browser's publishable key also makes the Supabase Data API reachable. That path is closed for owned tables — the Data API is disabled for the project and the client grants are revoked — and RLS policies are the defense if it is ever re-enabled. The direct path is tested; the Rust API remains the only data writer.
- The browser transaction ledger moves to **Local ledger scope**: one key per account. The legacy pre-auth ledger is never auto-claimed by whoever happens to sign in; it is preserved in a legacy namespace and imported only by explicit confirmation into the signed-in account. Sign-out clears the visible ledger, the query cache, and the in-memory property and filter state so a second landlord on one browser starts clean.
- Open sign-up ships with its minimum abuse controls: Supabase's built-in rate limits plus a CAPTCHA provider configured for the sign-up flow, and a real SMTP provider for confirmation and reset mail as a deploy prerequisite. The acceptance environment keeps confirmation enabled and holds a service key to create, confirm, and remove disposable identities; it verifies the confirmation contract through the auth API.
- A **Test identity** runs the acceptance suite: one seeded owner signs in once per run and its session is reused, a second seeded owner makes cross-owner isolation testable, disposable identities cover sign-out and password reset, the child run signs in on its own ports, and the harness clears every account-scoped ledger key.
- The pending `payment-reminders` plan must land after this change or be rebased onto it: its tables gain a required `owner_id`, its requirements gain the owner predicate, and an unowned insert fails at the constraint instead of silently reappearing.

## Capabilities

### New Capabilities

- `authentication`: account creation, the unconfirmed/expired/resend states, sign-in, sign-out, password reset without account enumeration, the cookie session and its refresh lifecycle, access-token verification and the JWKS policy, the 401/503 contract, and the sign-up security configuration.

### Modified Capabilities

- `properties`: ownership required on create, derived from the verified subject, enforced on list, create, and delete; 404 for non-owned rows; the bootstrap seed-and-migration; the owned tables closed to the direct Data API with RLS defense and a test of that closure.
- `web-app`: the public auth surfaces, route guards with a validated return path, header identity and sign-out, the authenticated API client with one 401 refresh, the per-account local ledger with explicit legacy import, and the cache/in-memory reset on identity change.
- `acceptance-suite`: the suite runs as a seeded test identity, uses a second owner for isolation, signs in once per run and on the child run, covers sign-out and reset with disposable identities, and removes the accounts it creates.

## Impact

- **API** — token verification replaces the stub, configuration learns the issuer/JWKS/audience, owner-scoped list/create/delete, a migration adding the owner with the seed prerequisite, and the 401/503 envelope responses.
- **Web** — a Supabase client and cookie session for the Start app, the auth routes, guards and sign-out, an auth-aware API client, and per-account ledger storage.
- **Database** — an owner reference to the auth user with an index and `NOT NULL`, the Data API closure for owned tables, and RLS policies as defense.
- **Acceptance** — seeded and disposable identities, a reusable signed-in session, the child run's session, per-account cleanup, and the new auth/isolation scenarios.
- **Dependencies** — a Supabase browser/SSR client in the web; a JWT/JWKS verifier in the API.
- **Trust boundaries** — a caller reaches only its own portfolio; the API is the only writer; the browser holds a publishable key and no server secret; the direct Data API path is closed; browser storage holds that account's ledger only.
- **Deploy** — the seed, migration, API, and web ship as one unit; the API rejects unauthenticated traffic the moment it deploys, so a partial deploy breaks the app. Production prerequisites are the SMTP provider, CAPTCHA and rate limits, and the first owner's creation.
- **Non-goals** — no custom Rust credential handling, no third-party IdP, no teams/sharing/roles, no OAuth/passkeys/MFA, no Data API data path, no secret key in the browser, no token-hiding proxy in this cut, no server-side ledger, no account-deletion/switch/profile UI, no cross-tab sign-out guarantee, and no legacy-ledger encryption.
