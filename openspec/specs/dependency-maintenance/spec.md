# dependency-maintenance Specification

## Purpose

TBD

## Requirements

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

### Requirement: Dependency policy is recorded

The durable policy governing dependency declaration, refresh, and deferral MUST be recorded under `adr/`, naming the range style, the review rule for majors, and every deferred major with its reopening condition.

#### Scenario: A deferred major migration is discoverable

```gherkin
Given the accepted architecture decision records
When a later change considers a deferred major upgrade
Then one accepted record states the explicit-range rule and the per-major review rule
And every deferred major appears there with its reopening condition
```

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
