# dependency-maintenance

## Purpose

The Rust crate and the generated OpenAPI document leave with `api/`, so the manifest scan, the contract guard, and the check gates follow the Node-only repository.

## REMOVED Requirements

### Requirement: API contract is unchanged by dependency upgrades

**Reason**: The contract was guarded by regenerating `api/openapi.json` from the Rust build. There is no Rust build and no generated document, so the guard cannot run.

**Migration**: The route handlers and the client share the domain types, so the type check fails on drift, and the acceptance suite keeps the round-trip below.

### Requirement: Build and check commands stay green

**Reason**: The requirement's Rust check gate runs `cargo check`, which no longer exists in the repository.

**Migration**: The web build and the type check are the gates; they are asserted in the new requirement below.

## MODIFIED Requirements

### Requirement: Direct dependencies declare explicit version ranges

Every direct dependency declared in `web/package.json` and the root `package.json` MUST carry an explicit version constraint, MUST NOT use a dist-tag or any other unbounded specifier, and MUST be referenced by the repository's source, configuration, build, or test files.

#### Scenario: Manifest scan finds no dist-tags

```gherkin
Given the dependency manifests at their committed state
When a reader scans every direct dependency entry
Then each entry names a concrete version constraint
And no entry reads latest or another dist-tag
And each entry is referenced by the repository's files
```

#### Scenario: Refreshing a dependency produces a reviewable diff

```gherkin
Given the committed lockfiles beside the manifests
When a reader compares each direct dependency's resolved version to its manifest range
Then every resolved version satisfies its declared range
And the manifest range is what a refresh must keep
```

#### Scenario: An unreferenced dependency is caught before it ships

```gherkin
Given a direct dependency is declared but no file references it
When the manifest scan runs
Then the scan names that dependency
```

## ADDED Requirements

### Requirement: The properties contract is guarded by shared types

The route handlers and the client MUST share the domain types, so the type check fails when a request or response shape drifts, and the acceptance suite MUST pin the envelope and status codes with a round trip. Message text is not contractual.

#### Scenario: Properties round-trip through the running app

```gherkin
Given the app running against the configured database
When a property is created, listed, and deleted through the routes
Then each response carries the success envelope with camelCase fields
And the property is gone from the list after the delete
```

#### Scenario: A drifted response shape fails the type check

```gherkin
Given a route response no longer matches the shared domain type
When the type check runs
Then it fails and names the mismatch
```

### Requirement: Node check and build gates stay green

The documented check and build commands MUST succeed at the committed state of the repository.

#### Scenario: Web build gate

```gherkin
Given the web application at its committed state
When the web production build runs
Then the client and server builds complete without errors
```

#### Scenario: Type check gate

```gherkin
Given the web application at its committed state
When the TypeScript check runs
Then it completes without errors
```
