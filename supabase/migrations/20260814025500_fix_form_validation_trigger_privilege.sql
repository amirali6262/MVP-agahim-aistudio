begin;

create or replace function public.validate_workflow_step_form()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog
as $$
begin
  perform private.validate_workflow_form_schema(new.form_schema);
  return new;
end;
$$;
revoke all on function public.validate_workflow_step_form()
  from public,anon,authenticated,service_role;

commit;
