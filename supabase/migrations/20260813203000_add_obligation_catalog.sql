begin;

create function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.users
    where id = (select auth.uid())
      and role = 'PLATFORM_ADMIN'
  );
$$;
revoke all on function private.is_platform_admin() from public, anon, authenticated, service_role;
grant execute on function private.is_platform_admin() to authenticated;

create table public.obligation_families (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique
    constraint obligation_families_code_check check (code ~ '^[A-Z][A-Z0-9_]{1,49}$'),
  domain text not null
    constraint obligation_families_domain_check check (domain in ('TAX', 'INSURANCE')),
  title text not null constraint obligation_families_title_check check (btrim(title) <> ''),
  description text,
  is_active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.obligations (
  id uuid primary key default extensions.gen_random_uuid(),
  family_id uuid not null references public.obligation_families(id) on delete restrict,
  code text not null unique
    constraint obligations_code_check check (code ~ '^[A-Z][A-Z0-9_]{1,79}$'),
  title text not null constraint obligations_title_check check (btrim(title) <> ''),
  summary text,
  authority_name text,
  official_action_url text
    constraint obligations_action_url_check check (official_action_url is null or official_action_url ~ '^https://'),
  is_active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.obligation_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  obligation_id uuid not null references public.obligations(id) on delete restrict,
  version_number integer not null constraint obligation_versions_number_check check (version_number > 0),
  status text not null default 'DRAFT'
    constraint obligation_versions_status_check check (status in ('DRAFT', 'REVIEW', 'TESTING', 'PUBLISHED')),
  legal_reference text,
  source_url text
    constraint obligation_versions_source_url_check check (source_url is null or source_url ~ '^https://'),
  audience_summary text,
  effective_from date,
  effective_to date,
  recurrence_rule jsonb not null default '{}'::jsonb
    constraint obligation_versions_recurrence_object_check check (jsonb_typeof(recurrence_rule) = 'object'),
  deadline_rule jsonb not null default '{}'::jsonb
    constraint obligation_versions_deadline_object_check check (jsonb_typeof(deadline_rule) = 'object'),
  penalty_rule jsonb not null default '{}'::jsonb
    constraint obligation_versions_penalty_object_check check (jsonb_typeof(penalty_rule) = 'object'),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  published_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint obligation_versions_obligation_number_key unique (obligation_id, version_number),
  constraint obligation_versions_effective_period_check
    check (effective_to is null or (effective_from is not null and effective_to >= effective_from)),
  constraint obligation_versions_publication_check check (
    (status = 'PUBLISHED' and published_by is not null and published_at is not null and effective_from is not null)
    or
    (status <> 'PUBLISHED' and published_by is null and published_at is null)
  )
);

create index obligations_family_id_idx on public.obligations(family_id);
create index obligation_families_created_by_idx on public.obligation_families(created_by);
create index obligations_created_by_idx on public.obligations(created_by);
create index obligation_versions_created_by_idx on public.obligation_versions(created_by);
create index obligation_versions_published_by_idx on public.obligation_versions(published_by)
  where published_by is not null;
create index obligation_versions_published_lookup_idx
  on public.obligation_versions(obligation_id, effective_from desc)
  where status = 'PUBLISHED';

create trigger obligation_families_set_updated_at
  before update on public.obligation_families
  for each row execute function public.set_updated_at();
create trigger obligations_set_updated_at
  before update on public.obligations
  for each row execute function public.set_updated_at();
create trigger obligation_versions_set_updated_at
  before update on public.obligation_versions
  for each row execute function public.set_updated_at();

create function public.protect_published_obligation_version()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if old.status = 'PUBLISHED' then
    raise exception 'published obligation versions are immutable; create a new version'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and (
    new.obligation_id is distinct from old.obligation_id
    or new.version_number is distinct from old.version_number
  ) then
    raise exception 'obligation identity and version number are immutable'
      using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.protect_published_obligation_version() from public, anon, authenticated, service_role;

create trigger obligation_versions_protect_published
  before update or delete on public.obligation_versions
  for each row execute function public.protect_published_obligation_version();

alter table public.obligation_families enable row level security;
alter table public.obligations enable row level security;
alter table public.obligation_versions enable row level security;

revoke all on table public.obligation_families, public.obligations, public.obligation_versions
  from public, anon, authenticated;
grant select, insert, delete on table public.obligation_families, public.obligations, public.obligation_versions
  to authenticated;
grant update (title, description, is_active) on table public.obligation_families to authenticated;
grant update (title, summary, authority_name, official_action_url, is_active)
  on table public.obligations to authenticated;
grant update (
  status, legal_reference, source_url, audience_summary, effective_from, effective_to,
  recurrence_rule, deadline_rule, penalty_rule, published_by, published_at
) on table public.obligation_versions to authenticated;

create policy obligation_families_read
on public.obligation_families for select to authenticated
using (is_active or (select private.is_platform_admin()));
create policy obligation_families_admin_insert
on public.obligation_families for insert to authenticated
with check ((select private.is_platform_admin()) and created_by = (select auth.uid()));
create policy obligation_families_admin_update
on public.obligation_families for update to authenticated
using ((select private.is_platform_admin()))
with check ((select private.is_platform_admin()));
create policy obligation_families_admin_delete
on public.obligation_families for delete to authenticated
using ((select private.is_platform_admin()));

create policy obligations_read
on public.obligations for select to authenticated
using (is_active or (select private.is_platform_admin()));
create policy obligations_admin_insert
on public.obligations for insert to authenticated
with check ((select private.is_platform_admin()) and created_by = (select auth.uid()));
create policy obligations_admin_update
on public.obligations for update to authenticated
using ((select private.is_platform_admin()))
with check ((select private.is_platform_admin()));
create policy obligations_admin_delete
on public.obligations for delete to authenticated
using ((select private.is_platform_admin()));

create policy obligation_versions_read
on public.obligation_versions for select to authenticated
using (status = 'PUBLISHED' or (select private.is_platform_admin()));
create policy obligation_versions_admin_insert
on public.obligation_versions for insert to authenticated
with check ((select private.is_platform_admin()) and created_by = (select auth.uid()) and status <> 'PUBLISHED');
create policy obligation_versions_admin_update
on public.obligation_versions for update to authenticated
using ((select private.is_platform_admin()))
with check (
  (select private.is_platform_admin())
  and (
    status <> 'PUBLISHED'
    or (published_by = (select auth.uid()) and published_at is not null and effective_from is not null)
  )
);
create policy obligation_versions_admin_delete
on public.obligation_versions for delete to authenticated
using ((select private.is_platform_admin()));

commit;
