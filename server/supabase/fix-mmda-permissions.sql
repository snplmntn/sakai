-- Run this in Supabase SQL Editor if MMDA upsert still reports permission denied.
-- It grants explicit service-role access to area-updates persistence.

begin;

grant select, insert, update, delete on public.area_updates to service_role;
grant usage on schema public to service_role;

-- Optional: keep dashboard/API reads available under anon/authenticated usage
-- if you later move read endpoints to non-admin clients.
grant select on public.area_updates to authenticated;
grant select on public.area_updates to anon;

-- Validate after running:
-- select has_table_privilege('service_role', 'public.area_updates', 'insert') as can_insert;
-- select has_table_privilege('service_role', 'public.area_updates', 'update') as can_update;

commit;
