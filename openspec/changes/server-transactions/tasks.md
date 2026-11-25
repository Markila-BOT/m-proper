## 1. Ordering and the auth amendment

- [ ] 1.1 Amend the pending `landlord-accounts` plan (a revise pass) to drop its per-account local-ledger requirement and its per-account ledger task; confirm its delta never modifies "Client-side transactions retained"
- [ ] 1.2 Apply and archive `landlord-accounts` before this change applies, so the JWKS verifier, owner identity, and seeded test identities exist

## 2. The transaction table (code zone)

- [ ] 2.1 Write the migration: the `transactions` table with `owner_id` and `property_id` FKs (both cascade), the composite `(owner_id, id)` primary key, the date/description/category/type/amount checks, `created_at`, and the owner/date and property indexes
- [ ] 2.2 Enable RLS with no client policies, revoke any `anon`/`authenticated` grants, and verify the direct Data API path is refused; commit

## 3. The transaction API (red → green)

- [ ] 3.1 Write the API scenario steps for list, create, delete, validation, ownership, the idempotent client id, the 401/400/404 statuses, and the closed direct path — red
- [ ] 3.2 Implement the owner-scoped routes: list ordered date then id; create with the required owned property, the optional UUID, and idempotent per-owner behavior; delete scoped to the owner — green
- [ ] 3.3 Add the bearer security scheme and the new paths to OpenAPI; regenerate and update the client stamp; commit

## 4. Web data layer

- [ ] 4.1 Replace the local transactions store with the API client and query hooks: fetch on mount, window focus, and after mutations; map `propertyId` to the existing property id; keep the two-decimal peso amount
- [ ] 4.2 Add the create/delete/restore mutations with pending states; reuse the id on retry; treat a 404 delete as already gone
- [ ] 4.3 Run the build and type checks; commit

## 5. Ledger UI and the legacy retirement

- [ ] 5.1 Wire the ledger, totals, filters, sorting, running balance, book-authority rail, and export to the fetched owner rows; keep their semantics
- [ ] 5.2 Add the loading, empty, "No matches", and unreachable states; the create-failure form retention, the delete-failure row, and the restore-failure snapshot with inline errors
- [ ] 5.3 Keep the five-second undo in memory: delete then create-with-id; drop the snapshot on reload/navigation; surface a restore failure and the property-deleted case
- [ ] 5.4 Add the scoped legacy reader: detect the old key, export the old CSV, state that entries are not imported, discard on export or explicit confirmation, and report malformed data
- [ ] 5.5 Add the property-delete confirmation naming the ledger entries; commit

## 6. Acceptance

- [ ] 6.1 Seed and read the ledger through the API as the test identity; use the second seeded owner for isolation; clean up by list-and-delete
- [ ] 6.2 Exempt the legacy-notice scenarios to seed and clear the old key; retire local-ledger seeding elsewhere
- [ ] 6.3 Add the new scenarios (CRUD, validation, isolation, restore, the in-memory undo, the unreachable states, the cascade, the legacy discard) — red, then green
- [ ] 6.4 Run the full suite: existing plus new, zero pending or undefined, no stranded entries or legacy keys

## 7. Completion

- [ ] 7.1 Run `pnpm --filter web build`, `npx tsc --noEmit`, `npx eslint src`, `npx prettier --check src`, `cargo check`, `cargo clippy`, `cargo test`
- [ ] 7.2 Record the server ledger, the legacy retirement, and the online-only rule in `web/DESIGN.md`; confirm the ADRs and glossary are current
- [ ] 7.3 Run `openspec validate server-transactions` and resolve errors (the fenced-gherkin warnings are the validator's known style notices)
