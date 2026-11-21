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
