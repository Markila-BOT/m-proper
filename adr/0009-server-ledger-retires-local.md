# 0009 The ledger moves to the server; the local ledger is retired without import

- Status: accepted
- Date: 2026-11-24
- Supersedes: none

## Context and Problem Statement

The transaction ledger is browser-only: one `landlord-transactions` key, per device, lost when storage is cleared, and invisible to the per-owner scoping the landlord-accounts change introduces. properties already live in Supabase behind the Rust API. The product needs one durable, owner-scoped ledger, and the user chose to move it to the server, discard the existing browser entries, delete a property's transactions with the property, and run online-only.

## Considered Options

- Keep the local ledger and add background sync with a queue and conflict resolution.
- Server-backed ledger with a local cache/queue that survives offline.
- **Server-backed owner-scoped ledger, online-only, with no import**; the local entries are discarded after an export warning.

## Decision Outcome

Chosen option: "server-backed owner-scoped ledger", because the auth change makes ownership real, a per-device ledger cannot express it, and a sync engine is a much larger change than the product needs.

Rules:

- One `transactions` table: `id`, `owner_id` (the verified subject, `auth.users` cascade), `property_id` (`properties` cascade), a calendar `date`, description, category, type, a positive amount, and `created_at`. The owner is derived from the token; the property must belong to the caller.
- The API exposes list (the owner's rows, date-ascending), create, and delete. There is no update route. Create accepts an optional client id so the 5-second undo can restore the exact deleted entry; the client otherwise generates the id.
- Deleting a property deletes its transactions in the same database transaction, with the confirmation naming the loss.
- The owned ledger is closed to the direct Data API like properties; RLS remains defense if that path is ever re-enabled.
- The web retires the local storage module. On the first server-backed load, if the legacy key exists, the app offers an export and states that the old entries are not imported; it then clears the key. No auto-upload, no per-account local key.
- The ledger's filters, sorting, running balance, book-authority rail, totals strip, and export remain client-derived over the fetched owner rows; their semantics do not change.
- The ledger is online-only: a failed create, delete, or restore leaves the server unchanged, names the failure and the recovery, and is never retried silently. There is no offline queue or cache.
- Dates are calendar strings; the Local-Date Rule is unchanged.

### Consequences

- Good, because the ledger is durable, reload-persistent, and isolated per landlord without a sync engine.
- Good, because the ledger and properties share one owner model and one data boundary.
- Bad, because the browser's existing entries are discarded; a landlord who does not export loses them, and the ADR records that explicitly.
- Bad, because the ledger no longer works offline; a network failure blocks a write until the connection returns.
- Bad, because deleting a property erases its ledger history, in line with ADR-0006's ownership model.
- Follow-up: a local cache/queue, if ever wanted, is a new ADR that supersedes the online-only rule; an import path would likewise supersede the discard rule.
