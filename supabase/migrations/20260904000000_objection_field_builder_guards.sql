-- ==========================================================================
-- Migration: Objection wizard field-builder guards
-- Date: 2026-09-04
-- Purpose: Complete the field-builder of the objection template wizard:
--   - objection_steps : performer / responsible assignment columns (additive;
--     old `actor` is preserved untouched — never auto-converted).
--   - Serverside activation guard: a template containing any file-type field
--     may never be activated (file upload is not supported yet). Both the
--     table trigger and the activation RPC reject it. Draft saving stays allowed.
--   Field-key uniqueness within an action is enforced in the persist service
--   (a DB UNIQUE over a JSONB array element would not be reliably portable across
--   the existing schema, and the runtime already scopes field keys per action).
-- ==========================================================================

begin;

-- --------------------------------------------------------------------------
-- 1. Performer / responsible columns (additive).
--    Old `actor` column keeps its raw value; nothing is backfilled/converted.
-- --------------------------------------------------------------------------
alter table public.objection_steps
  add column if not exists performer_key text,
  add column if not exists performer_label text,
  add column if not exists responsible_role text,
  add column if not exists responsible_role_label text;

comment on column public.objection_steps.performer_key is
  'مرجع انجام اقدام — کلید پایدار گزینه از فهرست انتخابها (objection_step_actors).';
comment on column public.objection_steps.responsible_role is
  'مسئول ثبت و پیگیری در پلتفرم — کلید نقش قابلتخصیص شرکت.';

-- --------------------------------------------------------------------------
-- 2. Unsupported file-field guard (definition-only type; no upload yet).
-- --------------------------------------------------------------------------
create or replace function public.objection_template_has_unsupported_files(p_template_id uuid)
returns boolean language plpgsql security definer set search_path = pg_catalog
as $$
declare v_has boolean;
begin
  select exists (
    select 1
    from public.objection_steps s
    cross join lateral jsonb_array_elements(coalesce(s.form_schema -> 'fields', '[]'::jsonb)) f
    where s.template_id = p_template_id
      and jsonb_typeof(f) = 'object'
      and f ->> 'type' = 'file'
  ) into v_has;
  return coalesce(v_has, false);
end;
$$;
revoke all on function public.objection_template_has_unsupported_files(uuid) from public, anon, authenticated, service_role;

-- Extend the activation table-trigger guard (fires on direct updates too).
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
  end if;
  return new;
end;
$$;
revoke all on function public.objection_template_guard_activate() from public, anon, authenticated, service_role;
drop trigger if exists objection_template_guard_activate on public.objection_templates;
create trigger objection_template_guard_activate
  before update of status, is_active on public.objection_templates
  for each row execute function public.objection_template_guard_activate();

-- Same guard raised early inside the activation RPC.
create or replace function public.activate_objection_template(
  p_template_id uuid,
  p_obligation_ids uuid[],
  p_replace_conflicts boolean
)
returns void
language plpgsql security definer set search_path = pg_catalog
as $$
declare
  v_oid uuid;
begin
  if auth.uid() is null or not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.objection_templates where id = p_template_id) then
    raise exception 'template not found' using errcode = 'P0002';
  end if;

  -- Same guards as the table trigger, raised early with clear messages.
  if public.objection_template_has_conditions(p_template_id) then
    raise exception 'الگوی دارای شروط پشتیبانینشده قابل فعالسازی نیست؛ ابتدا شروط را حذف کنید' using errcode = '23514';
  end if;
  if public.objection_template_has_unsupported_files(p_template_id) then
    raise exception 'الگو فیلد از نوع «فایل/تصویر» دارد؛ بارگذاری فایل پشتیبانی نمیشود و الگو فقط بهصورت پیشنویس قابل ذخیره است' using errcode = '23514';
  end if;

  -- Conflict check per obligation; replacement only with explicit confirmation.
  foreach v_oid in array p_obligation_ids loop
    if exists (
      select 1 from public.objection_template_obligations o
      where o.obligation_id = v_oid
        and o.link_status = 'ACTIVE'
        and o.template_id <> p_template_id
    ) then
      if p_replace_conflicts then
        update public.objection_template_obligations
        set link_status = 'HISTORY', updated_at = now()
        where obligation_id = v_oid and link_status = 'ACTIVE' and template_id <> p_template_id;
      else
        raise exception 'یک یا چند تعهد دارای اتصال فعال به الگوی دیگر هستند' using errcode = '23505';
      end if;
    end if;
  end loop;

  -- Activate the template (fires the guard trigger above).
  update public.objection_templates
  set status = 'ACTIVE', is_active = true, updated_at = now()
  where id = p_template_id;

  -- Promote this template's links for the selected obligations. Any previous
  -- DRAFT/ACTIVE row for this template+obligation is replaced by a fresh ACTIVE
  -- row (history rows are preserved). The partial unique index guarantees at
  -- most one ACTIVE link per obligation.
  foreach v_oid in array p_obligation_ids loop
    delete from public.objection_template_obligations
    where template_id = p_template_id and obligation_id = v_oid and link_status <> 'HISTORY';
    insert into public.objection_template_obligations (template_id, obligation_id, link_status)
    values (p_template_id, v_oid, 'ACTIVE')
    on conflict do nothing;
  end loop;

  -- Links of this template that are no longer selected move to history.
  update public.objection_template_obligations
  set link_status = 'HISTORY', updated_at = now()
  where template_id = p_template_id and link_status = 'ACTIVE'
    and not (obligation_id = any(p_obligation_ids));
end;
$$;
revoke all on function public.activate_objection_template(uuid, uuid[], boolean) from public, anon, authenticated;
grant execute on function public.activate_objection_template(uuid, uuid[], boolean) to authenticated;

commit;