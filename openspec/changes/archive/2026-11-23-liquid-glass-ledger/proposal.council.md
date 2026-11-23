# Council Notes: proposal.md

## Author Summary

Drafted the world replacement around a functional claim (paper flattens hierarchy; glass carries occlusion), with two capabilities, a two-scenario suite cap, and fallback/budget details deferred to design.

## Reviewer Challenges

- "Two additions" omitted `@radix-ui/react-popover`, which `web/package.json` proves absent — the datepicker cannot exist without it.
- "The five current scenarios" undercounted: the web-app main spec holds six, the unreachable state among them; and the typed-date validation and searchable select got no scenarios.
- The two-scenario cap contradicted the non-goal's "grows only where behavior genuinely changes" and could not cover four fallback conditions.
- "Text on an opaque content surface" contradicted "measure text over the actual glass" — the two rules applied to different text classes, unnamed.
- The functional-not-decorative gate was asserted, not discharged; "refractive" carried no job, test, or fallback.
- "Never on scrolling content" was defined by size, not scroll behavior, while sheets and popovers legitimately contain scrolling subtrees.
- Archive ownership and the DESIGN.md write were claimed three ways.

## Resolutions

- Accepted: three additions named, each with its own ADR-0001 review; the assumption note deleted.
- Accepted: "six current scenarios kept"; scenarios added for the calendar keyboard path, typed-date rejection, the searchable select, and the fallbacks as one Outline over four conditions.
- Accepted: the cap replaced by the rule "every observable behavior change gets a scenario"; the gate restated as 32 + N with the child run asserting zero failures.
- Accepted: text classes mapped to surfaces (body/numerals → opaque panel at 4.5:1; chrome labels/nav → glass, measured against worst-case sampled rendered pixels); non-text floors (borders, highlights, icons ≥3:1) added.
- Accepted: a job per glass location (sheets/popovers occlude; nav persists); "refractive" dropped as unmeasured and folded into the bounded blur/saturation budget.
- Accepted: the blur boundary made structural (no glass element with a scrolling descendant; fixed/sticky chrome; scrolling subtrees get an opaque panel).
- Accepted: the date filter pair becomes one range-mode calendar; the form keeps a single picker.
- Accepted: `@radix-ui/react-icons` retires after its two call sites migrate; icons are presentation, explicitly not fenced.
- Accepted: the passbook archives itself before this applies; this change's ADR supersedes its direction; DESIGN.md's replacement is an intentional supersede with the prior version preserved in history.
- Accepted: the combined forced-colors + no-backdrop-filter case renders an opaque panel with a solid system border.

## Remaining Risks

- The four-condition fallback Outline is the suite's first Outline; its steps are new ground.
- Range-mode calendar keyboard behavior (selecting start/end) is the least-standard interaction in the change.
- Glass performance on long sessions (composited blur on fixed chrome) is measured at the craft pass, not promised here.
