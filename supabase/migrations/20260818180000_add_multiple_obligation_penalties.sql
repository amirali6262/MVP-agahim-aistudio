begin;

create table public.obligation_version_penalties (
  id uuid primary key default extensions.gen_random_uuid(),
  obligation_version_id uuid not null references public.obligation_versions(id) on delete cascade,
  title text not null constraint obligation_version_penalties_title_check check (btrim(title) <> ''),
  penalty_type text not null constraint obligation_version_penalties_type_check
    check (penalty_type in ('FIXED', 'PERCENTAGE', 'DAILY_PERCENTAGE')),
  amount numeric,
  rate_percent numeric,
  sequence integer not null constraint obligation_version_penalties_sequence_check check (sequence > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint obligation_version_penalties_value_check check (
    (penalty_type = 'FIXED' and amount >= 0 and rate_percent is null)
    or (penalty_type in ('PERCENTAGE', 'DAILY_PERCENTAGE') and rate_percent >= 0 and amount is null)
  ),
  constraint obligation_version_penalties_version_sequence_key unique(obligation_version_id, sequence)
);

create trigger obligation_version_penalties_set_updated_at before update on public.obligation_version_penalties
for each row execute function public.set_updated_at();
alter table public.obligation_version_penalties enable row level security;
revoke all on table public.obligation_version_penalties from public, anon, authenticated;
grant select, insert, update, delete on table public.obligation_version_penalties to authenticated;
create policy obligation_version_penalties_read on public.obligation_version_penalties for select to authenticated using (true);
create policy obligation_version_penalties_admin_insert on public.obligation_version_penalties for insert to authenticated with check ((select private.is_platform_admin()));
create policy obligation_version_penalties_admin_update on public.obligation_version_penalties for update to authenticated using ((select private.is_platform_admin())) with check ((select private.is_platform_admin()));
create policy obligation_version_penalties_admin_delete on public.obligation_version_penalties for delete to authenticated using ((select private.is_platform_admin()));

commit;
