# properties Specification

## Purpose

Defines the HTTP contract for creating, listing, and deleting landlord properties persisted in Postgres.

## Requirements

### Requirement: List properties
The system MUST expose an HTTP endpoint that returns all properties, ordered with active properties first and then by creation date newest-first. Each property MUST include id, name, address, type, optional units, isActive, and createdAt. The response MUST use a JSON envelope with `success`, `message`, and `data` (array of properties).

#### Scenario: Successful list

```gherkin
Given a client requests the properties list
Then the system returns HTTP 200 with success true
And data contains the ordered properties
```

#### Scenario: Empty list

```gherkin
Given a client requests the properties list and no properties exist
Then the system returns HTTP 200 with success true
And data is an empty array
```

### Requirement: Delete property
The system MUST accept an HTTP DELETE by property id. On success it MUST remove the property and return `success: true`. When the id is missing from the request path the system MUST return HTTP 400 with `success: false`.

#### Scenario: Successful delete

```gherkin
Given a client deletes an existing property by id
Then the system removes the property
And the response carries success true
```

#### Scenario: Missing id

```gherkin
Given a client calls delete without a property id
Then the response is HTTP 400 with success false
```

### Requirement: Create property
The system MUST accept an HTTP POST with JSON body containing required fields `name`, `address`, and `type`, and optional fields `units` and `isActive`. Valid `type` values MUST be one of `residential`, `commercial`, or `lot`. A supplied `units` value MUST be zero or greater. On success the system MUST persist the property and return HTTP 201 with `success: true` and the created property in `data`. Missing required fields, an invalid type, or a negative `units` value MUST return HTTP 400 with `success: false`.

#### Scenario: Successful create

```gherkin
Given a client posts a valid property payload
Then the system persists the property
And the response is HTTP 201 with success true and the created property in data
```

#### Scenario: Missing required fields

```gherkin
Given a client posts a payload missing name, address, or type
Then the response is HTTP 400 with success false
And no property is persisted
```

#### Scenario: Invalid property type

```gherkin
Given a client posts a property with a type outside residential, commercial, or lot
Then the response is HTTP 400 with success false
And no property is persisted
```

#### Scenario: Units below zero is rejected

```gherkin
Given a client posts a valid property payload whose units value is below zero
Then the response is HTTP 400 with success false
And no property is persisted
```
