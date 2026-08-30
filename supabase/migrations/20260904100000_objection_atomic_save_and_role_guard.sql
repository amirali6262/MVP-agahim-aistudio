-- ==========================================================================
-- Migration: Objection template atomic save + responsible-role guard
-- Date: 2026-09-04
-- Purpose:
--   1. Server-side validation of the step "مسئول ثبت" (responsible_role) and
--      "مرجع انجام اقدام" (performer_key): only assignable company roles
--      (role_definitions, excluding PLATFORM_ADMIN) and options of the seeded
--      objection_step_actors list. Enforced by a DB trigger so no write path
--      can bypass it; choosing a role never creates a grant.
--   2. public.objection_template_save(...) — one transactional RPC that
--      persists header, stages, steps, transitions, status groups and draft
--      obligation links atomically (all succeed or nothing is written).
--      Subtree rows are rebuilt inside the transaction; only
--      objection_step_transitions references objection_steps (cascade), so no
--      external reference is harmed. ACTIVE/HISTORY obligation links and the
--      template status are never touched here (activation is a separate RPC).
--   3. Ever-activated templates are permanently locked (has_been_activated):
--      the content of an in-use template is immutable; reverting the status
--      to DRAFT does NOT re-open it for rewriting (no version separation).
--   Field-key uniqueness within an action is enforced here and in the service;
--   the engine analog resolves a field by key within the step's own response
--   (validate_workflow_task_response), so per-action is the established scope.
--   Condition field references use the stable per-action code (STEP_n) which
--   the save RPC regenerates deterministically by order, so references survive
--   save → reload → save.
-- ==========================================================================

begin;

-- --------------------------------------------------------------------------
-- 0. Ever-activated templates are permanently locked.
-- --------------------------------------------------------------------------
alter table public.objection_templates
  add column if not exists has_been_activated boolean not null default false;

-- Set the flag whenever a row becomes ACTIVE (also covers direct table writes).
create or replace function public.objection_template_guard_activate()
returns trigger language plpgsql security definer set search_path = pg_catalog
as $$
begin
  if (new.status = 'ACTIVE' and old.status is distinct from 'ACTIVE')
     or (new.is_active = true and old.is_active is distinct from true) then
    if public.objection_template_has_conditions(new.id) then
      raise exception 'الگوی دارای شروط پشتیبانینشده قابل فعالسازی نیست؛ ابتدا شروط را حذف کنید' using errcode = '23514';
    end if;
    if public.objection_template_has_unsupported_files(new.id) then
      raise exception 'الگو فیلد از نوع «فایل/تصویر» دارد؛ بارگذاری فایل پشتیبانی نمیشود و الگو فقط بهصورت پیشنویس قابل ذخیره است' using errcode = '23514';
    end if;
    new.has_been_activated := true;
  end if;
  return new;
end;
$$;
revoke all on function public.objection_template_guard_activate() from public, anon, authenticated, service_role;
drop trigger if exists objection_template_guard_activate on public.objection_templates;
create trigger objection_template_guard_activate
  before update of status, is_active on public.objection_templates
  for each row execute function public.objection_template_guard_activate();

-- --------------------------------------------------------------------------
-- 1. Assignable-company-role / performer guard (no write path can bypass it)
-- --------------------------------------------------------------------------
create or replace function public.objection_step_performer_guard()
returns trigger language plpgsql security definer set search_path = pg_catalog
as $$
begin
  if new.responsible_role is not null and not exists (
    select 1 from public.role_definitions r
    where r."key" = new.responsible_role
      and r."key" <> 'PLATFORM_ADMIN'
  ) then
    raise exception 'مسئول ثبت باید یک نقش قابلتخصیص فضای شرکت باشد (مدیر پلتفرم مجاز نیست)'
      using errcode = '23514';
  end if;
  if new.performer_key is not null and not exists (
    select 1 from public.selection_list_options o
    join public.selection_lists l on l.id = o.list_id
    where l."key" = 'objection_step_actors'
      and o."key" = new.performer_key
      and o.is_active
      and l.is_active
  ) then
    raise exception 'مرجع انجام اقدام باید از فهرست «objection_step_actors» انتخاب شود'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.objection_step_performer_guard() from public, anon, authenticated, service_role;
drop trigger if exists objection_step_performer_guard on public.objection_steps;
create trigger objection_step_performer_guard
  before insert or update of responsible_role, performer_key
  on public.objection_steps
  for each row execute function public.objection_step_performer_guard();

-- --------------------------------------------------------------------------
-- 2. Atomic save RPC (platform-admin only; one transaction)
-- --------------------------------------------------------------------------
create or replace function public.objection_template_save(
  p_template_id uuid,
  p_title text,
  p_description text,
  p_stages jsonb,
  p_steps jsonb,
  p_status_groups jsonb,
  p_obligation_ids uuid[]
)
returns uuid
language plpgsql security definer set search_path = pg_catalog
as $$
declare
  uid uuid := auth.uid();
  v_tid uuid;
  v_stage_map jsonb := '{}'::jsonb;  -- sent stage id -> new real uuid text
  v_step_map jsonb := '{}'::jsonb;   -- sent step id -> new real uuid text
  v_seen text[];
  rec record;      -- loop row: has column "value" (alias t(value))
  fld record;
  tr record;
  v_stage jsonb;   -- plain jsonb copy of the current element (nested-query safe)
  v_step jsonb;
  v_group jsonb;
  v_seq int := 0;
  v_stage_id uuid;
  v_step_id uuid;
  v_target_step uuid;
  v_order int;
begin
  -- Authorization: platform admin only.
  if uid is null
     or coalesce((auth.jwt()->>'is_anonymous')::boolean, false)
     or not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;

  -- Basic structural validation.
  if p_title is null or btrim(p_title) = '' then
    raise exception 'عنوان الگو اجباری است' using errcode = '22023';
  end if;
  if p_steps is null or jsonb_typeof(p_steps) <> 'array' or coalesce(jsonb_array_length(p_steps), 0) = 0 then
    raise exception 'حداقل یک اقدام در مسیر تعریف کنید' using errcode = '22023';
  end if;
  if p_stages is null or jsonb_typeof(p_stages) <> 'array' then p_stages := '[]'::jsonb; end if;
  if p_status_groups is null or jsonb_typeof(p_status_groups) <> 'array' then p_status_groups := '[]'::jsonb; end if;

  -- Upsert template header (never touches status/is_active — activation is separate).
  if p_template_id is null then
    insert into public.objection_templates (title, description, status, is_active)
    values (btrim(p_title), nullif(p_description, ''), 'DRAFT', false)
    returning id into v_tid;
  else
    if not exists (select 1 from public.objection_templates where id = p_template_id) then
      raise exception 'template not found' using errcode = 'P0002';
    end if;
    -- الگویی که تاکنون فعال شده در حال استفاده است؛ محتوای آن قفل دائمی است و با
    -- برگشتن به پیشنویس هم قابل بازنویسی نیست (نسخهبندی جدا ندارد).
    if exists (select 1 from public.objection_templates where id = p_template_id and has_been_activated) then
      raise exception 'این الگو قبلاً فعال شده و در حال استفاده است؛ محتوای آن بسته است و قابل بازنویسی نیست (نسخهبندی جدا ندارد)'
        using errcode = '23514';
    end if;
    update public.objection_templates
    set title = btrim(p_title),
        description = nullif(p_description, ''),
        updated_at = now()
    where id = p_template_id;
    v_tid := p_template_id;
  end if;

  -- Pre-validate the whole payload before mutating anything (fail fast).
  for rec in select * from jsonb_array_elements(p_steps) as t(value) loop
    v_step := rec.value;
    if btrim(coalesce(v_step ->> 'title', '')) = '' then
      raise exception 'عنوان اقدام اجباری است' using errcode = '22023';
    end if;
    if v_step ->> 'responsible_role' is not null and not exists (
      select 1 from public.role_definitions r
      where r."key" = (v_step ->> 'responsible_role') and r."key" <> 'PLATFORM_ADMIN'
    ) then
      raise exception 'مسئول ثبت باید نقش قابلتخصیص فضای شرکت باشد (مدیر پلتفرم مجاز نیست)'
        using errcode = '23514';
    end if;
    if v_step ->> 'performer_key' is not null and not exists (
      select 1 from public.selection_list_options o
      join public.selection_lists l on l.id = o.list_id
      where l."key" = 'objection_step_actors'
        and o."key" = (v_step ->> 'performer_key')
        and o.is_active
    ) then
      raise exception 'مرجع انجام اقدام باید از فهرست «objection_step_actors» انتخاب شود'
        using errcode = '23514';
    end if;
    v_seen := '{}'::text[];
    for fld in select * from jsonb_array_elements(coalesce(v_step -> 'fields', '[]'::jsonb)) as t(value) loop
      if (fld.value ->> 'key') is not null and (fld.value ->> 'key') <> '' then
        if (fld.value ->> 'key') = any (v_seen) then
          raise exception 'کلید فیلد «%» در اقدام «%» تکراری است', (fld.value ->> 'key'), (v_step ->> 'title')
            using errcode = '22023';
        end if;
        v_seen := array_append(v_seen, fld.value ->> 'key');
      end if;
    end loop;
  end loop;

  -- Stage: validate names.
  for rec in select * from jsonb_array_elements(p_stages) as t(value) loop
    v_stage := rec.value;
    if btrim(coalesce(v_stage ->> 'title', '')) = '' then
      raise exception 'عنوان مرحله اجباری است' using errcode = '22023';
    end if;
  end loop;

  -- Rebuild the template's subtree inside this transaction (all-or-nothing).
  delete from public.objection_steps where template_id = v_tid;          -- cascades transitions
  delete from public.objection_stages where template_id = v_tid;
  delete from public.objection_template_status_groups where template_id = v_tid;
  delete from public.objection_template_obligations where template_id = v_tid and link_status = 'DRAFT';

  v_order := 0;
  for rec in select * from jsonb_array_elements(p_stages) as t(value) loop
    v_stage := rec.value;
    insert into public.objection_stages (template_id, title, sort_order)
    values (v_tid, btrim(v_stage ->> 'title'), coalesce((v_stage ->> 'sort_order')::int, v_order))
    returning id into v_stage_id;
    v_order := v_order + 1;
    v_stage_map := v_stage_map || jsonb_build_object(v_stage ->> 'id', v_stage_id::text);
  end loop;

  for rec in select * from jsonb_array_elements(p_steps) as t(value) loop
    v_step := rec.value;
    v_seq := v_seq + 1;
    v_stage_id := null;
    if v_step ->> 'stage_id' is not null and v_stage_map ? (v_step ->> 'stage_id') then
      v_stage_id := (v_stage_map ->> (v_step ->> 'stage_id'))::uuid;
    end if;
    insert into public.objection_steps (
      template_id, sequence, title, actor, performer_key, performer_label,
      responsible_role, responsible_role_label, gap_value, gap_unit, base_event,
      step_nature, legal_basis, form_schema, is_optional, stage_id
    ) values (
      v_tid, v_seq, btrim(v_step ->> 'title'),
      coalesce(v_step ->> 'actor', 'TAXPAYER'),
      v_step ->> 'performer_key', v_step ->> 'performer_label',
      v_step ->> 'responsible_role', v_step ->> 'responsible_role_label',
      coalesce((v_step ->> 'gap_value')::int, 0),
      coalesce(v_step ->> 'gap_unit', 'روز'),
      v_step ->> 'base_event',
      coalesce(v_step ->> 'step_nature', 'MANDATORY'),
      v_step ->> 'legal_basis',
      jsonb_build_object('fields', coalesce(v_step -> 'fields', '[]'::jsonb)),
      coalesce((v_step ->> 'is_skippable')::boolean, (v_step ->> 'step_nature') = 'CONDITIONAL_EXPERT'),
      v_stage_id
    ) returning id into v_step_id;
    v_step_map := v_step_map || jsonb_build_object(v_step ->> 'id', v_step_id::text);

    for tr in select * from jsonb_array_elements(coalesce(v_step -> 'transitions', '[]'::jsonb)) as t(value) loop
      v_target_step := null;
      if tr.value ->> 'target_type' = 'STEP' and tr.value ->> 'target_step_id' is not null
         and v_step_map ? (tr.value ->> 'target_step_id') then
        v_target_step := (v_step_map ->> (tr.value ->> 'target_step_id'))::uuid;
      end if;
      insert into public.objection_step_transitions (
        step_id, title, trigger_type, timeout_days, timeout_desc, target_type,
        target_step_id, action_label, legal_reference, description, condition_expression
      ) values (
        v_step_id, coalesce(tr.value ->> 'title', 'ادامه'),
        coalesce(tr.value ->> 'trigger_type', 'USER_ACTION'),
        (tr.value ->> 'timeout_days')::int, tr.value ->> 'timeout_desc',
        coalesce(tr.value ->> 'target_type', 'STEP'), v_target_step,
        tr.value ->> 'action_label', tr.value ->> 'legal_reference',
        tr.value ->> 'description', tr.value -> 'condition_expression'
      );
    end loop;
  end loop;

  update public.objection_steps s
  set code = 'STEP_' || sub.rn
  from (select id, row_number() over (order by sequence, id) as rn
        from public.objection_steps where template_id = v_tid) sub
  where s.id = sub.id and s.template_id = v_tid;

  for rec in select * from jsonb_array_elements(p_status_groups) as t(value) loop
    v_group := rec.value;
    insert into public.objection_template_status_groups (template_id, code, title, options, sort_order)
    values (v_tid, v_group ->> 'code', v_group ->> 'title',
            coalesce(v_group -> 'options', '[]'::jsonb),
            coalesce((v_group ->> 'sort_order')::int, 0));
  end loop;

  if p_obligation_ids is not null and coalesce(array_length(p_obligation_ids, 1), 0) > 0 then
    insert into public.objection_template_obligations (template_id, obligation_id, link_status)
    select v_tid, oid, 'DRAFT' from unnest(p_obligation_ids) oid
    on conflict do nothing;
  end if;

  return v_tid;
end;
$$;
revoke all on function public.objection_template_save(
  uuid,text,text,jsonb,jsonb,jsonb,uuid[]
) from public,anon,authenticated;
grant execute on function public.objection_template_save(
  uuid,text,text,jsonb,jsonb,jsonb,uuid[]
) to authenticated;

commit;