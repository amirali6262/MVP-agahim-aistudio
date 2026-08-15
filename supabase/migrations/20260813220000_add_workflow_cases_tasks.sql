begin;

create table public.workflow_templates (
  id uuid primary key default extensions.gen_random_uuid(),
  obligation_version_id uuid not null unique references public.obligation_versions(id) on delete cascade,
  title text not null constraint workflow_templates_title_check check (btrim(title) <> ''),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workflow_steps (
  id uuid primary key default extensions.gen_random_uuid(),
  workflow_template_id uuid not null references public.workflow_templates(id) on delete cascade,
  sequence integer not null constraint workflow_steps_sequence_check check (sequence > 0),
  code text not null constraint workflow_steps_code_check check (code ~ '^[A-Z][A-Z0-9_]{1,79}$'),
  title text not null constraint workflow_steps_title_check check (btrim(title) <> ''),
  actor text not null constraint workflow_steps_actor_check check (actor in ('USER', 'PLATFORM_ADMIN', 'AUTHORITY')),
  due_rule jsonb not null default '{}'::jsonb constraint workflow_steps_due_rule_check check (jsonb_typeof(due_rule) = 'object'),
  form_schema jsonb not null default '{"fields":[]}'::jsonb
    constraint workflow_steps_form_schema_check check (
      jsonb_typeof(form_schema) = 'object'
      and jsonb_typeof(form_schema -> 'fields') = 'array'
    ),
  instructions text,
  is_optional boolean not null default false,
  created_at timestamptz not null default now(),
  constraint workflow_steps_template_sequence_key unique (workflow_template_id, sequence),
  constraint workflow_steps_template_code_key unique (workflow_template_id, code)
);

create table public.compliance_cases (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  obligation_version_id uuid not null references public.obligation_versions(id) on delete restrict,
  assessment_id uuid not null references public.eligibility_assessments(id) on delete restrict,
  workflow_template_id uuid not null references public.workflow_templates(id) on delete restrict,
  period_key text not null constraint compliance_cases_period_key_check check (btrim(period_key) <> ''),
  status text not null default 'OPEN'
    constraint compliance_cases_status_check check (status in ('OPEN', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED')),
  current_step_id uuid references public.workflow_steps(id) on delete restrict,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint compliance_cases_tenant_obligation_period_key unique (tenant_id, obligation_version_id, period_key),
  constraint compliance_cases_closed_check check (
    (status in ('COMPLETED', 'CANCELLED') and closed_at is not null)
    or (status not in ('COMPLETED', 'CANCELLED') and closed_at is null)
  )
);

create table public.case_tasks (
  id uuid primary key default extensions.gen_random_uuid(),
  case_id uuid not null references public.compliance_cases(id) on delete cascade,
  workflow_step_id uuid not null references public.workflow_steps(id) on delete restrict,
  status text not null default 'PENDING'
    constraint case_tasks_status_check check (status in ('PENDING', 'ACTIVE', 'COMPLETED', 'SKIPPED', 'BLOCKED')),
  due_at timestamptz,
  response_data jsonb not null default '{}'::jsonb constraint case_tasks_response_check check (jsonb_typeof(response_data) = 'object'),
  completed_by uuid references auth.users(id) on delete restrict,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_tasks_case_step_key unique (case_id, workflow_step_id),
  constraint case_tasks_completion_check check (
    (status = 'COMPLETED' and completed_by is not null and completed_at is not null)
    or (status <> 'COMPLETED' and completed_at is null)
  )
);

create index workflow_templates_created_by_idx on public.workflow_templates(created_by);
create index workflow_steps_template_idx on public.workflow_steps(workflow_template_id);
create index compliance_cases_tenant_status_idx on public.compliance_cases(tenant_id, status);
create index compliance_cases_assessment_idx on public.compliance_cases(assessment_id);
create index compliance_cases_workflow_idx on public.compliance_cases(workflow_template_id);
create index compliance_cases_current_step_idx on public.compliance_cases(current_step_id) where current_step_id is not null;
create index case_tasks_case_status_idx on public.case_tasks(case_id, status);
create index case_tasks_step_idx on public.case_tasks(workflow_step_id);
create index case_tasks_completed_by_idx on public.case_tasks(completed_by) where completed_by is not null;

create trigger workflow_templates_set_updated_at before update on public.workflow_templates
  for each row execute function public.set_updated_at();
create trigger compliance_cases_set_updated_at before update on public.compliance_cases
  for each row execute function public.set_updated_at();
create trigger case_tasks_set_updated_at before update on public.case_tasks
  for each row execute function public.set_updated_at();

create function public.protect_published_workflow_definition()
returns trigger
language plpgsql security definer set search_path = pg_catalog
as $$
declare version_id uuid;
begin
  if tg_table_name = 'workflow_templates' then
    version_id := case when tg_op='DELETE' then old.obligation_version_id else new.obligation_version_id end;
  else
    select obligation_version_id into version_id from public.workflow_templates
    where id = case when tg_op='DELETE' then old.workflow_template_id else new.workflow_template_id end;
  end if;
  if exists(select 1 from public.obligation_versions where id=version_id and status='PUBLISHED') then
    raise exception 'workflow of a published obligation version is immutable' using errcode='23514';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.protect_published_workflow_definition() from public,anon,authenticated,service_role;
create trigger workflow_templates_protect_published before insert or update or delete on public.workflow_templates
  for each row execute function public.protect_published_workflow_definition();
create trigger workflow_steps_protect_published before insert or update or delete on public.workflow_steps
  for each row execute function public.protect_published_workflow_definition();

alter table public.workflow_templates enable row level security;
alter table public.workflow_steps enable row level security;
alter table public.compliance_cases enable row level security;
alter table public.case_tasks enable row level security;
revoke all on table public.workflow_templates,public.workflow_steps,public.compliance_cases,public.case_tasks from public,anon,authenticated;
grant select,insert,delete on table public.workflow_templates,public.workflow_steps to authenticated;
grant update(title) on table public.workflow_templates to authenticated;
grant update(sequence,code,title,actor,due_rule,form_schema,instructions,is_optional)
  on table public.workflow_steps to authenticated;
grant select on table public.compliance_cases,public.case_tasks to authenticated;

create policy workflow_templates_read on public.workflow_templates for select to authenticated
using (exists(select 1 from public.obligation_versions ov where ov.id=obligation_version_id and ov.status='PUBLISHED') or (select private.is_platform_admin()));
create policy workflow_templates_admin_insert on public.workflow_templates for insert to authenticated
with check ((select private.is_platform_admin()) and created_by=(select auth.uid()));
create policy workflow_templates_admin_update on public.workflow_templates for update to authenticated
using ((select private.is_platform_admin())) with check ((select private.is_platform_admin()));
create policy workflow_templates_admin_delete on public.workflow_templates for delete to authenticated
using ((select private.is_platform_admin()));
create policy workflow_steps_read on public.workflow_steps for select to authenticated
using (exists(select 1 from public.workflow_templates wt join public.obligation_versions ov on ov.id=wt.obligation_version_id where wt.id=workflow_template_id and ov.status='PUBLISHED') or (select private.is_platform_admin()));
create policy workflow_steps_admin_insert on public.workflow_steps for insert to authenticated
with check ((select private.is_platform_admin()));
create policy workflow_steps_admin_update on public.workflow_steps for update to authenticated
using ((select private.is_platform_admin())) with check ((select private.is_platform_admin()));
create policy workflow_steps_admin_delete on public.workflow_steps for delete to authenticated
using ((select private.is_platform_admin()));
create policy compliance_cases_member_read on public.compliance_cases for select to authenticated
using (private.is_tenant_member(tenant_id));
create policy case_tasks_member_read on public.case_tasks for select to authenticated
using (exists(select 1 from public.compliance_cases cc where cc.id=case_id and private.is_tenant_member(cc.tenant_id)));

create function public.open_eligible_cases(requested_tenant_id uuid, requested_period_key text)
returns setof public.compliance_cases
language plpgsql security definer set search_path = pg_catalog
as $$
declare uid uuid:=auth.uid(); a public.eligibility_assessments; wt public.workflow_templates; first_step uuid; saved public.compliance_cases;
begin
  if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or not private.is_tenant_member(requested_tenant_id) then
    raise exception 'tenant membership required' using errcode='42501';
  end if;
  if requested_period_key is null or btrim(requested_period_key)='' then raise exception 'period key required' using errcode='22023'; end if;
  for a in select distinct on(obligation_version_id) * from public.eligibility_assessments
    where tenant_id=requested_tenant_id and outcome='ELIGIBLE' order by obligation_version_id,evaluated_at desc
  loop
    select * into wt from public.workflow_templates where obligation_version_id=a.obligation_version_id;
    if wt.id is null then continue; end if;
    select id into first_step from public.workflow_steps where workflow_template_id=wt.id order by sequence limit 1;
    if first_step is null then continue; end if;
    insert into public.compliance_cases(tenant_id,obligation_version_id,assessment_id,workflow_template_id,period_key,status,current_step_id)
    values(requested_tenant_id,a.obligation_version_id,a.id,wt.id,btrim(requested_period_key),'IN_PROGRESS',first_step)
    on conflict(tenant_id,obligation_version_id,period_key) do update set assessment_id=excluded.assessment_id
    returning * into saved;
    insert into public.case_tasks(case_id,workflow_step_id,status)
    select saved.id,s.id,case when s.id=first_step then 'ACTIVE' else 'PENDING' end from public.workflow_steps s where s.workflow_template_id=wt.id
    on conflict(case_id,workflow_step_id) do nothing;
    return next saved;
  end loop;
  return;
end;
$$;
revoke all on function public.open_eligible_cases(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.open_eligible_cases(uuid,text) to authenticated;

create function public.complete_case_task(requested_task_id uuid, requested_response jsonb default '{}'::jsonb)
returns public.compliance_cases
language plpgsql security definer set search_path = pg_catalog
as $$
declare uid uuid:=auth.uid(); task public.case_tasks; selected_case public.compliance_cases; next_task public.case_tasks;
begin
  if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'authentication required' using errcode='42501'; end if;
  select * into task from public.case_tasks where id=requested_task_id for update;
  if task.id is null or task.status<>'ACTIVE' then raise exception 'active task required' using errcode='22023'; end if;
  select * into selected_case from public.compliance_cases where id=task.case_id for update;
  if not private.is_tenant_member(selected_case.tenant_id) then raise exception 'tenant membership required' using errcode='42501'; end if;
  if requested_response is null or jsonb_typeof(requested_response)<>'object' then raise exception 'response must be a JSON object' using errcode='22023'; end if;
  update public.case_tasks set status='COMPLETED',response_data=requested_response,completed_by=uid,completed_at=now() where id=task.id;
  select ct.* into next_task from public.case_tasks ct join public.workflow_steps ws on ws.id=ct.workflow_step_id
    where ct.case_id=task.case_id and ct.status='PENDING' order by ws.sequence limit 1 for update of ct;
  if next_task.id is null then
    update public.compliance_cases set status='COMPLETED',current_step_id=null,closed_at=now() where id=selected_case.id returning * into selected_case;
  else
    update public.case_tasks set status='ACTIVE' where id=next_task.id;
    update public.compliance_cases set current_step_id=next_task.workflow_step_id where id=selected_case.id returning * into selected_case;
  end if;
  return selected_case;
end;
$$;
revoke all on function public.complete_case_task(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.complete_case_task(uuid,jsonb) to authenticated;

commit;
