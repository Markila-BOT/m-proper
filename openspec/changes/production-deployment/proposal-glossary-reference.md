# Glossary Reference

| Term | Source Glossary | Context |
| --- | --- | --- |
| Production environment | `glossary/technical.md` | The Vercel production deployment in `sin1` and its dedicated Supabase project. |
| Preview deployment | `glossary/technical.md` | The per-pull-request Vercel deployment backed by the development project. |
| Production origin | `glossary/technical.md` | The single HTTPS origin used by Supabase redirects, the smoke, and the docs. |
| Release | `glossary/technical.md` | The gated sequence that backs up, migrates, deploys, and verifies production. |
| Release gate | `glossary/technical.md` | The build, unit, and source-of-truth acceptance checks before a release. |
| Transaction pooler | `glossary/technical.md` | The port-6543 runtime connection that requires prepared statements to be disabled. |
| Session pooler | `glossary/technical.md` | The port-5432 migration connection, kept distinct from the runtime pooler. |
| Pre-release backup | `glossary/technical.md` | The dump taken before migration and stored off-machine. |
| Smoke account | `glossary/technical.md` | The dedicated production landlord used only by the live smoke. |
| Live smoke | `glossary/technical.md` | The post-deploy verification against the production origin. |
| Acceptance suite | `glossary/technical.md` | The cucumber-js harness whose main-spec profile gates a release. |
| Landlord account | `glossary/business.md` | The first production account, created by an operator while sign-up is closed. |
| Sign-up | `glossary/business.md` | The production sign-up surface, deliberately closed during the private phase. |
