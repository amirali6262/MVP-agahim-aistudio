begin;

-- Platform administrators need to see the platform user directory before they
-- can manage it. Ordinary users retain access only to their own profile.
create policy users_select_platform_admin
on public.users for select
to authenticated
using ((select private.is_platform_admin()));

-- Limit Data API updates to role fields and enforce the same authorization at
-- row level. Self-role changes remain forbidden to prevent admin lockout.
grant update (role, roles) on table public.users to authenticated;

create policy users_update_roles_platform_admin
on public.users for update
to authenticated
using (
  (select private.is_platform_admin())
  and id <> (select auth.uid())
)
with check (
  (select private.is_platform_admin())
  and id <> (select auth.uid())
);

commit;
