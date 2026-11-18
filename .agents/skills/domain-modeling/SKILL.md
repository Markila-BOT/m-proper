---
name: domain-modeling
description: Build and sharpen a project's domain model. Use when discussing codebase terminology, writing or editing glossary terms, or recording an architectural decision.
---

# Domain Modeling

Actively build and sharpen the project's domain model as you design. This is the *active* discipline: challenging terms, inventing edge-case scenarios, and writing the glossary and decisions down the moment they crystallise. (Merely *reading* the glossary for vocabulary is not this skill: that's a one-line habit any skill can do. This skill is for when you're changing the model, not just consuming it.)

## File structure

This template keeps the model in two places at the repository root:

```
/
├── glossary/
│   ├── business.md
│   └── technical.md
├── adr/
│   ├── 0001-event-sourced-orders.md
│   └── 0002-postgres-for-write-model.md
└── openspec/
```

- `glossary/business.md` holds domain, product, workflow, and business terms.
- `glossary/technical.md` holds architecture, implementation, platform, and protocol terms.
- `adr/` holds one durable decision per file, named `NNNN-kebab-title.md`.

Create each file lazily: only when you have something to write. If no glossary file exists, create it when the first term is resolved. If no `adr/` directory exists, create it when the first ADR is needed.

## During the session

### Challenge against the glossary

When the user uses a term that conflicts with the existing language in `glossary/business.md` or `glossary/technical.md`, call it out immediately. "Your glossary defines 'cancellation' as X, but you seem to mean Y. Which is it?"

### Sharpen fuzzy language

When the user uses vague or overloaded terms, propose a precise canonical term. "You're saying 'account': do you mean the Customer or the User? Those are different things."

### Discuss concrete scenarios

When domain relationships are being discussed, stress-test them with specific scenarios. Invent scenarios that probe edge cases and force the user to be precise about the boundaries between concepts.

### Cross-reference with code

When the user states how something works, check whether the code agrees. If you find a contradiction, surface it: "Your code cancels entire Orders, but you just said partial cancellation is possible. Which is right?"

### Update the glossary inline

When a term is resolved, update `glossary/business.md` or `glossary/technical.md` right there. Don't batch these up: capture them as they happen. Use the table format owned by the `glossary` skill:

```markdown
| Term | Definition | Use When | Avoid |
| --- | --- | --- | --- |
```

Keep definitions to one concise sentence. The glossary is a glossary and nothing else: do not use it as a spec, a scratch pad, or a home for implementation decisions.

### Offer ADRs sparingly

Only offer to create an ADR when all three are true:

1. **Hard to reverse**: the cost of changing your mind later is meaningful.
2. **Surprising without context**: a future reader will wonder "why did they do this way?"
3. **The result of a real trade-off**: there were genuine alternatives and you picked one for specific reasons.

If any of the three is missing, skip the ADR. If a decision is easy to reverse, you will just reverse it. If it is not surprising, nobody will wonder why. If there was no real alternative, there is nothing to record beyond "we did the obvious thing".

When a decision qualifies, use the `architectural-decision-records` skill for the record's structure and write it to `adr/NNNN-kebab-title.md`. Accepted ADRs are immutable: supersede one with a new record rather than editing it.
