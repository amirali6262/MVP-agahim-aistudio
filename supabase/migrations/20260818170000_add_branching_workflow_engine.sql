begin;

create table public.workflow_transitions (
  id uuid primary key default extensions.gen_random_uuid(),
  workflow_template_id uuid not null references public.workflow_templates(id) on delete cascade,
  from_step_id uuid not null references public.workflow_steps(id) on delete cascade,
  to_step_id uuid references public.workflow_steps(id) on delete restrict,
  code text not null constraint workflow_transitions_code_check check (code ~ '^[A-Z][A-Z0-9_]{1,79}$'),
  title text not null constraint workflow_transitions_title_check check (btrim(title) <> ''),
  trigger_type text not null constraint workflow_transitions_trigger_check
    check (trigger_type in ('USER_ACTION', 'SYSTEM_EVENT', 'TIMEOUT')),
  event_code text,
  timeout_interval interval,
  terminal_status text constraint workflow_transitions_terminal_check
    check (terminal_status is null or terminal_status in ('COMPLETED', 'CANCELLED')),
  outcome_code text not null,
  legal_reference text,
  description text,
  priority integer not null default 100 constraint workflow_transitions_priority_check check (priority > 0),
  created_at timestamptz not null default now(),
  constraint workflow_transitions_destination_check check (
    (to_step_id is not null and terminal_status is null)
    or (to_step_id is null and terminal_status is not null)
  ),
  constraint workflow_transitions_timeout_check check (
    (trigger_type = 'TIMEOUT' and timeout_interval is not null and timeout_interval > interval '0')
    or (trigger_type <> 'TIMEOUT' and timeout_interval is null)
  ),
  constraint workflow_transitions_event_check check (
    trigger_type <> 'SYSTEM_EVENT' or nullif(btrim(event_code), '') is not null
  ),
  constraint workflow_transitions_template_code_key unique (workflow_template_id, code)
);

create index workflow_transitions_from_step_idx on public.workflow_transitions(from_step_id, priority);
create unique index workflow_transitions_timeout_idx on public.workflow_transitions(from_step_id)
where trigger_type = 'TIMEOUT';

create table public.case_transition_history (
  id uuid primary key default extensions.gen_random_uuid(),
  case_id uuid not null references public.compliance_cases(id) on delete cascade,
  transition_id uuid not null references public.workflow_transitions(id) on delete restrict,
  from_step_id uuid not null references public.workflow_steps(id) on delete restrict,
  to_step_id uuid references public.workflow_steps(id) on delete restrict,
  outcome_code text not null,
  trigger_type text not null,
  response_data jsonb not null default '{}'::jsonb,
  executed_by uuid references auth.users(id) on delete restrict,
  executed_at timestamptz not null default now()
);

create index case_transition_history_case_idx
  on public.case_transition_history(case_id, executed_at desc);

create function public.validate_workflow_transition()
returns trigger language plpgsql security definer set search_path = pg_catalog
as $validate$
begin
  if not exists(select 1 from public.workflow_steps where id = new.from_step_id and workflow_template_id = new.workflow_template_id)
    or (new.to_step_id is not null and not exists(select 1 from public.workflow_steps where id = new.to_step_id and workflow_template_id = new.workflow_template_id)) then
    raise exception 'transition steps must belong to the selected workflow template' using errcode = '23514';
  end if;
  if exists(select 1 from public.workflow_templates template
    join public.obligation_versions version on version.id = template.obligation_version_id
    where template.id = new.workflow_template_id and version.status = 'PUBLISHED') then
    raise exception 'published workflow transitions are immutable' using errcode = '23514';
  end if;
  return new;
end;
$validate$;
revoke all on function public.validate_workflow_transition() from public, anon, authenticated, service_role;
create trigger workflow_transitions_validate before insert or update on public.workflow_transitions
for each row execute function public.validate_workflow_transition();

create function public.protect_workflow_transition_delete()
returns trigger language plpgsql security definer set search_path = pg_catalog
as $protect$
begin
  if exists(select 1 from public.workflow_templates template
    join public.obligation_versions version on version.id = template.obligation_version_id
    where template.id = old.workflow_template_id and version.status = 'PUBLISHED') then
    raise exception 'published workflow transitions are immutable' using errcode = '23514';
  end if;
  return old;
end;
$protect$;
revoke all on function public.protect_workflow_transition_delete() from public, anon, authenticated, service_role;
create trigger workflow_transitions_protect_delete before delete on public.workflow_transitions
for each row execute function public.protect_workflow_transition_delete();

alter table public.workflow_transitions enable row level security;
alter table public.case_transition_history enable row level security;
revoke all on table public.workflow_transitions, public.case_transition_history from public, anon, authenticated;
grant select, insert, update, delete on table public.workflow_transitions to authenticated;
grant select on table public.case_transition_history to authenticated;

create policy workflow_transitions_read on public.workflow_transitions for select to authenticated
using (true);
create policy workflow_transitions_admin_insert on public.workflow_transitions for insert to authenticated
with check ((select private.is_platform_admin()));
create policy workflow_transitions_admin_update on public.workflow_transitions for update to authenticated
using ((select private.is_platform_admin())) with check ((select private.is_platform_admin()));
create policy workflow_transitions_admin_delete on public.workflow_transitions for delete to authenticated
using ((select private.is_platform_admin()));
create policy case_transition_history_member_read on public.case_transition_history for select to authenticated
using (exists (
  select 1 from public.compliance_cases selected_case
  where selected_case.id = case_id
    and ((select private.is_platform_admin()) or private.is_tenant_member(selected_case.tenant_id))
));

create function private.execute_case_transition(
  requested_task_id uuid,
  requested_transition_id uuid,
  requested_response jsonb,
  requested_actor uuid,
  requested_trigger_type text
)
returns public.compliance_cases
language plpgsql security definer set search_path = pg_catalog
as $execute$
declare
  selected_task public.case_tasks;
  selected_case public.compliance_cases;
  selected_transition public.workflow_transitions;
  destination_task public.case_tasks;
begin
  select * into selected_task from public.case_tasks where id = requested_task_id for update;
  if selected_task.id is null or selected_task.status <> 'ACTIVE' then
    raise exception 'active task required' using errcode = '22023';
  end if;
  select * into selected_case from public.compliance_cases where id = selected_task.case_id for update;
  select * into selected_transition from public.workflow_transitions
    where id = requested_transition_id and from_step_id = selected_task.workflow_step_id;
  if selected_transition.id is null or selected_transition.trigger_type <> requested_trigger_type then
    raise exception 'valid transition required' using errcode = '22023';
  end if;

  update public.case_tasks set status = 'COMPLETED', response_data = coalesce(requested_response, '{}'::jsonb),
    completed_by = requested_actor, completed_at = now() where id = selected_task.id;

  if selected_transition.to_step_id is not null then
    select * into destination_task from public.case_tasks
      where case_id = selected_case.id and workflow_step_id = selected_transition.to_step_id for update;
    if destination_task.id is null then raise exception 'destination task missing' using errcode = '23503'; end if;
    update public.case_tasks set status = 'ACTIVE', completed_by = null, completed_at = null
      where id = destination_task.id;
    update public.compliance_cases set status = 'IN_PROGRESS', current_step_id = selected_transition.to_step_id,
      closed_at = null where id = selected_case.id returning * into selected_case;
  else
    update public.compliance_cases set status = selected_transition.terminal_status, current_step_id = null,
      closed_at = now() where id = selected_case.id returning * into selected_case;
  end if;

  insert into public.case_transition_history(case_id, transition_id, from_step_id, to_step_id,
    outcome_code, trigger_type, response_data, executed_by)
  values(selected_case.id, selected_transition.id, selected_task.workflow_step_id,
    selected_transition.to_step_id, selected_transition.outcome_code, selected_transition.trigger_type,
    coalesce(requested_response, '{}'::jsonb), requested_actor);
  return selected_case;
end;
$execute$;
revoke all on function private.execute_case_transition(uuid, uuid, jsonb, uuid, text)
  from public, anon, authenticated, service_role;

drop function public.complete_case_task(uuid, jsonb);

create or replace function public.complete_case_task(
  requested_task_id uuid,
  requested_transition_id uuid,
  requested_response jsonb default '{}'::jsonb
)
returns public.compliance_cases
language plpgsql security definer set search_path = pg_catalog
as $complete$
declare
  uid uuid := auth.uid();
  selected_task public.case_tasks;
  selected_case public.compliance_cases;
  selected_step public.workflow_steps;
  selected_transition public.workflow_transitions;
begin
  if uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  select * into selected_task from public.case_tasks where id = requested_task_id;
  select * into selected_case from public.compliance_cases where id = selected_task.case_id;
  select * into selected_step from public.workflow_steps where id = selected_task.workflow_step_id;
  select * into selected_transition from public.workflow_transitions where id = requested_transition_id;
  if selected_step.actor = 'USER' then
    if not private.has_tenant_role(selected_case.tenant_id, array['OWNER', 'ADMIN']) then
      raise exception 'tenant owner or admin role required' using errcode = '42501';
    end if;
  elsif not private.is_platform_admin() then
    raise exception 'platform admin required for this task' using errcode = '42501';
  end if;
  if selected_transition.trigger_type <> 'USER_ACTION' then
    raise exception 'only user-action transitions can be completed interactively' using errcode = '42501';
  end if;
  perform private.validate_workflow_task_response(selected_step.form_schema, requested_response);
  return private.execute_case_transition(requested_task_id, requested_transition_id,
    requested_response, uid, selected_transition.trigger_type);
end;
$complete$;
revoke all on function public.complete_case_task(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.complete_case_task(uuid, uuid, jsonb) to authenticated;

create function public.record_case_system_event(
  requested_task_id uuid,
  requested_event_code text,
  requested_payload jsonb default '{}'::jsonb
)
returns public.compliance_cases
language plpgsql security definer set search_path = pg_catalog
as $event$
declare
  selected_task public.case_tasks;
  selected_transition public.workflow_transitions;
begin
  if auth.uid() is null or not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;
  select * into selected_task from public.case_tasks where id = requested_task_id;
  select * into selected_transition from public.workflow_transitions
    where from_step_id = selected_task.workflow_step_id
      and trigger_type = 'SYSTEM_EVENT' and event_code = requested_event_code
    order by priority limit 1;
  if selected_transition.id is null then
    raise exception 'matching system-event transition required' using errcode = '22023';
  end if;
  return private.execute_case_transition(requested_task_id, selected_transition.id,
    requested_payload, auth.uid(), 'SYSTEM_EVENT');
end;
$event$;
revoke all on function public.record_case_system_event(uuid, text, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.record_case_system_event(uuid, text, jsonb) to authenticated;

create function private.process_due_workflow_transitions(requested_now timestamptz default now())
returns integer language plpgsql security definer set search_path = pg_catalog
as $timeouts$
declare
  candidate record;
  processed integer := 0;
begin
  for candidate in
    select task.id task_id, transition.id transition_id
    from public.case_tasks task
    join public.workflow_transitions transition on transition.from_step_id = task.workflow_step_id
    join public.compliance_cases selected_case on selected_case.id = task.case_id
    where task.status = 'ACTIVE' and transition.trigger_type = 'TIMEOUT'
      and selected_case.status = 'IN_PROGRESS'
      and coalesce(task.updated_at, task.created_at) + transition.timeout_interval <= requested_now
    order by task.created_at, transition.priority
  loop
    perform private.execute_case_transition(candidate.task_id, candidate.transition_id,
      jsonb_build_object('processed_at', requested_now), null, 'TIMEOUT');
    processed := processed + 1;
  end loop;
  return processed;
end;
$timeouts$;
revoke all on function private.process_due_workflow_transitions(timestamptz)
  from public, anon, authenticated, service_role;

select cron.unschedule(jobid) from cron.job where jobname = 'agahim-workflow-timeouts';
select cron.schedule('agahim-workflow-timeouts', '*/15 * * * *',
  'select private.process_due_workflow_transitions(now())');

commit;
