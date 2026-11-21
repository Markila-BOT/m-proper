# Verification results — 2026-11-21 (apply session)

## Suite end state

`npm test` (acceptance-tests/): **31 scenarios — 29 passed, 2 failed, 0 undefined; 164 steps — 159 passed, 3 skipped, 2 failed; exit 1 by design.**

- The 2 failures are exactly `redesign-ledger-passbook`'s running-balance and column-sorting scenarios, failing at their intended steps with messages naming the missing feature and the change that owns it. Task 5.1 ("every scenario passes") therefore stays open until that change applies — the planned order, not a defect; the archive gate is never waived.
- The child suite-minus-self run (the "one command" self-scenario) asserts the failure set is exactly that pair, so any other failure reddens the suite as a regression. Runtime: ~67s warm, ~1.9× a parent-only run.
- Leaves-no-trace verified: parent ports 3021/3022 and child ports 3031/3032/3033 free after the run; the harness prints its post-teardown PASS; the ledger holds its four non-suite rows unchanged; the unfenced probe dir removed; HTML reports regenerated.
- Two harness bugs found and fixed mid-build: cucumber-js's default 5s step timeout (now a 25min outer guard) and pre-hydration tab clicks being silently dropped (waits now `networkidle`).

## API trues-ups (all red → green)

- `CORS_ORIGINS` env override: verified replacing the allow-list; default list preserved.
- Bare `DELETE /properties` → **400 envelope** (was 405 via method-router rejection — worse than the plan's 404 prediction).
- `units: -5` → **400** (was silently **accepted at 201** on this table — the migration's check predates the live schema; the spec's 400 was fiction until now).
- `api/openapi.json` regenerated with `ApiEnvelope_*` schemas and response bodies on all properties paths (utoipa 6 `TupleUnit` for the unit envelope — the literal `()` panics its parser); byte-identical on re-export.
- `/health` reuses `db::health_check`; 503 "Database unreachable" proven via a killed TCP proxy mid-run.

## Findings recorded for follow-up changes

1. **422 on omitted keys**: a payload with a required key *omitted* returns axum's default 422 plain text, not the spec's 400 envelope; only empty values reach the 400 validation. The suite passes via the approved empty-value reading. The true-up (serde defaults or a custom rejection mapper) rides the properties domain-module change (C4-full), with a scenario-wording tightening.
2. **Reference-scan removal candidates**: `serde_json` (no name reference in api/src) and `@types/node` (no reference in web scope) — for the dead-sweep rider on C3+C6 to evaluate and retire if confirmed.
3. **Validator tension stands**: `openspec validate --strict` (CLI 1.16) misreads fenced scenarios as missing steps; non-strict plus the suite's gherkin-lint governs. The 2.x CLI upgrade remains the recorded follow-up.

## Evidence paths

- HTML reports: `acceptance-tests/reports/cucumber-report.html` and `suite-minus-self-report.html` (gitignored, regenerated per run)
- Effective composition report: stderr of any run (superseded rules listed with source `spec.md` line numbers)
- Commits: `c21d709` (fencing), `d754ac6` (scaffold), `9598a7b` (API trues-ups), `675476c` (boot + non-browser steps), `0efa925` (browser + self-scenarios)
