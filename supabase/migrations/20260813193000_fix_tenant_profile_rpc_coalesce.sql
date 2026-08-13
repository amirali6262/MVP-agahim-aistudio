begin;

-- PostgreSQL implements COALESCE as syntax, not as a schema-qualified
-- pg_catalog function. Repair the already-applied function definition while
-- remaining harmless for fresh databases where the previous migration is
-- already corrected.
do $$
declare
  function_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.save_tenant_profile(uuid,date,text,text,text[],text,text,integer,numeric,integer,boolean,text[],boolean,jsonb)'::pg_catalog.regprocedure
  ) into function_definition;

  function_definition := pg_catalog.replace(
    function_definition,
    'pg_catalog.coalesce(',
    'coalesce('
  );

  execute function_definition;
end;
$$;

commit;
