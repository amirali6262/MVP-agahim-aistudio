-- ==========================================================================
-- Behavioral regression test for:
--   1. Dynamic eligibility facts (facts come from company_field_definitions),
--      AND/OR connectors and the rewritten evaluator.
--   2. delete_obligation_cascade (platform-admin cascade delete RPC).
-- Disposable local Supabase only. Every fixture is rolled back.
-- Run after all migrations with psql ON_ERROR_STOP enabled.
-- ==========================================================================

begin;

insert into auth.users (
  id, aud, role, email, phone, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, is_sso_user, is_anonymous
) values
  ('97000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'dynfact-owner@example.invalid', '+989700000001', '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, false),
  ('97000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'dynfact-admin@example.invalid', '+989700000005', '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, false);

update public.users
set role = 'PLATFORM_ADMIN'
where id = '97000000-0000-0000-0000-000000000005';

insert into public.tenants (id, name, entity_type, created_by)
values ('97000000-0000-0000-0000-000000000010', 'Dynamic Fact Tenant', 'حقوقی', '97000000-0000-0000-0000-000000000001');

insert into public.user_tenants (user_id, tenant_id, role)
values ('97000000-0000-0000-0000-000000000001', '97000000-0000-0000-0000-000000000010', 'OWNER');

insert into public.tenant_profile_versions (id, tenant_id, valid_from, created_by)
values ('97000000-0000-0000-0000-000000000011', '97000000-0000-0000-0000-000000000010', current_date, '97000000-0000-0000-0000-000000000001');

-- Company-info designer fields that act as eligibility facts (published, active,
-- flagged used_in_eligibility), plus options and per-company values.
insert into public.company_field_definitions (
  id, key, title, field_type, required, section, sort_order,
  is_active, is_system, is_deletable, used_in_eligibility, status
) values
  ('97000000-0000-0000-0000-000000000020', 'dyn_person_type', 'نوع شخصیت', 'SELECT', true, 'INITIAL', 1, true, true, false, true, 'PUBLISHED'),
  ('97000000-0000-0000-0000-000000000021', 'dyn_annual_revenue', 'فروش سالانه', 'NUMBER', false, 'COMPLEMENTARY', 2, true, false, true, true, 'PUBLISHED'),
  ('97000000-0000-0000-0000-000000000022', 'dyn_has_active_contracts', 'قرارداد فعال', 'BOOLEAN', false, 'COMPLEMENTARY', 3, true, false, true, true, 'PUBLISHED');

insert into public.company_field_options (id, field_id, value, label, sort_order, is_active)
values
  ('97000000-0000-0000-0000-000000000030', '97000000-0000-0000-0000-000000000020', 'natural_person', 'حقیقی', 1, true),
  ('97000000-0000-0000-0000-000000000031', '97000000-0000-0000-0000-000000000020', 'legal_entity', 'حقوقی', 2, true);

insert into public.company_field_values (id, tenant_id, field_id, value, recorded_by)
values
  ('97000000-0000-0000-0000-000000000040', '97000000-0000-0000-0000-000000000010', '97000000-0000-0000-0000-000000000020', 'legal_entity', '97000000-0000-0000-0000-000000000001'),
  ('97000000-0000-0000-0000-000000000041', '97000000-0000-0000-0000-000000000010', '97000000-0000-0000-0000-000000000021', '1500', '97000000-0000-0000-0000-000000000001'),
  ('97000000-0000-0000-0000-000000000042', '97000000-0000-0000-0000-000000000010', '97000000-0000-0000-0000-000000000022', 'true', '97000000-0000-0000-0000-000000000001');

-- Obligation fixtures (version stays DRAFT so rules can be defined).
insert into public.obligation_families (id, code, domain, title, created_by)
values ('97000000-0000-0000-0000-000000000050', 'DYN_FACT_TAX', 'TAX', 'خانواده فکت داینامیک', '97000000-0000-0000-0000-000000000005');

insert into public.obligations (id, family_id, code, title, created_by)
values ('97000000-0000-0000-0000-000000000051', '97000000-0000-0000-0000-000000000050', 'DYN_FACT_OBLIGATION', 'تعهد فکت داینامیک', '97000000-0000-0000-0000-000000000005');

insert into public.obligation_versions (
  id, obligation_id, version_number, status, legal_reference, source_url,
  effective_from, recurrence_rule, deadline_rule, penalty_rule, created_by
) values (
  '97000000-0000-0000-0000-000000000052',
  '97000000-0000-0000-0000-000000000051',
  1, 'DRAFT', 'مرجع قانونی آزمایشی فکت داینامیک',
  'https://example.invalid/source', current_date,
  '{}'::jsonb, '{}'::jsonb, '{"type":"NONE"}'::jsonb,
  '97000000-0000-0000-0000-000000000005'
);

insert into public.eligibility_rule_sets (
  id, obligation_version_id, priority, title, outcome, explanation, created_by
) values
  ('97000000-0000-0000-0000-000000000060', '97000000-0000-0000-0000-000000000052', 1, 'قانونی با فروش بالا', 'ELIGIBLE', 'توضیح قاعده ۱', '97000000-0000-0000-0000-000000000005'),
  ('97000000-0000-0000-0000-000000000061', '97000000-0000-0000-0000-000000000052', 2, 'یا قرارداد فعال', 'ELIGIBLE', 'توضیح قاعده ۲', '97000000-0000-0000-0000-000000000005'),
  ('97000000-0000-0000-0000-000000000062', '97000000-0000-0000-0000-000000000052', 3, 'حقیقی غیرمشمول', 'NOT_ELIGIBLE', 'توضیح قاعده ۳', '97000000-0000-0000-0000-000000000005'),
  ('97000000-0000-0000-0000-000000000063', '97000000-0000-0000-0000-000000000052', 4, 'قاعده اعتبارسنجی', 'ELIGIBLE', 'توضیح قاعده ۴', '97000000-0000-0000-0000-000000000005');

-- Conditions for the evaluation scenarios.
-- Rule 1 (AND): dyn_person_type EQ legal_entity AND dyn_annual_revenue GTE 1000
-- Rule 2 (OR):  dyn_person_type EQ natural_person OR dyn_has_active_contracts IS_TRUE
-- Rule 3:       dyn_person_type EQ natural_person
insert into public.eligibility_conditions (
  id, rule_set_id, sequence, fact_key, operator, expected_value, connector
) values
  ('97000000-0000-0000-0000-000000000070', '97000000-0000-0000-0000-000000000060', 1, 'dyn_person_type', 'EQ', '"legal_entity"', 'AND'),
  ('97000000-0000-0000-0000-000000000071', '97000000-0000-0000-0000-000000000060', 2, 'dyn_annual_revenue', 'GTE', '1000', 'AND'),
  ('97000000-0000-0000-0000-000000000072', '97000000-0000-0000-0000-000000000061', 1, 'dyn_person_type', 'EQ', '"natural_person"', 'AND'),
  ('97000000-0000-0000-0000-000000000073', '97000000-0000-0000-0000-000000000061', 2, 'dyn_has_active_contracts', 'IS_TRUE', null, 'OR'),
  ('97000000-0000-0000-0000-000000000074', '97000000-0000-0000-0000-000000000062', 1, 'dyn_person_type', 'EQ', '"natural_person"', 'AND');

-- ── Validator behaviour ─────────────────────────────────────────────────────
-- New designer fact keys are accepted.
insert into public.eligibility_conditions (rule_set_id, sequence, fact_key, operator, expected_value)
values ('97000000-0000-0000-0000-000000000063', 1, 'dyn_person_type', 'IN', '["legal_entity","natural_person"]'::jsonb);

-- Legacy (pre-designer) fact keys stay valid so existing rules keep working.
insert into public.eligibility_conditions (rule_set_id, sequence, fact_key, operator, expected_value)
values ('97000000-0000-0000-0000-000000000063', 2, 'ENTITY_TYPE', 'EQ', '"حقوقی"');

-- Unknown fact keys are rejected.
do $$
begin
  begin
    insert into public.eligibility_conditions (rule_set_id, sequence, fact_key, operator, expected_value)
    values ('97000000-0000-0000-0000-000000000063', 3, 'totally_unknown_fact', 'EQ', '"x"');
    raise exception 'unknown fact key was accepted';
  exception when others then
    if sqlerrm like '%unsupported eligibility fact%' then
      null;
    else
      raise;
    end if;
  end;
end
$$;

-- Invalid connector values are rejected by the column constraint.
do $$
begin
  begin
    insert into public.eligibility_conditions (rule_set_id, sequence, fact_key, operator, expected_value, connector)
    values ('97000000-0000-0000-0000-000000000063', 4, 'dyn_person_type', 'EQ', '"legal_entity"', 'XOR');
    raise exception 'invalid connector was accepted';
  exception when others then
    if sqlerrm like '%eligibility_conditions_connector_check%' then
      null;
    else
      raise;
    end if;
  end;
end
$$;

-- NUMBER facts require a numeric expected value.
do $$
begin
  begin
    insert into public.eligibility_conditions (rule_set_id, sequence, fact_key, operator, expected_value)
    values ('97000000-0000-0000-0000-000000000063', 5, 'dyn_annual_revenue', 'GTE', '"1500"');
    raise exception 'string expected value for NUMBER fact was accepted';
  exception when others then
    if sqlerrm like '%numeric facts require a numeric comparison value%' then
      null;
    else
      raise;
    end if;
  end;
end
$$;

-- Null-check operators must not carry a value.
do $$
begin
  begin
    insert into public.eligibility_conditions (rule_set_id, sequence, fact_key, operator, expected_value)
    values ('97000000-0000-0000-0000-000000000063', 6, 'dyn_person_type', 'IS_NULL', '"x"');
    raise exception 'null-check operator with a value was accepted';
  exception when others then
    if sqlerrm like '%null-check operators do not accept an expected value%' then
      null;
    else
      raise;
    end if;
  end;
end
$$;

select 'eligibility_validator_ok' as eligibility_validator_result;

-- ── Evaluator: publish the version and run the engine ───────────────────────
insert into public.workflow_templates (id, obligation_version_id, title, created_by)
values ('97000000-0000-0000-0000-000000000080', '97000000-0000-0000-0000-000000000052', 'قالب آزمایشی فکت داینامیک', '97000000-0000-0000-0000-000000000005');

insert into public.workflow_steps (id, workflow_template_id, sequence, code, title, actor, instructions, form_schema)
values (
  '97000000-0000-0000-0000-000000000081',
  '97000000-0000-0000-0000-000000000080',
  1, 'DYN_FACT_STEP', 'گام آزمایشی', 'USER', 'توضیح گام',
  '{"fields":[]}'::jsonb
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '97000000-0000-0000-0000-000000000005', true);
select set_config('request.jwt.claims', '{"sub":"97000000-0000-0000-0000-000000000005","role":"authenticated","is_anonymous":false}', true);

do $$
declare v public.obligation_versions;
begin
  select * into v from public.transition_obligation_version_status('97000000-0000-0000-0000-000000000052', 'REVIEW');
  if v.status <> 'REVIEW' then raise exception 'transition to REVIEW failed'; end if;
  select * into v from public.transition_obligation_version_status('97000000-0000-0000-0000-000000000052', 'TESTING');
  if v.status <> 'TESTING' then raise exception 'transition to TESTING failed'; end if;
  select * into v from public.publish_obligation_version('97000000-0000-0000-0000-000000000052');
  if v.status <> 'PUBLISHED' then raise exception 'publish failed'; end if;
end
$$;
reset role;

-- Evaluate as the tenant owner. Tenant values: legal_entity + revenue 1500 +
-- dyn_has_active_contracts true  →  rule 1 (AND) matches  →  ELIGIBLE.
set local role authenticated;
select set_config('request.jwt.claim.sub', '97000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"97000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false}', true);

do $$
declare
  assessment public.eligibility_assessments;
begin
  select * into assessment
  from public.evaluate_tenant_eligibility('97000000-0000-0000-0000-000000000010')
  where obligation_version_id = '97000000-0000-0000-0000-000000000052';

  if assessment.outcome <> 'ELIGIBLE' then
    raise exception 'expected ELIGIBLE via rule 1 (AND), got %', assessment.outcome;
  end if;
  if assessment.matched_rule_set_id <> '97000000-0000-0000-0000-000000000060' then
    raise exception 'expected match on rule 1 (AND)';
  end if;
end
$$;

-- Lower revenue below the threshold: rule 1 (AND) must fail, rule 2 (OR) must
-- match through dyn_has_active_contracts = true.
update public.company_field_values
set value = '100', updated_at = now()
where id = '97000000-0000-0000-0000-000000000041';

do $$
declare
  assessment public.eligibility_assessments;
begin
  select * into assessment
  from public.evaluate_tenant_eligibility('97000000-0000-0000-0000-000000000010')
  where obligation_version_id = '97000000-0000-0000-0000-000000000052';

  if assessment.outcome <> 'ELIGIBLE' then
    raise exception 'expected ELIGIBLE via rule 2 (OR), got %', assessment.outcome;
  end if;
  if assessment.matched_rule_set_id <> '97000000-0000-0000-0000-000000000061' then
    raise exception 'expected match on rule 2 (OR)';
  end if;
end
$$;

-- Legacy fact: ENTITY_TYPE EQ 'حقوقی' still resolves from the tenants table.
-- (Inserting a new condition into a PUBLISHED version is intentionally blocked
-- by the immutability trigger, so only the matcher itself is exercised here.
-- The private helper is not executable by authenticated roles, so this check
-- runs as the test superuser.)
reset role;
do $$
declare
  legacy_match boolean;
begin
  legacy_match := private.eligibility_condition_matches(
    '97000000-0000-0000-0000-000000000010',
    to_jsonb((select t from public.tenants t where t.id = '97000000-0000-0000-0000-000000000010')),
    '{}'::jsonb,
    'ENTITY_TYPE', 'EQ', '"حقوقی"'::jsonb
  );
  if not legacy_match then
    raise exception 'legacy ENTITY_TYPE fact did not match';
  end if;
end
$$;
reset role;

select 'eligibility_evaluator_ok' as eligibility_evaluator_result;

-- ── delete_obligation_cascade ───────────────────────────────────────────────
-- Non-admin (tenant owner) must be denied.
set local role authenticated;
select set_config('request.jwt.claim.sub', '97000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"97000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false}', true);

do $$
begin
  begin
    perform public.delete_obligation_cascade('97000000-0000-0000-0000-000000000051');
    raise exception 'tenant owner was allowed to delete an obligation';
  exception when others then
    if sqlerrm like '%platform admin required%' then
      null;
    else
      raise;
    end if;
  end;
end
$$;
reset role;

-- Fixtures for the delete path: a second obligation with a DRAFT version and
-- soft references (fulfillments, extensions, menu drafts).
insert into public.obligations (id, family_id, code, title, created_by)
values ('97000000-0000-0000-0000-000000000090', '97000000-0000-0000-0000-000000000050', 'DYN_DELETE_OBLIGATION', 'تعهد قابل حذف', '97000000-0000-0000-0000-000000000005');

insert into public.obligation_versions (
  id, obligation_id, version_number, status, legal_reference, source_url,
  effective_from, recurrence_rule, deadline_rule, penalty_rule, created_by
) values (
  '97000000-0000-0000-0000-000000000091',
  '97000000-0000-0000-0000-000000000090',
  1, 'DRAFT', 'مرجع قانونی آزمایشی حذف', 'https://example.invalid/source', current_date,
  '{}'::jsonb, '{}'::jsonb, '{"type":"NONE"}'::jsonb,
  '97000000-0000-0000-0000-000000000005'
);

insert into public.eligibility_rule_sets (
  id, obligation_version_id, priority, title, outcome, explanation, created_by
) values (
  '97000000-0000-0000-0000-000000000092', '97000000-0000-0000-0000-000000000091',
  1, 'قاعده حذف', 'ELIGIBLE', 'توضیح', '97000000-0000-0000-0000-000000000005'
);

insert into public.eligibility_conditions (id, rule_set_id, sequence, fact_key, operator, expected_value)
values ('97000000-0000-0000-0000-000000000093', '97000000-0000-0000-0000-000000000092', 1, 'dyn_person_type', 'EQ', '"legal_entity"');

insert into public.tenant_obligation_fulfillments (id, tenant_id, obligation_id, status)
values ('97000000-0000-0000-0000-000000000094', '97000000-0000-0000-0000-000000000010', '97000000-0000-0000-0000-000000000090', 'PENDING');

insert into public.deadline_extensions (
  id, obligation_id, obligation_title, fiscal_year, extension_type,
  old_deadline, new_deadline, reason, status
) values (
  '97000000-0000-0000-0000-000000000095', '97000000-0000-0000-0000-000000000090',
  'تعهد قابل حذف', '۱۴۰۴', 'TEST', '۱۴۰۴/۰۶/۳۱', '۱۴۰۴/۰۷/۱۵', 'آزمایشی', 'PENDING'
);

-- A published/retired version must block deletion even for a platform admin.
insert into public.obligations (id, family_id, code, title, created_by)
values ('97000000-0000-0000-0000-000000000096', '97000000-0000-0000-0000-000000000050', 'DYN_LOCKED_OBLIGATION', 'تعهد قفل‌شده', '97000000-0000-0000-0000-000000000005');

insert into public.obligation_versions (
  id, obligation_id, version_number, status, legal_reference, source_url,
  effective_from, recurrence_rule, deadline_rule, penalty_rule, created_by
) values (
  '97000000-0000-0000-0000-000000000097',
  '97000000-0000-0000-0000-000000000096',
  1, 'PUBLISHED', 'مرجع قانونی آزمایشی قفل', 'https://example.invalid/source', current_date,
  '{}'::jsonb, '{}'::jsonb, '{"type":"NONE"}'::jsonb,
  '97000000-0000-0000-0000-000000000005'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '97000000-0000-0000-0000-000000000005', true);
select set_config('request.jwt.claims', '{"sub":"97000000-0000-0000-0000-000000000005","role":"authenticated","is_anonymous":false}', true);

-- Published version blocks the cascade delete.
do $$
begin
  begin
    perform public.delete_obligation_cascade('97000000-0000-0000-0000-000000000096');
    raise exception 'delete with a published version was allowed';
  exception when others then
    if sqlerrm like '%published or retired versions%' then
      null;
    else
      raise;
    end if;
  end;
end
$$;

-- Successful cascade delete of a DRAFT obligation with soft references.
do $$
begin
  perform public.delete_obligation_cascade('97000000-0000-0000-0000-000000000090');
  if exists (select 1 from public.obligations where id = '97000000-0000-0000-0000-000000000090') then
    raise exception 'obligation row still exists after cascade delete';
  end if;
  if exists (select 1 from public.obligation_versions where id = '97000000-0000-0000-0000-000000000091') then
    raise exception 'obligation version still exists after cascade delete';
  end if;
  if exists (select 1 from public.eligibility_rule_sets where id = '97000000-0000-0000-0000-000000000092') then
    raise exception 'rule set still exists after cascade delete';
  end if;
  if exists (select 1 from public.eligibility_conditions where id = '97000000-0000-0000-0000-000000000093') then
    raise exception 'condition still exists after cascade delete';
  end if;
  if exists (select 1 from public.tenant_obligation_fulfillments where id = '97000000-0000-0000-0000-000000000094') then
    raise exception 'fulfillment still exists after cascade delete';
  end if;
  if exists (select 1 from public.deadline_extensions where id = '97000000-0000-0000-0000-000000000095') then
    raise exception 'deadline extension still exists after cascade delete';
  end if;
end
$$;
reset role;

-- ── Rollback guard ──────────────────────────────────────────────────────────
do $$
begin
  if exists (
    select 1 from auth.users
    where email like 'dynfact-%@example.invalid'
  ) or exists (
    select 1 from public.tenants
    where id = '97000000-0000-0000-0000-000000000010'
  ) then
    raise exception 'dynamic fact fixtures were not rolled back';
  end if;
end
$$;

select 'eligibility_dynamic_facts_and_delete_ok' as eligibility_regression_result;

rollback;
