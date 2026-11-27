# ADR Review Manifest

- Status: completed
- Review date: 2026-11-24

## Review Summary

ADR review completed. One durable decision is recorded; the in-force records were checked and the auth records apply to this change.

## In-Force ADRs Reviewed

- `adr/0001-dependency-version-policy.md` — no new runtime dependency in either tier; the auth change's packages stand. No conflict.
- `adr/0002-specs-are-executable-source-of-truth.md` — the suite delta seeds through the API; the gate is unchanged. No conflict.
- `adr/0003-url-as-state-for-the-ledger.md` — the ledger route and view model are unchanged; only the data source moves. No conflict.
- `adr/0004-liquid-glass-material-policy.md` — the ledger UI stays on opaque paper under the existing chrome; no material change. No conflict.
- `adr/0005-payment-reminders-api-backed.md` — unaffected; the reminders plan still needs its owner column under ADR-0008.
- `adr/0006-property-deletion-removes-payment-history.md` — the same property-deletion cascade now also removes ledger entries; the ownership model is consistent.
- `adr/0010-tanstack-server-routes-replace-rust.md` — the transaction routes use the app's `jose` verifier and the session cookie for the same owner identity; ADR-0007 is superseded.
- `adr/0008-per-landlord-ownership.md` — the transaction table adopts the same owner column and app-level scoping; RLS stays defense.

## New Durable ADRs Created

- `adr/0009-server-ledger-retires-local.md` — the ledger is server-owned and owner-scoped; the local ledger is retired without import; the ledger is online-only; the property cascade removes its entries; the undo is a client-window restore.

## Notes

- The removal of "Client-side transactions retained" is a spec consequence of ADR-0009, not a separate ADR.
- The `landlord-accounts` amendment (dropping its local-ledger requirement) is an ordering prerequisite recorded in this change's tasks, not a durable decision of its own.
