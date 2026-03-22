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

create table if not exists public.user_saved_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  address text not null,
  label_kind text not null
    check (label_kind in ('preset', 'custom')),
  preset_label text
    check (preset_label in ('home', 'office', 'school')),
  custom_label text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint user_saved_places_address_not_blank
    check (length(btrim(address)) > 0),
  constraint user_saved_places_label_fields_valid
    check (
      (label_kind = 'preset' and preset_label is not null and custom_label is null)
      or
      (label_kind = 'custom' and preset_label is null and custom_label is not null and length(btrim(custom_label)) > 0)
    )
);

create unique index if not exists user_saved_places_user_preset_uidx
  on public.user_saved_places (user_id, preset_label)
  where preset_label is not null;

create index if not exists user_saved_places_user_updated_at_idx
  on public.user_saved_places (user_id, updated_at desc);

drop trigger if exists set_user_saved_places_updated_at on public.user_saved_places;

create trigger set_user_saved_places_updated_at
before update on public.user_saved_places
for each row
execute function public.set_updated_at();

grant select, insert, update, delete on public.user_saved_places to authenticated;

alter table public.user_saved_places enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_saved_places'
      and policyname = 'user_saved_places_select_own'
  ) then
    execute $policy$
      create policy user_saved_places_select_own
      on public.user_saved_places
      for select
      to authenticated
      using (auth.uid() = user_id)
    $policy$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_saved_places'
      and policyname = 'user_saved_places_insert_own'
  ) then
    execute $policy$
      create policy user_saved_places_insert_own
      on public.user_saved_places
      for insert
      to authenticated
      with check (auth.uid() = user_id)
    $policy$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_saved_places'
      and policyname = 'user_saved_places_update_own'
  ) then
    execute $policy$
      create policy user_saved_places_update_own
      on public.user_saved_places
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id)
    $policy$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_saved_places'
      and policyname = 'user_saved_places_delete_own'
  ) then
    execute $policy$
      create policy user_saved_places_delete_own
      on public.user_saved_places
      for delete
      to authenticated
      using (auth.uid() = user_id)
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

grant select, insert, update, delete on public.area_updates to service_role;
grant usage on schema public to service_role;
grant select on public.area_updates to authenticated;
grant select on public.area_updates to anon;

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

grant select on public.places to service_role;
grant select on public.places to authenticated;
grant select on public.places to anon;

create index if not exists places_canonical_name_idx
  on public.places (canonical_name);

create table if not exists public.place_aliases (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  alias text not null,
  normalized_alias text not null
);

grant select on public.place_aliases to service_role;
grant select on public.place_aliases to authenticated;
grant select on public.place_aliases to anon;

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
    check (mode in ('jeepney', 'uv', 'mrt3', 'lrt1', 'lrt2', 'walk_anchor', 'car')),
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

grant select on public.stops to service_role;
grant select on public.stops to authenticated;
grant select on public.stops to anon;

create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  display_name text not null,
  primary_mode text not null
    check (primary_mode in ('jeepney', 'uv', 'mrt3', 'lrt1', 'lrt2', 'car')),
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

grant select on public.routes to service_role;
grant select on public.routes to authenticated;
grant select on public.routes to anon;

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

grant select on public.route_variants to service_role;
grant select on public.route_variants to authenticated;
grant select on public.route_variants to anon;

create table if not exists public.route_legs (
  id uuid primary key default gen_random_uuid(),
  route_variant_id uuid not null references public.route_variants(id) on delete cascade,
  sequence integer not null,
  mode text not null
    check (mode in ('jeepney', 'uv', 'mrt3', 'lrt1', 'lrt2', 'car')),
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

grant select on public.route_legs to service_role;
grant select on public.route_legs to authenticated;
grant select on public.route_legs to anon;

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

grant select on public.transfer_points to service_role;
grant select on public.transfer_points to authenticated;
grant select on public.transfer_points to anon;

create table if not exists public.transit_stops (
  stop_id text primary key,
  stop_name text not null,
  normalized_name text not null,
  lat double precision not null,
  lon double precision not null,
  mode text not null,
  line text not null,
  all_modes text not null,
  all_lines text not null,
  is_multimodal boolean not null default false,
  line_count integer not null default 1,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists transit_stops_normalized_name_idx
  on public.transit_stops (normalized_name);

create index if not exists transit_stops_lat_lon_idx
  on public.transit_stops (lat, lon);

grant select on public.transit_stops to service_role;
grant select on public.transit_stops to authenticated;
grant select on public.transit_stops to anon;

create table if not exists public.transit_stop_edges (
  source_stop_id text not null references public.transit_stops(stop_id) on delete cascade,
  target_stop_id text not null references public.transit_stops(stop_id) on delete cascade,
  weight numeric(8, 2) not null,
  mode text not null,
  line text not null,
  route_short_name text,
  route_long_name text,
  transfer boolean not null default false,
  distance_meters numeric(10, 2) not null,
  estimated_time_min numeric(8, 2) not null,
  data_source text not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (source_stop_id, target_stop_id, line, mode, transfer)
);

create index if not exists transit_stop_edges_source_stop_id_idx
  on public.transit_stop_edges (source_stop_id);

create index if not exists transit_stop_edges_target_stop_id_idx
  on public.transit_stop_edges (target_stop_id);

grant select on public.transit_stop_edges to service_role;
grant select on public.transit_stop_edges to authenticated;
grant select on public.transit_stop_edges to anon;

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

grant select on public.fare_rule_versions to service_role;
grant select on public.fare_rule_versions to authenticated;
grant select on public.fare_rule_versions to anon;

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

grant select on public.fare_products to service_role;
grant select on public.fare_products to authenticated;
grant select on public.fare_products to anon;

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

grant select on public.train_station_fares to service_role;
grant select on public.train_station_fares to authenticated;
grant select on public.train_station_fares to anon;

create table if not exists public.community_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  submission_type text not null
    check (submission_type in ('missing_route', 'route_correction', 'fare_update', 'route_note')),
  status text not null default 'pending'
    check (status in ('pending', 'reviewed', 'approved', 'rejected')),
  title text not null,
  payload jsonb not null,
  source_context jsonb,
  review_notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists set_community_submissions_updated_at on public.community_submissions;

create trigger set_community_submissions_updated_at
before update on public.community_submissions
for each row
execute function public.set_updated_at();

alter table public.community_submissions enable row level security;

grant select, insert, update, delete on public.community_submissions to authenticated;

drop policy if exists "Allow users to view their own submissions" on public.community_submissions;
create policy "Allow users to view their own submissions"
on public.community_submissions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Allow users to create submissions" on public.community_submissions;
create policy "Allow users to create submissions"
on public.community_submissions
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Allow users to update their own pending submissions" on public.community_submissions;
create policy "Allow users to update their own pending submissions"
on public.community_submissions
for update
to authenticated
using (auth.uid() = user_id AND status = 'pending')
with check (auth.uid() = user_id);

create table if not exists public.community_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  title text not null,
  body text not null,
  origin_label text not null,
  destination_label text not null,
  origin_place_id uuid references public.places(id) on delete set null,
  destination_place_id uuid references public.places(id) on delete set null,
  route_query_text text,
  preference text check (preference in ('fastest', 'cheapest', 'balanced')),
  passenger_type text check (passenger_type in ('regular', 'student', 'senior', 'pwd')),
  source_context jsonb,
  reply_count integer not null default 0,
  last_answered_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists set_community_questions_updated_at on public.community_questions;

create trigger set_community_questions_updated_at
before update on public.community_questions
for each row
execute function public.set_updated_at();

create table if not exists public.community_question_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.community_questions(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  body text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists set_community_question_answers_updated_at on public.community_question_answers;

create trigger set_community_question_answers_updated_at
before update on public.community_question_answers
for each row
execute function public.set_updated_at();

do $$
declare
  trigger_record record;
  function_record record;
begin
  for trigger_record in
    select
      n.nspname as schema_name,
      c.relname as table_name,
      t.tgname as trigger_name
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where not t.tgisinternal
      and n.nspname = 'public'
      and c.relname in ('community_questions', 'community_question_answers')
      and pg_get_triggerdef(t.oid) ilike '%community_reactions%'
  loop
    execute format(
      'drop trigger if exists %I on %I.%I',
      trigger_record.trigger_name,
      trigger_record.schema_name,
      trigger_record.table_name
    );
  end loop;

  for function_record in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as identity_arguments
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and pg_get_functiondef(p.oid) ilike '%community_reactions%'
      and (
        pg_get_functiondef(p.oid) ilike '%community_question_answers%'
        or pg_get_functiondef(p.oid) ilike '%community_questions%'
      )
  loop
    execute format(
      'drop function if exists %I.%I(%s)',
      function_record.schema_name,
      function_record.function_name,
      function_record.identity_arguments
    );
  end loop;
end $$;

create or replace function public.increment_community_question_reply_count(question_id_input uuid)
returns void
language sql
security definer
as $$
  update public.community_questions
  set reply_count = (
        select count(*)
        from public.community_question_answers
        where question_id = question_id_input
      ),
      last_answered_at = (
        select max(created_at)
        from public.community_question_answers
        where question_id = question_id_input
      ),
      updated_at = timezone('utc', now())
  where id = question_id_input;
$$;

alter table public.community_questions enable row level security;
alter table public.community_question_answers enable row level security;

grant select, insert on public.community_questions to authenticated;
grant select, insert on public.community_question_answers to authenticated;
grant execute on function public.increment_community_question_reply_count(uuid) to authenticated;

update public.community_questions q
set reply_count = counts.reply_count,
    last_answered_at = counts.last_answered_at,
    updated_at = timezone('utc', now())
from (
  select
    q_inner.id,
    count(a.id)::integer as reply_count,
    max(a.created_at) as last_answered_at
  from public.community_questions q_inner
  left join public.community_question_answers a
    on a.question_id = q_inner.id
  group by q_inner.id
) as counts
where q.id = counts.id
  and (
    q.reply_count is distinct from counts.reply_count
    or q.last_answered_at is distinct from counts.last_answered_at
  );

drop policy if exists "Allow authenticated users to view community questions" on public.community_questions;
create policy "Allow authenticated users to view community questions"
on public.community_questions
for select
to authenticated
using (true);

drop policy if exists "Allow users to create community questions" on public.community_questions;
create policy "Allow users to create community questions"
on public.community_questions
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Allow authenticated users to view question answers" on public.community_question_answers;
create policy "Allow authenticated users to view question answers"
on public.community_question_answers
for select
to authenticated
using (true);

drop policy if exists "Allow users to create answers" on public.community_question_answers;
create policy "Allow users to create answers"
on public.community_question_answers
for insert
to authenticated
with check (auth.uid() = user_id);

alter table if exists public.routes
  add column if not exists lifecycle_status text default 'active',
  add column if not exists superseded_by_route_id uuid references public.routes(id) on delete set null;

update public.routes
set lifecycle_status = coalesce(lifecycle_status, case when is_active then 'active' else 'deprecated' end);

alter table if exists public.routes
  alter column lifecycle_status set not null,
  alter column lifecycle_status set default 'active';

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'routes'
      and constraint_name = 'routes_lifecycle_status_check'
  ) then
    execute 'alter table public.routes drop constraint routes_lifecycle_status_check';
  end if;

  execute $constraint$
    alter table public.routes
    add constraint routes_lifecycle_status_check
    check (lifecycle_status in ('active', 'deprecated', 'superseded'))
  $constraint$;
end $$;

alter table if exists public.route_variants
  add column if not exists lifecycle_status text default 'active',
  add column if not exists superseded_by_variant_id uuid references public.route_variants(id) on delete set null;

update public.route_variants
set lifecycle_status = coalesce(lifecycle_status, case when is_active then 'active' else 'deprecated' end);

alter table if exists public.route_variants
  alter column lifecycle_status set not null,
  alter column lifecycle_status set default 'active';

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'route_variants'
      and constraint_name = 'route_variants_lifecycle_status_check'
  ) then
    execute 'alter table public.route_variants drop constraint route_variants_lifecycle_status_check';
  end if;

  execute $constraint$
    alter table public.route_variants
    add constraint route_variants_lifecycle_status_check
    check (lifecycle_status in ('active', 'deprecated', 'superseded'))
  $constraint$;
end $$;

create index if not exists routes_lifecycle_status_idx
  on public.routes (lifecycle_status);

create index if not exists route_variants_lifecycle_status_idx
  on public.route_variants (lifecycle_status);

alter table if exists public.community_submissions
  add column if not exists route_id uuid references public.routes(id) on delete set null,
  add column if not exists route_variant_id uuid references public.route_variants(id) on delete set null;

update public.community_submissions
set status = 'under_review'
where status = 'reviewed';

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'community_submissions'
      and constraint_name = 'community_submissions_submission_type_check'
  ) then
    execute 'alter table public.community_submissions drop constraint community_submissions_submission_type_check';
  end if;

  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'community_submissions'
      and constraint_name = 'community_submissions_status_check'
  ) then
    execute 'alter table public.community_submissions drop constraint community_submissions_status_check';
  end if;

  execute $constraint$
    alter table public.community_submissions
    add constraint community_submissions_submission_type_check
    check (
      submission_type in (
        'missing_route',
        'route_correction',
        'fare_update',
        'route_note',
        'route_create',
        'route_update',
        'route_deprecate',
        'route_reactivate',
        'stop_correction',
        'transfer_correction'
      )
    )
  $constraint$;

  execute $constraint$
    alter table public.community_submissions
    add constraint community_submissions_status_check
    check (status in ('pending', 'under_review', 'approved', 'rejected', 'published'))
  $constraint$;
end $$;

create index if not exists community_submissions_route_id_idx
  on public.community_submissions (route_id);

create index if not exists community_submissions_route_variant_id_idx
  on public.community_submissions (route_variant_id);

alter table if exists public.community_question_answers
  add column if not exists helpful_count integer default 0,
  add column if not exists promotion_status text default 'not_reviewed',
  add column if not exists linked_route_id uuid references public.routes(id) on delete set null,
  add column if not exists linked_route_variant_id uuid references public.route_variants(id) on delete set null;

update public.community_question_answers
set helpful_count = coalesce(helpful_count, 0),
    promotion_status = coalesce(promotion_status, 'not_reviewed');

alter table if exists public.community_question_answers
  alter column helpful_count set not null,
  alter column helpful_count set default 0,
  alter column promotion_status set not null,
  alter column promotion_status set default 'not_reviewed';

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'community_question_answers'
      and constraint_name = 'community_question_answers_promotion_status_check'
  ) then
    execute 'alter table public.community_question_answers drop constraint community_question_answers_promotion_status_check';
  end if;

  execute $constraint$
    alter table public.community_question_answers
    add constraint community_question_answers_promotion_status_check
    check (promotion_status in ('not_reviewed', 'promoted', 'published'))
  $constraint$;
end $$;

create index if not exists community_question_answers_promotion_status_idx
  on public.community_question_answers (promotion_status);

create table if not exists public.community_route_learning_proposals (
  id uuid primary key default gen_random_uuid(),
  source_kind text not null
    check (source_kind in ('direct_submission', 'promoted_answer')),
  source_submission_id uuid references public.community_submissions(id) on delete set null,
  source_question_id uuid references public.community_questions(id) on delete set null,
  source_answer_id uuid references public.community_question_answers(id) on delete set null,
  created_by_user_id uuid not null references auth.users(id),
  proposal_type text not null
    check (
      proposal_type in (
        'route_create',
        'route_update',
        'route_deprecate',
        'route_reactivate',
        'stop_correction',
        'transfer_correction',
        'fare_update',
        'route_note'
      )
    ),
  review_status text not null default 'pending'
    check (review_status in ('pending', 'under_review', 'approved', 'rejected', 'published')),
  title text not null,
  summary text,
  route_id uuid references public.routes(id) on delete set null,
  route_variant_id uuid references public.route_variants(id) on delete set null,
  target_stop_ids uuid[] not null default '{}',
  target_transfer_point_ids uuid[] not null default '{}',
  proposed_lifecycle_status text
    check (proposed_lifecycle_status in ('active', 'deprecated', 'superseded')),
  payload jsonb not null default '{}'::jsonb,
  evidence_note text,
  review_notes text,
  reviewed_by_user_id uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint community_route_learning_proposals_source_check
    check (
      (source_kind = 'direct_submission' and source_submission_id is not null)
      or
      (source_kind = 'promoted_answer' and source_question_id is not null and source_answer_id is not null)
    )
);

drop trigger if exists set_community_route_learning_proposals_updated_at on public.community_route_learning_proposals;

create trigger set_community_route_learning_proposals_updated_at
before update on public.community_route_learning_proposals
for each row
execute function public.set_updated_at();

create index if not exists community_route_learning_proposals_review_status_idx
  on public.community_route_learning_proposals (review_status, created_at desc);

create index if not exists community_route_learning_proposals_route_id_idx
  on public.community_route_learning_proposals (route_id);

create index if not exists community_route_learning_proposals_route_variant_id_idx
  on public.community_route_learning_proposals (route_variant_id);

grant select, insert, update, delete on public.community_route_learning_proposals to service_role;

create table if not exists public.community_route_publications (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.community_route_learning_proposals(id) on delete cascade,
  reviewer_user_id uuid not null references auth.users(id),
  route_id uuid references public.routes(id) on delete set null,
  route_variant_id uuid references public.route_variants(id) on delete set null,
  publication_action text not null
    check (
      publication_action in (
        'route_create',
        'route_update',
        'route_deprecate',
        'route_reactivate',
        'stop_correction',
        'transfer_correction',
        'fare_update',
        'route_note'
      )
    ),
  change_summary text not null,
  published_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists community_route_publications_proposal_id_uidx
  on public.community_route_publications (proposal_id);

create index if not exists community_route_publications_route_id_created_at_idx
  on public.community_route_publications (route_id, created_at desc);

create index if not exists community_route_publications_route_variant_id_created_at_idx
  on public.community_route_publications (route_variant_id, created_at desc);

grant select, insert, update, delete on public.community_route_publications to service_role;

create table if not exists public.community_route_notes (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.community_route_publications(id) on delete cascade,
  route_id uuid references public.routes(id) on delete set null,
  route_variant_id uuid references public.route_variants(id) on delete set null,
  note text not null,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists community_route_notes_publication_id_uidx
  on public.community_route_notes (publication_id);

create index if not exists community_route_notes_route_id_idx
  on public.community_route_notes (route_id, is_active, created_at desc);

create index if not exists community_route_notes_route_variant_id_idx
  on public.community_route_notes (route_variant_id, is_active, created_at desc);

grant select, insert, update, delete on public.community_route_notes to service_role;

alter table if exists public.community_route_learning_proposals
  add column if not exists reviewed_change_set jsonb not null default '{}'::jsonb;

create table if not exists public.community_route_ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid references public.community_route_learning_proposals(id) on delete cascade,
  source_submission_id uuid references public.community_submissions(id) on delete cascade,
  source_question_id uuid references public.community_questions(id) on delete cascade,
  source_answer_id uuid references public.community_question_answers(id) on delete cascade,
  model_name text not null,
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  duplicate_key text,
  suggestion jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint community_route_ai_suggestions_source_check
    check (
      proposal_id is not null
      or source_submission_id is not null
      or (source_question_id is not null and source_answer_id is not null)
    )
);

create index if not exists community_route_ai_suggestions_proposal_id_created_at_idx
  on public.community_route_ai_suggestions (proposal_id, created_at desc);

create index if not exists community_route_ai_suggestions_answer_id_created_at_idx
  on public.community_route_ai_suggestions (source_answer_id, created_at desc);

create index if not exists community_route_ai_suggestions_duplicate_key_idx
  on public.community_route_ai_suggestions (duplicate_key, created_at desc);

grant select, insert, update, delete on public.community_route_ai_suggestions to service_role;

create or replace function public.publish_community_route_proposal(
  p_proposal_id uuid,
  p_reviewer_user_id uuid,
  p_change_summary text,
  p_review_notes text default null,
  p_note text default null,
  p_reviewed_change_set jsonb default null
)
returns public.community_route_learning_proposals
language plpgsql
security definer
set search_path = public
as $$
declare
  proposal public.community_route_learning_proposals%rowtype;
  route_record public.routes%rowtype;
  variant_record public.route_variants%rowtype;
  updated_change_set jsonb := coalesce(p_reviewed_change_set, '{}'::jsonb);
  leg_payload jsonb;
  fare_product_payload jsonb;
  train_fare_payload jsonb;
  publication_id uuid;
  note_text text;
  target_stop_id uuid;
  target_transfer_point_id uuid;
  transfer_record public.transfer_points%rowtype;
  rule_version_id uuid;
  activate_version boolean;
  inferred_route_id uuid;
  inferred_route_variant_id uuid;
begin
  select *
  into proposal
  from public.community_route_learning_proposals
  where id = p_proposal_id
  for update;

  if not found then
    raise exception 'Community review proposal not found';
  end if;

  if proposal.review_status = 'rejected' then
    raise exception 'Proposal % cannot be published from rejected status', proposal.id;
  end if;

  if proposal.review_status = 'published' then
    return proposal;
  end if;

  if proposal.reviewed_change_set is not null and proposal.reviewed_change_set <> '{}'::jsonb then
    updated_change_set := proposal.reviewed_change_set || updated_change_set;
  end if;

  if proposal.route_variant_id is not null then
    select *
    into variant_record
    from public.route_variants
    where id = proposal.route_variant_id
    for update;
  end if;

  if proposal.route_id is not null then
    select *
    into route_record
    from public.routes
    where id = proposal.route_id
    for update;
  elsif variant_record.id is not null then
    select *
    into route_record
    from public.routes
    where id = variant_record.route_id
    for update;
  end if;

  if proposal.proposal_type = 'route_create' then
    if jsonb_typeof(updated_change_set->'route') <> 'object' then
      raise exception 'route_create requires reviewed_change_set.route';
    end if;

    if jsonb_typeof(updated_change_set->'variant') <> 'object' then
      raise exception 'route_create requires reviewed_change_set.variant';
    end if;

    if jsonb_typeof(updated_change_set->'legs') <> 'array'
      or jsonb_array_length(updated_change_set->'legs') = 0 then
      raise exception 'route_create requires reviewed_change_set.legs';
    end if;

    insert into public.routes (
      code,
      display_name,
      primary_mode,
      operator_name,
      source_name,
      source_url,
      trust_level,
      lifecycle_status,
      is_active
    )
    values (
      nullif(trim(updated_change_set #>> '{route,code}'), ''),
      coalesce(
        nullif(trim(updated_change_set #>> '{route,displayName}'), ''),
        nullif(trim(proposal.title), '')
      ),
      coalesce(
        nullif(trim(updated_change_set #>> '{route,primaryMode}'), ''),
        'jeepney'
      ),
      nullif(trim(updated_change_set #>> '{route,operatorName}'), ''),
      coalesce(nullif(trim(updated_change_set #>> '{route,sourceName}'), ''), 'Community reviewed'),
      nullif(trim(updated_change_set #>> '{route,sourceUrl}'), ''),
      'community_reviewed',
      'active',
      true
    )
    returning * into route_record;

    insert into public.route_variants (
      route_id,
      code,
      display_name,
      direction_label,
      origin_place_id,
      destination_place_id,
      lifecycle_status,
      is_active
    )
    values (
      route_record.id,
      nullif(trim(updated_change_set #>> '{variant,code}'), ''),
      coalesce(
        nullif(trim(updated_change_set #>> '{variant,displayName}'), ''),
        route_record.display_name
      ),
      coalesce(
        nullif(trim(updated_change_set #>> '{variant,directionLabel}'), ''),
        'Community reviewed'
      ),
      nullif(updated_change_set #>> '{variant,originPlaceId}', '')::uuid,
      nullif(updated_change_set #>> '{variant,destinationPlaceId}', '')::uuid,
      'active',
      true
    )
    returning * into variant_record;

    for leg_payload in
      select value
      from jsonb_array_elements(updated_change_set->'legs')
    loop
      insert into public.route_legs (
        route_variant_id,
        sequence,
        mode,
        from_stop_id,
        to_stop_id,
        route_label,
        distance_km,
        duration_minutes,
        fare_product_code,
        corridor_tag
      )
      values (
        variant_record.id,
        coalesce((leg_payload->>'sequence')::integer, 0),
        coalesce(nullif(trim(leg_payload->>'mode'), ''), route_record.primary_mode),
        nullif(leg_payload->>'fromStopId', '')::uuid,
        nullif(leg_payload->>'toStopId', '')::uuid,
        coalesce(nullif(trim(leg_payload->>'routeLabel'), ''), route_record.display_name),
        coalesce((leg_payload->>'distanceKm')::numeric, 0),
        coalesce((leg_payload->>'durationMinutes')::integer, 0),
        nullif(trim(leg_payload->>'fareProductCode'), ''),
        coalesce(nullif(trim(leg_payload->>'corridorTag'), ''), route_record.code)
      );
    end loop;
  elsif proposal.proposal_type = 'route_update' then
    if route_record.id is null then
      raise exception 'route_update requires proposal.route_id or proposal.route_variant_id';
    end if;

    if jsonb_typeof(updated_change_set->'variant') <> 'object' then
      raise exception 'route_update requires reviewed_change_set.variant';
    end if;

    if jsonb_typeof(updated_change_set->'legs') <> 'array'
      or jsonb_array_length(updated_change_set->'legs') = 0 then
      raise exception 'route_update requires reviewed_change_set.legs';
    end if;

    insert into public.route_variants (
      route_id,
      code,
      display_name,
      direction_label,
      origin_place_id,
      destination_place_id,
      lifecycle_status,
      is_active
    )
    values (
      route_record.id,
      nullif(trim(updated_change_set #>> '{variant,code}'), ''),
      coalesce(
        nullif(trim(updated_change_set #>> '{variant,displayName}'), ''),
        coalesce(variant_record.display_name, route_record.display_name)
      ),
      coalesce(
        nullif(trim(updated_change_set #>> '{variant,directionLabel}'), ''),
        coalesce(variant_record.direction_label, 'Community reviewed')
      ),
      coalesce(
        nullif(updated_change_set #>> '{variant,originPlaceId}', '')::uuid,
        variant_record.origin_place_id
      ),
      coalesce(
        nullif(updated_change_set #>> '{variant,destinationPlaceId}', '')::uuid,
        variant_record.destination_place_id
      ),
      'active',
      true
    )
    returning * into variant_record;

    for leg_payload in
      select value
      from jsonb_array_elements(updated_change_set->'legs')
    loop
      insert into public.route_legs (
        route_variant_id,
        sequence,
        mode,
        from_stop_id,
        to_stop_id,
        route_label,
        distance_km,
        duration_minutes,
        fare_product_code,
        corridor_tag
      )
      values (
        variant_record.id,
        coalesce((leg_payload->>'sequence')::integer, 0),
        coalesce(nullif(trim(leg_payload->>'mode'), ''), route_record.primary_mode),
        nullif(leg_payload->>'fromStopId', '')::uuid,
        nullif(leg_payload->>'toStopId', '')::uuid,
        coalesce(nullif(trim(leg_payload->>'routeLabel'), ''), route_record.display_name),
        coalesce((leg_payload->>'distanceKm')::numeric, 0),
        coalesce((leg_payload->>'durationMinutes')::integer, 0),
        nullif(trim(leg_payload->>'fareProductCode'), ''),
        coalesce(nullif(trim(leg_payload->>'corridorTag'), ''), route_record.code)
      );
    end loop;

    if proposal.route_variant_id is not null then
      update public.route_variants
      set lifecycle_status = 'superseded',
          is_active = false,
          superseded_by_variant_id = variant_record.id
      where id = proposal.route_variant_id;
    end if;

    update public.routes
    set trust_level = 'community_reviewed',
        lifecycle_status = 'active',
        is_active = true,
        display_name = coalesce(
          nullif(trim(updated_change_set #>> '{route,displayName}'), ''),
          display_name
        ),
        operator_name = coalesce(
          nullif(trim(updated_change_set #>> '{route,operatorName}'), ''),
          operator_name
        ),
        source_name = coalesce(
          nullif(trim(updated_change_set #>> '{route,sourceName}'), ''),
          source_name
        ),
        source_url = coalesce(
          nullif(trim(updated_change_set #>> '{route,sourceUrl}'), ''),
          source_url
        )
      where id = route_record.id
      returning * into route_record;
  elsif proposal.proposal_type = 'route_deprecate' then
    if route_record.id is null then
      raise exception 'route_deprecate requires proposal.route_id or proposal.route_variant_id';
    end if;

    if proposal.route_variant_id is not null then
      update public.route_variants
      set lifecycle_status = 'deprecated',
          is_active = false
      where id = proposal.route_variant_id
      returning * into variant_record;
    end if;

    update public.routes
    set lifecycle_status = 'deprecated',
        is_active = false,
        trust_level = 'community_reviewed'
    where id = route_record.id
    returning * into route_record;
  elsif proposal.proposal_type = 'route_reactivate' then
    if route_record.id is null then
      raise exception 'route_reactivate requires proposal.route_id or proposal.route_variant_id';
    end if;

    if proposal.route_variant_id is not null then
      update public.route_variants
      set lifecycle_status = 'active',
          is_active = true,
          superseded_by_variant_id = null
      where id = proposal.route_variant_id
      returning * into variant_record;
    end if;

    update public.routes
    set lifecycle_status = 'active',
        is_active = true,
        trust_level = 'community_reviewed'
    where id = route_record.id
    returning * into route_record;
  elsif proposal.proposal_type = 'stop_correction' then
    target_stop_id := coalesce(
      nullif(updated_change_set->>'stopId', '')::uuid,
      proposal.target_stop_ids[1]
    );

    if target_stop_id is null then
      raise exception 'stop_correction requires reviewed_change_set.stopId or target_stop_ids';
    end if;

    update public.stops
    set stop_name = coalesce(nullif(trim(updated_change_set->>'stopName'), ''), stop_name),
        external_stop_code = coalesce(
          nullif(trim(updated_change_set->>'externalStopCode'), ''),
          external_stop_code
        ),
        area = coalesce(nullif(trim(updated_change_set->>'area'), ''), area),
        latitude = coalesce((updated_change_set->>'latitude')::double precision, latitude),
        longitude = coalesce((updated_change_set->>'longitude')::double precision, longitude),
        place_id = coalesce(nullif(updated_change_set->>'placeId', '')::uuid, place_id),
        is_active = coalesce((updated_change_set->>'isActive')::boolean, is_active)
    where id = target_stop_id;
  elsif proposal.proposal_type = 'transfer_correction' then
    target_transfer_point_id := coalesce(
      nullif(updated_change_set->>'transferPointId', '')::uuid,
      proposal.target_transfer_point_ids[1]
    );

    if target_transfer_point_id is not null then
      update public.transfer_points
      set walking_distance_m = coalesce(
            (updated_change_set->>'walkingDistanceM')::integer,
            walking_distance_m
          ),
          walking_duration_minutes = coalesce(
            (updated_change_set->>'walkingDurationMinutes')::integer,
            walking_duration_minutes
          ),
          is_accessible = coalesce((updated_change_set->>'isAccessible')::boolean, is_accessible)
      where id = target_transfer_point_id
      returning * into transfer_record;
    else
      insert into public.transfer_points (
        from_stop_id,
        to_stop_id,
        walking_distance_m,
        walking_duration_minutes,
        is_accessible
      )
      values (
        nullif(updated_change_set->>'fromStopId', '')::uuid,
        nullif(updated_change_set->>'toStopId', '')::uuid,
        coalesce((updated_change_set->>'walkingDistanceM')::integer, 0),
        coalesce((updated_change_set->>'walkingDurationMinutes')::integer, 0),
        coalesce((updated_change_set->>'isAccessible')::boolean, true)
      )
      on conflict (from_stop_id, to_stop_id)
      do update set
        walking_distance_m = excluded.walking_distance_m,
        walking_duration_minutes = excluded.walking_duration_minutes,
        is_accessible = excluded.is_accessible
      returning * into transfer_record;
    end if;
  elsif proposal.proposal_type = 'fare_update' then
    if jsonb_typeof(updated_change_set->'ruleVersion') <> 'object' then
      raise exception 'fare_update requires reviewed_change_set.ruleVersion';
    end if;

    activate_version := coalesce((updated_change_set->>'activateVersion')::boolean, true);

    if activate_version then
      update public.fare_rule_versions
      set is_active = false
      where mode = coalesce(
        nullif(trim(updated_change_set #>> '{ruleVersion,mode}'), ''),
        'jeepney'
      );
    end if;

    insert into public.fare_rule_versions (
      mode,
      version_name,
      source_name,
      source_url,
      effectivity_date,
      verified_at,
      is_active,
      trust_level
    )
    values (
      coalesce(nullif(trim(updated_change_set #>> '{ruleVersion,mode}'), ''), 'jeepney'),
      coalesce(nullif(trim(updated_change_set #>> '{ruleVersion,versionName}'), ''), proposal.title),
      coalesce(nullif(trim(updated_change_set #>> '{ruleVersion,sourceName}'), ''), 'Community reviewed'),
      coalesce(nullif(trim(updated_change_set #>> '{ruleVersion,sourceUrl}'), ''), 'https://community.sakai.local'),
      coalesce((updated_change_set #>> '{ruleVersion,effectivityDate}')::date, current_date),
      coalesce((updated_change_set #>> '{ruleVersion,verifiedAt}')::timestamptz, timezone('utc', now())),
      activate_version,
      coalesce(nullif(trim(updated_change_set #>> '{ruleVersion,trustLevel}'), ''), 'estimated')
    )
    returning id into rule_version_id;

    if jsonb_typeof(updated_change_set->'fareProducts') = 'array' then
      for fare_product_payload in
        select value
        from jsonb_array_elements(updated_change_set->'fareProducts')
      loop
        insert into public.fare_products (
          fare_rule_version_id,
          product_code,
          mode,
          pricing_strategy,
          vehicle_class,
          minimum_distance_km,
          minimum_fare_regular,
          minimum_fare_discounted,
          succeeding_distance_km,
          succeeding_fare_regular,
          succeeding_fare_discounted,
          notes
        )
        values (
          rule_version_id,
          coalesce(nullif(trim(fare_product_payload->>'productCode'), ''), 'community_product'),
          coalesce(nullif(trim(fare_product_payload->>'mode'), ''), updated_change_set #>> '{ruleVersion,mode}'),
          coalesce(nullif(trim(fare_product_payload->>'pricingStrategy'), ''), 'minimum_plus_succeeding'),
          coalesce(nullif(trim(fare_product_payload->>'vehicleClass'), ''), 'standard'),
          coalesce((fare_product_payload->>'minimumDistanceKm')::numeric, 0),
          coalesce((fare_product_payload->>'minimumFareRegular')::numeric, 0),
          (fare_product_payload->>'minimumFareDiscounted')::numeric,
          coalesce((fare_product_payload->>'succeedingDistanceKm')::numeric, 1),
          coalesce((fare_product_payload->>'succeedingFareRegular')::numeric, 0),
          (fare_product_payload->>'succeedingFareDiscounted')::numeric,
          nullif(trim(fare_product_payload->>'notes'), '')
        );
      end loop;
    end if;

    if jsonb_typeof(updated_change_set->'trainStationFares') = 'array' then
      for train_fare_payload in
        select value
        from jsonb_array_elements(updated_change_set->'trainStationFares')
      loop
        insert into public.train_station_fares (
          fare_rule_version_id,
          origin_stop_id,
          destination_stop_id,
          regular_fare,
          discounted_fare
        )
        values (
          rule_version_id,
          nullif(train_fare_payload->>'originStopId', '')::uuid,
          nullif(train_fare_payload->>'destinationStopId', '')::uuid,
          coalesce((train_fare_payload->>'regularFare')::numeric, 0),
          coalesce((train_fare_payload->>'discountedFare')::numeric, 0)
        );
      end loop;
    end if;
  end if;

  inferred_route_id := coalesce(route_record.id, proposal.route_id, variant_record.route_id);
  inferred_route_variant_id := coalesce(variant_record.id, proposal.route_variant_id);

  note_text := coalesce(
    nullif(trim(p_note), ''),
    nullif(trim(proposal.payload->>'note'), ''),
    nullif(trim(proposal.evidence_note), ''),
    nullif(trim(proposal.summary), '')
  );

  update public.community_route_learning_proposals
  set reviewed_change_set = updated_change_set,
      review_status = 'published',
      review_notes = p_review_notes,
      reviewed_by_user_id = p_reviewer_user_id,
      reviewed_at = timezone('utc', now()),
      published_at = timezone('utc', now()),
      route_id = inferred_route_id,
      route_variant_id = inferred_route_variant_id
  where id = proposal.id
  returning * into proposal;

  insert into public.community_route_publications (
    proposal_id,
    reviewer_user_id,
    route_id,
    route_variant_id,
    publication_action,
    change_summary,
    published_snapshot
  )
  values (
    proposal.id,
    p_reviewer_user_id,
    proposal.route_id,
    proposal.route_variant_id,
    proposal.proposal_type,
    p_change_summary,
    jsonb_build_object(
      'proposalId', proposal.id,
      'proposalType', proposal.proposal_type,
      'routeId', proposal.route_id,
      'routeVariantId', proposal.route_variant_id,
      'reviewedChangeSet', proposal.reviewed_change_set
    )
  )
  on conflict (proposal_id)
  do update set
    change_summary = excluded.change_summary,
    published_snapshot = excluded.published_snapshot
  returning id into publication_id;

  if note_text is not null and (proposal.route_id is not null or proposal.route_variant_id is not null) then
    insert into public.community_route_notes (
      publication_id,
      route_id,
      route_variant_id,
      note,
      is_active
    )
    values (
      publication_id,
      proposal.route_id,
      proposal.route_variant_id,
      note_text,
      true
    )
    on conflict (publication_id)
    do update set
      route_id = excluded.route_id,
      route_variant_id = excluded.route_variant_id,
      note = excluded.note,
      is_active = true;
  end if;

  if proposal.source_submission_id is not null then
    update public.community_submissions
    set status = 'published',
        review_notes = p_review_notes
    where id = proposal.source_submission_id;
  end if;

  if proposal.source_answer_id is not null then
    update public.community_question_answers
    set promotion_status = 'published',
        linked_route_id = proposal.route_id,
        linked_route_variant_id = proposal.route_variant_id
    where id = proposal.source_answer_id;
  end if;

  return proposal;
end;
$$;

grant execute on function public.publish_community_route_proposal(uuid, uuid, text, text, text, jsonb)
  to service_role;

create unique index if not exists community_route_learning_proposals_source_submission_uidx
  on public.community_route_learning_proposals (source_submission_id)
  where source_submission_id is not null;

create unique index if not exists community_route_learning_proposals_source_answer_uidx
  on public.community_route_learning_proposals (source_answer_id)
  where source_answer_id is not null;

create or replace function public.create_community_submission_with_proposal(
  p_user_id uuid,
  p_submission_type text,
  p_title text,
  p_payload jsonb,
  p_source_context jsonb default null,
  p_route_id uuid default null,
  p_route_variant_id uuid default null
)
returns public.community_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  submission_record public.community_submissions%rowtype;
  proposal_type_value text;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'Authenticated user does not match submission user';
  end if;

  proposal_type_value := case
    when p_submission_type = 'missing_route' then 'route_create'
    when p_submission_type = 'route_correction' then 'route_update'
    else p_submission_type
  end;

  insert into public.community_submissions (
    user_id,
    submission_type,
    title,
    payload,
    source_context,
    route_id,
    route_variant_id
  )
  values (
    p_user_id,
    p_submission_type,
    p_title,
    coalesce(p_payload, '{}'::jsonb),
    p_source_context,
    p_route_id,
    p_route_variant_id
  )
  returning * into submission_record;

  insert into public.community_route_learning_proposals (
    source_kind,
    source_submission_id,
    created_by_user_id,
    proposal_type,
    title,
    summary,
    route_id,
    route_variant_id,
    proposed_lifecycle_status,
    payload,
    reviewed_change_set
  )
  values (
    'direct_submission',
    submission_record.id,
    p_user_id,
    proposal_type_value,
    p_title,
    coalesce(
      nullif(trim(coalesce(p_payload->>'note', '')), ''),
      nullif(trim(coalesce(p_source_context->>'routeQueryText', '')), '')
    ),
    p_route_id,
    p_route_variant_id,
    case
      when p_submission_type = 'route_deprecate' then 'deprecated'
      when p_submission_type = 'route_reactivate' then 'active'
      else null
    end,
    coalesce(p_payload, '{}'::jsonb),
    '{}'::jsonb
  );

  return submission_record;
end;
$$;

grant execute on function public.create_community_submission_with_proposal(
  uuid,
  text,
  text,
  jsonb,
  jsonb,
  uuid,
  uuid
) to authenticated;

create or replace function public.promote_community_answer_to_proposal(
  p_question_id uuid,
  p_answer_id uuid,
  p_reviewer_user_id uuid,
  p_proposal_type text,
  p_title text,
  p_summary text default null,
  p_route_id uuid default null,
  p_route_variant_id uuid default null,
  p_target_stop_ids uuid[] default '{}',
  p_target_transfer_point_ids uuid[] default '{}',
  p_proposed_lifecycle_status text default null,
  p_evidence_note text default null,
  p_payload jsonb default '{}'::jsonb,
  p_reviewed_change_set jsonb default '{}'::jsonb
)
returns public.community_route_learning_proposals
language plpgsql
security definer
set search_path = public
as $$
declare
  question_record public.community_questions%rowtype;
  answer_record public.community_question_answers%rowtype;
  proposal_record public.community_route_learning_proposals%rowtype;
begin
  select *
  into question_record
  from public.community_questions
  where id = p_question_id
  for update;

  if not found then
    raise exception 'Community question not found';
  end if;

  select *
  into answer_record
  from public.community_question_answers
  where id = p_answer_id
    and question_id = p_question_id
  for update;

  if not found then
    raise exception 'Community answer not found';
  end if;

  select *
  into proposal_record
  from public.community_route_learning_proposals
  where source_answer_id = p_answer_id
  for update;

  if found then
    update public.community_question_answers
    set promotion_status = case when proposal_record.review_status = 'published' then 'published' else 'promoted' end,
        linked_route_id = proposal_record.route_id,
        linked_route_variant_id = proposal_record.route_variant_id
    where id = answer_record.id;

    return proposal_record;
  end if;

  insert into public.community_route_learning_proposals (
    source_kind,
    source_question_id,
    source_answer_id,
    created_by_user_id,
    proposal_type,
    title,
    summary,
    route_id,
    route_variant_id,
    target_stop_ids,
    target_transfer_point_ids,
    proposed_lifecycle_status,
    evidence_note,
    payload,
    reviewed_change_set
  )
  values (
    'promoted_answer',
    p_question_id,
    p_answer_id,
    answer_record.user_id,
    p_proposal_type,
    p_title,
    p_summary,
    p_route_id,
    p_route_variant_id,
    coalesce(p_target_stop_ids, '{}'),
    coalesce(p_target_transfer_point_ids, '{}'),
    p_proposed_lifecycle_status,
    p_evidence_note,
    coalesce(p_payload, '{}'::jsonb),
    coalesce(p_reviewed_change_set, '{}'::jsonb)
  )
  returning * into proposal_record;

  update public.community_question_answers
  set promotion_status = 'promoted',
      linked_route_id = proposal_record.route_id,
      linked_route_variant_id = proposal_record.route_variant_id
  where id = answer_record.id;

  return proposal_record;
end;
$$;

grant execute on function public.promote_community_answer_to_proposal(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  uuid,
  uuid,
  uuid[],
  uuid[],
  text,
  text,
  jsonb,
  jsonb
) to service_role;

create or replace function public.reject_community_route_proposal(
  p_proposal_id uuid,
  p_reviewer_user_id uuid,
  p_review_notes text
)
returns public.community_route_learning_proposals
language plpgsql
security definer
set search_path = public
as $$
declare
  proposal_record public.community_route_learning_proposals%rowtype;
begin
  select *
  into proposal_record
  from public.community_route_learning_proposals
  where id = p_proposal_id
  for update;

  if not found then
    raise exception 'Community review proposal not found';
  end if;

  if proposal_record.review_status = 'published' then
    raise exception 'Proposal % cannot be rejected from published status', proposal_record.id;
  end if;

  if proposal_record.review_status = 'rejected' then
    return proposal_record;
  end if;

  update public.community_route_learning_proposals
  set review_status = 'rejected',
      review_notes = p_review_notes,
      reviewed_by_user_id = p_reviewer_user_id,
      reviewed_at = timezone('utc', now())
  where id = proposal_record.id
  returning * into proposal_record;

  if proposal_record.source_submission_id is not null then
    update public.community_submissions
    set status = 'rejected',
        review_notes = p_review_notes
    where id = proposal_record.source_submission_id;
  end if;

  if proposal_record.source_answer_id is not null then
    update public.community_question_answers
    set promotion_status = 'not_reviewed',
        linked_route_id = proposal_record.route_id,
        linked_route_variant_id = proposal_record.route_variant_id
    where id = proposal_record.source_answer_id;
  end if;

  return proposal_record;
end;
$$;

grant execute on function public.reject_community_route_proposal(uuid, uuid, text)
  to service_role;

create or replace function public.publish_community_route_proposal(
  p_proposal_id uuid,
  p_reviewer_user_id uuid,
  p_change_summary text,
  p_review_notes text default null,
  p_note text default null,
  p_reviewed_change_set jsonb default null
)
returns public.community_route_learning_proposals
language plpgsql
security definer
set search_path = public
as $$
declare
  proposal public.community_route_learning_proposals%rowtype;
  route_record public.routes%rowtype;
  variant_record public.route_variants%rowtype;
  stop_record public.stops%rowtype;
  updated_change_set jsonb := coalesce(p_reviewed_change_set, '{}'::jsonb);
  leg_payload jsonb;
  fare_product_payload jsonb;
  train_fare_payload jsonb;
  publication_id uuid;
  note_text text;
  target_stop_id uuid;
  target_transfer_point_id uuid;
  transfer_record public.transfer_points%rowtype;
  rule_version_id uuid;
  activate_version boolean;
  inferred_route_id uuid;
  inferred_route_variant_id uuid;
begin
  select *
  into proposal
  from public.community_route_learning_proposals
  where id = p_proposal_id
  for update;

  if not found then
    raise exception 'Community review proposal not found';
  end if;

  if proposal.review_status = 'rejected' then
    raise exception 'Proposal % cannot be published from rejected status', proposal.id;
  end if;

  if proposal.review_status = 'published' then
    return proposal;
  end if;

  if proposal.reviewed_change_set is not null and proposal.reviewed_change_set <> '{}'::jsonb then
    updated_change_set := proposal.reviewed_change_set || updated_change_set;
  end if;

  if proposal.route_variant_id is not null then
    select *
    into variant_record
    from public.route_variants
    where id = proposal.route_variant_id
    for update;
  end if;

  if proposal.route_id is not null then
    select *
    into route_record
    from public.routes
    where id = proposal.route_id
    for update;
  elsif variant_record.id is not null then
    select *
    into route_record
    from public.routes
    where id = variant_record.route_id
    for update;
  end if;

  if proposal.proposal_type = 'route_create' then
    if jsonb_typeof(updated_change_set->'route') <> 'object' then
      raise exception 'route_create requires reviewed_change_set.route';
    end if;

    if nullif(trim(updated_change_set #>> '{route,code}'), '') is null then
      raise exception 'route_create requires reviewed_change_set.route.code';
    end if;

    if jsonb_typeof(updated_change_set->'variant') <> 'object' then
      raise exception 'route_create requires reviewed_change_set.variant';
    end if;

    if nullif(trim(updated_change_set #>> '{variant,code}'), '') is null then
      raise exception 'route_create requires reviewed_change_set.variant.code';
    end if;

    if jsonb_typeof(updated_change_set->'legs') <> 'array'
      or jsonb_array_length(updated_change_set->'legs') = 0 then
      raise exception 'route_create requires reviewed_change_set.legs';
    end if;

    insert into public.routes (
      code,
      display_name,
      primary_mode,
      operator_name,
      source_name,
      source_url,
      trust_level,
      lifecycle_status,
      is_active
    )
    values (
      nullif(trim(updated_change_set #>> '{route,code}'), ''),
      coalesce(
        nullif(trim(updated_change_set #>> '{route,displayName}'), ''),
        nullif(trim(proposal.title), '')
      ),
      coalesce(
        nullif(trim(updated_change_set #>> '{route,primaryMode}'), ''),
        'jeepney'
      ),
      nullif(trim(updated_change_set #>> '{route,operatorName}'), ''),
      coalesce(nullif(trim(updated_change_set #>> '{route,sourceName}'), ''), 'Community reviewed'),
      nullif(trim(updated_change_set #>> '{route,sourceUrl}'), ''),
      'community_reviewed',
      'active',
      true
    )
    returning * into route_record;

    insert into public.route_variants (
      route_id,
      code,
      display_name,
      direction_label,
      origin_place_id,
      destination_place_id,
      lifecycle_status,
      is_active
    )
    values (
      route_record.id,
      nullif(trim(updated_change_set #>> '{variant,code}'), ''),
      coalesce(
        nullif(trim(updated_change_set #>> '{variant,displayName}'), ''),
        route_record.display_name
      ),
      coalesce(
        nullif(trim(updated_change_set #>> '{variant,directionLabel}'), ''),
        'Community reviewed'
      ),
      nullif(updated_change_set #>> '{variant,originPlaceId}', '')::uuid,
      nullif(updated_change_set #>> '{variant,destinationPlaceId}', '')::uuid,
      'active',
      true
    )
    returning * into variant_record;

    for leg_payload in
      select value
      from jsonb_array_elements(updated_change_set->'legs')
    loop
      insert into public.route_legs (
        route_variant_id,
        sequence,
        mode,
        from_stop_id,
        to_stop_id,
        route_label,
        distance_km,
        duration_minutes,
        fare_product_code,
        corridor_tag
      )
      values (
        variant_record.id,
        coalesce((leg_payload->>'sequence')::integer, 0),
        coalesce(nullif(trim(leg_payload->>'mode'), ''), route_record.primary_mode),
        nullif(leg_payload->>'fromStopId', '')::uuid,
        nullif(leg_payload->>'toStopId', '')::uuid,
        coalesce(nullif(trim(leg_payload->>'routeLabel'), ''), route_record.display_name),
        coalesce((leg_payload->>'distanceKm')::numeric, 0),
        coalesce((leg_payload->>'durationMinutes')::integer, 0),
        nullif(trim(leg_payload->>'fareProductCode'), ''),
        coalesce(nullif(trim(leg_payload->>'corridorTag'), ''), route_record.code)
      );
    end loop;
  elsif proposal.proposal_type = 'route_update' then
    if route_record.id is null then
      raise exception 'route_update requires proposal.route_id or proposal.route_variant_id';
    end if;

    if jsonb_typeof(updated_change_set->'variant') <> 'object' then
      raise exception 'route_update requires reviewed_change_set.variant';
    end if;

    if nullif(trim(updated_change_set #>> '{variant,code}'), '') is null then
      raise exception 'route_update requires reviewed_change_set.variant.code';
    end if;

    if jsonb_typeof(updated_change_set->'legs') <> 'array'
      or jsonb_array_length(updated_change_set->'legs') = 0 then
      raise exception 'route_update requires reviewed_change_set.legs';
    end if;

    insert into public.route_variants (
      route_id,
      code,
      display_name,
      direction_label,
      origin_place_id,
      destination_place_id,
      lifecycle_status,
      is_active
    )
    values (
      route_record.id,
      nullif(trim(updated_change_set #>> '{variant,code}'), ''),
      coalesce(
        nullif(trim(updated_change_set #>> '{variant,displayName}'), ''),
        coalesce(variant_record.display_name, route_record.display_name)
      ),
      coalesce(
        nullif(trim(updated_change_set #>> '{variant,directionLabel}'), ''),
        coalesce(variant_record.direction_label, 'Community reviewed')
      ),
      coalesce(
        nullif(updated_change_set #>> '{variant,originPlaceId}', '')::uuid,
        variant_record.origin_place_id
      ),
      coalesce(
        nullif(updated_change_set #>> '{variant,destinationPlaceId}', '')::uuid,
        variant_record.destination_place_id
      ),
      'active',
      true
    )
    returning * into variant_record;

    for leg_payload in
      select value
      from jsonb_array_elements(updated_change_set->'legs')
    loop
      insert into public.route_legs (
        route_variant_id,
        sequence,
        mode,
        from_stop_id,
        to_stop_id,
        route_label,
        distance_km,
        duration_minutes,
        fare_product_code,
        corridor_tag
      )
      values (
        variant_record.id,
        coalesce((leg_payload->>'sequence')::integer, 0),
        coalesce(nullif(trim(leg_payload->>'mode'), ''), route_record.primary_mode),
        nullif(leg_payload->>'fromStopId', '')::uuid,
        nullif(leg_payload->>'toStopId', '')::uuid,
        coalesce(nullif(trim(leg_payload->>'routeLabel'), ''), route_record.display_name),
        coalesce((leg_payload->>'distanceKm')::numeric, 0),
        coalesce((leg_payload->>'durationMinutes')::integer, 0),
        nullif(trim(leg_payload->>'fareProductCode'), ''),
        coalesce(nullif(trim(leg_payload->>'corridorTag'), ''), route_record.code)
      );
    end loop;

    if proposal.route_variant_id is not null then
      update public.route_variants
      set lifecycle_status = 'superseded',
          is_active = false,
          superseded_by_variant_id = variant_record.id
      where id = proposal.route_variant_id;
    end if;

    update public.routes
    set trust_level = 'community_reviewed',
        lifecycle_status = 'active',
        is_active = true,
        display_name = coalesce(
          nullif(trim(updated_change_set #>> '{route,displayName}'), ''),
          display_name
        ),
        operator_name = coalesce(
          nullif(trim(updated_change_set #>> '{route,operatorName}'), ''),
          operator_name
        ),
        source_name = coalesce(
          nullif(trim(updated_change_set #>> '{route,sourceName}'), ''),
          source_name
        ),
        source_url = coalesce(
          nullif(trim(updated_change_set #>> '{route,sourceUrl}'), ''),
          source_url
        )
      where id = route_record.id
      returning * into route_record;
  elsif proposal.proposal_type = 'route_deprecate' then
    if route_record.id is null then
      raise exception 'route_deprecate requires proposal.route_id or proposal.route_variant_id';
    end if;

    if proposal.route_variant_id is not null then
      update public.route_variants
      set lifecycle_status = 'deprecated',
          is_active = false
      where id = proposal.route_variant_id
      returning * into variant_record;
    end if;

    update public.routes
    set lifecycle_status = 'deprecated',
        is_active = false,
        trust_level = 'community_reviewed'
    where id = route_record.id
    returning * into route_record;
  elsif proposal.proposal_type = 'route_reactivate' then
    if route_record.id is null then
      raise exception 'route_reactivate requires proposal.route_id or proposal.route_variant_id';
    end if;

    if proposal.route_variant_id is not null then
      update public.route_variants
      set lifecycle_status = 'active',
          is_active = true,
          superseded_by_variant_id = null
      where id = proposal.route_variant_id
      returning * into variant_record;
    end if;

    update public.routes
    set lifecycle_status = 'active',
        is_active = true,
        trust_level = 'community_reviewed'
    where id = route_record.id
    returning * into route_record;
  elsif proposal.proposal_type = 'stop_correction' then
    target_stop_id := coalesce(
      nullif(updated_change_set->>'stopId', '')::uuid,
      proposal.target_stop_ids[1]
    );

    if target_stop_id is null then
      raise exception 'stop_correction requires reviewed_change_set.stopId or target_stop_ids';
    end if;

    update public.stops
    set stop_name = coalesce(nullif(trim(updated_change_set->>'stopName'), ''), stop_name),
        external_stop_code = coalesce(
          nullif(trim(updated_change_set->>'externalStopCode'), ''),
          external_stop_code
        ),
        area = coalesce(nullif(trim(updated_change_set->>'area'), ''), area),
        latitude = coalesce((updated_change_set->>'latitude')::double precision, latitude),
        longitude = coalesce((updated_change_set->>'longitude')::double precision, longitude),
        place_id = coalesce(nullif(updated_change_set->>'placeId', '')::uuid, place_id),
        is_active = coalesce((updated_change_set->>'isActive')::boolean, is_active)
    where id = target_stop_id
      and (
        coalesce(nullif(trim(updated_change_set->>'stopName'), ''), stop_name) is distinct from stop_name
        or coalesce(nullif(trim(updated_change_set->>'externalStopCode'), ''), external_stop_code)
          is distinct from external_stop_code
        or coalesce(nullif(trim(updated_change_set->>'area'), ''), area) is distinct from area
        or coalesce((updated_change_set->>'latitude')::double precision, latitude) is distinct from latitude
        or coalesce((updated_change_set->>'longitude')::double precision, longitude) is distinct from longitude
        or coalesce(nullif(updated_change_set->>'placeId', '')::uuid, place_id) is distinct from place_id
        or coalesce((updated_change_set->>'isActive')::boolean, is_active) is distinct from is_active
      )
    returning * into stop_record;

    if stop_record.id is null then
      if exists(select 1 from public.stops where id = target_stop_id) then
        raise exception 'stop_correction did not change the target stop';
      end if;

      raise exception 'stop_correction target stop not found';
    end if;
  elsif proposal.proposal_type = 'transfer_correction' then
    target_transfer_point_id := coalesce(
      nullif(updated_change_set->>'transferPointId', '')::uuid,
      proposal.target_transfer_point_ids[1]
    );

    if target_transfer_point_id is not null then
      update public.transfer_points
      set walking_distance_m = coalesce(
            (updated_change_set->>'walkingDistanceM')::integer,
            walking_distance_m
          ),
          walking_duration_minutes = coalesce(
            (updated_change_set->>'walkingDurationMinutes')::integer,
            walking_duration_minutes
          ),
          is_accessible = coalesce((updated_change_set->>'isAccessible')::boolean, is_accessible)
      where id = target_transfer_point_id
        and (
          coalesce((updated_change_set->>'walkingDistanceM')::integer, walking_distance_m)
            is distinct from walking_distance_m
          or coalesce((updated_change_set->>'walkingDurationMinutes')::integer, walking_duration_minutes)
            is distinct from walking_duration_minutes
          or coalesce((updated_change_set->>'isAccessible')::boolean, is_accessible)
            is distinct from is_accessible
        )
      returning * into transfer_record;

      if transfer_record.id is null then
        if exists(select 1 from public.transfer_points where id = target_transfer_point_id) then
          raise exception 'transfer_correction did not change the target transfer point';
        end if;

        raise exception 'transfer_correction target transfer point not found';
      end if;
    else
      if nullif(updated_change_set->>'fromStopId', '') is null
        or nullif(updated_change_set->>'toStopId', '') is null then
        raise exception 'transfer_correction requires reviewed_change_set.fromStopId and toStopId when creating a transfer';
      end if;

      insert into public.transfer_points (
        from_stop_id,
        to_stop_id,
        walking_distance_m,
        walking_duration_minutes,
        is_accessible
      )
      values (
        nullif(updated_change_set->>'fromStopId', '')::uuid,
        nullif(updated_change_set->>'toStopId', '')::uuid,
        coalesce((updated_change_set->>'walkingDistanceM')::integer, 0),
        coalesce((updated_change_set->>'walkingDurationMinutes')::integer, 0),
        coalesce((updated_change_set->>'isAccessible')::boolean, true)
      )
      on conflict (from_stop_id, to_stop_id)
      do update set
        walking_distance_m = excluded.walking_distance_m,
        walking_duration_minutes = excluded.walking_duration_minutes,
        is_accessible = excluded.is_accessible
      returning * into transfer_record;
    end if;
  elsif proposal.proposal_type = 'fare_update' then
    if jsonb_typeof(updated_change_set->'ruleVersion') <> 'object' then
      raise exception 'fare_update requires reviewed_change_set.ruleVersion';
    end if;

    activate_version := coalesce((updated_change_set->>'activateVersion')::boolean, true);

    if activate_version then
      update public.fare_rule_versions
      set is_active = false
      where mode = coalesce(
        nullif(trim(updated_change_set #>> '{ruleVersion,mode}'), ''),
        'jeepney'
      );
    end if;

    insert into public.fare_rule_versions (
      mode,
      version_name,
      source_name,
      source_url,
      effectivity_date,
      verified_at,
      is_active,
      trust_level
    )
    values (
      coalesce(nullif(trim(updated_change_set #>> '{ruleVersion,mode}'), ''), 'jeepney'),
      coalesce(nullif(trim(updated_change_set #>> '{ruleVersion,versionName}'), ''), proposal.title),
      coalesce(nullif(trim(updated_change_set #>> '{ruleVersion,sourceName}'), ''), 'Community reviewed'),
      coalesce(nullif(trim(updated_change_set #>> '{ruleVersion,sourceUrl}'), ''), 'https://community.sakai.local'),
      coalesce((updated_change_set #>> '{ruleVersion,effectivityDate}')::date, current_date),
      coalesce((updated_change_set #>> '{ruleVersion,verifiedAt}')::timestamptz, timezone('utc', now())),
      activate_version,
      coalesce(nullif(trim(updated_change_set #>> '{ruleVersion,trustLevel}'), ''), 'estimated')
    )
    returning id into rule_version_id;

    if jsonb_typeof(updated_change_set->'fareProducts') = 'array' then
      for fare_product_payload in
        select value
        from jsonb_array_elements(updated_change_set->'fareProducts')
      loop
        insert into public.fare_products (
          fare_rule_version_id,
          product_code,
          mode,
          pricing_strategy,
          vehicle_class,
          minimum_distance_km,
          minimum_fare_regular,
          minimum_fare_discounted,
          succeeding_distance_km,
          succeeding_fare_regular,
          succeeding_fare_discounted,
          notes
        )
        values (
          rule_version_id,
          coalesce(nullif(trim(fare_product_payload->>'productCode'), ''), 'community_product'),
          coalesce(nullif(trim(fare_product_payload->>'mode'), ''), updated_change_set #>> '{ruleVersion,mode}'),
          coalesce(nullif(trim(fare_product_payload->>'pricingStrategy'), ''), 'minimum_plus_succeeding'),
          coalesce(nullif(trim(fare_product_payload->>'vehicleClass'), ''), 'standard'),
          coalesce((fare_product_payload->>'minimumDistanceKm')::numeric, 0),
          coalesce((fare_product_payload->>'minimumFareRegular')::numeric, 0),
          (fare_product_payload->>'minimumFareDiscounted')::numeric,
          coalesce((fare_product_payload->>'succeedingDistanceKm')::numeric, 1),
          coalesce((fare_product_payload->>'succeedingFareRegular')::numeric, 0),
          (fare_product_payload->>'succeedingFareDiscounted')::numeric,
          nullif(trim(fare_product_payload->>'notes'), '')
        );
      end loop;
    end if;

    if jsonb_typeof(updated_change_set->'trainStationFares') = 'array' then
      for train_fare_payload in
        select value
        from jsonb_array_elements(updated_change_set->'trainStationFares')
      loop
        insert into public.train_station_fares (
          fare_rule_version_id,
          origin_stop_id,
          destination_stop_id,
          regular_fare,
          discounted_fare
        )
        values (
          rule_version_id,
          nullif(train_fare_payload->>'originStopId', '')::uuid,
          nullif(train_fare_payload->>'destinationStopId', '')::uuid,
          coalesce((train_fare_payload->>'regularFare')::numeric, 0),
          coalesce((train_fare_payload->>'discountedFare')::numeric, 0)
        );
      end loop;
    end if;
  end if;

  inferred_route_id := coalesce(route_record.id, proposal.route_id, variant_record.route_id);
  inferred_route_variant_id := coalesce(variant_record.id, proposal.route_variant_id);

  note_text := coalesce(
    nullif(trim(p_note), ''),
    nullif(trim(proposal.payload->>'note'), ''),
    nullif(trim(proposal.evidence_note), ''),
    nullif(trim(proposal.summary), '')
  );

  update public.community_route_learning_proposals
  set reviewed_change_set = updated_change_set,
      review_status = 'published',
      review_notes = p_review_notes,
      reviewed_by_user_id = p_reviewer_user_id,
      reviewed_at = timezone('utc', now()),
      published_at = timezone('utc', now()),
      route_id = inferred_route_id,
      route_variant_id = inferred_route_variant_id
  where id = proposal.id
  returning * into proposal;

  insert into public.community_route_publications (
    proposal_id,
    reviewer_user_id,
    route_id,
    route_variant_id,
    publication_action,
    change_summary,
    published_snapshot
  )
  values (
    proposal.id,
    p_reviewer_user_id,
    proposal.route_id,
    proposal.route_variant_id,
    proposal.proposal_type,
    p_change_summary,
    jsonb_build_object(
      'proposalId', proposal.id,
      'proposalType', proposal.proposal_type,
      'routeId', proposal.route_id,
      'routeVariantId', proposal.route_variant_id,
      'reviewedChangeSet', proposal.reviewed_change_set
    )
  )
  on conflict (proposal_id)
  do update set
    change_summary = excluded.change_summary,
    published_snapshot = excluded.published_snapshot
  returning id into publication_id;

  if note_text is not null and (proposal.route_id is not null or proposal.route_variant_id is not null) then
    insert into public.community_route_notes (
      publication_id,
      route_id,
      route_variant_id,
      note,
      is_active
    )
    values (
      publication_id,
      proposal.route_id,
      proposal.route_variant_id,
      note_text,
      true
    )
    on conflict (publication_id)
    do update set
      route_id = excluded.route_id,
      route_variant_id = excluded.route_variant_id,
      note = excluded.note,
      is_active = true;
  end if;

  if proposal.source_submission_id is not null then
    update public.community_submissions
    set status = 'published',
        review_notes = p_review_notes
    where id = proposal.source_submission_id;
  end if;

  if proposal.source_answer_id is not null then
    update public.community_question_answers
    set promotion_status = 'published',
        linked_route_id = proposal.route_id,
        linked_route_variant_id = proposal.route_variant_id
    where id = proposal.source_answer_id;
  end if;

  return proposal;
end;
$$;

grant execute on function public.publish_community_route_proposal(uuid, uuid, text, text, text, jsonb)
  to service_role;
