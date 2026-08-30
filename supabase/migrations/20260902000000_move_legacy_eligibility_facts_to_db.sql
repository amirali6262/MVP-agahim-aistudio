begin;

-- ---------------------------------------------------------------------------
-- Move the legacy eligibility facts (previously hardcoded in the frontend
-- FACTS array) into the database. Each row keeps its original key so existing
-- eligibility_conditions that reference it keep resolving; is_legacy marks the
-- row so it is excluded from the company-info wizard and only surfaces in the
-- eligibility rule editor when a stored rule already uses it.
-- ---------------------------------------------------------------------------

alter table public.company_field_definitions
  add column if not exists is_legacy boolean not null default false;

with ins as (
  insert into public.company_field_definitions (
    id, key, title, field_type, help_text, required, section,
    wizard_step_id, sort_order, width, display_condition, ambiguous_titles,
    is_active, is_system, is_deletable, used_in_eligibility, status, is_legacy
  )
  values
    (
      'f0000004-0000-0000-0000-000000000004',
      'ENTITY_TYPE', 'نوع شخصیت', 'SELECT',
      'فکت قدیمی (قابل ارجاع در قواعد مشمولیت).', false, 'INITIAL',
      null, 10, 'FULL', null, '{}'::jsonb,
      true, true, false, true, 'PUBLISHED', true
    ),
    (
      'f0000005-0000-0000-0000-000000000005',
      'LEGAL_FORM', 'قالب ثبتی', 'SELECT',
      'فکت قدیمی (قابل ارجاع در قواعد مشمولیت).', false, 'INITIAL',
      null, 11, 'FULL', null, '{}'::jsonb,
      true, true, false, true, 'PUBLISHED', true
    ),
    (
      'f0000006-0000-0000-0000-000000000006',
      'PRIMARY_ACTIVITY', 'فعالیت اصلی', 'SELECT',
      'فکت قدیمی (قابل ارجاع در قواعد مشمولیت).', false, 'INITIAL',
      null, 12, 'FULL', null, '{}'::jsonb,
      true, true, false, true, 'PUBLISHED', true
    ),
    (
      'f0000007-0000-0000-0000-000000000007',
      'ACTIVITY_CODES', 'کدهای فعالیت', 'MULTI_SELECT',
      'فکت قدیمی (قابل ارجاع در قواعد مشمولیت).', false, 'INITIAL',
      null, 13, 'FULL', null, '{}'::jsonb,
      true, true, false, true, 'PUBLISHED', true
    ),
    (
      'f0000008-0000-0000-0000-000000000008',
      'TAX_REGISTRATION_STATUS', 'وضعیت ثبت مالیاتی', 'SELECT',
      'فکت قدیمی (قابل ارجاع در قواعد مشمولیت).', false, 'INITIAL',
      null, 14, 'FULL', null, '{}'::jsonb,
      true, true, false, true, 'PUBLISHED', true
    ),
    (
      'f0000009-0000-0000-0000-000000000009',
      'VAT_REGISTRATION_STATUS', 'وضعیت ارزش افزوده', 'SELECT',
      'فکت قدیمی (قابل ارجاع در قواعد مشمولیت).', false, 'INITIAL',
      null, 15, 'FULL', null, '{}'::jsonb,
      true, true, false, true, 'PUBLISHED', true
    ),
    (
      'f0000010-0000-0000-0000-000000000010',
      'EMPLOYEE_COUNT', 'تعداد کارکنان', 'NUMBER',
      'فکت قدیمی (قابل ارجاع در قواعد مشمولیت).', false, 'INITIAL',
      null, 16, 'FULL', null, '{}'::jsonb,
      true, true, false, true, 'PUBLISHED', true
    ),
    (
      'f0000011-0000-0000-0000-000000000011',
      'ANNUAL_REVENUE', 'فروش سالانه', 'NUMBER',
      'فکت قدیمی (قابل ارجاع در قواعد مشمولیت).', false, 'INITIAL',
      null, 17, 'FULL', null, '{}'::jsonb,
      true, true, false, true, 'PUBLISHED', true
    ),
    (
      'f0000012-0000-0000-0000-000000000012',
      'BRANCH_COUNT', 'تعداد شعب', 'NUMBER',
      'فکت قدیمی (قابل ارجاع در قواعد مشمولیت).', false, 'INITIAL',
      null, 18, 'FULL', null, '{}'::jsonb,
      true, true, false, true, 'PUBLISHED', true
    ),
    (
      'f0000013-0000-0000-0000-000000000013',
      'HAS_ACTIVE_CONTRACTS', 'قرارداد فعال', 'BOOLEAN',
      'فکت قدیمی (قابل ارجاع در قواعد مشمولیت).', false, 'INITIAL',
      null, 19, 'FULL', null, '{}'::jsonb,
      true, true, false, true, 'PUBLISHED', true
    ),
    (
      'f0000014-0000-0000-0000-000000000014',
      'CONTRACT_TYPES', 'نوع قراردادها', 'MULTI_SELECT',
      'فکت قدیمی (قابل ارجاع در قواعد مشمولیت).', false, 'INITIAL',
      null, 20, 'FULL', null, '{}'::jsonb,
      true, true, false, true, 'PUBLISHED', true
    ),
    (
      'f0000015-0000-0000-0000-000000000015',
      'PAYS_SALARIES', 'پرداخت حقوق', 'BOOLEAN',
      'فکت قدیمی (قابل ارجاع در قواعد مشمولیت).', false, 'INITIAL',
      null, 21, 'FULL', null, '{}'::jsonb,
      true, true, false, true, 'PUBLISHED', true
    )
  on conflict (lower(key)) do nothing
)
select 1;

commit;
