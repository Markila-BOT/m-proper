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
whole suite, a fresh context per scenario, closed after the run). The browser
binary is installed once with `npx playwright install chromium` — the suite
signs in through the real sign-in page, so without it no session exists and
API/browser steps fail naming the missing binary.

## Signed-in identities and disposable accounts

The suite runs as real landlords. `acceptance-tests/.env.local` (gitignored;
never commit it) supplies:

- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` — the Auth admin key, used
  only by Node to create, confirm, and remove disposable accounts;
- `TEST_OWNER_A_ID` and `TEST_OWNER_B_ID` — the seeded owners' Auth ids;
- `SEED_OWNER_EMAIL`/`SEED_OWNER_PASSWORD`,
  `SEED_A_EMAIL`/`SEED_A_PASSWORD`, `SEED_B_EMAIL`/`SEED_B_PASSWORD` — the
  seeded credentials.

The harness signs the primary owner (test owner A) in once per origin through
the real sign-in page at boot, saves the Playwright `storageState`, and gives
every scenario context that state. Cookies do not cross origins, so the
suite-minus-self child signs in again in its own process against its offset
web port; each origin caches exactly one session. Test owner B is available
through the same cache under its own identity key (and
`authState.newContextForIdentity`), so isolation scenarios get B's own context
rather than sharing A's.

Sign-up, sign-out, and password-reset scenarios must not use the shared
owner. They create a disposable identity through the Auth admin API
(`world.createDisposableIdentity()` or
`world.createUnconfirmedDisposableIdentity()`), which returns
`{ id, email, password, confirmed }`. Disposable addresses begin
`acceptance-disposable-`; the delete guard refuses any other address, so the
three seeded owners can never be removed. The After hook deletes each
scenario's identities even when it failed, and AfterAll sweeps the run-wide
registry.

The API and web app processes are started without the admin key or seeded
passwords, and every sign-in asserts that the page's cookies and storage do
not contain the admin key. Admin calls stay in Node.

A single harness scenario can be run while developing:

```sh
cd acceptance-tests && npx cucumber-js --name "The suite runs signed in"
```

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

### Verifying one change

`HARNESS_CHANGE=<change-id>` narrows a run to the source-of-truth specs plus
**only** that change's delta, so a change can be verified before the other
active changes' scenarios are implemented:

```sh
cd acceptance-tests && HARNESS_CHANGE=landlord-accounts npx cucumber-js --dry-run
cd acceptance-tests && HARNESS_CHANGE=landlord-accounts npm test
```

- Unset (the default) is exactly the full effective spec above.
- Set, the composition uses `openspec/specs/` as-is plus
  `.extracted/changes/<change-id>/specs/**/*.feature`. Other active changes'
  deltas are excluded and named in the composition report, so the report
  stays honest about what was left out in both modes.
- The id must name an active change with at least one delta; an unknown or
  archived id fails the run naming the missing delta.
- The supersession self-check composes its own throwaway change's scope
  (it runs its discovery child with `HARNESS_CHANGE=__superseded_probe__`),
  so another active change that supersedes the same requirement cannot
  collide with the probe, whatever scope the caller's run uses.
- `npm run test:specs` still executes only `openspec/specs/` (its profile
  overrides the composed paths), so `HARNESS_CHANGE` does not change what that
  run executes.

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

- After every scenario the Before-side sweep clears every
  `landlord-transactions*` key and the persisted property selection before the
  scenario's first page script, and the After hook clears them again, asserts
  none survived (naming any that did), and deletes its smoke rows through the
  API; AfterAll sweeps any leftover probe rows through the still-running API
  before shutting down.
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

One deliberate local extension: `openspec-effective-paths.cjs` carries the
opt-in `HARNESS_CHANGE` scope documented above. It is a superset of the pack
file (unset behaves exactly as the pack does), and it should be folded back
into the pack before the pack is re-copied over it.

`suite-minus-self.cjs` and `suite-discovery.cjs` are not pack files: they
are this harness's own child-run configurations (same extraction and
composition, different paths and output files), maintained here.
