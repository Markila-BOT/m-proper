# web-app

## Purpose

Adds the calendar-picker and searchable-select behaviors the world replacement introduces; the six existing scenarios and every honesty behavior keep their steps untouched.

## ADDED Requirements

### Requirement: Dates are chosen from calendar pickers

The web application MUST offer calendar pickers for date entry: a single-day picker in the transaction form and one range picker for the filter's from/to pair. Each picker MUST accept typed entry of a local calendar date (or range) and MUST reject an invalid or impossible value with a message that names the problem and the recovery, leaving the stored value unchanged. The calendar MUST be fully keyboard-operable, and closing the picker MUST restore focus to its trigger.

#### Scenario: The calendar is keyboard-operable

```gherkin
Given the transaction form is open
When the user opens the date picker and moves by arrow keys, PageUp, and PageDown, then presses Enter
Then a date is chosen and the picker closes
And focus returns to the picker's trigger
```

#### Scenario: An impossible typed date is rejected

```gherkin
Given the transaction form's date picker is open
When the user types an impossible calendar date and confirms
Then the picker shows a message naming the problem and the recovery
And the stored date is unchanged
```

#### Scenario: The filter pair accepts a typed range

```gherkin
Given the ledger filters are visible
When the user opens the range picker and selects a start and an end day
Then the ledger filters to that inclusive range
And the from and to fields show the chosen days
```

### Requirement: Long option lists are searchable

The transaction category select MUST offer search over its options, including a visible no-match state, and MUST remain fully keyboard-operable; the property filter MAY keep the plain select.

#### Scenario: Searching narrows the category list

```gherkin
Given the transaction form's category select is open
When the user types part of a category name
Then only matching categories remain listed
And when nothing matches, a no-match message appears
And keyboard selection still works on the narrowed list
```
