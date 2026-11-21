# 0003 URL as state for the landlord ledger

- Status: accepted
- Date: 2026-11-21
- Supersedes: none

## Context and Problem Statement

The web app hosts one route while its four views (Overview, Transactions, Properties, Reports) live in `useState`, with the active tab forwarded through a corridor of props. The browser's URL — the platform's native state seam — carries nothing, so deep links, the back button, and automation all bypass the app's own navigation model.

## Considered Options

- Keep `useState` tabs and route nothing (today's shape).
- URL as state: each view a real route; the shell renders whatever the URL says.
- A hybrid: routes for two views, tabs for the rest.

## Decision Outcome

Chosen option: "URL as state", because the browser already maintains this seam, automation drives URLs more reliably than tab clicks, and the app's own review identified the prop-forwarding corridor as friction the redesign would otherwise multiply.

Rules:

- One TanStack file route per view: `/overview`, `/transactions`, `/properties`, `/reports`.
- `/` redirects to `/overview`; no existing entry point breaks.
- Each view owns its filter state; the shell composes, it does not forward.
- The retired single-route shell and the three `TabType` declarations are deleted with the change that lands this.

### Consequences

- Good, because deep links and the back button work, and the acceptance suite can drive views by URL.
- Good, because filter-state changes stop rippling through the shell.
- Bad, because route-level code splitting becomes a future consideration the single route never had.
- Follow-up: a navigation capability in the specs if URL behavior ever needs executable coverage beyond the manual smoke.
