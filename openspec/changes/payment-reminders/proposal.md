## Why

m-proper knows what a property earns and spends today, but it forgets what the landlord already knows is coming: realty tax lands every quarter at one price in 2026 and a different one in 2027, and nothing holds that schedule or the record of what was actually paid. The reminder needs durable storage, a picklist of payment kinds, and the settings surface the app does not yet have — so the reminders domain and its settings page arrive together, on the API the properties register already proved.

## What Changes

- A new API-backed reminders domain: **Payment label** picklist entries, **Payment reminder** records, and materialized **Occurrence** rows stored in Supabase behind the app's `/api` routes. All three are server-owned, not browser storage, and every date is a local calendar date under the **Local-Date Rule**.
- A property may hold zero or more **Payment reminder**s, and each reminder belongs to exactly one property.
- Each **Payment reminder** carries a **Recurrence** — monthly, quarterly, annual, or one-off — anchored to a start date, with an editable **Due day**. The first occurrence is the first date on or after the start that matches the due day (clamped to the month's last day); quarterly advances in three-month steps from the start month; annual repeats in the start month; a one-off's single occurrence is its start date; an optional end date stops generation. An open-ended reminder generates against a bounded **Occurrence horizon** that extends whenever the reminder is read or the Reminders surface is opened, so the horizon caps how far ahead rows exist, not how long the reminder lives.
- Each reminder carries a default **Expected amount** that seeds every generated occurrence; a per-occurrence value overrides it, so 2026 and 2027 can differ.
- Each **Occurrence** records its expected amount and, once paid, the **Paid amount** (defaulting to the expected amount) with its paid date. Paid amount and date stay editable; paid is a durable state, not a toggle.
- Occurrences are pending, paid, or a **Skipped occurrence**. A pending date that has passed reads **Overdue** in the app. Nothing is emailed or pushed.
- Marking an occurrence paid calls the API first; the **Linked expense** is an optional second step. If the ledger write or the link fails, the occurrence stays paid and unlinked, and the surface says which state it is in. The prompt prefills the property, the category (from the label's mapping), the amount and date (from the payment), and the description (the label name), all editable before it lands.
- The **Linked expense** is a ledger entry owned by the same landlord; the **Ledger link** is an id, not a foreign key. If that entry is not among the ledger rows the API returns — deleted, or never created — the occurrence reads "not found in the ledger", never "ledger entry removed".
- The reminder form offers the **Last-payment seed**. A label with no mapped category offers no seed; the match prefers the same property and mapped category with the label name in the description, falls back to the most recent same-property, same-category payment, and the offer names its date and description so the landlord can judge it. This is a convenience over the ledger the API already returns, not a second discovery path.
- **Payment label**s are created and edited on Settings and are a real picklist, not free text. Each label optionally maps to one of the ledger's expense categories by storing that category's name as the web app knows it; the mapping is not validated server-side, and a label whose category no longer exists reads as unmapped, with the linked-expense prefill falling back to the picker. Deleting a label that a reminder still uses is refused with an error naming the reminders holding it.
- Deleting a **Payment reminder** deletes its occurrences and payment history, with a confirmation that names the loss (the reminder owns its history).
- Deleting a property deletes its reminders and their history, and the delete confirmation names that loss before the act. This changes an existing `properties` requirement; the API envelope and routes are unchanged.
- The shell nav becomes four section tabs (Overview, Transactions, Properties, Reminders), and Settings arrives as a gear control in the header rather than a fifth tab. The two new routes extend ADR-0003's URL-as-state model; `/reports` survives as the unlinked honest placeholder, not a tab.
- The Reminders surface and the Settings label list inherit the app's named-unreachable treatment: a failed fetch says what failed and how to recover, never an empty list or a silent zero.

## Capabilities

### New Capabilities

- `payment-reminders`: the reminder domain and its API behavior — labels with optional category mapping, reminders and their recurrence rules, occurrence generation with an extending horizon, the reminder default and per-occurrence expected amounts, pending/paid/skipped status with the derived overdue state, the linked-expense link (and its honest missing-in-this-browser reading), history preservation across edits, reminder deletion with its warning, and the guards on label deletion.

### Modified Capabilities

- `web-app`: the Reminders section tab and its route; the Settings surface behind the header gear, debuting with only the **Payment label** manager; the label picklist editor; the reminder form with its last-payment seed; the mark-paid flow and its partial-failure state; the overdue and "not in the ledger" readings; the named-unreachable treatment on both new surfaces; the four-tab navigation; and the property-delete confirmation copy. Existing shell, ledger, reports-placeholder, and unreachable-state behavior stands.
- `properties`: deleting a property cascades to its reminders and occurrences in one transaction. The confirmation copy is the `web-app` surface's concern.

## Impact

- **API** — new Supabase tables and migrations for labels, reminders, and occurrences; new server routes and validation under the existing `{ success, message, data? }` envelope with camelCase fields; the web client and the shared domain types grow. Every route requires the session and scopes its rows by owner (ADR-0008, ADR-0010), and its reachability does not widen beyond the properties routes'.
- **Web** — new `/reminders` and `/settings` routes and React Query hooks; a fourth nav entry and a header gear; the reminder form, occurrence history, and label editor as new components. The ledger is the API's (after `server-transactions`), and the mark-paid flow creates the linked expense through it, so the last-payment seed reads the same rows the ledger shows. Glass stays on chrome; reminder figures land on opaque panels.
- **Data** — occurrences are materialized rows, so amounts and statuses are editable and auditable. Two records describe money: the occurrence's paid amount and the ledger entry are separate rows linked by id, so the two are not reconciled and the UI does not imply they are. The label's category and the occurrence's ledger id are cross-store references, not foreign keys.
- **Verification** — the acceptance suite executes this change's delta against the real Postgres, and its new scenarios create and clean up their own probe properties, labels, and reminders. Labels belong to one landlord and refuse deletion while that landlord's reminders use them, so teardown must delete reminders before labels; a mid-run failure can strand a label that a later run must clean up.
- **Dependencies** — none expected; the calendar, popover, select, and dialog primitives the new surfaces need already exist in `web/`.
- **Out of scope by design** — no `glass-surfaces` delta (the gear sits in the existing header chrome) and no `acceptance-suite` delta (its "leaves no trace" requirement is generic).

## Non-goals

- No auth, no users, no per-operator scoping — this remains a single-operator app.
- No emails, push notifications, calendar invites, or any scheduler that runs outside a request.
- No income reminders: the linked-expense path is an expense, and rent tracking is not in scope.
- No migration of the transaction ledger to the server; the link between an occurrence and its expense is an id, not a foreign key, and clearing browser storage severs links without changing paid status.
- No offline queueing or sync — a reminder edit is a request, and a failed request is reported, not replayed later.
- No multi-currency; amounts are single-currency like the rest of the app.
- No attachments or document uploads (receipts, tax bills) attached to an occurrence.
- No general tagging system — **Payment label** is a picklist of payment kinds, not a free-form many-to-many tag surface.
- No Settings beyond the label manager, and no Overview badges, counts, or totals derived from reminders; reminders surface only in the Reminders tab and through linked expenses.
- No un-pay: a paid occurrence's amount and date are correctable, but paid history is not reverted.
