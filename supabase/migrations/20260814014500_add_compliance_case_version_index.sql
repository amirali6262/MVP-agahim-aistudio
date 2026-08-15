begin;

create index compliance_cases_obligation_version_idx
  on public.compliance_cases(obligation_version_id);

commit;
