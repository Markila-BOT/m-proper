# 0005 Payment reminders are API-backed with materialized occurrences

- Status: accepted
- Date: 2026-11-24
- Supersedes: none

## Context and Problem Statement

The web app's ledger is client-side by contract, while properties live in Supabase behind the Axum API. Payment reminders (realty tax and other recurring property obligations) need a durable, auditable payment history whose amounts change period by period. The user chose API-backed storage for that durability. The open question is how a recurring rule becomes rows the operator can edit and audit without recomputing a schedule on every read and without losing paid history when a rule changes.

## Considered Options

- Client-side reminders and history in browser storage, consistent with the ledger: smallest change, but per-device and lost when storage is cleared.
- API-backed reminders with occurrences computed on read: durable rules, but no per-occurrence amount or status to edit, and no stable identity for a paid record.
- API-backed reminders with **materialized occurrences**: one stored row per due date, generated in Rust from the rule, carrying expected amount, status, paid amount/date, and an optional ledger link.

## Decision Outcome

Chosen option: "materialized occurrences", because the operator must edit a given year's amount, mark one date paid or skipped, and keep that history even after the rule changes.

Rules:

- Supabase tables hold payment labels, reminders, and occurrences; the Axum API exposes them under the existing `{ success, message, data }` envelope with camelCase fields.
- Rust generates occurrences from the reminder's recurrence and due day. A due day past a month's length clamps to that month's last day; an open-ended reminder generates a bounded horizon.
- Editing a reminder's rule or default amount regenerates only future unpaid occurrences and preserves paid and skipped history.
- Deleting a property deletes its reminders and occurrences (ADR-0006); deleting a label in use is refused.
- The ledger stays client-side. A paid occurrence may store the linked transaction's local id as a **ledger link** (a string, not a foreign key) and shows a dangling link rather than silently reverting to pending.
- Dates are calendar dates, never instants; the web applies the Local-Date Rule when it formats or seeds them.

### Consequences

- Good, because the history is durable and shared where the ledger is not, and every due date has a stable id to edit and audit.
- Good, because the schedule logic sits in Rust, matching Architecture A, and the API stays the one data boundary.
- Bad, because the change adds migrations, endpoints, OpenAPI/client surface, and acceptance scenarios that run against the real Postgres.
- Bad, because two stores now describe money: the occurrence's paid amount and the linked ledger transaction can diverge if one is edited after the other. The UI must show the link state honestly.
- Follow-up: if the ledger ever moves server-side, promote the ledger link to a real foreign key and make the paid amount agree by constraint, not by UI discipline.
