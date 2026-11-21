## 1. Specs zone — fencing and deltas (one commit)

- [x] 1.1 Confirm `stack: javascript` is recorded in `openspec/config.yaml` (already committed; no edit)
- [x] 1.2 Fence `openspec/specs/properties/spec.md` — behavior-preserving; bullet scenarios become valid Gherkin steps
- [x] 1.3 Fence `openspec/specs/web-app/spec.md` — same rule
- [x] 1.4 Fence `openspec/specs/dependency-maintenance/spec.md` — format only; the content rewrite rides this change's delta
- [x] 1.5 Re-read both deltas against the fenced mains: MODIFIED requirement and scenario names must match what supersession replaces
- [x] 1.6 Commit the specs zone: fencing plus the `acceptance-suite` and `dependency-maintenance` deltas

## 2. First-time setup — acceptance-tests/ (skip this section if it already exists)

- [x] 2.1 Create `acceptance-tests/` as an independent Node project: its own `package.json`, devDependencies `@cucumber/cucumber`, `glob`, `cheerio`, `gherkin-lint` at explicit carets
- [x] 2.2 Copy the pack files verbatim — `extract-gherkin.cjs`, `cucumber.cjs`, `openspec-effective-paths.cjs`, `.gherkin-lintrc` — destination filenames are load-bearing
- [x] 2.3 Wire hooks that boot the API and the web dev server on harness-chosen ports (PORT override, VITE_API_BASE_URL wiring) before the suite and shut both down after
- [x] 2.4 Add preflight: fail before any scenario, naming the missing variable, when the database connection is absent
- [x] 2.5 Make the single test command always generate an HTML report under `acceptance-tests/reports/`
- [x] 2.6 Add the spec-lint command: extract, then `gherkin-lint .extracted`
- [x] 2.7 Gitignore `acceptance-tests/.extracted/` and `acceptance-tests/reports/` in the root `.gitignore`
- [x] 2.8 Add Playwright at an explicit caret and document its browser-binary install step
- [x] 2.9 Add the root `test:acceptance` script
- [x] 2.10 Write `acceptance-tests/README.md`: how to run the suite and where the report lands
- [x] 2.11 Verify extraction and discovery end to end: dry-run resolves only `.extracted/` paths, nothing under `changes/archive/`
- [x] 2.12 Commit the harness (code zone)

## 3. API trues-ups the suite depends on (code zone, one commit each)

- [x] 3.1 Add `CORS_ORIGINS` to `Config::from_env` (comma-separated, defaulting to today's allow-list) and thread it into `create_router` — red → green → commit
- [x] 3.2 Make delete-without-id reachable: the bare `DELETE /properties` path answers the spec's 400 envelope instead of the 404 fallback — red → green → commit
- [x] 3.3 Validate `units` in the create handler (zero or greater) so a negative value answers 400, not the migration's 500 — red → green → commit
- [x] 3.4 Teach utoipa to emit the envelope and response bodies, regenerate `api/openapi.json`, and confirm the committed document now contains the `{ success, message, data? }` shapes — red → green → commit
- [x] 3.5 Make `/health` reuse `db::health_check` so readiness tells the truth mid-run — red → green → commit

## 4. Step definitions — one per pending step; red → green → commit each

- [x] 4.1 Given the dependency manifests at their committed state — red → green → commit
- [x] 4.2 Manifest scan: every entry a concrete constraint, no dist-tag — red → green → commit
- [x] 4.3 Reference scan: each entry referenced; an unreferenced one is named — red → green → commit
- [x] 4.4 Lockfile-vs-range comparison: every resolved version satisfies its declared range — red → green → commit
- [x] 4.5 Accepted-ADR scan: the policy and every deferred major are discoverable — red → green → commit
- [x] 4.6 OpenAPI regeneration compare: regenerated document matches the committed one — red → green → commit
- [x] 4.7 Properties round-trip through the running API: create, list, delete; envelope and camelCase intact — red → green → commit
- [x] 4.8 API check gate: the API check command completes without errors — red → green → commit
- [x] 4.9 Web build gate: client and server builds complete without errors — red → green → commit
- [x] 4.10 Client requests the properties list — ordered rows, or an empty array — red → green → commit
- [x] 4.11 Valid property POST — persisted, 201, success envelope — red → green → commit
- [x] 4.12 Missing required fields POST — 400, nothing persisted — red → green → commit
- [x] 4.13 Invalid property type POST — 400, nothing persisted — red → green → commit
- [x] 4.14 Delete by id — removed, success envelope — red → green → commit
- [x] 4.15 Delete without an id — 400, success false — red → green → commit
- [ ] 4.16 The user opens the application with the API available — properties display — red → green → commit
- [ ] 4.17 The user submits a valid new-property form — created through the API, shown in the list — red → green → commit
- [ ] 4.18 The user deletes a property — removed through the API, gone from the list — red → green → commit
- [ ] 4.19 The user records a transaction and reloads — still available in the UI — red → green → commit
- [ ] 4.20 The API base URL is configured — list, create, and delete target that base — red → green → commit
- [ ] 4.21 The single test command runs the effective spec and leaves a report — red → green → commit
- [ ] 4.22 An unfenced scenario fails extraction naming the file and line — fixture-based — red → green → commit
- [ ] 4.23 A superseded rule is not executed and not reported skipped — this change's own delta proves it — red → green → commit
- [ ] 4.24 The app is alive for the scenarios and shut down after the run — red → green → commit
- [ ] 4.25 Browser scenarios execute in a real browser; no session remains after — red → green → commit
- [ ] 4.26 Smoke rows and browser-stored state are removed after the run — red → green → commit
- [ ] 4.27 A missing database connection is named and nothing runs — red → green → commit

## 5. Completion

- [ ] 5.1 Run the full suite: every scenario passes, zero pending or undefined steps, HTML report generated
- [ ] 5.2 `openspec validate` non-strict is clean (zero errors); the strict fenced-format warnings stay documented as the known validator tension
- [ ] 5.3 Confirm the ledger holds no smoke rows after the run and no generated directory appears in `git status`
