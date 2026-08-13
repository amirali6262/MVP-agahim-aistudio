begin;

-- Keep this schema-scoped rule explicit for readability and compatibility
-- with Supabase's recommended Data API hardening configuration.
alter default privileges for role postgres in schema public
  revoke execute on functions from public;

commit;
