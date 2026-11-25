# acceptance-suite

## Purpose

Extends the acceptance harness with a real signed-in identity so the existing scenarios and the new auth and isolation scenarios run against the authenticated app.

## ADDED Requirements

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
