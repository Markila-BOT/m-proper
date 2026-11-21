# Acceptance Tests

cucumber-js harness that executes the OpenSpec Gherkin specs against the
running application. The committed inputs are the specs under `openspec/`;
everything this suite generates (`.extracted/`, `reports/`) is gitignored,
wiped, and rebuilt on every run.

## Running

From the repo root:

```sh
pnpm test:acceptance      # or: npm run test:acceptance
```

which is exactly `cd acceptance-tests && npm test`. First run in a fresh
clone needs two setup steps inside `acceptance-tests/` (the harness is an
independent Node project with its own lockfile):

```sh
npm install                        # harness dependencies
npx playwright install chromium    # one-time Playwright browser binary
```

The suite boots on harness-chosen ports (API 3021, web 3022) so it never
collides with dev servers on the machine's squatted 3000/3001; override with
`HARNESS_API_PORT` / `HARNESS_WEB_PORT` when needed.

The single test command is the whole workflow: it boots the API and the web
dev server, runs every effective scenario, writes an HTML report, and shuts
both apps down again. The harness owns the app lifecycle — nothing else
needs to be started by hand.

A database connection is mandatory: the suite preflights `DATABASE_URL`
(resolving it from `api/.env` when the environment variable is not set) and
refuses to run any scenario when no connection is resolvable, naming the
missing configuration. Use the `postgresql://` URI from the Supabase
Database settings, not the project `https` URL.

Browser scenarios drive a real Playwright chromium (one browser for the
whole suite, a fresh page per scenario, closed after the run). The browser
binary is installed once with `npx playwright install chromium` — without
it, HTTP scenarios still run and browser steps fail naming the missing
binary.

## The effective spec

`npm test` (the default profile) executes the **effective spec**: every
source-of-truth spec in `openspec/specs/` with every **active** change's
delta (`openspec/changes/*/specs/`) applied — exactly what the source of
truth will become once those changes are synced and archived.

- Requirements a delta marks `MODIFIED` or `REMOVED` are superseded: their
  source-of-truth scenarios do not run and are not reported as skipped;
  the delta's replacement scenarios run instead.
- Archived changes (`openspec/changes/archive/`) never execute.
- The run prints a composition report to stderr naming each superseded
  rule and every left-out scenario with its `spec.md` file:line.

`npm run test:specs` is the source-of-truth-only regression run: it executes
`openspec/specs/` as-is, with no deltas applied.

## Extraction and `.extracted/`

Every run re-extracts `openspec/**/spec.md` into `.extracted/` as real
`.feature` files before cucumber-js starts: Markdown headings become
`Feature:`/`Rule:`/`Scenario:` and column-0 ` ```gherkin ` fences hold the
steps, verbatim. Extraction is line-faithful — line N of a `.feature` is
line N of its `spec.md` — so every lint message, failure location, and
line-targeted path points straight at the source spec.

`.extracted/` is generated output: never edited by hand and never
committed. To lint the specs without running them:

```sh
npm run lint:specs
```

extracts, then runs gherkin-lint over `.extracted/` with the pinned
`.gherkin-lintrc`.

## Report

Every run writes `acceptance-tests/reports/cucumber-report.html`. The
`reports/` directory is generated output too — open the report in a
browser after the run; it is not committed.

## The suite verifies itself

The effective spec includes the acceptance-suite capability — scenarios
that describe the harness itself. Three of them spawn child processes:

- **The suite-minus-self child run** (`suite-minus-self.cjs`): the scenario
  "One command runs every committed behavior" re-runs the whole effective
  spec *minus the acceptance-suite feature itself* as a child
  `npx cucumber-js --config suite-minus-self.cjs`. cucumber-js merges CLI
  paths into the profile's paths instead of replacing them, so the
  exclusion lives in that second config file — the feature-list mechanism.
  The child boots its own API and web dev server on offset ports
  (`HARNESS_API_PORT`/`HARNESS_WEB_PORT`/`HARNESS_OPENAPI_PORT`, +10), so it
  cannot collide with the parent run, and writes its own report to
  `reports/suite-minus-self-report.html`. The later self-scenarios ("The
  ledger's browser scenarios run for real", "Archive waits for green") read
  that child run's parsed results.
- **The discovery dry run** (`suite-discovery.cjs`): "Superseded rules never
  reach the runner" dry-runs the full effective spec with a message-only
  formatter — never the default html report, which the parent run owns
  while the child runs.
- **The preflight gate** (`support/preflight.js`): "A missing database
  connection is named" spawns the suite's own pre-boot gate as a standalone
  child with no `DATABASE_URL` and a nonexistent `.env` fallback; it exits 1
  naming the missing configuration before anything boots. It runs
  standalone too: `node support/preflight.js [envFileOverride]`.

**Runtime cost**: the suite-minus-self child run repeats every check-gate
scenario (cargo check, web build, OpenAPI regeneration) with its own app
boot, so a full `npm test` costs roughly twice a non-self-verifying run.
Measured warm (all caches hot, remote Supabase database): ~67s total, of
which the child run was ~32s — about 1.9× the ~35s the parent's own
scenarios take.

## Red by design

The effective spec includes redesign-ledger-passbook's two new ledger
scenarios — the running balance and the column sorting. The web app does
not implement them yet, so those two scenarios fail every run, with failure
messages that name the missing feature, and `npm test` exits non-zero. That
red is the change's work list, documented and expected: the suite goes
green — and its exit code drops to 0 — only when the redesign lands. Do not
delete, skip, or weaken those scenarios to make the suite pass. The child
run's step asserts the failures are exactly this pair and nothing else, so
any other failure is reported as a regression.

## Post-run verification

The harness proves its own cleanup:

- After every scenario the After hook clears the browser storage it seeded
  and deletes its smoke rows through the API; AfterAll sweeps any leftover
  probe rows through the still-running API before shutting down.
- The scenario "The app is alive for the scenarios and gone after" records
  that both harness ports were free before boot and registers a
  post-teardown check; after AfterAll stops both apps, the harness prints
  `[harness] PASS (after teardown): after teardown both harness ports are
  closed (…)`. A FAIL prints and marks the run's exit code non-zero.
- The suite-minus-self child run checks its own ports the same way through
  its own AfterAll; the parent verifies the child's ports are closed.

To verify by hand after a run (nothing should answer):

```sh
lsof -ti :3021 ; lsof -ti :3022   # no pids
curl -s http://localhost:3021/health   # connection refused
```

## Runner files are pack files

`extract-gherkin.cjs`, `cucumber.cjs`, `openspec-effective-paths.cjs`, and
`.gherkin-lintrc` are copied verbatim from the acceptance-test-authoring
skill pack. Their destination filenames are load-bearing (`cucumber.cjs`
is discovered by name; the extractor is required by `cucumber.cjs`) — do not
rename or modify them; improvements belong in the pack, not here.

`suite-minus-self.cjs` and `suite-discovery.cjs` are not pack files: they
are this harness's own child-run configurations (same extraction and
composition, different paths and output files), maintained here.
