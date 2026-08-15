begin;

create function private.validate_workflow_form_schema(requested_schema jsonb)
returns void
language plpgsql
immutable
set search_path=pg_catalog
as $$
declare
  field jsonb;
  field_key text;
  field_type text;
  option_value jsonb;
  seen_keys jsonb:='{}'::jsonb;
begin
  if requested_schema is null
     or jsonb_typeof(requested_schema)<>'object'
     or jsonb_typeof(requested_schema->'fields')<>'array'
     or jsonb_array_length(requested_schema->'fields')>50 then
    raise exception 'form_schema must contain an array of at most 50 fields' using errcode='22023';
  end if;

  for field in select value from jsonb_array_elements(requested_schema->'fields')
  loop
    if jsonb_typeof(field)<>'object' then
      raise exception 'each form field must be an object' using errcode='22023';
    end if;
    field_key:=field->>'key';
    field_type:=field->>'type';
    if field_key is null or field_key!~'^[A-Za-z][A-Za-z0-9_]{0,63}$' or seen_keys?field_key then
      raise exception 'form field keys must be unique identifiers' using errcode='22023';
    end if;
    seen_keys:=seen_keys||jsonb_build_object(field_key,true);
    if field->>'label' is null or btrim(field->>'label')='' or length(field->>'label')>200 then
      raise exception 'each form field requires a bounded label' using errcode='22023';
    end if;
    if field_type not in('text','number','date','checkbox','select') then
      raise exception 'unsupported form field type: %',coalesce(field_type,'null') using errcode='22023';
    end if;
    if field?'required' and jsonb_typeof(field->'required')<>'boolean' then
      raise exception 'field required must be boolean' using errcode='22023';
    end if;
    if field_type='select' then
      if jsonb_typeof(field->'options')<>'array'
         or jsonb_array_length(field->'options')=0
         or jsonb_array_length(field->'options')>100 then
        raise exception 'select fields require 1 to 100 options' using errcode='22023';
      end if;
      for option_value in select value from jsonb_array_elements(field->'options')
      loop
        if jsonb_typeof(option_value)<>'string' or btrim(option_value#>>'{}')='' then
          raise exception 'select options must be non-empty strings' using errcode='22023';
        end if;
      end loop;
    elsif field?'options' then
      raise exception 'options are only allowed for select fields' using errcode='22023';
    end if;
  end loop;
end;
$$;
revoke all on function private.validate_workflow_form_schema(jsonb) from public,anon,authenticated,service_role;

create function private.validate_workflow_task_response(requested_schema jsonb,requested_response jsonb)
returns void
language plpgsql
immutable
set search_path=pg_catalog
as $$
declare
  field jsonb;
  field_key text;
  field_type text;
  field_value jsonb;
  response_key text;
begin
  perform private.validate_workflow_form_schema(requested_schema);
  if requested_response is null or jsonb_typeof(requested_response)<>'object' then
    raise exception 'response must be a JSON object' using errcode='22023';
  end if;

  for response_key in select jsonb_object_keys(requested_response)
  loop
    if not exists(
      select 1 from jsonb_array_elements(requested_schema->'fields') f
      where f->>'key'=response_key
    ) then
      raise exception 'unknown response field: %',response_key using errcode='22023';
    end if;
  end loop;

  for field in select value from jsonb_array_elements(requested_schema->'fields')
  loop
    field_key:=field->>'key';
    field_type:=field->>'type';
    field_value:=requested_response->field_key;

    if coalesce((field->>'required')::boolean,false)
       and (
         field_value is null
         or field_value='null'::jsonb
         or (jsonb_typeof(field_value)='string' and btrim(field_value#>>'{}')='')
       ) then
      raise exception 'required response field is missing: %',field_key using errcode='22023';
    end if;
    if field_value is null or field_value='null'::jsonb then continue; end if;

    if field_type in('text','date','select') and jsonb_typeof(field_value)<>'string' then
      raise exception 'response field % must be text',field_key using errcode='22023';
    elsif field_type='number' and jsonb_typeof(field_value)<>'number' then
      raise exception 'response field % must be numeric',field_key using errcode='22023';
    elsif field_type='checkbox' and jsonb_typeof(field_value)<>'boolean' then
      raise exception 'response field % must be boolean',field_key using errcode='22023';
    end if;

    if field_type='text' and length(field_value#>>'{}')>10000 then
      raise exception 'response field % is too long',field_key using errcode='22023';
    elsif field_type='date' and (field_value#>>'{}')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'response field % must use YYYY-MM-DD',field_key using errcode='22023';
    elsif field_type='select' and not ((field->'options')?(field_value#>>'{}')) then
      raise exception 'response field % is not an allowed option',field_key using errcode='22023';
    end if;
  end loop;
end;
$$;
revoke all on function private.validate_workflow_task_response(jsonb,jsonb) from public,anon,authenticated,service_role;

create function public.validate_workflow_step_form()
returns trigger
language plpgsql
set search_path=pg_catalog
as $$
begin
  perform private.validate_workflow_form_schema(new.form_schema);
  return new;
end;
$$;
revoke all on function public.validate_workflow_step_form() from public,anon,authenticated,service_role;

do $$
declare existing_step record;
begin
  for existing_step in select form_schema from public.workflow_steps
  loop
    perform private.validate_workflow_form_schema(existing_step.form_schema);
  end loop;
end;
$$;

create trigger workflow_steps_validate_form
before insert or update of form_schema on public.workflow_steps
for each row execute function public.validate_workflow_step_form();

create or replace function public.complete_case_task(requested_task_id uuid,requested_response jsonb default '{}'::jsonb)
returns public.compliance_cases
language plpgsql security definer set search_path=pg_catalog
as $$
declare
  uid uuid:=auth.uid();
  task public.case_tasks;
  selected_case public.compliance_cases;
  selected_step public.workflow_steps;
  next_task public.case_tasks;
  caller_is_admin boolean;
begin
  if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
    raise exception 'authentication required' using errcode='42501';
  end if;
  select * into task from public.case_tasks where id=requested_task_id for update;
  if task.id is null or task.status<>'ACTIVE' then
    raise exception 'active task required' using errcode='22023';
  end if;
  select * into selected_case from public.compliance_cases where id=task.case_id for update;
  select * into selected_step from public.workflow_steps where id=task.workflow_step_id;
  caller_is_admin:=private.is_platform_admin();

  if selected_step.actor='USER' then
    if not private.is_tenant_member(selected_case.tenant_id) then
      raise exception 'tenant membership required' using errcode='42501';
    end if;
  elsif not caller_is_admin then
    raise exception 'platform admin required for this task' using errcode='42501';
  end if;

  perform private.validate_workflow_task_response(selected_step.form_schema,requested_response);
  update public.case_tasks
  set status='COMPLETED',response_data=requested_response,completed_by=uid,completed_at=now()
  where id=task.id;

  select ct.* into next_task
  from public.case_tasks ct
  join public.workflow_steps ws on ws.id=ct.workflow_step_id
  where ct.case_id=task.case_id and ct.status='PENDING'
  order by ws.sequence
  limit 1
  for update of ct;

  if next_task.id is null then
    update public.compliance_cases
    set status='COMPLETED',current_step_id=null,closed_at=now()
    where id=selected_case.id
    returning * into selected_case;
  else
    update public.case_tasks set status='ACTIVE' where id=next_task.id;
    update public.compliance_cases
    set current_step_id=next_task.workflow_step_id
    where id=selected_case.id
    returning * into selected_case;
  end if;
  return selected_case;
end;
$$;
revoke all on function public.complete_case_task(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.complete_case_task(uuid,jsonb) to authenticated;

commit;
