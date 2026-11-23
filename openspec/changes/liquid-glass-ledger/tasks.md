## 1. Tokens and glass surfaces (code zone)

- [x] 1.1 Add the glass token layer: tint, layered highlight, shadow stack, blur ≤24px, saturate ≤160% — with the measured rendered pairs recorded beside them
- [x] 1.2 Apply glass to the shell header and nav only; content panels opaque beneath all text
- [x] 1.3 Implement the fallback cascade (reduced transparency, no backdrop-filter, forced colors, reduced motion, and the combined case) — red → green → commit
- [x] 1.4 Enforce the structural blur boundary: no glass element with a scrolling descendant; scrolling subtrees get opaque panels

## 2. Calendar pickers (code zone, red → green → commit)

- [ ] 2.1 Add `react-day-picker` v9, `date-fns` v4, `@radix-ui/react-popover` at explicit carets (ADR-0001)
- [ ] 2.2 `ui/calendar.tsx`: react-day-picker v9 with react-icons chevrons, single and range modes
- [ ] 2.3 `ui/date-picker.tsx`: Radix Popover + calendar + typed input validated by a `parseCalendarDate` companion in `lib/format.ts` (Local-Date Rule)
- [ ] 2.4 Swap the transaction form's native date input for the single picker; the filter from/to pair becomes one range picker
- [ ] 2.5 Keyboard path: arrows, PageUp/Down, Home/End, Enter, Escape; focus returns to the trigger

## 3. Searchable select and icons (code zone)

- [ ] 3.1 `ui/searchable-select.tsx`: popover combobox (agent-lender pattern) — filter input, no-match message, full keyboard operation via `aria-activedescendant`; Radix Select cannot host a filter input without stranding keyboard users
- [ ] 3.2 Swap the category select; property filter keeps `ui/select`
- [ ] 3.3 Migrate `ui/select.tsx` and `ui/dialog.tsx` to `react-icons`; retire `@radix-ui/react-icons` (unreferenced rule)

## 4. The four route chromes (code zone)

- [ ] 4.1 Re-skin Overview, Transactions, Properties, Reports to the glass world; figures stay tabular; the honesty instruments verified in the new world (strip claims, rail caveat, unreachable state, undo, exports)
- [ ] 4.2 Carry forward the still-valid passbook-era constraints: description reading floor, book-authority rail, snackbar geometry, filtered-empty "No matches"

## 5. Craft pass and verification

- [ ] 5.1 Read the loaded skill floors (better-ui/colors/layout/typography/motion) and batch the corrections; screenshots at 1440 and 390
- [ ] 5.2 Measure the rendered pairs: body/figure text on panels, chrome labels on the worst-case composite, non-text marks; record beside the tokens
- [ ] 5.3 The suite: 32 + N scenarios green — calendar keyboard, typed rejection, range filter, searchable select, and the four-condition fallback Outline; the suite-minus-self child asserts zero failures
- [ ] 5.4 Detector over the changed targets; the finish review; DESIGN.md and the surface brief replaced at finish
- [ ] 5.5 `openspec validate` non-strict clean; every shipping raster carries its provenance
