begin;

-- ---------------------------------------------------------------------------
-- get_obligation_usage: usage report for the obligation delete guard.
--
-- Most operational tables (compliance_cases, penalty_estimates, ...) are
-- hidden from the Data API by tenant-membership RLS, so the admin Studio
-- cannot count them with ordinary selects. This SECURITY DEFINER RPC runs as
-- the table owner (bypassing RLS), is restricted to platform admins, and
-- returns every reference point of an obligation and its versions.
-- ---------------------------------------------------------------------------
create or replace function public.get_obligation_usage(requested_obligation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $usage$
declare
  uid uuid := auth.uid();
  v_version_ids uuid[];
begin
  if uid is null
     or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
     or not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;

  select coalesce(array_agg(id), '{}'::uuid[])
  into v_version_ids
  from public.obligation_versions
  where obligation_id = requested_obligation_id;

  return jsonb_build_object(
    'versions',       (select count(*) from public.obligation_versions ov where ov.obligation_id = requested_obligation_id),
    'menu_drafts',    (select count(*) from public.company_menu_drafts d where d.form_obligation_id = requested_obligation_id),
    'menu_published', (select count(*) from public.company_menu m where m.form_obligation_id = requested_obligation_id),
    'fulfillments',   (select count(*) from public.tenant_obligation_fulfillments f where f.obligation_id = requested_obligation_id),
    'extensions',     (select count(*) from public.deadline_extensions e where e.obligation_id = requested_obligation_id),
    'cases',          (select count(*) from public.compliance_cases c where c.obligation_version_id = any(v_version_ids)),
    'case_tasks',     (select count(*) from public.case_tasks t where t.case_id in (select id from public.compliance_cases c where c.obligation_version_id = any(v_version_ids))),
    'case_events',    (select count(*) from public.case_events ev where ev.case_id in (select id from public.compliance_cases c where c.obligation_version_id = any(v_version_ids))),
    'deadlines',      (select count(*) from public.case_deadlines d where d.case_id in (select id from public.compliance_cases c where c.obligation_version_id = any(v_version_ids))),
    'assessments',    (select count(*) from public.eligibility_assessments a where a.obligation_version_id = any(v_version_ids)),
    'reviews',        (select count(*) from public.obligation_review_requests r where r.obligation_version_id = any(v_version_ids)),
    'penalties',      (select count(*) from public.penalty_estimates p where p.obligation_version_id = any(v_version_ids)),
    'circulars',      (select count(*) from public.legal_circulars lc where lc.obligation_version_id = any(v_version_ids)),
    'notifications',  (select count(*) from public.notifications n where n.circular_id in (select id from public.legal_circulars lc where lc.obligation_version_id = any(v_version_ids)))
  );
end;
$usage$;

revoke all on function public.get_obligation_usage(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_obligation_usage(uuid)
  to authenticated;

do $$
begin
  if has_function_privilege('anon', 'public.get_obligation_usage(uuid)', 'EXECUTE') then
    raise exception 'anon can execute get_obligation_usage';
  end if;
end
$$;

comment on function public.get_obligation_usage(uuid)
  is 'Returns usage counts of an obligation and its versions across the system; platform admin only.';

commit;