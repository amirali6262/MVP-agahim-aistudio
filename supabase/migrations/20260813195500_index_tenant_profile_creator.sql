begin;

create index if not exists tenant_profile_created_by_idx
  on public.tenant_profile_versions (created_by);

commit;
