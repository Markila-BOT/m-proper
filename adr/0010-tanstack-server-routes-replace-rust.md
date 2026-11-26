# 0010 TanStack server routes replace the Rust API

- Status: accepted, supersedes ADR-0007
- Date: 2026-11-26
- Supersedes: ADR-0007

## Context and Problem Statement

ADR-0007 chose Supabase Auth as the identity provider and had a separate Rust API verify access tokens against the project JWKS, with the browser sending `Authorization: Bearer` across origins. That works, but it makes two deployable units in two languages for two routes, and the second unit cannot run on the deployment platform the web uses. Every property call then costs a CORS allow-list, a hand-maintained client generated from an OpenAPI document, and an access token readable from JavaScript. ADR-0007 also justified its ten-minute key cache with the platform's edge cache, a premise that does not exist in a Node function. The ownership guarantees ADR-0008 established — owner-scoped queries, RLS, revoked grants, 404 for a foreign row — must survive unchanged.

## Considered Options

- **Keep the Rust API on a separate host**: preserves the compiled checks; keeps two stacks, two deploys, CORS, the Bearer token in the browser, and a client generated from a document.
- **TanStack server routes on the app's own origin**: one deployable unit, one type system, the session cookie already present, no CORS, no token in JavaScript.
- **Server functions (RPC) only**: the most idiomatic Start shape; replaces the HTTP contract the specs, the client, and the acceptance suite are written against.

## Decision Outcome

Chosen option: "TanStack server routes on the app's own origin". The app serves `/api/properties` and `/api/health` beside its pages; identity comes only from the Supabase session cookie; the token is verified locally with `jose` against the project JWKS.

The rules that survive from ADR-0007, restated because a supersession replaces the whole record:

- Supabase Auth remains the only identity provider; no custom credential handling.
- ES256 only, with pinned issuer and audience, an expiry check with a small leeway, a non-empty UUID subject, `role: authenticated`, and no anonymous user. `none` and HS-family algorithms are refused.
- The key set is cached and an unknown key id earns exactly one refetch; an unreachable or empty key set fails closed with 503, never by accepting the token.
- Only the project URL and the publishable key reach the browser.
- A rejected token answers 401 with the standard envelope.

The cache rule is re-based rather than copied: ten minutes now bounds how long a rotated signing key can be missed by one instance, not how long an edge cache may hold it.

Two consequences are part of the decision, not incidental:

- Bearer and CORS are withdrawn, so the credential is ambient. `Secure` and `SameSite=Lax` on the session cookies plus an `Origin`/`Sec-Fetch-Site` check on state-changing requests are mandatory; without them this decision trades one problem for a worse one.
- The cookie is now part of the verification contract: its name derivation, chunk assembly, and a malformed cookie answering 401 rather than throwing.

## Pros and Cons

- Positive: one deployable artifact and one origin; no CORS; no token in JavaScript; one type system; the acceptance suite keeps its HTTP contract; the platform runs it as-is.
- Negative: no API for non-browser clients; cookie parsing and CSRF become maintained obligations; the Rust unit tests and the generated OpenAPI contract leave and must be replaced by ported tests and shared types.
- Follow-up: rebase `server-transactions` and `payment-reminders` onto the Node routes; add a database-free liveness route in the deployment change if the platform needs one.
