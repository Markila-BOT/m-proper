# transactions

## Purpose

Defines the owner-scoped transaction table and API: list, create, and delete of ledger entries, the required owned property, calendar dates, validation, the owner-scoped id that makes restore idempotent, and the closed direct Data API path.

## ADDED Requirements

### Requirement: Ledger entries are owner-scoped API rows

The API MUST expose list, create, and delete for **Ledger entry** rows. A row MUST carry an id, a `propertyId`, a calendar date, a description, a category, a type (`income` or `expense`), a two-decimal amount, and a creation time; the owner MUST be derived from the verified access token and MUST NOT appear in the response. The list MUST return every row the caller owns and no one else's. A request without a valid token MUST return 401 with the envelope.

#### Scenario: The list returns only the caller's entries

```gherkin
Given two landlord accounts each own ledger entries
When one landlord requests the ledger list
Then the response contains only that landlord's entries
And the other landlord's entries are absent
```

#### Scenario: The ledger survives a reload

```gherkin
Given a landlord created entries through the API
When the landlord reloads the application
Then the entries are still listed from the server
```

### Requirement: Creating an entry validates the property, date, and amount

The API MUST require a `propertyId` the caller owns, a real calendar date (`YYYY-MM-DD`), a non-empty description and category, a type of `income` or `expense`, and a positive amount with at most two decimal places. A missing property field MUST return 400; an unknown or not-owned property MUST return 404; any other invalid field MUST return 400; a valid request MUST return 201 with the created row.

#### Scenario: A valid entry is created

```gherkin
Given a signed-in landlord owns a property
When the landlord creates an entry for that property with a positive two-decimal amount
Then the API returns 201 with the created entry
And the entry is listed for that owner
```

#### Scenario: A missing property is rejected

```gherkin
Given a signed-in landlord creates an entry with no property
Then the API returns 400 with success false
```

#### Scenario: An unknown or not-owned property is rejected

```gherkin
Given a signed-in landlord names a property it does not own
When the landlord creates an entry
Then the API returns 404 with success false
And no entry is persisted
```

#### Scenario: An impossible date or amount is rejected

```gherkin
Given a signed-in landlord creates an entry with an impossible calendar date or an amount with three decimals
Then the API returns 400 with success false
And no entry is persisted
```

### Requirement: The entry id is owner-scoped and idempotent

The primary key MUST be the owner and the id together. The server MUST assign a UUID when the client omits one; a client-supplied id MUST be accepted for **Ledger restore**. A create that repeats an existing owner and id MUST return the existing row rather than duplicating it. Two owners MAY hold the same id without seeing each other's row.

#### Scenario: A repeated create returns the existing row

```gherkin
Given a landlord created an entry with a client-supplied id
When the landlord creates the same id again for the same owner
Then the API returns the existing row
And no duplicate is persisted
```

#### Scenario: The same id under another owner is a separate row

```gherkin
Given one landlord holds an entry with an id
When another landlord creates an entry with the same id
Then the second owner gets its own row
And neither owner can see the other's entry
```

### Requirement: Deleting an entry is owner-scoped and restore is idempotent

A delete MUST remove the entry only when the caller owns it; a missing or not-owned delete MUST return 404. The client MUST treat that 404 as already gone. **Ledger restore** MUST re-create the deleted entry under its original id through the create-with-id rule; the five-second window is client-side and is not a server retention.

#### Scenario: A delete is scoped to its owner

```gherkin
Given an entry belongs to another landlord
When the signed-in landlord deletes that id
Then the API returns 404 with success false
And the entry remains
```

#### Scenario: Restore returns the same entry

```gherkin
Given a landlord deleted an entry and still holds its snapshot
When the landlord restores it with the same id
Then the entry is listed again with its date, description, category, type, and amount
```

### Requirement: The transactions table is closed to the direct Data API

The table MUST be created with Row Level Security enabled, no client policies, and no privileges for the `anon` or `authenticated` roles. A direct Data API request carrying a landlord's access token MUST be refused.

#### Scenario: A direct Data API request is refused

```gherkin
Given a landlord's access token
When the client queries the transactions table directly through the Supabase Data API
Then the request is refused
And no ledger entries are returned
```

### Requirement: Dates and amounts keep their existing representation

The API MUST store and return dates as calendar strings under the **Local-Date Rule**, and amounts as pesos with exactly two decimal places, validating the scale. The ledger's totals, running balance, and CSV formatting MUST remain unchanged over that representation.

#### Scenario: A date round-trips as the same calendar day

```gherkin
Given a landlord creates an entry dated 2026-03-01
When the entry is listed
Then its date is exactly 2026-03-01 in every time zone
```

#### Scenario: A two-decimal amount round-trips exactly

```gherkin
Given a landlord creates an entry of 1450.50
When the entry is listed and summed
Then the amount is 1450.50 and the total is exact to the cent
```
