## Why

The Bank Passbook world is truthful but flat: paper and hairlines give every surface the same weight, so the shell, sheets, and popovers cannot show what floats above what. Liquid Glass replaces the world with a layered material — glass where layering carries a job (occluding chrome, persistent nav), opaque content where figures are read — while the honesty instruments stay exactly as committed.

## What Changes

- **BREAKING** — Liquid Glass supersedes the Bank Passbook visual world across shell, Overview, Transactions, Properties, and Reports; paper, hairline, and stamp language retire whole. The surface brief (`web/.impeccable/surfaces/src-app-tsx.md`) is rewritten in place and `DESIGN.md` is replaced at this change's finish; the passbook version survives in the archived change and git history as an intentional supersede.
- **BREAKING** — every native date input becomes the calendar picker: `react-day-picker` v9 + `date-fns` v4 inside a Radix Popover, with a typed input validating local calendar strings and a keyboard-first calendar. The transaction form gets one picker; the filter's from/to pair becomes **one `mode="range"` calendar** with typed range validation. What a date is does not change — the stored value stays the local calendar string (Local-Date Rule).
- The transaction category select (22 entries) gains a searchable variant (filtering, no-match state, full keyboard); the property filter keeps the plain `ui/select`. Radix Select stays the one select primitive.
- Icons come from `react-icons` on every surface. `@radix-ui/react-icons` currently backs `ui/select.tsx` and `ui/dialog.tsx`; both migrate and the package retires as unreferenced (dependency-maintenance's standing rule). Icon choice is presentation, not a fenced behavior.
- **Glass is a material with a job, not decoration.** Allowed locations and their jobs: the shell header and nav (persistent chrome floating over content), sheets and popovers (occlusion — the surface behind must read as behind). The material is a bounded, measured property inside the blur/saturation budget: a stated blur radius and saturation ceiling, a translucent tint, a layered border highlight, and a shadow stack; no unmeasured "refractive" effect ships.
- **Where text lands:** body copy, table numerals, and all ledger figures sit on an opaque content panel (text-vs-panel contrast, 4.5:1; 3:1 large). Chrome labels and nav sit on glass and are measured against the worst-case sampled rendered pixels behind the glass (a documented composite), never the page background. Non-text floors: borders, highlights, and icons ≥3:1 against their surface.
- **Blur boundary is structural:** no glass element may have a scrolling descendant; glass chrome is `position: fixed` or `sticky` with `overflow: visible`. A scrolling subtree inside a glass sheet or popover gets an opaque panel.
- Fallbacks, one Scenario Outline over four conditions: `prefers-reduced-transparency` (opaque tint), `@supports (backdrop-filter: none)` (opaque tint + solid border), `forced-colors` (system colors, borders preserved), and reduced-motion (travel gates off, opacity cross-fade stays). Under forced-colors and no-backdrop-filter together, the popover and calendar render as an opaque panel with a solid system border.
- Motion and type floors: popover enter 250ms ease-out, exit 150ms, scale from `0.96` at the trigger origin; calendar month change ≤150ms cross-fade; glass highlight transitions ≤150ms; reduced-motion gates all travel. Figures and calendar day numerals tabular; inputs `text-base sm:text-sm` so mobile and iOS never zoom.
- Keyboard and focus floor: the calendar is fully operable (arrows, PageUp/Down, Home/End, Escape), focus-visible ring ≥3:1 on glass, every control named, closing a popover restores focus to its trigger.
- Untouched by the world change: the totals-claims strip, the running-balance rail's book-authority semantics and caveat, the unreachable-state instrument, delete undo, export semantics, and the Local-Date Rule.

## Capabilities

### New Capabilities

- `glass-surfaces`: the glass material contract — allowed locations and their jobs, the legibility model (which text lands on which surface), the blur/saturation budget, rendered-pair measurement, the non-text floors, the structural blur boundary, and the four fallbacks with their combined case.

### Modified Capabilities

- `web-app`: dates are chosen from calendar pickers (single and range) with typed validation; the category select is searchable; icons come from `react-icons`. The **six** current scenarios keep their steps — the five original plus the unreachable state — and the delta adds scenarios for each genuinely changed behavior: the calendar keyboard path, typed-date rejection, the searchable select, and the glass fallbacks (one Outline over four conditions).

## Impact

- **Code** — web shell, nav, sheets, popovers, and the four route chromes; new `ui/date-picker.tsx` and `ui/calendar.tsx` adapted from the agent-lender pattern; a searchable-select variant beside `ui/select.tsx`; icon call sites migrated to `react-icons`. No Rust API changes.
- **Dependencies** — **three additions**, each with an explicit range and its own ADR-0001 review: `react-day-picker` (v9), `date-fns` (v4), `@radix-ui/react-popover` (currently absent from `web/package.json`). `react-icons` and Radix Select are already present; `@radix-ui/react-icons` retires after its two call sites migrate.
- **Artifacts** — the surface brief rewritten in place; `DESIGN.md` replaced at finish; this change's `adr.md` records the world replacement and supersedes the passbook direction; `redesign-ledger-passbook` archives **itself** before this change applies, and this change's ADR supersedes its direction.
- **Verification** — the gate is "32 + N scenarios, with the suite-minus-self child run asserting zero failures"; the N is whatever the changed behaviors require, never a cap. Sorting, running balance, and the unreachable state stay fenced exactly as they are.
- **Ordering** — applies after `adopt-acceptance-suite` and after `redesign-ledger-passbook` has archived itself.

## Non-goals

- No Rust API changes and no new product behavior beyond the component swaps — the datepicker changes how a date is chosen, not what a date is.
- No second icon library; lucide does not come along, and `@radix-ui/react-icons` retires after migration.
- No glass on scrolling content, no decorative blur, and no glass behind ledger numerals or long-form table content.
- No regression of the honesty instruments or the gate; the suite grows only where behavior genuinely changes.
- No dual-world escape hatch — no theme switch, no skin toggle, no passbook leftovers; no routing change (ADR-0003 stands).
