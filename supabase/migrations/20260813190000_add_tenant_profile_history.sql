begin;

create table public.tenant_profile_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  valid_from date not null,
  valid_to date,
  legal_form text,
  primary_activity text,
  activity_codes text[] not null default '{}',
  tax_registration_status text not null default 'UNKNOWN'
    constraint tenant_profile_tax_status_check
    check (tax_registration_status in ('UNKNOWN', 'NOT_REGISTERED', 'PENDING', 'REGISTERED')),
  vat_registration_status text not null default 'UNKNOWN'
    constraint tenant_profile_vat_status_check
    check (vat_registration_status in ('UNKNOWN', 'NOT_REQUIRED', 'PENDING', 'REGISTERED')),
  employee_count integer not null default 0
    constraint tenant_profile_employee_count_check check (employee_count >= 0),
  annual_revenue numeric(20, 0)
    constraint tenant_profile_annual_revenue_check check (annual_revenue is null or annual_revenue >= 0),
  branch_count integer not null default 0
    constraint tenant_profile_branch_count_check check (branch_count >= 0),
  has_active_contracts boolean not null default false,
  contract_types text[] not null default '{}',
  pays_salaries boolean not null default false,
  custom_attributes jsonb not null default '{}'::jsonb
    constraint tenant_profile_custom_attributes_check check (jsonb_typeof(custom_attributes) = 'object'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  constraint tenant_profile_valid_period_check check (valid_to is null or valid_to >= valid_from),
  constraint tenant_profile_tenant_start_key unique (tenant_id, valid_from)
);

create unique index tenant_profile_one_current_idx
  on public.tenant_profile_versions (tenant_id)
  where valid_to is null;

create index tenant_profile_history_idx
  on public.tenant_profile_versions (tenant_id, valid_from desc);

alter table public.tenant_profile_versions enable row level security;

revoke all on table public.tenant_profile_versions from public, anon, authenticated;
grant select on table public.tenant_profile_versions to authenticated;

create policy tenant_profile_select_member
on public.tenant_profile_versions for select
to authenticated
using (private.is_tenant_member(tenant_id));

create function public.save_tenant_profile(
  p_tenant_id uuid,
  p_valid_from date,
  p_legal_form text default null,
  p_primary_activity text default null,
  p_activity_codes text[] default '{}',
  p_tax_registration_status text default 'UNKNOWN',
  p_vat_registration_status text default 'UNKNOWN',
  p_employee_count integer default 0,
  p_annual_revenue numeric default null,
  p_branch_count integer default 0,
  p_has_active_contracts boolean default false,
  p_contract_types text[] default '{}',
  p_pays_salaries boolean default false,
  p_custom_attributes jsonb default '{}'::jsonb
)
returns public.tenant_profile_versions
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  current_user_id uuid := auth.uid();
  current_profile public.tenant_profile_versions;
  saved_profile public.tenant_profile_versions;
begin
  if current_user_id is null
     or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'authenticated non-anonymous user required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.users where id = current_user_id) then
    raise exception 'user profile required' using errcode = '42501';
  end if;

  if not private.has_tenant_role(p_tenant_id, array['OWNER', 'ADMIN']) then
    raise exception 'tenant owner or admin role required' using errcode = '42501';
  end if;

  if p_valid_from is null or p_valid_from > pg_catalog.current_date then
    raise exception 'valid_from must be today or earlier' using errcode = '22023';
  end if;

  if p_employee_count < 0 or p_branch_count < 0
     or (p_annual_revenue is not null and p_annual_revenue < 0) then
    raise exception 'profile numeric values cannot be negative' using errcode = '22023';
  end if;

  if p_tax_registration_status not in ('UNKNOWN', 'NOT_REGISTERED', 'PENDING', 'REGISTERED')
     or p_vat_registration_status not in ('UNKNOWN', 'NOT_REQUIRED', 'PENDING', 'REGISTERED') then
    raise exception 'invalid registration status' using errcode = '22023';
  end if;

  if p_custom_attributes is null or pg_catalog.jsonb_typeof(p_custom_attributes) <> 'object' then
    raise exception 'custom_attributes must be a JSON object' using errcode = '22023';
  end if;

  perform 1 from public.tenants where id = p_tenant_id for update;
  if not found then
    raise exception 'tenant not found' using errcode = 'P0002';
  end if;

  select * into current_profile
  from public.tenant_profile_versions
  where tenant_id = p_tenant_id and valid_to is null
  for update;

  if found and p_valid_from < current_profile.valid_from then
    raise exception 'valid_from cannot precede the current profile version' using errcode = '22023';
  end if;

  if found and p_valid_from = current_profile.valid_from then
    update public.tenant_profile_versions
    set legal_form = pg_catalog.nullif(pg_catalog.btrim(p_legal_form), ''),
        primary_activity = pg_catalog.nullif(pg_catalog.btrim(p_primary_activity), ''),
        activity_codes = coalesce(p_activity_codes, '{}'),
        tax_registration_status = p_tax_registration_status,
        vat_registration_status = p_vat_registration_status,
        employee_count = p_employee_count,
        annual_revenue = p_annual_revenue,
        branch_count = p_branch_count,
        has_active_contracts = p_has_active_contracts,
        contract_types = coalesce(p_contract_types, '{}'),
        pays_salaries = p_pays_salaries,
        custom_attributes = p_custom_attributes
    where id = current_profile.id
    returning * into saved_profile;
  else
    if found then
      update public.tenant_profile_versions
      set valid_to = p_valid_from - 1
      where id = current_profile.id;
    end if;

    insert into public.tenant_profile_versions (
      tenant_id, valid_from, legal_form, primary_activity, activity_codes,
      tax_registration_status, vat_registration_status, employee_count,
      annual_revenue, branch_count, has_active_contracts, contract_types,
      pays_salaries, custom_attributes, created_by
    ) values (
      p_tenant_id, p_valid_from,
      pg_catalog.nullif(pg_catalog.btrim(p_legal_form), ''),
      pg_catalog.nullif(pg_catalog.btrim(p_primary_activity), ''),
      coalesce(p_activity_codes, '{}'),
      p_tax_registration_status, p_vat_registration_status, p_employee_count,
      p_annual_revenue, p_branch_count, p_has_active_contracts,
      coalesce(p_contract_types, '{}'), p_pays_salaries,
      p_custom_attributes, current_user_id
    ) returning * into saved_profile;
  end if;

  return saved_profile;
end;
$$;

revoke all on function public.save_tenant_profile(
  uuid, date, text, text, text[], text, text, integer, numeric, integer,
  boolean, text[], boolean, jsonb
) from public, anon, authenticated;
grant execute on function public.save_tenant_profile(
  uuid, date, text, text, text[], text, text, integer, numeric, integer,
  boolean, text[], boolean, jsonb
) to authenticated;

commit;
