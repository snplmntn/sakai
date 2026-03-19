create extension if not exists pgcrypto;

do $$
declare
  legacy_table_exists boolean;
  legacy_stop_id_exists boolean;
  legacy_pk_name text;
begin
  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'routes'
  ) into legacy_table_exists;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'routes'
      and column_name = 'stop_id'
  ) into legacy_stop_id_exists;

  if legacy_table_exists and legacy_stop_id_exists then
    execute 'alter table public.routes rename to route_stop_import_rows';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'route_stop_import_rows'
      and column_name = 'stop_id'
  ) into legacy_stop_id_exists;

  if legacy_stop_id_exists then
    execute 'alter table public.route_stop_import_rows rename column stop_id to external_stop_code';
  end if;

  select tc.constraint_name
  into legacy_pk_name
  from information_schema.table_constraints tc
  join information_schema.constraint_column_usage ccu
    on tc.constraint_name = ccu.constraint_name
   and tc.table_schema = ccu.table_schema
  where tc.table_schema = 'public'
    and tc.table_name = 'route_stop_import_rows'
    and tc.constraint_type = 'PRIMARY KEY'
    and ccu.column_name = 'external_stop_code'
  limit 1;

  if legacy_pk_name is not null then
    execute format(
      'alter table public.route_stop_import_rows drop constraint %I',
      legacy_pk_name
    );
  end if;
end $$;

alter table if exists public.route_stop_import_rows
  add column if not exists id uuid default gen_random_uuid();

update public.route_stop_import_rows
set id = gen_random_uuid()
where id is null;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'route_stop_import_rows'
      and constraint_type = 'PRIMARY KEY'
  ) then
    execute 'alter table public.route_stop_import_rows add constraint route_stop_import_rows_pkey primary key (id)';
  end if;
end $$;

alter table if exists public.route_stop_import_rows
  add column if not exists import_batch text,
  add column if not exists route_code text,
  add column if not exists variant_code text,
  add column if not exists direction_label text,
  add column if not exists sequence integer,
  add column if not exists source_name text,
  add column if not exists source_url text,
  add column if not exists created_at timestamptz default timezone('utc', now());

update public.route_stop_import_rows
set import_batch = coalesce(import_batch, 'legacy-alabang-pasay-2026-03-19'),
    route_code = coalesce(route_code, 'JEEP-ALABANG-PASAY'),
    variant_code = coalesce(variant_code, 'JEEP-ALABANG-PASAY:OUTBOUND'),
    direction_label = coalesce(direction_label, 'Alabang to Pasay'),
    source_name = coalesce(source_name, 'legacy_manual_import'),
    created_at = coalesce(created_at, timezone('utc', now()));

with sequenced_rows as (
  select
    id,
    row_number() over (
      partition by variant_code
      order by
        coalesce(nullif(regexp_replace(external_stop_code, '\D', '', 'g'), ''), '0')::integer,
        external_stop_code
    ) as next_sequence
  from public.route_stop_import_rows
)
update public.route_stop_import_rows route_stop_import_rows
set sequence = sequenced_rows.next_sequence
from sequenced_rows
where route_stop_import_rows.id = sequenced_rows.id
  and route_stop_import_rows.sequence is null;

alter table if exists public.route_stop_import_rows
  alter column import_batch set not null,
  alter column route_code set not null,
  alter column variant_code set not null,
  alter column direction_label set not null,
  alter column sequence set not null,
  alter column external_stop_code set not null,
  alter column stop_name set not null,
  alter column source_name set not null,
  alter column created_at set not null;

create unique index if not exists route_stop_import_rows_batch_variant_sequence_uidx
  on public.route_stop_import_rows (import_batch, variant_code, sequence);

create index if not exists route_stop_import_rows_route_code_idx
  on public.route_stop_import_rows (route_code);

alter table if exists public.stops
  add column if not exists external_stop_code text;

create unique index if not exists stops_external_stop_code_uidx
  on public.stops (external_stop_code)
  where external_stop_code is not null;

alter table if exists public.route_variants
  add column if not exists code text;

update public.route_variants
set code = coalesce(
  code,
  concat(route_id, ':', lower(regexp_replace(direction_label, '[^a-zA-Z0-9]+', '-', 'g')))
)
where code is null;

alter table if exists public.route_variants
  alter column code set not null;

create unique index if not exists route_variants_code_uidx
  on public.route_variants (code);
