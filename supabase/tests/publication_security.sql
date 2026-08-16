-- Behavioral regression test for publication and penalty mutation boundaries.
-- Disposable local Supabase only. Every fixture is rolled back.
-- Run after all migrations with psql ON_ERROR_STOP enabled.

begin;

insert into auth.users (
  id, aud, role, email, phone, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, is_sso_user, is_anonymous
) values
  ('91000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'publication-owner@example.invalid', '+989100000001', '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, false),
  ('91000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'publication-admin@example.invalid', '+989100000002', '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, false),
  ('91000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'publication-member@example.invalid', '+989100000003', '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, false),
  ('91000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'publication-outsider@example.invalid', '+989100000004', '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, false),
  ('91000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'publication-platform-admin@example.invalid', '+989100000005', '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, false);

update public.users
set role = 'PLATFORM_ADMIN'
where id = '91000000-0000-0000-0000-000000000005';

insert into public.tenants (id, name, entity_type, created_by)
values
  ('92000000-0000-0000-0000-000000000001', 'Publication Security Tenant A', 'حقوقی', '91000000-0000-0000-0000-000000000001'),
  ('92000000-0000-0000-0000-000000000002', 'Publication Security Tenant B', 'حقوقی', '91000000-0000-0000-0000-000000000004');

insert into public.user_tenants (user_id, tenant_id, role)
values
  ('91000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000001', 'OWNER'),
  ('91000000-0000-0000-0000-000000000002', '92000000-0000-0000-0000-000000000001', 'ADMIN'),
  ('91000000-0000-0000-0000-000000000003', '92000000-0000-0000-0000-000000000001', 'MEMBER'),
  ('91000000-0000-0000-0000-000000000004', '92000000-0000-0000-0000-000000000002', 'OWNER');

insert into public.tenant_profile_versions (
  id, tenant_id, valid_from, legal_form, created_by
) values (
  '99000000-0000-0000-0000-000000000001',
  '92000000-0000-0000-0000-000000000001',
  current_date,
  'شرکت آزمایشی',
  '91000000-0000-0000-0000-000000000001'
);

insert into public.obligation_families (
  id, code, domain, title, created_by
) values (
  '93000000-0000-0000-0000-000000000001',
  'SECURITY_TEST_TAX',
  'TAX',
  'خانواده آزمایشی امنیت انتشار',
  '91000000-0000-0000-0000-000000000005'
);

insert into public.obligations (
  id, family_id, code, title, created_by
) values (
  '94000000-0000-0000-0000-000000000001',
  '93000000-0000-0000-0000-000000000001',
  'SECURITY_TEST_OBLIGATION',
  'تعهد آزمایشی امنیت انتشار',
  '91000000-0000-0000-0000-000000000005'
);

insert into public.obligation_versions (
  id, obligation_id, version_number, status, legal_reference, source_url,
  effective_from, recurrence_rule, deadline_rule, penalty_rule, created_by
) values
  (
    '95000000-0000-0000-0000-000000000001',
    '94000000-0000-0000-0000-000000000001',
    1, 'DRAFT', 'مرجع قانونی آزمایشی',
    'https://example.invalid/official-source', current_date,
    '{}'::jsonb, '{}'::jsonb,
    '{"type":"FIXED","amount":10000}'::jsonb,
    '91000000-0000-0000-0000-000000000005'
  ),
  (
    '95000000-0000-0000-0000-000000000002',
    '94000000-0000-0000-0000-000000000001',
    2, 'DRAFT', null, null, null,
    '{}'::jsonb, '{}'::jsonb, '{"type":"NONE"}'::jsonb,
    '91000000-0000-0000-0000-000000000005'
  );

insert into public.eligibility_rule_sets (
  id, obligation_version_id, priority, title, outcome, explanation, created_by
) values (
  '96000000-0000-0000-0000-000000000001',
  '95000000-0000-0000-0000-000000000001',
  1, 'قاعده آزمایشی', 'ELIGIBLE',
  'برای آزمون امنیت انتشار مشمول است.',
  '91000000-0000-0000-0000-000000000005'
);

insert into public.workflow_templates (
  id, obligation_version_id, title, created_by
) values (
  '97000000-0000-0000-0000-000000000001',
  '95000000-0000-0000-0000-000000000001',
  'فرایند آزمایشی',
  '91000000-0000-0000-0000-000000000005'
);

insert into public.workflow_steps (
  id, workflow_template_id, sequence, code, title, actor, form_schema
) values (
  '98000000-0000-0000-0000-000000000001',
  '97000000-0000-0000-0000-000000000001',
  1, 'SECURITY_TEST_STEP', 'مرحله آزمایشی', 'USER',
  '{"fields":[]}'::jsonb
);

insert into public.eligibility_assessments (
  id, tenant_id, obligation_version_id, profile_version_id,
  matched_rule_set_id, outcome, explanation, evaluated_by
) values (
  '9a000000-0000-0000-0000-000000000001',
  '92000000-0000-0000-0000-000000000001',
  '95000000-0000-0000-0000-000000000001',
  '99000000-0000-0000-0000-000000000001',
  '96000000-0000-0000-0000-000000000001',
  'ELIGIBLE', 'ارزیابی آزمایشی',
  '91000000-0000-0000-0000-000000000005'
);

insert into public.compliance_cases (
  id, tenant_id, obligation_version_id, assessment_id,
  workflow_template_id, period_key, status, current_step_id
) values (
  '9b000000-0000-0000-0000-000000000001',
  '92000000-0000-0000-0000-000000000001',
  '95000000-0000-0000-0000-000000000001',
  '9a000000-0000-0000-0000-000000000001',
  '97000000-0000-0000-0000-000000000001',
  'SECURITY-TEST-2026', 'IN_PROGRESS',
  '98000000-0000-0000-0000-000000000001'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000005', true);
select set_config('request.jwt.claims', '{"sub":"91000000-0000-0000-0000-000000000005","role":"authenticated","is_anonymous":false}', true);

-- Non-publication lifecycle transitions remain available only through the RPC.
select public.transition_obligation_version_status(
  '95000000-0000-0000-0000-000000000002', 'REVIEW'
);
select public.transition_obligation_version_status(
  '95000000-0000-0000-0000-000000000002', 'TESTING'
);
do $$
begin
  begin
    perform public.transition_obligation_version_status(
      '95000000-0000-0000-0000-000000000002', 'PUBLISHED'
    );
    raise exception 'review transition RPC bypassed publication validation';
  exception when invalid_parameter_value then
    null;
  end;
end
$$;
select public.transition_obligation_version_status(
  '95000000-0000-0000-0000-000000000002', 'REVIEW'
);
select public.transition_obligation_version_status(
  '95000000-0000-0000-0000-000000000002', 'DRAFT'
);

-- Direct publication must fail even for a platform admin.
do $$
begin
  begin
    update public.obligation_versions
    set status = 'PUBLISHED',
        published_by = '91000000-0000-0000-0000-000000000005',
        published_at = now()
    where id = '95000000-0000-0000-0000-000000000001';
    raise exception 'platform admin bypassed publish_obligation_version';
  exception when insufficient_privilege then
    null;
  end;
end
$$;

-- The guarded RPC rejects an incomplete definition and publishes a valid one.
do $$
begin
  begin
    perform public.publish_obligation_version(
      '95000000-0000-0000-0000-000000000002'
    );
    raise exception 'publication RPC accepted an invalid obligation version';
  exception when invalid_parameter_value then
    null;
  end;
end
$$;
select public.publish_obligation_version(
  '95000000-0000-0000-0000-000000000001'
);
reset role;

do $$
begin
  if not exists (
    select 1 from public.obligation_versions
    where id = '95000000-0000-0000-0000-000000000001'
      and status = 'PUBLISHED'
      and published_by = '91000000-0000-0000-0000-000000000005'
      and published_at is not null
  ) then
    raise exception 'validated obligation publication RPC did not publish';
  end if;
end
$$;

insert into public.legal_circulars (
  id, obligation_version_id, title, circular_number, source_url,
  issued_on, summary, status, created_by
) values (
  '9c000000-0000-0000-0000-000000000001',
  '95000000-0000-0000-0000-000000000001',
  'بخشنامه آزمایشی امنیت انتشار', 'SEC-TEST-1',
  'https://example.invalid/official-circular', current_date,
  'خلاصه آزمایشی بخشنامه', 'DRAFT',
  '91000000-0000-0000-0000-000000000005'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000005', true);
select set_config('request.jwt.claims', '{"sub":"91000000-0000-0000-0000-000000000005","role":"authenticated","is_anonymous":false}', true);

do $$
begin
  begin
    update public.legal_circulars
    set status = 'PUBLISHED',
        published_by = '91000000-0000-0000-0000-000000000005',
        published_at = now()
    where id = '9c000000-0000-0000-0000-000000000001';
    raise exception 'platform admin bypassed publish_circular_and_notify';
  exception when insufficient_privilege then
    null;
  end;
end
$$;

do $$
declare inserted_count integer;
begin
  select public.publish_circular_and_notify(
    '9c000000-0000-0000-0000-000000000001',
    '/panel/dashboard'
  ) into inserted_count;
  if inserted_count <> 3 then
    raise exception 'circular RPC created % notifications instead of 3', inserted_count;
  end if;
end
$$;
reset role;

-- MEMBER must be denied.
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"91000000-0000-0000-0000-000000000003","role":"authenticated","is_anonymous":false}', true);
do $$
begin
  begin
    perform public.estimate_case_penalty(
      '9b000000-0000-0000-0000-000000000001',
      100000, date '2026-08-16', 0, 0
    );
    raise exception 'tenant MEMBER changed a shared penalty estimate';
  exception when insufficient_privilege then
    null;
  end;
end
$$;
reset role;

-- OWNER succeeds and explicit null adjustments fail validation.
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false}', true);
select public.estimate_case_penalty(
  '9b000000-0000-0000-0000-000000000001',
  100000, date '2026-08-17', 0, 0
);
do $$
begin
  begin
    perform public.estimate_case_penalty(
      '9b000000-0000-0000-0000-000000000001',
      100000, date '2026-08-21', null, 0
    );
    raise exception 'null penalty adjustment was accepted';
  exception when invalid_parameter_value then
    null;
  end;
end
$$;
reset role;

-- ADMIN succeeds.
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"91000000-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":false}', true);
select public.estimate_case_penalty(
  '9b000000-0000-0000-0000-000000000001',
  100000, date '2026-08-18', 0, 0
);
reset role;

-- PLATFORM_ADMIN succeeds without tenant membership.
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000005', true);
select set_config('request.jwt.claims', '{"sub":"91000000-0000-0000-0000-000000000005","role":"authenticated","is_anonymous":false}', true);
select public.estimate_case_penalty(
  '9b000000-0000-0000-0000-000000000001',
  100000, date '2026-08-19', 0, 0
);
reset role;

-- Owner of another tenant is a cross-tenant outsider and must fail.
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000004', true);
select set_config('request.jwt.claims', '{"sub":"91000000-0000-0000-0000-000000000004","role":"authenticated","is_anonymous":false}', true);
do $$
begin
  begin
    perform public.estimate_case_penalty(
      '9b000000-0000-0000-0000-000000000001',
      100000, date '2026-08-20', 0, 0
    );
    raise exception 'cross-tenant owner changed another tenant penalty estimate';
  exception when insufficient_privilege then
    null;
  end;
end
$$;
reset role;

do $$
begin
  if (
    select count(*) from public.notifications
    where circular_id = '9c000000-0000-0000-0000-000000000001'
  ) <> 3 then
    raise exception 'circular publication did not persist exactly 3 notifications';
  end if;

  if (
    select count(*) from public.penalty_estimates
    where case_id = '9b000000-0000-0000-0000-000000000001'
  ) <> 3 then
    raise exception 'unexpected number of successful penalty estimates';
  end if;

  if exists (
    select 1 from public.penalty_estimates
    where case_id = '9b000000-0000-0000-0000-000000000001'
      and estimated_amount <> 10000
  ) then
    raise exception 'penalty estimate result is incorrect';
  end if;

  if has_column_privilege('authenticated', 'public.obligation_versions', 'status', 'UPDATE')
     or has_column_privilege('authenticated', 'public.legal_circulars', 'status', 'UPDATE') then
    raise exception 'sensitive publication columns are directly writable';
  end if;

  if has_function_privilege('anon', 'public.publish_obligation_version(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.publish_circular_and_notify(uuid,text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.estimate_case_penalty(uuid,numeric,date,numeric,numeric)', 'EXECUTE') then
    raise exception 'anon can execute a sensitive compliance RPC';
  end if;
end
$$;

rollback;

do $$
begin
  if exists (
    select 1 from auth.users
    where email like 'publication-%@example.invalid'
  ) or exists (
    select 1 from public.tenants
    where id in (
      '92000000-0000-0000-0000-000000000001',
      '92000000-0000-0000-0000-000000000002'
    )
  ) then
    raise exception 'publication security fixtures were not rolled back';
  end if;
end
$$;

select 'publication_security_behavior_ok' as security_regression_result;
