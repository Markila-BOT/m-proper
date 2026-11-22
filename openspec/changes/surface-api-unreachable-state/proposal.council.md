# Council Notes: proposal.md

## Author Summary

Drafted from the logged 2026-11-22 incident (three unreachable-conditions, one silent zero), classified as a Modified `web-app` delta with one ADDED requirement, copy constrained but not fixed, test mechanics deferred to design.

## Reviewer Challenges

- The "parity audit needs no update — API contract untouched" clause reasoned from the wrong domain; the audit compares post-change UI against a baseline, and this change adds a new visible state.
- The 31 → 32 suite growth omitted its coupling: the redesign change's suite-minus-self run asserts zero failures, and the new scenario joins it on landing.
- "Wherever the silent zero appears today" was unbounded prose against a three-location pin.
- The scenario had no assertion key — prose freedom in one bullet versus "asserts all locations speak" in another.
- React Query's default retry window would leave seconds of silent zero and make a real-browser scenario slow or flaky; the draft never named it.
- "Code: web app only" contradicted the suite edits two lines below.
- The Why's "A live smoke" framing misfitted the glossary (one condition had the API down).

## Resolutions

- Accepted with the fact that settles it: suite and audit runs always boot a reachable API, so the unreachable state never renders in them — the Impact now says no update owed on reachable paths, with DESIGN.md recording the state so any future audit sees an explained difference.
- Accepted: the suite-minus-self coupling is stated — any failure there is this change's to fix before either change archives.
- Accepted: "the three places the silent zero appears today" — definitive enumeration; a non-goal pins other fetch-fed surfaces as unchanged (none exist).
- Accepted: the scenario asserts one shared structural marker present at all three locations, not prose.
- Accepted: the retry window is named — disabling or shortening retries for this query is design's call within the no-redesign non-goal.
- Accepted: the Code line now includes the suite's scenario and steps.
- Accepted: the incident is "an instrumented debugging session", not a live smoke.
- Author Notes stripped (not a schema section).

## Remaining Risks

- Error-class breadth (network rejection vs 5xx vs malformed body) is design's to decide so the scenario and copy agree.
- The totals-strip slot (₱0.00 suppressed or shown beside the state line) is design's to decide and the parity baseline's to know.
