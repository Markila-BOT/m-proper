create extension if not exists pgcrypto;

create table if not exists properties (
    id uuid primary key default gen_random_uuid(),
    name text not null check (length(btrim(name)) > 0),
    address text not null check (length(btrim(address)) > 0),
    type text not null check (type in ('residential', 'commercial', 'lot')),
    units integer check (units is null or units >= 0),
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

create index if not exists properties_active_created_at_idx
    on properties (is_active desc, created_at desc);
