-- Behavioral regression test for case-opening and USER-task authorization.
-- Disposable local Supabase only. Every fixture is rolled back.

begin;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, is_sso_user, is_anonymous
) values
  ('a1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'case-owner@example.invalid', '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, false),
  ('a1000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'case-admin@example.invalid', '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, false),
  ('a1000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'case-member@example.invalid', '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, false),
  ('a1000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'case-outsider@example.invalid', '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, false),
  ('a1000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'case-platform-admin@example.invalid', '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, false);

update public.users
set role = 'PLATFORM_ADMIN'
where id = 'a1000000-0000-0000-0000-000000000005';

insert into public.tenants (id, name, entity_type, created_by) values
  ('a2000000-0000-0000-0000-000000000001', 'Case authorization tenant A', 'حقوقی', 'a1000000-0000-0000-0000-000000000001'),
  ('a2000000-0000-0000-0000-000000000002', 'Case authorization tenant B', 'حقوقی', 'a1000000-0000-0000-0000-000000000004');

insert into public.user_tenants (user_id, tenant_id, role) values
  ('a1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'OWNER'),
  ('a1000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000001', 'ADMIN'),
  ('a1000000-0000-0000-0000-000000000003', 'a2000000-0000-0000-0000-000000000001', 'MEMBER'),
  ('a1000000-0000-0000-0000-000000000004', 'a2000000-0000-0000-0000-000000000002', 'OWNER');

insert into public.tenant_profile_versions (
  id, tenant_id, valid_from, legal_form, created_by
) values (
  'a3000000-0000-0000-0000-000000000001',
  'a2000000-0000-0000-0000-000000000001',
  current_date, 'شرکت آزمایشی',
  'a1000000-0000-0000-0000-000000000001'
);

insert into public.obligation_families (id, code, domain, title, created_by)
values (
  'a4000000-0000-0000-0000-000000000001', 'CASE_AUTH_TEST', 'TAX',
  'خانواده آزمون مجوز پرونده', 'a1000000-0000-0000-0000-000000000005'
);

insert into public.obligations (id, family_id, code, title, created_by)
values (
  'a5000000-0000-0000-0000-000000000001',
  'a4000000-0000-0000-0000-000000000001', 'CASE_AUTH_OBLIGATION',
  'تعهد آزمون مجوز پرونده', 'a1000000-0000-0000-0000-000000000005'
);

insert into public.obligation_versions (
  id, obligation_id, version_number, status, legal_reference, source_url,
  effective_from, recurrence_rule, deadline_rule, penalty_rule, created_by
) values (
  'a6000000-0000-0000-0000-000000000001',
  'a5000000-0000-0000-0000-000000000001', 1, 'DRAFT',
  'مرجع آزمون', 'https://example.invalid/case-authorization', current_date,
  '{}'::jsonb, '{}'::jsonb, '{"type":"NONE"}'::jsonb,
  'a1000000-0000-0000-0000-000000000005'
);

insert into public.eligibility_rule_sets (
  id, obligation_version_id, priority, title, outcome, explanation, created_by
) values (
  'a7000000-0000-0000-0000-000000000001',
  'a6000000-0000-0000-0000-000000000001', 1,
  'قاعده آزمون', 'ELIGIBLE', 'مشمول برای آزمون مجوز پرونده',
  'a1000000-0000-0000-0000-000000000005'
);

insert into public.workflow_templates (id, obligation_version_id, title, created_by)
values (
  'a8000000-0000-0000-0000-000000000001',
  'a6000000-0000-0000-0000-000000000001',
  'فرایند آزمون مجوز پرونده', 'a1000000-0000-0000-0000-000000000005'
);

insert into public.workflow_steps (
  id, workflow_template_id, sequence, code, title, actor, form_schema
) values (
  'a9000000-0000-0000-0000-000000000001',
  'a8000000-0000-0000-0000-000000000001', 1, 'CASE_AUTH_USER_STEP',
  'مرحله کاربر', 'USER', '{"fields":[]}'::jsonb
);

insert into public.workflow_transitions (
  id, workflow_template_id, from_step_id, code, title, trigger_type,
  terminal_status, outcome_code
) values (
  'ab000000-0000-0000-0000-000000000001',
  'a8000000-0000-0000-0000-000000000001',
  'a9000000-0000-0000-0000-000000000001',
  'CASE_AUTH_COMPLETE', 'تکمیل آزمون', 'USER_ACTION', 'COMPLETED', 'COMPLETED'
);

insert into public.eligibility_assessments (
  id, tenant_id, obligation_version_id, profile_version_id,
  matched_rule_set_id, outcome, explanation, evaluated_by
) values (
  'aa000000-0000-0000-0000-000000000001',
  'a2000000-0000-0000-0000-000000000001',
  'a6000000-0000-0000-0000-000000000001',
  'a3000000-0000-0000-0000-000000000001',
  'a7000000-0000-0000-0000-000000000001',
  'ELIGIBLE', 'ارزیابی آزمون مجوز پرونده',
  'a1000000-0000-0000-0000-000000000005'
);

-- MEMBER cannot create shared case state.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000003","role":"authenticated","is_anonymous":false}', true);
do $member_open$
begin
  begin
    perform public.open_eligible_cases(
      'a2000000-0000-0000-0000-000000000001', 'MEMBER-DENIED'
    );
    raise exception 'MEMBER opened eligible cases';
  exception when insufficient_privilege then
    null;
  end;
end;
$member_open$;
reset role;

-- An OWNER of another tenant is still an outsider for tenant A.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-000000000004', true);
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000004","role":"authenticated","is_anonymous":false}', true);
do $outsider_open$
begin
  begin
    perform public.open_eligible_cases(
      'a2000000-0000-0000-0000-000000000001', 'OUTSIDER-DENIED'
    );
    raise exception 'cross-tenant OWNER opened eligible cases';
  exception when insufficient_privilege then
    null;
  end;
end;
$outsider_open$;
reset role;

-- OWNER and ADMIN each open a separate period successfully.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false}', true);
select public.open_eligible_cases(
  'a2000000-0000-0000-0000-000000000001', 'OWNER-ALLOWED'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":false}', true);
select public.open_eligible_cases(
  'a2000000-0000-0000-0000-000000000001', 'ADMIN-ALLOWED'
);
reset role;

-- Preserve explicit task identifiers before switching to callers whose RLS
-- visibility intentionally hides those rows.
select set_config(
  'case_auth_test.admin_task_id',
  (
    select task.id::text
    from public.case_tasks task
    join public.compliance_cases compliance_case on compliance_case.id = task.case_id
    where compliance_case.period_key = 'ADMIN-ALLOWED'
  ),
  true
);
select set_config(
  'case_auth_test.owner_task_id',
  (
    select task.id::text
    from public.case_tasks task
    join public.compliance_cases compliance_case on compliance_case.id = task.case_id
    where compliance_case.period_key = 'OWNER-ALLOWED'
  ),
  true
);

-- MEMBER cannot complete the active USER task created for the admin period.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000003","role":"authenticated","is_anonymous":false}', true);
do $member_complete$
begin
  begin
    perform public.complete_case_task(
      current_setting('case_auth_test.admin_task_id')::uuid,
      'ab000000-0000-0000-0000-000000000001'::uuid,
      '{}'::jsonb
    );
    raise exception 'MEMBER completed a USER task';
  exception when insufficient_privilege then
    null;
  end;
end;
$member_complete$;
reset role;

-- Cross-tenant OWNER cannot complete tenant A's USER task.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-000000000004', true);
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000004","role":"authenticated","is_anonymous":false}', true);
do $outsider_complete$
begin
  begin
    perform public.complete_case_task(
      current_setting('case_auth_test.admin_task_id')::uuid,
      'ab000000-0000-0000-0000-000000000001'::uuid,
      '{}'::jsonb
    );
    raise exception 'cross-tenant OWNER completed a USER task';
  exception when insufficient_privilege then
    null;
  end;
end;
$outsider_complete$;
reset role;

-- ADMIN completes one USER task and OWNER completes the other.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":false}', true);
select public.complete_case_task(
  current_setting('case_auth_test.admin_task_id')::uuid,
  'ab000000-0000-0000-0000-000000000001'::uuid,
  '{}'::jsonb
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false}', true);
select public.complete_case_task(
  current_setting('case_auth_test.owner_task_id')::uuid,
  'ab000000-0000-0000-0000-000000000001'::uuid,
  '{}'::jsonb
);
reset role;

do $assertions$
begin
  if exists (
    select 1 from public.compliance_cases
    where period_key in ('MEMBER-DENIED', 'OUTSIDER-DENIED')
  ) then
    raise exception 'denied caller left a compliance case behind';
  end if;

  if (
    select count(*) from public.compliance_cases
    where period_key in ('OWNER-ALLOWED', 'ADMIN-ALLOWED')
      and status = 'COMPLETED'
      and closed_at is not null
  ) <> 2 then
    raise exception 'OWNER/ADMIN USER-task completion result is incorrect';
  end if;

  if not exists (
    select 1
    from public.case_tasks task
    join public.compliance_cases compliance_case on compliance_case.id = task.case_id
    where compliance_case.period_key = 'OWNER-ALLOWED'
      and task.completed_by = 'a1000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'OWNER task completion was not recorded';
  end if;

  if not exists (
    select 1
    from public.case_tasks task
    join public.compliance_cases compliance_case on compliance_case.id = task.case_id
    where compliance_case.period_key = 'ADMIN-ALLOWED'
      and task.completed_by = 'a1000000-0000-0000-0000-000000000002'
  ) then
    raise exception 'ADMIN task completion was not recorded';
  end if;

  if has_function_privilege(
    'anon', 'public.open_eligible_cases(uuid,text)', 'EXECUTE'
  ) or has_function_privilege(
    'anon', 'public.complete_case_task(uuid,uuid,jsonb)', 'EXECUTE'
  ) then
    raise exception 'anonymous role can execute case mutation RPCs';
  end if;
end;
$assertions$;

rollback;

select
  count(*) filter (where id::text like 'a1%') as leftover_users,
  (select count(*) from public.tenants where id::text like 'a2%') as leftover_tenants,
  (select count(*) from public.compliance_cases where period_key like '%-ALLOWED') as leftover_cases
from public.users;
