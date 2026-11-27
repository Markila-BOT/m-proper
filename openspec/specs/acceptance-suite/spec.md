# acceptance-suite Specification

## Purpose

The cucumber-js harness under `acceptance-tests/`: what it executes, how it treats the app, and what it takes for a change to be considered verified.

## Requirements

### Requirement: The suite executes the effective spec

The acceptance suite MUST execute the effective spec — every main spec with active change deltas applied — with a single command, failing on any pending or undefined step, and superseded rules MUST NOT reach the runner or appear as skipped.

#### Scenario: One command runs every committed behavior

```gherkin
Given the main specs are fenced and committed
When the landlord runs the single test command
Then every scenario of the effective spec executes with no pending or undefined steps
And a run report records what ran
```

#### Scenario: An unfenced scenario fails the run loudly

```gherkin
Given a spec whose scenario heading has no gherkin fence
When extraction runs
Then the run fails naming that spec file and line
```

#### Scenario: Superseded rules never reach the runner

```gherkin
Given an active change replaces a requirement of a main spec
When the suite runs
Then the replaced version of that requirement is not executed
And it is not reported as skipped
```

### Requirement: The suite owns the app lifecycle

The acceptance suite MUST start the web application, which also serves the properties routes, before its scenarios run and MUST shut it down after, so one command is the whole workflow.

#### Scenario: The app is alive for the scenarios and gone after

```gherkin
Given the web application is not running
When the landlord starts the acceptance suite
Then the app is running while the scenarios execute
And it is shut down when the run finishes
And no separate API process is started or stopped
```

### Requirement: Browser behavior executes in a real browser

Scenarios that describe behavior inside the web application MUST execute in a real browser driving the running web application, and no browser session MAY remain open after the run.

#### Scenario: The ledger's browser scenarios run for real

```gherkin
Given scenarios that record and reload transactions in the browser
When the suite runs them
Then each executes against the real web application in a real browser
And no browser session remains open after the run
```

### Requirement: The suite leaves no trace

The acceptance suite MUST create only its own smoke data against the configured database and MUST remove it, together with any browser-stored state, before the run ends.

#### Scenario: Smoke rows and stored state are gone after the run

```gherkin
Given the suite has recorded its own smoke property and seeded browser storage during the run
When the run finishes
Then the smoke property no longer exists in the ledger
And the browser's stored state is empty
```

### Requirement: Missing configuration fails before any scenario

When required environment configuration is absent — at minimum the database connection (and, for the API routes, the JWKS location and audience) — the suite MUST fail before any scenario executes, naming the missing variable.

#### Scenario: A missing database connection is named and nothing runs

```gherkin
Given the web application has no database connection configured
When the landlord starts the acceptance suite
Then the run fails before any scenario executes
And the failure names the missing configuration
```

#### Scenario: A missing JWKS location is named and nothing runs

```gherkin
Given the app has a database connection but no JWKS location configured
When the landlord starts the acceptance suite
Then the run fails before any scenario executes
And the failure names the missing variable
```

### Requirement: A green suite gates archiving

A change MUST NOT be archived while the effective suite has a failing, pending, or undefined step; the gate MUST never be silently waived.

#### Scenario: Archive waits for green

```gherkin
Given a change whose effective suite runs green
When the landlord considers a change ready to archive
Then archiving waits until the suite runs green with zero pending steps
```

### Requirement: The suite runs as a test identity

The acceptance suite MUST sign in a seeded **Test identity** once per run and reuse that session across scenarios, including the suite-minus-self child run, which signs in on its own ports. A second seeded owner MUST exist so cross-owner isolation is testable. Sign-out and password-reset scenarios MUST use disposable identities, never the shared one. The suite MUST remove every account it creates and MUST clear every account-scoped ledger key between scenarios.

#### Scenario: The suite runs signed in

```gherkin
Given the suite starts
Then it signs in the seeded test identity once
And every browser scenario runs as that landlord
```

#### Scenario: The child run signs in on its own ports

```gherkin
Given the suite-minus-self child run starts
Then it signs in its own test session against its own ports
And it executes the same authenticated scenarios
```

#### Scenario: Disposable accounts are removed

```gherkin
Given a scenario signs up, signs out, or resets a password
Then it uses a disposable identity
And the suite removes every account it created
```

#### Scenario: Every account ledger is cleared

```gherkin
Given a scenario recorded browser transactions
When the scenario finishes
Then every account-scoped ledger key is cleared
And no landlord's entries survive the run
```
