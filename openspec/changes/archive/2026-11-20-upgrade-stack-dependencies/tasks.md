## 1. Baseline capture (before any edit)

- [x] 1.1 Create branch `chore/upgrade-stack-dependencies`
- [x] 1.2 Record `cargo check` output from `api/` into `openspec/.cache/upgrade-baseline/cargo-check.txt`
- [x] 1.3 Record `pnpm --filter web build` output into `openspec/.cache/upgrade-baseline/web-build.txt`
- [x] 1.4 Save `pnpm outdated -r` and the crates.io comparison table into `openspec/.cache/upgrade-baseline/versions.txt`
- [x] 1.5 Capture screenshots of the five states at 1440×900 and 390×844 into `openspec/.cache/upgrade-baseline/screens/`: property list with sidebar, create-property modal, delete confirmation, transaction form, filters with summary
- [x] 1.6 Confirm `api/.env` holds a `postgresql://` `DATABASE_URL` and that the API boots against it

## 2. Cargo lockfile refresh

- [x] 2.1 Run `cargo update` in `api/` to refresh in-range dependencies only
- [x] 2.2 Run `cargo check` in `api/` and resolve any in-range breakage
- [x] 2.3 Commit: `chore(api): refresh cargo lockfile`

## 3. sqlx 0.9

- [x] 3.1 Bump `sqlx` to `0.9` in `api/Cargo.toml`, keeping `runtime-tokio`, `tls-rustls`, `postgres`, `chrono`, `uuid`, `migrate`
- [x] 3.2 Run `cargo check` and fix `Migrator`/query-metadata fallout
- [x] 3.3 Boot the API once against `DATABASE_URL` and confirm migrations still run
- [x] 3.4 Commit: `chore(api)!: upgrade sqlx to 0.9`

## 4. utoipa 6 with swagger-ui 10

- [x] 4.1 Bump `utoipa` to `6` and `utoipa-swagger-ui` to `10` in the same edit, keeping `features = ["axum"]`
- [x] 4.2 Run `cargo check` and fix macro attribute or derive fallout
- [x] 4.3 Boot the API (no database needed) so `export_openapi()` rewrites `api/openapi.json`
- [x] 4.4 Compare the regenerated document semantically: no added/removed path, no changed property, required flag, type, or OpenAPI version; accept whitespace and key-order churn only
- [x] 4.5 Commit the manifest, lockfile, and the regenerated spec together: `chore(api)!: upgrade utoipa to 6`

## 5. tower-http 0.7

- [x] 5.1 Bump `tower-http` to `0.7`, keeping `compression-gzip`, `cors`, `trace`
- [x] 5.2 Run `cargo check` and fix layer construction
- [x] 5.3 Commit: `chore(api)!: upgrade tower-http to 0.7`

## 6. Web dependencies and explicit ranges

- [x] 6.1 Replace the nine `"latest"` specifiers in `web/package.json` with carets at their resolved versions
- [x] 6.2 Apply the enumerated upgrades (React 19.3.1 and types, TanStack family, Vite 8.3.8, plugin-react 6.3.0, ESLint 10.15.0, Prettier 3.10.1, Tailwind 4.3.5, Radix, Zustand 5.1.0, tailwind-merge 3.7.0, `@types/node` 26.6.6); bump root `concurrently` to 10.0.7
- [x] 6.3 Remove `autoprefixer` from `web/package.json` and refresh `pnpm-lock.yaml`
- [x] 6.4 Run `pnpm --filter web build` and fix build fallout
- [x] 6.5 Run `pnpm --filter web exec tsc --noEmit` and fix new type errors
- [x] 6.6 Run `pnpm --filter web lint` and `pnpm --filter web check`, then reformat
- [x] 6.7 Commit: `chore(web): upgrade dependencies and pin ranges`

## 7. Remove unused API dev-dependencies

- [x] 7.1 Delete `reqwest` and `tokio-test` from `api/Cargo.toml` and refresh `Cargo.lock`
- [x] 7.2 Run `cargo check` in `api/`
- [x] 7.3 Commit: `chore(api): remove unused dev-dependencies`

## 8. Verification

- [x] 8.1 Start the API against `DATABASE_URL` and complete a properties create/list/delete round-trip, confirming the envelope and camelCase fields
- [x] 8.2 Start the web app and exercise the five states, capturing screenshots at 1440×900 and 390×844
- [x] 8.3 Run the parity audit against the baseline screenshots with the `impeccable` and `ui-taste` audit playbooks; treat any unexplained difference as a regression
- [x] 8.4 Confirm recorded transactions still load from local storage and that summaries and filters behave as before
- [x] 8.5 Re-confirm the final `api/openapi.json` diff contains no contract change
- [x] 8.6 Run `openspec validate upgrade-stack-dependencies --type change --strict`
- [x] 8.7 Merge the branch locally into `master`; do not archive this change

## 9. Records

- [x] 9.1 Confirm `adr/0001-dependency-version-policy.md` and `glossary/technical.md` are committed
- [x] 9.2 Report the baseline and post-change evidence paths plus any remaining difference from the parity audit
