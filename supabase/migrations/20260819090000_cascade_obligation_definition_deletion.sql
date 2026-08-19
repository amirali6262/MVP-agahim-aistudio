begin;

-- An obligation owns its version definitions. Without cascading this relationship,
-- even an unused draft cannot be removed from the Studio because its version row
-- blocks deletion. Downstream operational records keep their existing RESTRICT
-- foreign keys, and the published-version protection trigger remains in force.
alter table public.obligation_versions
  drop constraint obligation_versions_obligation_id_fkey,
  add constraint obligation_versions_obligation_id_fkey
    foreign key (obligation_id)
    references public.obligations(id)
    on delete cascade;

commit;
