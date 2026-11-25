# Council Notes: proposal

## Author Summary

The draft moved the ledger behind an owner-scoped Transaction API, retired the local store, discarded existing browser entries after an export notice, cascaded on property deletion, and kept the ledger's client-derived views and five-second undo.

## Reviewer Challenges

- The draft both removed the auth plan's local-ledger requirement here and said the auth plan would amend it away — a contradiction that cannot be authored.
- The removal's sync baseline and the apply/archive order were implied, not stated.
- The legacy export/discard is unimplementable if the local module and key are deleted; the export lives in that module.
- The transaction→property wire shape was undefined, blocking the cascade, confirmation, filtering, and CSV.
- Restore-via-create had no idempotency, collision, or existence-leak rule.
- "Server-assigned id" contradicted the optional client id.
- Undo durability and the other-device consequence were unstated.
- The failure states were lumped, and "a failed create reverts the row" is wrong (there is no row).
- The blast radius of removing the local hooks/export was understated.
- The cascade assumed a hard delete and the confirmation count had no source.
- The amount's DB/wire type and the float-precision risk were unnamed.
- The Data API closure was asserted, and new-table default grants can undo it.
- The acceptance identity token path and the second identity were missing; the legacy scenarios conflict with "local seeding retired".
- Endpoints, status codes, and new requirement names were unnamed.
- The BREAKING count was inconsistent (four claimed, three present).

## Resolutions

- Accepted: exactly one REMOVED requirement ("Client-side transactions retained"); the auth plan is amended in a separate pass to drop its local-ledger requirement and task, and its delta never modifies the base transactions requirement. The apply/archive order is stated.
- Accepted: a small scoped legacy reader remains for detect/export/discard; the trigger is the ledger's first load; the export uses the old CSV shape; a malformed payload is reported and discard is explicit.
- Accepted: the wire uses `propertyId`; the web maps it to the existing `property` id and resolves the name from the properties list; filters, rendering, and the CSV's property column use that.
- Accepted: the primary key is `(owner_id, id)`; ids are owner-scoped and idempotent per owner; a repeat create returns the existing row; no cross-owner collision or leak. The client treats a 404 delete as already gone.
- Accepted: the id framing is "client-supplied for restore, server-assigned otherwise".
- Accepted: the undo is in-memory; reload/navigation finalizes the deletion; a restore failure keeps the snapshot; other devices see the absence for the window; a deleted property makes the restore fail with a named error.
- Accepted: create failure keeps the form, delete failure keeps the row, restore failure keeps the snapshot, a failed list is the unreachable state, and a 401 defers to the auth plan.
- Accepted: the local removal is scoped to the transactions store and its export; a replacement export function reads the fetched owner rows; no other consumer exists.
- Accepted: property deletion is a hard delete; the FK cascade is atomic; the confirmation names the entries without a count.
- Accepted: the amount is `numeric(12,2)` and a JSON number of pesos with two decimals, the existing representation; totals/balance/export are unchanged; the server rejects more than two decimal places.
- Accepted: the transactions table is created with RLS and no client grants; the direct path is verified refused.
- Accepted: the token path is the auth plan's signed-in storage state; the second seeded owner is required for isolation; cleanup lists and deletes; the legacy-notice scenarios seed and clear the old key.
- Accepted: endpoints and status codes are named; the web-app requirements and scenarios are enumerated.
- Accepted: three BREAKING markers.

- Rejected: a global id primary key with an ownership pre-check, in favour of the owner-scoped composite key.
- Deferred: pagination (a future change must preserve the complete-set balance rule), offline cache/queue, a transaction audit trail.

## Remaining Risks

- Data loss for unexported browser entries is permanent and accepted.
- Online-only means the ledger is unavailable on a failed connection.
- The auth plan must be amended before it applies; applying it first unchanged leaves a contradictory local-ledger requirement.
- The amount float representation is unchanged from the local ledger; very large sums could still lose a cent, though the server rejects invalid scale.
- A future pagination change can silently break the running balance unless it loads the complete owner set.
