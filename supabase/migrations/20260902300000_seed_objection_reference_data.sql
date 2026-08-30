-- ==========================================================================
-- Migration: objection reference data moves from code into the database
-- Date: 2026-09-02
-- Purpose: The objection-templates page previously rendered reference data
--          from hardcoded frontend constants: default tax-type overrides,
--          preset objection steps, standard field packs, base events, gap
--          units, step actors and step natures. All of it now lives in the
--          database (dedicated tables + the central selection_lists infra),
--          so the page reads every option from Supabase.
-- ==========================================================================

begin;

-- --------------------------------------------------------------------------
-- 1. Default tax-type overrides (previously DEFAULT_TAX_OVERRIDES in code)
-- --------------------------------------------------------------------------
create table if not exists public.tax_type_override_defaults (
  id uuid primary key default extensions.gen_random_uuid(),
  tax_type text not null,
  tax_type_title text not null,
  statutory_deadline_override integer,
  deadline_unit text,
  legal_reference_override text,
  special_tribunal_name text,
  notes text,
  is_custom_path_active boolean not null default true,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists tax_type_override_defaults_tax_type_uidx
  on public.tax_type_override_defaults (lower(tax_type));

insert into public.tax_type_override_defaults (
  tax_type, tax_type_title, statutory_deadline_override, deadline_unit,
  legal_reference_override, special_tribunal_name, notes, is_custom_path_active, sort_order
) values
  (
    'TAX_CORPORATE', 'مالیات بر عملکرد اشخاص حقوقی', 30, 'روز',
    'ماده ۲۳۸ و ۲۴۴ قانون مالیات‌های مستقیم (مهلت ثبت ۳۰ روز - مهلت توافق ۴۵ روز)',
    'هیأت حل اختلاف مالیاتی بدوی و تجدیدنظر (ماده ۲۴۴ و ۲۴۷ ق.م.م)',
    'طبق ماده ۱۵۶ ق.م.م، چنانچه ظرف یک سال از تاریخ تسلیم اظهارنامه برگ تشخیص صادر نشود، ارقام ابرازی خودکار قطعی می‌گردد.',
    true, 1
  ),
  (
    'VAT', 'مالیات بر ارزش افزوده (قانون دائمی)', 20, 'روز',
    'ماده ۳۴ و ۳۶ قانون دائمی مالیات بر ارزش افزوده و ماده ۲۳۸ ق.م.م',
    'هیأت‌های تخصصی حل اختلاف ارزش افزوده و کارگروه اعتبارات مالیاتی',
    'مهلت اعتراض به برگ مطالبه ارزش افزوده ظرف ۲۰ روز از تاریخ ابلاغ اداری/الکترونیکی است.',
    true, 2
  ),
  (
    'SALARY_TAX', 'مالیات بر درآمد حقوق و مالیات‌های تکلیفی', 30, 'روز',
    'ماده ۸۶ و تبصره ماده ۲۱۶ قانون مالیات‌های مستقیم',
    'هیأت حل اختلاف مالیاتی موضوع ماده ۲۱۶ ق.م.م (رسیدگی به شکایات وصول و اجرا)',
    'دادرسی در خصوص مطالبه مالیات تکلیفی از پرداخت‌کننده از طریق هیأت ماده ۲۱۶ صورت می‌گیرد.',
    true, 3
  ),
  (
    'SEASONAL_REPORT', 'صورت معاملات فصلی (ماده ۱۶۹ مکرر)', 30, 'روز',
    'ماده ۱۶۹ و تبصره‌های ماده ۱۹۲ ق.م.م (جرایم عدم ارسال صورت معاملات)',
    'هیأت حل اختلاف مالیاتی بدوی (ماده ۲۴۴ ق.م.م)',
    'جرایم عدم ارائه فهرست معاملات مشمول بخشودگی‌های خاص موضوع ماده ۱۹۱ ق.م.م است.',
    true, 4
  ),
  (
    'INVOICE_SYSTEM', 'قانون پایانه‌های فروشگاهی و سامانه مؤدیان', 30, 'روز',
    'ماده ۹ و ۱۰ قانون پایانه‌های فروشگاهی و سامانه مؤدیان',
    'کارگروه ویژه راهبری سامانه مؤدیان و هیأت ۲۴۴ ق.م.م',
    'صورتحساب‌های الکترونیکی ثبت‌شده در سامانه مؤدیان معتبر بوده و رسیدگی خارج از سامانه ممنوع است.',
    true, 5
  )
on conflict (lower(tax_type)) do nothing;

-- --------------------------------------------------------------------------
-- 2. Preset objection steps (previously the presets in handleAddPresetStep)
-- --------------------------------------------------------------------------
create table if not exists public.objection_step_presets (
  id uuid primary key default extensions.gen_random_uuid(),
  nature text not null,
  title text not null default '',
  base_event text,
  gap_value integer,
  gap_unit text,
  step_nature text,
  actor text,
  note text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists objection_step_presets_nature_uidx
  on public.objection_step_presets (lower(nature));

insert into public.objection_step_presets (
  nature, title, base_event, gap_value, gap_unit, step_nature, actor, note, sort_order
) values
  (
    'CONDITIONAL_EXPERT', 'صدور و اجرای قرار کارشناسی (مشروط)',
    'تاریخ ابلاغ برگه تشخیص', 30, 'روز', 'CONDITIONAL_EXPERT', 'TAX_AUTHORITY',
    'در صورت صلاحدید ممیز کل یا هیأت جهت بررسی مجدد دفاتر و اسناد صادر می‌شود', 1
  ),
  (
    'AGREEMENT_END', 'خاتمه پرونده: توافق با ممیز کل / هیأت',
    'تاریخ ابلاغ برگه تشخیص', 30, 'روز', 'AGREEMENT_END', 'TAXPAYER',
    'امضای توافق‌نامه و ختم قطعی عملیات رسیدگی به اعتراض', 2
  ),
  (
    'SETTLEMENT_END', 'خاتمه پرونده: تمکین و پرداخت مالیات',
    'تاریخ ابلاغ برگه تشخیص', 30, 'روز', 'SETTLEMENT_END', 'TAXPAYER',
    'پذیرش مأخذ و پرداخت جهت استفاده از بخشودگی جرایم (ماده ۱۹۰)', 3
  ),
  (
    'EXPIRED_END', 'خاتمه پرونده: انقضای مهلت قانونی و قطعیت برگه',
    'تاریخ ابلاغ برگه تشخیص', 30, 'روز', 'EXPIRED_END', 'TAXPAYER',
    'عدم ثبت اعتراض ظرف مهلت مقرر موجب قطعیت مالیات و صدور برگ قطعی می‌گردد', 4
  ),
  (
    'FINAL_NOTICE_ISSUANCE', 'صدور برگه قطعی مالیاتی',
    'تاریخ صدور رای', 30, 'روز', 'FINAL_NOTICE_ISSUANCE', 'TAX_AUTHORITY',
    'صدور برگه قطعی رسمی و ارسال به واحد وصول و اجرا', 5
  ),
  (
    'NEXT_STAGE', 'عدم توافق/تمکین: ارجاع به هیأت حل اختلاف بدوی',
    'تاریخ ابلاغ برگه تشخیص', 30, 'روز', 'NEXT_STAGE', 'TAX_AUTHORITY',
    'ارسال پرونده به هیأت بدوی در صورت عدم تحقق توافق یا تمکین', 6
  ),
  (
    'MANDATORY', '',
    'تاریخ ابلاغ برگ/ااختیاریه', 20, 'روز', 'MANDATORY', 'TAXPAYER', '', 7
  )
on conflict (lower(nature)) do nothing;

-- --------------------------------------------------------------------------
-- 3. Standard field packs (previously handleAddStandardFieldPack in code)
-- --------------------------------------------------------------------------
create table if not exists public.objection_field_packs (
  id uuid primary key default extensions.gen_random_uuid(),
  pack_type text not null,
  title text not null,
  fields jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists objection_field_packs_pack_type_uidx
  on public.objection_field_packs (lower(pack_type));

insert into public.objection_field_packs (pack_type, title, fields, sort_order) values
  (
    'assessment', 'بسته فیلدهای برگ تشخیص / ابلاغیه',
    '[
      {"key":"notice_number","label":"شماره برگ تشخیص / ابلاغیه","type":"text","required":true,"placeholder":"مثال: ۱۴۰۴/ب/۹۸۱۲"},
      {"key":"notice_date","label":"تاریخ ابلاغ قانونی (شمسی)","type":"date","required":true},
      {"key":"tax_amount_claimed","label":"مبلغ مالیات مورد مطالبه (ریال)","type":"number","required":false},
      {"key":"notice_document_file","label":"تصویر / فایل برگ ابلاغیه","type":"file","required":false}
    ]'::jsonb, 1
  ),
  (
    'ruling', 'بسته فیلدهای دادنامه / رای',
    '[
      {"key":"ruling_number","label":"شماره دادنامه / رای صادره","type":"text","required":true},
      {"key":"ruling_date","label":"تاریخ صدور / ابلاغ رای","type":"date","required":true},
      {"key":"ruling_result_status","label":"نتیجه رای هیأت / مرجع","type":"select","required":true,"options":["تعدیل مالیات","رد اعتراض مودی (تایید برگه)","نقض و تجدید رسیدگی","قرار کارشناسی مجدد"]},
      {"key":"ruling_file","label":"پیوست فایل دادنامه و مستندات","type":"file","required":false}
    ]'::jsonb, 2
  ),
  (
    'general', 'بسته فیلدهای عمومی (دفاعیه / مدارک)',
    '[
      {"key":"defense_text","label":"شرح و متن دفاعیه/درخواست","type":"text","required":true},
      {"key":"submission_date","label":"تاریخ اقدام یا ثبت","type":"date","required":false},
      {"key":"defense_bill_file","label":"فایل لایحه اعتراضیه / مدارک","type":"file","required":false}
    ]'::jsonb, 3
  )
on conflict (lower(pack_type)) do nothing;

-- --------------------------------------------------------------------------
-- 4. RLS for the three reference tables
-- --------------------------------------------------------------------------
alter table public.tax_type_override_defaults enable row level security;
alter table public.objection_step_presets enable row level security;
alter table public.objection_field_packs enable row level security;

do $$ begin
  create policy tax_type_override_defaults_read on public.tax_type_override_defaults
    for select to authenticated using (is_active);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy tax_type_override_defaults_admin_write on public.tax_type_override_defaults
    for all to authenticated
    using (private.is_platform_admin())
    with check (private.is_platform_admin());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy objection_step_presets_read on public.objection_step_presets
    for select to authenticated using (is_active);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy objection_step_presets_admin_write on public.objection_step_presets
    for all to authenticated
    using (private.is_platform_admin())
    with check (private.is_platform_admin());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy objection_field_packs_read on public.objection_field_packs
    for select to authenticated using (is_active);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy objection_field_packs_admin_write on public.objection_field_packs
    for all to authenticated
    using (private.is_platform_admin())
    with check (private.is_platform_admin());
exception when duplicate_object then null; end $$;

grant select on table public.tax_type_override_defaults to authenticated;
grant select on table public.objection_step_presets to authenticated;
grant select on table public.objection_field_packs to authenticated;

-- --------------------------------------------------------------------------
-- 5. Selection lists for the small option sets
-- --------------------------------------------------------------------------
insert into public.selection_lists (
  id, key, title, description, source_type, is_dependent, parent_list_id,
  system_source_key, parent_selection_message, is_active, status, published_at, created_by
) values
  (
    'e0000201-0000-0000-0000-000000000001', 'objection_base_events', 'رویداد پایه (الگوی اعتراض)',
    'رویداد پایه برای گام‌های الگوی اعتراض.', 'STATIC', false, null, null, null,
    true, 'PUBLISHED', now(), null
  ),
  (
    'e0000202-0000-0000-0000-000000000001', 'objection_gap_units', 'واحد فاصله (الگوی اعتراض)',
    'واحد فاصله زمانی در گام‌های الگوی اعتراض.', 'STATIC', false, null, null, null,
    true, 'PUBLISHED', now(), null
  ),
  (
    'e0000203-0000-0000-0000-000000000001', 'objection_step_actors', 'مرجع / مسئول اقدام (الگوی اعتراض)',
    'مسئول انجام گام در الگوی اعتراض.', 'STATIC', false, null, null, null,
    true, 'PUBLISHED', now(), null
  ),
  (
    'e0000204-0000-0000-0000-000000000001', 'objection_step_natures', 'ماهیت گام (الگوی اعتراض)',
    'نوع و ماهیت گام در الگوی اعتراض.', 'STATIC', false, null, null, null,
    true, 'PUBLISHED', now(), null
  )
on conflict (lower(key)) do nothing;

insert into public.selection_list_options (id, list_id, key, label, sort_order, is_active, extra_info) values
  -- objection_base_events
  ('e0000211-0000-0000-0000-000000000001', 'e0000201-0000-0000-0000-000000000001', 'تاریخ ابلاغ برگ/ااختیاریه', 'تاریخ ابلاغ برگ/ااختیاریه', 1, true, null),
  ('e0000211-0000-0000-0000-000000000002', 'e0000201-0000-0000-0000-000000000001', 'تاریخ ابلاغ برگه تشخیص', 'تاریخ ابلاغ برگه تشخیص', 2, true, null),
  ('e0000211-0000-0000-0000-000000000003', 'e0000201-0000-0000-0000-000000000001', 'تاریخ صدور رای', 'تاریخ صدور رای', 3, true, null),
  ('e0000211-0000-0000-0000-000000000004', 'e0000201-0000-0000-0000-000000000001', 'تاریخ ابلاغ رای بدوی', 'تاریخ ابلاغ رای بدوی', 4, true, null),
  ('e0000211-0000-0000-0000-000000000005', 'e0000201-0000-0000-0000-000000000001', 'تاریخ اجرای قرار کارشناسی', 'تاریخ اجرای قرار کارشناسی', 5, true, null),
  -- objection_gap_units
  ('e0000212-0000-0000-0000-000000000001', 'e0000202-0000-0000-0000-000000000001', 'روز', 'روز', 1, true, null),
  ('e0000212-0000-0000-0000-000000000002', 'e0000202-0000-0000-0000-000000000001', 'ماه', 'ماه', 2, true, null),
  -- objection_step_actors
  ('e0000213-0000-0000-0000-000000000001', 'e0000203-0000-0000-0000-000000000001', 'TAXPAYER', 'مودی مالیاتی', 1, true, '{"desc":"اقدام توسط مودی یا وکیل قانونی"}'::jsonb),
  ('e0000213-0000-0000-0000-000000000002', 'e0000203-0000-0000-0000-000000000001', 'TAX_AUTHORITY', 'سازمان امور مالیاتی / هیأت‌ها', 2, true, '{"desc":"اقدام توسط اداره مالیات، ممیز کل، هیأت‌های بدوی/تجدیدنظر/۲۵۱ مکرر"}'::jsonb),
  ('e0000213-0000-0000-0000-000000000003', 'e0000203-0000-0000-0000-000000000001', 'COURT_DIVAN', 'دیوان عدالت اداری', 3, true, '{"desc":"اقدام توسط شعب بدوی/تجدیدنظر دیوان عدالت اداری"}'::jsonb),
  -- objection_step_natures
  ('e0000214-0000-0000-0000-000000000001', 'e0000204-0000-0000-0000-000000000001', 'MANDATORY', 'مرحله اصلی و الزامی', 1, true, '{"desc":"گام استاندارد و خطی در فرآیند اعتراض"}'::jsonb),
  ('e0000214-0000-0000-0000-000000000002', 'e0000204-0000-0000-0000-000000000001', 'CONDITIONAL_EXPERT', 'مرحله مشروط (قرار کارشناسی)', 2, true, '{"desc":"فقط در صورت صلاحدید و صدور قرار کارشناسی اجرا می‌شود"}'::jsonb),
  ('e0000214-0000-0000-0000-000000000003', 'e0000204-0000-0000-0000-000000000001', 'AGREEMENT_END', 'نقطه پایان (توافق با ممیز/هیأت)', 3, true, '{"desc":"توافق با ممیز کل یا هیأت (خاتمه و صدور برگ قطعی)"}'::jsonb),
  ('e0000214-0000-0000-0000-000000000004', 'e0000204-0000-0000-0000-000000000001', 'SETTLEMENT_END', 'نقطه پایان (تمکین و پرداخت)', 4, true, '{"desc":"تمکین مودی به رای/تشخیص و پرداخت مالیات"}'::jsonb),
  ('e0000214-0000-0000-0000-000000000005', 'e0000204-0000-0000-0000-000000000001', 'EXPIRED_END', 'نقطه پایان (انقضای مهلت و برگ قطعی)', 5, true, '{"desc":"انقضای مهلت قانونی بدون اقدام و صدور برگ قطعی"}'::jsonb),
  ('e0000214-0000-0000-0000-000000000006', 'e0000204-0000-0000-0000-000000000001', 'FINAL_NOTICE_ISSUANCE', 'صدور برگه قطعی مالیاتی', 6, true, '{"desc":"صدور رسمی برگ قطعی پرونده مالیاتی"}'::jsonb),
  ('e0000214-0000-0000-0000-000000000007', 'e0000204-0000-0000-0000-000000000001', 'NEXT_STAGE', 'ارسال به مرحله بعد', 7, true, '{"desc":"در صورت عدم توافق، پرونده به هیأت بدوی/تجدیدنظر/دیوان ارسال می‌شود"}'::jsonb)
on conflict (list_id, lower(key)) do nothing;

commit;
