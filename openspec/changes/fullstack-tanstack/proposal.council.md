# Council Notes: proposal.md

## Author Summary

Proposes replacing the Rust Axum API with TanStack Start server routes on the app's own origin: HTTP JSON preserved, identity from the Supabase session cookie via a `jose` verifier, Drizzle for schema and migrations, a strangler cutover that deletes `api/` last, and a deployable build. New `deployable-artifact` capability; `authentication`, `web-app`, `acceptance-suite`, and `dependency-maintenance` modified.

## Reviewer Challenges

- Deleting `api/` makes three `dependency-maintenance` requirements unsatisfiable (Cargo manifest, OpenAPI regeneration, Rust check gate), which would redden the archive gate permanently.
- The OpenAPI regeneration gate was the only automated wire-contract guard, and the "messages preserved" claim is unprovable because no spec pins message text.
- `/properties` is already a page route, so a same-origin JSON route collides; also `DELETE /properties` without an id exists only because a distinct Rust handler returns 400, and Rust's JSON 404 fallback would become an HTML 404 under Start.
- `authentication`'s "refuses to start" requirement becomes untestable with one process, and the harness's second-instance probes assume `cargo run`.
- Renaming a requirement under `MODIFIED` breaks the schema's header match.
- The client-side refresh scenario cannot work when the access token lives in an httpOnly cookie.
- Cookie auth imports a CSRF surface that Bearer did not have; removing CORS is not a pure win.
- The migration runner, schema history, RLS/grants SQL, and the backfill runbook all live inside `api/` and would be destroyed.
- `authentication` has no main spec yet; a `MODIFIED` delta cannot validate until `landlord-accounts` archives.
- ADR-0007 cannot be partially superseded; its retained rules must be restated, and its ten-minute cache rationale rested on an edge cache that dies in a Node function.
- `database-access` and `node-runtime` are mostly technology and deployment prose, not executable capability specs.
- The runtime base-URL override exists only because of the second origin; reworking it keeps a product affordance alive for nothing.
- "Prove parity against the real database" is open-ended and cannot be a definition of done.

## Resolutions

- **Accepted**: rewrote the `dependency-maintenance` delta — ranges over `web/package.json` and root only; the OpenAPI gate replaced by shared-type checking plus the round-trip scenario; the Rust check gate replaced by the build and type-check gates.
- **Accepted**: struck message text from the parity commitment and declared it non-contractual. Rejected the alternative of adding message assertions, because that would make copy edits spec changes and `properties` would have to be modified for no behavioural gain.
- **Accepted**: routes move under `/api`; `DELETE /api/properties` without an id keeps answering the 400 envelope; an unknown `/api/*` path answers the JSON envelope. All three are now explicit obligations.
- **Accepted**: modified the `authentication` configuration requirement to the app's fail-fast server-side environment, with the executable proof in `deployable-artifact`; the harness gains a sabotaged second instance.
- **Accepted**: kept the `web-app` requirement's existing name and changed its body, so the `MODIFIED` header matches.
- **Accepted**: the server owns refresh and answers with rotated cookies; the browser no longer refreshes, and the scenario asserts that.
- **Accepted**: stated the CSRF control (`Secure`, `SameSite=Lax`, `Origin`/`Sec-Fetch-Site` on state-changing requests) in the proposal and listed it as a risk; removed "no new product behaviour" as an absolute.
- **Accepted**: the migration SQL is moved, not re-derived; a frozen baseline equal to the live schema is marked applied; `drizzle-kit push` is banned against Supabase; RLS, grants, and the `DO` block stay hand-authored; migrations are an explicit step over the direct connection, never at build or request time; the lost implicit `cargo run` migrate is added to the local and harness flows.
- **Accepted**: archiving `landlord-accounts` is a hard precondition and task 0.
- **Accepted**: the new ADR supersedes ADR-0007 wholly and restates the surviving rules; the cache rule is re-based rather than copied.
- **Accepted**: collapsed `database-access` and `node-runtime` into one `deployable-artifact` capability with executable scenarios; Drizzle and the driver move to the design and the ADR.
- **Accepted**: the base-URL override is deleted, not reworked; the unreachable state is driven from the test side.
- **Accepted**: added an enumerated parity matrix as the definition of done before `api/` is deleted.
- **Accepted**: added the "why now" trade (three queued changes are written against Rust) and a concrete definition of "deployable" (the built server answering a page and a route).
- **Accepted**: named the Nitro target as a new direct dependency governed by the dependency policy.
- **Deferred**: a DB-free liveness route. `/api/health` stays a readiness answer; whether the platform needs a separate liveness path is decided by the deployment change.

## Remaining Risks

- Parity regressions that the suite does not catch, particularly in validation ordering and message-free status choices.
- Drizzle drift against the live schema, and the destructive potential of a stray `drizzle-kit push`.
- Serverless pooling, prepared statements, and cold start; the driver choice is still open.
- Cookie parse and chunking errors surfacing as 401s that are hard to distinguish from expired sessions.
- CSRF protection that is incomplete on one verb.
- The cookie-only API closing the door on non-browser clients.
- `/api/health` being mistaken for a liveness probe.
