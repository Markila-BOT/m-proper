# Council Notes: proposal

## Author Summary

The draft framed one systemic pointer contract in the shared style layer, the removal of the Radix neutral cursors, hover gating for coarse pointers, and an explicit non-interactive boundary, with `web-app` deliberately unmodified.

## Reviewer Challenges

- Removing `disabled:pointer-events-none` would wake disabled hover variants and change click pass-through, contradicting "no new hover effects" and "no interaction contract moves".
- The not-allowed half has no deterministic reachable state: disabled controls render only during pending mutations, the pickers/selects never receive `disabled`, and the calendar chevrons use `aria-disabled` rather than `disabled`.
- Cascade placement is unstated; `@layer base` loses to utilities, and the Radix scroll controls are `div aria-hidden`, so removing their `cursor-default` leaves them unmatched.
- The checkbox label in PropertyModal is a sibling `<label htmlFor>`, not a wrapper, so `label:has()` alone cannot cover it; the shared Label must not gain a pointer for text inputs.
- The non-interactive boundary is imprecise: the trailing actions cell is a control; "ordinary reading cursor" is unfalsifiable.
- The contract lists markup the app never renders (`summary`, `role="tab"`, menu items).
- The coarse-pointer scenario lacks mechanics and the harness `extraContext` path.
- The ADR-0004 citation is decorative and wrong; the change actually alters a documented world rule in `web/DESIGN.md`.

## Resolutions

- Accepted: the not-allowed requirement is **dropped**. Disabled and `aria-disabled` controls keep their current `pointer-events-none` treatment and get no pointer; no `pointer-events-none` removal, so no disabled hover or click pass-through changes.
- Accepted: the contract is limited to rendered markup (buttons, `role="option"`, labels/inputs, triggers, calendar days); `summary`/`role="tab"`/menu items are not claimed.
- Accepted: `@layer base` placement with utilities as the intentional escape hatch; the `cursor-default` utilities are removed; the two Radix scroll `div`s get an explicit pointer class.
- Accepted: the wrapper `:has()` rule covers the form's radio labels; the PropertyModal's sibling `Label` gets a one-off pointer class; the shared Label's text-field use stays unchanged; the checkbox/radio inputs get the pointer.
- Accepted: the non-interactive assertion targets the description cell with `default`/`auto`; the trailing actions cell is named as a control.
- Accepted: the coarse-pointer scenario uses the suite's `extraContext` with `hasTouch`/`isMobile`, asserts `matchMedia('(hover: hover)')` is false, and compares a tapped link's colour to its resting colour; the fallback is documented.
- Accepted: `web/DESIGN.md` is added to Impact; the ADR-0004 citation is removed.
- Accepted: `ui/date-picker.tsx`'s four raw buttons join the audit; the AppHeader line references are corrected.
- Rejected: `label[for]` as a blanket selector for text-field labels; only the checkbox label gets the pointer, so a text field's label keeps the reading cursor.
- Deferred: any not-allowed/disabled-state affordance, if a deterministic disabled state ever ships.

## Remaining Risks

- A computed-style assertion proves the declared cursor, not the cursor a real device paints (touch, forced colors, OS cursor settings).
- `(hover: hover)` follows the primary pointer, so a touchscreen laptop still matches; only the emulated touch context exercises the gate.
- Removing the Radix `cursor-default` and adding the base rule must land together; an intermediate state would show options with the arrow.
- The contract is CSS-only; JavaScript pointer-enter highlights and the row reveal are out of scope and remain as they are.
