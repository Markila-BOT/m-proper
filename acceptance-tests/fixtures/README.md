# Acceptance fixtures

Inputs the acceptance suite hands to commands it does not own. Nothing here is
read by the application: these files describe the *world* a deployment check,
a release, or a live smoke finds when a scenario runs it.

Two fixture families live here, both following the same pattern: one
`complete.json` holds a whole, valid input, and every other file holds only
the difference a scenario needs. The step definitions deep-merge the variant
over `complete.json`, and the literal `"{{remove}}"` removes a key (so
"without a function region" is written as `{"vercel": {"region":
"{{remove}}"}}`). `null` is a value, not a removal — `auth.captcha: null`
means "no CAPTCHA provider is configured". The merged document is written to a
run-scoped temporary directory; the committed fixtures never change and no
generated copy lands in the repository.

## `production-declarations/`

The checked-in production declaration (`deploy/production.json` in the design)
as the scenarios see it. Identifiers only — never a secret.

| File | Describes |
| --- | --- |
| `complete.json` | Every required field: Hobby Vercel project rooted at `web` on `sin1`, `release` as the production branch, the Free Supabase project, the transaction/session pooler ports, the exact production auth origin, and closed production sign-up. |
| `missing-region.json` | The complete declaration without `vercel.region`. |
| `vercel-pro.json` | A paid Vercel plan (`pro`). |
| `wildcard-origin.json` | An origin carrying a wildcard (`https://*.vercel.app`). |
| `wrong-region.json` | A region other than `sin1` (`iad1`). |
| `shared-production-ref.json` | The production and preview project references are the same value. |
| `wildcard-auth-origin.json` | The production redirect allowlist admits a preview wildcard. |
| `open-signup-without-captcha.json` | `auth.productionSignup: "open"` with no CAPTCHA provider. |

### The seam the deployment check must accept

The step definitions run:

```sh
pnpm run deploy:check -- --declaration <merged-declaration>.json
```

and also export `DEPLOY_DECLARATION=<merged-declaration>.json`. An
implementation that honours either one satisfies the scenarios. Everything
else — the production variable set — comes from the child process
environment, built from `support/production-fixtures.js`
(`PRODUCTION_ENV_BASELINE`, with deliberately fake sentinel values so "no
configured value appears in the output" is checkable).

The report the check prints is what the scenarios assert on. It must name the
fields it rejects (`region`, `vercel plan`, `origin`, `production auth
origin`, `production`/`preview`, `DATABASE_URL`/`DIRECT_DATABASE_URL`,
`SUPABASE_JWKS_URL`, `captcha`) and, on success, state:

- the project, region, branch, and production origin;
- `production branch: release` and `only production branch`;
- `integration branch: master`;
- each of `DATABASE_URL` and `DIRECT_DATABASE_URL` as `valid`, with their
  ports, and that the two URLs `differ`;
- the exact production `auth origin`;
- `production sign-up: closed`.

## `release-plans/`

One plan describes a whole release: the gated commit, the endpoints, the
outcome of every gate step, the backup, the migration, the deployments Vercel
reports, the previous production deployment, and what the live smoke finds.

`{{STUB}}` is replaced with the base URL of the run's in-process stub
(`support/stub-release-server.js`) before the plan is written.

| File | Describes |
| --- | --- |
| `complete.json` | Every gate passes, the backup succeeds, the migration succeeds, the deployment matches the gated commit, and the smoke passes. |
| `unit-failure.json` | The unit-test gate step fails. |
| `backup-failure.json` | `pg_dump` fails. |
| `migration-failure.json` | `db:migrate` fails. |
| `without-migration-connection.json` | No session migration connection is configured (the step also blanks `DIRECT_DATABASE_URL`). |
| `moved-master.json` | `master` advanced after the gates started. |
| `deployment-commit-mismatch.json` | Vercel's READY production deployment is for another commit. |
| `smoke-health-503.json` | `/api/health` answers 503. |
| `smoke-stale-row.json` | A previous run left one property carrying the smoke run marker, plus one property that does not. |
| `smoke-failure.json` | The smoke fails at its round-trip step after the deployment. |

### The seam the release command and the smoke must accept

```sh
pnpm run release -- --plan <merged-plan>.json            # RELEASE_PLAN also set
pnpm run smoke:production -- --plan <merged-plan>.json   # SMOKE_PLAN also set
```

Both read the same fixture file: `release` uses the whole plan, the smoke uses
its `smoke` section. The plan's `endpoints` point every outbound call (the
production origin, the Vercel REST API, Supabase Auth) at the stub.

The commands report what they did in a machine-readable line
(`[release] summary: {…}` / `[smoke] summary: {…}`) plus human lines that name
each stage. The scenarios assert on both: the human lines for "stops before
the backup", "names the gated commit and the current tip", "prints the
rollback action", and the summary for "the deployment is not requested", "the
dump is stored off-machine", and "never runs a down migration".

`scripts/release.ts` and `scripts/smoke-production.ts` do not exist yet; until
they do, every scenario in these two families fails at the command with
`ERR_PNPM_NO_SCRIPT`, which is the red state the change expects.
