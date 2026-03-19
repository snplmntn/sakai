create extension if not exists pgcrypto;

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists courses_created_at_idx
  on public.courses (created_at desc);

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
