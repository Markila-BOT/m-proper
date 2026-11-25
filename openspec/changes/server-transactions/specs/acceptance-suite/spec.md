# acceptance-suite

## Purpose

Extends the harness so the ledger scenarios run against the server as a real owner instead of browser storage.

## ADDED Requirements

### Requirement: The ledger scenarios use the server

The ledger scenarios MUST seed and read entries through the API as the **Test identity**, use the second seeded owner for cross-owner isolation, and clean up by listing and deleting their own probe rows. The local-ledger seeding and cleanup are retired for these scenarios. The legacy-notice scenarios are the only ones that seed the old browser key, and they clear it.

#### Scenario: The ledger scenarios seed through the API

```gherkin
Given the acceptance suite starts with its seeded test identity
When a ledger scenario needs entries
Then it creates them through the API as that owner
And the ledger reads them from the server
```

#### Scenario: The ledger cleanup leaves no entries

```gherkin
Given a ledger scenario created probe entries
When the scenario finishes
Then its probe entries are deleted
And the second owner's entries are untouched
```

#### Scenario: The legacy-notice scenarios seed the old key

```gherkin
Given a legacy-ledger scenario runs
Then it seeds the old browser key
And it clears the key when the scenario finishes
```
