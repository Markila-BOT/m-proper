# ADR Review Manifest

- Status: completed
- Review date: 2026-11-21

## Review Summary

ADR review completed for this change.

## In-Force ADRs Reviewed

- `adr/0001-dependency-version-policy.md` — the single new dependency (`@tanstack/react-table`) declares an explicit range; no conflict.
- `adr/0002-specs-are-executable-source-of-truth.md` — this change's behavioral gate is the acceptance suite's green run; no conflict.

## New Durable ADRs Created

- `adr/0003-url-as-state-for-the-ledger.md` — each ledger view is a real route with `/` redirecting to `/overview`; the URL is the app's navigation state.
