# release-pipeline

## Purpose

Defines how a commit becomes production: a source-of-truth gate that must pass before any database change, a pre-release backup that must succeed before the migration, a migration that must succeed before the production branch advances, a deployment that must match the gated commit, a post-deploy live smoke that proves the running origin, and a rollback target that never rewinds the schema.

## ADDED Requirements

### Requirement: The release gate runs before any migration or deployment

The release command MUST run the **Release gate** in a fixed order — install, lint, typecheck, unit tests, build, spec lint, and the main-spec acceptance run — and MUST stop on the first failure. It MUST NOT back up, migrate, or advance the production branch when any gate step fails.

#### Scenario: A failing gate stops the release

```gherkin
Given a release whose unit tests fail
When the release command runs
Then it stops before the backup and migration steps
And it does not advance the production branch
```

#### Scenario: The gate order is fixed

```gherkin
Given a release with every gate step passing
When the release command runs
Then the acceptance run executes before the migration step
And the migration step executes before the production branch advances
```

### Requirement: A release backs up before it migrates

The release command MUST take a logical `pg_dump` over the session connection and store it off-machine before applying any migration. It MUST refuse to migrate when the dump fails or the session migration connection is absent.

#### Scenario: A failed backup stops the release

```gherkin
Given a release whose backup fails
When the release command runs
Then it stops before the migration step
And it does not advance the production branch
```

#### Scenario: The backup precedes the migration

```gherkin
Given a release with a successful backup
When the release command runs
Then the dump is stored off-machine
And the migration runs after the dump
```

### Requirement: Migrations run before the production branch advances

The release command MUST apply `db:migrate` over the session migration connection before advancing the production branch. It MUST refuse to run when `DIRECT_DATABASE_URL` is absent, and it MUST NOT advance the branch when the migration fails.

#### Scenario: A failed migration stops the release

```gherkin
Given a release whose migration fails
When the release command runs
Then the production branch does not advance
And the deployment is not requested
```

#### Scenario: The session migration connection is required

```gherkin
Given a release without a session migration connection
When the release command runs
Then it fails naming the missing connection
And it does not use the runtime URL as a fallback
```

### Requirement: The release deploys exactly the gated commit

The release command MUST assert that the gated commit is still the tip of `master` before it backs up or migrates. It MUST advance the production branch only to that commit and MUST wait for the Vercel production deployment whose commit matches it. A deployment for another commit, or a deployment that errors or times out, MUST fail the release.

#### Scenario: A moved master aborts before migration

```gherkin
Given master advanced after the gates started
When the release command rechecks the tip
Then it aborts before the backup and migration steps
And it names the gated commit and the current tip
```

#### Scenario: A deployment for another commit is refused

```gherkin
Given Vercel reports a production deployment whose commit differs from the gated commit
When the release waits for readiness
Then it fails naming both commits
```

### Requirement: The live smoke is post-deploy, idempotent, and non-destructive

After the matching deployment is READY, the **Live smoke** MUST check that `/api/health` answers 200, that `/api/properties` answers 401 without a session, and that a dedicated **Smoke account** can create, list, and delete its own property. It MUST pre-clean stale rows carrying its own run marker, MUST delete the property it created even when a step fails, and MUST NOT delete a row it did not create.

#### Scenario: A healthy production passes

```gherkin
Given the production origin is serving the release
When the live smoke runs
Then health answers 200
And the properties list answers 401 without a session
And the smoke account's property is created, listed, and deleted
```

#### Scenario: A failing health check is named

```gherkin
Given the production health route answers 503
When the live smoke runs
Then it fails naming the health step
And it does not create a property
```

#### Scenario: Stale smoke rows are removed before the round trip

```gherkin
Given a previous run left a property carrying the smoke run marker
When the live smoke starts
Then it removes that stale property
And it never removes a property without the marker
```

### Requirement: A failed smoke names the rollback target

A failed **Live smoke** MUST print the previous production deployment and the exact Vercel rollback action, exit non-zero, and MUST NOT run a schema down migration. The runbook MUST tell the operator to revert or forward-fix `master` before the next release.

#### Scenario: A failed smoke names the previous deployment

```gherkin
Given the live smoke fails after a production deployment
When the release command reports the failure
Then it prints the previous production deployment
And it prints the rollback action
And it never runs a down migration
```

### Requirement: Only the production branch deploys production

The production branch MUST be `release`, and a push to `master` MUST NOT create or promote a production deployment. Only the release command advances `release`, and preview deployments MUST be configured with the development data plane. A promoted preview or an environment-scope mistake remains a recorded residual risk, not a licence to point previews at production.

#### Scenario: Master is not the production branch

```gherkin
Given the production declaration
When the deployment check inspects the production branch
Then it reports release as the only production branch
And it reports that master is an integration branch
```
