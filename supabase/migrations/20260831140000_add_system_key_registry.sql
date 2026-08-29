-- ==========================================================================
-- Migration: Central system key registry
-- Date: 2026-08-31
-- Purpose: A single source of truth for every unique English key the platform
--          admin enters (company-info fields, selection lists/options,
--          obligations, workflow/objection steps, ...). It:
--            * enforces a namespaced pattern at the DB level,
--            * enforces UNIQUE full keys at the DB level (never trust UI alone),
--            * locks keys once published / used, and
--            * feeds the «فهرست کلیدهای سیستم» admin page.
-- ==========================================================================

begin;

create table if not exists public.system_key_registry (
  id uuid primary key default extensions.gen_random_uuid(),
  -- Namespaced semantic key, e.g. company_profile.field.legal_person_type
  full_key text not null
    constraint system_key_registry_key_check check (
      full_key ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$'
    ),
  title_fa text not null default '',
  entity_type text not null
    constraint system_key_registry_entity_check check (entity_type in (
      'FIELD', 'SELECTION_LIST', 'SELECTION_OPTION', 'OBLIGATION',
      'WORKFLOW_STEP', 'OBJECTION_TEMPLATE', 'OBJECTION_STEP',
      'FORM', 'SHARED_ACTION', 'OTHER'
    )),
  module text not null
    constraint system_key_registry_module_check check (btrim(module) <> ''),
  form_name text,
  form_id uuid,
  -- which real table/row this key lives on (linked without duplicating control).
  source_table text,
  source_record_id uuid,
  status text not null default 'DRAFT'
    constraint system_key_registry_status_check check (status in ('DRAFT', 'PUBLISHED', 'INACTIVE')),
  usage_count integer not null default 0 check (usage_count >= 0),
  locked boolean not null default false,
  lock_reason text,
  created_by uuid default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Full key uniqueness is enforced at the DB level (lower-case, case-insensitive).
create unique index if not exists system_key_registry_key_uidx on public.system_key_registry (lower(full_key));
-- A source record maps to at most one registry row (when we track it).
create unique index if not exists system_key_registry_source_uidx on public.system_key_registry (source_table, source_record_id)
  where source_table is not null and source_record_id is not null;

comment on table public.system_key_registry is
  'Central registry of every unique English key used across the platform.';
comment on column public.system_key_registry.full_key is
  'Namespaced semantic key: module.entity.semantic_name. Unique at the DB level.';

-- --------------------------------------------------------------------------
-- Protect published / locked keys from direct edits, key renames or deletes.
-- --------------------------------------------------------------------------
create or replace function public.system_key_registry_protect_steady_state()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if old.status = 'PUBLISHED' and new.status = 'DRAFT' then
    raise exception 'published key cannot return to draft';
  end if;
  if (old.locked or old.status = 'PUBLISHED')
     and new.full_key is distinct from old.full_key then
    raise exception 'key is locked and cannot be changed; use a controlled migration instead';
  end if;
  new.updated_at := now();
  return new;
end $$;
revoke all on function public.system_key_registry_protect_steady_state() from public, anon, authenticated, service_role;

drop trigger if exists system_key_registry_protect_steady_state on public.system_key_registry;
create trigger system_key_registry_protect_steady_state
  before update on public.system_key_registry
  for each row execute function public.system_key_registry_protect_steady_state();

-- Block deleting keys that are published or locked.
create or replace function public.system_key_registry_block_delete()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if old.status = 'PUBLISHED' or old.locked then
    raise exception 'registry entry is published/locked and cannot be deleted';
  end if;
  return old;
end $$;
revoke all on function public.system_key_registry_block_delete() from public, anon, authenticated, service_role;

drop trigger if exists system_key_registry_block_delete on public.system_key_registry;
create trigger system_key_registry_block_delete
  before delete on public.system_key_registry
  for each row execute function public.system_key_registry_block_delete();

-- --------------------------------------------------------------------------
-- RLS + GRANT (only platform admins can manage registry entries).
-- --------------------------------------------------------------------------
alter table public.system_key_registry enable row level security;

do $$ begin
  create policy system_key_registry_read on public.system_key_registry
    for select to authenticated
    using (private.is_platform_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy system_key_registry_admin_write on public.system_key_registry
    for all to authenticated
    using (private.is_platform_admin())
    with check (private.is_platform_admin());
exception when duplicate_object then null; end $$;

grant select, insert, update, delete on table public.system_key_registry to authenticated;

-- --------------------------------------------------------------------------
-- Optional helper RPC: atomically claim a full key. Only platform admins.
-- Returns the existing row id if the full key is already taken (so the caller
-- can detect a conflict instead of silently reusing it for a different record).
-- --------------------------------------------------------------------------
create or replace function public.claim_system_key(
  p_full_key text,
  p_title_fa text,
  p_entity_type text,
  p_module text,
  p_form_name text,
  p_source_table text,
  p_locked boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_id uuid;
begin
  if not private.is_platform_admin() then
    raise exception 'forbidden: only platform admins can claim system keys';
  end if;
  select id into v_id from public.system_key_registry
    where lower(full_key) = lower(p_full_key);
  if v_id is not null then
    return v_id;
  end if;
  insert into public.system_key_registry
    (full_key, title_fa, entity_type, module, form_name, source_table, status, locked, lock_reason)
  values
    (p_full_key, coalesce(p_title_fa, ''), p_entity_type, p_module, p_form_name,
     p_source_table, 'DRAFT', coalesce(p_locked, false),
     case when p_locked then 'ثبت خودکار از رجیستری' end)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.claim_system_key(text,text,text,text,text,text,boolean) from public, anon, authenticated, service_role;
grant execute on function public.claim_system_key(text,text,text,text,text,text,boolean) to authenticated;

commit;