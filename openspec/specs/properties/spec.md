# properties Specification

## Purpose

Defines the HTTP contract for creating, listing, and deleting landlord properties persisted in Postgres.

## Requirements

### Requirement: List properties

The system MUST require a valid **Access token** and MUST expose an HTTP endpoint that returns only the authenticated owner's properties, ordered with active properties first and then by creation date newest-first. Each property MUST include id, name, address, type, optional units, isActive, and createdAt; the **Owner ID** MUST NOT appear in the response. The response MUST use a JSON envelope with `success`, `message`, and `data` (array of properties). An unauthenticated request MUST return 401 with `success: false`.

#### Scenario: Successful list

```gherkin
Given a signed-in landlord owns properties
When the client requests the properties list
Then the system returns HTTP 200 with success true
And data contains only that owner's ordered properties
```

#### Scenario: Empty list

```gherkin
Given a signed-in landlord owns no properties
When the client requests the properties list
Then the system returns HTTP 200 with success true
And data is an empty array
```

#### Scenario: A list never includes another owner's property

```gherkin
Given two landlord accounts own different properties
When one landlord requests the properties list
Then the response contains only that landlord's rows
And the other landlord's rows are absent
```

### Requirement: Delete property

The system MUST require a valid access token and MUST accept an HTTP DELETE by property id. On success it MUST remove the property only when it belongs to the authenticated owner and return `success: true`. A property owned by another landlord MUST return HTTP 404, the same as an unknown id, so existence does not leak. When the id is missing from the request path the system MUST return HTTP 400 with `success: false`. An unauthenticated request MUST return 401.

#### Scenario: Successful delete

```gherkin
Given a signed-in landlord deletes a property it owns by id
Then the system removes the property
And the response carries success true
```

#### Scenario: Missing id

```gherkin
Given a signed-in client calls delete without a property id
Then the response is HTTP 400 with success false
```

#### Scenario: Another owner's property is not deleted

```gherkin
Given a property belongs to another landlord
When the signed-in landlord deletes that id
Then the response is HTTP 404 with success false
And the property remains
```

### Requirement: Create property

The system MUST require a valid access token and MUST accept an HTTP POST with JSON body containing required fields `name`, `address`, and `type`, and optional fields `units` and `isActive`. Valid `type` values MUST be one of `residential`, `commercial`, or `lot`. A supplied `units` value MUST be zero or greater. The **Owner ID** MUST be derived from the verified subject; any client-supplied owner MUST be ignored. On success the system MUST persist the property and return HTTP 201 with `success: true` and the created property in `data`. Missing required fields, an invalid type, or a negative `units` value MUST return HTTP 400 with `success: false`. An unauthenticated request MUST return 401.

#### Scenario: Successful create

```gherkin
Given a signed-in landlord posts a valid property payload
Then the system persists the property for that owner
And the response is HTTP 201 with success true and the created property in data
And another landlord cannot see the created property
```

#### Scenario: Missing required fields

```gherkin
Given a signed-in client posts a payload missing name, address, or type
Then the response is HTTP 400 with success false
And no property is persisted
```

#### Scenario: Invalid property type

```gherkin
Given a signed-in client posts a property with a type outside residential, commercial, or lot
Then the response is HTTP 400 with success false
And no property is persisted
```

#### Scenario: Units below zero is rejected

```gherkin
Given a signed-in client posts a valid property payload whose units value is below zero
Then the response is HTTP 400 with success false
And no property is persisted
```

#### Scenario: An unauthenticated create is rejected

```gherkin
Given a request has no access token
When the client posts a valid property payload
Then the response is HTTP 401 with success false
And no property is persisted
```

### Requirement: Owned tables are closed to the direct Data API

The system MUST NOT expose owned tables through the Supabase Data API: the project disables the Data API, and the `anon` and `authenticated` grants on `properties` are revoked. Row Level Security policies MUST exist on `properties` as defense if that path is ever re-enabled. The Rust API remains the only writer. A direct Data API request carrying a landlord's access token MUST be refused.

#### Scenario: A direct Data API request is refused

```gherkin
Given a landlord's access token
When the client queries the properties table directly through the Supabase Data API
Then the request is refused
And no property rows are returned
```
