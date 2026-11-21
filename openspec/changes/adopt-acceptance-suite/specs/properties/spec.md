# properties

## Purpose

Adds the units rule the API must own: a property with a negative unit count is a client error, not a server fault.

## MODIFIED Requirements

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
