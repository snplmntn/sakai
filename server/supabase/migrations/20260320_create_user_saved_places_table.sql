create table if not exists public.user_saved_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  address text not null,
  label_kind text not null
    check (label_kind in ('preset', 'custom')),
  preset_label text
    check (preset_label in ('home', 'office', 'school')),
  custom_label text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint user_saved_places_address_not_blank
    check (length(btrim(address)) > 0),
  constraint user_saved_places_label_fields_valid
    check (
      (label_kind = 'preset' and preset_label is not null and custom_label is null)
      or
      (label_kind = 'custom' and preset_label is null and custom_label is not null and length(btrim(custom_label)) > 0)
    )
);

create unique index if not exists user_saved_places_user_preset_uidx
  on public.user_saved_places (user_id, preset_label)
  where preset_label is not null;

create index if not exists user_saved_places_user_updated_at_idx
  on public.user_saved_places (user_id, updated_at desc);

drop trigger if exists set_user_saved_places_updated_at on public.user_saved_places;

create trigger set_user_saved_places_updated_at
before update on public.user_saved_places
for each row
execute function public.set_updated_at();

grant select, insert, update, delete on public.user_saved_places to authenticated;

alter table public.user_saved_places enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_saved_places'
      and policyname = 'user_saved_places_select_own'
  ) then
    execute $policy$
      create policy user_saved_places_select_own
      on public.user_saved_places
      for select
      to authenticated
      using (auth.uid() = user_id)
    $policy$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_saved_places'
      and policyname = 'user_saved_places_insert_own'
  ) then
    execute $policy$
      create policy user_saved_places_insert_own
      on public.user_saved_places
      for insert
      to authenticated
      with check (auth.uid() = user_id)
    $policy$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_saved_places'
      and policyname = 'user_saved_places_update_own'
  ) then
    execute $policy$
      create policy user_saved_places_update_own
      on public.user_saved_places
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id)
    $policy$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_saved_places'
      and policyname = 'user_saved_places_delete_own'
  ) then
    execute $policy$
      create policy user_saved_places_delete_own
      on public.user_saved_places
      for delete
      to authenticated
      using (auth.uid() = user_id)
    $policy$;
  end if;
end $$;
