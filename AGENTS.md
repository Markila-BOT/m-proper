# AGENTS.md

- For OpenSpec propose/apply/verify/archive workflows, use the local `openspec-git-discipline` skill to enforce proposal commits before apply and merge-before-archive discipline.
- Read `schema`, `rules`, and `operations` from `openspec/config.yaml` before creating or changing an artifact. If `schema` is missing, stop and ask.
- Write glossary terms to `glossary/business.md` or `glossary/technical.md`, and durable decisions to `adr/`. Never rewrite an accepted ADR; supersede it.
