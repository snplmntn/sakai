with existing_place as (
  select id
  from public.places
  where canonical_name = 'PUP Sta. Mesa'
    and city = 'Manila'
  limit 1
),
inserted_place as (
  insert into public.places (
    id,
    canonical_name,
    city,
    kind,
    latitude,
    longitude,
    google_place_id
  )
  select
    '55555555-5555-5555-5555-555555555551'::uuid,
    'PUP Sta. Mesa',
    'Manila',
    'campus',
    14.5995,
    121.0114,
    null
  where not exists (select 1 from existing_place)
  returning id
),
resolved_place as (
  select id from inserted_place
  union all
  select id from existing_place
)
insert into public.place_aliases (place_id, alias, normalized_alias)
select
  resolved_place.id,
  alias_manifest.alias,
  alias_manifest.normalized_alias
from resolved_place
cross join (
  values
    ('PUP Sta Mesa', 'pup sta mesa'),
    ('PUP', 'pup'),
    ('Polytechnic University of the Philippines', 'polytechnic university of the philippines'),
    ('PUP Main Campus', 'pup main campus')
) as alias_manifest(alias, normalized_alias)
on conflict (place_id, normalized_alias) do nothing;
