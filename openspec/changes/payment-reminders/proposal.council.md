# Council Notes: proposal

## Author Summary

The draft framed an API-backed reminders domain (labels, reminders, materialized occurrences), the recurrence and per-period amounts, the mark-paid linked expense, the label picklist on a new Settings surface, the four-tab nav, and the property cascade. It marked the cascade and nav as BREAKING and left the open-ended horizon, label deletion, and the settings place to design.

## Reviewer Challenges

- The Reminders surface and Settings label list inherit no named-unreachable state; a failed fetch would render an empty list and a silent zero.
- An open-ended reminder has no rule for passing its horizon; the schedule would silently stop.
- The reminder's own default amount is never introduced, though generation depends on it.
- Deleting a reminder (and its history) is unspecified.
- Recurrence anchoring is under-specified: first occurrence, quarterly months, one-off date.
- "Ledger entry removed" is false on another browser or after storage is cleared.
- The mark-paid flow writes two stores with no failure semantics.
- The label→category mapping is a cross-store reference the API cannot validate.
- The last-payment seed's match is undefined (no mapped category; broad categories).
- Settings scope and Overview/totals scope are unbounded.
- Both BREAKING markers are wrong: the nav is additive and the cascade changes an existing requirement, not a wire contract.
- `/reports` and ADR-0003's four routes are unresolved while the shell contract is restated.
- Glossary compliance: **Occurrence horizon**, **Ledger link**, and **Materialized occurrence** are unbolded; **Local-Date Rule** is missing from the glossary.

## Resolutions

- Accepted: the Reminders and Settings label list inherit the named-unreachable state, with scenarios in the web-app delta.
- Accepted: the horizon extends on read/open; it caps how far ahead rows exist, not the reminder's life.
- Accepted: each reminder carries a default expected amount that seeds occurrences; per-occurrence values override it.
- Accepted: deleting a reminder deletes its occurrences and history, with a warning (user's decision, consistent with ADR-0006's ownership model).
- Accepted: precise anchoring — first date on/after start matching the due day (clamped), quarterly three-month steps, annual in the start month, one-off at the start date.
- Accepted: "not in this browser's ledger" replaces the false claim, and clearing storage severing links without changing paid status is a stated non-goal.
- Accepted: the API marks paid first; the linked expense is an optional second step whose failure leaves the occurrence paid and unlinked, and the surface names the state.
- Accepted: the label→category mapping stores the web's category name, is not server-validated, and reads unmapped when the category disappears.
- Accepted: the seed offers nothing without a mapped category and names its match (label-in-description preferred, same property/category fallback).
- Accepted: Settings debuts with only the label manager; reminders appear only in the Reminders tab and through linked expenses.
- Accepted: both BREAKING markers dropped; the cascade is an existing-requirement change and the nav is additive.
- Accepted: `/reports` stays the unlinked placeholder; `/reminders` and `/settings` extend ADR-0003.
- Accepted: glossary terms bolded; **Local-Date Rule** added to `glossary/technical.md`.
- Accepted: cardinality stated; cascade belongs to `properties`, confirmation copy to `web-app`; the linked-expense prefill fields named; `glass-surfaces`/`acceptance-suite` deltas explicitly declined with reasons.
- Rejected: no change to the paid-is-durable rule beyond what the reviewer asked; un-pay stays a non-goal.
- Deferred: a possible archive/soft-delete model if history retention becomes a product requirement (noted in ADR-0006's follow-up).

## Remaining Risks

- Two stores, two truths: occurrence paid amounts live in Postgres while the ledger is the browser's, so the two never reconcile by design.
- A single-operator claim over shared rows: two devices see different seeds and link states because the ledger is local.
- Financial history arrives on the same unauthenticated API as properties; the blast radius grows without widening reachability.
- A mid-run acceptance failure can strand a global payment label because deletion is refused while in use; teardown must delete reminders first.
