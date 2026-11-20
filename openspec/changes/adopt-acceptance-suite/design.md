## Context

The project has three main specs (`properties`, `web-app`, `dependency-maintenance`) in bullet scenario style, zero automated verification of any kind, and `spec-as-source` newly enabled with `stack: javascript`. The acceptance-test pack's extraction contract hard-errors on any `#### Scenario:` without a gherkin fence, so the committed behavior cannot execute today and the promised executable specs cannot run until the specs are fenced. The pack defines an independent cucumber-js project whose default run executes the effective spec — all main specs with active deltas applied — and whose green run with zero pending steps gates sync and archive.

Diagram assumptions (C4-inspired, plain Mermaid, container level): the harness is a new container beside the app containers; no runtime boundary of the app changes.

```mermaid
flowchart LR
  S[(openspec/ specs + deltas)] -->|extract, line-faithful| E[".extracted/ (generated)"]
  E --> R[cucumber-js runner]
  R -->|boots and stops| A[api: Axum]
  R -->|boots and stops| W[web: TanStack Start]
  R -->|drives| B[Playwright browser]
  B --> W
  A --> DB[(Supabase Postgres)]
  W --> A
  R -->|run report| P[acceptance-tests/reports/ (generated)]
```

- The harness owns the app lifecycle: both containers are up for the run and down after — one command is the whole workflow.
- The only committed inputs are the specs; `.extracted/` and `reports/` are generated, gitignored, wiped per run.
- No seam inside the app containers changes; the harness adapts to them through env (ports, base URL).

## Goals / Non-Goals

**Goals:**

- Make every committed scenario executable: fenced specs, extracted per the contract, run by one command.
- Give the browser scenarios a real browser, the API scenarios a real running API, and the manifest/ADR scenarios plain file access.
- Establish the green/zero-pending run as the automated verification gate for sync/archive.

**Non-Goals:**

- Product-code refactors (C1–C6 from the architecture review; the dead-auth deletion and formatter dedup are the next change).
- CI wiring, TypeScript 7, the visual redesign (separate contract).

## Decisions

**1. Direct fencing plus two deltas.** The three main specs are fenced in place (behavior-preserving, wording adjusted only as bullets become valid Gherkin) in one specs-zone commit; the change's own behavior claims ride as the `acceptance-suite` ADDED delta and the `dependency-maintenance` MODIFIED/REMOVED delta. A delta-only route cannot work: extraction hard-errors on the unfenced main specs, so the suite could never run green before archive.

**2. MODIFIED keeps scenario names, rewrites steps.** A MODIFIED requirement replaces its whole block and archive refuses to drop scenarios, so each rewritten requirement keeps the current scenario names and rewrites only their Given/When/Then content; the unreferenced-dependency scan joins the version-ranges requirement as an added scenario, and the dropped procedural requirements leave as explicit REMOVED entries with reason and migration.

**3. Playwright inside the harness project.** The pack's page objects are HTTP-and-cheerio by contract; `web-app`'s scenarios need a real browser. Playwright lives in `acceptance-tests/` with an explicit caret per ADR-0001 — the web app's own dependencies stay untouched.

**4. Env-flexible boot with a naming preflight.** Both apps already boot from env (the API reads `DATABASE_URL`/`PORT` with defaults; the web dev server takes its own port and `VITE_API_BASE_URL`). The harness boots them with its own port choices — the machine's 3000/3001 are foreign-occupied today — and fails before any scenario, naming the missing variable, when the database connection is absent. The suite creates only its own smoke rows and deletes them; browser-stored state is cleared with the run.

**5. Non-strict validation is the operative gate for fenced content.** `openspec validate --strict` fails on fenced scenarios because its step heuristic expects `- **WHEN**` bullets; the spec-as-source format overrides the schema template, and strict's warnings are false positives (16 on this change, zero errors). Runs gate on non-strict (errors still fail) plus the suite's own gherkin-lint. The likely cure is the OpenSpec 2.x CLI (available: 2.1.0 vs installed 1.16.0); that upgrade is recorded as follow-up, not smuggled in here.

**6. Zone discipline orders the commits.** One specs-zone commit (fencing + deltas), then code-zone commits (pack files, harness wiring, Playwright, gitignore entries, root script), then one step-definition task per pending step, red to green each, each with its own commit; `tasks.md` updates ride along zone-neutrally.

## Risks / Trade-offs

- [Effective-spec coupling] -> Any other active change's deltas join the run; today the only active change is this one, so the gate is self-contained.
- [A suite red on a genuine spec/code mismatch] -> Blocks this change's own archive until a follow-up change resolves it — the gate is never waived, by decision.
- [Dev-port squatters (MatterWorx on 3000, a stale socket on 3001)] -> The harness picks its own ports and wires the web app's base URL to them.
- [Run cost: cargo build + vite boot + browser] -> Minutes, not seconds; the suite is the whole verification story, so it stays a deliberate, run-on-demand gate rather than a watch loop.
- [Strict-validator tension] -> Documented above; non-strict plus gherkin-lint governs until the CLI upgrade.

## Migration Plan

1. Specs zone: fence the three main specs in place; author the two deltas; commit.
2. Code zone: create `acceptance-tests/` (pack files verbatim, package.json with carets, gitignore entries), wire boot/teardown with port overrides and preflight, install Playwright, add the root `test:acceptance`, write the README; commit.
3. Steps, red to green, one commit each: manifest/ADR/openapi gates, API round-trip, browser scenarios, harness self-scenarios.
4. Full suite green with zero pending; report generated; `openspec validate` non-strict clean.

## Open Questions

- None block this change. The CLI 2.x upgrade (which likely teaches strict validation the fenced format) is follow-up work under ADR-0001's major-review rule.
