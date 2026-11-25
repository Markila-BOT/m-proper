## Context

The web app is one container (TanStack Start) styling Radix primitives with Tailwind 4 layers over the Liquid Glass world. Click behavior is correct; the pointer channel has drifted: the shared Button base and raw buttons never set a cursor, Radix parts set a neutral one, and one global link hover is ungated.

**No C4 diagram.** The change lives entirely inside the web container's style layer and touches no boundary, component topology, or external system; the smallest useful C4 set is none, because any diagram would restate the same container.

Audit (read-only):

| Location | Gap |
| --- | --- |
| `src/components/ui/button.tsx:10` | Shared Button base has no pointer; `disabled:pointer-events-none` (kept, see decision 3) |
| `src/components/ui/select.tsx:44,61,129` | Scroll `div`s and items carry `cursor-default`; trigger has no pointer |
| `src/components/ui/searchable-select.tsx:25,274` | Trigger no pointer; options `cursor-default` |
| `src/components/ui/calendar.tsx:100` | Day buttons and nav chevrons no pointer |
| `src/components/ui/date-picker.tsx:175,207,426,471` | Four raw buttons (two triggers, two Clear controls) no pointer |
| `src/components/ui/dialog.tsx:49` | Close control no pointer |
| `AppHeader.tsx:51,64` | Export and primary controls no pointer |
| `FilterControls.tsx` (2), `PropertiesList.tsx` (5), `PropertySidebar/index.tsx` (9), `TransactionList.tsx` (6), `routes/transactions.tsx` (undo) | Raw buttons no pointer |
| `TransactionForm.tsx:185,202` | Radio labels no pointer |
| `PropertyModal.tsx:137-144` | Sibling `<Label htmlFor>` for the checkbox has no pointer |
| `src/styles.css:238` | Global `a:hover` is not gated to hover-capable pointers |

## Goals / Non-Goals

**Goals:** one declared pointer contract for enabled controls and their labels; no pointer on disabled or non-interactive content; custom hover gated to hover-capable pointers; focus and activation unchanged; the suite fences it.

**Non-Goals:** a not-allowed cursor or any disabled-state redesign; keyboard/focus work; a visual-world, color, or token change; new hover effects; JavaScript hover-highlight rework; API or dependency work.

## Decisions

**1. One base rule in `@layer base`, zero-specificity selectors.** Declared in `web/src/styles.css` so utilities remain the intentional escape hatch, and so no component re-declares the contract.

```css
@layer base {
  :where(
    button:not(:disabled, [aria-disabled='true']),
    [role='button']:not([aria-disabled='true']),
    [role='option']:not([aria-disabled='true'], [data-disabled]),
    label:has(> input[type='checkbox' i]:not(:disabled)),
    label:has(> input[type='radio' i]:not(:disabled)),
    input[type='checkbox' i]:not(:disabled),
    input[type='radio' i]:not(:disabled)
  ) {
    cursor: pointer;
  }
}
```

The contract lists only markup the app renders. `summary`, `role="tab"`, and menu items are absent from the app and are not claimed; if they arrive, the base rule's selector list grows with them. The select and combobox triggers are native buttons; the calendar days and chevrons are native buttons; both are covered.

The Radix select scroll controls are `div aria-hidden` rather than buttons, so their `cursor-default` is removed and each class gains `cursor-pointer` explicitly. Radix's `cursor-default` on select items and searchable-select options is removed so the base rule can reach them.

**2. The two label shapes get two mechanisms.** The form's radio labels wrap their input, so `label:has(> input[…])` covers them. The PropertyModal checkbox uses a sibling `<Label htmlFor>` that no `:has()` can reach from the label side, so that one Label gets `cursor-pointer` explicitly. The shared Label's text-field uses keep the reading cursor; a text-field label is not a click target for this contract. The checkbox and radio inputs themselves get the pointer through the base rule.

**3. Disabled controls keep their current inert treatment and get no pointer.** No not-allowed cursor is introduced. Removing `pointer-events-none` to paint one would let disabled hover variants respond and change click pass-through, and no deterministic disabled state is reachable today (the only `disabled` controls are transient pending submits). The base rule excludes `:disabled`, `[aria-disabled='true']`, and `[data-disabled]`. The existing component-level `disabled:cursor-not-allowed` utilities stay as harmless belt-and-braces; the Button's `disabled:pointer-events-none` stays.

**4. Hover gating is CSS-only.** The global `a:hover` moves inside `@media (hover: hover)`; Tailwind 4's `hover:` utilities already compile under that query, so the app's own CSS is the only gap. JavaScript pointer-enter highlights (the searchable select's active option) and the ledger row's `group-hover` reveal are not CSS `:hover`; the reveal is already Tailwind-gated, and neither is reworked here.

**5. The non-interactive boundary is the description cell, not the row.** Ledger and register rows are hoverable but not clickable: their trailing actions cell holds a full-height control, so a pointer at that edge is correct. The requirement asserts the description cell computes `default`/`auto` and the trailing delete control computes `pointer`; it does not claim the whole row is inert.

**6. Docs.** `web/DESIGN.md`'s Owned Browser Chrome Rule gains the pointer clause and the hover-gating note; the change does not touch the material or color rules.

## Testing

The acceptance suite is the only instrument (ADR-0002); it is currently green at 44 scenarios. The contract is browser-observable:

- A page object enumerates a representative control per surface (header action, filter reset, register delete, ledger sort header, form radio label, modal submit, calendar day, select option, checkbox label, date-picker trigger) and reads `getComputedStyle(el).cursor` on each.
- The disabled probe disables a real control in the DOM, reads its cursor (not pointer), clicks it, asserts no action, and restores it.
- The coarse-pointer scenario uses the suite's existing `extraContext` pattern with `hasTouch`/`isMobile`, asserts `matchMedia('(hover: hover)').matches === false`, taps a navigation link, returns, and compares the link's colour to its resting colour.
- The boundary scenario reads the description cell (`default`/`auto`) and the action control (`pointer`).
- The focus regression reaches a control by keyboard and asserts its focus-visible ring.

Computed styles prove the declared cursor, not the cursor a device paints; a touchscreen laptop still matches `hover: hover` because the media query follows the primary pointer. Both limits are stated, not hidden.

## Risks / Trade-offs

- The base rule and the Radix `cursor-default` removals must land together; an intermediate commit shows options with the arrow.
- A computed-style assertion is not a visual proof of the painted cursor.
- `hover: hover` follows the primary pointer, so only the emulated touch context exercises the gate.
- The contract is CSS-only; JavaScript hover highlights and the row reveal are deliberately outside it.
- Disabled controls keep `pointer-events-none`; a future deterministic disabled state that wants not-allowed must supersede decision 3 rather than remove it silently.

## Migration Plan

1. Base pointer rule, Radix removals, the two scroll `div`s, the two label mechanisms, and the input cursors — one commit.
2. Gate the global link hover.
3. Audit the remaining raw buttons across routes and primitives; add any missing hover/pointer.
4. Acceptance scenarios red → green; the suite and the build gates.
5. `web/DESIGN.md` pointer clause; `openspec validate`.

## Open Questions

None blocking. Whether an `aria-disabled` control should ever show not-allowed is deferred with decision 3; today no such control is reachable.
