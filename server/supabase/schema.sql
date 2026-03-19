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
  raw_text text not null,
  scraped_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists area_updates_external_id_uidx
  on public.area_updates (external_id);

create index if not exists area_updates_scraped_at_idx
  on public.area_updates (scraped_at desc);

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

create table if not exists public.stops (
  id uuid primary key default gen_random_uuid(),
  place_id uuid references public.places(id) on delete set null,
  stop_name text not null,
  mode text not null
    check (mode in ('jeepney', 'uv', 'mrt3', 'lrt1', 'lrt2', 'walk_anchor')),
  area text not null,
  latitude double precision not null,
  longitude double precision not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists stops_place_id_idx
  on public.stops (place_id);

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

create index if not exists routes_code_idx
  on public.routes (code);

create table if not exists public.route_variants (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete cascade,
  display_name text not null,
  direction_label text not null,
  origin_place_id uuid references public.places(id) on delete set null,
  destination_place_id uuid references public.places(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists route_variants_route_id_idx
  on public.route_variants (route_id);

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
