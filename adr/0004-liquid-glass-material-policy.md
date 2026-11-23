# 0004 Liquid Glass material policy

- Status: accepted
- Date: 2026-11-23
- Supersedes: the Bank Passbook direction recorded in the surface brief (rewritten in place) and DESIGN.md (replaced at the world change's finish)

## Context and Problem Statement

The Bank Passbook world (paper, hairlines, flat rules) gives every surface the same visual weight, so floating layers — sheets, popovers, persistent navigation — cannot show what sits above what. The user pinned a replacement world: Liquid Glass. Glass is also the easiest material to make decorative and illegible: text over varying backdrops, blur on scrolling content, and no degradation story are the standard failure modes.

## Considered Options

- Keep the passbook world and signal layering with shadows alone.
- Adopt Liquid Glass as an unbounded aesthetic (glass everywhere, decorative refraction).
- Adopt Liquid Glass as a bounded material: glass only where layering carries a job, opaque content under text, a stated blur budget, measured rendered pairs, and four fallbacks.

## Decision Outcome

Chosen option: "bounded material", because the user pinned the world and the honesty rails, and an unbounded material would trade the product's defining property — figures a landlord can trust by eye — for an effect.

Rules:

- Glass appears only on persistent chrome (header, nav) and occluding surfaces (sheets, popovers). No glass element has a scrolling descendant; scrolling subtrees sit on opaque panels.
- Content text (body, numerals, ledger figures) renders on opaque panels at 4.5:1 (3:1 large). Chrome text over glass is measured against the worst-case rendered composite. Non-text marks hold 3:1.
- The budget is explicit: blur ≤ 24px, saturate ≤ 160%, tint/highlight/shadow from one token layer; no unmeasured effect ships.
- Four fallbacks are mandatory: reduced transparency, no backdrop-filter, forced colors, reduced motion — including the combined forced-colors + no-backdrop-filter case.
- The honesty instruments (totals claims, book-authority rail and caveat, unreachable state, undo, export semantics, Local-Date Rule) are behavior, not world, and survive unchanged.

### Consequences

- Good, because layering becomes readable and the material stays legible by measurement rather than taste.
- Good, because the fallback cascade makes the world honest on hardware and in accessibility settings that refuse it.
- Bad, because blur on fixed chrome costs compositor time, so the craft pass must measure long sessions.
- Bad, because a world replacement resets visual baselines; the passbook captures become history, not a regression reference.
- Follow-up: if a future surface wants glass on scrolling content, it must supersede this record, not bend it.
