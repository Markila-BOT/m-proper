# dependency-maintenance

## Purpose

Rewrites the durable dependency requirements into automatable form: the acceptance suite can execute every one of them. The one-time procedural scenarios of the original upgrade change are dropped.

## MODIFIED Requirements

### Requirement: Direct dependencies declare explicit version ranges

Every direct dependency declared in `web/package.json`, `api/Cargo.toml`, and the root `package.json` MUST carry an explicit version constraint, MUST NOT use a dist-tag or any other unbounded specifier, and MUST be referenced by the repository's source, configuration, build, or test files.

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

### Requirement: API contract is unchanged by dependency upgrades

After any change to the API or its dependencies, regenerating the OpenAPI document MUST produce the same committed contract: no path added or removed, and no property, required flag, or type changed.

#### Scenario: Regenerated OpenAPI document matches the committed contract

```gherkin
Given the API built with its current dependencies
When its OpenAPI document is regenerated
Then the regenerated document matches the committed one in paths and schemas
```

#### Scenario: Properties round-trip through the running API

```gherkin
Given the API running against the configured database
When a property is created, listed, and deleted through the API
Then each response carries the success envelope with camelCase fields
And the property is gone from the list after the delete
```

### Requirement: Build and check commands stay green

The documented check and build commands MUST succeed at the committed state of the repository.

#### Scenario: Rust check gate

```gherkin
Given the API at its committed state
When the API check command runs
Then it completes without errors
```

#### Scenario: Web build gate

```gherkin
Given the web application at its committed state
When the web production build runs
Then the client and server builds complete without errors
```

## REMOVED Requirements

### Requirement: Unreferenced direct dependencies are removed

**Reason**: The durable essence — nothing unreferenced stays declared — is now executed by the manifest-scan scenario of the version-ranges requirement; the historical removal scenarios described a single past cleanup.

**Migration**: The manifest scan names any unreferenced dependency, which is the standing check; the removal itself is git history.

### Requirement: Web UI behavior is unchanged by dependency upgrades

**Reason**: The scenarios described the parity audit of one completed upgrade — a one-time verification against a gitignored baseline, not repeatable behavior of the system.

**Migration**: Repeatable verification of the web application's behavior now executes as the `web-app` capability's scenarios inside the acceptance suite, and the archive gate enforces it on every future change.
