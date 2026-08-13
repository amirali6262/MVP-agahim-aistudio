begin;

-- Complete the repair for SQL conditional expressions that cannot be
-- schema-qualified in PostgreSQL.
do $$
declare
  function_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.save_tenant_profile(uuid,date,text,text,text[],text,text,integer,numeric,integer,boolean,text[],boolean,jsonb)'::pg_catalog.regprocedure
  ) into function_definition;

  function_definition := pg_catalog.replace(function_definition, 'pg_catalog.current_date', 'current_date');
  function_definition := pg_catalog.replace(function_definition, 'pg_catalog.nullif(', 'nullif(');

  execute function_definition;
end;
$$;

commit;
