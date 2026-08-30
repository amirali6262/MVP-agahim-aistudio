begin;

-- ---------------------------------------------------------------------------
-- Move the legacy eligibility facts (previously hardcoded in the frontend
-- FACTS array) into the database.
--
-- IMPORTANT: these facts must NOT be inserted into company_field_definitions.
-- The eligibility engine decides how to resolve a fact by looking it up in
-- company_field_definitions: if a row is found it resolves from
-- company_field_values (designer path), otherwise it falls back to the legacy
-- profile-JSON path. Seeding legacy keys there would silently switch existing
-- rules to the designer path (no stored value -> no match). So legacy facts
-- get their own metadata table that only powers the Studio rule editor UI;
-- the engine keeps resolving them from the company profile as before.
-- ---------------------------------------------------------------------------

create table if not exists public.eligibility_legacy_facts (
  key text primary key,
  title text not null,
  field_type text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.eligibility_legacy_facts
  add constraint eligibility_legacy_facts_field_type_check
  check (field_type in ('TEXT', 'LONG_TEXT', 'SELECT', 'MULTI_SELECT', 'BOOLEAN', 'NUMBER', 'DATE', 'NATIONAL_ID'));

insert into public.eligibility_legacy_facts (key, title, field_type, sort_order) values
  ('ENTITY_TYPE', 'نوع شخصیت', 'SELECT', 1),
  ('LEGAL_FORM', 'قالب ثبتی', 'SELECT', 2),
  ('PRIMARY_ACTIVITY', 'فعالیت اصلی', 'SELECT', 3),
  ('ACTIVITY_CODES', 'کدهای فعالیت', 'MULTI_SELECT', 4),
  ('TAX_REGISTRATION_STATUS', 'وضعیت ثبت مالیاتی', 'SELECT', 5),
  ('VAT_REGISTRATION_STATUS', 'وضعیت ارزش افزوده', 'SELECT', 6),
  ('EMPLOYEE_COUNT', 'تعداد کارکنان', 'NUMBER', 7),
  ('ANNUAL_REVENUE', 'فروش سالانه', 'NUMBER', 8),
  ('BRANCH_COUNT', 'تعداد شعب', 'NUMBER', 9),
  ('HAS_ACTIVE_CONTRACTS', 'قرارداد فعال', 'BOOLEAN', 10),
  ('CONTRACT_TYPES', 'نوع قراردادها', 'MULTI_SELECT', 11),
  ('PAYS_SALARIES', 'پرداخت حقوق', 'BOOLEAN', 12)
on conflict (key) do nothing;

-- Only the Studio rule editor needs to read these metadata rows; the engine
-- itself does not consult this table.
alter table public.eligibility_legacy_facts enable row level security;

create policy "eligibility_legacy_facts_select_authenticated"
  on public.eligibility_legacy_facts
  for select
  to authenticated
  using (true);

commit;
