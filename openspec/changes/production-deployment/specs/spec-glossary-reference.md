# Glossary Reference

| Term | Source Glossary | Context |
| --- | --- | --- |
| Production environment | `glossary/technical.md` | The runtime whose declaration and origins the checks validate. |
| Production origin | `glossary/technical.md` | The exact HTTPS origin used by Supabase redirects and the smoke. |
| Transaction pooler | `glossary/technical.md` | The port-6543 runtime connection the deployment check requires. |
| Session pooler | `glossary/technical.md` | The port-5432 migration connection the deployment check requires. |
| Pre-release backup | `glossary/technical.md` | The dump the release-pipeline spec requires before migration. |
| Release | `glossary/technical.md` | The gated sequence the release-pipeline spec defines. |
| Release gate | `glossary/technical.md` | The ordered checks that must pass before migration or deploy. |
| Smoke account | `glossary/technical.md` | The dedicated production identity the live smoke uses. |
| Live smoke | `glossary/technical.md` | The post-deploy verification of the production origin. |
| Acceptance suite | `glossary/technical.md` | The harness whose main-spec profile gates a release. |
| Landlord account | `glossary/business.md` | The first production account, created by an operator. |
| Sign-up | `glossary/business.md` | The production sign-up surface, closed during the private phase. |
