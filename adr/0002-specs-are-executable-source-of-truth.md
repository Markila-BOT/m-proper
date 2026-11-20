# 0002 Specs are the executable source of truth

- Status: accepted
- Date: 2026-11-20
- Supersedes: none

## Context and Problem Statement

The project has three main behavior specs in bullet style and zero automated verification of any kind — no cargo tests, no web test framework, no CI. `openspec/config.yaml` now enables spec-as-source with `stack: javascript`, whose extraction contract hard-errors on any scenario without a gherkin fence, so the committed behavior describes checks nothing executes. Every verification so far has been manual: a live smoke, a parity audit, discipline.

## Considered Options

- Fence the specs and adopt the cucumber-js acceptance suite as the standing automated gate (specs stay the single source; the suite executes them).
- Keep prose specs and build a separate test suite in vitest/Playwright as its own authority.
- Continue with manual verification only.

## Decision Outcome

Chosen option: "Fence the specs and adopt the acceptance suite", because a spec that cannot execute is a claim with no check, and a second test authority drifts from the spec it was supposed to implement.

Rules:

- Scenarios live as fenced Gherkin inside `spec.md` files; generated `.feature` files are never authored by hand.
- The suite runs the effective spec — every main spec with active deltas applied — and a green run with zero pending or undefined steps gates sync and archive; the gate is never silently waived.
- The suite owns the app lifecycle around a run and leaves no data trace.
- New harness dependencies follow ADR-0001's explicit-range rule.
- Product code changes still require an active OpenSpec change whose scenarios describe the behavior (BDD zone discipline).

### Consequences

- Good, because spec/code drift surfaces as a failing scenario instead of a runtime surprise.
- Good, because every future change inherits verification without building its own.
- Bad, because the suite is the only automated instrument: a red suite has nothing to arbitrate it.
- Bad, because `openspec validate --strict` (1.16.0) misreads fenced scenarios as missing steps; non-strict plus the suite's gherkin-lint governs until the CLI upgrade.
- Follow-up: upgrade the OpenSpec CLI to 2.x under ADR-0001's major-review rule; add CI wiring as its own change.
