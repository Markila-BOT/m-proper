# ADR Review Manifest

- Status: completed
- Review date: 2026-11-26

## Review Summary

ADR review completed. Two durable decisions are recorded: the backend replacement, which supersedes ADR-0007 whole, and the schema ownership that survives deleting `api/`. The in-force records were read and checked; no other is superseded.

## In-Force ADRs Reviewed

- `adr/0001-dependency-version-policy.md` — Drizzle, `drizzle-kit`, the Postgres driver, `jose`, and the Nitro target are new direct dependencies needing explicit ranges and review. No conflict.
- `adr/0002-specs-are-executable-source-of-truth.md` — the parity matrix and the ported tests are the gate for deleting `api/`; the specs keep executing. No conflict.
- `adr/0003-url-as-state-for-the-ledger.md` — the `/api` routes add transport, not view state; the page routes are unchanged. No conflict.
- `adr/0004-liquid-glass-material-policy.md` — no surface changes; this change moves transport and data access only. No conflict.
- `adr/0005-payment-reminders-api-backed.md` — its plan is written against the Rust API and must be rebased onto the Node routes and the Drizzle schema before it applies. It is not superseded, but it is blocked on this change.
- `adr/0006-property-deletion-removes-payment-history.md` — the cascade is unchanged; the foreign keys move from sqlx SQL to hand-authored Drizzle-migration SQL. No conflict.
- `adr/0007-supabase-auth-rust-jwks.md` — **superseded by ADR-0010**. Its surviving rules are restated there because a supersession replaces the record whole; its ten-minute cache rationale is re-based on per-instance key rotation.
- `adr/0008-per-landlord-ownership.md` — unchanged and load-bearing: the owner predicate, the 404 for a foreign row, and RLS with revoked grants are parity obligations in this change.
- `adr/0009-server-ledger-retires-local.md` — unaffected; the ledger remains server-owned and still to be implemented.

## New Durable ADRs Created

- `adr/0010-tanstack-server-routes-replace-rust.md` — the app serves the properties routes on its own origin; identity comes only from the session cookie, verified locally with `jose`; Bearer and CORS are withdrawn and CSRF controls replace them; the surviving JWKS and claim rules are restated.
- `adr/0011-drizzle-owns-the-schema.md` — Drizzle for types and queries, SQL files as the migration unit; a frozen baseline reproduces the applied schema; RLS, grants, and the backfill stay hand-authored; `push` is banned against Supabase and migrations are an explicit step over the direct connection.

## Notes

- The `/api` path prefix is a consequence of the existing page route, not a durable architectural decision; it is recorded in the design and the specs.
- The Postgres driver choice (`postgres-js`) is recorded in the design rather than as an ADR: it is reversible behind the query layer and rests on the pooler's prepared-statement behaviour, which the cutover will confirm.
