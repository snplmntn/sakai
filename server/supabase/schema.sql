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
