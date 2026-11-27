# 0013 Releases advance a controlled release branch

- Status: accepted
- Date: 2026-11-27
- Supersedes: none

## Context and Problem Statement

A production release must deploy exactly the commit the gates approved, after the database migration succeeds. Vercel's Git integration deploys the production branch on every push, and a Deploy Hook deploys the tip of its configured branch and returns only a job id. Neither can name an arbitrary gated SHA. The default effective acceptance run is red while three product changes are unimplemented, so the release needs a source-of-truth gate that excludes active deltas. A rollback must not rewind a schema that may already carry data written by the new code.

## Considered Options

- **Auto-deploy `master` and migrate manually before merging**: simplest Git flow; the deployed commit can move, and a forgotten migration ships code against an old schema.
- **Deploy Hook on `master`**: one HTTP call; it deploys the branch tip, not the gated commit, and proves nothing about what shipped.
- **Vercel CLI in the Release workflow**: deploys an exact build; adds a second build path and a CLI dependency.
- **A controlled `release` branch advanced by the Release workflow**: Git-native, deploys the exact commit, and keeps `master` as the integration branch.

## Decision Outcome

Chosen option: "A controlled `release` branch advanced by the Release workflow". A manual `workflow_dispatch` runs on `master`, asserts the gated SHA is still the `master` tip, runs the release gate (install, lint, typecheck, unit tests, build, spec lint, and the main-spec acceptance run), migrates over the direct connection, then fast-forwards `release` to that SHA. Vercel deploys `release`; the workflow waits for the production deployment whose commit matches and runs the live smoke. A failed smoke prints the previous deployment and the Vercel rollback action and never runs a down migration. Migrations are forward-only and must remain compatible with the previous deployment.

### Consequences

- Good, because the deployed commit is the gated commit, and a push to `master` cannot deploy production.
- Good, because the release gate can be green while active product changes remain unimplemented.
- Good, because rollback is a fast code rollback that cannot destroy rows written by the new code.
- Bad, because the workflow needs permission to push `release`, and branch protection must not block it.
- Bad, because the smoke needs a production service-role key to mint a magic link that survives CAPTCHA.
- Bad, because a non-backward-compatible migration can leave the database ahead of rolled-back code; expand/contract review is the control.
- Follow-up: prove the `release` push permission and the deployment-by-SHA lookup in a dry release before the first production cutover.
