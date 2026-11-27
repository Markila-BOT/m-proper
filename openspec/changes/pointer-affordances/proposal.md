## Why

Every clickable control in the web app should announce itself before it is clicked, but most do not: shared primitives and raw buttons across every route render with the browser's default arrow, and Radix parts actively override it with a neutral one, so a button, a calendar day, and a line of plain text all read identically under the cursor. That ambiguity costs confidence exactly where a user is deciding whether something is clickable, and on touch devices the ungated link hover latches a color after a tap.

## What Changes

- One systemic **Pointer affordance** contract declared once in the shared style layer: enabled native buttons, elements with `role="button"` or `role="option"`, checkbox/radio labels and inputs, and the app's select/combobox triggers and calendar days show the pointer. It replaces the current per-component drift rather than adding another one-off class.
- Radix-supplied neutral cursors stop overriding the contract on the select trigger, items, and scroll controls, on searchable-select options, on calendar days and month chevrons, and on the dialog close control. The controls already carrying a bespoke cursor are audited, not assumed.
- Options and calendar days count as clickable and get the pointer rather than the default arrow, matching the request that all clickable elements read as clickable. The contract is limited to markup the app actually renders; selectors for controls it does not have (`summary`, `role="tab"`, menu items) are not claimed.
- Hover feedback stays as it is visually, but every custom CSS hover is gated to **Hover-capable pointer** devices. Tailwind's `hover:` utilities already behave this way; the remaining ungated global link hover is brought in line, so a **Coarse pointer** tap no longer leaves a hover color stuck. JavaScript pointer-enter highlights (the searchable select's active option) and the ledger row's group-hover reveal are separate from CSS hover and are out of scope.
- The boundary is explicit: non-interactive ledger rows, description cells, figures, and static text keep the ordinary reading cursor; the trailing actions cell of a row is a control and keeps the pointer. A pointer is a promise of an action, so nothing that is not a control gets one.
- Disabled and `aria-disabled` controls keep their current inert treatment and must not show the pointer. This change deliberately does not introduce a not-allowed cursor: no deterministic disabled state is reachable in the app today, and removing `pointer-events-none` to paint one would wake disabled hover states and change click pass-through.
- Focus-visible rings, tab order, keyboard operation, and activation behavior are unchanged; this change touches the pointer channel only.
- No **BREAKING** changes: no route, data shape, or activation contract moves. Enabled controls gain a cursor; disabled controls keep exactly their current behavior.

## Capabilities

### New Capabilities

- `pointer-affordances`: the app-wide contract for how enabled interactive controls and their labels signal clickability — the pointer on controls and their labels, the no-pointer boundary for disabled and non-interactive content, hover feedback gated to hover-capable devices, and the preservation of focus and keyboard behavior.

### Modified Capabilities

- None. `web-app` keeps its existing requirements unchanged: it specifies click behavior (the calendar's month controls respond to a pointer) and keyboard operation, but no requirement says anything about cursor affordance, and no click behavior changes here. `acceptance-suite`, `dependency-maintenance`, `glass-surfaces`, and `properties` are likewise untouched. `web/DESIGN.md` does change: its Owned Browser Chrome Rule gains the pointer clause and the hover-gating note.

## Impact

- **Code:** the base style layer in `web/src/styles.css` (the new pointer rule plus the gated link hover); shared primitives in `web/src/components/ui/` — `button`, `select`, `searchable-select`, `calendar`, `date-picker`, `dialog`, `label`; and the chrome and routes carrying raw buttons or labels — `AppHeader` (the export and primary controls, hover at `:51` and `:64`), `FilterControls`, `PropertiesList`, `PropertySidebar`, `TransactionList` (sort headers, row delete, confirm), `routes/transactions` (undo), `TransactionForm` (radio labels), `PropertyModal` (the sibling checkbox label).
- **APIs:** none. No endpoint, envelope, or server change.
- **Dependencies:** none.
- **Docs:** `web/DESIGN.md` records the pointer contract beside the Owned Browser Chrome Rule.
- **Tests:** the acceptance suite is the verification surface, and it is currently green at 44 scenarios; this change adds scenarios for the pointer on representative controls, the no-pointer boundary on a description cell, the gated hover on a coarse-pointer context (the suite's existing `extraContext` pattern), a disabled probe, and a focus regression. `acceptance-tests/support/hooks.js` and a new page object/steps are touched.
- **Systems:** hover-capable pointer devices gain a correct cursor; touch-only devices stop latching the CSS link hover. The visual world stays as it is — cursors and already-existing hover feedback only, no new surfaces or effects.
- **Non-goals:** no keyboard or focus redesign, no visual-world, color, or token change, no pointer on non-interactive rows or text, no not-allowed cursor or disabled-state redesign, no touch gesture change, no JavaScript hover-highlight rework, and no API or dependency work.
