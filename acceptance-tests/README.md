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
clone needs `npm install` inside `acceptance-tests/` (the harness is an
independent Node project with its own lockfile).

The single test command is the whole workflow: it boots the API and the web
dev server, runs every effective scenario, writes an HTML report, and shuts
both apps down again. The harness owns the app lifecycle — nothing else
needs to be started by hand.

A database connection is mandatory: the suite preflights `DATABASE_URL`
(resolving it from `api/.env` when the environment variable is not set) and
refuses to run any scenario when no connection is resolvable, naming the
missing configuration. Use the `postgresql://` URI from the Supabase
Database settings, not the project `https` URL.

Browser scenarios drive a real Playwright browser, installed with the
harness when the app-boot wiring lands (see `support/hooks.js`).

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

## Runner files are pack files

`extract-gherkin.cjs`, `cucumber.cjs`, `openspec-effective-paths.cjs`, and
`.gherkin-lintrc` are copied verbatim from the acceptance-test-authoring
skill pack. Their destination filenames are load-bearing (`cucumber.cjs`
is discovered by name; the extractor is required by `cucumber.cjs`) — do not
rename or modify them; improvements belong in the pack, not here.
