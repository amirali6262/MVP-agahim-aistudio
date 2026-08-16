begin;

-- An original due date is the legal baseline for a case step. Extensions are
-- separate records, but two ORIGINAL rows for the same case/step are invalid.
-- PostgreSQL treats NULLs as distinct in a normal unique index, so the
-- case-level (NULL step) and step-level forms need separate partial indexes.
create unique index case_deadlines_one_original_per_step_idx
  on public.case_deadlines (case_id, workflow_step_id)
  where deadline_type = 'ORIGINAL' and workflow_step_id is not null;

create unique index case_deadlines_one_case_original_idx
  on public.case_deadlines (case_id)
  where deadline_type = 'ORIGINAL' and workflow_step_id is null;

create or replace function public.set_case_deadline(
  requested_case_id uuid,
  requested_workflow_step_id uuid,
  requested_deadline_type text,
  requested_due_at timestamptz,
  requested_source_circular_id uuid default null,
  requested_reason text default null
)
returns public.case_deadlines
language plpgsql
security definer
set search_path = pg_catalog
as $deadline$
declare
  uid uuid := auth.uid();
  selected_case public.compliance_cases;
  selected_circular public.legal_circulars;
  saved public.case_deadlines;
begin
  if uid is null
     or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
     or not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;

  if requested_deadline_type not in ('ORIGINAL', 'EXTENSION')
     or requested_due_at is null then
    raise exception 'valid deadline type and due date required'
      using errcode = '22023';
  end if;

  select *
  into selected_case
  from public.compliance_cases
  where id = requested_case_id
  for update;

  if selected_case.id is null then
    raise exception 'case not found' using errcode = 'P0002';
  end if;

  if requested_workflow_step_id is not null and not exists (
    select 1
    from public.workflow_steps step
    where step.id = requested_workflow_step_id
      and step.workflow_template_id = selected_case.workflow_template_id
  ) then
    raise exception 'workflow step does not belong to case'
      using errcode = '22023';
  end if;

  if requested_deadline_type = 'EXTENSION'
     and requested_source_circular_id is null then
    raise exception 'published source circular required for extension'
      using errcode = '22023';
  end if;

  if requested_source_circular_id is not null then
    select *
    into selected_circular
    from public.legal_circulars
    where id = requested_source_circular_id;

    if selected_circular.id is null
       or selected_circular.status <> 'PUBLISHED' then
      raise exception 'published source circular required'
        using errcode = '22023';
    end if;

    if selected_circular.obligation_version_id
       <> selected_case.obligation_version_id then
      raise exception 'source circular does not belong to case obligation version'
        using errcode = '22023';
    end if;
  end if;

  insert into public.case_deadlines (
    case_id, workflow_step_id, deadline_type, due_at,
    source_circular_id, reason, created_by
  ) values (
    selected_case.id, requested_workflow_step_id, requested_deadline_type,
    requested_due_at, requested_source_circular_id, requested_reason, uid
  )
  returning * into saved;

  return saved;
end;
$deadline$;

revoke all on function public.set_case_deadline(uuid, uuid, text, timestamptz, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.set_case_deadline(uuid, uuid, text, timestamptz, uuid, text)
  to authenticated;

create or replace function public.publish_circular_and_notify(
  requested_circular_id uuid,
  requested_action_url text default '/panel/dashboard'
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog
as $circular$
declare
  uid uuid := auth.uid();
  selected_circular public.legal_circulars;
  inserted_count integer;
begin
  if uid is null
     or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
     or not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;

  if requested_action_url is null or requested_action_url !~ '^/' then
    raise exception 'internal action URL required' using errcode = '22023';
  end if;

  select *
  into selected_circular
  from public.legal_circulars
  where id = requested_circular_id
  for update;

  if selected_circular.id is null or selected_circular.status <> 'DRAFT' then
    raise exception 'draft circular required' using errcode = '22023';
  end if;

  update public.legal_circulars
  set status = 'PUBLISHED',
      published_by = uid,
      published_at = now()
  where id = selected_circular.id
  returning * into selected_circular;

  with latest_current_assessment as (
    select distinct on (assessment.tenant_id)
      assessment.tenant_id,
      assessment.outcome
    from public.eligibility_assessments assessment
    join public.tenant_profile_versions profile
      on profile.id = assessment.profile_version_id
     and profile.tenant_id = assessment.tenant_id
     and profile.valid_to is null
    where assessment.obligation_version_id
          = selected_circular.obligation_version_id
    order by assessment.tenant_id,
             assessment.evaluated_at desc,
             assessment.id desc
  )
  insert into public.notifications (
    tenant_id, user_id, circular_id, kind, title, body,
    action_url, deduplication_key
  )
  select assessment.tenant_id,
         membership.user_id,
         selected_circular.id,
         'CIRCULAR',
         selected_circular.title,
         selected_circular.summary,
         requested_action_url,
         'circular:' || selected_circular.id::text
           || ':user:' || membership.user_id::text
  from latest_current_assessment assessment
  join public.user_tenants membership
    on membership.tenant_id = assessment.tenant_id
  where assessment.outcome = 'ELIGIBLE'
  on conflict (deduplication_key) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$circular$;

revoke all on function public.publish_circular_and_notify(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.publish_circular_and_notify(uuid, text)
  to authenticated;

commit;
