| Term | Definition | Use When | Avoid |
| --- | --- | --- | --- |
| Dependency maintenance | Keeping declared toolchain dependencies at their current upstream releases without changing product behavior. | Describing version bumps, lockfile refreshes, or dependency removals. | "Upgrade project", "modernize" |
| Baseline capture | Evidence of the pre-change build, runtime, and UI state recorded before the first dependency change. | Describing the first task of a maintenance change or comparing before/after states. | "Snapshot", "pre-check" |
| Live smoke | Exercising the running API and web app against the real Supabase Postgres database. | Verifying behavior that unit tests cannot reach. | "Manual test", "QA pass" |
| Parity audit | A comparison of the post-change UI against the baseline that treats any unexplained visual difference as a regression. | Verifying that dependency updates did not alter rendered behavior. | "Visual review", "screenshot check" |
| Explicit version range | A dependency specifier that names a concrete version constraint instead of a dist-tag. | Recording dependency policy in manifests and ADRs. | "Pinned version" (a range still allows updates) |
