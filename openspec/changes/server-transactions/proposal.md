## Why

The **Local ledger** lives in one browser's `localStorage`: income and expenses are invisible on other devices, lost with site data, and unverifiable by the API. Now that `landlord-accounts` makes every request carry a verified owner, the ledger's only durable home should be the server. This change moves transaction CRUD behind the **Transaction API** so every **Ledger entry** is **Owner scope**d, reload-persistent, and cascade-consistent with its property.

## What Changes

- A `transactions` table and an owner-scoped **Transaction API**: list, create, delete. A row carries an id, `propertyId`, a calendar date, description, category, type, amount, and creation time; the owner is derived from the access token and never supplied by the client.
- The property is required and must belong to the caller. A missing property field is 400; an unknown or not-owned property or transaction is 404; no token is 401. The API exposes no update route.
- Dates are calendar strings (`YYYY-MM-DD` in and out); the **Local-Date Rule** is untouched. Amounts keep the existing number-of-pesos wire shape with two decimals, validated server-side; totals, running balance, and CSV formatting keep their current semantics.
- A row's id is a UUID: the server assigns one, or the client supplies one for **Ledger restore**. The id is unique per owner, so a client id can never collide with another owner's row, and a repeated create for the same owner and id returns the existing row instead of duplicating it.
- **BREAKING** the browser ledger is retired: the local store, the `landlord-transactions` key, and its add/remove/restore plumbing are removed from the ledger's path and replaced by API calls. A small legacy reader remains only for the one-time export/discard.
- **BREAKING** existing browser entries are not migrated. On the ledger's first load, a populated **Local ledger** triggers an export-first notice offering the legacy CSV; **Ledger discard** then clears the key. A malformed legacy payload is reported as unreadable, never half-imported. There is no import path and no per-account local key.
- **BREAKING** the ledger is online-only: no queue, no cache, no durable local write. A failed list shows the app's unreachable state with a retry, never the empty state. A failed create keeps the form populated with an inline error; a failed delete leaves the row visible; a failed restore keeps the snapshot available. A 401 defers to the auth plan's session-expiry behavior.
- The ledger's derived views stay client-side over the fetched owner rows: filters, sorting, running balance, the book-authority rail and caveat, the totals strip, the empty and "No matches" states, and CSV export. The owner's rows are fetched whole, on mount and window focus and after mutations; there is no pagination, and the running balance is correct only over the complete owner set.
- Delete keeps the five-second undo. It is a real delete followed by **Ledger restore** through create-with-id; the window lives in memory, so a reload or navigation makes the deletion final, and another device sees the row absent during the window.
- Deleting a property is a hard delete that removes its transactions in the same database transaction through the foreign-key cascade; the confirmation names the entries that will be lost. If `landlord-accounts` ever soft-deletes properties, this rule must be restated and cannot rely on the cascade.
- The `transactions` table is closed to the direct Data API like the other owned tables: RLS enabled, no client policies or grants; a verification asserts the direct path is refused.
- Acceptance scenarios seed and read the ledger through the API as the seeded **Test identity**, use the second seeded owner for isolation, and clean up by listing and deleting their rows. The legacy-notice scenarios are the only ones that seed the old browser key, and they clear it.
- Ordering: `landlord-accounts` applies and archives first. Before it applies, its pending delta is amended to drop its per-account local-ledger requirement and its per-account ledger task; the auth delta never modifies the base "Client-side transactions retained" requirement. This change then removes that base requirement.

Non-goals: no offline queue or cache; no import of discarded entries; no transaction editing; no server-side filtering or pagination; no change to filter, sort, balance, or export display semantics; no multi-currency, attachments, ledger sharing, or per-transaction audit trail; no change to the **Local-Date Rule**.

## Capabilities

### New Capabilities

- `transactions`: the owner-scoped transaction table and API — list, create, delete; the required owned property; calendar dates; field validation; the owner-scoped UUID and idempotent restore; reload persistence; the 401/400/404 contract; the closed direct Data API path. Rows are delivered whole and unfiltered for the owner.

### Modified Capabilities

- `properties`: ADDED — deleting a property hard-deletes its transactions in the same database transaction through the foreign-key cascade, and the confirmation names the loss (the copy belongs to `web-app`).
- `web-app`: REMOVED — "Client-side transactions retained" and its scenario, because the browser ledger no longer exists. ADDED — the server-backed ledger (fetch policy, loading/empty/filtered-empty/unreachable, the create/delete/restore failure states, the in-memory five-second undo, the client-derived filters/sorting/running balance/book-authority rail/totals/export, reload persistence), the legacy export-first notice and discard, and the property-delete confirmation naming the ledger entries.
- `acceptance-suite`: the ledger scenarios seed and clean up through the API as the test identity, the second owner makes isolation testable, the legacy-notice scenarios seed the old key and clear it, and the local-ledger seeding/cleanup is retired elsewhere.

## Impact

- **API** — a transactions module with list/create/delete, field and ownership validation, the owner-scoped idempotent id, the client methods over shared types; the existing 401 contract.
- **Web** — the local store becomes an API client with query hooks; the ledger, totals, filters, export, property list, and delete confirmation adapt; a small legacy reader handles the one-time export and discard; the money and property-name presentation are unchanged.
- **Data** — a `transactions` table keyed by owner and id, a property foreign key with cascade, owner/date and property indexes, RLS with no client grants, and the Data API closed.
- **Acceptance** — API seeding and cleanup as the test identity, the second owner for isolation, the legacy-notice exception, and the new CRUD/cascade/restore/unreachable scenarios.
- **Dependencies** — no new runtime dependency; the auth change supplies the verifier and the test identity.
- **Data loss** — browser entries that are not exported before upgrade are permanently discarded; this is accepted and stated in the notice.
- **Deploy** — after `landlord-accounts`, with the table, API, and web in one unit; the auth plan's local-ledger amendment lands before it.
