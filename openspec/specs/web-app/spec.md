# web-app Specification

## Purpose

Defines the landlord web application shell that manages properties via the HTTP API and keeps transaction bookkeeping available in the browser for this change.

## Requirements

### Requirement: Property management UI
The web application MUST allow the user to view the list of properties from the properties API, create a new property, and delete a property. Property mutations MUST refresh the visible property list from the API after success.

#### Scenario: View properties from API

```gherkin
Given the user opens the application with the properties API available
Then the application displays properties returned by the API
```

#### Scenario: Create property from UI

```gherkin
Given the user submits a valid new property form
Then the application creates the property through the API
And the new property appears in the list
```

#### Scenario: Delete property from UI

```gherkin
Given the user deletes a property
Then the application removes it through the API
And it no longer appears in the list
```

### Requirement: Client-side transactions retained
For this change the web application MUST continue to store and display transactions in browser local storage (or equivalent client-only persistence). Transaction create/list/filter/summary behavior MUST remain available without requiring a transactions HTTP API.

#### Scenario: Transactions survive reload

```gherkin
Given the user has recorded transactions and reloads the application
Then those transactions are still available in the UI
```

### Requirement: API base configuration
The web application MUST call the properties API using a configurable base URL so the Rust API host/port can differ between local development and deployment without code changes.

#### Scenario: Configurable API host

```gherkin
Given the API base URL is configured for the environment
Then property list, create, and delete requests target that base URL
```

### Requirement: An unreachable API is named, not zeroed

When the properties API is unreachable, the web application MUST distinguish that condition from an empty ledger: one shared unreachable state MUST appear at the property rail, the properties register, and the totals strip, naming the problem and the recovery in the application's own voice. The state MUST NOT be a modal or a transient notification, and the silent zero — empty lists with ₱0.00 figures as though the ledger were merely empty — MUST NOT render unaccompanied by that state.

#### Scenario: The unreachable state speaks where the silent zero used to

```gherkin
Given the web application is open and the properties API is unreachable
When the properties fetch rejects
Then the shared unreachable state appears at the property rail
And the same state appears at the properties register
And the same state appears at the totals strip
And the state names the problem and the recovery
And the empty ledger's zeroed figures do not render as though the ledger were merely empty
```

### Requirement: The ledger shows a running balance
The web application MUST show a running balance column on the ledger, derived client-side from the transactions displayed on the page, with no opening-balance concept and no API changes.

#### Scenario: The ledger shows a running balance

```gherkin
Given the ledger shows its recorded transactions
When the user reads down the ledger
Then a running balance accumulates along the ledger's right edge in displayed order
And it is derived from the transactions on the page with no opening balance
```

### Requirement: The ledger can be sorted by its columns
The web application MUST let the user sort the ledger by its columns, and the running balance MUST follow the displayed order after a sort.

#### Scenario: The ledger can be sorted by its columns

```gherkin
Given the ledger showing its transactions
When the user sorts by a column
Then the rows reorder by that column
And the running balance follows the new displayed order
```

### Requirement: Dates are chosen from calendar pickers

The web application MUST offer calendar pickers for date entry: a single-day picker in the transaction form and one range picker for the filter's from/to pair. Each picker MUST accept typed entry of a local calendar date (or range) and MUST reject an invalid or impossible value with a message that names the problem and the recovery, leaving the stored value unchanged. The calendar MUST be fully keyboard-operable, and closing the picker MUST restore focus to its trigger.

#### Scenario: The calendar is keyboard-operable

```gherkin
Given the transaction form is open
When the user opens the date picker and moves by arrow keys, PageUp, and PageDown, then presses Enter
Then a date is chosen and the picker closes
And focus returns to the picker's trigger
```

#### Scenario: An impossible typed date is rejected

```gherkin
Given the transaction form's date picker is open
When the user types an impossible calendar date and confirms
Then the picker shows a message naming the problem and the recovery
And the stored date is unchanged
```

#### Scenario: The filter pair accepts a typed range

```gherkin
Given the ledger filters are visible
When the user opens the range picker and selects a start and an end day
Then the ledger filters to that inclusive range
And the from and to fields show the chosen days
```

#### Scenario: The calendar's month controls work with a pointer

```gherkin
Given the transaction form's date picker is open
When the user clicks the next-month control
Then the calendar shows the following month
```

### Requirement: Long option lists are searchable

The transaction category select MUST offer search over its options, including a visible no-match state, and MUST remain fully keyboard-operable; the property filter MAY keep the plain select.

#### Scenario: Searching narrows the category list

```gherkin
Given the transaction form's category select is open
When the user types part of a category name
Then only matching categories remain listed
And when nothing matches, a no-match message appears
And keyboard selection still works on the narrowed list
```
