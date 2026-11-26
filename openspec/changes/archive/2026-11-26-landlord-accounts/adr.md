# ADR Review Manifest

- Status: completed
- Review date: 2026-11-24

## Review Summary

ADR review completed. Two durable decisions are recorded; the in-force records were checked and none is superseded or contradicted.

## In-Force ADRs Reviewed

- `adr/0001-dependency-version-policy.md` — two web packages (`@supabase/supabase-js`, `@supabase/ssr`) and the Rust JWT/JWKS crates need explicit carets and review; no dist-tags. No conflict.
- `adr/0002-specs-are-executable-source-of-truth.md` — the suite delta and the new scenarios join the gate; the harness signs in as a test identity. No conflict.
- `adr/0003-url-as-state-for-the-ledger.md` — the public auth routes and the guard extend the URL-as-state model; the ledger routes stay. Not superseded.
- `adr/0004-liquid-glass-material-policy.md` — the auth surfaces render in the existing glass/paper world; no material change. No conflict.
- `adr/0005-payment-reminders-api-backed.md` — its tables gained a required owner under ADR-0008; the plan must be rebased before it applies. No contradiction.
- `adr/0006-property-deletion-removes-payment-history.md` — the property deletion cascade now also cascades from an auth user via `owner_id`; the history ownership rule is unchanged. No conflict.

## New Durable ADRs Created

- `adr/0007-supabase-auth-rust-jwks.md` — Supabase Auth is the identity provider; the Rust API verifies JWTs against the project JWKS; cookies and refresh rotation on the web; the bearer path and the deferred proxy.
- `adr/0008-per-landlord-ownership.md` — every landlord account owns its rows; app-level scoping primary; RLS defense; the bootstrap owner; the per-account local ledger and the explicit legacy import.

## Notes

- The direct Data API closure is a deploy setting plus revoked grants, not an ADR: it is the enforcement of ADR-0008, and it is reversible if the data path ever moves.
- The test identity and the suite session are verification mechanics, not durable architecture.
