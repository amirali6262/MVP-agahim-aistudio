-- ==========================================================================
-- Follow-up fix: rule_center_save_connection
-- Date: 2026-09-05 (after 20260905000000_rule_center.sql)
-- Purpose:
--   The previous migration's save_connection body used v_ref without
--   declaring it (SQLSTATE 42601 at function creation, breaking `supabase db
--   reset`), and its mapping guard rejected ANY unmapped input key even for
--   optional inputs (its own commit message promised "missing-required-input
--   validation"). This migration re-creates the function with:
--     * v_ref declared,
--     * mapping guard enforcing ONLY required inputs (optional inputs may be
--       left unmapped),
--     * Persian error text instead of the accidental German placeholder,
--     * the dead first loop removed.
--   Signature, grants and all other functions stay untouched.
-- ==========================================================================

begin;

create or replace function public.rule_center_save_connection(
  p_version_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_mapping jsonb,
  p_decided_status text default 'UNCHECKED',
  p_decided_doc text default null,
  p_active boolean default true,
  p_target_ref text default null
) returns uuid
language plpgsql security definer set search_path = pg_catalog as $$
declare
  uid uuid := auth.uid();
  v_conn uuid;
  v_rule_kind text;
  v_required_keys text[] := '{}'::text[];
  v_ref text;
  v_rec record;
begin
  if uid is null or not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;
  if p_mapping is null or jsonb_typeof(p_mapping) <> 'object' then
    raise exception 'نگاشت ورودی‌ها باید شیء ساختاریافته باشد' using errcode = '22023';
  end if;
  select r.kind into v_rule_kind
  from public.rule_center_versions v join public.rule_center_rules r on r.id = v.rule_id
  where v.id = p_version_id;
  if not found then raise exception 'version not found' using errcode = 'P0002'; end if;

  -- نگاشت باید زیرمجموعهٔ ورودی‌های تعریف‌شده باشد؛ ورودی‌های الزامی قاعده باید در
  -- نگاشت اتصال تعیین شده باشند (ورودی اختیاری می‌تواند خالی بماند).
  if not (p_mapping = '{}'::jsonb) then
    for v_rec in select * from jsonb_array_elements(coalesce((select inputs from public.rule_center_versions where id = p_version_id), '[]'::jsonb)) as t(value) loop
      v_ref := v_rec.value ->> 'key';
      if coalesce((v_rec.value ->> 'required')::boolean, false)
         and v_ref is not null and v_ref <> '' and not (p_mapping ? v_ref) then
        raise exception 'ورودی الزامی «%» در نگاشت اتصال تعیین نشده است', v_ref using errcode = '23514';
      end if;
    end loop;
    if exists (
      select 1
      from jsonb_object_keys(p_mapping) k
      where not exists (
        select 1 from jsonb_array_elements(coalesce((select inputs from public.rule_center_versions where id = p_version_id), '[]'::jsonb)) t
        where t.value ->> 'key' = k
      )
    ) then
      raise exception 'نگاشت شامل کلید ورودی ناشناخته است' using errcode = '22023';
    end if;
  end if;

  if p_target_type = 'ACTION_STEP' and p_target_ref is null then
    raise exception 'برای اقدام، شناسهٔ پایدار اقدام (step_ref) الزامی است' using errcode = '22023';
  end if;
  if p_active then
    update public.rule_center_connections
    set status = 'HISTORY', updated_at = now()
    where target_type = p_target_type and target_id = p_target_id and status = 'ACTIVE'
      and version_id <> p_version_id
      and (p_target_type <> 'ACTION_STEP' or target_ref = p_target_ref);
    update public.rule_center_connections
    set version_id = p_version_id, mapping = p_mapping, target_ref = p_target_ref,
        decided_status = coalesce(p_decided_status, 'UNCHECKED'), decided_doc = p_decided_doc,
        decided_by = case when p_decided_status is not null then uid end,
        decided_at = case when p_decided_status is not null then now() end,
        status = 'ACTIVE', updated_at = now()
    where target_type = p_target_type and target_id = p_target_id and status = 'ACTIVE'
      and version_id = p_version_id
      and (p_target_type <> 'ACTION_STEP' or target_ref = p_target_ref)
    returning id into v_conn;
    if v_conn is null then
      insert into public.rule_center_connections (version_id, target_type, target_id, target_ref, mapping, status, decided_status, decided_doc, decided_by, decided_at)
      values (p_version_id, p_target_type, p_target_id, p_target_ref, p_mapping, 'ACTIVE', coalesce(p_decided_status, 'UNCHECKED'), p_decided_doc,
              case when p_decided_status is not null then uid end, case when p_decided_status is not null then now() end)
      returning id into v_conn;
    end if;
  else
    insert into public.rule_center_connections (version_id, target_type, target_id, target_ref, mapping, status, decided_status, decided_doc)
    values (p_version_id, p_target_type, p_target_id, p_target_ref, p_mapping, 'DRAFT', coalesce(p_decided_status, 'UNCHECKED'), p_decided_doc)
    returning id into v_conn;
  end if;
  return v_conn;
end;
$$;
revoke all on function public.rule_center_save_connection(uuid, text, uuid, jsonb, text, text, boolean, text) from public, anon;
grant execute on function public.rule_center_save_connection(uuid, text, uuid, jsonb, text, text, boolean, text) to authenticated;

commit;