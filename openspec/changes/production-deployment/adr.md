# ADR Review Manifest

- Status: completed
- Review date: 2026-11-27

## Review Summary

ADR review completed for this change. Two durable decisions are in force: the dedicated Free production data plane with a transaction-pooler runtime and a session-pooler migration connection, and the controlled `release` branch as the only production deploy path. ADR-0012 recorded the earlier Pro/direct-host version of the data-plane decision and is superseded by ADR-0014. The private production launch is a temporary product posture recorded in the `authentication` delta, not an architectural decision. The `general-ledger` decommission is a one-time operational task with no durable decision beyond "export before delete", which the runbook states.

## In-Force ADRs Reviewed

- `adr/0001-dependency-version-policy.md` — the Release workflow adds no new runtime dependency; `drizzle-orm`, `postgres-js`, and `jose` remain the relevant ranges. No conflict.
- `adr/0002-specs-are-executable-source-of-truth.md` — the main-spec profile keeps the suite executable for releases; the scope fix removes a self-check recursion rather than weakening the source of truth. No conflict.
- `adr/0003-url-as-state-for-the-ledger.md` — no route or view-state change. No conflict.
- `adr/0004-liquid-glass-material-policy.md` — no surface change. No conflict.
- `adr/0005-payment-reminders-api-backed.md` — unaffected; it remains queued and will need additive, forward-only migrations. No conflict.
- `adr/0006-property-deletion-removes-payment-history.md` — the production schema reproduces the same cascade. No conflict.
- `adr/0007-supabase-auth-rust-jwks.md` — **superseded by ADR-0010**. The surviving Supabase Auth and JWKS rules still apply to the production project.
- `adr/0008-per-landlord-ownership.md` — production keeps owner-scoped rows, RLS, and revoked grants; the first account is created by an operator, not a bootstrap backfill. No conflict.
- `adr/0009-server-ledger-retires-local.md` — production starts with no ledger rows; the online-only rule is unchanged. No conflict.
- `adr/0010-tanstack-server-routes-replace-rust.md` — the production app serves the same `/api` routes on its own origin; the session cookie is ambient and the CSRF origin becomes the production origin. No conflict.
- `adr/0011-drizzle-owns-the-schema.md` — the schema ownership, hand-authored SQL, and explicit migration step stand. Its "direct (non-pooled)" connection descriptor is superseded for the Free plan by ADR-0014, which uses the session pooler on 5432 because the direct host is IPv6-only and the IPv4 add-on is not available. The schema decision itself is unchanged.

## New Durable ADRs Created

- `adr/0012-production-supabase-project-and-split-connections.md` — **superseded by ADR-0014**. It recorded the Pro plan, the direct migration host, and the IPv4 add-on.
- `adr/0013-releases-advance-a-release-branch.md` — production deploys only from a controlled `release` branch advanced by the Release workflow after the gate, backup, and migration; the deployment must match the gated SHA; the smoke is post-deploy; rollback is code-only and migrations are forward-only. Its "direct connection" descriptor is corrected to the session pooler by ADR-0014; the release decision stands.
- `adr/0014-free-tier-production-connections.md` — production uses a dedicated Supabase Free project; the runtime uses the transaction pooler on 6543, the pre-release dump and migrations use the session pooler on 5432, no IPv4 add-on is purchased, no data is migrated, and a pre-release dump substitutes for automated backups.

## Notes

- The private launch (production sign-up closed, owner-only mail) is recorded as a `MODIFIED` requirement in `authentication` because it is a temporary product posture, not a durable architecture choice. `auth-captcha` and a verified sending domain supersede it by opening sign-up.
- The acceptance-suite scope fix is a harness behaviour change recorded in the `acceptance-suite` delta; it does not alter ADR-0002's principle.
- The Free-tier choice is deliberate and temporary. ADR-0014 records the upgrade trigger: Pro plus the IPv4 add-on when the pause, storage, backup, or support limits are exceeded.
- The `general-ledger` decommission has no ADR: it is a one-time removal whose safety rules belong in the runbook and tasks.
