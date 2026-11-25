# ADR Review Manifest

- Status: completed
- Review date: 2026-11-24

## Review Summary

ADR review completed for this change. Two durable decisions are recorded; the in-force records were checked and none is superseded or contradicted.

## In-Force ADRs Reviewed

- `adr/0001-dependency-version-policy.md` — no new JavaScript dependency; the API needs no crate beyond the existing chrono/uuid/serde/sqlx/utoipa set. No conflict.
- `adr/0002-specs-are-executable-source-of-truth.md` — the new scenarios join the gate; the effective spec grows, the suite contract does not change. No conflict.
- `adr/0003-url-as-state-for-the-ledger.md` — `/reminders` and `/settings` extend the URL-as-state model; `/reports` stays the unlinked placeholder. Not superseded.
- `adr/0004-liquid-glass-material-policy.md` — the new content surfaces stay on opaque paper under the existing chrome; the Settings gear sits in the existing header glass. No `glass-surfaces` delta is needed.

## New Durable ADRs Created

- `adr/0005-payment-reminders-api-backed.md` — reminders, labels, and occurrences are API-backed with materialized occurrences generated in Rust; the ledger stays local and is linked by id.
- `adr/0006-property-deletion-removes-payment-history.md` — deleting a property cascades to its reminders and occurrences, with a warned confirmation.

## Notes

- The reminder-deletion cascade follows ADR-0006's ownership rule (a reminder owns its occurrences) and is recorded in the design and spec rather than a third ADR.
- The label→category mapping and the occurrence→ledger link are explicitly cross-store references, not foreign keys; ADR-0005 records the divergence risk.
