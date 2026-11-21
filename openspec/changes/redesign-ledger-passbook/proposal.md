## Why

The ledger should read the way a bank records money; today it renders as a generic admin table with tab state trapped in `useState`. This change carries the committed "Bank Passbook" direction (`web/.impeccable/surfaces/src-app-tsx.md`) across the shell, Overview, and Transactions, adds the behaviors that direction and the stack constraints demand, and rides the C5 tab-routing decision.

## What Changes

- URL becomes state: four TanStack file routes (`/overview`, `/transactions`, `/properties`, `/reports`) replace the single-route + `useState` shell, and `/` redirects to `/overview`, so no existing entry point breaks. Navigation and deep links work everywhere; the four-route sweep gets a **live smoke**.
- One new product behavior: the ledger shows a **running balance**, derived client-side from its own transactions (no API changes, no opening-balance concept), accruing in displayed order — with sorting, the rail follows what the page shows.
- The ledger table is rebuilt on TanStack Table (`@tanstack/react-table` — new dependency, explicit version range per ADR-0001), giving the ledger column sorting as its second new behavior.
- Full passbook treatment of the app shell plus Overview and Transactions: machine-print green hairline grid on ivory paper, ink-navy type, stamp-red reserved for state marks, print-density entries in tabular numerals; spacing, borders, and padding follow the ui-taste craft playbooks.
- Every raw `<select>` in the web app goes away: `TransactionForm` and `FilterControls` — the complete set of raw selects — move to the existing Radix Select (`ui/select.tsx`); Properties and Reports contain no dropdowns.
- Properties and Reports get the passbook shell chrome only; their content layouts are untouched. All remaining changes are presentation of behavior that exists today.

## Capabilities

### New Capabilities

None. The new behaviors — the running balance and column sorting — land under `web-app` as added scenarios; nothing else here is new product behavior.

### Modified Capabilities

- **web-app** — all five current scenario names kept (View properties from API; Create property from UI; Delete property from UI; Transactions survive reload; Configurable API host), steps preserved wherever behavior is unchanged, plus two ADDED scenarios: the ledger shows a running balance, and the ledger can be sorted by its columns.

## Impact

- **Code** — web shell, Overview, and Transactions rebuilt (file routes, TanStack Table ledger, Radix Select dropdowns); Properties/Reports touched for chrome only; no Rust API changes (Architecture A unchanged).
- **Dependencies** — one addition (`@tanstack/react-table`, explicit range per ADR-0001); TanStack Router is already a dependency, so the file routes cost no new package.
- **Formatting** — the rebuilt surfaces use the deduped money formatter (and its fraction-digit policy) that the C3+C6 change lands, rather than re-duplicating it.
- **Artifacts** — DESIGN.md written at finish; the direction contract and surface brief are already committed; `model-pick.html` anchors the first viewport. Making the URL the app's state is durable and breaking-adjacent, so this change's adr artifact records it.
- **Verification** — the acceptance suite (once `adopt-acceptance-suite` is applied) executes `web-app`'s five kept scenarios plus the two added ones as the behavioral gate; URL addressability itself is covered by the manual live smoke across the four routes and the `/` redirect, which the suite does not fence.
- **Ordering** — applies only after `adopt-acceptance-suite` and the C3+C6 quick-wins change.

## Non-goals

- No Rust API changes, and no new product behavior beyond the running balance and column sorting.
- No full passbook treatment of Properties and Reports content areas — shell chrome only.
- No CI, no TypeScript 7, no auth work.
- No spec fencing or harness building — `adopt-acceptance-suite` owns those; this change only consumes its acceptance suite.
- No C1–C4 architecture refactorings — C5 tab routing is the only rider.
