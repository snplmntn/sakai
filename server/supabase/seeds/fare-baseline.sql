-- Sakai fare baseline seed for feature 03.
-- Safe to re-run against the same development database.
-- This seed keeps route pricing deterministic by storing local train stations and train fares.

with rail_station_manifest (
  mode,
  station_index,
  external_stop_code,
  canonical_name,
  city,
  area,
  latitude,
  longitude
) as (
  values
    ('lrt1', 1, 'LRT1-01', 'Dr. Santos', 'Paranaque', 'Paranaque', 14.48490, 120.99310),
    ('lrt1', 2, 'LRT1-02', 'Ninoy Aquino Avenue', 'Paranaque', 'Paranaque', 14.49178, 120.99273),
    ('lrt1', 3, 'LRT1-03', 'Asia World', 'Paranaque', 'Paranaque', 14.49867, 120.99236),
    ('lrt1', 4, 'LRT1-04', 'MIA Road', 'Paranaque', 'Paranaque', 14.50555, 120.99199),
    ('lrt1', 5, 'LRT1-05', 'PITX', 'Paranaque', 'Paranaque', 14.51244, 120.99163),
    ('lrt1', 6, 'LRT1-06', 'Redemptorist-Aseana', 'Paranaque', 'Paranaque', 14.51932, 120.99126),
    ('lrt1', 7, 'LRT1-07', 'Baclaran', 'Pasay', 'Pasay', 14.52620, 120.99089),
    ('lrt1', 8, 'LRT1-08', 'EDSA', 'Pasay', 'Pasay', 14.53309, 120.99052),
    ('lrt1', 9, 'LRT1-09', 'Libertad', 'Pasay', 'Pasay', 14.53997, 120.99015),
    ('lrt1', 10, 'LRT1-10', 'Gil Puyat', 'Pasay', 'Pasay', 14.54686, 120.98978),
    ('lrt1', 11, 'LRT1-11', 'Vito Cruz', 'Pasay', 'Pasay', 14.55374, 120.98942),
    ('lrt1', 12, 'LRT1-12', 'Quirino', 'Manila', 'Manila', 14.56062, 120.98905),
    ('lrt1', 13, 'LRT1-13', 'Pedro Gil', 'Manila', 'Manila', 14.56751, 120.98868),
    ('lrt1', 14, 'LRT1-14', 'United Nations', 'Manila', 'Manila', 14.57439, 120.98831),
    ('lrt1', 15, 'LRT1-15', 'Central Terminal', 'Manila', 'Manila', 14.58128, 120.98794),
    ('lrt1', 16, 'LRT1-16', 'Carriedo', 'Manila', 'Manila', 14.58816, 120.98758),
    ('lrt1', 17, 'LRT1-17', 'Doroteo Jose', 'Manila', 'Manila', 14.59504, 120.98721),
    ('lrt1', 18, 'LRT1-18', 'Bambang', 'Manila', 'Manila', 14.60193, 120.98684),
    ('lrt1', 19, 'LRT1-19', 'Tayuman', 'Manila', 'Manila', 14.60881, 120.98647),
    ('lrt1', 20, 'LRT1-20', 'Blumentritt', 'Manila', 'Manila', 14.61570, 120.98610),
    ('lrt1', 21, 'LRT1-21', 'Abad Santos', 'Manila', 'Manila', 14.62258, 120.98574),
    ('lrt1', 22, 'LRT1-22', 'R. Papa', 'Manila', 'Manila', 14.62946, 120.98537),
    ('lrt1', 23, 'LRT1-23', '5th Avenue', 'Caloocan', 'Caloocan', 14.63635, 120.98500),
    ('lrt1', 24, 'LRT1-24', 'Monumento', 'Caloocan', 'Caloocan', 14.64323, 120.98463),
    ('lrt1', 25, 'LRT1-25', 'Balintawak', 'Quezon City', 'Quezon City', 14.65012, 120.98426),
    ('lrt1', 26, 'LRT1-26', 'Fernando Poe Jr.', 'Quezon City', 'Quezon City', 14.65700, 120.98390),
    ('lrt2', 1, 'LRT2-01', 'Recto', 'Manila', 'Manila', 14.60380, 120.98600),
    ('lrt2', 2, 'LRT2-02', 'Legarda', 'Manila', 'Manila', 14.60594, 120.99725),
    ('lrt2', 3, 'LRT2-03', 'Pureza', 'Manila', 'Manila', 14.60808, 121.00850),
    ('lrt2', 4, 'LRT2-04', 'V. Mapa', 'Manila', 'Manila', 14.61022, 121.01975),
    ('lrt2', 5, 'LRT2-05', 'J. Ruiz', 'San Juan', 'San Juan', 14.61237, 121.03100),
    ('lrt2', 6, 'LRT2-06', 'Gilmore', 'Quezon City', 'Quezon City', 14.61451, 121.04225),
    ('lrt2', 7, 'LRT2-07', 'Betty Go-Belmonte', 'Quezon City', 'Quezon City', 14.61665, 121.05350),
    ('lrt2', 8, 'LRT2-08', 'Araneta Center-Cubao', 'Quezon City', 'Quezon City', 14.61879, 121.06475),
    ('lrt2', 9, 'LRT2-09', 'Anonas', 'Quezon City', 'Quezon City', 14.62093, 121.07600),
    ('lrt2', 10, 'LRT2-10', 'Katipunan', 'Quezon City', 'Quezon City', 14.62307, 121.08725),
    ('lrt2', 11, 'LRT2-11', 'Santolan', 'Marikina', 'Marikina', 14.62522, 121.09850),
    ('lrt2', 12, 'LRT2-12', 'Marikina-Pasig', 'Marikina', 'Marikina', 14.62736, 121.10975),
    ('lrt2', 13, 'LRT2-13', 'Antipolo', 'Antipolo', 'Antipolo', 14.62950, 121.12100)
)
insert into public.places (
  canonical_name,
  city,
  kind,
  latitude,
  longitude,
  google_place_id
)
select
  rail_station_manifest.canonical_name,
  rail_station_manifest.city,
  'station',
  rail_station_manifest.latitude,
  rail_station_manifest.longitude,
  null
from rail_station_manifest
left join public.places existing_places
  on existing_places.canonical_name = rail_station_manifest.canonical_name
 and existing_places.city = rail_station_manifest.city
where existing_places.id is null;

with rail_station_manifest (
  mode,
  station_index,
  external_stop_code,
  canonical_name,
  city,
  area,
  latitude,
  longitude
) as (
  values
    ('lrt1', 1, 'LRT1-01', 'Dr. Santos', 'Paranaque', 'Paranaque', 14.48490, 120.99310),
    ('lrt1', 2, 'LRT1-02', 'Ninoy Aquino Avenue', 'Paranaque', 'Paranaque', 14.49178, 120.99273),
    ('lrt1', 3, 'LRT1-03', 'Asia World', 'Paranaque', 'Paranaque', 14.49867, 120.99236),
    ('lrt1', 4, 'LRT1-04', 'MIA Road', 'Paranaque', 'Paranaque', 14.50555, 120.99199),
    ('lrt1', 5, 'LRT1-05', 'PITX', 'Paranaque', 'Paranaque', 14.51244, 120.99163),
    ('lrt1', 6, 'LRT1-06', 'Redemptorist-Aseana', 'Paranaque', 'Paranaque', 14.51932, 120.99126),
    ('lrt1', 7, 'LRT1-07', 'Baclaran', 'Pasay', 'Pasay', 14.52620, 120.99089),
    ('lrt1', 8, 'LRT1-08', 'EDSA', 'Pasay', 'Pasay', 14.53309, 120.99052),
    ('lrt1', 9, 'LRT1-09', 'Libertad', 'Pasay', 'Pasay', 14.53997, 120.99015),
    ('lrt1', 10, 'LRT1-10', 'Gil Puyat', 'Pasay', 'Pasay', 14.54686, 120.98978),
    ('lrt1', 11, 'LRT1-11', 'Vito Cruz', 'Pasay', 'Pasay', 14.55374, 120.98942),
    ('lrt1', 12, 'LRT1-12', 'Quirino', 'Manila', 'Manila', 14.56062, 120.98905),
    ('lrt1', 13, 'LRT1-13', 'Pedro Gil', 'Manila', 'Manila', 14.56751, 120.98868),
    ('lrt1', 14, 'LRT1-14', 'United Nations', 'Manila', 'Manila', 14.57439, 120.98831),
    ('lrt1', 15, 'LRT1-15', 'Central Terminal', 'Manila', 'Manila', 14.58128, 120.98794),
    ('lrt1', 16, 'LRT1-16', 'Carriedo', 'Manila', 'Manila', 14.58816, 120.98758),
    ('lrt1', 17, 'LRT1-17', 'Doroteo Jose', 'Manila', 'Manila', 14.59504, 120.98721),
    ('lrt1', 18, 'LRT1-18', 'Bambang', 'Manila', 'Manila', 14.60193, 120.98684),
    ('lrt1', 19, 'LRT1-19', 'Tayuman', 'Manila', 'Manila', 14.60881, 120.98647),
    ('lrt1', 20, 'LRT1-20', 'Blumentritt', 'Manila', 'Manila', 14.61570, 120.98610),
    ('lrt1', 21, 'LRT1-21', 'Abad Santos', 'Manila', 'Manila', 14.62258, 120.98574),
    ('lrt1', 22, 'LRT1-22', 'R. Papa', 'Manila', 'Manila', 14.62946, 120.98537),
    ('lrt1', 23, 'LRT1-23', '5th Avenue', 'Caloocan', 'Caloocan', 14.63635, 120.98500),
    ('lrt1', 24, 'LRT1-24', 'Monumento', 'Caloocan', 'Caloocan', 14.64323, 120.98463),
    ('lrt1', 25, 'LRT1-25', 'Balintawak', 'Quezon City', 'Quezon City', 14.65012, 120.98426),
    ('lrt1', 26, 'LRT1-26', 'Fernando Poe Jr.', 'Quezon City', 'Quezon City', 14.65700, 120.98390),
    ('lrt2', 1, 'LRT2-01', 'Recto', 'Manila', 'Manila', 14.60380, 120.98600),
    ('lrt2', 2, 'LRT2-02', 'Legarda', 'Manila', 'Manila', 14.60594, 120.99725),
    ('lrt2', 3, 'LRT2-03', 'Pureza', 'Manila', 'Manila', 14.60808, 121.00850),
    ('lrt2', 4, 'LRT2-04', 'V. Mapa', 'Manila', 'Manila', 14.61022, 121.01975),
    ('lrt2', 5, 'LRT2-05', 'J. Ruiz', 'San Juan', 'San Juan', 14.61237, 121.03100),
    ('lrt2', 6, 'LRT2-06', 'Gilmore', 'Quezon City', 'Quezon City', 14.61451, 121.04225),
    ('lrt2', 7, 'LRT2-07', 'Betty Go-Belmonte', 'Quezon City', 'Quezon City', 14.61665, 121.05350),
    ('lrt2', 8, 'LRT2-08', 'Araneta Center-Cubao', 'Quezon City', 'Quezon City', 14.61879, 121.06475),
    ('lrt2', 9, 'LRT2-09', 'Anonas', 'Quezon City', 'Quezon City', 14.62093, 121.07600),
    ('lrt2', 10, 'LRT2-10', 'Katipunan', 'Quezon City', 'Quezon City', 14.62307, 121.08725),
    ('lrt2', 11, 'LRT2-11', 'Santolan', 'Marikina', 'Marikina', 14.62522, 121.09850),
    ('lrt2', 12, 'LRT2-12', 'Marikina-Pasig', 'Marikina', 'Marikina', 14.62736, 121.10975),
    ('lrt2', 13, 'LRT2-13', 'Antipolo', 'Antipolo', 'Antipolo', 14.62950, 121.12100)
)
insert into public.stops (
  place_id,
  external_stop_code,
  stop_name,
  mode,
  area,
  latitude,
  longitude,
  is_active
)
select
  places.id,
  rail_station_manifest.external_stop_code,
  rail_station_manifest.canonical_name,
  rail_station_manifest.mode,
  rail_station_manifest.area,
  rail_station_manifest.latitude,
  rail_station_manifest.longitude,
  true
from rail_station_manifest
join public.places places
  on places.canonical_name = rail_station_manifest.canonical_name
 and places.city = rail_station_manifest.city
on conflict (external_stop_code) do update
set
  place_id = excluded.place_id,
  stop_name = excluded.stop_name,
  mode = excluded.mode,
  area = excluded.area,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  is_active = excluded.is_active;

insert into public.place_aliases (place_id, alias, normalized_alias)
select
  places.id,
  alias_manifest.alias,
  alias_manifest.normalized_alias
from (
  values
    ('Dr. Santos', 'Dr Santos', 'dr santos'),
    ('Dr. Santos', 'Sucat', 'sucat'),
    ('Ninoy Aquino Avenue', 'NAIA Avenue', 'naia avenue'),
    ('Ninoy Aquino Avenue', 'Ninoy Aquino Ave', 'ninoy aquino ave'),
    ('Asia World', 'Asiaworld', 'asiaworld'),
    ('PITX', 'Paranaque Integrated Terminal Exchange', 'paranaque integrated terminal exchange'),
    ('Redemptorist-Aseana', 'Redemptorist', 'redemptorist'),
    ('Redemptorist-Aseana', 'Aseana', 'aseana'),
    ('EDSA', 'EDSA-Taft', 'edsa taft'),
    ('Libertad', 'Arnaiz', 'arnaiz'),
    ('Gil Puyat', 'Buendia', 'buendia'),
    ('Vito Cruz', 'P. Ocampo', 'p ocampo'),
    ('United Nations', 'United Nations Avenue', 'united nations avenue'),
    ('United Nations', 'UN Avenue', 'un avenue'),
    ('Fernando Poe Jr.', 'FPJ', 'fpj'),
    ('Fernando Poe Jr.', 'Roosevelt', 'roosevelt'),
    ('Recto', 'D. Jose', 'd jose'),
    ('Recto', 'Doroteo Jose', 'doroteo jose'),
    ('V. Mapa', 'V Mapa', 'v mapa'),
    ('J. Ruiz', 'J Ruiz', 'j ruiz'),
    ('Betty Go-Belmonte', 'Betty Go', 'betty go'),
    ('Araneta Center-Cubao', 'Cubao', 'cubao'),
    ('Araneta Center-Cubao', 'Araneta Cubao', 'araneta cubao'),
    ('Marikina-Pasig', 'Marikina', 'marikina'),
    ('Antipolo', 'Masinag', 'masinag')
) as alias_manifest(canonical_name, alias, normalized_alias)
join public.places places
  on places.canonical_name = alias_manifest.canonical_name
on conflict (place_id, normalized_alias) do nothing;

update public.fare_rule_versions
set is_active = false
where mode in ('lrt1', 'lrt2')
  and id not in (
    '44444444-4444-4444-4444-444444444441',
    '44444444-4444-4444-4444-444444444442'
  );

insert into public.fare_rule_versions (
  id,
  mode,
  version_name,
  source_name,
  source_url,
  effectivity_date,
  verified_at,
  is_active,
  trust_level
)
values
  (
    '11111111-1111-1111-1111-111111111111',
    'jeepney',
    'LTFRB PUJ Baseline 2026',
    'LTFRB fare guide',
    'https://ltfrb.gov.ph/',
    '2026-01-01',
    '2026-03-19T00:00:00Z',
    true,
    'official'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'uv',
    'LTFRB UV Baseline 2026',
    'LTFRB fare guide',
    'https://ltfrb.gov.ph/',
    '2026-01-01',
    '2026-03-19T00:00:00Z',
    true,
    'official'
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'car',
    'Sakai Car Estimate Baseline 2026',
    'Sakai demo seed',
    'https://example.com/sakai/demo-fares',
    '2026-01-01',
    '2026-03-19T00:00:00Z',
    true,
    'estimated'
  ),
  (
    '44444444-4444-4444-4444-444444444441',
    'lrt1',
    'Sakai LRT-1 Estimated Station-Step Baseline 2026',
    'Sakai estimated station-count baseline',
    'https://lrmc.ph/',
    '2026-03-20',
    '2026-03-20T00:00:00Z',
    true,
    'estimated'
  ),
  (
    '44444444-4444-4444-4444-444444444442',
    'lrt2',
    'Sakai LRT-2 Estimated Segment Demo Baseline 2026',
    'Sakai estimated demo-segment baseline',
    'https://www.lrta.gov.ph/',
    '2026-03-20',
    '2026-03-20T00:00:00Z',
    true,
    'estimated'
  )
on conflict (mode, version_name) do update
set
  source_name = excluded.source_name,
  source_url = excluded.source_url,
  effectivity_date = excluded.effectivity_date,
  verified_at = excluded.verified_at,
  is_active = excluded.is_active,
  trust_level = excluded.trust_level;

update public.fare_rule_versions
set is_active = false
where mode in ('lrt1', 'lrt2')
  and id not in (
    '44444444-4444-4444-4444-444444444441',
    '44444444-4444-4444-4444-444444444442'
  );

insert into public.fare_products (
  id,
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
values
  (
    '51111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'puj_traditional',
    'jeepney',
    'minimum_plus_succeeding',
    'traditional',
    4.00,
    13.00,
    13.00,
    1.00,
    1.80,
    1.44,
    null
  ),
  (
    '52222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    'puj_modern_non_aircon',
    'jeepney',
    'minimum_plus_succeeding',
    'modern_non_aircon',
    4.00,
    15.00,
    12.00,
    1.00,
    1.80,
    1.44,
    'Assumes the same 4 km minimum-distance window as the seeded traditional PUJ baseline.'
  ),
  (
    '53333333-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111',
    'puj_modern_aircon',
    'jeepney',
    'minimum_plus_succeeding',
    'modern_aircon',
    4.00,
    15.00,
    12.00,
    1.00,
    2.20,
    1.76,
    'Assumes the same 4 km minimum-distance window as the seeded traditional PUJ baseline.'
  ),
  (
    '54444444-4444-4444-4444-444444444444',
    '22222222-2222-2222-2222-222222222222',
    'uv_traditional',
    'uv',
    'per_km',
    'traditional',
    0.00,
    0.00,
    0.00,
    1.00,
    2.40,
    1.92,
    null
  ),
  (
    '55555555-5555-5555-5555-555555555555',
    '22222222-2222-2222-2222-222222222222',
    'uv_modern',
    'uv',
    'per_km',
    'modern',
    0.00,
    0.00,
    0.00,
    1.00,
    2.50,
    2.00,
    null
  ),
  (
    '56666666-6666-6666-6666-666666666666',
    '33333333-3333-3333-3333-333333333333',
    'car_estimated',
    'car',
    'per_km',
    'sedan',
    0.00,
    0.00,
    null,
    1.00,
    12.00,
    null,
    'Simple per-kilometer fallback estimate for optional car segments.'
  )
on conflict (fare_rule_version_id, product_code) do update
set
  mode = excluded.mode,
  pricing_strategy = excluded.pricing_strategy,
  vehicle_class = excluded.vehicle_class,
  minimum_distance_km = excluded.minimum_distance_km,
  minimum_fare_regular = excluded.minimum_fare_regular,
  minimum_fare_discounted = excluded.minimum_fare_discounted,
  succeeding_distance_km = excluded.succeeding_distance_km,
  succeeding_fare_regular = excluded.succeeding_fare_regular,
  succeeding_fare_discounted = excluded.succeeding_fare_discounted,
  notes = excluded.notes;

delete from public.train_station_fares
where fare_rule_version_id in (
  '44444444-4444-4444-4444-444444444441',
  '44444444-4444-4444-4444-444444444442'
);

with lrt1_station_manifest (station_index, external_stop_code) as (
  values
    (1, 'LRT1-01'),
    (2, 'LRT1-02'),
    (3, 'LRT1-03'),
    (4, 'LRT1-04'),
    (5, 'LRT1-05'),
    (6, 'LRT1-06'),
    (7, 'LRT1-07'),
    (8, 'LRT1-08'),
    (9, 'LRT1-09'),
    (10, 'LRT1-10'),
    (11, 'LRT1-11'),
    (12, 'LRT1-12'),
    (13, 'LRT1-13'),
    (14, 'LRT1-14'),
    (15, 'LRT1-15'),
    (16, 'LRT1-16'),
    (17, 'LRT1-17'),
    (18, 'LRT1-18'),
    (19, 'LRT1-19'),
    (20, 'LRT1-20'),
    (21, 'LRT1-21'),
    (22, 'LRT1-22'),
    (23, 'LRT1-23'),
    (24, 'LRT1-24'),
    (25, 'LRT1-25'),
    (26, 'LRT1-26')
),
lrt1_resolved_stops as (
  select
    lrt1_station_manifest.station_index,
    stops.id as stop_id
  from lrt1_station_manifest
  join public.stops stops
    on stops.external_stop_code = lrt1_station_manifest.external_stop_code
)
insert into public.train_station_fares (
  id,
  fare_rule_version_id,
  origin_stop_id,
  destination_stop_id,
  regular_fare,
  discounted_fare
)
select
  gen_random_uuid(),
  '44444444-4444-4444-4444-444444444441',
  origin_stops.stop_id,
  destination_stops.stop_id,
  round((20 + abs(destination_stops.station_index - origin_stops.station_index) - 1)::numeric, 2),
  round(((20 + abs(destination_stops.station_index - origin_stops.station_index) - 1) * 0.5)::numeric, 2)
from lrt1_resolved_stops origin_stops
cross join lrt1_resolved_stops destination_stops
where origin_stops.station_index <> destination_stops.station_index
on conflict (fare_rule_version_id, origin_stop_id, destination_stop_id) do update
set
  regular_fare = excluded.regular_fare,
  discounted_fare = excluded.discounted_fare;

with lrt2_slice_manifest (station_index, external_stop_code) as (
  values
    (1, 'LRT2-01'),
    (2, 'LRT2-02'),
    (3, 'LRT2-03')
),
lrt2_segment_fares (station_index, segment_fare) as (
  values
    (1, 13.00::numeric(8, 2)),
    (2, 15.00::numeric(8, 2))
),
lrt2_resolved_stops as (
  select
    lrt2_slice_manifest.station_index,
    stops.id as stop_id
  from lrt2_slice_manifest
  join public.stops stops
    on stops.external_stop_code = lrt2_slice_manifest.external_stop_code
),
lrt2_fare_rows as (
  select
    origin_stops.stop_id as origin_stop_id,
    destination_stops.stop_id as destination_stop_id,
    (
      select coalesce(sum(lrt2_segment_fares.segment_fare), 0)::numeric(8, 2)
      from lrt2_segment_fares
      where lrt2_segment_fares.station_index >= least(origin_stops.station_index, destination_stops.station_index)
        and lrt2_segment_fares.station_index < greatest(origin_stops.station_index, destination_stops.station_index)
    ) as regular_fare
  from lrt2_resolved_stops origin_stops
  cross join lrt2_resolved_stops destination_stops
  where origin_stops.station_index <> destination_stops.station_index
)
insert into public.train_station_fares (
  id,
  fare_rule_version_id,
  origin_stop_id,
  destination_stop_id,
  regular_fare,
  discounted_fare
)
select
  gen_random_uuid(),
  '44444444-4444-4444-4444-444444444442',
  lrt2_fare_rows.origin_stop_id,
  lrt2_fare_rows.destination_stop_id,
  lrt2_fare_rows.regular_fare,
  round((lrt2_fare_rows.regular_fare * 0.5)::numeric, 2)
from lrt2_fare_rows
on conflict (fare_rule_version_id, origin_stop_id, destination_stop_id) do update
set
  regular_fare = excluded.regular_fare,
  discounted_fare = excluded.discounted_fare;
