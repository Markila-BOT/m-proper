## Why

The repo has zero automated verification — no cargo tests, no web test framework, no CI — and all three main specs are bullet-style, which the extraction contract (acceptance-test-authoring's `EXTRACTION.md`) treats as a hard error, so none of the committed behavior can be executed today. This change adopts the cucumber-js acceptance suite as the project's only automated verification gate: fence the specs so they run, then build the harness that runs them.

## What Changes

- **BREAKING** — Fence the three main specs (`properties`, `web-app`, `dependency-maintenance`) in place: behavior-preserving, wording adjusted only as bullet steps become valid Gherkin. Committed spec files change shape, and the extraction contract hard-errors on the old bullet style thereafter.
- Rewrite `dependency-maintenance`'s durable requirements into automatable form (e.g., manifest scan, policy-in-ADR discoverability, OpenAPI shape, build gates) and drop its one-time procedural scenarios (e.g., baseline capture, parity screenshots, the earlier upgrade's live smoke). This travels as that capability's own fenced delta — MODIFIED entries for the rewrite, REMOVED entries for the dropped scenarios — landing in `openspec/specs/dependency-maintenance/spec.md` at sync; their repeatable counterparts are executed *by* the acceptance suite, and no requirements migrate between capabilities.
- Add `acceptance-tests/` as an independent Node project at repo root (cucumber-js): pack files copied verbatim, whose default run executes the effective spec — all main specs with active deltas applied, superseded rules never reaching the runner — and leaves a run report; generated directories are gitignored and rebuilt per run.
- Add Playwright inside `acceptance-tests/` so `web-app`'s five browser scenarios genuinely execute (boot API and web dev server, drive the real UI, seed/clear localStorage) — the pack's page objects are HTTP-and-cheerio by contract and cannot drive browser behavior.
- Suite invariants: boot the app before the run and shut it down after; run against whatever `DATABASE_URL` is set, creating and deleting only the suite's own smoke rows; a missing required variable — at minimum `DATABASE_URL` — fails preflight with the variable named.
- Add a root `test:acceptance` script that shells into `acceptance-tests/`.
- Pin all new dependencies with explicit carets per ADR-0001 (`@cucumber/cucumber`, `glob`, `cheerio`, `gherkin-lint`, Playwright); no version left as a dist-tag.
- A green effective suite with zero pending/undefined steps becomes the automated-verification gate for sync/archive; work follows zone discipline — one specs-zone commit (the fencing plus this change's two deltas) first, then code-zone harness commits, then one step-definition task per pending scenario, red to green each.

## Capabilities

### New Capabilities

- `acceptance-suite` — the cucumber-js harness as durable, spec'd behavior: effective-spec extraction, app boot/teardown around each run, Playwright-driven browser scenarios, smoke-row hygiene against `DATABASE_URL`, preflight env checks, run reports, and the green/zero-pending gate for sync/archive.

### Modified Capabilities

- `dependency-maintenance` — durable requirements rewritten into automatable form; one-time procedural scenarios dropped as REMOVED entries. Delta spec, fenced, landing in its own main spec at sync.

_No deltas for `properties` or `web-app`: they are fenced in place and their spec-level behavior is unchanged._

## Impact

- Code: `acceptance-tests/` (pack files, runner wiring, Playwright steps and page objects, bootstrap/teardown); a root `test:acceptance` entry; root `.gitignore` gains the generated-directory entries.
- Artifacts: `openspec/specs/{properties,web-app,dependency-maintenance}/spec.md` fenced in place; this change adds the `acceptance-suite` delta spec and the `dependency-maintenance` delta.
- Dependencies: `@cucumber/cucumber`, `glob`, `cheerio`, `gherkin-lint`, Playwright — explicit carets per ADR-0001, majors reviewed individually, no dist-tags.
- Verification: this suite becomes the project's only automated verification and the automated gate for sync/archive; git-discipline gates from `AGENTS.md` still apply alongside it. A discovered spec/code mismatch blocks this change's own archive until a follow-up change resolves it — the gate is never silently waived. Adopting spec-as-source as the standing verification mechanism is durable and is recorded as an ADR by this change's adr artifact.

## Non-goals

- No product-code refactors: the architecture review's candidates — dead auth twins deletion, formatter/icon dedup, transactions module home, generated wire contract, tab routing — are separate changes; the first two are the NEXT change and will ride this suite.
- No CI pipeline — the suite is local-first; pipeline wiring is its own change.
- No changes to the Rust API or the web app's behavior; a mismatch the suite uncovers becomes follow-up work, not a fix smuggled into harness commits.
- No TypeScript 7 migration; no visual redesign work (that proceeds separately under its own direction contract).
