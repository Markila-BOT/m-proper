## 1. Reminders schema and API foundations (code zone)

- [ ] 1.1 Write the migration for `payment_labels`, `payment_reminders`, and `payment_occurrences` with the checks, foreign keys (property cascade, label restrict, reminder cascade), unique `(reminder_id, due_date)`, and indexes; run it against the real Postgres and `cargo check`
- [ ] 1.2 Rust models and validation for labels, reminders, and occurrences (camelCase, enums, due day 1–31, end date after start, non-negative amounts) with unit tests
- [ ] 1.3 Export `api/openapi.json`, add the new paths to `scripts/generate-api-client.ts`, and stamp the client against the new contract

## 2. Labels (red → green)

- [ ] 2.1 Add the acceptance suite's reminders API helpers and probe cleanup (delete reminders before labels; labels are global) — no scenarios yet
- [ ] 2.2 Write the label scenario steps (create and list, delete-in-use refused with the holder named, delete unused) — red
- [ ] 2.3 Implement the label routes with the 409 guard — green
- [ ] 2.4 Verify the label scenarios pass; commit

## 3. Reminders and generation (red → green)

- [ ] 3.1 Write the reminder and generation scenario steps (quarterly create, invalid due day, month-end clamp, quarterly dates, annual month, one-off, horizon end) — red
- [ ] 3.2 Implement reminder create/list/get with the generation rule (anchor, frequency steps, clamp, end date, ten-year horizon) — green
- [ ] 3.3 Implement reminder edit with future-unpaid regeneration that preserves paid/skipped and past unpaid — green
- [ ] 3.4 Implement reminder delete with its occurrences in one transaction — green
- [ ] 3.5 Verify the reminder and generation scenarios pass; commit

## 4. Occurrence lifecycle (red → green)

- [ ] 4.1 Write the occurrence scenario steps (per-period amount edit, paid expected vs actual, skip, ledger link, regenerate preserving history, delete history, envelope and 400/404/409) — red
- [ ] 4.2 Implement the occurrence PATCH (expected amount, status transitions, paid amount/date, ledger link) with validation — green
- [ ] 4.3 Verify the occurrence scenarios pass; commit

## 5. Web data layer

- [ ] 5.1 Add the reminder domain types to `web/src/lib/domain.ts`, the client methods to `web/src/lib/api-client.ts`, and the React Query hooks (labels, reminders, occurrences) with the envelope and unreachable handling
- [ ] 5.2 Run `pnpm --filter web build` and `tsc --noEmit`; commit

## 6. Settings surface (red → green)

- [ ] 6.1 Write the Settings scenario steps (a label created on Settings is offered by the reminder form, delete-in-use refused with the holder named, unreachable state) — red
- [ ] 6.2 Implement `/settings` with the label manager (list, create, rename, map, delete) in the glass/paper world — green
- [ ] 6.3 Add the header gear linking to `/settings` with its accessible name — green
- [ ] 6.4 Verify the Settings scenarios pass; commit

## 7. Reminders surface (red → green)

- [ ] 7.1 Write the Reminders scenario steps (the tab and route, mark-paid linked expense, overdue reading, missing-ledger reading, last-payment seed, delete warning) — red
- [ ] 7.2 Implement `/reminders` with the reminder list and the create/edit form, including the label picklist and the last-payment seed — green
- [ ] 7.3 Implement the occurrence history (expected/paid, statuses, overdue, missing-link reading) and the reminder delete confirmation — green
- [ ] 7.4 Implement the mark-paid dialog and the two-store handshake (API confirm, local ledger write, link PATCH, named partial-failure states with retry) — green
- [ ] 7.5 Verify the Reminders scenarios pass; commit

## 8. Shell and property deletion (red → green)

- [ ] 8.1 Add the Reminders section tab and write the shell-reachability scenario — red → green
- [ ] 8.2 Add the property delete confirmation copy and the property-cascade scenario steps; verify the cascade and the copy — red → green
- [ ] 8.3 Commit

## 9. Completion

- [ ] 9.1 Run the full acceptance suite: every existing and new scenario passes, zero pending or undefined steps, no probe rows or labels stranded
- [ ] 9.2 Craft pass on the new surfaces (better-ui/colors/layout/typography/motion): glass on chrome only, opaque panels, tabular figures, inputs `text-base sm:text-sm`, screenshots at 1440 and 390
- [ ] 9.3 Verify the Local-Date Rule on the new dates under `TZ=Asia/Manila` and `TZ=America/New_York`
- [ ] 9.4 Run `openspec validate payment-reminders` and resolve errors (the fenced-gherkin warnings are the validator's known style notices)
- [ ] 9.5 Record any new surface pattern in `web/DESIGN.md` and the surface brief
