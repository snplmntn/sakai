create table if not exists public.stops (
  stop_id text primary key,
  stop_name text not null,
  normalized_name text not null,
  lat double precision,
  lon double precision,
  mode text,
  line text,
  all_modes text,
  all_lines text,
  is_multimodal boolean not null default false,
  line_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.stop_edges (
  source_stop_id text not null references public.stops(stop_id) on delete cascade,
  target_stop_id text not null references public.stops(stop_id) on delete cascade,
  weight numeric not null,
  mode text not null,
  line text not null,
  route_short_name text,
  route_long_name text,
  transfer boolean not null default false,
  distance_meters numeric,
  estimated_time_min numeric,
  data_source text,
  created_at timestamptz not null default now(),
  primary key (source_stop_id, target_stop_id, mode, line)
);

create index if not exists idx_stops_normalized_name on public.stops (normalized_name);
create index if not exists idx_stops_mode on public.stops (mode);
create index if not exists idx_stop_edges_source on public.stop_edges (source_stop_id);
create index if not exists idx_stop_edges_target on public.stop_edges (target_stop_id);
create index if not exists idx_stop_edges_mode on public.stop_edges (mode);
create index if not exists idx_stop_edges_line on public.stop_edges (line);
create index if not exists idx_stop_edges_transfer on public.stop_edges (transfer);
