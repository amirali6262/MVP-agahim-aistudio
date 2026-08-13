-- Integration test for the secure auth and tenant foundation.
-- Run only against a development Supabase project.
-- All fixtures are created inside a transaction and rolled back.
-- A successful run returns zero for all leftover_* columns.

begin;

insert into auth.users (
  id, aud, role, email, phone, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, is_sso_user, is_anonymous
) values
  ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'rls-owner@example.invalid', '+989100000001', '{"provider":"email","providers":["email"]}', '{"role":"PLATFORM_ADMIN"}', now(), now(), false, false),
  ('10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'rls-admin@example.invalid', '+989100000002', '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, false),
  ('10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'rls-member@example.invalid', '+989100000003', '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, false),
  ('10000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'rls-outsider@example.invalid', '+989100000004', '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, false),
  ('10000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'rls-platform-admin@example.invalid', '+989100000005', '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, false),
  ('10000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'rls-extra@example.invalid', '+989100000006', '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, false),
  ('10000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'rls-profileless@example.invalid', '+989100000007', '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, false);

do $$
begin
  if (select count(*) from public.users where id::text like '10000000-0000-0000-0000-00000000000%') <> 7 then
    raise exception 'auth insert trigger did not create all profiles';
  end if;
  if (select role from public.users where id = '10000000-0000-0000-0000-000000000001') <> 'BUSINESS_USER' then
    raise exception 'user metadata was able to influence protected role';
  end if;
end
$$;

update auth.users
set email = 'rls-owner-updated@example.invalid',
    phone = '+989199999999'
where id = '10000000-0000-0000-0000-000000000001';

do $$
begin
  if not exists (
    select 1 from public.users
    where id = '10000000-0000-0000-0000-000000000001'
      and email = 'rls-owner-updated@example.invalid'
      and phone = '+989199999999'
  ) then
    raise exception 'auth contact synchronization trigger failed';
  end if;
end
$$;

update public.users
set role = 'PLATFORM_ADMIN'
where id = '10000000-0000-0000-0000-000000000005';

-- Simulate a legacy or damaged Auth user whose public profile is missing.
delete from public.users
where id = '10000000-0000-0000-0000-000000000007';

insert into public.tenants (id, name, entity_type, created_by)
values
  ('20000000-0000-0000-0000-000000000001', 'RLS Tenant A', 'حقوقی', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', 'RLS Tenant B', 'حقیقی', '10000000-0000-0000-0000-000000000004');

insert into public.user_tenants (id, user_id, tenant_id, role)
values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'OWNER'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'ADMIN'),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'MEMBER'),
  ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', 'OWNER');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

do $$
declare affected integer;
begin
  if (select count(*) from public.users) <> 1 then
    raise exception 'owner can read profiles other than their own';
  end if;
  if (select count(*) from public.tenants) <> 1
     or not exists (select 1 from public.tenants where id = '20000000-0000-0000-0000-000000000001') then
    raise exception 'owner tenant visibility is incorrect';
  end if;
  if (select count(*) from public.user_tenants where tenant_id = '20000000-0000-0000-0000-000000000001') <> 3 then
    raise exception 'owner cannot read own tenant memberships';
  end if;

  update public.tenants
  set name = 'RLS Tenant A owner update'
  where id = '20000000-0000-0000-0000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'owner could not update own tenant';
  end if;

  begin
    update public.user_tenants
    set role = 'MEMBER'
    where id = '30000000-0000-0000-0000-000000000001';
    raise exception 'owner was able to downgrade own membership';
  exception when check_violation then
    null;
  end;

  begin
    delete from public.user_tenants
    where id = '30000000-0000-0000-0000-000000000001';
    raise exception 'owner was able to delete own membership';
  exception when check_violation then
    null;
  end;
end
$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

do $$
declare affected integer;
begin
  if (select count(*) from public.tenants) <> 1 then
    raise exception 'tenant admin visibility is incorrect';
  end if;

  update public.tenants
  set province = 'تهران'
  where id = '20000000-0000-0000-0000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'tenant admin could not update tenant';
  end if;

  insert into public.user_tenants (user_id, tenant_id, role)
  values ('10000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001', 'MEMBER');

  update public.user_tenants
  set role = 'ADMIN'
  where user_id = '10000000-0000-0000-0000-000000000003'
    and tenant_id = '20000000-0000-0000-0000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'tenant admin was able to update membership roles';
  end if;

  begin
    insert into public.user_tenants (user_id, tenant_id, role)
    values ('10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 'OWNER');
    raise exception 'tenant admin was able to create an owner';
  exception when insufficient_privilege then
    null;
  end;
end
$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}', true);

do $$
declare affected integer;
begin
  if (select count(*) from public.tenants) <> 1 then
    raise exception 'member visibility is incorrect';
  end if;

  update public.tenants
  set province = 'فارس'
  where id = '20000000-0000-0000-0000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'member was able to update tenant';
  end if;

  begin
    insert into public.user_tenants (user_id, tenant_id, role)
    values ('10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 'MEMBER');
    raise exception 'member was able to add memberships';
  exception when insufficient_privilege then
    null;
  end;
end
$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}', true);

do $$
declare affected integer;
begin
  if (select count(*) from public.tenants) <> 1
     or not exists (select 1 from public.tenants where id = '20000000-0000-0000-0000-000000000002')
     or exists (select 1 from public.tenants where id = '20000000-0000-0000-0000-000000000001') then
    raise exception 'cross-tenant SELECT isolation failed';
  end if;

  update public.tenants
  set name = 'cross-tenant attack'
  where id = '20000000-0000-0000-0000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'cross-tenant UPDATE isolation failed';
  end if;
end
$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000005', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000005","role":"authenticated"}', true);

do $$
begin
  if (select count(*) from public.users) <> 1
     or (select role from public.users) <> 'PLATFORM_ADMIN' then
    raise exception 'platform admin own-profile policy failed';
  end if;
  if (select count(*) from public.tenants) <> 0 then
    raise exception 'platform admin bypassed tenant membership RLS';
  end if;
end
$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000005', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000005","role":"authenticated"}', true);

do $$
declare
  created public.tenants;
  before_count integer;
begin
  select count(*) into before_count from public.tenants;

  select * into created
  from public.create_tenant_with_owner(
    'Atomic RPC Tenant',
    'حقوقی',
    '10101010101',
    null,
    'تهران'
  );

  if created.id is null then
    raise exception 'atomic tenant RPC returned no tenant';
  end if;
  if not exists (
    select 1 from public.user_tenants
    where tenant_id = created.id
      and user_id = '10000000-0000-0000-0000-000000000005'
      and role = 'OWNER'
  ) then
    raise exception 'atomic tenant RPC did not create owner membership';
  end if;
  if (select count(*) from public.tenants) <> before_count + 1 then
    raise exception 'atomic tenant RPC created an unexpected number of tenants';
  end if;

  select count(*) into before_count from public.tenants;
  begin
    perform public.create_tenant_with_owner('Invalid RPC Tenant', 'نامعتبر', null, null, null);
    raise exception 'invalid RPC input was accepted';
  exception when invalid_parameter_value then
    null;
  end;
  if (select count(*) from public.tenants) <> before_count then
    raise exception 'failed RPC left a partial tenant behind';
  end if;
end
$$;
reset role;

do $$
begin
  begin
    delete from public.user_tenants
    where id = '30000000-0000-0000-0000-000000000004';
    raise exception 'sole owner deletion was accepted';
  exception when check_violation then
    null;
  end;
end
$$;

-- Anonymous Auth users have an authenticated database role but must not
-- receive tenant access or create a tenant.
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated","is_anonymous":true}', true);
do $$
begin
  if (select count(*) from public.tenants) <> 0 then
    raise exception 'anonymous Auth user could read tenant data';
  end if;

  begin
    perform public.create_tenant_with_owner('Anonymous Auth Tenant', 'حقوقی', null, null, null);
    raise exception 'anonymous Auth user was able to create a tenant';
  exception when insufficient_privilege then
    null;
  end;
end
$$;
reset role;

-- A valid Auth session without a corresponding public profile must fail closed.
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000007', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000007","role":"authenticated","is_anonymous":false}', true);
do $$
begin
  begin
    perform public.create_tenant_with_owner('Profileless Tenant', 'حقوقی', null, null, null);
    raise exception 'profileless Auth user was able to create a tenant';
  exception when insufficient_privilege then
    null;
  end;
end
$$;
reset role;

set local role anon;
do $$
begin
  begin
    perform 1 from public.users limit 1;
    raise exception 'anon was able to select protected profiles';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform public.create_tenant_with_owner('Anon Tenant', 'حقوقی', null, null, null);
    raise exception 'anon was able to execute tenant RPC';
  exception when insufficient_privilege then
    null;
  end;
end
$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
do $$
begin
  begin
    insert into public.tenants (name, entity_type, created_by)
    values ('Direct Insert Tenant', 'حقوقی', '10000000-0000-0000-0000-000000000003');
    raise exception 'authenticated user was able to insert tenant directly';
  exception when insufficient_privilege then
    null;
  end;

  begin
    update public.users set email = 'forbidden@example.invalid'
    where id = '10000000-0000-0000-0000-000000000003';
    raise exception 'authenticated user was able to update protected profile';
  exception when insufficient_privilege then
    null;
  end;
end
$$;
reset role;

-- New public objects created by postgres must not be exposed to Data API
-- client roles unless a migration grants access explicitly.
create table public.rls_default_acl_probe (id integer);
create sequence public.rls_default_acl_probe_seq;
create function public.rls_default_acl_probe_fn()
returns integer
language sql
as $$ select 1 $$;

do $$
begin
  if has_table_privilege('anon', 'public.rls_default_acl_probe', 'select')
     or has_table_privilege('authenticated', 'public.rls_default_acl_probe', 'select') then
    raise exception 'default table privileges expose new public tables';
  end if;

  if has_sequence_privilege('anon', 'public.rls_default_acl_probe_seq', 'usage')
     or has_sequence_privilege('authenticated', 'public.rls_default_acl_probe_seq', 'usage') then
    raise exception 'default sequence privileges expose new public sequences';
  end if;

  if has_function_privilege('anon', 'public.rls_default_acl_probe_fn()', 'execute')
     or has_function_privilege('authenticated', 'public.rls_default_acl_probe_fn()', 'execute') then
    raise exception 'default function privileges expose new public functions';
  end if;
end
$$;

rollback;

select
  count(*) filter (where email like 'rls-%@example.invalid') as leftover_auth_users,
  (select count(*) from public.users where email like 'rls-%@example.invalid') as leftover_public_profiles,
  (select count(*) from public.tenants where name like 'RLS Tenant%' or name = 'Atomic RPC Tenant') as leftover_tenants
from auth.users;
