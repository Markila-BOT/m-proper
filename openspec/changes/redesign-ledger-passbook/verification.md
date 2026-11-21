
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
