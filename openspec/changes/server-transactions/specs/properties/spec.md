# properties

## Purpose

Extends the register's deletion behavior: a property's ledger entries are removed with it. The existing register, ownership, and deletion behavior stands.

## ADDED Requirements

### Requirement: Deleting a property deletes its ledger entries

Deleting a property MUST hard-delete the property and its **Ledger entry** rows in the same database transaction through the foreign-key cascade. The web confirmation MUST name the ledger entries that will be lost.

#### Scenario: A property's ledger entries are deleted with it

```gherkin
Given a property has ledger entries
When the operator deletes the property
Then the property is gone
And its ledger entries are gone with it
And another property's entries remain
```
