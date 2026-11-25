# 0007 Supabase Auth is the identity provider; the Rust API verifies JWTs against JWKS

- Status: accepted
- Date: 2026-11-24
- Supersedes: none

## Context and Problem Statement

The app has no authentication: `require_auth` checks only a `Bearer ` prefix, the `AuthenticatedUser` extractor always rejects, neither is wired, and the Rust API serves the single portfolio to anyone who can reach it. The data is sensitive financial history, and the product is moving to per-landlord accounts. The team must choose an identity provider and where tokens are verified.

## Considered Options

- Custom auth in Rust (password hashing, sessions, reset, OAuth, MFA): total control, but owns security-critical surface the team would have to maintain.
- A third-party IdP (Clerk, Auth0) with JWTs: capable, but adds another vendor and account model to an app already on Supabase.
- **Supabase Auth** for identity, with the Rust API verifying access tokens against the project's JWKS: one already-provisioned identity system, no second vendor, and local verification without the Auth server in the hot path.
- Supabase Auth plus the Supabase Data API/RLS as the data path: would move reads and writes out of the Rust API and contradict Architecture A.

## Decision Outcome

Chosen option: "Supabase Auth + Rust JWKS", because the project already runs Supabase Postgres, the identity features (confirmation, reset, OAuth, passkeys, MFA) are maintained upstream, and the Rust API keeps the data boundary.

Rules:

- Email/password sign-up and sign-in first; email confirmation and password reset are part of the flow. OAuth, passkeys, and MFA are later.
- The web uses `@supabase/ssr` with cookie-based sessions, PKCE, and refresh-token rotation; TanStack Start route guards read the session.
- The Rust API verifies every access token against `https://<project>.supabase.co/auth/v1/.well-known/jwks.json`, checking `iss`, `aud`, `exp`, and a non-empty `sub`; a token without a subject or with the `anon` role is rejected. Asymmetric ES256 keys are required; the legacy shared HS256 secret is not accepted.
- The JWKS cache follows the platform's 10-minute edge cache and refreshes on an unknown `kid`; it is never cached longer.
- Only the publishable key reaches the browser. The secret/service key and the database URL stay server-side.
- The browser sends `Authorization: Bearer <access_token>` to the Rust API; a 401 refreshes the session once and retries, then signs out. A same-origin BFF proxy that keeps the token out of JavaScript is a later hardening, not the first cut.
- Every API error keeps the `{ success, message, data? }` envelope, including 401.

### Consequences

- Good, because identity is maintained upstream and the Rust API verifies locally and fast.
- Good, because the data boundary stays in Rust and the web remains a UI shell.
- Bad, because the browser briefly holds a short-lived access token; an XSS could read it until the BFF hardening lands.
- Bad, because production confirmation and reset need a real SMTP provider (Supabase's default is rate-limited).
- Bad, because every acceptance scenario now needs a real test identity and a session, a substantial harness change.
- Follow-up: if token exposure becomes unacceptable, add the BFF proxy and supersede the bearer rule here.
