-- ==========================================================================
-- Migration: Seed the system key registry from existing key-bearing tables
-- Date: 2026-08-31
-- Purpose: Extract every currently-defined English key (company-info fields,
--          selection lists/options, obligations, workflow steps, ...) into the
--          central registry, namespaced, preserving existing values and NOT
--          editing/removing anything. Idempotent: re-running never duplicates
--          rows (on conflict do nothing).
-- ==========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) Company-info field definitions → company_profile.field.<key>
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.company_field_definitions') is null then
    raise notice 'company_field_definitions missing; skipping';
    return;
  end if;
  insert into public.system_key_registry
    (full_key, title_fa, entity_type, module, form_name,
     source_table, source_record_id, status, locked, lock_reason)
  select
    'company_profile.field.' || lower(f.key),
    coalesce(f.title, f.key),
    'FIELD',
    'company_profile',
    'اطلاعات شرکت',
    'company_field_definitions',
    f.id,
    case when f.status = 'PUBLISHED' then 'PUBLISHED' else 'DRAFT' end,
    (f.is_system is true or f.used_in_eligibility is true),
    case when (f.is_system is true or f.used_in_eligibility is true)
      then 'سیستمی یا اثرگذار در تشخیص' end
  from public.company_field_definitions f
  where btrim(f.key) <> ''
  on conflict (lower(full_key)) do nothing;
end $$;

-- ---------------------------------------------------------------------------
-- 2) Selection lists → selection_list.<key>
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.selection_lists') is null then
    raise notice 'selection_lists missing; skipping';
    return;
  end if;
  insert into public.system_key_registry
    (full_key, title_fa, entity_type, module, form_name,
     source_table, source_record_id, status, locked, lock_reason)
  select
    'selection_list.' || lower(l.key),
    coalesce(l.title, l.key),
    'SELECTION_LIST',
    'selection',
    case when l.is_dependent then 'فهرست وابسته' else 'فهرست مستقل' end,
    'selection_lists',
    l.id,
    case when l.status = 'PUBLISHED' then 'PUBLISHED' else 'DRAFT' end,
    (l.status = 'PUBLISHED'),
    case when l.status = 'PUBLISHED' then 'پس از انتشار قفل است' end
  from public.selection_lists l
  where btrim(l.key) <> ''
  on conflict (lower(full_key)) do nothing;
end $$;

-- ---------------------------------------------------------------------------
-- 3) Selection list options → selection_option.<list_key>.<option_key>
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.selection_list_options') is null then
    raise notice 'selection_list_options missing; skipping';
    return;
  end if;
  insert into public.system_key_registry
    (full_key, title_fa, entity_type, module, form_name,
     source_table, source_record_id, status, locked, lock_reason)
  select
    'selection_option.' || lower(l.key) || '.' || lower(op.key),
    coalesce(op.label, op.key),
    'SELECTION_OPTION',
    'selection',
    'گزینههای فهرست «' || coalesce(l.title, l.key) || '»',
    'selection_list_options',
    op.id,
    case when l.status = 'PUBLISHED' then 'PUBLISHED' else 'DRAFT' end,
    (l.status = 'PUBLISHED'),
    case when l.status = 'PUBLISHED' then 'پس از انتشار قفل است' end
  from public.selection_list_options op
  join public.selection_lists l on l.id = op.list_id
  where btrim(op.key) <> ''
  on conflict (lower(full_key)) do nothing;
end $$;

-- ---------------------------------------------------------------------------
-- 4) Obligations → obligation.<code_lower>
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.obligations') is null then
    raise notice 'obligations missing; skipping';
    return;
  end if;
  insert into public.system_key_registry
    (full_key, title_fa, entity_type, module, form_name,
     source_table, source_record_id, status, locked, lock_reason)
  select
    'obligation.' || lower(o.code),
    coalesce(o.title, o.code),
    'OBLIGATION',
    'obligations',
    'استودیوی تعهدات',
    'obligations',
    o.id,
    'PUBLISHED',
    true,
    'تعهد؛ پس از انتشار قفل است'
  from public.obligations o
  where btrim(o.code) <> ''
  on conflict (lower(full_key)) do nothing;
end $$;

-- ---------------------------------------------------------------------------
-- 5) Workflow steps → workflow.step.<code_lower>
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.workflow_steps') is null then
    raise notice 'workflow_steps missing; skipping';
    return;
  end if;
  insert into public.system_key_registry
    (full_key, title_fa, entity_type, module, form_name,
     source_table, source_record_id, status, locked, lock_reason)
  select
    'workflow.step.' || lower(s.code),
    coalesce(s.title, s.code),
    'WORKFLOW_STEP',
    'workflow',
    'مرحله فرایند',
    'workflow_steps',
    s.id,
    'PUBLISHED',
    true,
    'گام فرایند؛ پس از انتشار قفل است'
  from public.workflow_steps s
  where btrim(s.code) <> ''
  on conflict (lower(full_key)) do nothing;
end $$;

-- ---------------------------------------------------------------------------
-- Summary notice for operators (does not fail the migration).
-- ---------------------------------------------------------------------------
do $$
declare v_total bigint; v_lock bigint;
begin
  select count(*) into v_total from public.system_key_registry;
  select count(*) into v_lock from public.system_key_registry where locked or status = 'PUBLISHED';
  raise notice 'system_key_registry seeded: total=%, locked/published=%', v_total, v_lock;
end $$;

commit;