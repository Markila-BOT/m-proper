# Council Notes: proposal.md

## Author Summary

Drafted the passbook redesign around the committed direction contract, with the URL restructure as the only BREAKING bullet, a single-scenario delta, and routing deliberately un-spec'd with the tension quarantined in a trailing author note.

## Reviewer Challenges

- The keystone bullet claimed exactly one new observable behavior while the draft itself delivered two more (URL restructure, sorting) and reserved stamp-red for an over-budget state that does not exist in the product.
- "Links into the old single route stop resolving" asserted a not-found outcome nothing had settled; a redirect is a different observable behavior.
- The change's only breaking substance had no scenario and no smoke coverage — the acceptance gate could not fail on it — and that admission sat in an off-schema Author Notes section.
- The running-balance scenario had indeterminate semantics (displayed vs chronological accrual) with no statement that it is client-derived and adds no opening-balance concept.
- "Every dropdown in the redesigned surfaces" silently narrowed the settled "all dropdowns" scope.
- "Fraction-digit policy" understated what C3+C6 lands: a deduped formatter the rebuild would otherwise re-duplicate.
- The impeccable pipeline detail sat in What Changes instead of Impact.
- "A four-tab shell makes routing necessary" presented a chosen rider as forced.
- Risks: router dependency count unverified; other fenced specs might click tabs; URL-as-state had no ADR home.

## Resolutions

- Accepted: keystone rewritten — one new product behavior (running balance, client-derived, accruing in displayed order) plus column sorting as the second added behavior from the user's own TanStack Table constraint; the over-budget mark dropped as a sketch-illustrative state, stamp-red now reserved for state marks generally.
- Accepted with a user decision: `/` redirects to `/overview` (user-confirmed) — no existing entry point breaks, so the **BREAKING** mark comes off the routing bullet entirely; the live smoke covers the four routes and the redirect.
- Accepted: the URL-coverage caveat moved into Impact > Verification; the off-schema Author Notes section deleted.
- Accepted: the delta now carries two ADDED scenarios (running balance; column sorting) instead of silently absorbing sorting.
- Accepted with verification: `TransactionForm` and `FilterControls` are the complete set of raw `<select>` usage (grep-verified), so the Radix Select claim provably satisfies "all dropdowns"; Properties and Reports are dropdown-free.
- Accepted: "uses the deduped money formatter (and its fraction-digit policy) that the C3+C6 change lands".
- Accepted: pipeline detail moved to Impact > Verification.
- Accepted: "makes necessary" dropped.
- Accepted: TanStack Router verified as an existing dependency — the file routes cost no new package; "Dependencies — one addition" is accurate.
- Accepted: URL-as-state gets an ADR created by this change's adr artifact (adr/0003).
- Verified, no change needed: no other fenced spec navigates by tab clicks (properties scenarios are HTTP-level; web-app's are route-agnostic), so the gate holds outside this change's delta.

## Remaining Risks

- The suite does not fence URL addressability; the redirect and deep links rest on the manual live smoke until a navigation capability is ever spec'd.
- The rebuild touches the same files C3+C6 dedupes; applying this change out of order would re-duplicate the formatter.
- Radix Select inside the passbook grid is a style integration risk (portal z-index, trigger borders) the craft pass must watch.
