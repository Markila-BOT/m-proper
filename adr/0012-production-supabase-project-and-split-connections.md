# 0012 Production uses a dedicated Supabase project with split connections

- Status: accepted
- Date: 2026-11-27
- Supersedes: none

## Context and Problem Statement

The only Supabase project is the development project. It holds disposable accounts, preview writes, and the acceptance suite's migrations. Production financial records need a different data plane, and the runtime and migration paths have different connection constraints: Vercel functions are short-lived and must not exhaust session connections, while migrations need session semantics and must run from GitHub-hosted runners, which have no IPv6 route to the Supabase direct host. The organization is on the Free plan, whose projects pause on inactivity and do not carry production-grade backups.

## Considered Options

- **Reuse the development project**: no new cost or provisioning; no isolation, no production backup posture, and preview or test writes can reach real records.
- **A second Free project**: isolates data; still pauses on inactivity and lacks production backups.
- **A Pro project with a transaction pooler at runtime and the direct host for migrations**: isolates data, uses the pooler the serverless runtime needs, and keeps the migration path the repository already documents; needs the IPv4 add-on for CI.
- **A Pro project with the session pooler for migrations**: also reachable from IPv4 CI, but contradicts the repository's direct-connection contract and mixes session pooling into the migration path.

## Decision Outcome

Chosen option: "A Pro project with a transaction pooler at runtime and the direct host for migrations". Create `m-proper-prod` in `ap-southeast-1` on the Pro organization. `DATABASE_URL` is the transaction pooler on port 6543; `DIRECT_DATABASE_URL` is the direct host on port 5432 with the IPv4 add-on. The two URLs must differ. The production project is created empty; the Drizzle migrations reproduce the schema and an operator creates the first landlord account.

### Consequences

- Good, because development, previews, and the acceptance suite can never write to production records.
- Good, because Pro removes the inactivity pause and provides daily backups.
- Good, because the runtime uses the pooling mode `postgres-js` already supports with `prepare: false`, and CI can reach the direct host.
- Bad, because the organization pays for a second project and the IPv4 add-on.
- Bad, because there are now two projects, two key sets, and two redirect allowlists to keep aligned.
- Follow-up: record the assigned project reference in the deployment declaration and verify the IPv4 route from a GitHub-hosted runner before the first release.
