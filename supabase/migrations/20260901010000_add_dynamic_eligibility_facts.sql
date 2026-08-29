-- ==========================================================================
-- Migration: dynamic eligibility facts + AND/OR connectors
-- Date: 2026-09-01
-- Purpose: Eligibility facts are no longer a hardcoded whitelist. The Studio
--          rule editor now offers fields defined in the company-info designer
--          (company_field_definitions where used_in_eligibility), and rule
--          conditions can be combined with AND/OR connectors. The evaluation
--          engine resolves company-field facts from company_field_values and
--          keeps a legacy fallback so existing rules keep working.
-- ==========================================================================

begin;

-- --------------------------------------------------------------------------
-- 1. Facts are dynamic: drop the hardcoded fact_key whitelist.
-- --------------------------------------------------------------------------
alter table public.eligibility_conditions
  drop constraint if exists eligibility_conditions_fact_key_check;

-- --------------------------------------------------------------------------
-- 2. AND/OR connector: how this condition is joined with the previous one.
--    (Ignored for sequence = 1.)
-- --------------------------------------------------------------------------
alter table public.eligibility_conditions
  add column if not exists connector text not null default 'AND'
  constraint eligibility_conditions_connector_check check (connector in ('AND', 'OR'));

grant update (sequence, fact_key, operator, expected_value, connector)
  on table public.eligibility_conditions to authenticated;

-- --------------------------------------------------------------------------
-- 3. Validation: fact keys come from the company-info designer; legacy keys
--    keep their old rules so pre-existing rules remain valid.
-- --------------------------------------------------------------------------
create or replace function private.validate_eligibility_condition_definition(
  requested_fact_key text,
  requested_operator text,
  requested_expected_value jsonb
)
returns void
language plpgsql
stable
set search_path = pg_catalog
as $$
declare
  field_def public.company_field_definitions;
  field_type text;
  legacy_numeric boolean := requested_fact_key in ('EMPLOYEE_COUNT', 'ANNUAL_REVENUE', 'BRANCH_COUNT');
  legacy_boolean boolean := requested_fact_key in ('HAS_ACTIVE_CONTRACTS', 'PAYS_SALARIES');
  legacy_array boolean := requested_fact_key in ('ACTIVITY_CODES', 'CONTRACT_TYPES');
  legacy_text boolean := requested_fact_key in (
    'ENTITY_TYPE', 'LEGAL_FORM', 'PRIMARY_ACTIVITY',
    'TAX_REGISTRATION_STATUS', 'VAT_REGISTRATION_STATUS'
  );
begin
  select * into field_def
  from public.company_field_definitions
  where lower(key) = lower(requested_fact_key)
  limit 1;

  if not found then
    if not (legacy_numeric or legacy_boolean or legacy_array or legacy_text) then
      raise exception 'unsupported eligibility fact' using errcode = '22023';
    end if;
    field_type := case
      when legacy_numeric then 'NUMBER'
      when legacy_boolean then 'BOOLEAN'
      when legacy_array then 'MULTI_SELECT'
      else 'SELECT'
    end;
  else
    field_type := field_def.field_type;
  end if;

  if requested_operator in ('IS_NULL', 'NOT_NULL') then
    if requested_expected_value is not null then
      raise exception 'null-check operators do not accept an expected value' using errcode = '22023';
    end if;
    return;
  end if;

  if field_type = 'BOOLEAN' then
    if requested_operator not in ('IS_TRUE', 'IS_FALSE') or requested_expected_value is not null then
      raise exception 'boolean facts require IS_TRUE or IS_FALSE without a value' using errcode = '22023';
    end if;
  elsif field_type = 'NUMBER' then
    if requested_operator not in ('EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE')
       or jsonb_typeof(requested_expected_value) <> 'number' then
      raise exception 'numeric facts require a numeric comparison value' using errcode = '22023';
    end if;
  elsif field_type = 'MULTI_SELECT' then
    if requested_operator not in ('EQ', 'NEQ', 'IN', 'CONTAINS')
       or jsonb_typeof(requested_expected_value) not in ('string', 'array') then
      raise exception 'multi-select facts require EQ/NEQ text or IN/CONTAINS array' using errcode = '22023';
    end if;
  else
    -- SELECT / TEXT / LONG_TEXT / NATIONAL_ID / DATE
    if (requested_operator in ('EQ', 'NEQ') and jsonb_typeof(requested_expected_value) = 'string')
       or (requested_operator = 'IN' and jsonb_typeof(requested_expected_value) = 'array') then
      return;
    else
      raise exception 'text/select facts require EQ/NEQ text or IN array' using errcode = '22023';
    end if;
  end if;
end;
$$;

revoke all on function private.validate_eligibility_condition_definition(text, text, jsonb)
  from public, anon, authenticated, service_role;

-- --------------------------------------------------------------------------
-- 4. Matcher: resolve company-field facts from company_field_values; legacy
--    facts keep resolving from the profile JSON so old rules still evaluate.
-- --------------------------------------------------------------------------
drop function if exists private.eligibility_condition_matches(jsonb, jsonb, text, text, jsonb);

create or replace function private.eligibility_condition_matches(
  requested_tenant_id uuid,
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
  field_def public.company_field_definitions;
  stored_value text;
  actual_value jsonb;
begin
  select * into field_def
  from public.company_field_definitions
  where lower(key) = lower(requested_fact_key)
  limit 1;

  if found and requested_tenant_id is not null then
    select value into stored_value
    from public.company_field_values
    where tenant_id = requested_tenant_id and field_id = field_def.id
    limit 1;

    if stored_value is null or pg_catalog.btrim(stored_value) = '' then
      actual_value := null;
    elsif field_def.field_type = 'NUMBER' then
      actual_value := (pg_catalog.btrim(stored_value))::numeric::text::jsonb;
    elsif field_def.field_type = 'BOOLEAN' then
      actual_value := (lower(pg_catalog.btrim(stored_value)) in ('true', '1', 'yes', 'on', 'بله'))::text::jsonb;
    elsif field_def.field_type = 'MULTI_SELECT' then
      actual_value := to_jsonb(string_to_array(stored_value, ','));
    else
      actual_value := to_jsonb(pg_catalog.btrim(stored_value));
    end if;
  else
    -- Legacy facts (pre company-info-designer) resolve from the profile JSON.
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
  end if;

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

revoke all on function private.eligibility_condition_matches(uuid, jsonb, jsonb, text, text, jsonb)
  from public, anon, authenticated, service_role;

-- --------------------------------------------------------------------------
-- 5. Evaluator: fold conditions with AND/OR connectors per rule set.
-- --------------------------------------------------------------------------
create or replace function public.evaluate_tenant_eligibility(requested_tenant_id uuid)
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
  candidate_rule public.eligibility_rule_sets;
  condition_record public.eligibility_conditions;
  saved_assessment public.eligibility_assessments;
  decision text;
  decision_explanation text;
  rule_result boolean;
  condition_result boolean;
  first_condition boolean;
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
    decision := 'REVIEW';
    decision_explanation := 'اطلاعات موجود برای تشخیص قطعی کافی نیست و نیاز به بررسی دارد.';

    for candidate_rule in
      select rs.*
      from public.eligibility_rule_sets rs
      where rs.obligation_version_id = version_record.id
      order by rs.priority
    loop
      rule_result := true;
      first_condition := true;
      for condition_record in
        select c.*
        from public.eligibility_conditions c
        where c.rule_set_id = candidate_rule.id
        order by c.sequence
      loop
        condition_result := private.eligibility_condition_matches(
          requested_tenant_id,
          to_jsonb(selected_tenant),
          to_jsonb(selected_profile),
          condition_record.fact_key,
          condition_record.operator,
          condition_record.expected_value
        );
        if first_condition then
          rule_result := condition_result;
          first_condition := false;
        elsif condition_record.connector = 'OR' then
          rule_result := rule_result or condition_result;
        else
          rule_result := rule_result and condition_result;
        end if;
      end loop;

      if rule_result then
        decision := candidate_rule.outcome;
        decision_explanation := candidate_rule.explanation;
        insert into public.eligibility_assessments (
          tenant_id, obligation_version_id, profile_version_id, matched_rule_set_id,
          outcome, explanation, evaluated_by
        ) values (
          requested_tenant_id, version_record.id, selected_profile.id, candidate_rule.id,
          decision, decision_explanation, current_user_id
        )
        on conflict (tenant_id, obligation_version_id, profile_version_id)
        do update set matched_rule_set_id = excluded.matched_rule_set_id,
                      outcome = excluded.outcome,
                      explanation = excluded.explanation,
                      evaluated_by = excluded.evaluated_by,
                      evaluated_at = now()
        returning * into saved_assessment;
        exit;
      end if;
    end loop;

    if decision = 'REVIEW' then
      insert into public.eligibility_assessments (
        tenant_id, obligation_version_id, profile_version_id, matched_rule_set_id,
        outcome, explanation, evaluated_by
      ) values (
        requested_tenant_id, version_record.id, selected_profile.id, null,
        decision, decision_explanation, current_user_id
      )
      on conflict (tenant_id, obligation_version_id, profile_version_id)
      do update set matched_rule_set_id = null,
                    outcome = excluded.outcome,
                    explanation = excluded.explanation,
                    evaluated_by = excluded.evaluated_by,
                    evaluated_at = now()
      returning * into saved_assessment;
    end if;

    return next saved_assessment;
  end loop;
  return;
end;
$$;

revoke all on function public.evaluate_tenant_eligibility(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.evaluate_tenant_eligibility(uuid)
  to authenticated;

commit;
