-- Behavioral regression test for deadline/circular integrity boundaries.
-- Disposable local Supabase only. Every fixture is rolled back.

begin;

insert into auth.users (
  id, aud, role, email, phone, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, is_sso_user, is_anonymous
) values
  ('a1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'integrity-platform@example.invalid', '+989110000001', '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, false),
  ('a1000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'integrity-stale@example.invalid', '+989110000002', '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, false),
  ('a1000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'integrity-current@example.invalid', '+989110000003', '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, false);

update public.users
set role = 'PLATFORM_ADMIN'
where id = 'a1000000-0000-0000-0000-000000000001';

insert into public.tenants (id, name, entity_type, created_by) values
  ('a2000000-0000-0000-0000-000000000001', 'Stale assessment tenant', 'حقوقی', 'a1000000-0000-0000-0000-000000000002'),
  ('a2000000-0000-0000-0000-000000000002', 'Current eligible tenant', 'حقوقی', 'a1000000-0000-0000-0000-000000000003');

insert into public.user_tenants (user_id, tenant_id, role) values
  ('a1000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000001', 'OWNER'),
  ('a1000000-0000-0000-0000-000000000003', 'a2000000-0000-0000-0000-000000000002', 'OWNER');

insert into public.tenant_profile_versions (
  id, tenant_id, valid_from, valid_to, legal_form, created_by
) values
  ('a3000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', current_date - 2, current_date - 1, 'قدیمی', 'a1000000-0000-0000-0000-000000000002'),
  ('a3000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000001', current_date, null, 'فعلی', 'a1000000-0000-0000-0000-000000000002'),
  ('a3000000-0000-0000-0000-000000000003', 'a2000000-0000-0000-0000-000000000002', current_date, null, 'فعلی', 'a1000000-0000-0000-0000-000000000003');

insert into public.obligation_families (id, code, domain, title, created_by)
values ('a4000000-0000-0000-0000-000000000001', 'INTEGRITY_TEST', 'TAX', 'Integrity test family', 'a1000000-0000-0000-0000-000000000001');

insert into public.obligations (id, family_id, code, title, created_by) values
  ('a5000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001', 'INTEGRITY_PRIMARY', 'Primary integrity obligation', 'a1000000-0000-0000-0000-000000000001'),
  ('a5000000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000001', 'INTEGRITY_OTHER', 'Other integrity obligation', 'a1000000-0000-0000-0000-000000000001');

insert into public.obligation_versions (
  id, obligation_id, version_number, status, legal_reference, source_url,
  effective_from, penalty_rule, created_by
) values
  ('a6000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000001', 1, 'DRAFT', 'test', 'https://example.invalid/primary', current_date, '{"type":"NONE"}', 'a1000000-0000-0000-0000-000000000001'),
  ('a6000000-0000-0000-0000-000000000002', 'a5000000-0000-0000-0000-000000000002', 1, 'DRAFT', 'test', 'https://example.invalid/other', current_date, '{"type":"NONE"}', 'a1000000-0000-0000-0000-000000000001');

insert into public.workflow_templates (id, obligation_version_id, title, created_by)
values ('a7000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000001', 'Integrity workflow', 'a1000000-0000-0000-0000-000000000001');

insert into public.workflow_steps (
  id, workflow_template_id, sequence, code, title, actor, form_schema
) values
  ('a8000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000001', 1, 'INTEGRITY_STEP_ONE', 'Step one', 'USER', '{"fields":[]}'),
  ('a8000000-0000-0000-0000-000000000002', 'a7000000-0000-0000-0000-000000000001', 2, 'INTEGRITY_STEP_TWO', 'Step two', 'USER', '{"fields":[]}');

-- Tests may create complete published fixtures directly as the database owner.
update public.obligation_versions
set status = 'PUBLISHED',
    published_by = 'a1000000-0000-0000-0000-000000000001',
    published_at = now()
where id in (
  'a6000000-0000-0000-0000-000000000001',
  'a6000000-0000-0000-0000-000000000002'
);

insert into public.eligibility_assessments (
  id, tenant_id, obligation_version_id, profile_version_id,
  outcome, explanation, evaluated_by, evaluated_at
) values
  ('a9000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'ELIGIBLE', 'Historical result only', 'a1000000-0000-0000-0000-000000000001', now() - interval '1 day'),
  ('a9000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000002', 'NOT_ELIGIBLE', 'Current result excludes tenant', 'a1000000-0000-0000-0000-000000000001', now()),
  ('a9000000-0000-0000-0000-000000000003', 'a2000000-0000-0000-0000-000000000002', 'a6000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000003', 'ELIGIBLE', 'Current result includes tenant', 'a1000000-0000-0000-0000-000000000001', now());

insert into public.compliance_cases (
  id, tenant_id, obligation_version_id, assessment_id,
  workflow_template_id, period_key, status, current_step_id
) values (
  'aa000000-0000-0000-0000-000000000001',
  'a2000000-0000-0000-0000-000000000002',
  'a6000000-0000-0000-0000-000000000001',
  'a9000000-0000-0000-0000-000000000003',
  'a7000000-0000-0000-0000-000000000001',
  'INTEGRITY-2026', 'IN_PROGRESS',
  'a8000000-0000-0000-0000-000000000001'
);

insert into public.legal_circulars (
  id, obligation_version_id, title, source_url, issued_on, summary,
  status, created_by, published_by, published_at
) values
  ('ab000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000001', 'Matching published circular', 'https://example.invalid/matching', current_date, 'Matches the case version', 'PUBLISHED', 'a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', now()),
  ('ab000000-0000-0000-0000-000000000002', 'a6000000-0000-0000-0000-000000000002', 'Mismatched published circular', 'https://example.invalid/mismatch', current_date, 'Must not alter primary case', 'PUBLISHED', 'a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', now()),
  ('ab000000-0000-0000-0000-000000000003', 'a6000000-0000-0000-0000-000000000001', 'Targeted draft circular', 'https://example.invalid/targeted', current_date, 'Only current eligible tenants receive this', 'DRAFT', 'a1000000-0000-0000-0000-000000000001', null, null);

-- A tenant owner is authenticated but is not allowed to administer deadlines.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000003","role":"authenticated","is_anonymous":false}', true);
do $denied$
begin
  begin
    perform public.set_case_deadline(
      'aa000000-0000-0000-0000-000000000001',
      'a8000000-0000-0000-0000-000000000001',
      'ORIGINAL', now() + interval '10 days', null, 'denied'
    );
    raise exception 'tenant owner administered a case deadline';
  exception when insufficient_privilege then null;
  end;
end
$denied$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false}', true);

-- A circular for another obligation version cannot modify this case deadline.
do $mismatch$
begin
  begin
    perform public.set_case_deadline(
      'aa000000-0000-0000-0000-000000000001',
      'a8000000-0000-0000-0000-000000000001',
      'EXTENSION', now() + interval '20 days',
      'ab000000-0000-0000-0000-000000000002', 'wrong obligation'
    );
    raise exception 'mismatched circular changed a case deadline';
  exception when invalid_parameter_value then null;
  end;
end
$mismatch$;

-- Matching extensions remain valid.
select public.set_case_deadline(
  'aa000000-0000-0000-0000-000000000001',
  'a8000000-0000-0000-0000-000000000001',
  'EXTENSION', now() + interval '20 days',
  'ab000000-0000-0000-0000-000000000001', 'valid extension'
);

-- Exactly one ORIGINAL is allowed for each explicit step.
select public.set_case_deadline(
  'aa000000-0000-0000-0000-000000000001',
  'a8000000-0000-0000-0000-000000000001',
  'ORIGINAL', now() + interval '10 days', null, 'step baseline'
);
do $duplicate_step$
begin
  begin
    perform public.set_case_deadline(
      'aa000000-0000-0000-0000-000000000001',
      'a8000000-0000-0000-0000-000000000001',
      'ORIGINAL', now() + interval '11 days', null, 'duplicate'
    );
    raise exception 'duplicate step ORIGINAL deadline was accepted';
  exception when unique_violation then null;
  end;
end
$duplicate_step$;

-- A different step has its own baseline.
select public.set_case_deadline(
  'aa000000-0000-0000-0000-000000000001',
  'a8000000-0000-0000-0000-000000000002',
  'ORIGINAL', now() + interval '12 days', null, 'other step baseline'
);

-- NULL workflow_step_id is a case-level baseline and must also be unique.
select public.set_case_deadline(
  'aa000000-0000-0000-0000-000000000001', null,
  'ORIGINAL', now() + interval '9 days', null, 'case baseline'
);
do $duplicate_case$
begin
  begin
    perform public.set_case_deadline(
      'aa000000-0000-0000-0000-000000000001', null,
      'ORIGINAL', now() + interval '8 days', null, 'duplicate case baseline'
    );
    raise exception 'duplicate case-level ORIGINAL deadline was accepted';
  exception when unique_violation then null;
  end;
end
$duplicate_case$;

do $targeting$
declare
  created_count integer;
begin
  select public.publish_circular_and_notify(
    'ab000000-0000-0000-0000-000000000003', '/panel/dashboard'
  ) into created_count;

  if created_count <> 1 then
    raise exception 'current-profile targeting created % notifications instead of 1', created_count;
  end if;
end
$targeting$;
reset role;

do $assertions$
begin
  if exists (
    select 1 from public.notifications
    where circular_id = 'ab000000-0000-0000-0000-000000000003'
      and tenant_id = 'a2000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'historical ELIGIBLE assessment received a circular notification';
  end if;

  if not exists (
    select 1 from public.notifications
    where circular_id = 'ab000000-0000-0000-0000-000000000003'
      and tenant_id = 'a2000000-0000-0000-0000-000000000002'
      and user_id = 'a1000000-0000-0000-0000-000000000003'
  ) then
    raise exception 'current ELIGIBLE assessment did not receive a circular notification';
  end if;

  if has_function_privilege(
    'anon',
    'public.set_case_deadline(uuid,uuid,text,timestamptz,uuid,text)',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.publish_circular_and_notify(uuid,text)',
    'EXECUTE'
  ) then
    raise exception 'anonymous role received an integrity RPC execute grant';
  end if;
end
$assertions$;

rollback;

do $cleanup$
begin
  if exists (
    select 1 from auth.users
    where id between 'a1000000-0000-0000-0000-000000000001'::uuid
                 and 'abffffff-ffff-ffff-ffff-ffffffffffff'::uuid
  ) then
    raise exception 'deadline/circular integrity fixtures escaped rollback';
  end if;
end
$cleanup$;
