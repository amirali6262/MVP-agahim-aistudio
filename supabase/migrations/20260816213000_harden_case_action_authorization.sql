begin;

-- Opening cases changes shared tenant state. Reading a tenant is not enough to
-- authorize that mutation; only tenant owners and tenant admins may perform it.
create or replace function public.open_eligible_cases(
  requested_tenant_id uuid,
  requested_period_key text
)
returns setof public.compliance_cases
language plpgsql
security definer
set search_path = pg_catalog
as $open_cases$
declare
  uid uuid := auth.uid();
  assessment public.eligibility_assessments;
  workflow public.workflow_templates;
  first_step uuid;
  saved public.compliance_cases;
begin
  if uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not private.has_tenant_role(requested_tenant_id, array['OWNER', 'ADMIN']) then
    raise exception 'tenant owner or admin role required' using errcode = '42501';
  end if;

  if requested_period_key is null or btrim(requested_period_key) = '' then
    raise exception 'period key required' using errcode = '22023';
  end if;

  for assessment in
    select latest.*
    from (
      select distinct on (candidate.obligation_version_id) candidate.*
      from public.eligibility_assessments candidate
      join public.tenant_profile_versions profile
        on profile.id = candidate.profile_version_id
       and profile.tenant_id = candidate.tenant_id
       and profile.valid_to is null
      where candidate.tenant_id = requested_tenant_id
      order by candidate.obligation_version_id,
               candidate.evaluated_at desc,
               candidate.id desc
    ) latest
    where latest.outcome = 'ELIGIBLE'
  loop
    select * into workflow
    from public.workflow_templates
    where obligation_version_id = assessment.obligation_version_id;

    if workflow.id is null then
      continue;
    end if;

    select id into first_step
    from public.workflow_steps
    where workflow_template_id = workflow.id
    order by sequence
    limit 1;

    if first_step is null then
      continue;
    end if;

    insert into public.compliance_cases (
      tenant_id, obligation_version_id, assessment_id,
      workflow_template_id, period_key, status, current_step_id
    ) values (
      requested_tenant_id, assessment.obligation_version_id, assessment.id,
      workflow.id, btrim(requested_period_key), 'IN_PROGRESS', first_step
    )
    on conflict (tenant_id, obligation_version_id, period_key)
    do update set assessment_id = excluded.assessment_id
    returning * into saved;

    insert into public.case_tasks (case_id, workflow_step_id, status)
    select
      saved.id,
      step.id,
      case when step.id = first_step then 'ACTIVE' else 'PENDING' end
    from public.workflow_steps step
    where step.workflow_template_id = workflow.id
    on conflict (case_id, workflow_step_id) do nothing;

    return next saved;
  end loop;

  return;
end;
$open_cases$;

revoke all on function public.open_eligible_cases(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.open_eligible_cases(uuid, text)
  to authenticated;

-- USER steps currently have no assignment column. Until explicit assignment is
-- modeled, only tenant owners/admins may complete them; ordinary members remain
-- read-only. Platform-only steps retain their existing platform-admin boundary.
create or replace function public.complete_case_task(
  requested_task_id uuid,
  requested_response jsonb default '{}'::jsonb
)
returns public.compliance_cases
language plpgsql
security definer
set search_path = pg_catalog
as $complete_task$
declare
  uid uuid := auth.uid();
  task public.case_tasks;
  selected_case public.compliance_cases;
  selected_step public.workflow_steps;
  next_task public.case_tasks;
  caller_is_admin boolean;
begin
  if uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into task
  from public.case_tasks
  where id = requested_task_id
  for update;

  if task.id is null or task.status <> 'ACTIVE' then
    raise exception 'active task required' using errcode = '22023';
  end if;

  select * into selected_case
  from public.compliance_cases
  where id = task.case_id
  for update;

  select * into selected_step
  from public.workflow_steps
  where id = task.workflow_step_id;

  caller_is_admin := private.is_platform_admin();

  if selected_step.actor = 'USER' then
    if not private.has_tenant_role(selected_case.tenant_id, array['OWNER', 'ADMIN']) then
      raise exception 'tenant owner or admin role required' using errcode = '42501';
    end if;
  elsif not caller_is_admin then
    raise exception 'platform admin required for this task' using errcode = '42501';
  end if;

  perform private.validate_workflow_task_response(
    selected_step.form_schema,
    requested_response
  );

  update public.case_tasks
  set status = 'COMPLETED',
      response_data = requested_response,
      completed_by = uid,
      completed_at = now()
  where id = task.id;

  select case_task.* into next_task
  from public.case_tasks case_task
  join public.workflow_steps step on step.id = case_task.workflow_step_id
  where case_task.case_id = task.case_id
    and case_task.status = 'PENDING'
  order by step.sequence
  limit 1
  for update of case_task;

  if next_task.id is null then
    update public.compliance_cases
    set status = 'COMPLETED',
        current_step_id = null,
        closed_at = now()
    where id = selected_case.id
    returning * into selected_case;
  else
    update public.case_tasks
    set status = 'ACTIVE'
    where id = next_task.id;

    update public.compliance_cases
    set current_step_id = next_task.workflow_step_id
    where id = selected_case.id
    returning * into selected_case;
  end if;

  return selected_case;
end;
$complete_task$;

revoke all on function public.complete_case_task(uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.complete_case_task(uuid, jsonb)
  to authenticated;

comment on function public.open_eligible_cases(uuid, text) is
  'Atomically opens eligible tenant cases. Restricted to tenant OWNER and ADMIN roles.';
comment on function public.complete_case_task(uuid, jsonb) is
  'Completes and advances an active case task. USER steps require tenant OWNER or ADMIN until explicit task assignment is modeled; platform steps require PLATFORM_ADMIN.';

commit;
