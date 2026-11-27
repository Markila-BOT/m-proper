# Tasks

## 0. Preconditions

- [x] 0.1 `fullstack-tanstack` is archived (commit `aa6a2d6`); confirm `deployable-artifact` and the updated auth and web specs are in `openspec/specs/`
- [x] 0.2 Confirm the Vercel team is on Hobby and the Supabase organization is on Free; record the two-active-project limit, the inactivity-pause rule, and the no-automated-backup rule
- [ ] 0.3 Confirm an authenticated operator is available for Vercel and Supabase provisioning; confirm the Hobby team can deploy the private `Markila-BOT/m-proper` repository; confirm no credentials are in the repository
- [ ] 0.4 Record the origin Vercel assigns to the project (expected `https://m-proper.vercel.app`) and the production Supabase project reference

## 1. Acceptance tests first (senior-qa)

- [x] 1.1 Add `acceptance-tests/step-definitions/production-environment.js` for every `production-environment` scenario, driving the deployment check with fixture declarations; run them and confirm they fail because the check does not exist
- [x] 1.2 Add `acceptance-tests/step-definitions/release-pipeline.js` for every `release-pipeline` scenario, including the failed-backup and backup-before-migration cases, driving the release command with a fixture plan and a stub HTTP server; run them and confirm they fail because the release command does not exist
- [x] 1.3 Add the production sign-up scenarios to the authentication step definitions, driving the deployment check with a closed and an open fixture; run them and confirm they fail
- [x] 1.4 Add the `acceptance-suite` main-spec profile scenarios; run `npm run test:specs` and confirm the suite-minus-self child currently leaks active deltas
- [x] 1.5 Add a scenario that a `master` push is not a production branch, driven by the declaration; run it and confirm it fails
- [x] 1.6 Run the change-scoped suite and confirm every new scenario fails for the right reason, with no undefined or pending step left

## 2. Production declaration and check (senior-dev)

- [x] 2.1 Add `deploy/production.json` with the accepted free-tier defaults (`vercel.plan: hobby`, `supabase.plan: free`) and `TODO` placeholders for the production project reference
- [x] 2.2 Implement `scripts/check-deployment.ts` with the declaration, free-plan, origin, region, branch, project-separation, transaction/session connection-split, auth-origin, sign-up-posture, and missing-variable rules; never print a value
- [x] 2.3 Unit-test `check-deployment` for every rejection path and the complete declaration
- [x] 2.4 Add `regions: ["sin1"]` to `web/vercel.json` and keep `framework: "tanstack-start"`
- [x] 2.5 Add the root scripts for `deploy:check`, `smoke:production`, and `release`
- [x] 2.6 Confirm the `production-environment` and authentication acceptance scenarios pass

## 3. Release pipeline and live smoke (senior-dev)

- [x] 3.1 Implement `scripts/release.ts` with an injected command runner and fetch: fixed gate order, master-tip check, `pg_dump` over the session connection with an off-machine artifact, migration over `DIRECT_DATABASE_URL`, fast-forward of `release`, deployment-by-SHA wait, smoke, and rollback target
- [x] 3.2 Unit-test the release for gate failure, backup failure, migration failure, moved `master`, wrong deployment SHA, deployment error, and smoke failure; assert that no later step runs
- [x] 3.3 Implement `scripts/smoke-production.ts`: health 200, unauthenticated properties 401, admin magic link for the smoke account, cookie assembly, pre-clean by run marker, create/list/delete, sign-up refusal, and cleanup in `finally`
- [x] 3.4 Unit-test the smoke against a stub origin for healthy, health 503, stale row, failed delete, and open sign-up
- [x] 3.5 Add the fixture-plan seam the acceptance steps use, and confirm `release-pipeline` scenarios pass
- [x] 3.6 Confirm the smoke never deletes a row without its own run marker

## 4. Acceptance-suite scope fix (senior-qa)

- [x] 4.1 Add `HARNESS_SCOPE=specs` support to `openspec-effective-paths.cjs` and `suite-minus-self.cjs`, with the parent scope inherited by the child
- [x] 4.2 Set `HARNESS_SCOPE=specs` in the `test:specs` script and keep the default effective-spec behavior unchanged
- [x] 4.3 Make the composition report name every excluded active change
- [x] 4.4 Run `npm run test:specs` against the development database and confirm it is green at the main-spec composition
- [x] 4.5 Confirm the self-check child runs the same main-spec scope and no active delta leaks in

## 5. CI and Release workflows (senior-dev)

- [x] 5.1 Add `.github/workflows/ci.yml` for pull requests: install, lint, `pnpm --filter web exec tsc --noEmit`, unit tests, build, and spec lint only; no `test:specs`, no migration, and no Playwright install, to conserve Free GitHub minutes and avoid development-database contention
- [ ] 5.2 Add `.github/workflows/release.yml`: `workflow_dispatch`; a `verify` job on the `test` environment with a concurrency group running the release gate including `test:specs`; a `release` job on the `production` environment with required reviewers running the backup, migration, `release` fast-forward, deployment wait, and live smoke
- [ ] 5.3 Prove production secrets are unavailable to the PR workflow and the verify job
- [ ] 5.4 Create the `release` branch and confirm branch protection lets only the release workflow advance it
- [ ] 5.5 Confirm a push to `master` produces a preview deployment, not a production deployment

## 6. Provisioning (operator)

- [x] 6.1 Create `m-proper-prod` in `ap-southeast-1` on the Free organization; no active-project slot conflict, so `autopilot` was left untouched; production reference `pnqralkbpiieguxnsagb`; no paid add-on
- [ ] 6.2 Apply the Drizzle migrations to the production project over the session pooler (port 5432); confirm the journal and catalog match the committed baseline
- [ ] 6.3 Disable production sign-up; create the first confirmed **Landlord account**; configure Resend with the test sender; set the Site URL and exact production redirect allowlist
- [ ] 6.4 Create the Hobby Vercel project under the team; link `Markila-BOT/m-proper`; set Root Directory `web`, production branch `release`, region `sin1`, and "Include source files outside of the Root Directory"
- [ ] 6.5 Set the Vercel environment scopes: production values only in Production, development values in Preview and Development; set the Node version the build uses
- [ ] 6.6 Prove one preview build: it reads the development project and a page, `/api/properties` 401, and `/api/health` answer
- [ ] 6.7 Create the confirmed **Smoke account** in production; store its email and the production service-role key in the `production` GitHub environment
- [ ] 6.8 Create the UptimeRobot monitor on `/api/health` every five minutes with an email alert; deliver one test alert; confirm the monitor keeps the Free project active
- [ ] 6.9 Record the assigned production origin and update `deploy/production.json`, Supabase, the smoke target, and the docs
- [ ] 6.10 Configure the pre-release dump artifact: choose the off-machine location and retention, confirm a `pg_dump` over the session pooler restores into a scratch database

## 7. Production cutover (operator)

- [ ] 7.1 Run the Release workflow from `master`; confirm the gate, backup artifact, migration, `release` fast-forward, deployment SHA match, and live smoke
- [ ] 7.2 Confirm `/api/health` answers 200, `/api/properties` answers 401 without a session, and production sign-up is refused
- [ ] 7.3 Exercise one rollback to the previous deployment, then release the corrected commit
- [ ] 7.4 Confirm no smoke rows remain, the uptime monitor is green, and the Free project has not paused

## 8. Decommission `general-ledger` (operator)

- [x] 8.1 Bundle export explicitly waived by the user on 2026-11-27; the deletion proceeds without an archival copy, and the waiver is recorded here
- [x] 8.2 Verified in Vercel: the project's only domain is `general-ledger-eosin.vercel.app`; `general-ledger.vercel.app` is a different live project, so deleting this project does not touch it
- [x] 8.3 Deleted the Vercel project and the GitHub repository on 2026-11-27 after explicit confirmation; Vercel reports `projectDeleted=general-ledger` and GitHub reports the repository deleted
- [x] 8.4 Recorded the 2026-11-27 deletion date and the bundle waiver; `general-ledger-eosin.vercel.app` now answers 404
- [x] 8.5 `m-property` remains (`Markila-BOT/m-property`) and was untouched; `general-ledger.vercel.app` remains a different live project

## 9. Docs, glossary, and rules (primary)

- [x] 9.1 Update the root `README.md` with provision-once, release, backup, rollback, smoke, and decommission
- [x] 9.2 Update `web/README.md` with the transaction/session split, the Free-tier limits, and the private production posture
- [x] 9.3 Confirm the glossary terms and companion references are complete; add any term resolved during implementation
- [x] 9.4 Confirm ADR-0013 and ADR-0014 are in force, ADR-0012 is superseded, and no in-force ADR contradicts the implementation
- [x] 9.5 Update `openspec/config.yaml` context with the deployment commands and the production branch

## 10. Completion

- [ ] 10.1 Run the full release gate locally: lint, typecheck, unit tests, build, spec lint, and `test:specs`
- [ ] 10.2 Run the deployment check against the production declaration and environment, including the free-plan and session-pooler rules
- [ ] 10.3 Run `openspec validate production-deployment --strict` and resolve errors (the fenced-Gherkin warnings are the validator's known style notices)
- [ ] 10.4 Confirm no pending or undefined step remains in the change-scoped suite
- [ ] 10.5 Confirm the proposal's Definition of Done, including the exercised rollback and the decommission evidence
- [ ] 10.6 Summarize archive readiness and ask for the merge and archive decision

## 11. Archive Precondition

- [x] 11.1 Confirm `fullstack-tanstack` is archived and the main specs are green before this change's production cutover
- [x] 11.2 Confirm `auth-captcha` and a verified sending domain are recorded as the follow-up that opens public production sign-up; production sign-up remains closed until then
- [x] 11.3 Record the Free-tier upgrade triggers (Pro plus the IPv4 add-on, automated backups, more than two active projects, 500 MB, commercial use) in the runbook and ADR-0014's follow-up
