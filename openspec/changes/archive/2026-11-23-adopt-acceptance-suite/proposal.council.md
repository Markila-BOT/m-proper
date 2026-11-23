# Council Notes: proposal.md

## Author Summary

Drafted around the verified extraction hard-error (unfenced bullet specs cannot execute) with two capability claims: a new `acceptance-suite` delta and a MODIFIED `dependency-maintenance` delta; marked only the in-place fencing **BREAKING**; kept runner mechanics inside the capability rather than the bullets.

## Reviewer Challenges

- "repeatable verification moving to acceptance-suite" read as content relocation between capabilities; the dropped scenarios also had no stated delta operation.
- The green gate plus the no-product-fix non-goal left the change's own endgame unresolvable: a discovered mismatch makes the suite red with the fix out of scope.
- "nothing else gates sync/archive" overclaimed against AGENTS.md's git-discipline gates.
- PORT-as-required-preflight and the "(today the Supabase session pooler)" parenthetical were unverified specifics.
- "format-only" overclaimed: bullets are not Gherkin steps, so conversion rewords; and the specs-zone commit also carries the deltas.
- The C1–C6 non-goal anchored to an unresolvable reference (the review is not a committed artifact).
- Script names, report paths, and wipe/rebuild policy were runner mechanics in What Changes.
- Three factual anchors (EXTRACTION.md, the cheerio/HTTP page-object limit, the parenthetical scenario lists) were flagged as unverified.

## Resolutions

- Accepted: reworded to "executed *by* the acceptance suite — no requirements migrate between capabilities"; the delta now expresses the rewrite as MODIFIED entries and the dropped scenarios as REMOVED entries.
- Accepted: added the mismatch-blocks-archive sentence — the gate is never silently waived.
- Accepted: qualified to "the automated gate for sync/archive; git-discipline gates still apply alongside it."
- Accepted with verification: PORT defaults to 3000 in the API's config, so preflight names `DATABASE_URL` as the minimum, not PORT; the pooler parenthetical generalized to "whatever DATABASE_URL is set".
- Accepted: "behavior-preserving, wording adjusted as bullets become valid Gherkin"; the specs-zone commit is named as fencing plus the two deltas.
- Accepted: the C1–C6 non-goal now names the candidates plainly; "explicitly" dropped.
- Accepted: script names, report path, and wipe/rebuild policy moved out of the proposal (they land in design.md).
- Rejected: the three flagged anchors are session-verified facts (EXTRACTION.md read in full; the pack's page-object contract is HTTP-and-cheerio by SETUP.md; the parentheticals describe the current main spec, authored this session) — but the parentheticals were softened with "e.g." so the delta author derives scope from the current spec text.

## Remaining Risks

- Effective-spec coupling: if another change is active at run time, its deltas join the run and couple this change's archive to step coverage it never promised — true today only for this change itself.
- Port squatting on the dev defaults (3000/3001 held by foreign processes today) means the harness needs port-flexible boot wiring; that is a design/tasks concern, not a proposal one.
- The suite is the project's only automated verification: a red suite has no second instrument to arbitrate.
