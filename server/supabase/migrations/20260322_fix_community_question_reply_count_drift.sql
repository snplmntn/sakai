do $$
declare
  trigger_record record;
  function_record record;
begin
  for trigger_record in
    select
      n.nspname as schema_name,
      c.relname as table_name,
      t.tgname as trigger_name
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where not t.tgisinternal
      and n.nspname = 'public'
      and c.relname in ('community_questions', 'community_question_answers')
      and pg_get_triggerdef(t.oid) ilike '%community_reactions%'
  loop
    execute format(
      'drop trigger if exists %I on %I.%I',
      trigger_record.trigger_name,
      trigger_record.schema_name,
      trigger_record.table_name
    );
  end loop;

  for function_record in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as identity_arguments
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and pg_get_functiondef(p.oid) ilike '%community_reactions%'
      and (
        pg_get_functiondef(p.oid) ilike '%community_question_answers%'
        or pg_get_functiondef(p.oid) ilike '%community_questions%'
      )
  loop
    execute format(
      'drop function if exists %I.%I(%s)',
      function_record.schema_name,
      function_record.function_name,
      function_record.identity_arguments
    );
  end loop;
end $$;

drop trigger if exists set_community_questions_updated_at on public.community_questions;
create trigger set_community_questions_updated_at
before update on public.community_questions
for each row
execute function public.set_updated_at();

drop trigger if exists set_community_question_answers_updated_at on public.community_question_answers;
create trigger set_community_question_answers_updated_at
before update on public.community_question_answers
for each row
execute function public.set_updated_at();

create or replace function public.increment_community_question_reply_count(question_id_input uuid)
returns void
language sql
security definer
as $$
  update public.community_questions
  set reply_count = (
        select count(*)
        from public.community_question_answers
        where question_id = question_id_input
      ),
      last_answered_at = (
        select max(created_at)
        from public.community_question_answers
        where question_id = question_id_input
      ),
      updated_at = timezone('utc', now())
  where id = question_id_input;
$$;

grant execute on function public.increment_community_question_reply_count(uuid) to authenticated;

update public.community_questions q
set reply_count = counts.reply_count,
    last_answered_at = counts.last_answered_at,
    updated_at = timezone('utc', now())
from (
  select
    q_inner.id,
    count(a.id)::integer as reply_count,
    max(a.created_at) as last_answered_at
  from public.community_questions q_inner
  left join public.community_question_answers a
    on a.question_id = q_inner.id
  group by q_inner.id
) as counts
where q.id = counts.id
  and (
    q.reply_count is distinct from counts.reply_count
    or q.last_answered_at is distinct from counts.last_answered_at
  );
