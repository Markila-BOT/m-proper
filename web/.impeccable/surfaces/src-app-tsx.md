---
version: 1
slug: 'src-app-tsx'
primary_target: 'src/routes/__root.tsx'
related_targets:
  - 'src/components/PropertySidebar/index.tsx'
  - 'src/routes/transactions.tsx'
  - 'src/routes/overview.tsx'
  - 'src/routes/properties.tsx'
  - 'src/routes/reports.tsx'
---

# Surface brief — Landlord Ledger web app (glass world)

## Scope and visitor mode

Scope: the ledger surfaces of the web app, ledger-first (Overview + Transactions), with Properties and Reports inheriting the world. Mode: Operate — the visitor completes bookkeeping tasks; scanability, density, and real usage outrank expression.

## Audience, job, action, proof, constraints

Audience: landlords tracking their own portfolios. Job: record income/expense entries and read what each property earns. Action: add a transaction fast, scan the month's ledger, trust the numbers. Proof: real property names, real peso amounts, the running balance. Constraints: Architecture A (the web app is a shell; logic lives in Rust), spec-as-source zone discipline, no test framework inside web/ (the acceptance suite is an independent project), nothing binding on name or currency.

## Direction contract

THESIS: The ledger reads as a bank's record under a pane of glass — the passbook page stays opaque and exact, and only the chrome floats above it, as a bounded and measured material.

OWN-WORLD: Ivory paper, ink-navy type, machine-print green hairlines, mono tabular figures on the content. One glass material on the shell chrome only: a single sticky header+nav pane and the rail's glass head and foot, paper at 72%, 16px blur, 140% saturate, a print edge at 72%. No glass under record text; the rail's scrolling entry list is opaque paper. The refusal cascade renders an opaque tint, system colors, or gated travel — never an illegible pane. Recognizable with all content removed by the glass pane over a ruled paper page.

STORY: The visitor trusts the numbers because the page is opaque and auditable, and feels the shell float above them; the controls open as paper popovers, so the material never touches a figure.

FIRST VIEWPORT: A sticky glass pane holding the product name, the export control, the one primary action, and the three section labels; the rail's glass head over a paper entry list; the ledger sheet as the page's mass at print density, tabular figures, the running balance marching down the right edge.

FORM: Liquid Glass — user-pinned by the user's direction (ADR-0004), which supersedes the Bank Passbook direction. This world was chosen, not rolled; the passbook roll's seed belongs to the superseded direction and is history, not this contract.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
