# web-app

## Purpose

Adds the connection-honesty requirement the spec never had: an unreachable API must be named, not rendered as an empty ledger.

## ADDED Requirements

### Requirement: An unreachable API is named, not zeroed

When the properties API is unreachable, the web application MUST distinguish that condition from an empty ledger: one shared unreachable state MUST appear at the property rail, the properties register, and the totals strip, naming the problem and the recovery in the application's own voice. The state MUST NOT be a modal or a transient notification, and the silent zero — empty lists with ₱0.00 figures as though the ledger were merely empty — MUST NOT render unaccompanied by that state.

#### Scenario: The unreachable state speaks where the silent zero used to

```gherkin
Given the web application is open and the properties API is unreachable
When the properties fetch rejects
Then the shared unreachable state appears at the property rail
And the same state appears at the properties register
And the same state appears at the totals strip
And the state names the problem and the recovery
And the empty ledger's zeroed figures do not render as though the ledger were merely empty
```
