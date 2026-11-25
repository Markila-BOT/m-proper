# 0008 Every landlord account owns its rows

- Status: accepted
- Date: 2026-11-24
- Supersedes: none

## Context and Problem Statement

The ledger is a single global portfolio: `properties` has no owner, the Rust API returns every row, and the browser's transaction ledger is one storage key shared by anyone using that browser. The user chose a multi-landlord product. Adding identity without ownership would let the first signed-in account read and change every landlord's records, and two accounts on one browser would share a local ledger.

## Considered Options

- Single tenant: one login gates the one global ledger; simplest, but every sign-up sees the same data.
- **Per-landlord ownership**: every row belongs to one account, scoped by the verified subject.
- Team/accountant sharing: multiple accounts per portfolio, membership and roles; a later layer.

## Decision Outcome

Chosen option: "per-landlord ownership", because it is the only option that makes open sign-up safe, and it still covers the single-landlord case by leaving sign-up closed.

Rules:

- `properties.owner_id uuid references auth.users(id) on delete cascade` is added, indexed, and made `NOT NULL` after a one-time backfill. The existing unowned row is assigned to a bootstrap owner created through Supabase Auth; the migration never guesses an owner.
- Every API query is scoped by the verified `sub`: list filters by it, create writes it, and delete matches `id` and owner together. A row owned by someone else returns 404, not 403, so existence is not leaked.
- The client never supplies an owner id; the API derives it from the token.
- RLS is enabled on `properties` with `authenticated` select/insert/update/delete policies on `owner_id = auth.uid()`. The Rust API connects with a privileged role that bypasses RLS, so app-level scoping is the primary control and RLS is defense in depth for any future Data API access. Neither layer substitutes for the other.
- New tables that hold landlord data (the pending payment-reminders tables) must carry `owner_id` when they land; this record's rule applies to them.
- The browser's local transaction ledger is keyed per account (`landlord-transactions:<user-id>`); the pre-auth key migrates to the bootstrap owner on first sign-in, and sign-out clears the in-memory property and filter stores.
- No sharing, teams, or roles in this change; adding them later means membership tables and policies that avoid recursive RLS.

### Consequences

- Good, because isolation is enforced at the API and again at the database.
- Good, because open sign-up becomes safe and the existing single-landlord case still works.
- Bad, because the one existing row needs a bootstrap owner, and the dev/local data must be reassigned.
- Bad, because the local ledger is per device; two devices show different local transactions even for the same account, and the server still knows only properties.
- Bad, because every existing acceptance scenario must run as a real owner, and the suite needs a dedicated test identity.
- Follow-up: a team model supersedes the single-owner rule; an account-deletion flow must decide whether a landlord's financial history is exported or erased.
