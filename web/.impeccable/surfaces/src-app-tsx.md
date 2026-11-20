---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: []
---

# Surface brief — Landlord Ledger web app (ledger surfaces)

## Scope and visitor mode

Scope: the ledger surfaces of the web app, ledger-first (Overview + Transactions in this pass; Properties and Reports inherit the world after the core is lived with). Mode: Operate — the visitor completes bookkeeping tasks; scanability, density, and real usage outrank expression.

## Audience, job, action, proof, constraints

Audience: landlords tracking their own portfolios. Job: record income/expense entries and read what each property earns. Action: add a transaction fast, scan the month's ledger, trust the numbers. Proof: real property names, real peso amounts, the running balance. Constraints: Architecture A (the web app is a shell; logic lives in Rust), spec-as-source zone discipline, no test framework inside web/ (the acceptance suite is an independent project), nothing binding on name or currency (₱ is current state, open by decision).

## Direction contract

THESIS: The ledger reads the way a bank records money — dense printed columns and a running balance auditable by eye — refusing the category's dashboard-of-white-cards default.

OWN-WORLD: Machine-print green hairline grid on ivory paper; ink-navy type; stamp-red held out for the one over-budget mark; entries at print density with tabular numerals. Recognizable with all content removed by the hairline grid and the red stamp.

STORY: The visitor recognizes bank-record trust before reading a word, enters a transaction like writing a passbook line, and audits the month by running their eye down the balance rail.

FIRST VIEWPORT: Left property rail and top tabs in navy over ivory; a compact summary strip; the transactions table as the page's mass at print density, tabular figures; the running balance column marching down the right edge; one red-stamped OVER BUDGET row as the single state color; "+ Add transaction" as the one primary control.

FORM: Bank Passbook — top-ranked grounded candidate (position 1 of 7; assigned index 7 was declined by the user's pick). seed:49000d5b2e15e9df

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Unresolved decisions

Product name (header today "Landlord Ledger"; nothing binding). Fraction-digit policy for money (decided in the C6 change, not here). TanStack tab routing (C5 folds into this pass or the next — see architecture report).
