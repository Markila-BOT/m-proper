# acceptance-suite

## Purpose

The cucumber-js harness under `acceptance-tests/`: what it executes, how it treats the app, and what it takes for a change to be considered verified.

## ADDED Requirements

### Requirement: The suite executes the effective spec

The acceptance suite MUST execute the effective spec — every main spec with active change deltas applied — with a single command, failing on any pending or undefined step, and superseded rules MUST NOT reach the runner or appear as skipped.

#### Scenario: One command runs every committed behavior

```gherkin
Given the three main specs are fenced and committed
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

The acceptance suite MUST start the API and the web application before its scenarios run and MUST shut them down after, so one command is the whole workflow.

#### Scenario: The app is alive for the scenarios and gone after

```gherkin
Given the API and the web application are not running
When the landlord starts the acceptance suite
Then both are running while the scenarios execute
And both are shut down when the run finishes
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

When required environment configuration is absent — at minimum the database connection — the suite MUST fail before any scenario executes, naming the missing variable.

#### Scenario: A missing database connection is named and nothing runs

```gherkin
Given the API has no database connection configured
When the landlord starts the acceptance suite
Then the run fails before any scenario executes
And the failure names the missing configuration
```

### Requirement: A green suite gates archiving

A change MUST NOT be archived while the effective suite has a failing, pending, or undefined step; the gate MUST never be silently waived.

#### Scenario: Archive waits for green

```gherkin
Given a change whose effective suite runs green
When the landlord considers a change ready to archive
Then archiving waits until the suite runs green with zero pending steps
```
