# Glossary Reference

| Term | Source Glossary | Context |
| --- | --- | --- |
| Production environment | `glossary/technical.md` | The Vercel production deployment and its dedicated Supabase project. |
| Preview deployment | `glossary/technical.md` | The per-PR deployment backed by the development project. |
| Production origin | `glossary/technical.md` | The single HTTPS origin used by Supabase redirects, the smoke, and the docs. |
| Release | `glossary/technical.md` | The gated sequence that backs up, migrates, deploys, and verifies production. |
| Release gate | `glossary/technical.md` | The build, unit, and main-spec acceptance checks before a release. |
| Transaction pooler | `glossary/technical.md` | The port-6543 runtime connection with prepared statements disabled. |
| Session pooler | `glossary/technical.md` | The port-5432 migration connection kept distinct from the runtime pooler. |
| Pre-release backup | `glossary/technical.md` | The dump taken before migration and stored off-machine. |
| Smoke account | `glossary/technical.md` | The dedicated production landlord used only by the live smoke. |
| Live smoke | `glossary/technical.md` | The post-deploy verification of the production origin. |
| Acceptance suite | `glossary/technical.md` | The cucumber-js harness whose main-spec profile gates a release. |
| Effective spec | `glossary/technical.md` | The full suite composition that includes active deltas; the release gate excludes it. |
| Landlord account | `glossary/business.md` | The first production account, created by an operator. |
| Sign-up | `glossary/business.md` | The production sign-up surface, closed during the private phase. |
| Test identity | `glossary/technical.md` | The acceptance suite's seeded identity, kept in the development project. |
