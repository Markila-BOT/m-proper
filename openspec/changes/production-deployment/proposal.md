# production-deployment

## Why

The app is one deployable unit after `fullstack-tanstack`, but it has no production home: the only Supabase project is development, no Vercel project exists for `m-proper`, and every release would be a hand-run sequence nobody has written down. A stale `general-ledger` Vercel project and GitHub repository compete for the same accounts. This change provisions a **Production environment**, defines a gated **Release**, and removes the duplicate.

## Precondition

1. `fullstack-tanstack` MUST be archived before production cutover so its `deployable-artifact` spec and the updated auth and web specs are in `openspec/specs/`. It is archived; **Preview deployments** may still precede this change's cutover.
2. Vercel Hobby and Supabase Free are the plans for this change. The Vercel project lives under the Hobby team `markilabots-projects` (single member, non-commercial use), and the production Supabase project is the second active project on the Free organization. Supabase Free pauses a project after seven days without activity and has no automated backups; the uptime monitor and the pre-release backup are the mitigations. No paid plan or IPv4 add-on is purchased.
3. Production runs as a **private** instance: Supabase **sign-up** is disabled and the first **Landlord account** is created by an operator. `auth-captcha` is not a cutover blocker, but public sign-up MUST stay closed until it lands; it is a precondition for opening sign-up, not for provisioning or deploying.
4. Provisioning needs an authenticated operator: no Vercel or Supabase credentials live in the repo, and the Vercel CLI is not installed locally. The Hobby team must be able to deploy the private `Markila-BOT/m-proper` repository; if Vercel refuses it, the project moves to the operator's personal Hobby scope.

## What Changes

- **A dedicated production data plane on Free.** Create `m-proper-prod` in `ap-southeast-1` on the Free organization; keep the existing project for development, the **Acceptance suite**, and **Preview deployments**. The Free plan allows two active projects; if the organization is at the limit, delete the inactive `autopilot` project after confirming it is not needed. There is no data migration: the schema comes from the committed Drizzle migrations, and the first **Landlord account** is created by hand afterwards. Production starts empty. The five-minute uptime monitor keeps the production project active so it does not pause for inactivity.
- **The connection split on Free.** The runtime `DATABASE_URL` is the Supabase **Transaction pooler** (port 6543), which `postgres-js` already supports with `prepare: false` and a pool of 3. `DIRECT_DATABASE_URL` is the IPv4-reachable **Session pooler** (port 5432), used only by the migrate and backup steps. The Free plan does not include the IPv4 add-on, so the IPv6-only direct host is not used. The two URLs MUST differ, and `web/scripts/migrate.ts` keeps refusing to fall back to the pooled URL.
- **One Vercel project on Hobby.** Team `markilabots-projects`, project `m-proper`, Root Directory `web`, framework `tanstack-start`, function region `sin1` declared as `regions: ["sin1"]` in `web/vercel.json`, and the production branch set to `release`. `master` stays the integration branch; previews deploy from feature branches. The first preview proves the pnpm workspace install with the root lockfile and the Hobby team's access to the private repository before cutover.
- **A gated release, not Git auto-deploy.** The production branch is `release`, not `master`, because a Vercel Deploy Hook deploys the tip of its configured branch, not the SHA the gates approved. A manual `workflow_dispatch` **Release** workflow runs on `master`, asserts `origin/master` still equals the gated SHA, and runs the **Release gate** (install, lint, typecheck with `pnpm --filter web exec tsc --noEmit`, unit tests, build, spec lint, and `cd acceptance-tests && npm run test:specs`). It then takes the pre-release backup, migrates with `DIRECT_DATABASE_URL` from a protected `production` GitHub environment, and fast-forwards `release` to that SHA. Vercel deploys the exact commit; the workflow waits for the deployment whose SHA matches and fails otherwise. The full `test:specs` and the migration run only here; PR CI stays lean to conserve free GitHub minutes and avoid development-database races. The Deploy Hook remains only for manual redeploys of `release`.
- **The source-of-truth gate is made green.** The `specs` profile's suite-minus-self child currently re-runs the full effective spec, so active, unimplemented changes make `test:specs` red by construction. This change scopes the child to the same main-spec composition as its parent and adds the step definitions for the new capabilities, so `test:specs` can gate a release without waiting for `server-transactions`, `payment-reminders`, or `pointer-affordances`.
- **Migrations move forward only; rollback is code-only.** A failed migration rolls back its transaction and leaves the journal unchanged. Instant rollback promotes the previous Vercel deployment; the schema is not rewound, so every migration must stay compatible with the deployment before it. If the database is ahead of the live code, roll the code back and fix forward.
- **Every release backs up first.** The release takes a logical **`pg_dump`** over the session connection and uploads it as an off-machine GitHub Actions artifact before the migration. A failed dump stops the release before any schema change. This replaces the automated backups the Free plan does not include.
- **Production verification is post-deploy.** The **Live smoke** runs after the deployment is READY: `/api/health` answers 200, `/api/properties` answers 401 without a session, then an admin-issued magic link for a dedicated **Smoke account** (so a later CAPTCHA on interactive sign-in cannot block automation) creates, lists, and deletes its own property. The smoke pre-cleans stale rows by its own name, always removes its row, and names the failed step. On failure the release prints the previous production deployment and the exact Vercel rollback action; it does not attempt a down migration. An external uptime monitor (UptimeRobot free tier) polls `/api/health` every five minutes and alerts by email; it pages on a database outage by design, because `/api/health` is a readiness answer, not liveness.
- **Secrets are split by environment.** PR CI runs install, lint, typecheck, unit tests, build, and spec lint only. The Release workflow's verify job uses a `test` GitHub environment with the development project's database and auth values and runs `test:specs`; a concurrency group serializes it. The release job uses a separate `production` environment holding `DIRECT_DATABASE_URL`, the Vercel token and project/team identifiers, the **Smoke account** address, and the production service-role key. Production secrets are never available to PR runs or the verify job.
- **Private production auth.** Supabase sign-up is disabled in production; the first **Landlord account** is created by an operator. Development and previews keep sign-up enabled. Resend is configured with its test sender, which delivers only to the account owner's inbox; that is sufficient while sign-up is closed and no sending domain is verified. `auth-captcha` plus a verified sending domain are the follow-up that opens public sign-up.
- **One canonical origin.** The **Production origin** is the assigned `*.vercel.app` name, expected to be `https://m-proper.vercel.app`. Provisioning records the actual value and updates the deployment declaration, Supabase Site URL, smoke target, and docs. Production Supabase allows only that exact origin; the development project allows localhost, `127.0.0.1`, and the preview wildcard. Preview credentials point at the development project.
- **`general-ledger` is decommissioned.** Export `git bundle create --all` to an off-machine location and record its digest; confirm inside Vercel that the `general-ledger` project owns no live domain (`general-ledger-two.vercel.app` is `DEPLOYMENT_NOT_FOUND`; `general-ledger.vercel.app` is an unrelated live site); then delete the Vercel project and the GitHub repository after explicit confirmation. `m-property` is untouched.
- **The runbook is committed.** The root `README.md` gains provision-once, release, rollback, backup, smoke, and decommission sections; `web/README.md` records the transaction/session split and the private-production posture.

## Capabilities

### New Capabilities

- `production-environment`: the provisioned runtime as testable configuration — a dedicated Free production Supabase project, a transaction-pooler runtime URL distinct from the session-pooler migration URL, a Hobby Vercel project rooted at `web` in `sin1`, a single production origin, preview/production environment separation, and a fail-fast deployment check that refuses a paid plan until the declaration is deliberately changed.
- `release-pipeline`: how code reaches production — the source-of-truth release gate, the pre-release backup, migrate-before-deploy ordering, the controlled `release` branch advance, deployment-SHA matching, the post-deploy **Live smoke** with its **Smoke account**, and the rollback target.

### Modified Capabilities

- `authentication`: production runs with Supabase sign-up disabled and the first **Landlord account** created by an operator; development and previews keep sign-up open. The existing CAPTCHA and SMTP requirements remain, and public production sign-up stays closed until `auth-captcha`.
- `acceptance-suite`: the `specs` profile and its suite-minus-self child share the main-spec composition, so `npm run test:specs` is a stable release gate while active changes remain unimplemented.

## Impact

- **Code and config** — `web/vercel.json` gains `regions: ["sin1"]`; a checked-in production declaration (team, project, origin, branch, Supabase refs, pooler ports); `scripts/check-deployment.ts`, `scripts/release.ts`, and `scripts/smoke-production.ts` with unit tests; `.github/workflows/ci.yml` and `.github/workflows/release.yml`; the acceptance-suite scope fix and new step definitions under `acceptance-tests/`; root scripts and both READMEs.
- **External systems** — Vercel Hobby project, Supabase Free organization with a second active project, Resend, UptimeRobot, protected GitHub `test` and `production` environments, and the `general-ledger` cleanup.
- **Data** — production starts empty. The only rows created are the first **Landlord account**, the **Smoke account**, and the smoke's own property, which is removed each run. No development rows are copied. Each release stores one pre-release dump off-machine.
- **Costs** — zero recurring: Vercel Hobby, Supabase Free, Resend free, UptimeRobot free, and GitHub Free minutes. The trade is the pause, storage, and support limits below.
- **Risks accepted** — the Free project pauses after seven days without activity (mitigated by the monitor) and has no automated backups (mitigated by the pre-release dump); the database has a 500 MB Free limit; Hobby is non-commercial and has no Pro support; GitHub Free minutes are finite; production ships as a private instance with sign-up closed until `auth-captcha`; the release gate trusts the source-of-truth suite, not the active-change queue; rollback cannot undo a migration; mail is owner-only until a sending domain is verified; deleting the legacy repositories is irreversible beyond the bundle.

## Non-goals

- No custom domain or app DNS/TLS work: the assigned `*.vercel.app` origin is production for now.
- No paid Vercel or Supabase plan, no IPv4 add-on, no automated backup service, and no Pro support.
- No CAPTCHA implementation and no public production sign-up; that is `auth-captcha`.
- No sending-domain verification; Resend's test sender reaches only the account owner.
- No data migration, import, or backfill from the development project.
- No Sentry, APM, logging build-out, or restore drill.
- No product-behaviour change beyond closing production sign-up for the private phase; no routes, schema, or environment-variable names change.
- No rework of `server-transactions`, `payment-reminders`, or `pointer-affordances`.
- No deletion of `m-property` or cleanup of unrelated repositories, branches, or edits.

## Definition of Done

1. The production origin returns 200, and `/api/properties` returns 401 without a session.
2. The **Live smoke** passes and leaves no rows.
3. The uptime monitor delivers one test alert, and the Free project has not paused.
4. A push to `master` produces no production deployment; a preview reads the development project.
5. `cd acceptance-tests && npm run test:specs` is green at the release commit.
6. A pre-release dump is stored off-machine and its location is recorded.
7. No paid plan is active; the production declaration records Hobby and Free.
8. One rollback to the previous deployment is exercised end to end.
9. `general-ledger` is gone; the bundle was explicitly waived by the user on 2026-11-27, and the deletion date is recorded.
