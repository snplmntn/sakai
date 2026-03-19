create extension if not exists pgcrypto;

insert into public.route_stop_import_rows (
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
  source_url
)
values
  ('legacy-alabang-pasay-2026-03-19', 'JEEP-ALABANG-PASAY', 'JEEP-ALABANG-PASAY:OUTBOUND', 'Alabang to Pasay', 1, 'A101', 'Alabang', 14.423127, 121.045653, 'manual_seed', null),
  ('legacy-alabang-pasay-2026-03-19', 'JEEP-ALABANG-PASAY', 'JEEP-ALABANG-PASAY:OUTBOUND', 'Alabang to Pasay', 2, 'A102', 'Sucat', 14.453759, 121.045772, 'manual_seed', null),
  ('legacy-alabang-pasay-2026-03-19', 'JEEP-ALABANG-PASAY', 'JEEP-ALABANG-PASAY:OUTBOUND', 'Alabang to Pasay', 3, 'A103', 'Tanyag', 14.481497, 121.045374, 'manual_seed', null),
  ('legacy-alabang-pasay-2026-03-19', 'JEEP-ALABANG-PASAY', 'JEEP-ALABANG-PASAY:OUTBOUND', 'Alabang to Pasay', 4, 'A104', 'Bicutan', 14.486595, 121.045493, 'manual_seed', null),
  ('legacy-alabang-pasay-2026-03-19', 'JEEP-ALABANG-PASAY', 'JEEP-ALABANG-PASAY:OUTBOUND', 'Alabang to Pasay', 5, 'A105', 'DOST', 14.488934, 121.046981, 'manual_seed', null),
  ('legacy-alabang-pasay-2026-03-19', 'JEEP-ALABANG-PASAY', 'JEEP-ALABANG-PASAY:OUTBOUND', 'Alabang to Pasay', 6, 'A106', 'Tenement', 14.507707, 121.035057, 'manual_seed', null),
  ('legacy-alabang-pasay-2026-03-19', 'JEEP-ALABANG-PASAY', 'JEEP-ALABANG-PASAY:OUTBOUND', 'Alabang to Pasay', 7, 'A107', 'Gate 3', 14.525036, 121.026618, 'manual_seed', null),
  ('legacy-alabang-pasay-2026-03-19', 'JEEP-ALABANG-PASAY', 'JEEP-ALABANG-PASAY:OUTBOUND', 'Alabang to Pasay', 8, 'A108', 'Magallanes', 14.540418, 121.016215, 'manual_seed', null),
  ('legacy-alabang-pasay-2026-03-19', 'JEEP-ALABANG-PASAY', 'JEEP-ALABANG-PASAY:OUTBOUND', 'Alabang to Pasay', 9, 'A109', 'Evangelista', 14.539118, 121.012297, 'manual_seed', null),
  ('legacy-alabang-pasay-2026-03-19', 'JEEP-ALABANG-PASAY', 'JEEP-ALABANG-PASAY:OUTBOUND', 'Alabang to Pasay', 10, 'A110', 'Cabrera', 14.538206, 121.004894, 'manual_seed', null),
  ('legacy-alabang-pasay-2026-03-19', 'JEEP-ALABANG-PASAY', 'JEEP-ALABANG-PASAY:OUTBOUND', 'Alabang to Pasay', 11, 'A111', 'Tramo', 14.537959, 121.003211, 'manual_seed', null),
  ('legacy-alabang-pasay-2026-03-19', 'JEEP-ALABANG-PASAY', 'JEEP-ALABANG-PASAY:OUTBOUND', 'Alabang to Pasay', 12, 'A112', 'Pasay', 14.537745, 121.001557, 'manual_seed', null)
on conflict (import_batch, variant_code, sequence) do update
set external_stop_code = excluded.external_stop_code,
    stop_name = excluded.stop_name,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    source_name = excluded.source_name,
    source_url = excluded.source_url;

with import_rows as (
  select
    route_stop_import_rows.sequence,
    route_stop_import_rows.route_code,
    route_stop_import_rows.variant_code,
    route_stop_import_rows.direction_label,
    route_stop_import_rows.external_stop_code,
    route_stop_import_rows.stop_name,
    route_stop_import_rows.latitude,
    route_stop_import_rows.longitude,
    case route_stop_import_rows.stop_name
      when 'Alabang' then 'Muntinlupa'
      when 'Sucat' then 'Paranaque'
      when 'Tanyag' then 'Taguig'
      when 'Bicutan' then 'Taguig'
      when 'DOST' then 'Taguig'
      when 'Tenement' then 'Taguig'
      when 'Gate 3' then 'Taguig'
      when 'Magallanes' then 'Makati'
      when 'Evangelista' then 'Pasay'
      when 'Cabrera' then 'Pasay'
      when 'Tramo' then 'Pasay'
      when 'Pasay' then 'Pasay'
      else 'Metro Manila'
    end as city,
    case route_stop_import_rows.stop_name
      when 'Alabang' then 'terminal'
      when 'Pasay' then 'terminal'
      else 'area'
    end as kind
  from public.route_stop_import_rows route_stop_import_rows
  where route_stop_import_rows.import_batch = 'legacy-alabang-pasay-2026-03-19'
    and route_stop_import_rows.variant_code = 'JEEP-ALABANG-PASAY:OUTBOUND'
),
upserted_places as (
  insert into public.places (
    canonical_name,
    city,
    kind,
    latitude,
    longitude,
    google_place_id
  )
  select
    import_rows.stop_name,
    import_rows.city,
    import_rows.kind,
    import_rows.latitude,
    import_rows.longitude,
    null
  from import_rows
  on conflict do nothing
  returning id, canonical_name
),
resolved_places as (
  select places.id, places.canonical_name
  from public.places places
  where places.canonical_name in (select import_rows.stop_name from import_rows)
),
upserted_stops as (
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
    resolved_places.id,
    import_rows.external_stop_code,
    import_rows.stop_name,
    'jeepney',
    import_rows.city,
    import_rows.latitude,
    import_rows.longitude,
    true
  from import_rows
  join resolved_places
    on resolved_places.canonical_name = import_rows.stop_name
  on conflict (external_stop_code) do update
  set place_id = excluded.place_id,
      stop_name = excluded.stop_name,
      area = excluded.area,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      is_active = excluded.is_active
  returning id, external_stop_code
),
upserted_route as (
  insert into public.routes (
    code,
    display_name,
    primary_mode,
    operator_name,
    source_name,
    source_url,
    trust_level,
    is_active
  )
  values (
    'JEEP-ALABANG-PASAY',
    'Alabang - Pasay',
    'jeepney',
    null,
    'manual_seed',
    null,
    'trusted_seed',
    true
  )
  on conflict (code) do update
  set display_name = excluded.display_name,
      primary_mode = excluded.primary_mode,
      operator_name = excluded.operator_name,
      source_name = excluded.source_name,
      source_url = excluded.source_url,
      trust_level = excluded.trust_level,
      is_active = excluded.is_active
  returning id
),
route_row as (
  select id from upserted_route
  union all
  select routes.id from public.routes routes where routes.code = 'JEEP-ALABANG-PASAY'
  limit 1
),
origin_destination_places as (
  select
    max(case when import_rows.sequence = 1 then resolved_places.id end) as origin_place_id,
    max(case when import_rows.sequence = 12 then resolved_places.id end) as destination_place_id
  from import_rows
  join resolved_places
    on resolved_places.canonical_name = import_rows.stop_name
),
upserted_variant as (
  insert into public.route_variants (
    route_id,
    code,
    display_name,
    direction_label,
    origin_place_id,
    destination_place_id,
    is_active
  )
  select
    route_row.id,
    'JEEP-ALABANG-PASAY:OUTBOUND',
    'Alabang to Pasay via SLEX',
    'Alabang to Pasay',
    origin_destination_places.origin_place_id,
    origin_destination_places.destination_place_id,
    true
  from route_row, origin_destination_places
  on conflict (code) do update
  set route_id = excluded.route_id,
      display_name = excluded.display_name,
      direction_label = excluded.direction_label,
      origin_place_id = excluded.origin_place_id,
      destination_place_id = excluded.destination_place_id,
      is_active = excluded.is_active
  returning id
),
variant_row as (
  select id from upserted_variant
  union all
  select route_variants.id
  from public.route_variants route_variants
  where route_variants.code = 'JEEP-ALABANG-PASAY:OUTBOUND'
  limit 1
),
sequenced_stops as (
  select
    import_rows.sequence,
    import_rows.stop_name,
    import_rows.external_stop_code,
    stops.id as stop_id,
    import_rows.latitude,
    import_rows.longitude,
    lag(stops.id) over (order by import_rows.sequence) as previous_stop_id,
    lag(import_rows.latitude) over (order by import_rows.sequence) as previous_latitude,
    lag(import_rows.longitude) over (order by import_rows.sequence) as previous_longitude
  from import_rows
  join public.stops stops
    on stops.external_stop_code = import_rows.external_stop_code
),
leg_rows as (
  select
    sequenced_stops.sequence - 1 as sequence,
    sequenced_stops.previous_stop_id as from_stop_id,
    sequenced_stops.stop_id as to_stop_id,
    case
      when sequenced_stops.previous_latitude is null
        or sequenced_stops.previous_longitude is null
        or sequenced_stops.latitude is null
        or sequenced_stops.longitude is null then 1.0
      else round((
        6371 * acos(
          least(
            1.0,
            greatest(
              -1.0,
              cos(radians(sequenced_stops.previous_latitude))
              * cos(radians(sequenced_stops.latitude))
              * cos(radians(sequenced_stops.longitude) - radians(sequenced_stops.previous_longitude))
              + sin(radians(sequenced_stops.previous_latitude))
              * sin(radians(sequenced_stops.latitude))
            )
          )
        )
      )::numeric, 2)
    end as distance_km,
    greatest(
      2,
      ceil((
        case
          when sequenced_stops.previous_latitude is null
            or sequenced_stops.previous_longitude is null
            or sequenced_stops.latitude is null
            or sequenced_stops.longitude is null then 1.0
          else 6371 * acos(
            least(
              1.0,
              greatest(
                -1.0,
                cos(radians(sequenced_stops.previous_latitude))
                * cos(radians(sequenced_stops.latitude))
                * cos(radians(sequenced_stops.longitude) - radians(sequenced_stops.previous_longitude))
                + sin(radians(sequenced_stops.previous_latitude))
                * sin(radians(sequenced_stops.latitude))
              )
            )
          )
        end
      ) / 18.0 * 60.0)
    )::integer as duration_minutes,
    concat(
      lag(sequenced_stops.stop_name) over (order by sequenced_stops.sequence),
      ' - ',
      sequenced_stops.stop_name
    ) as route_label
  from sequenced_stops
  where sequenced_stops.previous_stop_id is not null
)
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
select
  variant_row.id,
  leg_rows.sequence,
  'jeepney',
  leg_rows.from_stop_id,
  leg_rows.to_stop_id,
  leg_rows.route_label,
  leg_rows.distance_km,
  leg_rows.duration_minutes,
  'puj_traditional',
  'alabang-pasay'
from leg_rows, variant_row
on conflict (route_variant_id, sequence) do update
set mode = excluded.mode,
    from_stop_id = excluded.from_stop_id,
    to_stop_id = excluded.to_stop_id,
    route_label = excluded.route_label,
    distance_km = excluded.distance_km,
    duration_minutes = excluded.duration_minutes,
    fare_product_code = excluded.fare_product_code,
    corridor_tag = excluded.corridor_tag;

insert into public.place_aliases (place_id, alias, normalized_alias)
select places.id, aliases.alias, aliases.normalized_alias
from (
  values
    ('Pasay', 'Pasay Rotonda', 'pasay rotonda'),
    ('Magallanes', 'Magallanes Interchange', 'magallanes interchange'),
    ('DOST', 'DOST Bicutan', 'dost bicutan'),
    ('Gate 3', 'Gate Three', 'gate three')
) as aliases(canonical_name, alias, normalized_alias)
join public.places places
  on places.canonical_name = aliases.canonical_name
on conflict (place_id, normalized_alias) do nothing;
