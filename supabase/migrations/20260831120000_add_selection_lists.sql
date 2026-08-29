-- ==========================================================================
-- Migration: Central selection lists library
-- Date: 2026-08-31
-- Purpose: A single source of truth for selectable options used across the
--          platform (company info fields, obligation form fields, filters).
--          Lists may be STATIC (independent or dependent/cascading) or
--          SYSTEM (options fetched live from a real system source — never
--          copied into static option rows).
-- ==========================================================================

begin;

-- --------------------------------------------------------------------------
-- 1. selection_lists
-- --------------------------------------------------------------------------
create table if not exists public.selection_lists (
  id uuid primary key default extensions.gen_random_uuid(),
  key text not null constraint selection_lists_key_check check (btrim(key) <> ''),
  title text not null constraint selection_lists_title_check check (btrim(title) <> ''),
  description text,
  source_type text not null default 'STATIC'
    constraint selection_lists_source_type_check check (source_type in ('STATIC', 'SYSTEM')),
  is_dependent boolean not null default false,
  parent_list_id uuid references public.selection_lists(id) on delete restrict,
  -- For SYSTEM sources: which real system source provides the options
  -- (e.g. 'TENANT_FISCAL_YEARS', 'TENANT_MEMBERS', 'OBLIGATIONS',
  --       'PUBLISHED_FORMS', 'WORKFLOW_STEPS', 'OBJECTION_TEMPLATES').
  system_source_key text,
  -- Shown before a parent option has been chosen (dependent lists).
  parent_selection_message text,
  is_active boolean not null default true,
  status text not null default 'DRAFT'
    constraint selection_lists_status_check check (status in ('DRAFT', 'PUBLISHED')),
  published_at timestamptz,
  -- nullable so idempotent seeds never fail when run before any auth user exists
  created_by uuid default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint selection_lists_not_self_parent check (parent_list_id is distinct from id)
);
create unique index if not exists selection_lists_key_uidx on public.selection_lists (lower(key));
comment on table public.selection_lists is
  'Central list of selectable options (static or system-backed) used by field definitions.';
comment on column public.selection_lists.system_source_key is
  'For SYSTEM lists only: identifies a real system source; options are fetched live and never stored in static option rows.';

-- Depth guard for dependent lists (max 5 levels for the current version).
create or replace function public.selection_lists_check_cycle()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_cur uuid := coalesce(new.parent_list_id, new.id);
  v_depth integer := 0;
begin
  if new.parent_list_id is not null then
    loop
      if v_cur = new.id then
        raise exception 'دور وابستگی میان فهرستها مجاز نیست' using errcode = '23514';
      end if;
      v_depth := v_depth + 1;
      if v_depth > 5 then
        raise exception 'زنجیره وابستگی فهرستها نباید از پنج سطح بیشتر شود' using errcode = '23514';
      end if;
      select parent_list_id into v_cur from public.selection_lists where id = v_cur;
      if v_cur is null then exit; end if;
    end loop;
  end if;
  -- A SYSTEM source never participates in a static parent chain.
  if new.source_type = 'SYSTEM' and new.parent_list_id is not null then
    raise exception 'منبع پویای سیستم نمیتواند وابسته به فهرست والد باشد' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.selection_lists_check_cycle() from public, anon, authenticated, service_role;

drop trigger if exists selection_lists_check_cycle on public.selection_lists;
create trigger selection_lists_check_cycle
  before insert or update of parent_list_id, source_type, id on public.selection_lists
  for each row execute function public.selection_lists_check_cycle();

-- Prevent destructive changes after publication/use: key, source_type,
-- parent and simple/published status flip are immutable once PUBLISHED.
create or replace function public.selection_lists_protect_published()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if tg_op = 'DELETE' then
    -- A list used as a parent is already protected by the FK restrict;
    -- additionally block deleting a published list.
    if old.status = 'PUBLISHED' then
      raise exception 'فهرست منتشرشده قابل حذف نیست؛ ابتدا غیرفعال کنید' using errcode = '23514';
    end if;
    return old;
  end if;
  if old is not null and old.status = 'PUBLISHED' then
    if new.key is distinct from old.key then
      raise exception 'تغییر کلید ثابت پس از انتشار مسدود است' using errcode = '23514';
    end if;
    if new.source_type is distinct from old.source_type
      or new.parent_list_id is distinct from old.parent_list_id
      or new.system_source_key is distinct from old.system_source_key then
      raise exception 'تغییر نوع، والد یا منبع پس از انتشار مسدود است' using errcode = '23514';
    end if;
  end if;
  -- Publishing an inactive list is blocked; deactivating an already-published
  -- list is allowed (soft unpublish — the workspace only reads active+published).
  if new.status = 'PUBLISHED' and new.is_active is not true and coalesce(old.status, 'DRAFT') <> 'PUBLISHED' then
    raise exception 'فهرست غیرفعال قابل انتشار نیست' using errcode = '23514';
  end if;
  if new.status = 'PUBLISHED' and coalesce(new.parent_list_id, null) is not null then
    if not exists (
      select 1 from public.selection_lists p
      where p.id = new.parent_list_id and p.status = 'PUBLISHED'
    ) then
      raise exception 'فهرست والد باید منتشرشده باشد' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.selection_lists_protect_published() from public, anon, authenticated, service_role;

drop trigger if exists selection_lists_protect_published on public.selection_lists;
create trigger selection_lists_protect_published
  before update or delete on public.selection_lists
  for each row execute function public.selection_lists_protect_published();

-- --------------------------------------------------------------------------
-- 2. selection_list_options
-- --------------------------------------------------------------------------
create table if not exists public.selection_list_options (
  id uuid primary key default extensions.gen_random_uuid(),
  list_id uuid not null references public.selection_lists(id) on delete cascade,
  key text not null constraint selection_list_options_key_check check (btrim(key) <> ''),
  label text not null constraint selection_list_options_label_check check (btrim(label) <> ''),
  parent_option_id uuid references public.selection_list_options(id) on delete restrict,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  extra_info jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint selection_list_options_not_self_parent check (parent_option_id is distinct from id)
);
create unique index if not exists selection_list_options_list_key_uidx on public.selection_list_options (list_id, lower(key));
comment on column public.selection_list_options.key is
  'Stable key used as the logical stored value. label is presentation-only and may change.';
comment on column public.selection_list_options.parent_option_id is
  'Parent option (by id, never by Persian label) for linking within a dependent chain.';

create index if not exists selection_list_options_list_idx on public.selection_list_options(list_id, sort_order, is_active);
create index if not exists selection_list_options_parent_idx on public.selection_list_options(parent_option_id);

-- A child option must belong to a child list whose parent list matches the
-- parent option's list (the "parent field uses the correct parent list" rule),
-- and option parent chains must be cycle-free and bounded.
create or replace function public.selection_list_options_validate_parent()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_parent_list_id uuid;
  v_child_list_parent uuid;
  v_cur uuid;
  v_depth integer := 0;
begin
  if new.parent_option_id is not null then
    -- Cycle + depth guard on the option chain.
    v_cur := new.parent_option_id;
    loop
      if v_cur = new.id then
        raise exception 'گزینه نمیتواند والد خودش باشد' using errcode = '23514';
      end if;
      v_depth := v_depth + 1;
      if v_depth > 5 then
        raise exception 'زنجیره وابستگی گزینهها نباید از پنج سطح بیشتر شود' using errcode = '23514';
      end if;
      select parent_option_id into v_cur from public.selection_list_options where id = v_cur;
      if v_cur is null then exit; end if;
    end loop;

    -- Parent option must be in the list that this list declares as parent.
    select list_id into v_parent_list_id from public.selection_list_options where id = new.parent_option_id;
    select parent_list_id into v_child_list_parent from public.selection_lists where id = new.list_id;
    if v_parent_list_id is distinct from v_child_list_parent then
      raise exception 'گزینه فرزند باید به گزینهای از فهرست والد تعیینشده متصل شود' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.selection_list_options_validate_parent() from public, anon, authenticated, service_role;

drop trigger if exists selection_list_options_validate_parent on public.selection_list_options;
create trigger selection_list_options_validate_parent
  before insert or update of parent_option_id, id, list_id on public.selection_list_options
  for each row execute function public.selection_list_options_validate_parent();

-- Options that are used as parents are already protected by FK restrict.
-- Keys are immutable once the option (or its list) is published or used.
create or replace function public.selection_list_options_protect_key()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if tg_op = 'UPDATE' and new.key is distinct from old.key then
    if old.id in (select parent_option_id from public.selection_list_options where parent_option_id = old.id)
      or exists (select 1 from public.selection_lists l where l.id = old.list_id and l.status = 'PUBLISHED') then
      raise exception 'تغییر کلید ثابت گزینه استفادهشده مسدود است؛ فقط عنوان قابل تغییر است' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.selection_list_options_protect_key() from public, anon, authenticated, service_role;

drop trigger if exists selection_list_options_protect_key on public.selection_list_options;
create trigger selection_list_options_protect_key
  before update of key on public.selection_list_options
  for each row execute function public.selection_list_options_protect_key();

-- --------------------------------------------------------------------------
-- 3. RLS + GRANT
-- --------------------------------------------------------------------------
alter table public.selection_lists enable row level security;
alter table public.selection_list_options enable row level security;

-- Authenticated users may read published, active lists/options (workspace
-- form rendering). Only platform admins see drafts, and only admins write.
do $$ begin
  create policy selection_lists_read on public.selection_lists
    for select to authenticated
    using (private.is_platform_admin() or (status = 'PUBLISHED' and is_active));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy selection_lists_admin_write on public.selection_lists
    for all to authenticated
    using (private.is_platform_admin())
    with check (private.is_platform_admin());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy selection_list_options_read on public.selection_list_options
    for select to authenticated
    using (
      private.is_platform_admin()
      or exists (
        select 1 from public.selection_lists l
        where l.id = list_id and l.status = 'PUBLISHED'
      )
    );
exception when duplicate_object then null; end $$;
do $$ begin
  create policy selection_list_options_admin_write on public.selection_list_options
    for all to authenticated
    using (private.is_platform_admin())
    with check (private.is_platform_admin());
exception when duplicate_object then null; end $$;

grant select, insert, update, delete on table public.selection_lists to authenticated;
grant select, insert, update, delete on table public.selection_list_options to authenticated;

-- --------------------------------------------------------------------------
-- 4. Publisher RPC (idempotent, transactional publication)
-- --------------------------------------------------------------------------
create or replace function public.publish_selection_list(p_list_id uuid)
returns integer
language plpgsql
set search_path = pg_catalog
as $$
declare
  v_row_count integer;
  v_lk text;
begin
  if not (select private.is_platform_admin()) then
    raise exception 'platform admin required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.selection_lists where id = p_list_id) then
    raise exception 'list not found' using errcode = 'P0002';
  end if;

  select key into v_lk from public.selection_lists where id = p_list_id;
  if v_lk is null or btrim(v_lk) = '' then
    raise exception 'فهرست باید کلید ثابت معتبر داشته باشد' using errcode = '22023';
  end if;

  update public.selection_lists
    set status = 'PUBLISHED', published_at = now(), updated_at = now()
    where id = p_list_id;
  get diagnostics v_row_count = row_count;
  return v_row_count;
end;
$$;
revoke all on function public.publish_selection_list(uuid) from public, anon, authenticated, service_role;
grant execute on function public.publish_selection_list(uuid) to authenticated;

-- --------------------------------------------------------------------------
-- 5. Seed: the real system 'نوع شخصیت' list + options (idempotent, non-destructive)
-- --------------------------------------------------------------------------
insert into public.selection_lists (
  id, key, title, description, source_type, is_dependent, parent_list_id,
  system_source_key, parent_selection_message, is_active, status, published_at, created_by
)
values (
  'e0000001-0000-0000-0000-000000000001',
  'legal_person_types',
  'نوع شخصیت',
  'حقیقی یا حقوقی بودن شرکت.',
  'STATIC',
  false,
  null,
  null,
  null,
  true,
  'PUBLISHED',
  now(),
  null
)
on conflict (lower(key)) do nothing;
-- note: idempotent and non-destructive — never overwrite admin-edited titles,
-- status, or publisher/timestamps on re-run.

insert into public.selection_list_options (id, list_id, key, label, sort_order, is_active)
values
  ('e0000002-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001', 'natural_person', 'حقیقی', 1, true),
  ('e0000003-0000-0000-0000-000000000002', 'e0000001-0000-0000-0000-000000000001', 'legal_entity',  'حقوقی', 2, true)
on conflict (list_id, lower(key)) do nothing;

commit;