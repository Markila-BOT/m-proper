## ADDED Requirements

### Requirement: Direct dependencies declare explicit version ranges

Every direct dependency declared in `web/package.json`, `api/Cargo.toml`, and the root `package.json` MUST carry an explicit version constraint. The project MUST NOT use the `latest` dist-tag or any other unbounded specifier for a direct dependency.

#### Scenario: Manifest scan finds no dist-tags
- **GIVEN** the manifests are at the state produced by this change
- **WHEN** a reader inspects every direct dependency entry
- **THEN** each entry names a concrete constraint and no entry reads `latest`

#### Scenario: Refreshing a dependency produces a reviewable diff
- **GIVEN** a direct dependency is declared with an explicit range
- **WHEN** the lockfile is refreshed to a newer release inside that range
- **THEN** the manifest diff records the new constraint and the lockfile diff records the resolved version

### Requirement: Unreferenced direct dependencies are removed

The project MUST NOT declare a direct dependency, in any manifest, that no source, configuration, build, or test file references.

#### Scenario: Removing an unused dependency leaves the build green
- **GIVEN** a declared direct dependency has no reference in the repository
- **WHEN** that dependency is deleted from its manifest and the lockfile is refreshed
- **THEN** the API check and the web production build both succeed

#### Scenario: Prefixing stays handled after autoprefixer leaves
- **GIVEN** `autoprefixer` is no longer declared and no PostCSS config references it
- **WHEN** the web production build runs
- **THEN** the emitted stylesheet is produced without a build error

### Requirement: Dependency policy is recorded

A durable decision about how dependencies are declared, refreshed, or deferred MUST be recorded under `adr/` so later changes can consult it.

#### Scenario: A deferred major migration is discoverable
- **GIVEN** a major upgrade was deliberately deferred
- **WHEN** a later change considers that upgrade
- **THEN** the accepted ADR states the deferral and the conditions under which it is revisited

### Requirement: API contract is unchanged by dependency upgrades

After a dependency upgrade the API MUST expose the same paths, schema properties, required fields, and field types as before the upgrade, and the JSON envelope `{ success, message, data? }` with camelCase fields MUST be preserved.

#### Scenario: Regenerated OpenAPI document matches the committed contract
- **GIVEN** the API has been rebuilt with upgraded dependencies
- **WHEN** `api/openapi.json` is regenerated and compared with the committed version
- **THEN** no path is added or removed and no schema property, required field, or type changes

#### Scenario: Properties round-trip through the running API
- **GIVEN** the API runs against the Supabase Postgres database
- **WHEN** a property is created, listed, and deleted
- **THEN** each response carries the same envelope shape and camelCase fields as before the upgrade

### Requirement: Web UI behavior is unchanged by dependency upgrades

The web application MUST render the same behavior and appearance after the upgrade as it did at the baseline for the property list with sidebar, the create-property modal, the delete confirmation, the transaction form, and the filters with summary.

#### Scenario: Parity holds at desktop and mobile widths
- **GIVEN** a baseline capture of the five states at 1440×900 and 390×844
- **WHEN** the upgraded application renders the same five states at the same widths
- **THEN** no visual difference remains beyond version or devtools noise

#### Scenario: Client-side transactions survive the upgrade
- **GIVEN** transactions were recorded in the baseline application
- **WHEN** the upgraded application loads with that local storage state
- **THEN** the transactions, summaries, and filters behave as they did before

### Requirement: Build and check commands stay green

The documented check and build commands MUST succeed after every upgrade step.

#### Scenario: Rust check gate
- **GIVEN** one Rust upgrade step has been applied
- **WHEN** `cargo check` runs in `api/`
- **THEN** it completes without errors

#### Scenario: Web build gate
- **GIVEN** the web dependencies have been updated
- **WHEN** `pnpm --filter web build` runs
- **THEN** the client and SSR builds complete without errors
