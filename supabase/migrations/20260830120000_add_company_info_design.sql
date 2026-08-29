-- ==========================================================================
-- Migration: Company information designer (initial + complementary)
-- Date: 2026-08-30
-- Purpose: Everything defining what fields appear when creating / completing a
--          company is stored in Supabase — never hardcoded in the frontend.
--          Company field values live on `company_field_values`, keyed to the
--          company (tenant), kept separate from per-step obligation responses.
-- ==========================================================================

begin;

-- --------------------------------------------------------------------------
-- 1. Wizard steps (complementary onboarding wizard)
-- --------------------------------------------------------------------------
create table public.company_wizard_steps (
  id uuid primary key default extensions.gen_random_uuid(),
  title text not null constraint company_wizard_steps_title_check check (btrim(title) <> ''),
  description text,
  icon text,
  sort_order integer not null default 0,
  columns integer not null default 1 constraint company_wizard_steps_columns_check check (columns in (1, 2)),
  display_condition jsonb,
  is_active boolean not null default true,
  status text not null default 'DRAFT'
    constraint company_wizard_steps_status_check check (status in ('DRAFT', 'PUBLISHED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index company_wizard_steps_sort_idx on public.company_wizard_steps(status, sort_order);

-- --------------------------------------------------------------------------
-- 2. Company field definitions
-- --------------------------------------------------------------------------
create table public.company_field_definitions (
  id uuid primary key default extensions.gen_random_uuid(),
  key text not null constraint company_field_definitions_key_check check (btrim(key) <> ''),
  title text not null constraint company_field_definitions_title_check check (btrim(title) <> ''),
  field_type text not null
    constraint company_field_definitions_type_check check (field_type in (
      'TEXT', 'LONG_TEXT', 'SELECT', 'MULTI_SELECT', 'BOOLEAN', 'NUMBER', 'DATE', 'NATIONAL_ID'
    )),
  help_text text,
  required boolean not null default false,
  section text not null
    constraint company_field_definitions_section_check check (section in ('INITIAL', 'COMPLEMENTARY', 'BOTH')),
  wizard_step_id uuid references public.company_wizard_steps(id) on delete set null,
  sort_order integer not null default 0,
  width text not null default 'FULL'
    constraint company_field_definitions_width_check check (width in ('FULL', 'HALF')),
  -- { "field_key": {"operator": "...", "value": "..."} } simple conditional display.
  display_condition jsonb,
  ambiguous_titles jsonb,
  is_active boolean not null default true,
  is_system boolean not null default false,
  is_deletable boolean not null default true,
  used_in_eligibility boolean not null default false,
  status text not null default 'DRAFT'
    constraint company_field_definitions_status_check check (status in ('DRAFT', 'PUBLISHED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index company_field_definitions_key_uidx on public.company_field_definitions(lower(key));
create index company_field_definitions_section_idx on public.company_field_definitions(section, status, sort_order);
create index company_field_definitions_step_idx on public.company_field_definitions(wizard_step_id);

-- --------------------------------------------------------------------------
-- 3. Field options (incl. the natural/legal person options)
-- --------------------------------------------------------------------------
create table public.company_field_options (
  id uuid primary key default extensions.gen_random_uuid(),
  field_id uuid not null references public.company_field_definitions(id) on delete cascade,
  value text not null constraint company_field_options_value_check check (btrim(value) <> ''),
  label text not null constraint company_field_options_label_check check (btrim(label) <> ''),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  -- unique per field so re-running the seed never creates duplicate stable values
  constraint company_field_options_field_value_key unique (field_id, value)
);
create index company_field_options_field_idx on public.company_field_options(field_id, sort_order);

-- --------------------------------------------------------------------------
-- 4. Per-company field values (one row per company+field)
-- --------------------------------------------------------------------------
create table public.company_field_values (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  field_id uuid not null references public.company_field_definitions(id) on delete restrict,
  value text not null,
  recorded_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_field_values_tenant_field_key unique (tenant_id, field_id)
);
create index company_field_values_tenant_idx on public.company_field_values(tenant_id);

-- --------------------------------------------------------------------------
-- Triggers: keep updated_at current
-- --------------------------------------------------------------------------
create trigger company_field_definitions_set_updated_at
  before update on public.company_field_definitions
  for each row execute function public.set_updated_at();
create trigger company_wizard_steps_set_updated_at
  before update on public.company_wizard_steps
  for each row execute function public.set_updated_at();
create trigger company_field_values_set_updated_at
  before update on public.company_field_values
  for each row execute function public.set_updated_at();

-- --------------------------------------------------------------------------
-- RLS + GRANT
-- --------------------------------------------------------------------------
alter table public.company_field_definitions enable row level security;
alter table public.company_wizard_steps enable row level security;
alter table public.company_field_options enable row level security;
alter table public.company_field_values enable row level security;

-- Definitions: anyone authenticated reads (workspace filters PUBLISHED), only
-- platform admins manage (incl. drafts).
create policy company_field_definitions_select
  on public.company_field_definitions for select to authenticated
  using (private.is_platform_admin() or status = 'PUBLISHED');
create policy company_field_definitions_insert
  on public.company_field_definitions for insert to authenticated
  with check ((select private.is_platform_admin()));
create policy company_field_definitions_update
  on public.company_field_definitions for update to authenticated
  using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));
create policy company_field_definitions_delete
  on public.company_field_definitions for delete to authenticated
  using ((select private.is_platform_admin()));

create policy company_wizard_steps_select
  on public.company_wizard_steps for select to authenticated
  using (private.is_platform_admin() or status = 'PUBLISHED');
create policy company_wizard_steps_insert
  on public.company_wizard_steps for insert to authenticated
  with check ((select private.is_platform_admin()));
create policy company_wizard_steps_update
  on public.company_wizard_steps for update to authenticated
  using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));
create policy company_wizard_steps_delete
  on public.company_wizard_steps for delete to authenticated
  using ((select private.is_platform_admin()));

create policy company_field_options_select
  on public.company_field_options for select to authenticated
  using (true);
create policy company_field_options_insert
  on public.company_field_options for insert to authenticated
  with check ((select private.is_platform_admin()));
create policy company_field_options_update
  on public.company_field_options for update to authenticated
  using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));
create policy company_field_options_delete
  on public.company_field_options for delete to authenticated
  using ((select private.is_platform_admin()));

-- Company values: members of that company only (USING + WITH CHECK).
create policy company_field_values_select
  on public.company_field_values for select to authenticated
  using (private.is_tenant_member(tenant_id));
create policy company_field_values_insert
  on public.company_field_values for insert to authenticated
  with check (
    private.is_tenant_member(tenant_id)
    and (select private.is_tenant_member(tenant_id))
  );
create policy company_field_values_update
  on public.company_field_values for update to authenticated
  using (private.is_tenant_member(tenant_id))
  with check (private.is_tenant_member(tenant_id));
create policy company_field_values_delete
  on public.company_field_values for delete to authenticated
  using (private.is_tenant_member(tenant_id));

-- RLS restricts all writes to platform admins; these grants let that role's
-- requests pass the privilege layer (definitions/steps/options are admin-owned).
grant select, insert, update, delete on table public.company_field_definitions,
  public.company_wizard_steps,
  public.company_field_options to authenticated;
grant select, insert, update, delete on table public.company_field_values to authenticated;

-- --------------------------------------------------------------------------
-- Helper/Publisher RPCs
-- --------------------------------------------------------------------------
-- Publish every current DRAFT definition & step (idempotent).
create or replace function public.publish_company_info_design()
returns integer
language plpgsql
set search_path = pg_catalog
as $$
declare
  count_defs integer := 0;
  count_steps integer := 0;
begin
  if not (select private.is_platform_admin()) then
    raise exception 'platform admin required' using errcode = '42501';
  end if;
  update public.company_field_definitions set status = 'PUBLISHED', updated_at = now()
    where status = 'DRAFT';
  get diagnostics count_defs = row_count;
  update public.company_wizard_steps set status = 'PUBLISHED', updated_at = now()
    where status = 'DRAFT';
  get diagnostics count_steps = row_count;
  return count_defs + count_steps;
end;
$$;
revoke all on function public.publish_company_info_design()
  from public, anon, authenticated, service_role;
grant execute on function public.publish_company_info_design() to authenticated;

-- --------------------------------------------------------------------------
-- Seed: the three system fields (real system data, idempotent, non-destructive)
-- --------------------------------------------------------------------------
with ins as (
  insert into public.company_field_definitions (
    id, key, title, field_type, help_text, required, section,
    wizard_step_id, sort_order, width, display_condition,
    ambiguous_titles, is_active, is_system, is_deletable, used_in_eligibility, status
  )
  values
    (
      'f0000001-0000-0000-0000-000000000001',
      'legal_person_type',
      'نوع شخصیت',
      'SELECT',
      'تعیین میکند شرکت از نوع حقیقی یا حقوقی است.',
      true,
      'INITIAL',
      null,
      1,
      'FULL',
      null,
      '{}'::jsonb,
      true,
      true,
      false,
      true,
      'PUBLISHED'
    ),
    (
      'f0000002-0000-0000-0000-000000000002',
      'company_display_name',
      'نام شرکت یا کسب‌وکار',
      'TEXT',
      'نام رسمی شرکت یا عنوان کسب‌وکار.',
      true,
      'INITIAL',
      null,
      2,
      'FULL',
      null,
      '{"legal_entity":"نام شرکت","natural_person":"نام کسب‌وکار یا نام فعالیت"}'::jsonb,
      true,
      true,
      false,
      true,
      'PUBLISHED'
    ),
    (
      'f0000003-0000-0000-0000-000000000003',
      'national_identifier',
      'شناسه ملی یا کد ملی',
      'NATIONAL_ID',
      'شناسه ملی (حقوقی) یا کد ملی (حقیقی). اختیاری.',
      false,
      'INITIAL',
      null,
      3,
      'HALF',
      null,
      '{"legal_entity":"شناسه ملی","natural_person":"کد ملی"}'::jsonb,
      true,
      true,
      false,
      true,
      'PUBLISHED'
    )
  on conflict (lower(key)) do nothing
)
select 1;

-- Person type options (natural / legal) — real system data, stored in the DB.
insert into public.company_field_options (id, field_id, value, label, sort_order, is_active)
values
  ('o0000001-0000-0000-0000-000000000001', 'f0000001-0000-0000-0000-000000000001', 'natural_person', 'حقیقی', 1, true),
  ('o0000002-0000-0000-0000-000000000002', 'f0000001-0000-0000-0000-000000000001', 'legal_entity', 'حقوقی', 2, true)
on conflict (field_id, value) do nothing;

commit;