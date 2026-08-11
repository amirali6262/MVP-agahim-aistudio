begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create function private.is_tenant_member(requested_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.user_tenants
    where tenant_id = requested_tenant_id
      and user_id = auth.uid()
  );
$$;

create function private.has_tenant_role(requested_tenant_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.user_tenants
    where tenant_id = requested_tenant_id
      and user_id = auth.uid()
      and role = any (allowed_roles)
  );
$$;

revoke all on function private.is_tenant_member(uuid) from public, anon, authenticated;
revoke all on function private.has_tenant_role(uuid, text[]) from public, anon, authenticated;
grant execute on function private.is_tenant_member(uuid) to authenticated;
grant execute on function private.has_tenant_role(uuid, text[]) to authenticated;

drop policy users_select_own on public.users;
create policy users_select_own
on public.users for select
to authenticated
using (id = (select auth.uid()));

drop policy tenants_select_member on public.tenants;
create policy tenants_select_member
on public.tenants for select
to authenticated
using (private.is_tenant_member(id));

drop policy tenants_update_owner_admin on public.tenants;
create policy tenants_update_owner_admin
on public.tenants for update
to authenticated
using (private.has_tenant_role(id, array['OWNER', 'ADMIN']))
with check (private.has_tenant_role(id, array['OWNER', 'ADMIN']));

drop policy tenants_delete_owner on public.tenants;
create policy tenants_delete_owner
on public.tenants for delete
to authenticated
using (private.has_tenant_role(id, array['OWNER']));

drop policy user_tenants_select_member on public.user_tenants;
create policy user_tenants_select_member
on public.user_tenants for select
to authenticated
using (private.is_tenant_member(tenant_id));

drop policy user_tenants_insert_manager on public.user_tenants;
create policy user_tenants_insert_manager
on public.user_tenants for insert
to authenticated
with check (
  private.has_tenant_role(tenant_id, array['OWNER'])
  or (
    role in ('ADMIN', 'MEMBER')
    and private.has_tenant_role(tenant_id, array['ADMIN'])
  )
);

drop policy user_tenants_update_owner on public.user_tenants;
create policy user_tenants_update_owner
on public.user_tenants for update
to authenticated
using (private.has_tenant_role(tenant_id, array['OWNER']))
with check (private.has_tenant_role(tenant_id, array['OWNER']));

drop policy user_tenants_delete_owner on public.user_tenants;
create policy user_tenants_delete_owner
on public.user_tenants for delete
to authenticated
using (private.has_tenant_role(tenant_id, array['OWNER']));

drop function public.is_tenant_member(uuid);
drop function public.has_tenant_role(uuid, text[]);

create index tenants_created_by_idx on public.tenants (created_by);

commit;
