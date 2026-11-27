# 0014 Production runs on the Free plan with a session-pooler migration connection

- Status: accepted, supersedes ADR-0012
- Date: 2026-11-27
- Supersedes: ADR-0012

## Context and Problem Statement

ADR-0012 chose a dedicated Supabase Pro project, a transaction pooler for the runtime, and the direct host on port 5432 with the IPv4 add-on for migrations. The project now runs on Vercel Hobby and Supabase Free until further notice: there is no budget for Pro, and the IPv4 add-on is not available on the Free plan. The direct host is IPv6-only, and GitHub-hosted runners have no IPv6 route. Free projects also pause after seven days without activity and carry no automated backups. The dedicated project and the runtime/migration split are still wanted; only the paid plan and the migration host can change.

## Considered Options

- **Keep the Pro plan and the IPv4 add-on**: preserves ADR-0012 unchanged; introduces recurring cost against the explicit free-tier decision.
- **Reuse the development project**: no new cost or project; loses production isolation.
- **A Free production project with the session pooler for migrations**: isolates data, keeps the runtime transaction pooler, and gives CI an IPv4-reachable session connection with no add-on; requires a manual backup and an activity monitor.
- **A Free production project with the direct host and local-only migrations**: keeps the direct connection; CI cannot reach it, so releases lose their migration step.

## Decision Outcome

Chosen option: "A Free production project with the session pooler for migrations". Create `m-proper-prod` in `ap-southeast-1` on the Free organization. The app's `DATABASE_URL` remains the transaction pooler on port 6543; `DIRECT_DATABASE_URL` becomes the IPv4-reachable session pooler on port 5432 and is used only by the pre-release `pg_dump` and the migration. No IPv4 add-on is purchased. The production project is created empty; the Drizzle migrations reproduce the schema and an operator creates the first landlord account. A five-minute uptime monitor polls `/api/health`, which queries Postgres, to keep the project from pausing. Each release takes a logical `pg_dump` before migrating and stores it off-machine, because Free has no automated backups.

ADR-0013's controlled `release` branch and release ordering stand; only its "direct connection" descriptor is corrected here to the session pooler. Production runs on Vercel Hobby under `markilabots-projects`.

### Consequences

- Good, because the deployment has no recurring Vercel or Supabase cost.
- Good, because production data remains isolated from development, previews, and the acceptance suite.
- Good, because the runtime still uses the transaction-pooler mode `postgres-js` already supports, and CI can reach the session pooler over IPv4.
- Bad, because Free projects pause after seven days without activity; the uptime monitor is the mitigation.
- Bad, because there are no automated backups; the pre-release dump is the only recoverable copy and is not point-in-time recovery.
- Bad, because the Free database has a 500 MB limit and Hobby is non-commercial with no Pro support.
- Follow-up: upgrade to Pro and the IPv4 add-on when the Free limits are exceeded; add automated backups and a restore drill then. The session-pooler detail is a deliberate Free-tier choice, not a permanent rejection of the direct connection.
