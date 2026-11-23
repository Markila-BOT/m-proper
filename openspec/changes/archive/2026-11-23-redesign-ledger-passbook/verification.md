
---

# Refinement pass — 2026-11-21 (post-ship critique)

## Critique (dual-agent, snapshot at web/.impeccable/critique/2026-11-21T11-59-20Z)

Score 21/40 (Acceptable). The user's "not appealing" diagnosed: the rail opened lying in the app's own default order (newest-first prepend → negative balance at the head), every row carried a faint in-description "Delete" (59px wrapped rows vs the declared 38px), two of four tabs leaked out of the world (Reports "coming soon" card; Properties grays/pills/2.4:1), mobile buried the ledger under ~800px of apparatus, and the two likeliest session-enders (export, delete) were silent and undo-less. Detector: 6 advisory findings; five low-contrast grays on Properties confirmed live.

## Refinement (full sweep, user-confirmed; chronology forced)

- The ledger opens chronological (sort removal disabled); descending freezes the rail to chronological accumulation with a visible caveat; carried-forward labels from the max displayed date.
- Delete is a reserved trailing hover/focus-revealed icon cell; rows one line at 39.8px; the confirm receives focus and Escape/Keep returns it; below sm it is a bottom sheet with 44px targets.
- Reports left the nav; Properties passed (13.62:1 ink, squared marks, ruled skeleton, hairline hover).
- Focus discipline: print-green rings on rail/toggle/nav/delete; the toggle labeled; one h1 per page.
- Mobile: filters behind an active-count disclosure; ledger in the first screenful (579px); sticky date column; dialog margins below sm.
- Honesty: the "Recorded in this browser · CSV is your backup" footer, the export toast, the 5-second delete undo (restores the original id), the trend's zero months omitted.
- All mechanical minors fixed (strip top edge solid print, mono dates in forms, 36px dialog buttons, ramp drift cleared). Suite 31/31 via committed-tree proof; detector 6 → 1 (the owned-scrollbar idiom, contextual). The stale "Smoke Probe" dev row deleted from the DB.

## Deferred (recorded for a future change, not silently dropped)

The form's greeting (Expense default, no memory of the last line), recents/clone/batch entry, entry editing (no undo for a mis-keyed amount beyond delete+retype), the PropertyModal's native checkbox and pending spinner, durability beyond the disclosure footer, and the /reports placeholder route.

---

# Round two — 2026-11-21 (critique 25/40 → this pass)

## Findings that drove it

A2/B2 scored 25/40 (21 prior). Round-one fixes verified as strengths. New P0s from harder measurement: the sheet broke one-line density at real widths (Description 110px at 1280, rows 78-96px) and the rail printed fictional accounts under filters/amount-sorts (only date-desc had its caveat). P1s: dialog close dumped focus to body; no filter reset or accelerators. P2: Properties was the off-world card grid. Detector residue: a 1.23 type step, the /properties h1→h3 gap, one wide-tracked sublabel, four 11px prose lines.

## What landed (user-confirmed: both P0s, rail speaks for the book, full sweep)

- One-line rows hold at 1280 and 1440 (39.84px, real 40-60-char descriptions, the app's own category names); the sheet floors at 55rem; blank ruled lines match the entry rhythm.
- The rail always audits the book (every entry, date-ascending) with the caveat "Balance follows the book, not this view" whenever the display differs — verified under Type=Expense and Amount-sort; no caveat in the book's own order.
- Dialog close returns focus to the trigger via Radix's onCloseAutoFocus; Reset filters appears when filters are active; "/" focuses search; Record & new keeps the form open.
- Properties is a ruled register: one line per property with Income/Expenses/Net verified against the book (P0 +₱74,000; P1 −₱8,230.65; the register's all-properties net equals the rail's book net), squared Active mark, the ledger's delete idiom.
- Every minor cleared: document.title, active tab 600, validation naming only the actually-missing fields (native bubbles removed — one validation voice), strip Income green, 44px touch targets, the type step 1.31-1.36, /properties h1→h2, sublabel tracking 0.05em, spans not nested headings, the bottom sheet out of the desktop DOM.
- Suite 31/31 via branch proof; detector: /properties clean except the brief-pinned paper; /transactions and /overview show only the two contextual flags (dev-only headings, committed palette).

## Still deferred (recorded)

The form's Expense-default greeting, recents/clone, entry editing, PropertyModal's native checkbox and pending spinner, durability beyond the footer disclosure, the /reports placeholder.

---

# Round three — 2026-11-22 (critique 28/40 → this pass)

## Findings that drove it

A3/B3 scored 28/40 ("Good — deductions cluster on data integrity, not style"). One P0: the date pipeline used the platform's laziest idiom (toISOString / the bare ISO constructor) — the form defaulted to UTC's date (verified: local Nov 22, form Nov 21), formatDate parsed stored strings as UTC midnight (a day early west of UTC), and month keys followed toISOString. P2: the export wrote a different slice than the page showed, undisclosed. Minors: "2 entries" with no "of 10", no skip link (~14 Tabs to the ledger), 16px sort targets, a caveat that didn't say why, two ink primaries on Properties, and A3's one unreproducible stale-store episode (page showed its empty state while storage held 10 lines).

## What landed (user-confirmed: date P0 front, displayed-slice export, full-sweep minors)

- The pipeline tells the local truth, verified by script under `TZ=Asia/Manila` and `TZ=America/New_York` against the app's own module functions: the form's blank line derives from local parts (`localDateString`, never toISOString — whose UTC day is yesterday's page at Manila 02:00, tomorrow's at New York 19:00); `formatDate` parses 'YYYY-MM-DD' as a calendar string (a stored '2026-11-22' renders "Nov 22, 2026" in both zones; the retired derivation printed Nov 21 in New York); month/current-month keys come from stored strings' own parts and local now-parts (`localMonthKey`, day pinned to the 1st so a 31st can never skip a bucket); the carried-forward label and the export filename stamp follow the same rule (no bare ISO constructor on a stored string survives).
- Export follows the displayed slice: the ledger's interactive filters lifted into a small zustand store (`ledgerFilterStore`) the shell reads — no prop corridor; the control and stamp read "Export CSV · All entries" at rest (displayed = the book, the backup promise holds exactly) and "· Displayed ledger" whenever anything narrows; the download filename names the slice; Overview keeps totaling the pure scope, never the ledger's apparatus.
- Minors: the count caption reads "N of M entries" while a filter hides lines; a skip link is the document's first Tab stop, quiet until focused, landing on #main-content (the ledger's heading region); sort headers are 44px targets grown by padding; the caveat names why — "Balance follows the book · this view is filtered" / "· sorted newest first" / both; the rail's Add Property demoted to the quiet outline (one ink primary per screen, the masthead's).
- Stale-store attempt (one targeted pass, live): synthetic storage events, rapid filter/sort mutations, and a visibility flip with 60 cross-tab writes/removes produced zero empty-state samples over a held book — but a direct SSR load of /transactions with the module scripts held back two seconds reproduced the symptom decisively (126 of 127 samples painted "No entries" while storage held 10 lines): the server snapshot is '[]' by design, so a lagging hydration window claims a blank book. Root cause confirmed; fix: the empty state is mount-gated (the blank ruled lines' own pattern — server and client paint identically, the first honest paint is silent). Re-run after the fix: 0 of 127 samples; the mid-session vectors stay unreproduced.
- Suite 31/31 via throwaway-branch proof (the git-clean build gates demand a committed tree; the proof branch was dissolved after, work restored uncommitted); web production build (client + SSR) green; tsc/eslint/prettier clean.

## Still deferred (recorded, unpicked)

The reading-column rebalance (description truncation at 1280), Unknown-Property denormalization + property-delete line warning, the undo snackbar re-pin + permanent-deletion status + edit path, the filtered-empty "No matches" wiring.
