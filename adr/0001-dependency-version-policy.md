# 0001 Dependency version policy

- Status: accepted
- Date: 2026-11-18
- Supersedes: none

## Context and Problem Statement

`web/package.json` declared eight dependencies with the `latest` dist-tag, so refreshing the lockfile could adopt any upstream release without a manifest diff. The project has no test suite and no CI, which makes silent dependency movement expensive to detect: the only signals are a build break or a visual difference a person notices. At the same time, some majors are deliberately rejected for now — TypeScript 7 changes the compiler, and adopting it inside a routine refresh would mix a compiler migration with version maintenance.

## Considered Options

- Dist-tags (`latest`) everywhere: simplest to write, no review surface, no reproducible intent.
- Exact pins for every dependency: fully reproducible, but routine patch releases become manual manifest edits.
- Explicit caret ranges at the resolved version, with majors reviewed individually and deferred majors recorded in an ADR.

## Decision Outcome

Chosen option: "Explicit caret ranges at the resolved version", because it keeps routine patch and minor refreshes available while making every constraint visible in review, and because a deliberate deferral belongs in a decision record rather than in a forgotten manifest entry.

Rules:

- Every direct dependency in `web/package.json`, `api/Cargo.toml`, and the root `package.json` names an explicit constraint. No `latest` or other dist-tag.
- A major upgrade is its own reviewed step, gated by the check and build commands, so a failure is attributable to one ecosystem.
- A deferred major is recorded here or in a superseding ADR, with the condition that reopens it.
- TypeScript 7 is deferred: it is adopted in a change dedicated to the compiler migration, not as part of dependency maintenance.
- Enforcement is convention until a later change adds an automated guard.

### Consequences

- Good, because a lockfile refresh now produces a manifest diff that reviewers can see and question.
- Good, because deferrals are discoverable instead of implicit in a pinned version.
- Bad, because caret ranges still permit unreviewed patch adoption when someone refreshes the lockfile without reading the diff.
- Bad, because the policy has no automated enforcement; it depends on review discipline.
- Follow-up: add a guard (for example a manifest lint that rejects dist-tags) when the project gains CI.
