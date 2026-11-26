-- Every property belongs to one landlord account (ADR 0008). This is the
-- one-way, second half of the migration plan in design.md §5:
--
--   1. add `owner_id` (nullable) and its index,
--   2. backfill existing rows by looking up the seeded Bootstrap owner, aborting
--      when that owner is absent,
--   3. make `owner_id` NOT NULL,
--   4. enable RLS as defence in depth and close the direct Data API path.
--
-- A migration cannot create an `auth.users` row, so environments that already
-- hold properties seed the owner first (`scripts/seed-auth.ts`). Production
-- starts with no property rows, which makes step 2 inert there: there is nothing
-- to assign, so the lookup and the abort never run and the first real sign-up
-- owns its own data.
--
-- The migration never falls back to "any user". An absent bootstrap owner
-- aborts the migration instead of inventing an owner. The operator recovery is
-- documented in api/README.md ("Recovering from the owner backfill abort").

alter table properties
    add column if not exists owner_id uuid references auth.users (id) on delete cascade;

create index if not exists properties_owner_id_idx on properties (owner_id);

do $$
declare
    -- The seeded Bootstrap owner (design.md §5, scripts/seed-auth.ts). Named
    -- once so the lookup and the abort message cannot drift apart.
    bootstrap_owner_email constant text := 'owner@m-proper.test';
    bootstrap_owner_id uuid;
    unowned_rows bigint;
begin
    select count(*) into unowned_rows from properties where owner_id is null;

    -- The normal production path: no rows, nothing to backfill.
    if unowned_rows = 0 then
        return;
    end if;

    select id into bootstrap_owner_id
    from auth.users
    where lower(email) = lower(bootstrap_owner_email);

    if bootstrap_owner_id is null then
        raise exception using
            message = format(
                'properties.owner_id backfill aborted: %s row(s) have no owner but the bootstrap owner %s is absent from auth.users. Seed it, then rerun this migration: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SEED_OWNER_PASSWORD=... pnpm run seed:auth (SEED_OWNER_EMAIL defaults to %s). No owner was guessed.',
                unowned_rows,
                bootstrap_owner_email,
                bootstrap_owner_email
            ),
            hint = 'The migration never assigns rows to another account; it aborts instead.';
    end if;

    update properties set owner_id = bootstrap_owner_id where owner_id is null;
end
$$;

alter table properties alter column owner_id set not null;

-- Defence in depth. The API connects as the table owner, which bypasses RLS
-- unless FORCE ROW LEVEL SECURITY is set (it is not), so app-level scoping in
-- api/src/routes/properties.rs remains the primary control. These policies only
-- matter if the direct Data API path is ever re-enabled.
alter table properties enable row level security;

drop policy if exists properties_select_own on properties;
create policy properties_select_own on properties
    for select to authenticated
    using (owner_id = auth.uid());

drop policy if exists properties_insert_own on properties;
create policy properties_insert_own on properties
    for insert to authenticated
    with check (owner_id = auth.uid());

drop policy if exists properties_delete_own on properties;
create policy properties_delete_own on properties
    for delete to authenticated
    using (owner_id = auth.uid());

-- No update policy: the product exposes no update route, and the Data API is
-- closed. An update policy would pre-authorise a write nothing can perform, and
-- it would only be reachable while that path stays shut, so it adds no
-- protection today. It lands with the update route, which adopts the same
-- predicate (design.md §3).

-- Close the direct path: the Data API cannot reach the table through the
-- publishable key even if it is re-enabled, because `anon` and `authenticated`
-- lose every privilege. The API's own role owns the table and is unaffected.
revoke all on table properties from anon, authenticated;
