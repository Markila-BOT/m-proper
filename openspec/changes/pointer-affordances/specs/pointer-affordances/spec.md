# pointer-affordances

## Purpose

Defines the app-wide pointer contract: enabled controls and their labels signal clickability with the pointer cursor, disabled and non-interactive content does not, and custom hover feedback is gated to devices whose primary pointer can hover.

## ADDED Requirements

### Requirement: Enabled interactive controls show the pointer cursor

Every enabled control the app renders MUST show the pointer cursor: native buttons, elements with `role="button"` or `role="option"`, the select and combobox triggers, calendar day buttons, checkbox and radio inputs, and the labels that activate them. The contract is declared once in the shared style layer, not re-declared per component.

#### Scenario: A representative control on every surface shows the pointer

```gherkin
Given the app is open on Overview, Transactions, Properties, and the transaction form
When the enabled controls are inspected
Then the header actions, the filter reset, the register delete, the ledger sort header, the form radio label, the modal submit, the calendar day, the select option, the checkbox label, and the date-picker triggers all compute the pointer cursor
```

### Requirement: Disabled controls do not promise an action

A control with the `disabled` attribute or `aria-disabled="true"` MUST NOT show the pointer cursor, and it MUST NOT activate. The app keeps its existing inert treatment; no not-allowed cursor is introduced.

#### Scenario: A disabled control keeps the non-pointer cursor

```gherkin
Given an enabled control is visible
When it is disabled and inspected
Then it does not compute the pointer cursor
And clicking it performs no action
```

### Requirement: Hover feedback is gated to hover-capable pointers

Every custom CSS hover style MUST apply only under `@media (hover: hover)`, so a **Coarse pointer** device does not latch a hover state after a tap. Tailwind's `hover:` utilities already carry this gate; the app's own CSS must match it.

#### Scenario: A tap on a coarse pointer leaves no stuck hover

```gherkin
Given the app runs on a context whose primary pointer cannot hover
When the operator taps a navigation link and returns
Then the link's colour is its resting colour, not its hover colour
```

### Requirement: Non-interactive content keeps the reading cursor

Ledger and register cells that are not controls, figures, and static text MUST NOT show the pointer cursor; the trailing actions cell of a row is a control and does.

#### Scenario: The description cell reads, the action cell acts

```gherkin
Given the Transactions ledger is open
When the description cell and the row's trailing actions cell are inspected
Then the description cell computes the default cursor
And the trailing delete control computes the pointer cursor
```

### Requirement: Focus and keyboard behavior are unchanged

The pointer contract MUST NOT remove a visible focus indicator or change activation for keyboard users.

#### Scenario: A keyboard-focused control keeps its focus ring

```gherkin
Given the app is open
When the operator reaches a control by keyboard
Then the control shows its focus-visible ring
```
