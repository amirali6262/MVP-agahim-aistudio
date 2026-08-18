begin;

create or replace function public.create_obligation_family(
  requested_code text,
  requested_title text,
  requested_domain text
)
returns public.obligation_families
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare saved public.obligation_families;
begin
  if not private.is_platform_admin() then
    raise exception 'platform admin role required' using errcode = '42501';
  end if;
  insert into public.obligation_families(code, title, domain, created_by)
  values (upper(btrim(requested_code)), btrim(requested_title), requested_domain, auth.uid())
  returning * into saved;
  return saved;
end;
$$;

create or replace function public.delete_workflow_step_definition(requested_step_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog as $$
declare selected_version public.obligation_versions;
begin
  if not private.is_platform_admin() then raise exception 'platform admin role required' using errcode='42501'; end if;
  select version.* into selected_version from public.workflow_steps step
  join public.workflow_templates template on template.id=step.workflow_template_id
  join public.obligation_versions version on version.id=template.obligation_version_id
  where step.id=requested_step_id for update of version;
  if not found then raise exception 'workflow step not found' using errcode='P0002'; end if;
  if selected_version.status <> 'DRAFT' then raise exception 'only draft workflow steps can be deleted' using errcode='23514'; end if;
  if exists(select 1 from public.case_tasks where workflow_step_id=requested_step_id) then raise exception 'step is used by a case and cannot be deleted' using errcode='23503'; end if;
  delete from public.workflow_transitions where from_step_id=requested_step_id or to_step_id=requested_step_id;
  delete from public.workflow_steps where id=requested_step_id;
end;
$$;

create or replace function public.delete_obligation_definition(requested_obligation_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog as $$
begin
  if not private.is_platform_admin() then raise exception 'platform admin role required' using errcode='42501'; end if;
  if exists(select 1 from public.obligation_versions where obligation_id=requested_obligation_id and status <> 'DRAFT') then
    raise exception 'only obligations whose versions are all drafts can be deleted' using errcode='23514';
  end if;
  if exists(select 1 from public.compliance_cases c join public.obligation_versions v on v.id=c.obligation_version_id where v.obligation_id=requested_obligation_id) then
    raise exception 'obligation is used by a case and cannot be deleted' using errcode='23503';
  end if;
  delete from public.eligibility_assessments a using public.obligation_versions v where a.obligation_version_id=v.id and v.obligation_id=requested_obligation_id;
  delete from public.eligibility_rule_sets r using public.obligation_versions v where r.obligation_version_id=v.id and v.obligation_id=requested_obligation_id;
  delete from public.obligation_versions where obligation_id=requested_obligation_id;
  delete from public.obligations where id=requested_obligation_id;
  if not found then raise exception 'obligation not found' using errcode='P0002'; end if;
end;
$$;

revoke all on function public.create_obligation_family(text,text,text), public.delete_workflow_step_definition(uuid), public.delete_obligation_definition(uuid) from public, anon;
grant execute on function public.create_obligation_family(text,text,text), public.delete_workflow_step_definition(uuid), public.delete_obligation_definition(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
