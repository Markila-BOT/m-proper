-- One-time reconciliation for a database whose `properties` table predates the
-- migration chain.
--
-- The table was created out-of-band (the dashboard), so the initial migration's
-- `create table if not exists` was a no-op and its column types, NOT NULL
-- defaults, and checks never landed. The frozen baseline in
-- `web/db/migrations/0000_baseline.sql` describes the intended shape; this
-- script brings an already-populated database to it.
--
-- It is NOT part of the migration chain and must not be added to it: a fresh
-- database gets the right shape from the baseline. Apply it once, by hand, to
-- an environment that shows the drift:
--
--   name: varchar(255) -> text
--   type: varchar(20)  -> text
--   is_active, created_at: nullable -> NOT NULL (both already defaulted)
--   the name/address/units checks missing
--   three single-column indexes the migrations never created
--
-- Every statement is safe on the single existing row (verified: one row, no
-- nulls, non-empty name and address, units = 1). Run it in one transaction.

begin;

alter table public.properties drop constraint if exists properties_type_check;

alter table public.properties alter column name type text;
alter table public.properties alter column type type text;

alter table public.properties alter column is_active set not null;
alter table public.properties alter column created_at set not null;

alter table public.properties
    add constraint properties_name_check check (length(btrim(name)) > 0);
alter table public.properties
    add constraint properties_address_check check (length(btrim(address)) > 0);
alter table public.properties
    add constraint properties_units_check check (units is null or units >= 0);
alter table public.properties
    add constraint properties_type_check check (type in ('residential', 'commercial', 'lot'));

drop index if exists public.idx_properties_created_at;
drop index if exists public.idx_properties_is_active;
drop index if exists public.idx_properties_type;

commit;
