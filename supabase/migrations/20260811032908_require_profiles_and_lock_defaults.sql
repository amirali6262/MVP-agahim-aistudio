begin;

-- Anonymous Supabase Auth users also assume the authenticated database role.
-- Keep them outside tenant authorization decisions until the product explicitly
-- supports account conversion and abuse controls.
create or replace function private.is_tenant_member(requested_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select
    auth.uid() is not null
    and not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
    and exists (
      select 1
      from public.user_tenants
      where tenant_id = requested_tenant_id
        and user_id = auth.uid()
    );
$$;

create or replace function private.has_tenant_role(
  requested_tenant_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select
    auth.uid() is not null
    and not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
    and exists (
      select 1
      from public.user_tenants
      where tenant_id = requested_tenant_id
        and user_id = auth.uid()
        and role = any (allowed_roles)
    );
$$;

revoke all on function private.is_tenant_member(uuid)
  from public, anon, authenticated;
revoke all on function private.has_tenant_role(uuid, text[])
  from public, anon, authenticated;
grant execute on function private.is_tenant_member(uuid) to authenticated;
grant execute on function private.has_tenant_role(uuid, text[]) to authenticated;

create or replace function public.create_tenant_with_owner(
  p_name text,
  p_entity_type text,
  p_national_id text default null,
  p_economic_code text default null,
  p_province text default null
)
returns public.tenants
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  current_user_id uuid := auth.uid();
  created_tenant public.tenants;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'anonymous users cannot create tenants' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.users
    where id = current_user_id
  ) then
    raise exception 'a valid public user profile is required' using errcode = '42501';
  end if;

  if p_name is null or pg_catalog.btrim(p_name) = '' then
    raise exception 'tenant name must not be empty' using errcode = '22023';
  end if;

  if p_entity_type is null or p_entity_type not in ('حقوقی', 'حقیقی') then
    raise exception 'invalid tenant entity type' using errcode = '22023';
  end if;

  insert into public.tenants (
    name, entity_type, national_id, economic_code, province, created_by
  ) values (
    pg_catalog.btrim(p_name),
    p_entity_type,
    p_national_id,
    p_economic_code,
    p_province,
    current_user_id
  )
  returning * into created_tenant;

  insert into public.user_tenants (user_id, tenant_id, role)
  values (current_user_id, created_tenant.id, 'OWNER');

  return created_tenant;
end;
$$;

revoke all on function public.create_tenant_with_owner(text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_tenant_with_owner(text, text, text, text, text)
  to authenticated;

-- Hosted projects can grant broad defaults to Data API roles. For application
-- objects created by the postgres owner, require every client permission to be
-- granted explicitly in the migration that creates the object.
alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from public, anon, authenticated;

commit;