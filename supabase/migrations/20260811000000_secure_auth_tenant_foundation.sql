begin;

create extension if not exists pgcrypto with schema extensions;

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  phone text,
  role text not null default 'BUSINESS_USER'
    constraint users_role_check check (role in ('PLATFORM_ADMIN', 'BUSINESS_USER')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  entity_type text not null
    constraint tenants_entity_type_check check (entity_type in ('حقوقی', 'حقیقی')),
  national_id text,
  economic_code text,
  province text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_tenants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role text not null constraint user_tenants_role_check check (role in ('OWNER', 'ADMIN', 'MEMBER')),
  created_at timestamptz not null default now(),
  constraint user_tenants_user_id_tenant_id_key unique (user_id, tenant_id)
);

create index user_tenants_user_id_idx on public.user_tenants (user_id);
create index user_tenants_tenant_id_idx on public.user_tenants (tenant_id);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;
revoke all on function public.set_updated_at() from public, anon, authenticated;

create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  insert into public.users (id, email, phone, role)
  values (new.id, new.email, new.phone, 'BUSINESS_USER')
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

create function public.sync_auth_user_contact()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  update public.users
  set email = new.email,
      phone = new.phone
  where id = new.id;
  return new;
end;
$$;
revoke all on function public.sync_auth_user_contact() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create trigger on_auth_user_contact_updated
  after update of email, phone on auth.users
  for each row
  when (old.email is distinct from new.email or old.phone is distinct from new.phone)
  execute function public.sync_auth_user_contact();

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create trigger tenants_set_updated_at
  before update on public.tenants
  for each row execute function public.set_updated_at();

alter table public.users enable row level security;
alter table public.tenants enable row level security;
alter table public.user_tenants enable row level security;

-- SECURITY DEFINER helpers bind every authorization decision to auth.uid() and
-- read membership without recursively invoking user_tenants RLS policies.
create function public.is_tenant_member(requested_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1 from public.user_tenants
    where tenant_id = requested_tenant_id and user_id = auth.uid()
  );
$$;
revoke all on function public.is_tenant_member(uuid) from public, anon, authenticated;
grant execute on function public.is_tenant_member(uuid) to authenticated;

create function public.has_tenant_role(requested_tenant_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1 from public.user_tenants
    where tenant_id = requested_tenant_id
      and user_id = auth.uid()
      and role = any (allowed_roles)
  );
$$;
revoke all on function public.has_tenant_role(uuid, text[]) from public, anon, authenticated;
grant execute on function public.has_tenant_role(uuid, text[]) to authenticated;

create function public.create_tenant_with_owner(
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
revoke all on function public.create_tenant_with_owner(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_tenant_with_owner(text, text, text, text, text) to authenticated;

create function public.prevent_ownerless_tenant()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if old.role <> 'OWNER' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  -- Allow membership cleanup caused by deleting the tenant itself.
  if tg_op = 'DELETE' and not exists (
    select 1 from public.tenants where id = old.tenant_id
  ) then
    return old;
  end if;

  -- Serialize owner removals for this tenant so concurrent requests cannot
  -- both observe another owner and leave the tenant ownerless.
  perform 1
  from public.tenants
  where id = old.tenant_id
  for update;

  if old.user_id = auth.uid() and tg_op = 'DELETE' then
    raise exception 'an owner cannot remove or downgrade their own membership'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and old.user_id = auth.uid() and new.role <> 'OWNER' then
    raise exception 'an owner cannot remove or downgrade their own membership'
      using errcode = '23514';
  end if;

  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and new.role <> 'OWNER') then
    if not exists (
      select 1
      from public.user_tenants
      where tenant_id = old.tenant_id
        and role = 'OWNER'
        and id <> old.id
    ) then
      raise exception 'a tenant must retain at least one owner'
        using errcode = '23514';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
revoke all on function public.prevent_ownerless_tenant() from public, anon, authenticated;

create trigger user_tenants_prevent_ownerless
  before update of role or delete on public.user_tenants
  for each row execute function public.prevent_ownerless_tenant();

revoke all on table public.users, public.tenants, public.user_tenants from public, anon, authenticated;
grant select on table public.users to authenticated;
grant select, delete on table public.tenants to authenticated;
grant update (name, entity_type, national_id, economic_code, province) on table public.tenants to authenticated;
grant select, delete on table public.user_tenants to authenticated;
grant insert (user_id, tenant_id, role) on table public.user_tenants to authenticated;
grant update (role) on table public.user_tenants to authenticated;

create policy users_select_own
on public.users for select
to authenticated
using (id = auth.uid());

create policy tenants_select_member
on public.tenants for select
to authenticated
using (public.is_tenant_member(id));

create policy tenants_update_owner_admin
on public.tenants for update
to authenticated
using (public.has_tenant_role(id, array['OWNER', 'ADMIN']))
with check (public.has_tenant_role(id, array['OWNER', 'ADMIN']));

create policy tenants_delete_owner
on public.tenants for delete
to authenticated
using (public.has_tenant_role(id, array['OWNER']));

create policy user_tenants_select_member
on public.user_tenants for select
to authenticated
using (public.is_tenant_member(tenant_id));

create policy user_tenants_insert_manager
on public.user_tenants for insert
to authenticated
with check (
  public.has_tenant_role(tenant_id, array['OWNER'])
  or (
    role in ('ADMIN', 'MEMBER')
    and public.has_tenant_role(tenant_id, array['ADMIN'])
  )
);

create policy user_tenants_update_owner
on public.user_tenants for update
to authenticated
using (public.has_tenant_role(tenant_id, array['OWNER']))
with check (public.has_tenant_role(tenant_id, array['OWNER']));

create policy user_tenants_delete_owner
on public.user_tenants for delete
to authenticated
using (public.has_tenant_role(tenant_id, array['OWNER']));

commit;
