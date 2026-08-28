begin;

-- RLS policies were created with the tables, but Data API table privileges are
-- also required before those policies can be reached by authenticated admins.
grant select, insert, update, delete on table public.objection_templates to authenticated;
grant select, insert, update, delete on table public.objection_steps to authenticated;

commit;
