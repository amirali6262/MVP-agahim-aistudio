begin;

-- ---------------------------------------------------------------------------
-- Retirement (RETIRED) of a published obligation version.
--
-- A published version is an immutable legal document. It can never be edited,
-- deleted, or returned to the review lifecycle. The only additional terminal
-- transition is an audited PUBLISHED -> RETIRED, performed exclusively through
-- retire_obligation_version(): the definition stays frozen, the publication
-- audit trail (published_by/published_at) is preserved, and the retirement is
-- recorded (retired_by/retired_at).
-- ---------------------------------------------------------------------------

alter table public.obligation_versions
  add column retired_by uuid references auth.users(id) on delete restrict,
  add column retired_at timestamptz;

-- Extend the status domain with the terminal RETIRED state.
alter table public.obligation_versions
  drop constraint obligation_versions_status_check,
  add constraint obligation_versions_status_check
    check (status in ('DRAFT', 'REVIEW', 'TESTING', 'PUBLISHED', 'RETIRED'));

-- RETIRED keeps the original publication audit trail, so the publication
-- invariant must accept it as a published-form state.
alter table public.obligation_versions
  drop constraint obligation_versions_publication_check,
  add constraint obligation_versions_publication_check check (
    (status = 'PUBLISHED' and published_by is not null and published_at is not null and effective_from is not null)
    or
    (status = 'RETIRED' and published_by is not null and published_at is not null
       and retired_by is not null and retired_at is not null)
    or
    (status not in ('PUBLISHED', 'RETIRED')
       and published_by is null and published_at is null
       and retired_by is null and retired_at is null)
  );

-- Retirement may only happen through the validated SECURITY DEFINER RPC.
revoke update (retired_by, retired_at)
  on table public.obligation_versions
  from authenticated;

-- The terminal states are immutable except for the exact audited retirement
-- transition (PUBLISHED -> RETIRED performed by retire_obligation_version).
create or replace function public.protect_published_obligation_version()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if old.status in ('PUBLISHED', 'RETIRED') then
    -- The only permitted mutation is the audited PUBLISHED -> RETIRED
    -- retirement. Everything else, including any content change, direct
    -- status flip, or delete, stays blocked for both terminal states.
    if tg_op = 'UPDATE'
       and old.status = 'PUBLISHED'
       and new.status = 'RETIRED'
       and new.retired_by is not null
       and new.retired_at is not null
       and to_jsonb(new) - array['status', 'retired_by', 'retired_at', 'updated_at']
         = to_jsonb(old) - array['status', 'retired_by', 'retired_at', 'updated_at'] then
      return new;
    end if;

    raise exception 'published or retired obligation versions are immutable; create a new version'
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

revoke all on function public.protect_published_obligation_version()
  from public, anon, authenticated, service_role;

-- The draft-edit freeze must treat retirement as a governance-only change, the
-- same way it already treats publication. Any content change stays blocked.
create or replace function private.enforce_obligation_version_draft_edits()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $version_draft$
begin
  if tg_op = 'DELETE' then
    perform private.assert_obligation_version_draft(old.id, false);
    return old;
  end if;

  -- Lifecycle RPCs may change only governance columns while the definition is
  -- frozen. Any current or future content column remains immutable.
  if old.status <> 'DRAFT'
     and (
       to_jsonb(new) - array['status', 'published_by', 'published_at', 'retired_by', 'retired_at', 'updated_at']
     ) is distinct from (
       to_jsonb(old) - array['status', 'published_by', 'published_at', 'retired_by', 'retired_at', 'updated_at']
     ) then
    raise exception 'reviewed or tested obligation definitions are read-only; return the version to DRAFT before editing'
      using errcode = '23514';
  end if;

  return new;
end;
$version_draft$;

revoke all on function private.enforce_obligation_version_draft_edits()
  from public, anon, authenticated, service_role;

-- Audited retirement RPC. Only a platform admin can retire, and only a
-- PUBLISHED version qualifies. The frozen definition is never touched.
create or replace function public.retire_obligation_version(
  requested_version_id uuid
)
returns public.obligation_versions
language plpgsql
security definer
set search_path = pg_catalog
as $retire$
declare
  uid uuid := auth.uid();
  selected_version public.obligation_versions;
begin
  if uid is null
     or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
     or not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;

  select *
  into selected_version
  from public.obligation_versions
  where id = requested_version_id
  for update;

  if selected_version.id is null then
    raise exception 'obligation version not found' using errcode = 'P0002';
  end if;

  if selected_version.status <> 'PUBLISHED' then
    raise exception 'only published obligation versions can be retired'
      using errcode = '22023';
  end if;

  update public.obligation_versions
  set status = 'RETIRED',
      retired_by = uid,
      retired_at = now()
  where id = selected_version.id
  returning * into selected_version;

  return selected_version;
end;
$retire$;

revoke all on function public.retire_obligation_version(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.retire_obligation_version(uuid)
  to authenticated;

-- Fail the migration if the retirement columns are ever left directly writable
-- by the authenticated Data API role.
do $$
begin
  if has_column_privilege('authenticated', 'public.obligation_versions', 'retired_by', 'UPDATE')
     or has_column_privilege('authenticated', 'public.obligation_versions', 'retired_at', 'UPDATE') then
    raise exception 'obligation retirement columns remain directly writable';
  end if;
end;
$$;

comment on function public.retire_obligation_version(uuid)
  is 'Marks a published obligation version as RETIRED without touching its frozen definition; platform admin only.';

commit;
