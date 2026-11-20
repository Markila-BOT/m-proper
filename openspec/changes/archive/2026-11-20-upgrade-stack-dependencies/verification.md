# Verification results — 2026-11-20

## Gates

- `cargo check` (api): green after lockfile refresh, sqlx 0.9, utoipa 6, tower-http 0.7, and dev-dependency removal
- API boot against Supabase (`aws-0-ap-southeast-1.pooler.supabase.com:5432`): connected, migrations table intact, serving
- Properties CRUD round-trip: POST 201 `{success, message, data}` → GET contains row → DELETE success → GET clean; camelCase fields unchanged (`isActive`, `createdAt`)
- `pnpm --filter web build`: green (client + SSR)
- `pnpm --filter web exec tsc --noEmit`: clean (3 unused imports in `web/src/router.tsx` removed — pre-existing, never gated before)
- `pnpm --filter web lint` + `check`: clean
- `api/openapi.json`: utoipa 6 emits a byte-identical document (export short-circuits); zero contract change
- `openspec validate upgrade-stack-dependencies --type change --strict`: valid

## Parity audit (baseline `openspec/.cache/upgrade-baseline/screens/` vs post-change `openspec/.cache/upgrade-verify/screens/`)

Ten DOM-verified screenshots, five states × 1440×900 and 390×844, identical canonical navigation.

- 8 of 10 frames: only difference is the TanStack devtools badge, bottom-right (react-devtools 0.10.9 → 0.10.14) — allowed devtools noise
- Modal + delete-confirm frames additionally differ in the auto-focused input's / confirm buttons' focus ring
- Root cause, accepted by the user: `@radix-ui/react-dialog` 1.1.23 → 1.3.1 changed how auto-focus is applied, and the browser's `:focus-visible` heuristic no longer matches on programmatic focus. The input still receives focus (`document.activeElement` verified); only the painted ring on open is gone. Subsequent tabbing still paints rings.
- Shift analysis ruled out layout drift: 1px offsets in any direction worsen the diff; content sits at identical coordinates.
- Transactions: seeded `landlord-transactions` entry reloads and renders in the list, summary, and filters; state cleaned afterwards.

## Evidence paths (ephemeral, gitignored cache)

- Baseline: `openspec/.cache/upgrade-baseline/` (screens, NAV-NOTES.md, versions.txt, cargo-check.txt, web-build.txt)
- Post-change: `openspec/.cache/upgrade-verify/screens/`
- Durable record: `pnpm-lock.yaml`, `api/Cargo.lock`, `api/openapi.json` (unchanged), this file, and `adr/0001-dependency-version-policy.md`
