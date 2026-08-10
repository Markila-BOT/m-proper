## Purpose

Defines the HTTP contract for creating, listing, and deleting landlord properties persisted in Postgres.

## ADDED Requirements

### Requirement: List properties
The system MUST expose an HTTP endpoint that returns all properties, ordered with active properties first and then by creation date newest-first. Each property MUST include id, name, address, type, optional units, isActive, and createdAt. The response MUST use a JSON envelope with `success`, `message`, and `data` (array of properties).

#### Scenario: Successful list
- **WHEN** a client requests the properties list
- **THEN** the system returns HTTP 200 with `success: true` and `data` containing the ordered properties

#### Scenario: Empty list
- **WHEN** a client requests the properties list and no properties exist
- **THEN** the system returns HTTP 200 with `success: true` and `data` as an empty array

### Requirement: Create property
The system MUST accept an HTTP POST with JSON body containing required fields `name`, `address`, and `type`, and optional fields `units` and `isActive`. Valid `type` values MUST be one of `residential`, `commercial`, or `lot`. On success the system MUST persist the property and return HTTP 201 with `success: true` and the created property in `data`. Missing required fields or invalid type MUST return HTTP 400 with `success: false`.

#### Scenario: Successful create
- **WHEN** a client posts a valid property payload
- **THEN** the system persists the property and returns HTTP 201 with `success: true` and the created property in `data`

#### Scenario: Missing required fields
- **WHEN** a client posts a property payload missing name, address, or type
- **THEN** the system returns HTTP 400 with `success: false` and does not persist a property

#### Scenario: Invalid property type
- **WHEN** a client posts a property with a type outside residential, commercial, or lot
- **THEN** the system returns HTTP 400 with `success: false` and does not persist a property

### Requirement: Delete property
The system MUST accept an HTTP DELETE by property id. On success it MUST remove the property and return `success: true`. When the id is missing from the request path the system MUST return HTTP 400 with `success: false`.

#### Scenario: Successful delete
- **WHEN** a client deletes an existing property by id
- **THEN** the system removes the property and returns `success: true`

#### Scenario: Missing id
- **WHEN** a client calls delete without a property id
- **THEN** the system returns HTTP 400 with `success: false`
