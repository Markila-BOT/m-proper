# acceptance-suite

## Purpose

One process now serves the app and the properties routes, so the suite owns a single lifecycle and one missing configuration.

## MODIFIED Requirements

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
