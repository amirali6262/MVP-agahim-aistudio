-- ==========================================================================
-- Migration: Company Workspace Menu management
-- Date: 2026-08-29
-- Purpose: Let the platform admin define and publish the company workspace
--          vertical menu (groups + form leaves). Menu structure is reference
--          data stored in two tables:
--            * company_menu_drafts  -> the working, unpublished tree (admin edits)
--            * company_menu         -> the published snapshot the workspace reads
--          All item rows are admin-defined (no demo/sample data seeded).
-- ==========================================================================

begin;

-- --------------------------------------------------------------------------
-- 1. Draft table (admin editing surface)
-- --------------------------------------------------------------------------
create table public.company_menu_drafts (
  id uuid primary key default extensions.gen_random_uuid(),
  -- Stable, predictable english code used for parent references on publish.
  code text not null unique
    constraint company_menu_drafts_code_check check (code ~ '^[A-Z][A-Z0-9_]{1,79}$'),
  title_fa text not null
    constraint company_menu_drafts_title_check check (btrim(title_fa) <> ''),
  item_type text not null
    constraint company_menu_drafts_type_check check (item_type in ('GROUP', 'FORM')),
  parent_id uuid references public.company_menu_drafts(id) on delete cascade,
  form_obligation_id uuid references public.obligations(id) on delete set null,
  icon text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index company_menu_drafts_parent_idx on public.company_menu_drafts(parent_id);
create index company_menu_drafts_form_idx on public.company_menu_drafts(form_obligation_id);

-- --------------------------------------------------------------------------
-- 2. Published snapshot table (company workspace reads this)
--    parent_code is the stable english code of the parent item (GROUP only),
--    so the tree can be rebuilt without identity remapping on each publish.
-- --------------------------------------------------------------------------
create table public.company_menu (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique
    constraint company_menu_code_check check (code ~ '^[A-Z][A-Z0-9_]{1,79}$'),
  title_fa text not null
    constraint company_menu_title_check check (btrim(title_fa) <> ''),
  item_type text not null
    constraint company_menu_type_check check (item_type in ('GROUP', 'FORM')),
  parent_code text,
  form_obligation_id uuid references public.obligations(id) on delete restrict,
  icon text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index company_menu_parent_idx on public.company_menu(parent_code);
create index company_menu_form_idx on public.company_menu(form_obligation_id);

-- --------------------------------------------------------------------------
-- 3. Publish function: validates the whole tree, then replaces the published
--    snapshot in one transaction. Runs as definer (owner) so it is allowed to
--    rewrite company_menu regardless of RLS; admin permission is asserted.
-- --------------------------------------------------------------------------
create or replace function public.replace_company_menu(p_items jsonb)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  it jsonb;
  v_code text;
  v_parent text;
  v_title text;
  v_type text;
  v_form uuid;
  v_icon text;
  v_order integer;
  v_active boolean;
  item_count integer := 0;
begin
  if not private.is_platform_admin() then
    raise exception 'permission denied';
  end if;

  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'p_items must be an array';
  end if;

  -- Validation pass
  for it in select * from jsonb_array_elements(p_items) loop
    v_code    := it->>'code';
    v_parent  := it->>'parent_code';
    v_title   := it->>'title_fa';
    v_type    := it->>'item_type';
    v_form    := nullif(it->>'form_obligation_id', '')::uuid;
    v_icon    := it->>'icon';
    v_order   := coalesce((it->>'sort_order')::int, 0);
    v_active  := coalesce((it->>'is_active')::bool, true);

    if v_code is null or btrim(v_code) = '' then
      raise exception 'کد قرارداد منو نامعتبر است';
    end if;
    if v_title is null or btrim(v_title) = '' then
      raise exception 'عنوان منو الزامی است (کد: %)', v_code;
    end if;
    if v_type is distinct from 'GROUP' and v_type is distinct from 'FORM' then
      raise exception 'نوع آیتم نامعتبر است (کد: %)', v_code;
    end if;

    -- GROUP rules
    if v_type = 'GROUP' then
      if v_form is not null then
        raise exception 'آیتم گروه نباید به فرم متصل باشد (کد: %)', v_code;
      end if;
      if v_parent is not null and v_parent = v_code then
        raise exception 'آیتم گروه نمی‌تواند والد خودش باشد (کد: %)', v_code;
      end if;
    end if;

    -- FORM rules
    if v_type = 'FORM' then
      if v_form is null then
        raise exception 'آیتم نوع فرم باید دارای فرم باشد (کد: %)', v_code;
      end if;
      -- A FORM leaf must reference an active obligation with a PUBLISHED version
      -- and cannot be used as the parent of any other item.
      if not exists (
        select 1 from public.obligations o
        where o.id = v_form and o.is_active
      ) or not exists (
        select 1 from public.obligation_versions ov
        where ov.obligation_id = v_form and ov.status = 'PUBLISHED'
      ) then
        raise exception 'فرم متصل نامعتبر یا منتشرنشده است (کد: %)', v_code;
      end if;
    end if;

    -- parent must point to a GROUP item (not a FORM leaf, not the item itself)
    if v_parent is not null then
      if v_parent = v_code then
        raise exception 'آیتم نمی‌تواند والد خودش باشد (کد: %)', v_code;
      end if;
      if not exists (
        select 1 from jsonb_array_elements(p_items) p
        where p->>'code' = v_parent and p->>'item_type' = 'GROUP'
      ) then
        raise exception 'والد باید یک آیتم گروه باشد (کد: %)', v_code;
      end if;
    end if;
  end loop;

  -- FORM items are always leaves: reject any item whose code is used as a parent_code.
  for it in select * from jsonb_array_elements(p_items) loop
    if (it->>'item_type') = 'FORM' then
      if exists (
        select 1 from jsonb_array_elements(p_items) p
        where p->>'parent_code' = (it->>'code')
      ) then
        raise exception 'آیتم نوع فرم نمی‌تواند زیرمنو داشته باشد (کد: %)', it->>'code';
      end if;
    end if;
  end loop;

  -- Atomically replace the published snapshot with the validated tree.
  -- (WHERE clause keeps the project's safeupdate-style guard happy and is a
  --  deliberate full-table clear before inserting the new snapshot.)
  delete from public.company_menu where id is not null;

  for it in select * from jsonb_array_elements(p_items) loop
    v_code   := it->>'code';
    v_parent := it->>'parent_code';
    v_title  := it->>'title_fa';
    v_type   := it->>'item_type';
    v_form   := nullif(it->>'form_obligation_id', '')::uuid;
    v_icon   := it->>'icon';
    v_order  := coalesce((it->>'sort_order')::int, 0);
    v_active := coalesce((it->>'is_active')::bool, true);

    insert into public.company_menu
      (code, title_fa, item_type, parent_code, form_obligation_id, icon, sort_order, is_active)
    values
      (v_code, v_title, v_type, v_parent, v_form, v_icon, v_order, v_active);
    item_count := item_count + 1;
  end loop;

  return 'published_' || item_count::text;
end;
$$;

-- --------------------------------------------------------------------------
-- 4. RLS + GRANTs
--    (Following the project-wide lesson: RLS policies are useless if a
--    table-level GRANT is missing, so we grant real access here.)
-- --------------------------------------------------------------------------
alter table public.company_menu_drafts enable row level security;
alter table public.company_menu enable row level security;

do $$ begin
  create policy company_menu_drafts_read
    on public.company_menu_drafts for select to authenticated using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy company_menu_drafts_write
    on public.company_menu_drafts for all to authenticated
    using (private.is_platform_admin())
    with check (private.is_platform_admin());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy company_menu_read
    on public.company_menu for select to authenticated using (true);
exception when duplicate_object then null; end $$;

grant select, insert, update, delete on table public.company_menu_drafts to authenticated;
grant select on table public.company_menu to authenticated;
grant execute on function public.replace_company_menu(jsonb) to authenticated;

commit;