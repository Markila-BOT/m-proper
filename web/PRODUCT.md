# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Landlords generally — m-proper is built for landlords as a category, not only its author. The author is the first user; onboarding, positioning, and future auth decisions must not assume the author is the only one.

## Product Purpose

A landlord property income/expense tracker: record properties, track income and expense transactions against them, and read what each property earns and costs. Success is a landlord answering "what is this property making me?" in one glance, and trusting the record enough to keep it.

## Positioning

Open — no confirmed differentiator yet. Candidates implied by the stack, not yet claimed: full data ownership (your own Postgres via Supabase), a server that owns durable truth while the web app stays a shell, and an exportable, inspectable ledger. Nothing here is a commitment.

## Operating Context

Landlord bookkeeping: monthly income/expense entry against a property portfolio, a 22-entry category taxonomy (income and expense), per-property and portfolio-wide summaries, a six-month trend, filters over the ledger, and CSV export for records outside the app. Currency today is Philippine pesos (₱). Language today is English.

## Capabilities and Constraints

- Properties (create, list, delete) are server-backed: TanStack Start server routes over Drizzle → Supabase Postgres, JSON envelope `{ success, message, data? }`, camelCase fields.
- Transactions are still browser-local (localStorage); the planned `server-transactions` change moves them onto the same server routes.
- The app is one TanStack Start process: server routes under `/api` own the business logic and the database, and the browser calls them same-origin with its session cookie.
- Single-user today; multi-user is undecided, not foreclosed.
- No test suite in the product code yet; an acceptance-test harness is planned (spec-as-source, cucumber-js).

## Brand Commitments

None binding. The header name "Landlord Ledger" and the ₱ currency are current state, explicitly open to change in upcoming design work.

## Evidence on Hand

- Four real properties in the development Supabase database (Colinas Verdes, Downtown Office Complex, Real Supabase Property, Suburban Family Home).
- Behavior specs under `openspec/specs/` (properties, web-app, dependency-maintenance).
- No customers, testimonials, metrics, or marketing assets exist; future work must not fabricate any.

## Product Principles

1. The ledger is the product: recording and reading money in and out of a property must be fast and boring.
2. The server owns durable truth; the browser is a view of it.
3. Landlord vocabulary, not accounting jargon: properties, units, income, expenses, categories.
4. The record stays exportable (CSV) and inspectable (your own Postgres).
5. Multi-user doors stay unlocked: decisions may be single-user today, but never single-user forever by accident.
