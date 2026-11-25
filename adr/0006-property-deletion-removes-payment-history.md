# 0006 Deleting a property deletes its payment reminders and history

- Status: accepted
- Date: 2026-11-24
- Supersedes: none

## Context and Problem Statement

Properties are deleted from the register, while payment reminders and their occurrence history are financial records. If a reminder outlives its property, the UI has to render an orphan ("Unknown property") forever; if deletion is refused, the operator cannot remove a property without first dismantling its history. The user chose to delete the history with the property.

## Considered Options

- Orphan the history: keep reminders with a null property and render "Unknown property".
- Refuse deletion while reminders exist.
- **Cascade**: deleting the property deletes its reminders and occurrences.

## Decision Outcome

Chosen option: "cascade", because the user chose it and an orphaned realty-tax history with no property is harder to read than an explicit, warned deletion.

Rules:

- The database uses `on delete cascade` from properties to payment reminders and from reminders to occurrences.
- The property delete confirmation must name the loss before the act: the reminders and their payment history will be deleted with the property. A silent cascade is not acceptable.
- Labels are settings-level and are not deleted by a property deletion; a label in use by another reminder stays.
- The deletion is a single database transaction; a partial delete is not an acceptable outcome.

### Consequences

- Good, because no orphaned reminder can exist and the operator's mental model stays one property, one record.
- Good, because the delete path is one transaction with one confirmation, not a multi-step teardown.
- Bad, because the history is irreversibly lost by a mis-click; the product's usual auditability stops at this boundary.
- Bad, because a landlord who sells a property loses its tax history unless they export or keep it elsewhere.
- Follow-up: if retention becomes a product requirement, supersede this record with an archive or soft-delete model rather than bending the cascade.
