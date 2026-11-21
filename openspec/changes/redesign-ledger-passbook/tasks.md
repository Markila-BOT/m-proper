## 1. Prerequisite gates (apply order is pinned)

- [x] 1.1 Confirm `adopt-acceptance-suite` is applied and its suite runs green — this change's behavioral gate
- [x] 1.2 C6 folds into this change (user decision, 2026-11-21): the deduped money formatter (two fraction digits), shared date formatter, and single icon map land inside the craft pass; C3 (Rust dead twins), the dead-surface sweep, and the recorded follow-ups stay as their own later change

## 2. Transactions module (C1 folded in — code zone, one commit)

- [x] 2.1 Create `web/src/transactions/` as a pure module: storage adapter exporting the `landlord-transactions` key and event name once, `addTransaction`/`removeTransaction` with the id policy, `filterTransactions`, `summarizeTransactions` (totals, current month, six-month trend), `runningBalance`, RFC-4180 `toCSV`, and the category record keyed by name with the fake ids deleted
- [x] 2.2 Rewire the four hooks as thin adapters over the module; App's transaction handlers delegate to it
- [x] 2.3 Verify the suite stays green (behavior-preserving refactor) and the CSV export survives a description containing a quote

## 3. File routes and redirect (code zone, one commit)

- [x] 3.1 Create the four TanStack file routes (`/overview`, `/transactions`, `/properties`, `/reports`) with `/` redirecting to `/overview`
- [x] 3.2 Delete the single-route shell, `MainContent`'s forwarding corridor, and the three `TabType` declarations; each view owns its filter state
- [x] 3.4 Live smoke: all four routes render, the redirect fires, the back button works

## 4. Passbook world (code zone, committed in craft-sized commits)

- [x] 4.1 Add the passbook tokens to the Tailwind layer: ivory ground, ink-navy, machine-print green hairlines, stamp-red reserved for state marks, print-density tabular numerics
- [x] 4.2 Rebuild the ledger table on TanStack Table (`@tanstack/react-table`, explicit caret per ADR-0001): column structure, sortable headers, the running-balance derived column in displayed order
- [x] 4.3 Move `TransactionForm` and `FilterControls` onto Radix Select with passbook-styled triggers and portals
- [x] 4.4 Shell passbook treatment: header, navigation, ground, and type across all four routes
- [x] 4.5 Overview and Transactions at full passbook commitment; Properties and Reports content layouts untouched under the new chrome

## 5. Craft pass and verification

- [x] 5.1 Read the impeccable craft floor; batch the spacing, border, and padding corrections across the redesigned surfaces (ui-taste: aligned grid, consistent rhythm, deliberate table borders)
- [x] 5.2 Responsive sweep; capture `desktop.png` (1440) and `mobile.png` (390) into `.impeccable/review/`
- [x] 5.3 Acceptance suite green across web-app's five kept and two added scenarios
- [x] 5.4 Run the design detector once over the changed targets; fix what is mechanical
- [x] 5.5 Independent finish review against the direction contract and `model-pick.html`; act on its disposition
- [x] 5.6 DESIGN.md written from the built world at finish
- [x] 5.7 `openspec validate` non-strict clean; every shipping raster carries its provenance

## 6. Critique refinement pass (2026-11-21, scope user-confirmed: full sweep, chronology forced)

- [x] 6.1 P0: the ledger opens chronological (default sort date ascending); descending stays an explicit sort whose rail freezes to chronological accumulation with a visible caveat line; "carried forward" labels from the max displayed date
- [x] 6.2 P0: delete moves to a trailing hover/focus-revealed icon cell (title "Delete entry", keyboard reachable), rows return to one line at print density
- [x] 6.3 Reports leaves the nav until it exists; Properties gets its recorded passbook pass (2.4:1 grays, pills, blue spinner, hover shadows gone)
- [x] 6.4 Focus discipline: print-green visible focus on rail buttons, the collapse toggle (labeled), and every delete control; the destructive confirm receives focus and announces itself
- [x] 6.5 Mobile: filters collapse behind an active-count disclosure; the ledger composes for a narrow window (frozen date column or stacked rows with a trailing balance caption); the destructive confirm becomes a bottom sheet with 44px targets below sm
- [x] 6.6 Honesty signals: a quiet footer status line ("Recorded in this browser · CSV is your backup"), an export acknowledgment, a 5-second delete undo, empty months omitted from the trend
- [x] 6.7 Mechanical minors: strip top-edge cascade (solid print rule), tabular dates inside form inputs, dialog buttons at the 36px control height, stamp border 1.5px, one h1 per page, 44px dialog close target, caption/cell sizes on the documented ramp
- [x] 6.8 Suite stays 31/31 with the new default order (page objects adjusted where order-dependent); detector re-run over the changed targets with the fixable findings cleared

## 7. Critique round two (2026-11-21, user-confirmed: both P0s, rail speaks for the book, full sweep)

- [x] 7.1 P0: the sheet keeps one-line print density at real widths — Description gets a floor, Category/Property flex and truncate (or the sheet takes a fixed print width at all viewports, as mobile already does); blank ruled lines agree with the entry rhythm
- [x] 7.2 P0: the rail always accumulates the book's chronological order (it audits the book, not the display); the caveat prints whenever the display isn't the book's own order — any filter, any sort; the strip keeps the displayed-slice claim
- [x] 7.3 P1: dialog close returns focus to the "+ Add transaction" trigger (both Record and Escape paths)
- [x] 7.4 P1: a Reset control appears when filters are active; "/" focuses search; a "Record & new" secondary keeps the form open
- [x] 7.5 P2: Properties becomes a ruled register — one line per property with Net/Income/Expenses tabular columns, the squared Active mark, product-question copy in the passbook voice
- [x] 7.6 Minors: document.title is the product name; active tab renders the documented bold; validation copy names only the actually-missing fields; strip Income in print green; count caption weight 600; touch targets 44px (radios, masthead primary); the four Created lines off the tiny-text rule; the h3-to-body type step ≥1.25; /properties heading hierarchy fixed (h1 → h2 cards); the wide-tracked mixed-case sublabel tightened; rail entries stop nesting h3 inside buttons; the mobile bottom sheet not in the desktop DOM
- [x] 7.7 Suite stays 31/31 and the detector's fixable residue clears
