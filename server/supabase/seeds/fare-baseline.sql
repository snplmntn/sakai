-- Sakai fare baseline seed for feature 03.
-- Safe to re-run against the same development database.
-- Train fare rows depend on matching train stops already existing in public.stops.

do $$
begin
  if not exists (
    select 1
    from public.stops
    where mode = 'lrt2'
      and stop_name in ('Araneta Center-Cubao', 'LRT-2 Araneta Center-Cubao')
  ) or not exists (
    select 1
    from public.stops
    where mode = 'lrt2'
      and stop_name in ('V. Mapa', 'LRT-2 V. Mapa')
  ) then
    raise notice 'Skipping seeded LRT-2 train fares until the matching LRT-2 stop rows exist in public.stops. Re-run supabase/seeds/fare-baseline.sql after route-network stop seed data is loaded.';
  end if;
end;
$$;

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
    '44444444-4444-4444-4444-444444444444',
    'lrt2',
    'Sakai LRT-2 Demo Fallback 2026',
    'Sakai demo seed',
    'https://example.com/sakai/demo-fares',
    '2026-01-01',
    '2026-03-19T00:00:00Z',
    true,
    'demo_fallback'
  )
on conflict (mode, version_name) do update
set
  source_name = excluded.source_name,
  source_url = excluded.source_url,
  effectivity_date = excluded.effectivity_date,
  verified_at = excluded.verified_at,
  is_active = excluded.is_active,
  trust_level = excluded.trust_level;

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
    10.40,
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

with cubao_station as (
  select id
  from public.stops
  where mode = 'lrt2'
    and stop_name in ('Araneta Center-Cubao', 'LRT-2 Araneta Center-Cubao')
  order by stop_name
  limit 1
),
vmapa_station as (
  select id
  from public.stops
  where mode = 'lrt2'
    and stop_name in ('V. Mapa', 'LRT-2 V. Mapa')
  order by stop_name
  limit 1
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
  seeded.id,
  '44444444-4444-4444-4444-444444444444',
  seeded.origin_stop_id,
  seeded.destination_stop_id,
  seeded.regular_fare,
  seeded.discounted_fare
from (
  select
    '61111111-1111-1111-1111-111111111111'::uuid as id,
    cubao_station.id as origin_stop_id,
    vmapa_station.id as destination_stop_id,
    20.00::numeric(8, 2) as regular_fare,
    16.00::numeric(8, 2) as discounted_fare
  from cubao_station, vmapa_station

  union all

  select
    '62222222-2222-2222-2222-222222222222'::uuid as id,
    vmapa_station.id as origin_stop_id,
    cubao_station.id as destination_stop_id,
    20.00::numeric(8, 2) as regular_fare,
    16.00::numeric(8, 2) as discounted_fare
  from cubao_station, vmapa_station
) seeded
on conflict (fare_rule_version_id, origin_stop_id, destination_stop_id) do update
set
  regular_fare = excluded.regular_fare,
  discounted_fare = excluded.discounted_fare;
