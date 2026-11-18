# Council Notes: proposal.md

## Author Summary

Drafted the proposal around unreproducible installs plus a build-green baseline, with a single new capability covering dependency currency and removals. Marked only the three Rust 0.x majors as **BREAKING** and kept the gate ordering out of the artifact.

## Reviewer Challenges

- "eight web manifests" was wrong — it is eight `"latest"` specifiers inside one manifest.
- Claimed nondeterministic installs, but `pnpm-lock.yaml` is tracked, so installs from the lockfile were already deterministic; the real defect is unreviewed adoption on refresh.
- Several web version targets were said to be unverified; four of them (plugin-react 6.3.0, concurrently 10.0.7, Radix label 2.1.17, TanStack devtools) are in fact in the baseline resolution output.
- Impact attributed three removals to `web/package.json` when only `autoprefixer` is a web removal.
- "**BREAKING**" had no stated criterion, leaving the web minor bumps ambiguously unmarked.
- Non-goals never excluded a stack or framework migration.
- The capability stated this change's gates, contradicting the non-goal that adds no enforcement, making it decorative.
- Gate semantics, live-smoke coverage, parity pass criteria, and the OpenAPI acceptance boundary were undefined; baseline evidence was gitignored, so it cannot serve as the durable record.

## Resolutions

- Accepted: "eight `"latest"` specifiers in `web/package.json`".
- Accepted: reframed the Why around unreviewed adoption on lockfile refresh, citing the tracked lockfile.
- Rejected: unverified-target claim. All enumerated targets come from `pnpm outdated` / crates.io; the artifact now lists them explicitly instead of saying "to current".
- Accepted: one web removal, two api removals, with the verification basis named (no PostCSS config; no `reqwest`/`tokio-test` references in `api/src`, `api/tests`, `api/build.rs`).
- Accepted with a different rule: **BREAKING** means the bump exceeds the range its manifest declares. That marks the three Rust majors and leaves web bumps unmarked because their declared carets already admit them.
- Accepted: added a non-goal excluding any stack, framework, or language migration.
- Accepted: rewrote the capability as durable requirements (explicit ranges, no dist-tags, no unreferenced direct dependencies, policy in `adr/`) and stated enforcement is convention-only.
- Accepted: added gate semantics, live-smoke coverage, parity pass criteria, and an OpenAPI acceptance bar (no paths, properties, required fields, or types change); named the lockfiles and OpenAPI diff summary as the durable record because the baseline cache is ephemeral.
- Accepted: named the concrete risks (sqlx `Migrator`, `tower-http` layers, utoipa macros, `@types/node` type errors).
- Accepted: named the ADR path instead of "a new `adr/` record".

## Remaining Risks

- utoipa 6 may emit a different OpenAPI version or nullability encoding; the acceptance bar stops the change rather than reclassifying that as formatting.
- sqlx 0.9 may alter offline query metadata or migration behaviour in ways only a live run exposes.
- Parity verification depends on the existing Supabase database and manual comparison; there is no test suite to back it.
- The dependency policy has no automated guard, so future drift depends on reviewer discipline.
