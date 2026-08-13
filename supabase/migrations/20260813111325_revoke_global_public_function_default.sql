begin;

-- PostgreSQL's built-in EXECUTE grant to PUBLIC is a global default and cannot
-- be removed by a schema-scoped default ACL alone. Future functions owned by
-- postgres must opt in with an explicit GRANT in their migration.
alter default privileges for role postgres
  revoke execute on functions from public;

commit;
