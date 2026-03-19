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
