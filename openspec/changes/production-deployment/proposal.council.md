# Council Notes: proposal.md

## Author Summary

Proposes the first production deployment of the one-app TanStack Start product: a dedicated Supabase project with a transaction-pooler runtime and session-pooler migration connection, a Vercel project in `sin1` rooted at `web`, a gated release path with a pre-release backup and forward-only migrations, a post-deploy live smoke, uptime monitoring, and the removal of the stale `general-ledger` project and repository. Production launches privately with sign-up closed until the separate CAPTCHA change. Revised from the original Pro/IPv4 plan to Vercel Hobby and Supabase Free; see the free-tier revision below.

## Reviewer Challenges

- `npm run test:specs` is red by construction: its suite-minus-self child re-runs the full effective spec, including the three unimplemented active changes, so it cannot gate a release.
- The new capabilities have no executable step definitions, and a one-time repository deletion is not durable behaviour; the change would add permanent red and block its own archive.
- "Production sign-up stays closed" is a product decision the user did not accept and contradicts the `authentication` and `web-app` specs; a choice and a recorded deviation are required.
- The live smoke was described as a pre-deploy gate, which is impossible, and its failure behaviour and cleanup were undefined.
- A Vercel Deploy Hook deploys the tip of its configured branch, not the gated SHA; the release has no way to prove what it shipped.
- Custom SMTP requires a verified sending domain and DNS work, which the Non-goals forbid.
- The Supabase direct host is IPv6-only and unreachable from GitHub-hosted runners; the migration connection needs an explicit decision.
- CI is greenfield and the secret story covered only production; the acceptance suite also needs development secrets and a concurrency guard.
- `m-proper.vercel.app` is not guaranteed; the assigned origin must be recorded and propagated.
- `web/vercel.json` was left unchanged even though `sin1` is expressed there, and the gate list omitted unit tests and the actual typecheck command.
- The rollback runbook omitted the need to revert or forward-fix `master` before the next release.
- A Git bundle on one laptop is not an archival copy; the bundle needs an off-machine location, a digest, and explicit deletion confirmation.

## Resolutions

- Accepted: fixed the release gate by scoping the `specs` profile and its suite-minus-self child to the same main-spec composition, and by adding executable step definitions for the new capabilities. This is recorded as a modified `acceptance-suite` capability.
- Accepted: removed `legacy-decommission` as a capability; the one-time procedure is a task with a bundle digest, an off-machine copy, a live-domain check, and explicit confirmation.
- Accepted: production launches privately. `authentication` is a modified capability that closes production sign-up and keeps development and previews open; `auth-captcha` and a verified sending domain are the follow-up that opens public sign-up.
- Accepted: split the pre-deploy gate from post-deploy verification. A failed smoke prints the previous deployment and the rollback action; it never runs a down migration. The smoke pre-cleans its own stale rows and always removes its row.
- Accepted: replaced the automated Deploy Hook with a controlled fast-forward of a dedicated `release` branch after gates and migrations. Vercel production tracks `release`, so a push to `master` cannot deploy. The workflow matches the deployment SHA before running the smoke. The hook remains only for manual redeploys.
- Accepted: Resend stays on its test sender, owner-only, which is sufficient while production sign-up is closed. Sending-domain verification and DNS move to the CAPTCHA follow-up.
- Accepted: the production project enables Supabase's IPv4 add-on so the direct host is reachable from GitHub-hosted runners; the runtime URL stays the transaction pooler.
- Accepted: secrets are split between a `test` GitHub environment and a `production` environment; PR CI gets a concurrency group so only one run migrates the development database at a time.
- Accepted: the assigned `*.vercel.app` origin is recorded at provisioning and becomes the single source of truth for Supabase, the smoke, the declaration, and the docs.
- Accepted: added `regions: ["sin1"]` to `web/vercel.json`, added `pnpm --filter web exec tsc --noEmit` and unit tests to the gate, and added the `master` revert-or-forward-fix step to the rollback runbook.
- Accepted: the decommission task records the bundle digest and off-machine location before deletion and requires a second confirmation immediately before each destructive call.
- Rejected: treating "sign-up closed" as an unstated side effect. It is now an explicit `authentication` delta.
- Rejected: keeping the Deploy Hook as the primary production trigger. The tip-versus-SHA ambiguity is not fixable with a pre-flight check alone.
- Rejected: verifying a Resend domain in this change. It is DNS work and is not needed for a closed, owner-only private instance.
- Rejected: dropping the acceptance suite from the release gate. The scope fix makes the source-of-truth suite usable instead.
- Deferred: custom domain, CAPTCHA, public sign-up, sending-domain verification, Sentry/APM, restore drill, and any rework of the three active product changes.

## Remaining Risks

- The source-of-truth suite has not yet been proven green at the release commit; the first release must demonstrate it.
- Production is deliberately not user-facing until `auth-captcha` and a sending domain land.
- A migration that is not backward compatible can leave the database ahead of the rolled-back code; review discipline is the control.
- Preview isolation depends on Vercel environment scopes and the development Supabase project's own limits; a promoted preview or a scope mistake can still reach production values.
- The Supabase IPv4 add-on is a recurring cost and a dependency on the direct host remaining reachable.
- Deletion of the legacy Vercel project and GitHub repository is irreversible beyond the exported bundle.

## Free-Tier Revision (2026-11-27)

The user chose Vercel Hobby and Supabase Free for now, with no paid add-on.

### Challenges

- Supabase Free has no IPv4 add-on, so the IPv6-only direct host cannot be reached from GitHub-hosted runners.
- Free projects pause after seven days without activity, have a 500 MB database limit, and have no automated backups.
- Vercel Hobby is non-commercial, single-member, and has no Pro support; the private repository must be deployable from the Hobby team.
- The full acceptance run on every PR would consume Free GitHub minutes and migrate the development database concurrently.
- The Pro/IPv4 ADR and the direct-connection wording in the proposal, design, specs, and tasks would all contradict the free-tier instruction.

### Resolutions

- Accepted: keep the separate production project on Free; delete the inactive `autopilot` project only if the two-active-project limit blocks it, after confirmation.
- Accepted: runtime stays on the transaction pooler 6543; the pre-release dump and migrations use the IPv4-reachable session pooler 5432. No IPv4 add-on.
- Accepted: a five-minute uptime monitor polls `/api/health`, which queries Postgres, to prevent the inactivity pause.
- Accepted: every release takes a `pg_dump` over the session connection and stores it off-machine before migrating; a failed dump stops the release.
- Accepted: PR CI stays lean; `test:specs` runs only in the Release workflow's verify job.
- Accepted: ADR-0014 supersedes ADR-0012 for the data plane. ADR-0013's release decision stands; its connection descriptor is corrected.
- Accepted: the deployment declaration records `hobby`/`free`, and the check refuses a paid plan.
- Rejected: reusing the development project for production (loses isolation) and keeping the Pro plan (violates the free-tier instruction).

### Remaining Free-Tier Risks

- The project pauses if the monitor is down long enough; the release and smoke then fail until it is restored.
- The pre-release dump is not point-in-time recovery and its artifact retention must be chosen deliberately.
- The 500 MB database limit and Free egress are the upgrade triggers.
- Hobby is non-commercial; any paid or multi-operator use requires a plan change.
- Free GitHub minutes are finite; each release's Playwright run consumes part of the allowance.
