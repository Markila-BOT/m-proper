## Why

Both halves of m-proper sit behind current upstream releases, and `web/package.json` declares `"latest"` for eight dependencies, so any lockfile refresh silently adopts whatever upstream publishes with no review surface. The baseline is build-green (`cargo check` and `vite build` pass; there is no test suite), which makes this the cheapest moment to close the drift deliberately.

## What Changes

- Replace the eight `"latest"` specifiers in `web/package.json` with an explicit version range at the version currently resolved, so a refresh becomes a reviewable diff instead of an unpinned fetch
- Upgrade web direct dependencies to: React/react-dom 19.3.1, `@types/react` 19.3.0, `@types/react-dom` 19.3.0, TanStack Start 1.169.5, Router 1.170.46, Router devtools/SSR-query 1.167.3, Query and Query devtools 5.107.2, router-cli 1.168.0, react-devtools 0.10.14, devtools-vite 0.8.6, eslint-config 0.5.0, Vite 8.3.8, `@vitejs/plugin-react` 6.3.0, ESLint 10.15.0, Prettier 3.10.1, `@types/node` 26.6.6, Tailwind and `@tailwindcss/vite` 4.3.5, Radix dialog 1.3.1, select 2.4.1, slot 1.5.0, label 2.1.17, Zustand 5.1.0, tailwind-merge 3.7.0, concurrently 10.0.7
- **BREAKING**: `sqlx` 0.8 → 0.9.1 — compile-time surface and migration runner; `runtime-tokio`, `tls-rustls`, `migrate`, `postgres`, `chrono`, and `uuid` features carry over unchanged
- **BREAKING**: `utoipa` 5 → 6.0.0 together with `utoipa-swagger-ui` 9 → 10.0.2 — they emit one spec, so they move as a pair
- **BREAKING**: `tower-http` 0.6 → 0.7.1 — layer signatures
- Remove unused development dependencies: `autoprefixer` (web; no PostCSS config exists, and Tailwind 4 prefixes through Lightning CSS), plus `reqwest` and `tokio-test` (api; no reference in `api/src`, `api/tests`, or `api/build.rs`)
- Regenerate the committed `api/openapi.json` — it is exported at startup before the database connects — and commit it only if the diff contains no added/removed path and no change to schema properties, required fields, or types
- Verify with a **baseline capture** taken before the first edit, then a **live smoke** against the existing Supabase `DATABASE_URL` and a desktop-and-mobile **parity audit** against that baseline
- Record the durable dependency policy in `adr/0001-dependency-version-policy.md`

Only the three Rust majors are marked **BREAKING**: each exceeds the range its manifest declares, while every web bump already falls inside its declared range and therefore changes no manifest constraint. Known risk concentrates in the sqlx `Migrator` API, `tower-http` layer construction, and utoipa macro attributes; `@types/node` may surface new type errors even though Node itself does not move.

## Capabilities

### New Capabilities

- `dependency-maintenance`: every direct dependency names an **explicit version range** rather than a dist-tag, no unreferenced direct dependency remains declared, and the policy that governs upgrades lives in `adr/`. Enforcement is convention-only until a later change adds a guard.

### Modified Capabilities

- (none — `openspec/specs/` is empty; the unarchived `migrate-to-rust-and-tanstack-start` change still owns the baseline capabilities)

## Impact

- **Manifests**: `web/package.json` (every dependency plus one removal), `api/Cargo.toml` (three majors, two removals), and the tracked lockfiles `pnpm-lock.yaml` and `api/Cargo.lock`
- **Committed evidence**: `api/openapi.json` (regenerated, formatting-only expected) and `adr/0001-dependency-version-policy.md`. The baseline cache under `openspec/.cache/upgrade-baseline/` is ephemeral; the lockfiles and the OpenAPI diff summary are the durable record
- **Unchanged by intent**: the HTTP contract, the JSON envelope `{ success, message, data? }` with camelCase fields, the Postgres schema, Architecture A (all domain logic stays in Rust), and rendered UI behavior
- **Gate semantics**: each Rust step is its own commit; a failing `cargo check` or build reverts that step and stops the change. The **live smoke** passes on a properties create/list/delete round-trip plus the five transaction-UI states, and the **parity audit** passes when all five states match the baseline at 1440×900 and 390×844
- **No safety net added**: verification remains manual — no test suite, no CI
- **Delivery**: one branch, three commits (cargo, web, removals), merged locally with no PR
- **Glossary**: terms used here are defined in `glossary/technical.md`

## Non-goals

- TypeScript 7.0.2 — a compiler migration gets its own change
- No stack, framework, or language migration: Rust, Axum, sqlx, TanStack Start, and Postgres stay; only versions move and unused dependencies leave
- The architecture deepening points from the recent review (Rust properties module, generated contract, ledger module, query consolidation, vocabulary module, auth twins) — a separate follow-up change
- New features, new tests or test frameworks, and CI setup
- Node or pnpm version changes
- Archiving `migrate-to-rust-and-tanstack-start`
