begin;

-- ---------------------------------------------------------------------------
-- Reopen: return a PUBLISHED or RETIRED obligation version back to DRAFT.
--
-- Decision (operator-approved): a version that is published or retired can be
-- reopened to DRAFT so the same version number can be edited and re-published.
-- This is the graceful reverse of the retirement/publish lifecycle. It clears
-- the publication and retirement audit columns and freezes nothing; the AZ
-- content columns are never touched by the RPC itself (they become editable
-- again because the version is DRAFT).
-- ---------------------------------------------------------------------------

-- Public/retired rows are still immutable, but the protect trigger now accepts
-- the two audited lifecycle transitions:
--   (a) retire:      PUBLISHED                       -> RETIRED
--   (b) reopen:      PUBLISHED | RETIRED             -> DRAFT
create or replace function public.protect_published_obligation_version()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if old.status in ('PUBLISHED', 'RETIRED') then
    if tg_op = 'UPDATE'
       and (
         (old.status = 'PUBLISHED' and new.status = 'RETIRED'
            and new.retired_by is not null and new.retired_at is not null
            and to_jsonb(new) - array['status', 'retired_by', 'retired_at', 'updated_at']
              = to_jsonb(old) - array['status', 'retired_by', 'retired_at', 'updated_at'])
         or
         (new.status = 'DRAFT'
            and new.published_by is null and new.published_at is null
            and new.retired_by is null and new.retired_at is null
            and to_jsonb(new) - array['status', 'published_by', 'published_at', 'retired_by', 'retired_at', 'updated_at']
              = to_jsonb(old) - array['status', 'published_by', 'published_at', 'retired_by', 'retired_at', 'updated_at'])
       ) then
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

-- Audited reopen RPC: only a platform admin can reopen, and only a PUBLISHED or
-- RETIRED version qualifies. The legal content columns are preserved unchanged;
-- they simply become editable again because the status is now DRAFT.
create or replace function public.reopen_obligation_version(
  requested_version_id uuid
)
returns public.obligation_versions
language plpgsql
security definer
set search_path = pg_catalog
as $reopen$
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

  if selected_version.status not in ('PUBLISHED', 'RETIRED') then
    raise exception 'only published or retired obligation versions can be reopened to draft'
      using errcode = '22023';
  end if;

  update public.obligation_versions
  set status = 'DRAFT',
      published_by = null,
      published_at = null,
      retired_by = null,
      retired_at = null
  where id = selected_version.id
  returning * into selected_version;

  return selected_version;
end;
$reopen$;

revoke all on function public.reopen_obligation_version(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.reopen_obligation_version(uuid)
  to authenticated;

-- Guard: anon must never execute the reopen RPC.
do $$
begin
  if has_function_privilege('anon', 'public.reopen_obligation_version(uuid)', 'EXECUTE') then
    raise exception 'anon can execute reopen_obligation_version';
  end if;
end
$$;

comment on function public.reopen_obligation_version(uuid)
  is 'Returns a PUBLISHED or RETIRED obligation version to DRAFT for re-editing, clearing publication/retirement audit columns; platform admin only.';

commit;