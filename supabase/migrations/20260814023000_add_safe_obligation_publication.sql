begin;

create function public.publish_obligation_version(requested_version_id uuid)
returns public.obligation_versions
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  uid uuid:=auth.uid();
  selected_version public.obligation_versions;
  rule_type text;
begin
  if uid is null
     or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
     or not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode='42501';
  end if;

  select * into selected_version
  from public.obligation_versions
  where id=requested_version_id
  for update;

  if selected_version.id is null or selected_version.status='PUBLISHED' then
    raise exception 'an unpublished obligation version is required' using errcode='22023';
  end if;
  if selected_version.effective_from is null
     or selected_version.source_url is null
     or btrim(coalesce(selected_version.legal_reference,''))='' then
    raise exception 'effective date, official source URL and legal reference are required' using errcode='22023';
  end if;
  if not exists(
    select 1
    from public.workflow_templates wt
    join public.workflow_steps ws on ws.workflow_template_id=wt.id
    where wt.obligation_version_id=selected_version.id
  ) then
    raise exception 'at least one workflow step is required before publication' using errcode='22023';
  end if;
  if not exists(
    select 1 from public.eligibility_rule_sets
    where obligation_version_id=selected_version.id
  ) then
    raise exception 'at least one explainable eligibility rule is required before publication' using errcode='22023';
  end if;

  rule_type:=coalesce(selected_version.penalty_rule->>'type','NONE');
  if rule_type not in('NONE','FIXED','PERCENTAGE','DAILY_PERCENTAGE') then
    raise exception 'unsupported penalty rule type' using errcode='22023';
  end if;
  if rule_type='FIXED' and (
    jsonb_typeof(selected_version.penalty_rule->'amount')<>'number'
    or (selected_version.penalty_rule->>'amount')::numeric<0
  ) then
    raise exception 'fixed penalty requires a non-negative numeric amount' using errcode='22023';
  end if;
  if rule_type in('PERCENTAGE','DAILY_PERCENTAGE') and (
    jsonb_typeof(selected_version.penalty_rule->'rate_percent')<>'number'
    or (selected_version.penalty_rule->>'rate_percent')::numeric<0
  ) then
    raise exception 'percentage penalty requires a non-negative numeric rate' using errcode='22023';
  end if;
  if selected_version.penalty_rule?'cap_amount' and (
    jsonb_typeof(selected_version.penalty_rule->'cap_amount')<>'number'
    or (selected_version.penalty_rule->>'cap_amount')::numeric<0
  ) then
    raise exception 'penalty cap must be a non-negative number' using errcode='22023';
  end if;

  update public.obligation_versions
  set status='PUBLISHED',published_by=uid,published_at=now()
  where id=selected_version.id
  returning * into selected_version;
  return selected_version;
end;
$$;
revoke all on function public.publish_obligation_version(uuid) from public,anon,authenticated,service_role;
grant execute on function public.publish_obligation_version(uuid) to authenticated;

commit;
