begin;

create table public.eligibility_rule_sets (
  id uuid primary key default extensions.gen_random_uuid(),
  obligation_version_id uuid not null references public.obligation_versions(id) on delete cascade,
  priority integer not null constraint eligibility_rule_sets_priority_check check (priority > 0),
  title text not null constraint eligibility_rule_sets_title_check check (btrim(title) <> ''),
  outcome text not null
    constraint eligibility_rule_sets_outcome_check check (outcome in ('ELIGIBLE', 'NOT_ELIGIBLE', 'REVIEW')),
  explanation text not null constraint eligibility_rule_sets_explanation_check check (btrim(explanation) <> ''),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint eligibility_rule_sets_version_priority_key unique (obligation_version_id, priority)
);

create table public.eligibility_conditions (
  id uuid primary key default extensions.gen_random_uuid(),
  rule_set_id uuid not null references public.eligibility_rule_sets(id) on delete cascade,
  sequence integer not null constraint eligibility_conditions_sequence_check check (sequence > 0),
  fact_key text not null constraint eligibility_conditions_fact_key_check check (fact_key in (
    'ENTITY_TYPE', 'LEGAL_FORM', 'PRIMARY_ACTIVITY', 'ACTIVITY_CODES',
    'TAX_REGISTRATION_STATUS', 'VAT_REGISTRATION_STATUS', 'EMPLOYEE_COUNT',
    'ANNUAL_REVENUE', 'BRANCH_COUNT', 'HAS_ACTIVE_CONTRACTS', 'CONTRACT_TYPES',
    'PAYS_SALARIES'
  )),
  operator text not null constraint eligibility_conditions_operator_check check (operator in (
    'EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE', 'IN', 'CONTAINS',
    'IS_TRUE', 'IS_FALSE', 'IS_NULL', 'NOT_NULL'
  )),
  expected_value jsonb,
  created_at timestamptz not null default now(),
  constraint eligibility_conditions_rule_sequence_key unique (rule_set_id, sequence),
  constraint eligibility_conditions_expected_value_check check (
    operator in ('IS_TRUE', 'IS_FALSE', 'IS_NULL', 'NOT_NULL') or expected_value is not null
  )
);

create table public.eligibility_assessments (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  obligation_version_id uuid not null references public.obligation_versions(id) on delete restrict,
  profile_version_id uuid not null references public.tenant_profile_versions(id) on delete restrict,
  matched_rule_set_id uuid references public.eligibility_rule_sets(id) on delete restrict,
  outcome text not null
    constraint eligibility_assessments_outcome_check check (outcome in ('ELIGIBLE', 'NOT_ELIGIBLE', 'REVIEW')),
  explanation text not null,
  evaluated_by uuid not null references auth.users(id) on delete restrict,
  evaluated_at timestamptz not null default now(),
  constraint eligibility_assessments_input_key
    unique (tenant_id, obligation_version_id, profile_version_id)
);

create index eligibility_rule_sets_created_by_idx on public.eligibility_rule_sets(created_by);
create index eligibility_conditions_rule_set_id_idx on public.eligibility_conditions(rule_set_id);
create index eligibility_assessments_tenant_idx on public.eligibility_assessments(tenant_id, evaluated_at desc);
create index eligibility_assessments_obligation_version_idx on public.eligibility_assessments(obligation_version_id);
create index eligibility_assessments_profile_version_idx on public.eligibility_assessments(profile_version_id);
create index eligibility_assessments_rule_set_idx on public.eligibility_assessments(matched_rule_set_id)
  where matched_rule_set_id is not null;
create index eligibility_assessments_evaluated_by_idx on public.eligibility_assessments(evaluated_by);

create trigger eligibility_rule_sets_set_updated_at
  before update on public.eligibility_rule_sets
  for each row execute function public.set_updated_at();

create function public.protect_published_eligibility_rule_set()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  version_id uuid := case when tg_op = 'DELETE' then old.obligation_version_id else new.obligation_version_id end;
begin
  if exists (
    select 1 from public.obligation_versions
    where id = version_id and status = 'PUBLISHED'
  ) then
    raise exception 'eligibility rules of a published obligation version are immutable'
      using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.protect_published_eligibility_rule_set() from public, anon, authenticated, service_role;

create function public.protect_published_eligibility_condition()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  selected_rule_set_id uuid := case when tg_op = 'DELETE' then old.rule_set_id else new.rule_set_id end;
begin
  if exists (
    select 1
    from public.eligibility_rule_sets rs
    join public.obligation_versions ov on ov.id = rs.obligation_version_id
    where rs.id = selected_rule_set_id and ov.status = 'PUBLISHED'
  ) then
    raise exception 'eligibility conditions of a published obligation version are immutable'
      using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.protect_published_eligibility_condition() from public, anon, authenticated, service_role;

create trigger eligibility_rule_sets_protect_published
  before insert or update or delete on public.eligibility_rule_sets
  for each row execute function public.protect_published_eligibility_rule_set();
create trigger eligibility_conditions_protect_published
  before insert or update or delete on public.eligibility_conditions
  for each row execute function public.protect_published_eligibility_condition();

create function private.eligibility_condition_matches(
  tenant_data jsonb,
  profile_data jsonb,
  requested_fact_key text,
  requested_operator text,
  requested_expected_value jsonb
)
returns boolean
language plpgsql
stable
set search_path = pg_catalog
as $$
declare
  actual_value jsonb;
begin
  actual_value := case requested_fact_key
    when 'ENTITY_TYPE' then tenant_data -> 'entity_type'
    when 'LEGAL_FORM' then profile_data -> 'legal_form'
    when 'PRIMARY_ACTIVITY' then profile_data -> 'primary_activity'
    when 'ACTIVITY_CODES' then profile_data -> 'activity_codes'
    when 'TAX_REGISTRATION_STATUS' then profile_data -> 'tax_registration_status'
    when 'VAT_REGISTRATION_STATUS' then profile_data -> 'vat_registration_status'
    when 'EMPLOYEE_COUNT' then profile_data -> 'employee_count'
    when 'ANNUAL_REVENUE' then profile_data -> 'annual_revenue'
    when 'BRANCH_COUNT' then profile_data -> 'branch_count'
    when 'HAS_ACTIVE_CONTRACTS' then profile_data -> 'has_active_contracts'
    when 'CONTRACT_TYPES' then profile_data -> 'contract_types'
    when 'PAYS_SALARIES' then profile_data -> 'pays_salaries'
    else null
  end;

  if requested_operator = 'IS_NULL' then return actual_value is null or actual_value = 'null'::jsonb; end if;
  if requested_operator = 'NOT_NULL' then return actual_value is not null and actual_value <> 'null'::jsonb; end if;
  if actual_value is null or actual_value = 'null'::jsonb then return false; end if;
  if requested_operator = 'IS_TRUE' then return actual_value = 'true'::jsonb; end if;
  if requested_operator = 'IS_FALSE' then return actual_value = 'false'::jsonb; end if;
  if requested_operator = 'EQ' then return actual_value = requested_expected_value; end if;
  if requested_operator = 'NEQ' then return actual_value <> requested_expected_value; end if;
  if requested_operator = 'IN' then
    return jsonb_typeof(requested_expected_value) = 'array'
      and requested_expected_value @> jsonb_build_array(actual_value);
  end if;
  if requested_operator = 'CONTAINS' then
    return jsonb_typeof(actual_value) = 'array'
      and actual_value @> case
        when jsonb_typeof(requested_expected_value) = 'array' then requested_expected_value
        else jsonb_build_array(requested_expected_value)
      end;
  end if;
  if requested_operator in ('GT', 'GTE', 'LT', 'LTE') then
    if jsonb_typeof(actual_value) <> 'number' or jsonb_typeof(requested_expected_value) <> 'number' then
      return false;
    end if;
    return case requested_operator
      when 'GT' then (actual_value #>> '{}')::numeric > (requested_expected_value #>> '{}')::numeric
      when 'GTE' then (actual_value #>> '{}')::numeric >= (requested_expected_value #>> '{}')::numeric
      when 'LT' then (actual_value #>> '{}')::numeric < (requested_expected_value #>> '{}')::numeric
      when 'LTE' then (actual_value #>> '{}')::numeric <= (requested_expected_value #>> '{}')::numeric
    end;
  end if;
  return false;
end;
$$;
revoke all on function private.eligibility_condition_matches(jsonb, jsonb, text, text, jsonb)
  from public, anon, authenticated, service_role;

alter table public.eligibility_rule_sets enable row level security;
alter table public.eligibility_conditions enable row level security;
alter table public.eligibility_assessments enable row level security;

revoke all on table public.eligibility_rule_sets, public.eligibility_conditions, public.eligibility_assessments
  from public, anon, authenticated;
grant select, insert, delete on table public.eligibility_rule_sets, public.eligibility_conditions to authenticated;
grant update (priority, title, outcome, explanation) on table public.eligibility_rule_sets to authenticated;
grant update (sequence, fact_key, operator, expected_value) on table public.eligibility_conditions to authenticated;
grant select on table public.eligibility_assessments to authenticated;

create policy eligibility_rule_sets_read
on public.eligibility_rule_sets for select to authenticated
using (
  exists (select 1 from public.obligation_versions ov where ov.id = obligation_version_id and ov.status = 'PUBLISHED')
  or (select private.is_platform_admin())
);
create policy eligibility_rule_sets_admin_insert
on public.eligibility_rule_sets for insert to authenticated
with check ((select private.is_platform_admin()) and created_by = (select auth.uid()));
create policy eligibility_rule_sets_admin_update
on public.eligibility_rule_sets for update to authenticated
using ((select private.is_platform_admin())) with check ((select private.is_platform_admin()));
create policy eligibility_rule_sets_admin_delete
on public.eligibility_rule_sets for delete to authenticated using ((select private.is_platform_admin()));

create policy eligibility_conditions_read
on public.eligibility_conditions for select to authenticated
using (
  exists (
    select 1 from public.eligibility_rule_sets rs
    join public.obligation_versions ov on ov.id = rs.obligation_version_id
    where rs.id = rule_set_id and ov.status = 'PUBLISHED'
  ) or (select private.is_platform_admin())
);
create policy eligibility_conditions_admin_insert
on public.eligibility_conditions for insert to authenticated
with check ((select private.is_platform_admin()));
create policy eligibility_conditions_admin_update
on public.eligibility_conditions for update to authenticated
using ((select private.is_platform_admin())) with check ((select private.is_platform_admin()));
create policy eligibility_conditions_admin_delete
on public.eligibility_conditions for delete to authenticated using ((select private.is_platform_admin()));

create policy eligibility_assessments_select_member
on public.eligibility_assessments for select to authenticated
using (private.is_tenant_member(tenant_id));

create function public.evaluate_tenant_eligibility(requested_tenant_id uuid)
returns setof public.eligibility_assessments
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  current_user_id uuid := auth.uid();
  selected_tenant public.tenants;
  selected_profile public.tenant_profile_versions;
  version_record public.obligation_versions;
  matched_rule public.eligibility_rule_sets;
  saved_assessment public.eligibility_assessments;
  decision text;
  decision_explanation text;
begin
  if current_user_id is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'authenticated non-anonymous user required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.users where id = current_user_id) then
    raise exception 'user profile required' using errcode = '42501';
  end if;
  if not private.is_tenant_member(requested_tenant_id) then
    raise exception 'tenant membership required' using errcode = '42501';
  end if;

  select * into selected_tenant from public.tenants where id = requested_tenant_id;
  select * into selected_profile
  from public.tenant_profile_versions
  where tenant_id = requested_tenant_id and valid_to is null;
  if not found then
    raise exception 'current tenant profile required' using errcode = 'P0002';
  end if;

  for version_record in
    select distinct on (ov.obligation_id) ov.*
    from public.obligation_versions ov
    join public.obligations o on o.id = ov.obligation_id and o.is_active
    join public.obligation_families f on f.id = o.family_id and f.is_active
    where ov.status = 'PUBLISHED'
      and ov.effective_from <= current_date
      and (ov.effective_to is null or ov.effective_to >= current_date)
    order by ov.obligation_id, ov.effective_from desc, ov.version_number desc
  loop
    matched_rule := null;
    select rs.* into matched_rule
    from public.eligibility_rule_sets rs
    where rs.obligation_version_id = version_record.id
      and not exists (
        select 1 from public.eligibility_conditions c
        where c.rule_set_id = rs.id
          and not private.eligibility_condition_matches(
            to_jsonb(selected_tenant), to_jsonb(selected_profile),
            c.fact_key, c.operator, c.expected_value
          )
      )
    order by rs.priority
    limit 1;

    if matched_rule.id is null then
      decision := 'REVIEW';
      decision_explanation := 'اطلاعات موجود برای تشخیص قطعی کافی نیست و نیاز به بررسی دارد.';
    else
      decision := matched_rule.outcome;
      decision_explanation := matched_rule.explanation;
    end if;

    insert into public.eligibility_assessments (
      tenant_id, obligation_version_id, profile_version_id, matched_rule_set_id,
      outcome, explanation, evaluated_by
    ) values (
      requested_tenant_id, version_record.id, selected_profile.id, matched_rule.id,
      decision, decision_explanation, current_user_id
    )
    on conflict (tenant_id, obligation_version_id, profile_version_id)
    do update set matched_rule_set_id = excluded.matched_rule_set_id,
                  outcome = excluded.outcome,
                  explanation = excluded.explanation,
                  evaluated_by = excluded.evaluated_by,
                  evaluated_at = now()
    returning * into saved_assessment;

    return next saved_assessment;
  end loop;
  return;
end;
$$;
revoke all on function public.evaluate_tenant_eligibility(uuid) from public, anon, authenticated, service_role;
grant execute on function public.evaluate_tenant_eligibility(uuid) to authenticated;

commit;
