# payment-reminders

## Purpose

Defines the API-backed payment-reminder domain: the managed **Payment label** picklist, the **Recurrence** that generates **Occurrence**s, per-occurrence expected and paid amounts, the pending/paid/skipped lifecycle, and the deletion rules that keep the **Payment history** honest.

## ADDED Requirements

### Requirement: Payment records are owner-scoped

Every **Payment label**, **Payment reminder**, and **Occurrence** belongs to exactly one **Landlord account**. Every reminders route MUST require a verified identity and MUST answer 401 when it is missing or invalid. The API MUST take the owner from the verified token and MUST NOT accept an owner from the request body. Listing MUST return only the caller's rows. A reminder MUST name a property and a label that the same landlord owns, enforced by the database's composite keys rather than by the route alone. Reading, editing, or deleting another landlord's label, reminder, or occurrence MUST answer 404 exactly as an unknown id does, so existence does not leak.

#### Scenario: Another landlord's reminders are invisible

```gherkin
Given landlord A owns a reminder for their property
When landlord B lists payment reminders
Then the list does not contain A's reminder
And reading A's reminder by id answers 404
```

#### Scenario: A reminder cannot name another landlord's property

```gherkin
Given landlord B does not own the property "Accrual Test House"
When B creates a reminder for that property
Then the request is refused
And no reminder is created
```

#### Scenario: An unauthenticated request is refused

```gherkin
Given a reminders request with no access token
When the API answers
Then it answers 401 with the standard envelope
And nothing is read or written
```

### Requirement: Payment labels are a managed picklist

The API MUST store **Payment label**s with a name unique within the landlord's own labels, and an optional expense-category name as the web app knows it, and MUST support listing, creating, renaming, and deleting them. The category name is a cross-store reference, not a foreign key: the API stores it without validating it against the web app's category list. Deleting a label that any reminder references MUST be refused with an error that names the referencing reminders.

#### Scenario: A label is created and listed

```gherkin
Given the label list has no label named "Realty Tax"
When the operator creates a payment label "Realty Tax" mapped to "Property Taxes"
Then the label list returns "Realty Tax" with its mapped category
```

#### Scenario: Deleting a label in use is refused

```gherkin
Given a payment label "Realty Tax" is used by a payment reminder
When the operator deletes that label
Then the request is refused with an error naming the reminder that holds it
And the label remains in the list
```

#### Scenario: An unused label is deleted

```gherkin
Given a payment label "Storage Fees" is used by no reminder
When the operator deletes that label
Then the label is gone from the list
```

### Requirement: A reminder defines a recurrence and a default amount

The API MUST let the operator create a **Payment reminder** for exactly one property, naming a **Payment label**, a **Recurrence** (monthly, quarterly, annual, or one-off), a start date, a **Due day** from 1 to 31, an optional end date, and a default **Expected amount**. A property MAY hold zero or more reminders. The API MUST reject an unknown property or label, a due day outside 1–31, an end date before the start date, and a negative amount.

#### Scenario: A quarterly reminder is created

```gherkin
Given a property "Accrual Test House" and a label "Realty Tax" exist
When the operator creates a quarterly reminder starting on 2026-02-15 with due day 15 and a default amount of 4500
Then the reminder is listed for that property with its quarterly rule and 4500 default amount
```

#### Scenario: An invalid reminder is rejected

```gherkin
Given a property and a label exist
When the operator creates a reminder with due day 32
Then the request is refused with a message naming the due day
And no reminder is created for that property
```

### Requirement: Occurrences are generated from the recurrence

The API MUST materialize one **Occurrence** per due date. The first occurrence is the first date on or after the start date whose day matches the **Due day**, clamped to the month's last day; a monthly recurrence advances one month, a quarterly recurrence three months from the start month, an annual recurrence twelve months in the start month, and a one-off has its single occurrence at the start date. Generation stops at the end date when one exists; for an open-ended reminder it generates through the **Occurrence horizon** and extends that horizon on later reads. Every generated occurrence starts with the reminder's default expected amount, and no two occurrences of one reminder share a due date.

#### Scenario: A due day clamps to the month's last day

```gherkin
Given a monthly reminder with due day 31 starting on 2026-01-31
When its occurrences are generated
Then February's occurrence falls on 2026-02-28
And March's occurrence falls on 2026-03-31
```

#### Scenario: A quarterly reminder steps three months from the start month

```gherkin
Given a quarterly reminder starting on 2026-02-15 with due day 15
When its occurrences are generated
Then the first four due dates are 2026-02-15, 2026-05-15, 2026-08-15, and 2026-11-15
```

#### Scenario: An annual reminder repeats in the start month

```gherkin
Given an annual reminder starting on 2026-03-10 with due day 10
When its occurrences are generated
Then its due dates fall on 10 March of each generated year
```

#### Scenario: A one-off reminder has one occurrence at its start date

```gherkin
Given a one-off reminder starting on 2026-06-30 with due day 30
When its occurrences are generated
Then it has exactly one occurrence, dated 2026-06-30
```

#### Scenario: An open-ended reminder stops at its horizon

```gherkin
Given an open-ended monthly reminder starting on 2026-01-15
When its occurrences are generated
Then its last due date is on or before the reminder's stated horizon end
And no occurrence falls after that horizon end
```

### Requirement: Each occurrence carries its own expected amount

The API MUST let the operator change one occurrence's **Expected amount** without changing the reminder's default amount or the other occurrences' amounts, so a later period can cost more than an earlier one.

#### Scenario: One year's amount changes without touching the others

```gherkin
Given a monthly reminder has occurrences in 2026 and 2027 at 4500
When the operator changes the 2027 occurrence's expected amount to 5200
Then the 2027 occurrence reads 5200
And the 2026 occurrence still reads 4500
```

### Requirement: Occurrences are paid, skipped, or pending

The API MUST let the operator mark a pending occurrence paid with a **Paid amount** (defaulting to the expected amount) and a paid date, or mark it a **Skipped occurrence**. A paid occurrence's amount and date remain editable, and a paid occurrence is not reverted to pending. The API MUST store an optional **Ledger link** (a transaction id string) with a paid occurrence and return it.

#### Scenario: A payment records the expected and the actual amount

```gherkin
Given a pending occurrence has an expected amount of 4500
When the operator marks it paid with an actual amount of 4725 on 2026-03-16
Then the occurrence reads paid with expected 4500, paid 4725, and paid date 2026-03-16
```

#### Scenario: A skipped occurrence leaves the pending list

```gherkin
Given a pending occurrence is due
When the operator marks it skipped
Then the occurrence reads skipped
```

#### Scenario: A paid occurrence keeps its ledger link

```gherkin
Given a pending occurrence is marked paid
When the operator records the linked ledger expense and stores its transaction id
Then the occurrence returns that same ledger link
```

### Requirement: Editing a reminder preserves paid history

When the operator changes a reminder's recurrence, due day, default amount, or end date, the API MUST preserve every paid and skipped occurrence and regenerate only unpaid occurrences due on or after the current date. It MUST NOT create two occurrences with the same due date.

#### Scenario: Paid and skipped history survives a recurrence change

```gherkin
Given a reminder has one paid past occurrence, one skipped past occurrence, and unpaid future occurrences
When the operator changes its recurrence
Then the paid and skipped occurrences remain unchanged
And the unpaid future occurrences are regenerated for the new rule
And no two occurrences share a due date
```

### Requirement: Deleting a reminder deletes its history

The API MUST delete a reminder and all its occurrences in one transaction.

#### Scenario: The reminder and its occurrences are gone

```gherkin
Given a reminder has occurrences
When the operator deletes the reminder
Then the reminder is gone
And its occurrences are gone with it
```

### Requirement: The reminders API follows the envelope contract

Every reminders endpoint MUST answer with the app's `{ success, message, data? }` envelope and camelCase fields, using 201 on create, 200 on read and update, 400 on validation, 404 on a missing record, and 409 when a label is still in use.

#### Scenario: A validation failure names the problem in the envelope

```gherkin
Given a property and a label exist
When the operator submits a reminder whose end date is before its start date
Then the response has success false
And its message names the end date problem
And the status is 400
```
