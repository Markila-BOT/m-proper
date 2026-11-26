# web-app

## Purpose

Adds the Reminders and Settings surfaces, the label picklist editor, the mark-paid linked-expense flow, the honest missing-link and unreachable readings, and the property-delete confirmation copy. Every existing shell, ledger, reports-placeholder, and unreachable-state behavior stands.

## ADDED Requirements

### Requirement: The reminders surfaces live inside the signed-in shell

The Reminders tab, the Reminders view, and Settings MUST render only for a signed-in landlord, inside the same guard as the ledger. A visitor without a session MUST be sent to sign-in with the current location as the return target. A 401 from the reminders API after one token refresh MUST end the session; a 503 MUST render the unreachable state and MUST NOT sign the landlord out.

#### Scenario: A signed-out visitor cannot open Settings

```gherkin
Given a visitor with no session
When the visitor opens /settings
Then the app sends them to sign-in with /settings as the return target
And the label manager does not render
```

#### Scenario: An auth outage is not a sign-out

```gherkin
Given a signed-in landlord on the Reminders view
When the reminders API answers 503
Then the page shows the unreachable state
And the session is still there
```

### Requirement: The shell carries a Reminders tab and a Settings control

The shell MUST expose a fourth section tab, Reminders, at `/reminders`, and a Settings control in the header at `/settings`. Both routes follow the URL-as-state model. `/reports` stays reachable only by direct URL as the honest placeholder, not a tab.

#### Scenario: The shell reaches both new surfaces

```gherkin
Given the application is open
When the operator follows the Reminders tab
Then the Reminders surface is shown at /reminders
And the operator can reach Settings from the header control
```

### Requirement: The Reminders surface lists reminders and their payment history

The Reminders surface MUST list the reminders with their property, label, next due date, expected amount, and status; MUST let the operator create, edit, and delete a reminder; MUST show each reminder's **Payment history** with its expected and paid amounts; MUST read a pending **Occurrence** whose due date has passed as **Overdue**; MUST offer the **Last-payment seed** when the label maps to a category and the ledger already holds a matching payment; and MUST state when a paid occurrence's **Ledger link** is not among the ledger entries the API returns. Deleting a reminder MUST warn that its payment history will be deleted.

#### Scenario: Marking an occurrence paid offers the linked expense

```gherkin
Given a pending occurrence is due
When the operator marks it paid and chooses to record the linked expense
Then the ledger holds an expense for that property, category, paid amount, and paid date
And the occurrence reads paid with that ledger link
```

#### Scenario: A past pending occurrence reads Overdue

```gherkin
Given a pending occurrence's due date has passed
When the operator opens its history
Then it reads Overdue
```

#### Scenario: A missing ledger entry is named honestly

```gherkin
Given a paid occurrence has a ledger link
When its ledger transaction is deleted
Then the occurrence still reads paid
And the history says the entry is not in this browser's ledger
```

#### Scenario: The last-payment seed offers the most recent matching payment

```gherkin
Given the browser ledger holds a property-tax payment for this property on 2025-11-20
And the label "Realty Tax" maps to "Property Taxes"
When the operator opens a new reminder form for that property and label
Then the form offers that payment's amount and date as a seed
```

#### Scenario: Deleting a reminder warns about the lost history

```gherkin
Given a reminder has paid occurrences
When the operator asks to delete the reminder
Then the confirmation names the payment history that will be deleted
```

### Requirement: The Settings surface manages payment labels

The Settings surface MUST list the **Payment label**s, let the operator create, rename, map, and delete them, and MUST refuse to delete a label that a reminder still uses, naming the reminders that hold it.

#### Scenario: A label created on Settings is offered by the reminder form

```gherkin
Given the operator opens Settings
When the operator creates "Realty Tax" mapped to "Property Taxes"
Then the label list shows it
And the reminder form offers it as a picklist choice
```

#### Scenario: Deleting a label in use is refused with the holders named

```gherkin
Given a reminder still uses the label "Realty Tax"
When the operator deletes it on Settings
Then the error names the reminder holding it
And the label remains in the list
```

### Requirement: The Reminders and Settings surfaces name an unreachable API

When the reminders API cannot be reached, the Reminders surface and the Settings label list MUST name the failed connection and the recovery, and MUST NOT show an empty list or a zero total as if the record were empty.

#### Scenario: A failed reminders fetch names the problem

```gherkin
Given the reminders API is unreachable
When the operator opens the Reminders tab
Then the surface names the failed connection and the recovery
And it does not show an empty list or a zero total
```

### Requirement: The property delete confirmation names the payment history loss

The property delete confirmation MUST name the payment reminders and history that will be deleted with the property before the operator confirms.

#### Scenario: The confirmation names the loss

```gherkin
Given a property has payment reminders
When the operator asks to delete the property
Then the confirmation names the reminders and payment history that will be deleted
```
