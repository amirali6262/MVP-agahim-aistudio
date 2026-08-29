-- ==========================================================================
-- Migration: delete_obligation_cascade
-- Date: 2026-09-01
-- Purpose: The Studio previously deleted an obligation from the client with
--          plain Supabase queries. Tenant-facing tables (tenant_obligation_
--          fulfillments, deadline_extensions) are protected by RLS, so those
--          deletes failed with "permission denied". This SECURITY DEFINER RPC
--          runs as the table owner (bypassing RLS), is restricted to platform
--          admins, refuses obligations with live references, and deletes every
--          definition row in one transaction.
-- ==========================================================================

begin;

create or replace function public.delete_obligation_cascade(p_obligation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $fn$
declare
  uid uuid := auth.uid();
  v_version_ids uuid[];
  v_blockers text[] := '{}';
begin
  if uid is null
     or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
     or not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;

  if p_obligation_id is null then
    raise exception 'obligation id required' using errcode = '22023';
  end if;

  if not exists (select 1 from public.obligations where id = p_obligation_id) then
    raise exception 'obligation not found' using errcode = 'P0002';
  end if;

  -- Published / retired versions are legal documents and must first be
  -- reopened to DRAFT (reopen_obligation_version) before the obligation can
  -- be deleted.
  if exists (
    select 1 from public.obligation_versions
    where obligation_id = p_obligation_id and status in ('PUBLISHED', 'RETIRED')
  ) then
    raise exception 'obligation has published or retired versions; reopen them to draft before deleting'
      using errcode = '23503';
  end if;

  select coalesce(array_agg(id), '{}'::uuid[])
  into v_version_ids
  from public.obligation_versions
  where obligation_id = p_obligation_id;

  -- Hard blockers: any live operational reference makes deletion impossible.
  if exists (select 1 from public.company_menu m where m.form_obligation_id = p_obligation_id) then
    v_blockers := v_blockers || 'منوی منتشرشده فضای شرکت';
  end if;
  if exists (select 1 from public.compliance_cases c where c.obligation_version_id = any(v_version_ids)) then
    v_blockers := v_blockers || 'پرونده‌های انطباق';
  end if;
  if exists (select 1 from public.eligibility_assessments a where a.obligation_version_id = any(v_version_ids)) then
    v_blockers := v_blockers || 'ارزیابی‌های مشمولیت';
  end if;
  if exists (select 1 from public.obligation_review_requests r where r.obligation_version_id = any(v_version_ids)) then
    v_blockers := v_blockers || 'درخواست‌های بازبینی';
  end if;
  if exists (select 1 from public.penalty_estimates p where p.obligation_version_id = any(v_version_ids)) then
    v_blockers := v_blockers || 'برآوردهای جریمه';
  end if;
  if exists (select 1 from public.legal_circulars lc where lc.obligation_version_id = any(v_version_ids)) then
    v_blockers := v_blockers || 'بخشنامه‌های مرتبط';
  end if;

  if array_length(v_blockers, 1) > 0 then
    raise exception 'obligation is referenced by: %', array_to_string(v_blockers, '، ')
      using errcode = '23503';
  end if;

  -- Soft references (menu drafts, tenant fulfillments, extensions) are removed
  -- first so nothing dangles after the obligation row disappears.
  delete from public.company_menu_drafts where form_obligation_id = p_obligation_id;
  delete from public.tenant_obligation_fulfillments where obligation_id = p_obligation_id;
  delete from public.deadline_extensions where obligation_id = p_obligation_id;

  if array_length(v_version_ids, 1) > 0 then
    delete from public.eligibility_conditions c
    where c.rule_set_id in (
      select rs.id from public.eligibility_rule_sets rs
      where rs.obligation_version_id = any(v_version_ids)
    );
    delete from public.eligibility_rule_sets
    where obligation_version_id = any(v_version_ids);

    delete from public.workflow_transitions t
    where t.workflow_template_id in (
      select wt.id from public.workflow_templates wt
      where wt.obligation_version_id = any(v_version_ids)
    );
    delete from public.workflow_steps s
    where s.workflow_template_id in (
      select wt.id from public.workflow_templates wt
      where wt.obligation_version_id = any(v_version_ids)
    );
    delete from public.workflow_templates
    where obligation_version_id = any(v_version_ids);

    delete from public.obligation_version_penalties
    where obligation_version_id = any(v_version_ids);

    delete from public.obligation_versions
    where id = any(v_version_ids);
  end if;

  delete from public.obligations where id = p_obligation_id;

  return jsonb_build_object(
    'deleted_obligation_id', p_obligation_id,
    'deleted_versions', coalesce(array_length(v_version_ids, 1), 0)
  );
end;
$fn$;

revoke all on function public.delete_obligation_cascade(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.delete_obligation_cascade(uuid)
  to authenticated;

do $$
begin
  if has_function_privilege('anon', 'public.delete_obligation_cascade(uuid)', 'EXECUTE') then
    raise exception 'anon can execute delete_obligation_cascade';
  end if;
end
$$;

comment on function public.delete_obligation_cascade(uuid)
  is 'Cascade-deletes an obligation and its definition rows in one transaction; platform admin only. Live references and published/retired versions are rejected.';

commit;
