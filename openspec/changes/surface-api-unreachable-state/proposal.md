## Why

An instrumented debugging session on 2026-11-22 (debug session 311a86, log-proven) caught three separate unreachable-conditions in one day — a stale env var, a stale server env, the API process simply not running — and each rendered the identical silent zero: empty rail, empty register, ₱0.00 totals, indistinguishable from an empty ledger, while the fetch rejected with "Failed to fetch" and the UI said nothing. In an app whose ethic is radical honesty, printing figures the client cannot verify is the book lying by omission; this change makes the web app say what actually happened.

## What Changes

- The web app consumes the error state React Query already exposes and renders **one shared unreachable state** in the three places the silent zero appears today — the property rail, the properties register, and the totals strip scope note — one state, not per-component improvisation.
- That state is an ink-grounded status line in the world's caption idiom, naming the problem and the recovery; the shape is "The ledger server is unreachable — start the API, then reload", the exact copy is the implementer's within the voice. It is part of the page — not a modal, not a toast that vanishes.
- A fenced scenario under `web-app` makes the state testable: the acceptance suite boots the real app against an unreachable base URL and asserts the shared state structurally — one marker present at all three locations, keyed on the state, not on exact prose. The scenario must not depend on React Query's default retry window; disabling or shortening retries for this query is design's call within the no-redesign non-goal.
- No API change — the properties endpoints behave correctly; this is the client's honesty about its own connection.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `web-app` — the spec today says nothing about connection failure, leaving the app's least honest behavior unspecified. The delta adds a requirement — unreachable MUST be distinguished from empty via the one shared state across the three silent-zero locations — plus the fenced scenario above. No existing scenario changes.

## Impact

- Code: the web-app seam where `useProperties` feeds the rail, register, and totals strip, plus one shared status line — and the acceptance suite's new scenario with any steps it needs (the suite is a code project; its feature text grows with this change). No Rust changes.
- Artifacts: this change's delta at `openspec/changes/surface-api-unreachable-state/specs/web-app/spec.md`; the acceptance suite grows 31 → 32 scenarios. The redesign change's suite-minus-self run grows by this scenario on landing; any failure there is this change's to fix before either change archives.
- Parity baselines: no update owed on reachable paths — the unreachable state never renders in suite or audit runs, which always boot a reachable API; DESIGN.md records the state so any future audit that exercises it sees an explained difference, not a regression.
- Dependencies: none — React Query already surfaces the error; nothing new to install.

## Non-goals

- No retry-policy redesign, no offline mode, no caching of last-known data (a future change could show stale data with a staleness mark — possible follow-up, not this one).
- No Rust API changes; the ledger's book-authority semantics are untouched.
- No spec delta for `properties` — the API's behavior is correct; this change is the client's honesty about the connection.
- Failure rendering on any other fetch-fed surface is unchanged (none exists today; the pin prevents scope creep).
- No new dependency, no CI.
