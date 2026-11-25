# web-app

## Purpose

Moves the ledger from browser storage to the owner-scoped API, retires the local ledger with a one-time export, and keeps every ledger view, honesty instrument, and export unchanged over the fetched rows.

## REMOVED Requirements

### Requirement: Client-side transactions retained

**Reason**: The ledger is stored on the server; the browser ledger no longer exists, so transactions no longer persist client-side.

**Migration**: A populated browser ledger is offered a one-time CSV export on the first server-backed load; the entries are then discarded and never imported.

## ADDED Requirements

### Requirement: The ledger is server-backed

The ledger MUST list, create, delete, and restore **Ledger entries** through the API as the signed-in owner. It MUST fetch the owner's rows on mount, on window focus, and after each mutation, and MUST show a loading state, the empty state when the owner has no entries, the "No matches" state when filters hide every entry, and the unreachable state when the fetch fails — never the empty state for a failure. The five-second undo MUST delete the row and re-create it through the API with its original id; the window lives in memory, so a reload or navigation makes the deletion final. The filters, sorting, running balance, book-authority rail and caveat, totals strip, and CSV export MUST stay client-derived over the complete fetched owner set, unchanged from today.

#### Scenario: The ledger lists the owner's entries after a reload

```gherkin
Given a landlord created entries through the API
When the landlord reloads the ledger
Then the entries are listed from the server
And the totals, running balance, sorting, filters, and export reflect those rows
```

#### Scenario: A failed fetch is never the empty state

```gherkin
Given the API cannot be reached
When the ledger loads
Then the unreachable state names the failure and offers a retry
And the empty state is not shown
```

#### Scenario: A failed create keeps the form populated

```gherkin
Given the API cannot be reached
When the landlord submits a new entry
Then the form keeps its values
And an inline error names the failure and the recovery
```

#### Scenario: A failed delete keeps the row

```gherkin
Given the API refuses the delete
When the landlord deletes an entry
Then the row remains visible
And an error names the failure
```

#### Scenario: The undo window ends with a reload

```gherkin
Given a landlord deleted an entry
When the landlord reloads the page before restoring it
Then the entry remains deleted
And no undo is offered
```

#### Scenario: Another device sees the deletion immediately

```gherkin
Given a landlord deleted an entry
When another signed-in session loads the ledger
Then it does not list the entry
And the first session still holds the undo snapshot
```

### Requirement: The local ledger is retired with an export-first notice

On the first server-backed load, if a populated **Local ledger** exists, the app MUST offer a legacy CSV export and MUST state that the entries are not imported. **Ledger discard** MUST clear the old key only after the export completes or after an explicit confirmation to continue without exporting. A malformed legacy payload MUST be reported as unreadable, never half-imported. The new ledger MUST never read the old key after the discard.

#### Scenario: A populated legacy ledger is exported and discarded

```gherkin
Given the browser holds entries from the old local ledger
When the landlord opens the ledger
Then the app offers a legacy CSV export and states that the entries are not imported
When the landlord exports and continues
Then the old key is cleared
And the server ledger starts empty
```

#### Scenario: A malformed legacy ledger is not imported

```gherkin
Given the old local ledger holds unreadable data
When the landlord opens the ledger
Then the app says the old data cannot be read
And nothing is imported
```

### Requirement: The property delete confirmation names the ledger entries

The property delete confirmation MUST name the ledger entries that will be deleted with the property before the operator confirms.

#### Scenario: The confirmation names the ledger loss

```gherkin
Given a property has ledger entries
When the operator asks to delete the property
Then the confirmation names the ledger entries that will be deleted
```
