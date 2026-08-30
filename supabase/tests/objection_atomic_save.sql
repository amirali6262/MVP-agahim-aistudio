-- ==========================================================================
-- Integration test: objection template atomic save + guards
-- Run only against a development Supabase project (transaction + rollback),
-- after applying all migrations. Every fixture uses reserved test UUIDs and
-- is rolled back. Covers:
--   - non-admin rejected from objection_template_save
--   - admin save + read-back of performer / responsible / legacy actor
--   - responsible_role must be an assignable company role (PLATFORM_ADMIN
--     rejected) — enforced server-side, no new grant implied
--   - performer_key must be an option of the seeded objection_step_actors list
--   - field-key uniqueness within an action (duplicate rejected)
--   - file-field templates saved as DRAFT but activation rejected
--     (file upload is not supported yet)
-- ==========================================================================

\set ON_ERROR_STOP on
begin;

-- ── Fixtures: one platform admin + one regular user ───────────────────────
insert into auth.users (id, aud, role, email, phone, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous)
values
  ('a1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'obj-admin@example.invalid', '+989810000001', '{}', '{}', now(), now(), false, false),
  ('a1000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'obj-user@example.invalid',  '+989810000002', '{}', '{}', now(), now(), false, false);

do $$ begin
  if (select count(*) from public.users where id in ('a1000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002')) <> 2 then
    raise exception 'register trigger did not create profiles';
  end if;
end $$;

update public.users
set role = 'PLATFORM_ADMIN'
where id = 'a1000000-0000-0000-0000-000000000001';

-- Prerequisites from seeded reference data.
do $$ begin
  if not exists (select 1 from public.role_definitions where "key" = 'MANAGER' and "key" <> 'PLATFORM_ADMIN') then
    raise exception 'assignable MANAGER role missing';
  end if;
  if not exists (
    select 1 from public.selection_list_options o
    join public.selection_lists l on l.id = o.list_id
    where l."key" = 'objection_step_actors' and o."key" = 'TAXPAYER' and o.is_active
  ) then
    raise exception 'seeded actor option TAXPAYER missing';
  end if;
end $$;

-- ── 1) Non-admin is rejected ──────────────────────────────────────────────
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
do $$
begin
  perform public.objection_template_save(null, 'X', null, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::uuid[]);
  raise exception 'FAIL: non-admin could save an objection template';
exception when insufficient_privilege then null;
end $$;

-- ── 2) Admin save + read-back (performer / responsible / legacy actor) ────
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
do $$
declare
  tid uuid;
  steps jsonb := $j$[
    { "id": "xs1", "title": "اقدام اول", "actor": "مودی مالیاتی",
      "performer_key": "TAXPAYER", "performer_label": "مودی مالیاتی",
      "responsible_role": "MANAGER", "responsible_role_label": "مدیر عملیاتی",
      "gap_value": 3, "gap_unit": "روز", "base_event": "ابلاغ",
      "step_nature": "MANDATORY", "stage_id": null,
      "fields": [
        { "id": "f1", "key": "code", "label": "کد", "type": "text" },
        { "id": "f2", "key": "due_date", "label": "تاریخ", "type": "date", "includeTime": false },
        { "id": "f3", "key": "kind", "label": "نوع", "type": "select", "listKey": "objection_step_actors" }
      ],
      "transitions": [ { "id": "t1", "title": "ادامه", "trigger_type": "USER_ACTION",
                         "target_type": "TERMINAL_AGREED", "target_step_id": null } ] }
  ]$j$::jsonb;
begin
  tid := public.objection_template_save(null, 'الگوی آزمایشی', 'شرح', '[]'::jsonb, steps, '[]'::jsonb, '{}'::uuid[]);
  if tid is null then raise exception 'FAIL: save returned null id'; end if;

  -- header is DRAFT / inactive
  if not exists (select 1 from public.objection_templates t
                 where t.id = tid and t.status = 'DRAFT' and t.is_active = false) then
    raise exception 'FAIL: header not persisted as DRAFT';
  end if;

  -- step keeps performer/responsible and the legacy raw actor unchanged
  if not exists (select 1 from public.objection_steps s
                 where s.template_id = tid
                   and s.performer_key = 'TAXPAYER'
                   and s.responsible_role = 'MANAGER'
                   and s.actor = 'مودی مالیاتی') then
    raise exception 'FAIL: performer/responsible/legacy actor not preserved';
  end if;

  -- date + select date/list field definitions round-trip in form_schema
  if not exists (select 1 from public.objection_steps s,
                 lateral jsonb_array_elements(s.form_schema -> 'fields') f
                 where s.template_id = tid
                   and f -> 'key' = '"due_date"'::jsonb and f ->> 'type' = 'date') then
    raise exception 'FAIL: date field definition not preserved';
  end if;
end $$;

-- ── 3) responsible_role = PLATFORM_ADMIN must be rejected server-side ─────
do $$
declare
  steps jsonb := $j$[
    { "id": "xs2", "title": "اقدام", "actor": "TAXPAYER",
      "performer_key": "TAXPAYER", "performer_label": "مودی مالیاتی",
      "responsible_role": "PLATFORM_ADMIN", "gap_value": 0, "gap_unit": "روز",
      "step_nature": "MANDATORY", "stage_id": null, "fields": [], "transitions": [] }
  ]$j$::jsonb;
begin
  perform public.objection_template_save(null, 'نقش نامعتبر', null, '[]'::jsonb, steps, '[]'::jsonb, '{}'::uuid[]);
  raise exception 'FAIL: PLATFORM_ADMIN accepted as responsible_role';
exception when check_violation then null;
end $$;

-- ── 4) invalid / non-assignable role rejected ─────────────────────────────
do $$
declare
  steps jsonb := $j$[
    { "id": "xs3", "title": "اقدام", "actor": "TAXPAYER",
      "performer_key": "TAXPAYER", "responsible_role": "NOT_A_ROLE",
      "gap_value": 0, "gap_unit": "روز", "step_nature": "MANDATORY",
      "stage_id": null, "fields": [], "transitions": [] }
  ]$j$::jsonb;
begin
  perform public.objection_template_save(null, 'نقش غیرمجاز', null, '[]'::jsonb, steps, '[]'::jsonb, '{}'::uuid[]);
  raise exception 'FAIL: unknown role accepted';
exception when check_violation then null;
end $$;

-- ── 5) performer not in objection_step_actors list rejected ───────────────
do $$
declare
  steps jsonb := $j$[
    { "id": "xs4", "title": "اقدام", "actor": "TAXPAYER",
      "performer_key": "SOMEONE_ELSE", "performer_label": "؟",
      "responsible_role": "MANAGER", "gap_value": 0, "gap_unit": "روز",
      "step_nature": "MANDATORY", "stage_id": null, "fields": [], "transitions": [] }
  ]$j$::jsonb;
begin
  perform public.objection_template_save(null, 'مرجع نامعتبر', null, '[]'::jsonb, steps, '[]'::jsonb, '{}'::uuid[]);
  raise exception 'FAIL: unknown performer accepted';
exception when check_violation then null;
end $$;

-- ── 6) duplicate field key within an action rejected ──────────────────────
do $$
declare
  steps jsonb := $j$[
    { "id": "xs5", "title": "اقدام", "actor": "TAXPAYER",
      "responsible_role": "MANAGER", "gap_value": 0, "gap_unit": "روز",
      "step_nature": "MANDATORY", "stage_id": null,
      "fields": [ { "id": "a", "key": "dup", "label": "یک", "type": "text" },
                  { "id": "b", "key": "dup", "label": "دو", "type": "text" } ],
      "transitions": [] }
  ]$j$::jsonb;
begin
  perform public.objection_template_save(null, 'کلید تکراری', null, '[]'::jsonb, steps, '[]'::jsonb, '{}'::uuid[]);
  raise exception 'FAIL: duplicate field key accepted';
exception when check_violation or sqlstate '22023' then null;
end $$;

-- ── 7) file-field template: DRAFT save ok, activation blocked ─────────────
do $$
declare
  tid uuid;
  steps jsonb := $j$[
    { "id": "xs6", "title": "اقدام", "actor": "TAXPAYER",
      "responsible_role": "MANAGER", "gap_value": 0, "gap_unit": "روز",
      "step_nature": "MANDATORY", "stage_id": null,
      "fields": [ { "id": "c", "key": "att", "label": "پیوست", "type": "file" } ],
      "transitions": [] }
  ]$j$::jsonb;
begin
  tid := public.objection_template_save(null, 'فایل', null, '[]'::jsonb, steps, '[]'::jsonb, '{}'::uuid[]);
  if tid is null then raise exception 'FAIL: file-field template could not be saved as draft'; end if;
  -- activation must be rejected by the guard
  begin
    perform public.activate_objection_template(tid, '{}'::uuid[], false);
    raise exception 'FAIL: file-field template was activated';
  exception when check_violation then null;
  end;
end $$;

-- ── 8) ever-activated template is permanently locked (status revert does not help) ──
do $$
declare
  tid uuid;
  steps jsonb := $j$[
    { "id": "xs7", "title": "اقدام", "actor": "TAXPAYER",
      "responsible_role": "MANAGER", "gap_value": 0, "gap_unit": "روز",
      "step_nature": "MANDATORY", "stage_id": null, "fields": [], "transitions": [] }
  ]$j$::jsonb;
begin
  tid := public.objection_template_save(null, 'قفل', null, '[]'::jsonb, steps, '[]'::jsonb, '{}'::uuid[]);
  if tid is null then raise exception 'FAIL: could not create pre-activation template'; end if;
  perform public.activate_objection_template(tid, '{}'::uuid[], false);
  if not exists (select 1 from public.objection_templates where id = tid and has_been_activated and status = 'ACTIVE') then
    raise exception 'FAIL: has_been_activated was not set on activation';
  end if;
  -- even after activation (or a later revert to DRAFT) the content is locked:
  begin
    perform public.objection_template_save(tid, 'قفل-ویرایش', null, '[]'::jsonb, steps, '[]'::jsonb, '{}'::uuid[]);
    raise exception 'FAIL: ever-activated template could be rewritten';
  exception when check_violation then null;
  end;
end $$;

-- ── 9) stable per-action identifier (step_ref) survives save/reorder/insert ──
--     Conditions reference «stable step id + field key» (sr_a.code), never order.
do $$
declare
  tid uuid;
  refs text[];
  steps jsonb := $j$[
    { "id": "cid_a", "step_ref": "sr_a", "title": "اقدام یک", "actor": "TAXPAYER", "responsible_role": "MANAGER",
      "gap_value": 1, "gap_unit": "روز", "step_nature": "MANDATORY", "stage_id": null,
      "fields": [ { "id": "fz1", "key": "code", "label": "کد", "type": "text" } ],
      "transitions": [
        { "id": "tz1", "title": "ادامه", "trigger_type": "USER_ACTION",
          "target_type": "TERMINAL_AGREED", "target_step_id": null,
          "condition_expression": { "version": 1, "logic": "AND",
            "clauses": [ { "id": "zc1", "source": "STEP_OUTPUT",
              "field_key": "sr_a.code", "field_label": "اقدام یک — کد",
              "operator": "in", "value": ["a","b"] } ] } }
      ] },
    { "id": "cid_b", "step_ref": "sr_b", "title": "اقدام دو", "actor": "TAXPAYER", "responsible_role": "MANAGER",
      "gap_value": 1, "gap_unit": "روز", "step_nature": "MANDATORY", "stage_id": null,
      "fields": [ { "id": "fz2", "key": "amount", "label": "مبلغ", "type": "number" } ],
      "transitions": [] }
  ]$j$::jsonb;
begin
  tid := public.objection_template_save(null, 'پایدار', null, '[]'::jsonb, steps, '[]'::jsonb, '{}'::uuid[]);
  if tid is null then raise exception 'FAIL: stability save #1 null'; end if;
  select array_agg(step_ref order by sequence) into refs from public.objection_steps where template_id = tid;
  if refs is distinct from array['sr_a','sr_b'] then
    raise exception 'FAIL: step_refs after save #1: %', refs;
  end if;
  if not exists (
    select 1 from public.objection_step_transitions t
    left join lateral jsonb_array_elements(coalesce(t.condition_expression -> 'clauses', '[]'::jsonb)) c on true
    where t.step_id in (select id from public.objection_steps where template_id = tid)
      and c.value ->> 'field_key' = 'sr_a.code'
  ) then
    raise exception 'FAIL: condition sr_a.code reference not preserved after save #1';
  end if;

  -- reorder the two actions (swap) -> identifiers must NOT change
  steps := $j$[
    { "id": "cid_b", "step_ref": "sr_b", "title": "اقدام دو", "actor": "TAXPAYER", "responsible_role": "MANAGER",
      "gap_value": 1, "gap_unit": "روز", "step_nature": "MANDATORY", "stage_id": null, "fields": [], "transitions": [] },
    { "id": "cid_a", "step_ref": "sr_a", "title": "اقدام یک", "actor": "TAXPAYER", "responsible_role": "MANAGER",
      "gap_value": 1, "gap_unit": "روز", "step_nature": "MANDATORY", "stage_id": null,
      "fields": [ { "id": "fz1", "key": "code", "label": "کد", "type": "text" } ],
      "transitions": [
        { "id": "tz1", "title": "ادامه", "trigger_type": "USER_ACTION",
          "target_type": "TERMINAL_AGREED", "target_step_id": null,
          "condition_expression": { "version": 1, "logic": "AND",
            "clauses": [ { "id": "zc1", "source": "STEP_OUTPUT",
              "field_key": "sr_a.code", "field_label": "اقدام یک — کد",
              "operator": "in", "value": ["a","b"] } ] } }
      ] }
  ]$j$::jsonb;
  perform public.objection_template_save(tid, 'پایدار-مرتب', null, '[]'::jsonb, steps, '[]'::jsonb, '{}'::uuid[]);
  select array_agg(step_ref order by sequence) into refs from public.objection_steps where template_id = tid;
  if refs is distinct from array['sr_b','sr_a'] then
    raise exception 'FAIL: step_refs changed after reorder: %', refs;
  end if;
  if exists (
    select 1 from public.objection_steps s
    join public.objection_step_transitions t on t.step_id = s.id
    left join lateral jsonb_array_elements(coalesce(t.condition_expression -> 'clauses', '[]'::jsonb)) c on true
    where s.template_id = tid and s.step_ref = 'sr_b' and c.value ->> 'field_key' = 'sr_a.code'
  ) then
    raise exception 'FAIL: condition moved to the wrong action after reorder';
  end if;
  if not exists (
    select 1 from public.objection_steps s
    join public.objection_step_transitions t on t.step_id = s.id
    left join lateral jsonb_array_elements(coalesce(t.condition_expression -> 'clauses', '[]'::jsonb)) c on true
    where s.template_id = tid and s.step_ref = 'sr_a' and c.value ->> 'field_key' = 'sr_a.code'
  ) then
    raise exception 'FAIL: condition reference lost from sr_a after reorder';
  end if;

  -- insert a new action at the START of the path -> existing identifiers unchanged
  steps := $j$[
    { "id": "cid_new", "step_ref": "sr_new", "title": "اقدام جدید", "actor": "TAXPAYER", "responsible_role": "MANAGER",
      "gap_value": 1, "gap_unit": "روز", "step_nature": "MANDATORY", "stage_id": null, "fields": [], "transitions": [] },
    { "id": "cid_b", "step_ref": "sr_b", "title": "اقدام دو", "actor": "TAXPAYER", "responsible_role": "MANAGER",
      "gap_value": 1, "gap_unit": "روز", "step_nature": "MANDATORY", "stage_id": null, "fields": [], "transitions": [] },
    { "id": "cid_a", "step_ref": "sr_a", "title": "اقدام یک", "actor": "TAXPAYER", "responsible_role": "MANAGER",
      "gap_value": 1, "gap_unit": "روز", "step_nature": "MANDATORY", "stage_id": null,
      "fields": [ { "id": "fz1", "key": "code", "label": "کد", "type": "text" } ],
      "transitions": [
        { "id": "tz1", "title": "ادامه", "trigger_type": "USER_ACTION",
          "target_type": "TERMINAL_AGREED", "target_step_id": null,
          "condition_expression": { "version": 1, "logic": "AND",
            "clauses": [ { "id": "zc1", "source": "STEP_OUTPUT",
              "field_key": "sr_a.code", "field_label": "اقدام یک — کد",
              "operator": "in", "value": ["a","b"] } ] } }
      ] }
  ]$j$::jsonb;
  perform public.objection_template_save(tid, 'پایدار-درج', null, '[]'::jsonb, steps, '[]'::jsonb, '{}'::uuid[]);
  select array_agg(step_ref order by sequence) into refs from public.objection_steps where template_id = tid;
  if refs is distinct from array['sr_new','sr_b','sr_a'] then
    raise exception 'FAIL: step_refs after insert-at-start: %', refs;
  end if;
  if not exists (
    select 1 from public.objection_step_transitions t
    left join lateral jsonb_array_elements(coalesce(t.condition_expression -> 'clauses', '[]'::jsonb)) c on true
    where t.step_id in (select id from public.objection_steps where template_id = tid)
      and c.value ->> 'field_key' = 'sr_a.code'
  ) then
    raise exception 'FAIL: condition reference lost after insert-at-start';
  end if;
end $$;

-- ── 10) deleting an action that a condition references must be rejected ─────
do $$
declare
  tid uuid;
  steps jsonb := $j$[
    { "id": "k1", "step_ref": "ref_keep", "title": "باقی", "actor": "TAXPAYER", "responsible_role": "MANAGER",
      "gap_value": 1, "gap_unit": "روز", "step_nature": "MANDATORY", "stage_id": null,
      "fields": [ { "id": "df1", "key": "code", "label": "کد", "type": "text" } ],
      "transitions": [
        { "id": "kt1", "title": "ادامه", "trigger_type": "USER_ACTION",
          "target_type": "TERMINAL_AGREED", "target_step_id": null,
          "condition_expression": { "version": 1, "logic": "AND",
            "clauses": [ { "id": "kc1", "source": "STEP_OUTPUT",
              "field_key": "ref_other.code", "field_label": "اقدام دیگر — کد",
              "operator": "eq", "value": "x" } ] } }
      ] },
    { "id": "o1", "step_ref": "ref_other", "title": "اقدام دیگر", "actor": "TAXPAYER", "responsible_role": "MANAGER",
      "gap_value": 1, "gap_unit": "روز", "step_nature": "MANDATORY", "stage_id": null, "fields": [], "transitions": [] }
  ]$j$::jsonb;
begin
  tid := public.objection_template_save(null, 'حذف مرجع', null, '[]'::jsonb, steps, '[]'::jsonb, '{}'::uuid[]);
  if tid is null then raise exception 'FAIL: delete-block fixture save null'; end if;
  -- attempt deletion: drop ref_other while the condition on ref_keep still points at it
  steps := $j$[
    { "id": "k1", "step_ref": "ref_keep", "title": "باقی", "actor": "TAXPAYER", "responsible_role": "MANAGER",
      "gap_value": 1, "gap_unit": "روز", "step_nature": "MANDATORY", "stage_id": null,
      "fields": [ { "id": "df1", "key": "code", "label": "کد", "type": "text" } ],
      "transitions": [
        { "id": "kt1", "title": "ادامه", "trigger_type": "USER_ACTION",
          "target_type": "TERMINAL_AGREED", "target_step_id": null,
          "condition_expression": { "version": 1, "logic": "AND",
            "clauses": [ { "id": "kc1", "source": "STEP_OUTPUT",
              "field_key": "ref_other.code", "field_label": "اقدام دیگر — کد",
              "operator": "eq", "value": "x" } ] } }
      ] }
  ]$j$::jsonb;
  begin
    perform public.objection_template_save(tid, 'حذف مرجع', null, '[]'::jsonb, steps, '[]'::jsonb, '{}'::uuid[]);
    raise exception 'FAIL: deleting a condition-referenced action was allowed';
  exception when check_violation then null;
  end;
  -- the rejected save must not have touched the template (atomic)
  if not exists (select 1 from public.objection_steps where template_id = tid) then
    raise exception 'FAIL: rejected delete still wiped the steps';
  end if;
end $$;

-- ── 11) has_been_activated is monotonic + set on any ACTIVE write ──────────
do $$
declare
  tid uuid;
  steps jsonb := $j$[
    { "id": "la", "step_ref": "lock_a", "title": "اقدام", "actor": "TAXPAYER", "responsible_role": "MANAGER",
      "gap_value": 0, "gap_unit": "روز", "step_nature": "MANDATORY", "stage_id": null, "fields": [], "transitions": [] }
  ]$j$::jsonb;
begin
  tid := public.objection_template_save(null, 'قفل یکطرفه', null, '[]'::jsonb, steps, '[]'::jsonb, '{}'::uuid[]);
  if tid is null then raise exception 'FAIL: lock fixture save null'; end if;
  -- a normal request must never flip has_been_activated back to false
  update public.objection_templates set has_been_activated = true where id = tid;
  begin
    update public.objection_templates set has_been_activated = false where id = tid;
    raise exception 'FAIL: has_been_activated was flipped back to false';
  exception when check_violation then null;
  end;
  -- any direct ACTIVE write sets the lock via the guard trigger
  insert into public.objection_templates (title, status, is_active)
  values ('فعال مستقیم', 'ACTIVE', true) returning id into tid;
  if not exists (select 1 from public.objection_templates where id = tid and has_been_activated) then
    raise exception 'FAIL: ACTIVE insert did not set has_been_activated';
  end if;
end $$;

rollback;