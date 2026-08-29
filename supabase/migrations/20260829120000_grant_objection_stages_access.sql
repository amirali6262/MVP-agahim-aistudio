begin;

-- The objection-stages catalog tables were created with RLS policies but
-- without Data API table privileges. PostgREST rejects the query with
-- "permission denied for table" before RLS is even consulted, so the admin
-- form ("تعریف مراحل رسیدگی و اعتراضات") rendered the empty state although
-- the tables were fully seeded.
--
-- The RLS policies already anticipate these privileges:
--   * read: any authenticated user
--   * write: platform admins only (checked via public.users.role)
-- This migration simply supplies the missing table-level grants so the
-- policies can be reached. GRANT is idempotent.

grant select, insert, update, delete on table public.tax_objection_stages to authenticated;
grant select, insert, update, delete on table public.tax_stage_transitions to authenticated;
grant select, insert, update, delete on table public.objection_step_transitions to authenticated;

commit;
