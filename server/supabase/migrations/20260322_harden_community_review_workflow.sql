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
  existing_publication_id uuid;
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
