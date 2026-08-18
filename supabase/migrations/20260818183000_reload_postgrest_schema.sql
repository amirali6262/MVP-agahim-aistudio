-- Make newly-created Studio tables visible to PostgREST immediately after deploy.
-- Supabase normally reloads the schema automatically, but an explicit notify
-- prevents a short-lived PGRST205/schema-cache error after the migration job.
notify pgrst, 'reload schema';
