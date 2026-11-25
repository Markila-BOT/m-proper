## 1. The pointer contract (code zone)

- [ ] 1.1 Add the base rule to `web/src/styles.css` in `@layer base`: `:where(button:not(:disabled, [aria-disabled='true']), [role='button']:not([aria-disabled='true']), [role='option']:not([aria-disabled='true'], [data-disabled]), label:has(> input[type='checkbox' i]:not(:disabled)), label:has(> input[type='radio' i]:not(:disabled)), input[type='checkbox' i]:not(:disabled), input[type='radio' i]:not(:disabled)) { cursor: pointer }`
- [ ] 1.2 Remove the Radix `cursor-default` overrides in `ui/select.tsx` (items and the two scroll controls) and `ui/searchable-select.tsx` (options); give the two select scroll `div`s `cursor-pointer` explicitly; confirm the select and combobox triggers and calendar days resolve to the base pointer
- [ ] 1.3 Add the two label mechanisms — the wrapper `:has()` already covers the form radio labels, and the PropertyModal's sibling `<Label htmlFor>` gets a one-off `cursor-pointer`; confirm the checkbox and radio inputs themselves compute the pointer while text-field labels keep the reading cursor
- [ ] 1.4 Audit the raw buttons (`AppHeader`, `FilterControls`, `PropertiesList`, `PropertySidebar`, `TransactionList`, `routes/transactions`, `ui/date-picker`, `ui/dialog`) and add any missing pointer; keep the disabled `pointer-events-none` treatment and the component-level `disabled:cursor-not-allowed` utilities

## 2. Hover gating

- [ ] 2.1 Wrap the global `a:hover` in `web/src/styles.css` inside `@media (hover: hover)`; confirm no other plain `:hover` remains outside the query (Tailwind's `hover:` utilities already carry it)

## 3. Acceptance (red → green)

- [ ] 3.1 Add the pointer page object and steps for the representative control on each surface, the description-cell/action-control boundary, the disabled probe, and the keyboard focus regression — red
- [ ] 3.2 Add the coarse-pointer scenario using the suite's `extraContext` and `hasTouch`/`isMobile`, asserting `matchMedia('(hover: hover)').matches === false` and a tapped link's colour equal to its resting colour — red
- [ ] 3.3 Implement until every pointer scenario passes; commit

## 4. Completion

- [ ] 4.1 Run the full acceptance suite (the existing 44 plus the new scenarios): every scenario passes, zero pending or undefined steps, and no pointer appears on non-interactive content
- [ ] 4.2 Run `pnpm --filter web build`, `npx tsc --noEmit`, `npx eslint src`, `npx prettier --check src`; re-run the picker, form, and dialog scenarios for regressions
- [ ] 4.3 Record the pointer clause and the hover-gating note in `web/DESIGN.md`'s Owned Browser Chrome Rule; run `openspec validate pointer-affordances` and resolve errors (the fenced-gherkin warnings are the validator's known style notices)
