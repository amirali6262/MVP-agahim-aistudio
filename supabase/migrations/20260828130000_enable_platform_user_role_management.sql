begin;

-- Keep public.users restricted to each user's own profile. Administrative
-- directory access is exposed only through these narrowly scoped RPCs.
create function public.list_platform_users()
returns table (
  id uuid,
  email text,
  phone text,
  role text,
  roles jsonb,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null or not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;

  return query
  select u.id, u.email, u.phone, u.role, u.roles, u.created_at
  from public.users as u
  order by u.created_at desc;
end;
$$;

create function public.update_platform_user_roles(
  requested_user_id uuid,
  requested_roles jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null or not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;
  if requested_user_id = auth.uid() then
    raise exception 'self role changes are forbidden' using errcode = '42501';
  end if;
  if jsonb_typeof(requested_roles) <> 'array'
     or jsonb_array_length(requested_roles) = 0
     or not requested_roles <@ '["PLATFORM_ADMIN","MANAGER","REGISTRAR","REVIEWER","APPROVER","BUSINESS_USER"]'::jsonb then
    raise exception 'invalid platform roles' using errcode = '22023';
  end if;

  update public.users
  set role = requested_roles ->> 0,
      roles = requested_roles
  where id = requested_user_id;

  if not found then
    raise exception 'user not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.list_platform_users() from public, anon, authenticated;
revoke all on function public.update_platform_user_roles(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.list_platform_users() to authenticated;
grant execute on function public.update_platform_user_roles(uuid, jsonb) to authenticated;

commit;
