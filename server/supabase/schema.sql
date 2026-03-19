create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'routes'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'routes'
      and column_name = 'stop_id'
  ) then
    if exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = 'route_stop_import_rows'
    ) then
      execute 'alter table public.routes rename to route_stop_import_rows_legacy_tmp';
    else
      execute 'alter table public.routes rename to route_stop_import_rows';
    end if;
  end if;
end $$;

do $$
declare
  pk_name text;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'route_stop_import_rows'
      and column_name = 'stop_id'
  ) then
    execute 'alter table public.route_stop_import_rows rename column stop_id to external_stop_code';
  end if;

  select tc.constraint_name
  into pk_name
  from information_schema.table_constraints tc
  join information_schema.constraint_column_usage ccu
    on tc.constraint_name = ccu.constraint_name
   and tc.table_schema = ccu.table_schema
  where tc.table_schema = 'public'
    and tc.table_name = 'route_stop_import_rows'
    and tc.constraint_type = 'PRIMARY KEY'
    and ccu.column_name = 'external_stop_code'
  limit 1;

  if pk_name is not null then
    execute format(
      'alter table public.route_stop_import_rows drop constraint %I',
      pk_name
    );
  end if;
end $$;

do $$
declare
  pk_name text;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'route_stop_import_rows_legacy_tmp'
      and column_name = 'stop_id'
  ) then
    execute 'alter table public.route_stop_import_rows_legacy_tmp rename column stop_id to external_stop_code';
  end if;

  select tc.constraint_name
  into pk_name
  from information_schema.table_constraints tc
  join information_schema.constraint_column_usage ccu
    on tc.constraint_name = ccu.constraint_name
   and tc.table_schema = ccu.table_schema
  where tc.table_schema = 'public'
    and tc.table_name = 'route_stop_import_rows_legacy_tmp'
    and tc.constraint_type = 'PRIMARY KEY'
    and ccu.column_name = 'external_stop_code'
  limit 1;

  if pk_name is not null then
    execute format(
      'alter table public.route_stop_import_rows_legacy_tmp drop constraint %I',
      pk_name
    );
  end if;
end $$;

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_preference text not null
    check (default_preference in ('fastest', 'cheapest', 'balanced')),
  passenger_type text not null
    check (passenger_type in ('regular', 'student', 'senior', 'pwd')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists set_user_preferences_updated_at on public.user_preferences;

create trigger set_user_preferences_updated_at
before update on public.user_preferences
for each row
execute function public.set_updated_at();

grant select, insert, update on public.user_preferences to authenticated;

alter table public.user_preferences enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_preferences'
      and policyname = 'user_preferences_select_own'
  ) then
    execute $policy$
      create policy user_preferences_select_own
      on public.user_preferences
      for select
      to authenticated
      using (auth.uid() = user_id)
    $policy$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_preferences'
      and policyname = 'user_preferences_insert_own'
  ) then
    execute $policy$
      create policy user_preferences_insert_own
      on public.user_preferences
      for insert
      to authenticated
      with check (auth.uid() = user_id)
    $policy$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_preferences'
      and policyname = 'user_preferences_update_own'
  ) then
    execute $policy$
      create policy user_preferences_update_own
      on public.user_preferences
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id)
    $policy$;
  end if;
end $$;

create table if not exists public.area_updates (
  id uuid primary key default gen_random_uuid(),
  external_id text not null,
  source text not null,
  source_url text not null,
  alert_type text not null,
  location text not null,
  direction text,
  involved text,
  reported_time_text text,
  lane_status text,
  traffic_status text,
  severity text not null default 'medium'
    check (severity in ('low', 'medium', 'high')),
  summary text not null default '',
  corridor_tags text[] not null default '{}',
  normalized_location text not null default '',
  display_until timestamptz not null default timezone('utc', now()) + interval '3 hour',
  raw_text text not null,
  scraped_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.area_updates
  add column if not exists severity text,
  add column if not exists summary text,
  add column if not exists corridor_tags text[] default '{}',
  add column if not exists normalized_location text,
  add column if not exists display_until timestamptz;

update public.area_updates
set severity = coalesce(severity, 'medium'),
    summary = coalesce(
      nullif(summary, ''),
      concat(alert_type, ' near ', location)
    ),
    corridor_tags = coalesce(corridor_tags, '{}'),
    normalized_location = coalesce(
      nullif(normalized_location, ''),
      lower(regexp_replace(location, '[^a-zA-Z0-9\s-]+', ' ', 'g'))
    ),
    display_until = coalesce(display_until, scraped_at + interval '3 hour');

alter table if exists public.area_updates
  alter column severity set not null,
  alter column summary set not null,
  alter column corridor_tags set not null,
  alter column normalized_location set not null,
  alter column display_until set not null,
  alter column severity set default 'medium',
  alter column corridor_tags set default '{}';

create unique index if not exists area_updates_external_id_uidx
  on public.area_updates (external_id);

create index if not exists area_updates_scraped_at_idx
  on public.area_updates (scraped_at desc);

create index if not exists area_updates_display_until_idx
  on public.area_updates (display_until desc);

create index if not exists area_updates_normalized_location_idx
  on public.area_updates (normalized_location);

create index if not exists area_updates_corridor_tags_gin_idx
  on public.area_updates using gin (corridor_tags);

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  city text not null,
  kind text not null
    check (kind in ('landmark', 'station', 'area', 'campus', 'mall', 'terminal')),
  latitude double precision not null,
  longitude double precision not null,
  google_place_id text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists places_canonical_name_idx
  on public.places (canonical_name);

create table if not exists public.place_aliases (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  alias text not null,
  normalized_alias text not null
);

create unique index if not exists place_aliases_place_id_normalized_alias_uidx
  on public.place_aliases (place_id, normalized_alias);

create index if not exists place_aliases_normalized_alias_idx
  on public.place_aliases (normalized_alias);

create table if not exists public.route_stop_import_rows (
  id uuid primary key default gen_random_uuid(),
  import_batch text not null,
  route_code text not null,
  variant_code text not null,
  direction_label text not null,
  sequence integer not null,
  external_stop_code text not null,
  stop_name text not null,
  latitude double precision,
  longitude double precision,
  source_name text not null,
  source_url text,
  created_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.route_stop_import_rows
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists import_batch text,
  add column if not exists route_code text,
  add column if not exists variant_code text,
  add column if not exists direction_label text,
  add column if not exists sequence integer,
  add column if not exists external_stop_code text,
  add column if not exists stop_name text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists source_name text,
  add column if not exists source_url text,
  add column if not exists created_at timestamptz default timezone('utc', now());

update public.route_stop_import_rows
set id = coalesce(id, gen_random_uuid()),
    import_batch = coalesce(import_batch, 'legacy-alabang-pasay-2026-03-19'),
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

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'route_stop_import_rows'
  ) and not exists (
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
  alter column id set not null,
  alter column import_batch set not null,
  alter column route_code set not null,
  alter column variant_code set not null,
  alter column direction_label set not null,
  alter column sequence set not null,
  alter column external_stop_code set not null,
  alter column stop_name set not null,
  alter column source_name set not null,
  alter column created_at set not null;

alter table if exists public.route_stop_import_rows_legacy_tmp
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists import_batch text,
  add column if not exists route_code text,
  add column if not exists variant_code text,
  add column if not exists direction_label text,
  add column if not exists sequence integer,
  add column if not exists external_stop_code text,
  add column if not exists stop_name text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists source_name text,
  add column if not exists source_url text,
  add column if not exists created_at timestamptz default timezone('utc', now());

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'route_stop_import_rows_legacy_tmp'
  ) then
    update public.route_stop_import_rows_legacy_tmp
    set id = coalesce(id, gen_random_uuid()),
        import_batch = coalesce(import_batch, 'legacy-alabang-pasay-2026-03-19'),
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
      from public.route_stop_import_rows_legacy_tmp
    )
    update public.route_stop_import_rows_legacy_tmp route_stop_import_rows_legacy_tmp
    set sequence = sequenced_rows.next_sequence
    from sequenced_rows
    where route_stop_import_rows_legacy_tmp.id = sequenced_rows.id
      and route_stop_import_rows_legacy_tmp.sequence is null;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'route_stop_import_rows_legacy_tmp'
  ) then
    insert into public.route_stop_import_rows (
      id,
      import_batch,
      route_code,
      variant_code,
      direction_label,
      sequence,
      external_stop_code,
      stop_name,
      latitude,
      longitude,
      source_name,
      source_url,
      created_at
    )
    select
      route_stop_import_rows_legacy_tmp.id,
      route_stop_import_rows_legacy_tmp.import_batch,
      route_stop_import_rows_legacy_tmp.route_code,
      route_stop_import_rows_legacy_tmp.variant_code,
      route_stop_import_rows_legacy_tmp.direction_label,
      route_stop_import_rows_legacy_tmp.sequence,
      route_stop_import_rows_legacy_tmp.external_stop_code,
      route_stop_import_rows_legacy_tmp.stop_name,
      route_stop_import_rows_legacy_tmp.latitude,
      route_stop_import_rows_legacy_tmp.longitude,
      route_stop_import_rows_legacy_tmp.source_name,
      route_stop_import_rows_legacy_tmp.source_url,
      route_stop_import_rows_legacy_tmp.created_at
    from public.route_stop_import_rows_legacy_tmp route_stop_import_rows_legacy_tmp
    on conflict (id) do update
    set import_batch = excluded.import_batch,
        route_code = excluded.route_code,
        variant_code = excluded.variant_code,
        direction_label = excluded.direction_label,
        sequence = excluded.sequence,
        external_stop_code = excluded.external_stop_code,
        stop_name = excluded.stop_name,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        source_name = excluded.source_name,
        source_url = excluded.source_url,
        created_at = excluded.created_at;

    execute 'drop table public.route_stop_import_rows_legacy_tmp';
  end if;
end $$;

create unique index if not exists route_stop_import_rows_batch_variant_sequence_uidx
  on public.route_stop_import_rows (import_batch, variant_code, sequence);

create index if not exists route_stop_import_rows_route_code_idx
  on public.route_stop_import_rows (route_code);

create table if not exists public.stops (
  id uuid primary key default gen_random_uuid(),
  place_id uuid references public.places(id) on delete set null,
  external_stop_code text,
  stop_name text not null,
  mode text not null
    check (mode in ('jeepney', 'uv', 'mrt3', 'lrt1', 'lrt2', 'walk_anchor')),
  area text not null,
  latitude double precision not null,
  longitude double precision not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.stops
  add column if not exists place_id uuid references public.places(id) on delete set null,
  add column if not exists external_stop_code text,
  add column if not exists stop_name text,
  add column if not exists mode text,
  add column if not exists area text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists is_active boolean default true,
  add column if not exists created_at timestamptz default timezone('utc', now());

create index if not exists stops_place_id_idx
  on public.stops (place_id);

create unique index if not exists stops_external_stop_code_uidx
  on public.stops (external_stop_code)
  where external_stop_code is not null;

create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  display_name text not null,
  primary_mode text not null
    check (primary_mode in ('jeepney', 'uv', 'mrt3', 'lrt1', 'lrt2')),
  operator_name text,
  source_name text not null,
  source_url text,
  trust_level text not null
    check (trust_level in ('trusted_seed', 'community_reviewed', 'demo_fallback')),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.routes
  add column if not exists code text,
  add column if not exists display_name text,
  add column if not exists primary_mode text,
  add column if not exists operator_name text,
  add column if not exists source_name text,
  add column if not exists source_url text,
  add column if not exists trust_level text,
  add column if not exists is_active boolean default true,
  add column if not exists created_at timestamptz default timezone('utc', now());

create index if not exists routes_code_idx
  on public.routes (code);

create table if not exists public.route_variants (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete cascade,
  code text not null unique,
  display_name text not null,
  direction_label text not null,
  origin_place_id uuid references public.places(id) on delete set null,
  destination_place_id uuid references public.places(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.route_variants
  add column if not exists route_id uuid references public.routes(id) on delete cascade,
  add column if not exists code text,
  add column if not exists display_name text,
  add column if not exists direction_label text,
  add column if not exists origin_place_id uuid references public.places(id) on delete set null,
  add column if not exists destination_place_id uuid references public.places(id) on delete set null,
  add column if not exists is_active boolean default true,
  add column if not exists created_at timestamptz default timezone('utc', now());

update public.route_variants
set code = coalesce(
  code,
  concat(route_id, ':', lower(regexp_replace(direction_label, '[^a-zA-Z0-9]+', '-', 'g')))
)
where code is null
  and route_id is not null
  and direction_label is not null;

alter table if exists public.route_variants
  alter column code drop not null;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'route_variants'
  ) and not exists (
    select 1
    from public.route_variants
    where code is null
  ) then
    execute 'alter table public.route_variants alter column code set not null';
  end if;
end $$;

create index if not exists route_variants_route_id_idx
  on public.route_variants (route_id);

create unique index if not exists route_variants_code_uidx
  on public.route_variants (code);

create index if not exists route_variants_origin_place_id_idx
  on public.route_variants (origin_place_id);

create index if not exists route_variants_destination_place_id_idx
  on public.route_variants (destination_place_id);

create table if not exists public.route_legs (
  id uuid primary key default gen_random_uuid(),
  route_variant_id uuid not null references public.route_variants(id) on delete cascade,
  sequence integer not null,
  mode text not null
    check (mode in ('jeepney', 'uv', 'mrt3', 'lrt1', 'lrt2')),
  from_stop_id uuid not null references public.stops(id) on delete cascade,
  to_stop_id uuid not null references public.stops(id) on delete cascade,
  route_label text not null,
  distance_km numeric(6, 2) not null,
  duration_minutes integer not null,
  fare_product_code text,
  corridor_tag text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists route_legs_route_variant_id_sequence_uidx
  on public.route_legs (route_variant_id, sequence);

create index if not exists route_legs_route_variant_id_sequence_idx
  on public.route_legs (route_variant_id, sequence);

create table if not exists public.transfer_points (
  id uuid primary key default gen_random_uuid(),
  from_stop_id uuid not null references public.stops(id) on delete cascade,
  to_stop_id uuid not null references public.stops(id) on delete cascade,
  walking_distance_m integer not null,
  walking_duration_minutes integer not null,
  is_accessible boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists transfer_points_from_stop_id_to_stop_id_uidx
  on public.transfer_points (from_stop_id, to_stop_id);

create index if not exists transfer_points_from_stop_id_idx
  on public.transfer_points (from_stop_id);

create index if not exists transfer_points_to_stop_id_idx
  on public.transfer_points (to_stop_id);

create table if not exists public.fare_rule_versions (
  id uuid primary key default gen_random_uuid(),
  mode text not null
    check (mode in ('jeepney', 'uv', 'mrt3', 'lrt1', 'lrt2', 'car')),
  version_name text not null,
  source_name text not null,
  source_url text not null,
  effectivity_date date not null,
  verified_at timestamptz not null,
  is_active boolean not null default false,
  trust_level text not null
    check (trust_level in ('official', 'estimated', 'demo_fallback')),
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists fare_rule_versions_active_mode_uidx
  on public.fare_rule_versions (mode)
  where is_active = true;

create unique index if not exists fare_rule_versions_mode_version_name_uidx
  on public.fare_rule_versions (mode, version_name);

create index if not exists fare_rule_versions_mode_idx
  on public.fare_rule_versions (mode);

create table if not exists public.fare_products (
  id uuid primary key default gen_random_uuid(),
  fare_rule_version_id uuid not null references public.fare_rule_versions(id) on delete cascade,
  product_code text not null,
  mode text not null
    check (mode in ('jeepney', 'uv', 'car')),
  pricing_strategy text not null
    check (pricing_strategy in ('minimum_plus_succeeding', 'per_km')),
  vehicle_class text not null,
  minimum_distance_km numeric(6, 2) not null,
  minimum_fare_regular numeric(8, 2) not null,
  minimum_fare_discounted numeric(8, 2),
  succeeding_distance_km numeric(6, 2) not null,
  succeeding_fare_regular numeric(8, 2) not null,
  succeeding_fare_discounted numeric(8, 2),
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists fare_products_version_product_code_uidx
  on public.fare_products (fare_rule_version_id, product_code);

create index if not exists fare_products_product_code_idx
  on public.fare_products (product_code);

create table if not exists public.train_station_fares (
  id uuid primary key default gen_random_uuid(),
  fare_rule_version_id uuid not null references public.fare_rule_versions(id) on delete cascade,
  origin_stop_id uuid not null references public.stops(id) on delete cascade,
  destination_stop_id uuid not null references public.stops(id) on delete cascade,
  regular_fare numeric(8, 2) not null,
  discounted_fare numeric(8, 2) not null,
  created_at timestamptz not null default timezone('utc', now()),
  check (origin_stop_id <> destination_stop_id)
);

create unique index if not exists train_station_fares_version_origin_destination_uidx
  on public.train_station_fares (fare_rule_version_id, origin_stop_id, destination_stop_id);

create index if not exists train_station_fares_origin_stop_id_idx
  on public.train_station_fares (origin_stop_id);

create index if not exists train_station_fares_destination_stop_id_idx
  on public.train_station_fares (destination_stop_id);
