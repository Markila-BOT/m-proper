## Purpose

Defines the landlord web application shell that manages properties via the HTTP API and keeps transaction bookkeeping available in the browser for this change.

## ADDED Requirements

### Requirement: Property management UI
The web application MUST allow the user to view the list of properties from the properties API, create a new property, and delete a property. Property mutations MUST refresh the visible property list from the API after success.

#### Scenario: View properties from API
- **WHEN** the user opens the application with the properties API available
- **THEN** the application displays properties returned by the API

#### Scenario: Create property from UI
- **WHEN** the user submits a valid new property form
- **THEN** the application creates the property through the API and shows the new property in the list

#### Scenario: Delete property from UI
- **WHEN** the user deletes a property
- **THEN** the application removes it through the API and no longer shows it in the list

### Requirement: Client-side transactions retained
For this change the web application MUST continue to store and display transactions in browser local storage (or equivalent client-only persistence). Transaction create/list/filter/summary behavior MUST remain available without requiring a transactions HTTP API.

#### Scenario: Transactions survive reload
- **WHEN** the user has recorded transactions and reloads the application
- **THEN** those transactions are still available in the UI

### Requirement: API base configuration
The web application MUST call the properties API using a configurable base URL so the Rust API host/port can differ between local development and deployment without code changes.

#### Scenario: Configurable API host
- **WHEN** the API base URL is configured for the environment
- **THEN** property list, create, and delete requests target that base URL
