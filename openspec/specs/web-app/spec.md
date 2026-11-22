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
