# Council Notes: proposal

## Author Summary

The draft adopted Supabase Auth, per-landlord ownership, JWKS verification in Rust, route guards, a per-account ledger, and a test identity, with three BREAKING markers.

## Reviewer Challenges

- RLS was framed as a safety net while the publishable key makes the Data API reachable with the landlord's own JWT; the policies are the only control there but were unverified.
- The bootstrap owner cannot be inserted by SQL; the seed mechanism and its production existence were contradictory.
- "The pre-auth ledger is claimed by whoever holds it" is a cross-owner leak.
- One shared test identity cannot survive sign-out and password-reset scenarios, and confirmation testing had no mechanism.
- The "44 scenarios" baseline is stale while two plans are pending; the `acceptance-suite` exclusion was unproven; the `auth` schema in the acceptance database was assumed.
- The draft required enforcement on an "update" route that does not exist.
- JWKS failure/rotation/testability and the `authenticated`-role/anonymous-user distinction were unstated.
- The return path had no open-redirect control.
- Open sign-up shipped without its abuse controls while calling completion done.
- "No long-lived credential in JS" overstated the guarantee.
- The BREAKING markers and "wire format unchanged" disagreed; `ownerId` exposure was undecided.
- The payment-reminders coordination was not actionable ordering.
- Requirement ownership was duplicated across capabilities; configuration had no home.
- Missing unconfirmed-email, reset-enumeration, and redirect-allowlist states.
- Terminology and Impact carried design detail.

## Resolutions

- Accepted: the Data API path is closed for owned tables (Data API disabled, client grants revoked) and tested; RLS is reframed as defense for that path, not a decorative net.
- Accepted: the bootstrap is an idempotent Auth-admin seed plus a lookup migration that aborts when the owner is missing; production starts empty and needs no bootstrap.
- Accepted: the legacy ledger is never auto-claimed; it is preserved and imported only by explicit confirmation.
- Accepted: one seeded owner plus a second owner; sign in once per run; disposable identities for sign-out/reset; the child run signs in; every account-scoped key is cleared.
- Accepted: confirmation is verified through the auth API with the acceptance environment's confirmation setting, and the production SMTP/CAPTCHA/rate-limit prerequisites are named.
- Accepted: the baseline is "the existing scenarios as of the implementing commit"; `acceptance-suite` is listed as modified; the acceptance database is the Supabase Postgres, so `auth.users` exists.
- Accepted: no update route; a future update adopts the predicate.
- Accepted: JWKS policy (ES256, pinned iss/aud, exp leeway, `authenticated`, no anonymous), ten-minute cache, one refetch on unknown `kid`, fail closed with 503, injectable verifier for tests.
- Accepted: the return path is a same-origin relative path with a single leading slash; anything else falls back to the default, enforced at the guard and both auth links.
- Accepted: minimum sign-up controls are in scope (rate limits + CAPTCHA; SMTP as a deploy prerequisite with an owner).
- Accepted: the token-exposure statement is precise; the refresh token moves to cookies, the access token stays JS-visible, and the proxy is named as the hardening.
- Accepted: `ownerId` is not in the wire response; the wire format is unchanged; the required-token and migration breaks are the BREAKING items.
- Accepted: payment-reminders lands after or is rebased; its tables require `owner_id`.
- Accepted: requirements are assigned once per capability; configuration lives under `authentication`.
- Accepted: unconfirmed/expired/resend, generic reset, and the redirect allowlist are requirements.
- Accepted: terminology uses one term per concept; Impact is high-level.

- Rejected: a shared test identity for sign-out/reset (breaks the run).
- Deferred: the token-hiding proxy, cross-tab sign-out, legacy-ledger encryption, account deletion, teams.

## Remaining Risks

- The acceptance database's auth capability is the highest-uncertainty assumption; verify early that the suite's Postgres has `auth.users` and that GoTrue is reachable.
- A required token plus a NOT NULL backfill plus a seeded identity is a coordinated deploy with no partial rollback.
- The refresh token still lives in browser-readable cookies; XSS can take both tokens until the proxy lands.
- Production email deliverability, CAPTCHA, and rate limiting have no owner named yet.
- The payment-reminders branch will collide with this migration chain if applied first.
