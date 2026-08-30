-- ==========================================================================
-- Migration: Objection template wizard support
-- Date: 2026-09-03
-- Purpose: Back the 6-page wizard of the objection template form:
--   - objection_stages  : مرحله (grouping of actions); each stage belongs to one template
--   - objection_steps.stage_id : optional link; DELETE SET NULL keeps actions on stage removal
--   - condition_expression on transitions : structured, definition-only conditions
--   - objection_templates.status : DRAFT / ACTIVE with a DB-level activation guard
--   - objection_template_status_groups : optional per-template status definitions
--   - objection_template_obligations : DRAFT / ACTIVE / HISTORY links with a partial
--     UNIQUE on (obligation_id) WHERE link_status='ACTIVE' (one active process per obligation)
--   - public.activate_objection_template(...) : transactional activation with conflict handling
-- ==========================================================================

begin;

-- --------------------------------------------------------------------------
-- 1. objection_stages (verified: no existing stage table for custom templates)
-- --------------------------------------------------------------------------
create table if not exists public.objection_stages (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.objection_templates(id) on delete cascade,
  title text not null check (btrim(title) <> ''),
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists objection_stages_template_idx on public.objection_stages(template_id, sort_order);

comment on table public.objection_stages is
  'مرحله در الگوی اعتراض: گروهی از اقدامها. هر مرحله فقط به همان الگو متصل است.';

-- --------------------------------------------------------------------------
-- 2. objection_steps.stage_id (optional; stage deletion keeps its actions)
-- --------------------------------------------------------------------------
alter table public.objection_steps
  add column if not exists stage_id uuid references public.objection_stages(id) on delete set null;
create index if not exists objection_steps_stage_idx on public.objection_steps(stage_id);

-- An action may only point to a stage of the same template.
create or replace function public.objection_step_stage_guard()
returns trigger language plpgsql security definer set search_path = pg_catalog
as $$
begin
  if new.stage_id is not null and not exists (
    select 1 from public.objection_stages s
    where s.id = new.stage_id and s.template_id = new.template_id
  ) then
    raise exception 'اقدام باید به مرحلهای از همان الگو متصل باشد' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.objection_step_stage_guard() from public, anon, authenticated, service_role;
drop trigger if exists objection_step_stage_guard on public.objection_steps;
create trigger objection_step_stage_guard
  before insert or update of stage_id, template_id on public.objection_steps
  for each row execute function public.objection_step_stage_guard();

-- --------------------------------------------------------------------------
-- 3. Structured conditions on transitions (definition-only; no executor yet)
-- --------------------------------------------------------------------------
alter table public.objection_step_transitions
  add column if not exists condition_expression jsonb;

comment on column public.objection_step_transitions.condition_expression is
  'شرط ساختاریافته (فقط تعریف). موتور اجرای شروط هنوز ساخته نشده؛ الگوی دارای شروط فقط پیشنویس میماند.';

-- --------------------------------------------------------------------------
-- 4. Template status + activation guard
-- --------------------------------------------------------------------------
alter table public.objection_templates
  add column if not exists status text not null default 'DRAFT'
    constraint objection_templates_status_check check (status in ('DRAFT', 'ACTIVE'));

-- Backfill: previously active templates stay ACTIVE (no behavior change).
update public.objection_templates
set status = 'ACTIVE'
where status = 'DRAFT' and is_active = true;

-- A template with any structured condition may never be activated
-- (the condition executor does not exist yet).
create or replace function public.objection_template_has_conditions(p_template_id uuid)
returns boolean language plpgsql security definer set search_path = pg_catalog
as $$
declare v_has boolean;
begin
  select exists (
    select 1 from public.objection_steps s
    join public.objection_step_transitions t on t.step_id = s.id
    where s.template_id = p_template_id
      and t.condition_expression is not null
      and jsonb_typeof(t.condition_expression) = 'object'
      and jsonb_array_length(coalesce(t.condition_expression -> 'clauses', '[]'::jsonb)) > 0
  ) into v_has;
  return coalesce(v_has, false);
end;
$$;
revoke all on function public.objection_template_has_conditions(uuid) from public, anon, authenticated, service_role;

create or replace function public.objection_template_guard_activate()
returns trigger language plpgsql security definer set search_path = pg_catalog
as $$
begin
  if (new.status = 'ACTIVE' and old.status is distinct from 'ACTIVE')
     or (new.is_active = true and old.is_active is distinct from true) then
    if public.objection_template_has_conditions(new.id) then
      raise exception 'الگوی دارای شروط پشتیبانینشده قابل فعالسازی نیست؛ ابتدا شروط را حذف کنید' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.objection_template_guard_activate() from public, anon, authenticated, service_role;
drop trigger if exists objection_template_guard_activate on public.objection_templates;
create trigger objection_template_guard_activate
  before update of status, is_active on public.objection_templates
  for each row execute function public.objection_template_guard_activate();

-- --------------------------------------------------------------------------
-- 5. Status groups (definition-only; stable ids so renames keep references)
-- --------------------------------------------------------------------------
create table if not exists public.objection_template_status_groups (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.objection_templates(id) on delete cascade,
  code text not null check (btrim(code) <> ''),
  title text not null check (btrim(title) <> ''),
  -- [{ "id": "opt_x", "title": "...", "is_terminal": false }]
  options jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint objection_template_status_groups_template_code unique (template_id, code)
);
create index if not exists objection_template_status_groups_template_idx
  on public.objection_template_status_groups(template_id, sort_order);

comment on table public.objection_template_status_groups is
  'تعریف گروههای وضعیت برای یک الگو (فقط تعریف؛ وضعیت واقعی پرونده در اینجا ذخیره نمیشود).';

-- --------------------------------------------------------------------------
-- 6. Obligation links (DRAFT / ACTIVE / HISTORY) + one-active-per-obligation
-- --------------------------------------------------------------------------
create table if not exists public.objection_template_obligations (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.objection_templates(id) on delete cascade,
  obligation_id uuid not null references public.obligation_definitions(id) on delete restrict,
  link_status text not null default 'DRAFT'
    constraint objection_template_obligations_status_check check (link_status in ('DRAFT', 'ACTIVE', 'HISTORY')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One ACTIVE process per obligation — enforced at the database level,
-- not only in the UI.
create unique index if not exists objection_template_obligations_active_uidx
  on public.objection_template_obligations (obligation_id)
  where link_status = 'ACTIVE';

create index if not exists objection_template_obligations_template_idx
  on public.objection_template_obligations(template_id);

-- --------------------------------------------------------------------------
-- 7. Activation RPC (service-level guard; transactional; explicit replacement)
-- --------------------------------------------------------------------------
create or replace function public.activate_objection_template(
  p_template_id uuid,
  p_obligation_ids uuid[],
  p_replace_conflicts boolean
)
returns void
language plpgsql security definer set search_path = pg_catalog
as $$
declare
  v_oid uuid;
begin
  if auth.uid() is null or not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.objection_templates where id = p_template_id) then
    raise exception 'template not found' using errcode = 'P0002';
  end if;

  -- Same guard as the table trigger, raised early with a clear message.
  if public.objection_template_has_conditions(p_template_id) then
    raise exception 'الگوی دارای شروط پشتیبانینشده قابل فعالسازی نیست؛ ابتدا شروط را حذف کنید' using errcode = '23514';
  end if;

  -- Conflict check per obligation; replacement only with explicit confirmation.
  foreach v_oid in array p_obligation_ids loop
    if exists (
      select 1 from public.objection_template_obligations o
      where o.obligation_id = v_oid
        and o.link_status = 'ACTIVE'
        and o.template_id <> p_template_id
    ) then
      if p_replace_conflicts then
        update public.objection_template_obligations
        set link_status = 'HISTORY', updated_at = now()
        where obligation_id = v_oid and link_status = 'ACTIVE' and template_id <> p_template_id;
      else
        raise exception 'یک یا چند تعهد دارای اتصال فعال به الگوی دیگر هستند' using errcode = '23505';
      end if;
    end if;
  end loop;

  -- Activate the template (fires the guard trigger above).
  update public.objection_templates
  set status = 'ACTIVE', is_active = true, updated_at = now()
  where id = p_template_id;

  -- Promote this template's links for the selected obligations. Any previous
  -- DRAFT/ACTIVE row for this template+obligation is replaced by a fresh ACTIVE
  -- row (history rows are preserved). The partial unique index guarantees at
  -- most one ACTIVE link per obligation.
  foreach v_oid in array p_obligation_ids loop
    delete from public.objection_template_obligations
    where template_id = p_template_id and obligation_id = v_oid and link_status <> 'HISTORY';
    insert into public.objection_template_obligations (template_id, obligation_id, link_status)
    values (p_template_id, v_oid, 'ACTIVE')
    on conflict do nothing;
  end loop;

  -- Links of this template that are no longer selected move to history.
  update public.objection_template_obligations
  set link_status = 'HISTORY', updated_at = now()
  where template_id = p_template_id and link_status = 'ACTIVE'
    and not (obligation_id = any(p_obligation_ids));
end;
$$;
revoke all on function public.activate_objection_template(uuid, uuid[], boolean) from public, anon, authenticated;
grant execute on function public.activate_objection_template(uuid, uuid[], boolean) to authenticated;

-- --------------------------------------------------------------------------
-- 8. RLS (mirror objection_templates: authenticated read, platform admin write)
-- --------------------------------------------------------------------------
alter table public.objection_stages enable row level security;
alter table public.objection_template_status_groups enable row level security;
alter table public.objection_template_obligations enable row level security;

do $$ begin
  create policy objection_stages_read on public.objection_stages for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy objection_stages_admin_write on public.objection_stages for all to authenticated
    using (exists (select 1 from public.users where id = auth.uid() and (role = 'PLATFORM_ADMIN' or roles @> '"PLATFORM_ADMIN"')))
    with check (exists (select 1 from public.users where id = auth.uid() and (role = 'PLATFORM_ADMIN' or roles @> '"PLATFORM_ADMIN"')));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy objection_status_groups_read on public.objection_template_status_groups for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy objection_status_groups_admin_write on public.objection_template_status_groups for all to authenticated
    using (exists (select 1 from public.users where id = auth.uid() and (role = 'PLATFORM_ADMIN' or roles @> '"PLATFORM_ADMIN"')))
    with check (exists (select 1 from public.users where id = auth.uid() and (role = 'PLATFORM_ADMIN' or roles @> '"PLATFORM_ADMIN"')));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy objection_template_obligations_read on public.objection_template_obligations for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy objection_template_obligations_admin_write on public.objection_template_obligations for all to authenticated
    using (exists (select 1 from public.users where id = auth.uid() and (role = 'PLATFORM_ADMIN' or roles @> '"PLATFORM_ADMIN"')))
    with check (exists (select 1 from public.users where id = auth.uid() and (role = 'PLATFORM_ADMIN' or roles @> '"PLATFORM_ADMIN"')));
exception when duplicate_object then null; end $$;

grant select, insert, update, delete on public.objection_stages to authenticated;
grant select, insert, update, delete on public.objection_template_status_groups to authenticated;
grant select, insert, update, delete on public.objection_template_obligations to authenticated;

commit;
