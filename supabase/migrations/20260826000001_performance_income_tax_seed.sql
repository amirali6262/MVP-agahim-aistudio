-- Performance income tax reference data only.
-- PIT stages and transitions are owned by 20260827100000_primary_board_performance_tax_reference.sql.
-- No taxpayer, case, payment, amount, or fictitious event is created.

BEGIN;

INSERT INTO public.tax_document_types (code, title_fa, document_type, category, description_fa, is_mandatory)
VALUES
  ('OBJECTION_EVIDENCE', 'اسناد و مدارک اعتراض', 'objection_evidence', 'مدارک', 'اسناد پشتیبان اعتراض', false),
  ('ARTICLE_238_INTERNAL_REFERRAL', 'ارجاع داخلی اعتراض', 'article_238_internal_referral', 'ارجاع', 'ارجاع داخلی اعتراض', true),
  ('REEXAMINATION_ORDER', 'قرار بررسی مجدد', 'reexamination_order', 'قرار', 'قرار بررسی یا کارشناسی مجدد', false),
  ('REEXAMINATION_EXECUTION_REPORT', 'گزارش اجرای قرار', 'reexamination_execution_report', 'گزارش', 'گزارش اجرای قرار', false),
  ('ARTICLE_238_REVIEW_RESULT', 'نتیجه رسیدگی مجدد ماده ۲۳۸', 'article_238_review_result', 'نتیجه', 'نتیجه رسیدگی مجدد', true),
  ('TAXPAYER_ACCEPTANCE', 'اعلام قبول کامل مؤدی', 'taxpayer_acceptance', 'اعلام', 'اعلام قبول کامل', false),
  ('TAXPAYER_PARTIAL_ACCEPTANCE', 'اعلام قبول بخشی', 'taxpayer_partial_acceptance', 'اعلام', 'اعلام قبول بخشی', false),
  ('TAXPAYER_REJECTION', 'اعلام عدم قبول نتیجه', 'taxpayer_rejection_of_review_result', 'اعلام', 'اعلام عدم قبول', false),
  ('FIRST_INSTANCE_BOARD_REFERRAL', 'ارجاع به هیأت بدوی', 'first_instance_board_referral', 'ارجاع', 'ارجاع اختلاف حل نشده', true),
  ('PERFORMANCE_TAX_FINAL_NOTICE', 'برگ قطعی مالیات بر عملکرد', 'performance_tax_final_notice', 'اسناد رسمی', 'برگ قطعی مالیات', true),
  ('TAX_PAYMENT_RECEIPT', 'رسید پرداخت مالیات', 'tax_payment_receipt', 'پرداخت', 'رسید پرداخت', false),
  ('PAYMENT_ARRANGEMENT', 'ترتیب پرداخت تأییدشده', 'payment_arrangement', 'پرداخت', 'ترتیب پرداخت', false),
  ('DEADLINE_EXPIRY_RECORD', 'سابقه پایان مهلت', 'deadline_expiry_record', 'سابقه', 'پایان مهلت قانونی', true),
  ('NOTIFICATION_RECORD', 'اعلان سیستمی', 'notification_record', 'اعلان', 'هشدار یا یادآوری', false)
ON CONFLICT (code) DO UPDATE SET
  title_fa = EXCLUDED.title_fa,
  document_type = EXCLUDED.document_type,
  category = EXCLUDED.category,
  description_fa = EXCLUDED.description_fa,
  is_mandatory = EXCLUDED.is_mandatory,
  updated_at = now();

INSERT INTO public.tax_legal_references
  (code, title_fa, source_type, source_number, article_or_section, relevant_text_fa, source_url, is_active, last_verified_date)
VALUES
  ('ART_237', 'ماده ۲۳۷ قانون مالیات‌های مستقیم', 'law', 'قانون مالیات‌های مستقیم', 'ماده ۲۳۷', 'شرایط برگ تشخیص و دسترسی به گزارش مبنا', 'https://qavanin.ir/Law/TreeText?ApproveStateNo=&IDS=892583840653829785', true, CURRENT_DATE),
  ('ART_238', 'ماده ۲۳۸ قانون مالیات‌های مستقیم', 'law', 'قانون مالیات‌های مستقیم', 'ماده ۲۳۸', 'اعتراض و رسیدگی مجدد', 'https://qavanin.ir/Law/TreeText?ApproveStateNo=&IDS=892583840653829785', true, CURRENT_DATE),
  ('ART_239', 'ماده ۲۳۹ قانون مالیات‌های مستقیم', 'law', 'قانون مالیات‌های مستقیم', 'ماده ۲۳۹', 'قبول، پرداخت، ترتیب پرداخت و رفع اختلاف', 'https://qavanin.ir/Law/TreeText?ApproveStateNo=&IDS=892583840653829785', true, CURRENT_DATE),
  ('ART_239_NOTE', 'تبصره ماده ۲۳۹', 'law', 'قانون مالیات‌های مستقیم', 'تبصره ماده ۲۳۹', 'آثار ابلاغ قانونی', 'https://qavanin.ir/Law/TreeText?ApproveStateNo=&IDS=892583840653829785', true, CURRENT_DATE),
  ('ART_203_208', 'مواد ۲۰۳ و ۲۰۸ قانون مالیات‌های مستقیم', 'law', 'قانون مالیات‌های مستقیم', 'مواد ۲۰۳ و ۲۰۸', 'قواعد ابلاغ', 'https://qavanin.ir/Law/TreeText?ApproveStateNo=&IDS=892583840653829785', true, CURRENT_DATE),
  ('ART_210', 'ماده ۲۱۰ قانون مالیات‌های مستقیم', 'law', 'قانون مالیات‌های مستقیم', 'ماده ۲۱۰', 'پرداخت مالیات قطعی', 'https://qavanin.ir/Law/TreeText?ApproveStateNo=&IDS=892583840653829785', true, CURRENT_DATE),
  ('ART_219', 'ماده ۲۱۹ قانون مالیات‌های مستقیم', 'law', 'قانون مالیات‌های مستقیم', 'ماده ۲۱۹', 'فرایند حسابرسی', 'https://qavanin.ir/Law/TreeText?ApproveStateNo=&IDS=892583840653829785', true, CURRENT_DATE),
  ('ART_244', 'ماده ۲۴۴ قانون مالیات‌های مستقیم', 'law', 'قانون مالیات‌های مستقیم', 'ماده ۲۴۴', 'مرجع حل اختلاف و ارجاع', 'https://qavanin.ir/Law/TreeText?ApproveStateNo=&IDS=892583840653829785', true, CURRENT_DATE),
  ('DIR_238_EXEC', 'دستورالعمل اجرایی ماده ۲۳۸', 'directive', '200/10238/150446/ص', NULL, 'دستورالعمل اجرایی ماده ۲۳۸', 'https://thdorsan.com/law-doc/اجرایی-ماده-ق-م-م-200-10238-150446-ص', true, CURRENT_DATE),
  ('DIR_238_EXEC_AMENDMENT', 'اصلاحیه دستورالعمل ماده ۲۳۸', 'directive', '84380', NULL, 'اصلاحیه دستورالعمل', 'https://thdorsan.com/law-doc/اصلاحیه-دستورالعمل-اجرایی-ق-م-م-84380', true, CURRENT_DATE),
  ('DIR_238_EXEC_AMENDMENT2', 'اصلاح پاراگراف دستورالعمل ماده ۲۳۸', 'directive', '155345', NULL, 'اصلاح دستورالعمل', NULL, true, CURRENT_DATE),
  ('DIR_ELECTRONIC_SERVICE', 'دستورالعمل ابلاغ الکترونیکی', 'directive', '200/1401/531', NULL, 'ابلاغ الکترونیکی اوراق مالیاتی', NULL, true, CURRENT_DATE),
  ('DIVAN_ELECTRONIC_ONLY', 'رأی ابطال محدودیت ثبت صرفاً الکترونیکی اعتراض', 'judicial_precedent', '3236148830899601480', NULL, 'ابطال محدودیت ثبت اعتراض صرفاً الکترونیکی', 'https://qavanin.ir/Law/TreeText/?IDS=3236148830899601480', true, CURRENT_DATE)
ON CONFLICT (code) DO UPDATE SET
  title_fa = EXCLUDED.title_fa,
  source_number = EXCLUDED.source_number,
  article_or_section = EXCLUDED.article_or_section,
  relevant_text_fa = EXCLUDED.relevant_text_fa,
  source_url = EXCLUDED.source_url,
  is_active = EXCLUDED.is_active,
  last_verified_date = EXCLUDED.last_verified_date,
  updated_at = now();

INSERT INTO public.iran_holidays (holiday_date, title_fa, is_recurring, category)
VALUES
  ('2026-03-21', 'نوروز', false, 'official'),
  ('2026-03-22', 'نوروز', false, 'official'),
  ('2026-03-23', 'نوروز', false, 'official'),
  ('2026-03-24', 'نوروز', false, 'official'),
  ('2026-04-01', 'روز جمهوری اسلامی', false, 'official'),
  ('2026-04-02', 'روز طبیعت', false, 'official'),
  ('2026-06-14', 'شهادت امام علی', false, 'official'),
  ('2026-06-24', 'عید فطر', false, 'official'),
  ('2026-08-05', 'شهادت امام جعفر صادق', false, 'official'),
  ('2026-08-26', 'عید قربان', false, 'official'),
  ('2026-09-02', 'عید سعید غدیر خم', false, 'official'),
  ('2026-10-24', 'تاسوعا', false, 'official'),
  ('2026-10-25', 'عاشورا', false, 'official'),
  ('2026-12-01', 'اربعین حسینی', false, 'official')
ON CONFLICT (holiday_date) DO UPDATE SET
  title_fa = EXCLUDED.title_fa,
  category = EXCLUDED.category;

COMMIT;
