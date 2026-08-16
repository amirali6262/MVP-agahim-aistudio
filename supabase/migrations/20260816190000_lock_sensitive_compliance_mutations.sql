begin;

-- Publication must only happen through the validated SECURITY DEFINER RPCs.
-- Platform admins can continue editing draft content directly, but the three
-- publication-control columns are no longer writable through the Data API.
revoke update (status, published_by, published_at)
  on table public.obligation_versions
  from authenticated;

revoke update (status, published_by, published_at)
  on table public.legal_circulars
  from authenticated;

-- Keep the non-publication review lifecycle usable without restoring direct
-- write access to the status column. Publication remains a separate validated RPC.
create function public.transition_obligation_version_status(
  requested_version_id uuid,
  requested_status text
)
returns public.obligation_versions
language plpgsql
security definer
set search_path = pg_catalog
as $
declare
  uid uuid := auth.uid();
  selected_version public.obligation_versions;
begin
  if uid is null
     or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
     or not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;

  if requested_status not in ('DRAFT', 'REVIEW', 'TESTING') then
    raise exception 'publication requires publish_obligation_version'
      using errcode = '22023';
  end if;

  select *
  into selected_version
  from public.obligation_versions
  where id = requested_version_id
  for update;

  if selected_version.id is null then
    raise exception 'obligation version not found' using errcode = 'P0002';
  end if;

  if selected_version.status = 'PUBLISHED' then
    raise exception 'published obligation versions are immutable'
      using errcode = '23514';
  end if;

  if selected_version.status = requested_status then
    return selected_version;
  end if;

  if not (
    (selected_version.status = 'DRAFT' and requested_status = 'REVIEW')
    or (selected_version.status = 'REVIEW' and requested_status in ('DRAFT', 'TESTING'))
    or (selected_version.status = 'TESTING' and requested_status = 'REVIEW')
  ) then
    raise exception 'invalid obligation review status transition'
      using errcode = '22023';
  end if;

  update public.obligation_versions
  set status = requested_status
  where id = selected_version.id
  returning * into selected_version;

  return selected_version;
end;
$;

revoke all on function public.transition_obligation_version_status(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.transition_obligation_version_status(uuid, text)
  to authenticated;

-- A penalty estimate changes shared compliance reporting. Restrict this write
-- boundary to tenant owners/admins and platform admins instead of every member.
create or replace function public.estimate_case_penalty(
  requested_case_id uuid,
  requested_base_amount numeric,
  requested_as_of date default current_date,
  requested_waived_amount numeric default 0,
  requested_paid_amount numeric default 0
)
returns public.penalty_estimates
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  uid uuid := auth.uid();
  selected_case public.compliance_cases;
  selected_deadline public.case_deadlines;
  rule jsonb;
  rule_type text;
  rate numeric;
  fixed_amount numeric;
  cap_amount numeric;
  late_days integer;
  gross numeric;
  net numeric;
  saved public.penalty_estimates;
begin
  if uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select *
  into selected_case
  from public.compliance_cases
  where id = requested_case_id;

  if selected_case.id is null then
    raise exception 'case not found' using errcode = 'P0002';
  end if;

  if not private.is_platform_admin()
     and not exists (
       select 1
       from public.user_tenants membership
       where membership.tenant_id = selected_case.tenant_id
         and membership.user_id = uid
         and membership.role in ('OWNER', 'ADMIN')
     ) then
    raise exception 'tenant owner or admin required' using errcode = '42501';
  end if;

  if requested_base_amount is null
     or requested_base_amount < 0
     or requested_as_of is null
     or requested_waived_amount is null
     or requested_waived_amount < 0
     or requested_paid_amount is null
     or requested_paid_amount < 0 then
    raise exception 'non-negative amounts and calculation date required'
      using errcode = '22023';
  end if;

  select *
  into selected_deadline
  from public.case_deadlines
  where case_id = selected_case.id
  order by due_at desc
  limit 1;

  select penalty_rule
  into rule
  from public.obligation_versions
  where id = selected_case.obligation_version_id;

  rule_type := coalesce(rule ->> 'type', 'NONE');

  if rule_type not in ('NONE', 'FIXED', 'PERCENTAGE', 'DAILY_PERCENTAGE') then
    raise exception 'unsupported penalty rule type' using errcode = '22023';
  end if;

  if rule_type = 'FIXED'
     and (jsonb_typeof(rule -> 'amount') <> 'number' or (rule ->> 'amount')::numeric < 0) then
    raise exception 'fixed penalty requires a non-negative numeric amount'
      using errcode = '22023';
  end if;

  if rule_type in ('PERCENTAGE', 'DAILY_PERCENTAGE')
     and (jsonb_typeof(rule -> 'rate_percent') <> 'number'
          or (rule ->> 'rate_percent')::numeric < 0) then
    raise exception 'percentage penalty requires a non-negative numeric rate_percent'
      using errcode = '22023';
  end if;

  if rule ? 'cap_amount'
     and (jsonb_typeof(rule -> 'cap_amount') <> 'number'
          or (rule ->> 'cap_amount')::numeric < 0) then
    raise exception 'penalty cap_amount must be a non-negative number'
      using errcode = '22023';
  end if;

  if rule_type = 'DAILY_PERCENTAGE' and selected_deadline.id is null then
    raise exception 'a deadline is required for a daily penalty estimate'
      using errcode = 'P0002';
  end if;

  rate := coalesce((rule ->> 'rate_percent')::numeric, 0);
  fixed_amount := coalesce((rule ->> 'amount')::numeric, 0);
  cap_amount := (rule ->> 'cap_amount')::numeric;
  late_days := case
    when selected_deadline.id is null then 0
    else greatest(requested_as_of - selected_deadline.due_at::date, 0)
  end;

  gross := case rule_type
    when 'FIXED' then fixed_amount
    when 'PERCENTAGE' then requested_base_amount * rate / 100
    when 'DAILY_PERCENTAGE' then requested_base_amount * rate / 100 * late_days
    else 0
  end;

  if cap_amount is not null then
    gross := least(gross, cap_amount);
  end if;

  gross := round(greatest(gross, 0));
  net := greatest(gross - requested_waived_amount - requested_paid_amount, 0);

  insert into public.penalty_estimates (
    case_id,
    obligation_version_id,
    deadline_id,
    base_amount,
    days_late,
    gross_amount,
    waived_amount,
    paid_amount,
    estimated_amount,
    calculation_rule,
    calculated_as_of,
    calculated_by
  )
  values (
    selected_case.id,
    selected_case.obligation_version_id,
    selected_deadline.id,
    requested_base_amount,
    late_days,
    gross,
    requested_waived_amount,
    requested_paid_amount,
    net,
    rule,
    requested_as_of,
    uid
  )
  on conflict (case_id, calculated_as_of)
  do update set
    deadline_id = excluded.deadline_id,
    base_amount = excluded.base_amount,
    days_late = excluded.days_late,
    gross_amount = excluded.gross_amount,
    waived_amount = excluded.waived_amount,
    paid_amount = excluded.paid_amount,
    estimated_amount = excluded.estimated_amount,
    calculation_rule = excluded.calculation_rule,
    calculated_by = excluded.calculated_by,
    created_at = now()
  returning * into saved;

  return saved;
end;
$$;

revoke all on function public.estimate_case_penalty(uuid, numeric, date, numeric, numeric)
  from public, anon, authenticated, service_role;
grant execute on function public.estimate_case_penalty(uuid, numeric, date, numeric, numeric)
  to authenticated;

-- Fail the migration if a future grant accidentally leaves either publication
-- path directly writable by the authenticated Data API role.
do $$
begin
  if has_column_privilege('authenticated', 'public.obligation_versions', 'status', 'UPDATE')
     or has_column_privilege('authenticated', 'public.obligation_versions', 'published_by', 'UPDATE')
     or has_column_privilege('authenticated', 'public.obligation_versions', 'published_at', 'UPDATE') then
    raise exception 'obligation publication columns remain directly writable';
  end if;

  if has_column_privilege('authenticated', 'public.legal_circulars', 'status', 'UPDATE')
     or has_column_privilege('authenticated', 'public.legal_circulars', 'published_by', 'UPDATE')
     or has_column_privilege('authenticated', 'public.legal_circulars', 'published_at', 'UPDATE') then
    raise exception 'circular publication columns remain directly writable';
  end if;

  if not has_column_privilege('authenticated', 'public.obligation_versions', 'legal_reference', 'UPDATE')
     or not has_column_privilege('authenticated', 'public.legal_circulars', 'title', 'UPDATE') then
    raise exception 'draft editing grants were removed unexpectedly';
  end if;
end;
$$;

comment on function public.estimate_case_penalty(uuid, numeric, date, numeric, numeric)
  is 'Creates a non-authoritative penalty estimate; restricted to tenant owners/admins and platform admins.';

commit;
