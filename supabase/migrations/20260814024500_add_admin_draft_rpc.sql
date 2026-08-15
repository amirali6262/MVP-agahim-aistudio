begin;

create function public.create_obligation_draft(
  requested_family_id uuid,
  requested_code text,
  requested_title text,
  requested_summary text,
  requested_authority_name text,
  requested_official_action_url text,
  requested_legal_reference text,
  requested_source_url text,
  requested_effective_from date,
  requested_recurrence_rule jsonb default '{}'::jsonb,
  requested_deadline_rule jsonb default '{}'::jsonb,
  requested_penalty_rule jsonb default '{"type":"NONE"}'::jsonb
)
returns public.obligation_versions
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  uid uuid:=auth.uid();
  created_obligation public.obligations;
  created_version public.obligation_versions;
begin
  if uid is null
     or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
     or not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode='42501';
  end if;
  if not exists(select 1 from public.obligation_families where id=requested_family_id) then
    raise exception 'obligation family not found' using errcode='P0002';
  end if;
  if requested_code is null or requested_code!~'^[A-Z][A-Z0-9_]{1,79}$'
     or requested_title is null or btrim(requested_title)='' then
    raise exception 'valid code and title are required' using errcode='22023';
  end if;
  if requested_official_action_url is not null and requested_official_action_url!~'^https://'
     or requested_source_url is not null and requested_source_url!~'^https://' then
    raise exception 'official URLs must use HTTPS' using errcode='22023';
  end if;
  if jsonb_typeof(requested_recurrence_rule)<>'object'
     or jsonb_typeof(requested_deadline_rule)<>'object'
     or jsonb_typeof(requested_penalty_rule)<>'object' then
    raise exception 'rule definitions must be JSON objects' using errcode='22023';
  end if;

  insert into public.obligations(
    family_id,code,title,summary,authority_name,official_action_url,created_by
  ) values(
    requested_family_id,requested_code,btrim(requested_title),requested_summary,
    requested_authority_name,requested_official_action_url,uid
  ) returning * into created_obligation;

  insert into public.obligation_versions(
    obligation_id,version_number,status,legal_reference,source_url,effective_from,
    recurrence_rule,deadline_rule,penalty_rule,created_by
  ) values(
    created_obligation.id,1,'DRAFT',requested_legal_reference,requested_source_url,
    requested_effective_from,requested_recurrence_rule,requested_deadline_rule,
    requested_penalty_rule,uid
  ) returning * into created_version;

  return created_version;
end;
$$;
revoke all on function public.create_obligation_draft(
  uuid,text,text,text,text,text,text,text,date,jsonb,jsonb,jsonb
) from public,anon,authenticated,service_role;
grant execute on function public.create_obligation_draft(
  uuid,text,text,text,text,text,text,text,date,jsonb,jsonb,jsonb
) to authenticated;

commit;
