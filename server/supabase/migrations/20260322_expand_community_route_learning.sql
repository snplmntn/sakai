alter table if exists public.routes
  add column if not exists lifecycle_status text default 'active',
  add column if not exists superseded_by_route_id uuid references public.routes(id) on delete set null;

update public.routes
set lifecycle_status = coalesce(lifecycle_status, case when is_active then 'active' else 'deprecated' end);

alter table if exists public.routes
  alter column lifecycle_status set not null,
  alter column lifecycle_status set default 'active';

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'routes'
      and constraint_name = 'routes_lifecycle_status_check'
  ) then
    execute 'alter table public.routes drop constraint routes_lifecycle_status_check';
  end if;

  execute $constraint$
    alter table public.routes
    add constraint routes_lifecycle_status_check
    check (lifecycle_status in ('active', 'deprecated', 'superseded'))
  $constraint$;
end $$;

alter table if exists public.route_variants
  add column if not exists lifecycle_status text default 'active',
  add column if not exists superseded_by_variant_id uuid references public.route_variants(id) on delete set null;

update public.route_variants
set lifecycle_status = coalesce(lifecycle_status, case when is_active then 'active' else 'deprecated' end);

alter table if exists public.route_variants
  alter column lifecycle_status set not null,
  alter column lifecycle_status set default 'active';

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'route_variants'
      and constraint_name = 'route_variants_lifecycle_status_check'
  ) then
    execute 'alter table public.route_variants drop constraint route_variants_lifecycle_status_check';
  end if;

  execute $constraint$
    alter table public.route_variants
    add constraint route_variants_lifecycle_status_check
    check (lifecycle_status in ('active', 'deprecated', 'superseded'))
  $constraint$;
end $$;

create index if not exists routes_lifecycle_status_idx
  on public.routes (lifecycle_status);

create index if not exists route_variants_lifecycle_status_idx
  on public.route_variants (lifecycle_status);

alter table if exists public.community_submissions
  add column if not exists route_id uuid references public.routes(id) on delete set null,
  add column if not exists route_variant_id uuid references public.route_variants(id) on delete set null;

update public.community_submissions
set status = 'under_review'
where status = 'reviewed';

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'community_submissions'
      and constraint_name = 'community_submissions_submission_type_check'
  ) then
    execute 'alter table public.community_submissions drop constraint community_submissions_submission_type_check';
  end if;

  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'community_submissions'
      and constraint_name = 'community_submissions_status_check'
  ) then
    execute 'alter table public.community_submissions drop constraint community_submissions_status_check';
  end if;

  execute $constraint$
    alter table public.community_submissions
    add constraint community_submissions_submission_type_check
    check (
      submission_type in (
        'missing_route',
        'route_correction',
        'fare_update',
        'route_note',
        'route_create',
        'route_update',
        'route_deprecate',
        'route_reactivate',
        'stop_correction',
        'transfer_correction'
      )
    )
  $constraint$;

  execute $constraint$
    alter table public.community_submissions
    add constraint community_submissions_status_check
    check (status in ('pending', 'under_review', 'approved', 'rejected', 'published'))
  $constraint$;
end $$;

create index if not exists community_submissions_route_id_idx
  on public.community_submissions (route_id);

create index if not exists community_submissions_route_variant_id_idx
  on public.community_submissions (route_variant_id);

alter table if exists public.community_question_answers
  add column if not exists helpful_count integer default 0,
  add column if not exists promotion_status text default 'not_reviewed',
  add column if not exists linked_route_id uuid references public.routes(id) on delete set null,
  add column if not exists linked_route_variant_id uuid references public.route_variants(id) on delete set null;

update public.community_question_answers
set helpful_count = coalesce(helpful_count, 0),
    promotion_status = coalesce(promotion_status, 'not_reviewed');

alter table if exists public.community_question_answers
  alter column helpful_count set not null,
  alter column helpful_count set default 0,
  alter column promotion_status set not null,
  alter column promotion_status set default 'not_reviewed';

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'community_question_answers'
      and constraint_name = 'community_question_answers_promotion_status_check'
  ) then
    execute 'alter table public.community_question_answers drop constraint community_question_answers_promotion_status_check';
  end if;

  execute $constraint$
    alter table public.community_question_answers
    add constraint community_question_answers_promotion_status_check
    check (promotion_status in ('not_reviewed', 'promoted', 'published'))
  $constraint$;
end $$;

create index if not exists community_question_answers_promotion_status_idx
  on public.community_question_answers (promotion_status);

create table if not exists public.community_route_learning_proposals (
  id uuid primary key default gen_random_uuid(),
  source_kind text not null
    check (source_kind in ('direct_submission', 'promoted_answer')),
  source_submission_id uuid references public.community_submissions(id) on delete set null,
  source_question_id uuid references public.community_questions(id) on delete set null,
  source_answer_id uuid references public.community_question_answers(id) on delete set null,
  created_by_user_id uuid not null references auth.users(id),
  proposal_type text not null
    check (
      proposal_type in (
        'route_create',
        'route_update',
        'route_deprecate',
        'route_reactivate',
        'stop_correction',
        'transfer_correction',
        'fare_update',
        'route_note'
      )
    ),
  review_status text not null default 'pending'
    check (review_status in ('pending', 'under_review', 'approved', 'rejected', 'published')),
  title text not null,
  summary text,
  route_id uuid references public.routes(id) on delete set null,
  route_variant_id uuid references public.route_variants(id) on delete set null,
  target_stop_ids uuid[] not null default '{}',
  target_transfer_point_ids uuid[] not null default '{}',
  proposed_lifecycle_status text
    check (proposed_lifecycle_status in ('active', 'deprecated', 'superseded')),
  payload jsonb not null default '{}'::jsonb,
  evidence_note text,
  review_notes text,
  reviewed_by_user_id uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint community_route_learning_proposals_source_check
    check (
      (source_kind = 'direct_submission' and source_submission_id is not null)
      or
      (source_kind = 'promoted_answer' and source_question_id is not null and source_answer_id is not null)
    )
);

drop trigger if exists set_community_route_learning_proposals_updated_at on public.community_route_learning_proposals;

create trigger set_community_route_learning_proposals_updated_at
before update on public.community_route_learning_proposals
for each row
execute function public.set_updated_at();

create index if not exists community_route_learning_proposals_review_status_idx
  on public.community_route_learning_proposals (review_status, created_at desc);

create index if not exists community_route_learning_proposals_route_id_idx
  on public.community_route_learning_proposals (route_id);

create index if not exists community_route_learning_proposals_route_variant_id_idx
  on public.community_route_learning_proposals (route_variant_id);

grant select, insert, update, delete on public.community_route_learning_proposals to service_role;

create table if not exists public.community_route_publications (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.community_route_learning_proposals(id) on delete cascade,
  reviewer_user_id uuid not null references auth.users(id),
  route_id uuid references public.routes(id) on delete set null,
  route_variant_id uuid references public.route_variants(id) on delete set null,
  publication_action text not null
    check (
      publication_action in (
        'route_create',
        'route_update',
        'route_deprecate',
        'route_reactivate',
        'stop_correction',
        'transfer_correction',
        'fare_update',
        'route_note'
      )
    ),
  change_summary text not null,
  published_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists community_route_publications_proposal_id_uidx
  on public.community_route_publications (proposal_id);

create index if not exists community_route_publications_route_id_created_at_idx
  on public.community_route_publications (route_id, created_at desc);

create index if not exists community_route_publications_route_variant_id_created_at_idx
  on public.community_route_publications (route_variant_id, created_at desc);

grant select, insert, update, delete on public.community_route_publications to service_role;

create table if not exists public.community_route_notes (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.community_route_publications(id) on delete cascade,
  route_id uuid references public.routes(id) on delete set null,
  route_variant_id uuid references public.route_variants(id) on delete set null,
  note text not null,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists community_route_notes_publication_id_uidx
  on public.community_route_notes (publication_id);

create index if not exists community_route_notes_route_id_idx
  on public.community_route_notes (route_id, is_active, created_at desc);

create index if not exists community_route_notes_route_variant_id_idx
  on public.community_route_notes (route_variant_id, is_active, created_at desc);

grant select, insert, update, delete on public.community_route_notes to service_role;
