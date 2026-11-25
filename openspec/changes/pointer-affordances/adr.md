# ADR Review Manifest

- Status: completed
- Review date: 2026-11-24

## Review Summary

ADR review completed for this change. No new durable decision is recorded: the pointer contract is a reversible style-layer rule, is not surprising to a future reader, and its only competing option (per-component cursor utilities) is a cheaper local choice already rejected by the systemic requirement.

## In-Force ADRs Reviewed

- `adr/0001-dependency-version-policy.md` — no dependency change; no conflict.
- `adr/0002-specs-are-executable-source-of-truth.md` — the new scenarios join the green gate; the suite contract does not change.
- `adr/0003-url-as-state-for-the-ledger.md` — no route change.
- `adr/0004-liquid-glass-material-policy.md` — no material, contrast, or fallback change; the cursor contract is orthogonal to the glass rules.
- `adr/0005-payment-reminders-api-backed.md` — no API or data change; unrelated.
- `adr/0006-property-deletion-removes-payment-history.md` — no deletion behavior change; unrelated.

## New Durable ADRs Created

None.

## Notes

- The rejected option — per-component `cursor-pointer` utilities on every control — is recorded in the design and council notes instead of an ADR, because it is cheap to reverse and does not change an architecture boundary.
- If a future disabled state wants a not-allowed cursor, it must supersede the design decision (decision 3), not silently remove `pointer-events-none`.
