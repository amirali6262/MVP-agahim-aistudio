-- ==========================================================================
-- Integration test: central system key registry
-- Run only against a development Supabase project (transaction + rollback).
-- Covers: pattern check, DB-level UNIQUE, published/locked key protection,
--         RLS (platform-admin only) — both read and write.
-- ==========================================================================
begin;

-- ── Fixtures: one platform admin + one regular user ────────────────────────
insert into auth.users (id, aud, role, email, phone, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous)
values
  ('f1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'sk-admin@example.invalid',  '+980000000001', '{}', '{}', now(), now(), false, false),
  ('f1000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'sk-user@example.invalid',   '+980000000002', '{}', '{}', now(), now(), false, false);

do $$ begin
  if (select count(*) from public.users where id in ('f1000000-0000-0000-0000-000000000001','f1000000-0000-0000-0000-000000000002')) <> 2 then
    raise exception 'register trigger did not create profiles';
  end if;
end $$;

update public.users set role = 'PLATFORM_ADMIN' where id = 'f1000000-0000-0000-0000-000000000001';

-- ── As platform admin: key pattern + uniqueness + lock ─────────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

-- 1) a valid namespaced key is accepted
insert into public.system_key_registry (full_key, title_fa, entity_type, module, status)
values ('company_profile.field.test_ownership', 'نوع مالکیت (تست)', 'FIELD', 'company_profile', 'DRAFT');

-- 2) duplicate full_key must be rejected by the DB UNIQUE index
do $$
begin
  insert into public.system_key_registry (full_key, title_fa, entity_type, module, status)
  values ('company_profile.field.test_ownership', 'تکرار', 'FIELD', 'company_profile', 'DRAFT');
  raise exception 'FAIL: duplicate full_key was accepted';
exception when unique_violation then null;
end $$;

-- 3) invalid pattern (uppercase, space, persian) must be rejected
do $$
begin
  insert into public.system_key_registry (full_key, title_fa, entity_type, module, status)
  values ('Company Field!', 'نامعتبر', 'FIELD', 'company_profile', 'DRAFT');
  raise exception 'FAIL: invalid pattern was accepted';
exception when check_violation then null;
end $$;

-- 4) publish then attempt rename → must fail (lock)
update public.system_key_registry set status = 'PUBLISHED' where full_key = 'company_profile.field.test_ownership';
do $$
begin
  update public.system_key_registry set full_key = 'company_profile.field.renamed' where full_key = 'company_profile.field.test_ownership';
  raise exception 'FAIL: published key was renamed';
exception when others then null;
end $$;

-- 5) delete a published key → must fail
do $$
begin
  delete from public.system_key_registry where full_key = 'company_profile.field.test_ownership';
  raise exception 'FAIL: published key was deleted';
exception when others then null;
end $$;

-- 6) admin can still read/see the registry
do $$ begin
  if (select count(*) from public.system_key_registry where full_key = 'company_profile.field.test_ownership') <> 1 then
    raise exception 'FAIL: platform admin could not read registry';
  end if;
end $$;

-- ── Raw (scoped per-form) keys: same raw key in two scopes is allowed, but a
--    duplicate within one scope is rejected by the DB UNIQUE(full_key). ───────
insert into public.system_key_registry (full_key, title_fa, entity_type, module, form_id, source_table, status)
values ('workflow.step.submit_plan.tracking_code', 'کد رهگیری', 'WORKFLOW_STEP', 'workflow', 'f1000000-0000-0000-0000-00000000000a', 'workflow_steps', 'DRAFT');
insert into public.system_key_registry (full_key, title_fa, entity_type, module, form_id, source_table, status)
values ('workflow.step.objection_filing.tracking_code', 'کد رهگیری اظهارنامه', 'WORKFLOW_STEP', 'workflow', 'f1000000-0000-0000-0000-00000000000b', 'workflow_steps', 'DRAFT');

do $$
begin
  insert into public.system_key_registry (full_key, title_fa, entity_type, module, form_id, source_table, status)
  values ('workflow.step.submit_plan.tracking_code', 'تکرار همان دامنه', 'WORKFLOW_STEP', 'workflow', 'f1000000-0000-0000-0000-00000000000a', 'workflow_steps', 'DRAFT');
  raise exception 'FAIL: duplicate scoped raw key in the same scope was accepted';
exception when unique_violation then null;
end $$;

-- ── As a regular user: RLS must hide everything and block writes ───────────
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

do $$ declare c integer; begin
  select count(*) into c from public.system_key_registry;
  if c <> 0 then raise exception 'FAIL: non-admin was able to read the registry'; end if;
end $$;

do $$
begin
  insert into public.system_key_registry (full_key, title_fa, entity_type, module, status)
  values ('company_profile.field.unauthorized', 'غیرمجاز', 'FIELD', 'company_profile', 'DRAFT');
  raise exception 'FAIL: non-admin was able to insert into the registry';
exception when insufficient_privilege then null;
end $$;

rollback;