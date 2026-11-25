# properties

## Purpose

Extends the register's deletion behavior: a property's payment records are removed with it. The existing register, creation, and deletion behavior stands.

## ADDED Requirements

### Requirement: Deleting a property removes its payment records

Deleting a property MUST delete its **Payment reminder**s and their **Occurrence**s in the same transaction. The property and its payment records are removed together or not at all.

#### Scenario: A property's reminders and history are deleted with it

```gherkin
Given a property has a payment reminder with occurrences
When the operator deletes the property
Then the property is gone
And its reminder is gone
And the reminder's occurrences are gone with it
```
