-- =============================================================================
-- Migration: Performance Income Tax Workflow - Part 2 (Seed Data)
-- Version: 20260826000001
-- Description: Continues seed data for document types, legal references, 
--              workflow steps, and transitions
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 6. SEED DATA: DOCUMENT TYPES (continued)
-- -----------------------------------------------------------------------------

INSERT INTO tax_document_types (code, title_fa, document_type, category, description_fa, is_mandatory) VALUES
  ('TAX_AUDIT_REPORT', 'گزارش رسیدگی یا حسابرسی مالیاتی', 'tax_audit_report', 'گزارش', 'گزارش نهایی و تأییدشده مبنای تشخیص', true),
  ('PERFORMANCE_TAX_ASSESSMENT_NOTICE', 'برگ تشخیص مالیات بر عملکرد', 'performance_tax_assessment_notice', 'اسناد رسمی', 'برگ تشخیص صادرشده و قابل ابلاغ', true),
  ('ASSESSMENT_SERVICE_RECORD', 'سابقه ابلاغ برگ تشخیص', 'assessment_service_record', 'ابلاغ', 'نوع، روش، تاریخ مؤثر و مستند اعتبار ابلاغ', true),
  ('AUDIT_REPORT_DETAIL_REQUEST', 'درخواست دریافت جزئیات گزارش مبنای تشخیص', 'audit_report_detail_request', 'درخواست', 'درخواست اختیاری مؤدی که مهلت اعتراض را متوقف نمی‌کند', false),
  ('AUDIT_REPORT_DETAIL_RESPONSE', 'پاسخ جزئیات گزارش مبنای تشخیص', 'audit_report_detail_response', 'پاسخ', 'گزارش یا توضیحات ارائه‌شده توسط سازمان', false),
  ('ARTICLE_238_OBJECTION', 'اعتراض و درخواست رسیدگی مجدد موضوع ماده ۲۳۸', 'article_238_objection', 'اعتراض', 'اعتراض معتبر الکترونیکی، حضوری، پستی یا روش قانونی دیگر', true),
  ('OBJECTION_EVIDENCE', 'اسناد و مدارک اعتراض', 'objection_evidence', 'مدارک', 'اسناد و مدارک پشتیبان اعتراض', false),
  ('ARTICLE_238_INTERNAL_REFERRAL', 'ارجاع داخلی اعتراض', 'article_238_internal_referral', 'ارجاع', 'ارجاع داخلی اعتراض برای رسیدگی مجدد', true),
  ('REEXAMINATION_ORDER', 'قرار بررسی، تحقیق یا کارشناسی مجدد', 'reexamination_order', 'قرار', 'قرار بررسی، تحقیق یا کارشناسی مجدد', false),
  ('REEXAMINATION_EXECUTION_REPORT', 'گزارش اجرای قرار', 'reexamination_execution_report', 'گزارش', 'گزارش اجرای قرار کارشناسی', false),
  ('ARTICLE_238_REVIEW_RESULT', 'نتیجه رسیدگی مجدد موضوع ماده ۲۳۸', 'article_238_review_result', 'نتیجه', 'نتیجه رسیدگی مجدد موضوع ماده ۲۳۸', true),
  ('TAXPAYER_ACCEPTANCE', 'اعلام قبول کامل مؤدی', 'taxpayer_acceptance', 'اعلام', 'اعلام قبول کامل مؤدی', false),
  ('TAXPAYER_PARTIAL_ACCEPTANCE', 'اعلام قبول بخشی از نتیجه', 'taxpayer_partial_acceptance', 'اعلام', 'اعلام قبول بخشی از نتیجه و ادامه اعتراض', false),
  ('TAXPAYER_REJECTION', 'اعلام عدم قبول نتیجه رسیدگی مجدد', 'taxpayer_rejection_of_review_result', 'اعلام', 'اعلام عدم قبول نتیجه رسیدگی مجدد', false),
  ('FIRST_INSTANCE_BOARD_REFERRAL', 'گزارش یا دستور ارجاع مابه‌الاختلاف به هیأت بدوی', 'first_instance_board_referral', 'ارجاع', 'گزارش یا دستور ارجاع مابه‌الاختلاف به هیأت حل اختلاف مالیاتی بدوی', true),
  ('PERFORMANCE_TAX_FINAL_NOTICE', 'برگ قطعی مالیات بر عملکرد', 'performance_tax_final_notice', 'اسناد رسمی', 'برگ قطعی مالیات بر عملکرد', true),
  ('TAX_PAYMENT_RECEIPT', 'رسید پرداخت مالیات', 'tax_payment_receipt', 'پرداخت', 'رسید پرداخت مالیات', false),
  ('PAYMENT_ARRANGEMENT', 'ترتیب پرداخت یا تقسیط تأییدشده', 'payment_arrangement', 'پرداخت', 'ترتیب پرداخت یا تقسیط تأییدشده', false),
  ('DEADLINE_EXPIRY_RECORD', 'سابقه پایان مهلت قانونی', 'deadline_expiry_record', 'سابقه', 'سابقه پایان مهلت قانونی', true),
  ('NOTIFICATION_RECORD', 'هشدار، یادآوری یا اعلان سیستمی', 'notification_record', 'اعلان', 'هشدار، یادآوری یا اعلان سیستمی', false)
ON CONFLICT (code) DO UPDATE SET
  title_fa = EXCLUDED.title_fa,
  document_type = EXCLUDED.document_type,
  category = EXCLUDED.category,
  description_fa = EXCLUDED.description_fa,
  is_mandatory = EXCLUDED.is_mandatory,
  updated_at = now();

-- -----------------------------------------------------------------------------
-- 7. SEED DATA: LEGAL REFERENCES
-- -----------------------------------------------------------------------------

INSERT INTO tax_legal_references (code, title_fa, source_type, source_number, article_or_section, relevant_text_fa, source_url, is_active, effective_date) VALUES
  -- قانون مالیات‌های مستقیم
  ('ART_237', 'ماده ۲۳۷ قانون مالیات‌های مستقیم', 'law', NULL, 'ماده ۲۳۷', 'شرایط برگ تشخیص و دسترسی مؤدی به جزئیات گزارش مبنای تشخیص', 'https://qavanin.ir/Law/TreeText?ApproveStateNo=&IDS=892583840653829785', true, NULL),
  ('ART_238', 'ماده ۲۳۸ قانون مالیات‌های مستقیم', 'law', NULL, 'ماده ۲۳۸', 'اعتراض ۳۰روزه و رسیدگی مجدد حداکثر ظرف ۴۵ روز', 'https://qavanin.ir/Law/TreeText?ApproveStateNo=&IDS=892583840653829785', true, NULL),
  ('ART_239', 'ماده ۲۳۹ قانون مالیات‌های مستقیم', 'law', NULL, 'ماده ۲۳۹', 'قطعیت از طریق قبول، پرداخت، ترتیب پرداخت، رفع اختلاف یا عدم اعتراض', 'https://qavanin.ir/Law/TreeText?ApproveStateNo=&IDS=892583840653829785', true, NULL),
  ('ART_239_NOTE', 'تبصره ماده ۲۳۹ قانون مالیات‌های مستقیم', 'law', NULL, 'تبصره ماده ۲۳۹', 'در حکم معترض بودن مؤدی در موارد ابلاغ قانونی مقرر', 'https://qavanin.ir/Law/TreeText?ApproveStateNo=&IDS=892583840653829785', true, NULL),
  ('ART_203_208', 'مواد ۲۰۳ و ۲۰۸ قانون مالیات‌های مستقیم', 'law', NULL, 'مواد ۲۰۳ و ۲۰۸', 'قواعد ابلاغ قانونی', 'https://qavanin.ir/Law/TreeText?ApproveStateNo=&IDS=892583840653829785', true, NULL),
  ('ART_210', 'ماده ۲۱۰ قانون مالیات‌های مستقیم', 'law', NULL, 'ماده ۲۱۰', 'مهلت پرداخت مالیات قطعی', 'https://qavanin.ir/Law/TreeText?ApproveStateNo=&IDS=892583840653829785', true, NULL),
  ('ART_219', 'ماده ۲۱۹ و آیین‌نامه اجرایی آن', 'law', NULL, 'ماده ۲۱۹', 'فرایند حسابرسی و عملیات سازمان', 'https://qavanin.ir/Law/TreeText?ApproveStateNo=&IDS=892583840653829785', true, NULL),
  ('ART_244', 'ماده ۲۴۴ قانون مالیات‌های مستقیم', 'law', NULL, 'ماده ۲۴۴', 'مرجع حل اختلاف و ارجاع پرونده', 'https://qavanin.ir/Law/TreeText?ApproveStateNo=&IDS=892583840653829785', true, NULL),
  ('ART_229_LAST', 'قسمت اخیر ماده ۲۲۹ قانون مالیات‌های مستقیم', 'law', NULL, 'ماده ۲۲۹', 'امکان بررسی مدارک برای تعیین درآمد واقعی', 'https://qavanin.ir/Law/TreeText?ApproveStateNo=&IDS=892583840653829785', true, NULL),
  
  -- قانون مالیات بر ارزش افزوده
  ('VAT_ART_48', 'ماده ۴۸ قانون مالیات بر ارزش افزوده', 'law', NULL, 'ماده ۴۸', 'اصلاح ماده ۲۳۸ قانون مالیات‌های مستقیم', 'https://qavanin.ir/Law/TreeText?ApproveStateNo=&IDS=17874811672232780652', true, NULL),
  ('VAT_ART_49', 'ماده ۴۹ قانون مالیات بر ارزش افزوده', 'law', NULL, 'ماده ۴۹', 'اصلاح تبصره ماده ۲۳۹', 'https://qavanin.ir/Law/TreeText?ApproveStateNo=&IDS=17874811672232780652', true, NULL),
  ('VAT_ART_50', 'ماده ۵۰ قانون مالیات بر ارزش افزوده', 'law', NULL, 'ماده ۵۰', 'اصلاح ماده ۲۴۴', 'https://qavanin.ir/Law/TreeText?ApproveStateNo=&IDS=17874811672232780652', true, NULL),
  
  -- دستورالعمل‌ها
  ('DIR_238_EXEC', 'دستورالعمل اجرایی ماده ۲۳۸', 'directive', '200/10238/150446/ص', NULL, 'دستورالعمل اجرایی ماده ۲۳۸ مورخ ۱۴۰۰/۰۹/۲۱', 'https://thdorsan.com/law-doc/اجرایی-ماده-ق-م-م-200-10238-150446-ص', true, '2021-12-12'),
  ('DIR_238_EXEC_AMENDMENT', 'اصلاحیه دستورالعمل اجرایی ماده ۲۳۸', 'directive', '84380', NULL, 'اصلاحیه مورخ ۱۴۰۲/۰۵/۱۴', 'https://thdorsan.com/law-doc/اصلاحیه-دستورالعمل-اجرایی-ق-م-م-84380', true, '2023-08-05'),
  ('DIR_238_EXEC_AMENDMENT2', 'اصلاح پاراگراف آخر دستورالعمل ماده ۲۳۸', 'directive', '155345', NULL, 'اصلاح مورخ ۱۴۰۲/۰۸/۰۷', NULL, true, '2023-10-29'),
  ('DIR_ELECTRONIC_SERVICE', 'دستورالعمل ابلاغ الکترونیکی اوراق مالیاتی', 'directive', '200/1401/531', NULL, 'دستورالعمل ابلاغ الکترونیکی و اصلاحات آن', NULL, true, '2022-03-21'),
  ('DIR_EXEC_531', 'ترتیبات اجرایی', 'directive', '200/1400/531', NULL, 'ترتیبات اجرایی مورخ ۱۴۰۰/۱۱/۱۲ فقط در بخش‌های معتبر', NULL, true, '2022-02-01'),
  
  -- آرای دیوان
  ('DIVAN_ELECTRONIC_ONLY', 'رأی ابطال محدودیت ثبت صرفاً الکترونیکی اعتراض', 'judicial_precedent', NULL, NULL, 'آرای دیوان عدالت اداری مبنی بر ابطال مقرراتی که ثبت اعتراض را فقط به پنجره الکترونیکی محدود می‌کرد', 'https://qavanin.ir/Law/TreeText/?IDS=3236148830899601480', true, NULL)
ON CONFLICT (code) DO UPDATE SET
  title_fa = EXCLUDED.title_fa,
  source_type = EXCLUDED.source_type,
  source_number = EXCLUDED.source_number,
  article_or_section = EXCLUDED.article_or_section,
  relevant_text_fa = EXCLUDED.relevant_text_fa,
  source_url = EXCLUDED.source_url,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- Holidays are deliberately not guessed or seeded from a sample calendar.
-- Operations must import the authoritative annual closure calendar before
-- enabling automatic deadline execution for that year.

-- -----------------------------------------------------------------------------
-- 9. SEED DATA: WORKFLOW TEMPLATE & STEPS FOR PERFORMANCE INCOME TAX
-- -----------------------------------------------------------------------------

-- First, create the obligation family for direct taxes
INSERT INTO obligation_families (id, code, title, domain, description, is_active, created_by) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'DIRECT_TAXES', 'مالیات‌های مستقیم', 'TAX', 'مالیات‌های مستقیم شامل مالیات بر عملکرد، مالیات بر ارث و غیره', true, NULL)
ON CONFLICT (code) DO UPDATE SET
  title = EXCLUDED.title,
  updated_at = now();

-- Create the obligation for performance income tax
INSERT INTO obligations (id, code, title, family_id, authority_name, summary, is_active, created_by) VALUES
  ('b0000001-0000-0000-0000-000000000001', 'PERFORMANCE_INCOME_TAX', 'مالیات بر عملکرد', 'a0000001-0000-0000-0000-000000000001', 'سازمان امور مالیاتی کشور', 'مسیر مشترک اشخاص حقیقی و حقوقی از تهیه گزارش رسیدگی تا قطعیت یا ارجاع اختلاف به هیأت بدوی؛ شناسه دامنه: performance_income_tax', true, NULL)
ON CONFLICT (code) DO UPDATE SET
  title = EXCLUDED.title,
  updated_at = now();

-- Create obligation version
INSERT INTO obligation_versions (id, obligation_id, version_number, status, effective_from, legal_reference, source_url, created_by) VALUES
  ('c0000001-0000-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000001', 1, 'DRAFT', '2026-01-01', 'قانون مالیات‌های مستقیم - مواد ۲۰۳، ۲۰۸، ۲۱۰، ۲۱۹، ۲۲۹، ۲۳۷ تا ۲۳۹ و ۲۴۴', 'https://qavanin.ir/Law/TreeText?ApproveStateNo=&IDS=892583840653829785', NULL)
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  updated_at = now();

-- The judicial path is shared in v1.0.0; eligibility keeps natural and legal
-- taxpayers independently addressable for future variations.
INSERT INTO eligibility_rule_sets
  (id,obligation_version_id,priority,title,outcome,explanation,created_by)
VALUES
  ('c1000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001',1,'شخص حقوقی دارای پرونده مالیات بر عملکرد','ELIGIBLE','مسیر رسیدگی و اعتراض مالیات بر عملکرد برای شخص حقوقی فعال است.',NULL),
  ('c1000001-0000-0000-0000-000000000002','c0000001-0000-0000-0000-000000000001',2,'شخص حقیقی دارای پرونده مالیات بر عملکرد','ELIGIBLE','مسیر رسیدگی و اعتراض مالیات بر عملکرد برای شخص حقیقی فعال است.',NULL)
ON CONFLICT (id) DO UPDATE SET title=excluded.title,outcome=excluded.outcome,explanation=excluded.explanation;

INSERT INTO eligibility_conditions (id,rule_set_id,sequence,fact_key,operator,expected_value)
VALUES
  ('c2000001-0000-0000-0000-000000000001','c1000001-0000-0000-0000-000000000001',1,'ENTITY_TYPE','EQ','"حقوقی"'),
  ('c2000001-0000-0000-0000-000000000002','c1000001-0000-0000-0000-000000000002',1,'ENTITY_TYPE','EQ','"حقیقی"')
ON CONFLICT (id) DO UPDATE SET expected_value=excluded.expected_value;

-- Create workflow template
INSERT INTO workflow_templates (id, obligation_version_id, title, created_by) VALUES
  ('d0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001', 'فرایند مالیات بر عملکرد نسخه 1.0.0 - تا قطعیت یا ارجاع به هیأت بدوی', NULL)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title;

-- Create workflow steps (PIT-001 to PIT-051)
INSERT INTO workflow_steps (id, workflow_template_id, sequence, code, title, actor, is_optional, form_schema, phase_code, actor_role_code, responsible_organization, action_type, is_system_generated, is_user_action_required, preconditions, input_document_types, output_document_types, user_guidance_fa, admin_guidance_fa) VALUES

-- PIT-001: تهیه گزارش رسیدگی
('e0000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000001', 1, 'PIT-001', 'تهیه گزارش رسیدگی مالیات بر عملکرد', 'PLATFORM_ADMIN', false,
 '{"fields": [
   {"key": "report_number", "label": "شماره گزارش", "type": "text", "required": true},
   {"key": "report_date", "label": "تاریخ گزارش", "type": "date", "required": true},
   {"key": "audit_team", "label": "اعضای گروه رسیدگی", "type": "text", "required": true},
   {"key": "audit_method", "label": "روش حسابرسی", "type": "select", "options": ["حسابرسی کامل", "نمونه‌گیری", "تحلیل ریسک"], "required": true},
   {"key": "reviewed_documents", "label": "اسناد بررسی‌شده", "type": "text", "required": false},
   {"key": "accepted_items", "label": "اقلام مورد قبول", "type": "number", "required": true},
   {"key": "rejected_items", "label": "اقلام ردشده", "type": "number", "required": true},
   {"key": "adjustments", "label": "تعدیلات", "type": "number", "required": false},
   {"key": "calculated_taxable_income", "label": "درآمد مشمول مالیات محاسبه‌شده", "type": "number", "required": true},
   {"key": "calculated_tax", "label": "مالیات محاسبه‌شده", "type": "number", "required": true},
   {"key": "penalties", "label": "جرائم", "type": "number", "required": false},
   {"key": "reasons_and_documents", "label": "دلایل و مستندات", "type": "text", "required": true},
   {"key": "attachments", "label": "پیوست‌ها", "type": "text", "required": false},
   {"key": "signers", "label": "امضاکنندگان", "type": "text", "required": true}
 ]}',
 'PHASE_1', 'tax_audit_unit', 'سازمان امور مالیاتی', 'audit', false, true,
 '[]',
 ARRAY['tax_audit_report'],
 ARRAY['tax_audit_report'],
 'گزارش رسیدگی مالیاتی را با دقت تهیه و تکمیل کنید.',
 'گزارش رسیدگی باید شامل تمام اقلام مورد بررسی، دلایل و مستندات باشد.'),

-- PIT-002: صدور برگ تشخیص
('e0000001-0000-0000-0000-000000000002', 'd0000001-0000-0000-0000-000000000001', 2, 'PIT-002', 'صدور برگ تشخیص مالیات بر عملکرد', 'PLATFORM_ADMIN', false,
 '{"fields": [
   {"key": "notice_number", "label": "شماره برگ تشخیص", "type": "text", "required": true},
   {"key": "issue_date", "label": "تاریخ صدور", "type": "date", "required": true},
   {"key": "fiscal_year", "label": "سال عملکرد", "type": "text", "required": true},
   {"key": "taxable_income", "label": "مأخذ یا درآمد مشمول مالیات", "type": "number", "required": true},
   {"key": "assessed_tax", "label": "مالیات تشخیصی", "type": "number", "required": true},
   {"key": "declared_tax", "label": "مالیات ابرازی", "type": "number", "required": true},
   {"key": "previous_payments", "label": "پرداخت‌های قبلی", "type": "number", "required": false},
   {"key": "difference", "label": "مابه‌التفاوت", "type": "number", "required": true},
   {"key": "penalties", "label": "جرائم", "type": "number", "required": false},
   {"key": "assessment_reasons", "label": "دلایل تشخیص", "type": "text", "required": true},
   {"key": "signers", "label": "مشخصات امضاکنندگان", "type": "text", "required": true},
   {"key": "document_id", "label": "شناسه یکتای سند", "type": "text", "required": true},
   {"key": "barcode", "label": "بارکد یا شناسه سازمانی", "type": "text", "required": false}
 ]}',
 'PHASE_1', 'tax_assessment_issuer', 'سازمان امور مالیاتی', 'document_issuance', false, true,
 ARRAY['PIT-001'],
 ARRAY['tax_audit_report'],
 ARRAY['performance_tax_assessment_notice'],
 'برگ تشخیص پس از تأیید گزارش رسیدگی صادر می‌شود.',
 'برگ تشخیص باید شامل تمام اطلاعات مالی و دلایل تشخیص باشد.'),

-- PIT-003: ابلاغ برگ تشخیص
('e0000001-0000-0000-0000-000000000003', 'd0000001-0000-0000-0000-000000000001', 3, 'PIT-003', 'ابلاغ برگ تشخیص مالیات بر عملکرد', 'PLATFORM_ADMIN', false,
 '{"fields": [
   {"key": "upload_date", "label": "تاریخ بارگذاری", "type": "date", "required": true},
   {"key": "first_sms_date", "label": "تاریخ اولین پیامک", "type": "date", "required": false},
   {"key": "viewed_date", "label": "تاریخ مشاهده", "type": "date", "required": false},
   {"key": "effective_service_date", "label": "تاریخ ابلاغ مؤثر", "type": "date", "required": true},
   {"key": "service_method", "label": "روش ابلاغ", "type": "select", "options": ["الکترونیکی", "حضوری", "پستی"], "required": true},
   {"key": "service_type", "label": "نوع ابلاغ", "type": "select", "options": ["واقعی", "قانونی", "در انتظار اعتبارسنجی", "نامعتبر"], "required": true},
   {"key": "recipient_name", "label": "شخص دریافت‌کننده", "type": "text", "required": true},
   {"key": "recipient_role", "label": "سمت دریافت‌کننده", "type": "text", "required": false},
   {"key": "destination_address", "label": "نشانی یا حساب کاربری مقصد", "type": "text", "required": true},
   {"key": "service_document", "label": "مستند ابلاغ", "type": "text", "required": false},
   {"key": "is_valid", "label": "وضعیت صحت ابلاغ", "type": "checkbox", "required": true},
   {"key": "validity_reason", "label": "علت ابلاغ قانونی", "type": "text", "required": false}
 ]}',
 'PHASE_1', 'tax_notification_unit', 'سازمان امور مالیاتی', 'notification', false, true,
 ARRAY['PIT-002'],
 ARRAY['performance_tax_assessment_notice'],
 ARRAY['assessment_service_record'],
 'ابلاغ برگ تشخیص طبق دستورالعمل ابلاغ الکترونیکی انجام می‌شود.',
 'تاریخ ابلاغ واقعی و قانونی را با دقت ثبت کنید. مهلت اعتراض از تاریخ ابلاغ معتبر شروع می‌شود.'),

-- PIT-004: دریافت گزارش مبنای تشخیص
('e0000001-0000-0000-0000-000000000004', 'd0000001-0000-0000-0000-000000000001', 4, 'PIT-004', 'دریافت یا مشاهده گزارش مبنای تشخیص', 'USER', true,
 '{"fields": [
   {"key": "request_date", "label": "تاریخ درخواست", "type": "date", "required": true},
   {"key": "request_method", "label": "روش درخواست", "type": "select", "options": ["الکترونیکی", "حضوری", "پستی"], "required": true},
   {"key": "requested_items", "label": "اقلام درخواستی", "type": "text", "required": true},
   {"key": "taxpayer_notes", "label": "توضیحات مؤدی", "type": "text", "required": false},
   {"key": "response_date", "label": "تاریخ پاسخ", "type": "date", "required": false},
   {"key": "report_file", "label": "فایل گزارش", "type": "text", "required": false},
   {"key": "organization_notes", "label": "توضیحات سازمان", "type": "text", "required": false},
   {"key": "responder_name", "label": "نام پاسخ‌دهنده", "type": "text", "required": false},
   {"key": "not_provided_items", "label": "اقلام ارائه‌نشده", "type": "text", "required": false},
   {"key": "not_provided_reason", "label": "علت عدم ارائه", "type": "text", "required": false}
 ]}',
 'PHASE_1', 'taxpayer', NULL, 'optional_action', false, true,
 ARRAY['PIT-003'],
 ARRAY['audit_report_detail_request'],
 ARRAY['audit_report_detail_response'],
 'مؤدی می‌تواند درخواست دریافت جزئیات گزارش مبنای تشخیص را ثبت کند.',
 'این مرحله اختیاری است و مهلت اعتراض را متوقف یا تمدید نمی‌کند.'),

-- PIT-005: مهلت تصمیم مؤدی
('e0000001-0000-0000-0000-000000000005', 'd0000001-0000-0000-0000-000000000001', 5, 'PIT-005', 'مهلت تصمیم مؤدی (۳۰ روز)', 'USER', false,
 '{"fields": [
   {"key": "decision", "label": "تصمیم مؤدی", "type": "select", "options": ["قبول کتبی", "پرداخت مالیات", "ترتیب پرداخت", "ثبت اعتراض", "عدم اقدام"], "required": true},
   {"key": "decision_date", "label": "تاریخ تصمیم", "type": "date", "required": true},
   {"key": "written_acceptance", "label": "متن اعلام قبول", "type": "text", "required": false},
   {"key": "signed_document", "label": "سند امضاشده", "type": "text", "required": false}
 ]}',
 'PHASE_1', 'taxpayer', NULL, 'decision', false, true,
 ARRAY['PIT-003'],
 ARRAY['deadline_expiry_record'],
 ARRAY['taxpayer_acceptance', 'taxpayer_partial_acceptance', 'taxpayer_rejection_of_review_result', 'article_238_objection'],
 'مؤدی ظرف ۳۰ روز از تاریخ ابلاغ باید تصمیم خود را اعلام کند.',
 'مهلت ۳۰ روزه از تاریخ ابلاغ معتبر شروع می‌شود. روز ابلاغ در شمارش محاسبه نمی‌شود. اگر آخرین روز تعطیل رسمی باشد، اولین روز کاری بعد آخرین روز اقدام است.'),

-- PIT-010: اعلام قبول کتبی
('e0000001-0000-0000-0000-000000000010', 'd0000001-0000-0000-0000-000000000001', 10, 'PIT-010', 'اعلام قبول کتبی', 'USER', false,
 '{"fields": [
   {"key": "acceptance_date", "label": "تاریخ قبول", "type": "date", "required": true},
   {"key": "acceptance_method", "label": "روش قبول", "type": "select", "options": ["الکترونیکی", "حضوری", "پستی"], "required": true},
   {"key": "acceptance_scope", "label": "دامنه قبول", "type": "select", "options": ["کامل", "جزئی"], "required": true},
   {"key": "acceptance_text", "label": "متن اعلام قبول", "type": "text", "required": true},
   {"key": "signed_document", "label": "سند امضاشده", "type": "text", "required": false},
   {"key": "registrar", "label": "ثبت‌کننده", "type": "text", "required": true}
 ]}',
 'PHASE_2', 'taxpayer', NULL, 'acceptance', false, true,
 ARRAY['PIT-005'],
 ARRAY['taxpayer_acceptance'],
 ARRAY['performance_tax_final_notice'],
 'مؤدی می‌تواند برگ تشخیص را کتبی قبول کند. قبول به معنی قطعیت مأخذ و مالیات است.'),
 
-- PIT-011: پرداخت یا ترتیب پرداخت
('e0000001-0000-0000-0000-000000000011', 'd0000001-0000-0000-0000-000000000001', 11, 'PIT-011', 'پرداخت یا ترتیب پرداخت', 'USER', false,
 '{"fields": [
   {"key": "assessed_tax", "label": "مالیات تشخیصی", "type": "number", "required": true},
   {"key": "previous_payments", "label": "پرداخت‌های قبلی", "type": "number", "required": false},
   {"key": "payable_amount", "label": "مبلغ قابل پرداخت", "type": "number", "required": true},
   {"key": "paid_amount", "label": "مبلغ پرداخت‌شده", "type": "number", "required": false},
   {"key": "payment_date", "label": "تاریخ پرداخت", "type": "date", "required": false},
   {"key": "payment_id", "label": "شناسه پرداخت", "type": "text", "required": false},
   {"key": "payment_type", "label": "نوع پرداخت", "type": "select", "options": ["نقدی", "تقسیط", "انتقال از حساب"], "required": false},
   {"key": "installment_request", "label": "درخواست تقسیط", "type": "checkbox", "required": false},
   {"key": "installment_status", "label": "وضعیت تقسیط", "type": "select", "options": ["تأیید شده", "رد شده", "در انتظار"], "required": false},
   {"key": "installment_count", "label": "تعداد اقساط", "type": "number", "required": false},
   {"key": "first_installment_date", "label": "تاریخ اولین قسط", "type": "date", "required": false}
 ]}',
 'PHASE_2', 'taxpayer', NULL, 'payment', false, true,
 ARRAY['PIT-005'],
 ARRAY['tax_payment_receipt', 'payment_arrangement'],
 ARRAY['performance_tax_final_notice'],
 'مؤدی می‌تواند مالیات را پرداخت یا ترتیب پرداخت بگیرد.'),

-- PIT-012: قطعیت ناشی از قبول یا رفع اختلاف
('e0000001-0000-0000-0000-000000000012', 'd0000001-0000-0000-0000-000000000001', 12, 'PIT-012', 'قطععیت ناشی از قبول یا رفع اختلاف', 'PLATFORM_ADMIN', false,
 '{"fields": [
   {"key": "finalization_reason", "label": "علت قطعیت", "type": "select", "options": ["قبول کتبی", "پرداخت به مأخذ برگ", "ترتیب پرداخت", "رفع اختلاف کامل ماده ۲۳۸"], "required": true},
   {"key": "finalization_date", "label": "تاریخ قطعیت", "type": "date", "required": true},
   {"key": "final_tax_amount", "label": "مالیات نهایی", "type": "number", "required": true},
   {"key": "balance", "label": "مانده قابل پرداخت", "type": "number", "required": true}
 ]}',
 'PHASE_2', 'tax_finalization_collection_unit', 'سازمان امور مالیاتی', 'finalization', false, true,
 ARRAY['PIT-010', 'PIT-011'],
 ARRAY['performance_tax_final_notice'],
 ARRAY['performance_tax_final_notice'],
 'قطععیت پس از قبول یا رفع اختلاف کامل انجام می‌شود.'),

-- PIT-020: ثبت اعتراض
('e0000001-0000-0000-0000-000000000020', 'd0000001-0000-0000-0000-000000000001', 20, 'PIT-020', 'ثبت اعتراض به برگ تشخیص ماده ۲۳۸', 'USER', false,
 '{"fields": [
   {"key": "objection_number", "label": "شماره اعتراض", "type": "text", "required": true},
   {"key": "registration_date", "label": "تاریخ و ساعت ثبت", "type": "date", "required": true},
   {"key": "registration_method", "label": "روش ثبت", "type": "select", "options": ["الکترونیکی", "کتبی حضوری", "پستی"], "required": true},
   {"key": "is_within_deadline", "label": "ثبت داخل یا خارج از مهلت", "type": "checkbox", "required": true},
   {"key": "assessment_notice_id", "label": "شناسه برگ تشخیص", "type": "text", "required": true},
   {"key": "objector_name", "label": "مشخصات معترض", "type": "text", "required": true},
   {"key": "objector_role", "label": "سمت معترض", "type": "text", "required": false},
   {"key": "representation_info", "label": "اطلاعات نمایندگی یا وکالت", "type": "text", "required": false},
   {"key": "total_contested_amount", "label": "مبلغ کل مورد اعتراض", "type": "number", "required": true},
   {"key": "accepted_amount", "label": "مبلغ مورد قبول", "type": "number", "required": false},
   {"key": "disputed_amount", "label": "مبلغ مورد اختلاف", "type": "number", "required": true},
   {"key": "objection_items", "label": "اقلام مورد اعتراض", "type": "text", "required": true},
   {"key": "objection_details", "label": "شرح هر اعتراض", "type": "text", "required": true},
   {"key": "reasons", "label": "دلایل", "type": "text", "required": true},
   {"key": "legal_articles", "label": "مواد قانونی مورد استناد", "type": "text", "required": false},
   {"key": "demand", "label": "خواسته مؤدی", "type": "text", "required": true},
   {"key": "attachments", "label": "پیوست‌ها", "type": "text", "required": false},
   {"key": "tracking_number", "label": "شماره رهگیری", "type": "text", "required": true}
 ]}',
 'PHASE_3', 'taxpayer', NULL, 'objection', false, true,
 ARRAY['PIT-005'],
 ARRAY['article_238_objection', 'objection_evidence'],
 ARRAY['article_238_internal_referral'],
 'مؤدی ظرف ۳۰ روز از تاریخ ابلاغ می‌تواند اعتراض کند. ثبت اعتراض فقط به سامانه محدود نیست.'),

-- PIT-021: ارجاع داخلی اعتراض
('e0000001-0000-0000-0000-000000000021', 'd0000001-0000-0000-0000-000000000001', 21, 'PIT-021', 'ارجاع داخلی اعتراض', 'PLATFORM_ADMIN', false,
 '{"fields": [
   {"key": "referral_date", "label": "تاریخ ارجاع", "type": "date", "required": true},
   {"key": "receiving_date", "label": "تاریخ دریافت پرونده", "type": "date", "required": true},
   {"key": "responsible_officer", "label": "مسئول رسیدگی", "type": "text", "required": true}
 ]}',
 'PHASE_3', 'tax_objection_unit', 'سازمان امور مالیاتی', 'referral', false, true,
 ARRAY['PIT-020'],
 ARRAY['article_238_internal_referral'],
 ARRAY['article_238_internal_referral'],
 'اعتراض به مسئول یا مسئولان مربوط موضوع ماده ۲۳۸ ارجاع می‌شود.'),

-- PIT-022: رسیدگی مجدد ماده ۲۳۸
('e0000001-0000-0000-0000-000000000022', 'd0000001-0000-0000-0000-000000000001', 22, 'PIT-022', 'رسیدگی مجدد ماده ۲۳۸', 'PLATFORM_ADMIN', false,
 '{"fields": [
   {"key": "review_date", "label": "تاریخ رسیدگی", "type": "date", "required": true},
   {"key": "review_type", "label": "نوع رسیدگی", "type": "select", "options": ["حضوری", "غیرحضوری"], "required": true},
   {"key": "attendees", "label": "افراد حاضر", "type": "text", "required": false},
   {"key": "absence_reason", "label": "علت عدم حضور", "type": "text", "required": false},
   {"key": "reviewed_documents", "label": "مدارک بررسی‌شده", "type": "text", "required": true},
   {"key": "taxpayer_explanation", "label": "توضیحات مؤدی", "type": "text", "required": false},
   {"key": "organization_explanation", "label": "توضیحات سازمان", "type": "text", "required": false},
   {"key": "disputed_items", "label": "اقلام مورد اختلاف", "type": "text", "required": true},
   {"key": "preliminary_opinion", "label": "نظر اولیه", "type": "text", "required": false},
   {"key": "needs_expertise", "label": "نیاز به کارشناسی مجدد", "type": "checkbox", "required": true},
   {"key": "session_minutes", "label": "صورت‌جلسه", "type": "text", "required": true},
   {"key": "complementary_actions", "label": "اقدامات تکمیلی", "type": "text", "required": false},
   {"key": "next_action_date", "label": "تاریخ اقدام بعدی", "type": "date", "required": false}
 ]}',
 'PHASE_3', 'article_238_responsible_officer', 'سازمان امور مالیاتی', 'review', false, true,
 ARRAY['PIT-021'],
 ARRAY['article_238_review_result'],
 ARRAY['article_238_review_result', 'reexamination_order'],
 'رسیدگی مجدد حداکثر ۴۵ روز از تاریخ ثبت درخواست اعتراض. عدم حضور مؤدی مانع رسیدگی نیست.'),

-- PIT-023: صدور قرار بررسی مجدد
('e0000001-0000-0000-0000-000000000023', 'd0000001-0000-0000-0000-000000000001', 23, 'PIT-023', 'صدور قرار بررسی مجدد', 'PLATFORM_ADMIN', true,
 '{"fields": [
   {"key": "order_number", "label": "شماره قرار", "type": "text", "required": true},
   {"key": "issue_date", "label": "تاریخ صدور", "type": "date", "required": true},
   {"key": "order_type", "label": "نوع قرار", "type": "select", "options": ["کارشناسی", "تحقیق", "بررسی"], "required": true},
   {"key": "subject", "label": "موضوع قرار", "type": "text", "required": true},
   {"key": "expertise_questions", "label": "سؤالات کارشناسی", "type": "text", "required": false},
   {"key": "scope", "label": "دامنه بررسی", "type": "text", "required": false},
   {"key": "required_documents", "label": "اسناد لازم", "type": "text", "required": false},
   {"key": "executor", "label": "مجری قرار", "type": "text", "required": true},
   {"key": "delivery_date", "label": "تاریخ تحویل", "type": "date", "required": false},
   {"key": "internal_deadline", "label": "مهلت داخلی اجرا", "type": "number", "required": false},
   {"key": "execution_status", "label": "وضعیت اجرا", "type": "select", "options": ["در انتظار", "در حال اجرا", "انجام شده"], "required": false},
   {"key": "issuance_reason", "label": "دلیل صدور", "type": "text", "required": false}
 ]}',
 'PHASE_3', 'article_238_responsible_officer', 'سازمان امور مالیاتی', 'order', true, true,
 ARRAY['PIT-022'],
 ARRAY['reexamination_order'],
 ARRAY['reexamination_execution_report'],
 'صدور قرار نباید مهلت ۴۵روزه ماده ۲۳۸ را خودکار تمدید کند.'),

-- PIT-024: اجرای قرار
('e0000001-0000-0000-0000-000000000024', 'd0000001-0000-0000-0000-000000000001', 24, 'PIT-024', 'اجرای قرار', 'PLATFORM_ADMIN', true,
 '{"fields": [
   {"key": "report_number", "label": "شماره گزارش", "type": "text", "required": true},
   {"key": "report_date", "label": "تاریخ گزارش", "type": "date", "required": true},
   {"key": "actions_taken", "label": "اقدامات انجام‌شده", "type": "text", "required": true},
   {"key": "reviewed_documents", "label": "اسناد بررسی‌شده", "type": "text", "required": false},
   {"key": "findings", "label": "یافته‌ها", "type": "text", "required": true},
   {"key": "calculations", "label": "محاسبات", "type": "text", "required": false},
   {"key": "expertise_result", "label": "نتیجه کارشناسی", "type": "text", "required": true},
   {"key": "confirmed_items", "label": "موارد تأییدشده", "type": "text", "required": false},
   {"key": "rejected_items", "label": "موارد ردشده", "type": "text", "required": false},
   {"key": "document_deficiencies", "label": "نقص مدارک", "type": "text", "required": false},
   {"key": "attachments", "label": "پیوست‌ها", "type": "text", "required": false},
   {"key": "executor_name_title", "label": "نام و سمت مجری", "type": "text", "required": true}
 ]}',
 'PHASE_3', 'tax_reexamination_expert', 'سازمان امور مالیاتی', 'execution', true, true,
 ARRAY['PIT-023'],
 ARRAY['reexamination_execution_report'],
 ARRAY['article_238_review_result'],
 'گزارش اجرای قرار باید به پرونده اصلی متصل شود. مؤدی باید بتواند درخواست مشاهده گزارش کند.'),

-- PIT-025: رسیدگی نهایی ماده ۲۳۸
('e0000001-0000-0000-0000-000000000025', 'd0000001-0000-0000-0000-000000000001', 25, 'PIT-025', 'رسیدگی نهایی ماده ۲۳۸', 'PLATFORM_ADMIN', false,
 '{"fields": [
   {"key": "final_review_date", "label": "تاریخ رسیدگی نهایی", "type": "date", "required": true},
   {"key": "objection_items", "label": "اقلام اعتراض", "type": "text", "required": true},
   {"key": "item_results", "label": "نتیجه هر قلم", "type": "text", "required": true},
   {"key": "acceptance_reasons", "label": "دلایل پذیرش", "type": "text", "required": false},
   {"key": "rejection_reasons", "label": "دلایل رد", "type": "text", "required": false},
   {"key": "adjustment_calculations", "label": "محاسبات تعدیل", "type": "text", "required": false},
   {"key": "adjusted_income", "label": "مأخذ تعدیل‌شده", "type": "number", "required": false},
   {"key": "adjusted_tax", "label": "مالیات تعدیل‌شده", "type": "number", "required": false},
   {"key": "resolved_amount", "label": "مبلغ رفع اختلاف‌شده", "type": "number", "required": false},
   {"key": "remaining_disputed", "label": "مبلغ باقی‌مانده مورد اختلاف", "type": "number", "required": false},
   {"key": "overall_result", "label": "نتیجه کلی", "type": "select", "options": ["رد کامل تشخیص", "پذیرش کامل اعتراض", "تعدیل تشخیص", "تأیید تشخیص", "نتیجه ترکیبی", "نقص روند"], "required": true},
   {"key": "result_document", "label": "سند نتیجه رسیدگی", "type": "text", "required": false},
   {"key": "result_notification_date", "label": "تاریخ اعلام نتیجه به مؤدی", "type": "date", "required": false}
 ]}',
 'PHASE_3', 'article_238_responsible_officer', 'سازمان امور مالیاتی', 'final_review', false, true,
 ARRAY['PIT-022', 'PIT-024'],
 ARRAY['article_238_review_result'],
 ARRAY['article_238_review_result'],
 'رسیدگی نهایی می‌تواند پس از اجرای قرار یا بدون صدور قرار انجام شود. جلسه نهایی حضوری الزامی نیست.'),

-- PIT-026: اعلام نتیجه رسیدگی مجدد
('e0000001-0000-0000-0000-000000000026', 'd0000001-0000-0000-0000-000000000001', 26, 'PIT-026', 'اعلام نتیجه رسیدگی مجدد', 'PLATFORM_ADMIN', false,
 '{"fields": [
   {"key": "result_registration_date", "label": "تاریخ ثبت نتیجه", "type": "date", "required": true},
   {"key": "notification_date", "label": "تاریخ اعلام", "type": "date", "required": true},
   {"key": "notification_method", "label": "روش اعلام", "type": "select", "options": ["سامانه", "ابلاغ", "ارائه حضوری"], "required": true},
   {"key": "viewed_status", "label": "وضعیت مشاهده", "type": "checkbox", "required": false},
   {"key": "sms_notification", "label": "پیامک اطلاع‌رسانی", "type": "text", "required": false},
   {"key": "last_opinion_date", "label": "آخرین زمان اعلام نظر مؤدی", "type": "date", "required": false},
   {"key": "result_file", "label": "فایل نتیجه", "type": "text", "required": false}
 ]}',
 'PHASE_3', 'tax_notification_unit', 'سازمان امور مالیاتی', 'notification', false, true,
 ARRAY['PIT-025'],
 ARRAY['article_238_review_result'],
 ARRAY['article_238_review_result'],
 'نتیجه رسیدگی مجدد باید به مؤدی اعلام شود. عدم اظهارنظر مؤدی به معنی قبول نیست.'),

-- PIT-027: تصمیم مؤدی درباره نتیجه
('e0000001-0000-0000-0000-000000000027', 'd0000001-0000-0000-0000-000000000001', 27, 'PIT-027', 'تصمیم مؤدی درباره نتیجه', 'USER', false,
 '{"fields": [
   {"key": "decision", "label": "تصمیم مؤدی", "type": "select", "options": ["پذیرش کامل", "پذیرش جزئی", "رد کامل", "عدم پاسخ", "لازم نیست - اختلاف باقی‌مانده"], "required": true},
   {"key": "decision_date", "label": "تاریخ تصمیم", "type": "date", "required": true},
   {"key": "decision_method", "label": "روش اعلام", "type": "select", "options": ["الکترونیکی", "حضوری", "پستی"], "required": true},
   {"key": "accepted_items", "label": "اقلام پذیرفته‌شده", "type": "text", "required": false},
   {"key": "accepted_amount", "label": "مبلغ پذیرفته‌شده", "type": "number", "required": false},
   {"key": "rejected_items", "label": "اقلام ردشده", "type": "text", "required": false},
   {"key": "remaining_disputed", "label": "مبلغ باقی‌مانده مورد اختلاف", "type": "number", "required": false},
   {"key": "notes", "label": "توضیحات", "type": "text", "required": false},
   {"key": "acceptance_document", "label": "سند قبول یا رد", "type": "text", "required": false},
   {"key": "is_within_deadline", "label": "داخل یا خارج از مهلت", "type": "checkbox", "required": true}
 ]}',
 'PHASE_3', 'taxpayer', NULL, 'decision', false, true,
 ARRAY['PIT-026'],
 ARRAY['taxpayer_acceptance', 'taxpayer_partial_acceptance', 'taxpayer_rejection_of_review_result'],
 ARRAY['performance_tax_final_notice', 'first_instance_board_referral'],
 'مؤدی باید نتیجه رسیدگی مجدد را تأیید یا رد کند. عدم پاسخ به معنی قبول نیست.'),

-- PIT-030: پایان مهلت اعتراض
('e0000001-0000-0000-0000-000000000030', 'd0000001-0000-0000-0000-000000000001', 30, 'PIT-030', 'پایان مهلت اعتراض (خودکار)', 'PLATFORM_ADMIN', false,
 '{"fields": [
   {"key": "deadline_expired_date", "label": "تاریخ پایان مهلت", "type": "date", "required": true},
   {"key": "service_type", "label": "نوع ابلاغ", "type": "select", "options": ["واقعی", "قانونی"], "required": true},
   {"key": "action_taken", "label": "اقدام انجام‌شده", "type": "select", "options": ["اعتراض ثبت شده", "پرداخت انجام شده", "قبول ثبت شده", "عدم اقدام"], "required": true},
   {"key": "is_valid_objection", "label": "اعتراض معتبر", "type": "checkbox", "required": false}
 ]}',
 'PHASE_4', 'system_automation', 'پلتفرم', 'system', true, false,
 ARRAY['PIT-005'],
 ARRAY['deadline_expiry_record'],
 ARRAY['performance_tax_final_notice', 'first_instance_board_referral'],
 'موتور خودکار پایان مهلت را کنترل می‌کند. اگر ابلاغ واقعی و عدم اعتراض باشد، قطعیت ایجاد می‌شود.'),

-- PIT-031: عدم اعتراض پس از ابلاغ واقعی
('e0000001-0000-0000-0000-000000000031', 'd0000001-0000-0000-0000-000000000001', 31, 'PIT-031', 'عدم اعتراض پس از ابلاغ واقعی', 'PLATFORM_ADMIN', false,
 '{"fields":[
   {"key":"effective_service_date","label":"تاریخ ابلاغ واقعی","type":"date","required":true},
   {"key":"deadline_end","label":"پایان مهلت اعتراض","type":"date","required":true},
   {"key":"finalization_reason","label":"علت قطعیت","type":"select","options":["no_timely_objection_after_actual_service"],"required":true}
 ]}',
 'PHASE_4','system_automation','پلتفرم','system',true,false,
 ARRAY['PIT-030'],ARRAY['deadline_expiry_record'],ARRAY['performance_tax_final_notice'],
 'عدم اقدام پس از ابلاغ واقعی می‌تواند مأخذ را قطعی کند؛ پرداخت مرحله‌ای مستقل است.'),

-- PIT-032: در حکم معترض پس از ابلاغ قانونی
('e0000001-0000-0000-0000-000000000032', 'd0000001-0000-0000-0000-000000000001', 32, 'PIT-032', 'در حکم معترض پس از ابلاغ قانونی', 'PLATFORM_ADMIN', false,
 '{"fields":[
   {"key":"effective_service_date","label":"تاریخ ابلاغ قانونی","type":"date","required":true},
   {"key":"article_239_note_applies","label":"شمول تبصره ماده ۲۳۹","type":"checkbox","required":true},
   {"key":"referral_reason","label":"علت ارجاع","type":"select","options":["article_239_deemed_objection_after_legal_service"],"required":true}
 ]}',
 'PHASE_4','system_automation','پلتفرم','system',true,false,
 ARRAY['PIT-030'],ARRAY['deadline_expiry_record'],ARRAY['first_instance_board_referral'],
 'سکوت پس از ابلاغ قانونی موجب قطعیت خودکار نیست و پرونده در حکم اعتراض به هیأت بدوی ارجاع می‌شود.'),

-- PIT-040: تهیه ارجاع به هیأت بدوی
('e0000001-0000-0000-0000-000000000040', 'd0000001-0000-0000-0000-000000000001', 40, 'PIT-040', 'تهیه ارجاع به هیأت حل اختلاف بدوی', 'PLATFORM_ADMIN', false,
 '{"fields": [
   {"key": "referral_number", "label": "شماره ارجاع", "type": "text", "required": true},
   {"key": "referral_date", "label": "تاریخ ارجاع", "type": "date", "required": true},
   {"key": "referral_reason", "label": "علت ارجاع", "type": "select", "options": ["عدم تعدیل و عدم توافق ماده ۲۳۸", "عدم پذیرش تعدیل ماده ۲۳۸", "tos Partial settlement ماده ۲۳۸", "عدم پاسخ مؤدی", "در حکم معترض پس از ابلاغ قانونی"], "required": true},
   {"key": "legal_basis", "label": "مبنای قانونی", "type": "text", "required": true},
   {"key": "referral_type", "label": "نوع ارجاع", "type": "select", "options": ["کامل", "جزئی"], "required": true},
   {"key": "contested_amount", "label": "مبلغ مورد اختلاف", "type": "number", "required": true},
   {"key": "contested_items", "label": "اقلام مورد اختلاف", "type": "text", "required": true},
   {"key": "resolved_items", "label": "اقلام رفع اختلاف‌شده", "type": "text", "required": false},
   {"key": "finalized_items", "label": "اقلام قطعی‌شده", "type": "text", "required": false},
   {"key": "article_238_result", "label": "نتیجه رسیدگی ماده ۲۳۸", "type": "text", "required": true},
   {"key": "expertise_report", "label": "گزارش اجرای قرار", "type": "text", "required": false},
   {"key": "objection_document", "label": "اعتراض مؤدی", "type": "text", "required": false},
   {"key": "documents", "label": "اسناد و مدارک", "type": "text", "required": false},
   {"key": "service_type", "label": "نوع ابلاغ برگ تشخیص", "type": "select", "options": ["واقعی", "قانونی"], "required": true},
   {"key": "representative_choice", "label": "انتخاب نماینده بند ۳ ماده ۲۴۴", "type": "text", "required": false},
   {"key": "is_complete", "label": "وضعیت کامل بودن پرونده", "type": "checkbox", "required": true},
   {"key": "deficiencies", "label": "خطاها یا نواقص", "type": "text", "required": false},
   {"key": "board_case_id", "label": "شناسه پرونده هیأت", "type": "text", "required": false}
 ]}',
 'PHASE_4', 'tax_objection_unit', 'سازمان امور مالیاتی', 'referral', false, true,
 ARRAY['PIT-027', 'PIT-030'],
 ARRAY['first_instance_board_referral'],
 ARRAY['first_instance_board_referral'],
 'ارجاع به هیأت بدوی نقطه پایان محدوده فعلی فرایند است. فقط مبلغ و اقلام حل‌نشده ارجاع شود.'),

-- PIT-050: صدور برگ قطعی
('e0000001-0000-0000-0000-000000000050', 'd0000001-0000-0000-0000-000000000001', 50, 'PIT-050', 'صدور برگ قطعی مالیات بر عملکرد', 'PLATFORM_ADMIN', false,
 '{"fields": [
   {"key": "final_notice_number", "label": "شماره برگ قطعی", "type": "text", "required": true},
   {"key": "issue_date", "label": "تاریخ صدور", "type": "date", "required": true},
   {"key": "service_date", "label": "تاریخ ابلاغ", "type": "date", "required": true},
   {"key": "finalization_reason", "label": "علت قطعیت", "type": "select", "options": ["قبول کتبی", "پرداخت به مأخذ برگ", "ترتیب پرداخت تأیید شده", "رفع اختلاف کامل ماده ۲۳۸", "رفع اختلاف جزئی ماده ۲۳۸", "عدم اعتراض پس از ابلاغ واقعی", "پذیرش کامل اعتراض مؤدی", "تأیید و پذیرش مؤدی"], "required": true},
   {"key": "final_income", "label": "مأخذ قطعی", "type": "number", "required": true},
   {"key": "final_tax", "label": "مالیات قطعی", "type": "number", "required": true},
   {"key": "penalties", "label": "جرائم", "type": "number", "required": false},
   {"key": "previous_payments", "label": "پرداخت‌های قبلی", "type": "number", "required": false},
   {"key": "credits", "label": "اعتبارها", "type": "number", "required": false},
   {"key": "balance_due", "label": "مانده بدهی", "type": "number", "required": true},
   {"key": "overpayment", "label": "اضافه‌پرداخت", "type": "number", "required": false},
   {"key": "payment_status", "label": "وضعیت پرداخت", "type": "select", "options": ["پرداخت نشده", "پرداخت شده", "ترتیب پرداخت", "بدون مانده"], "required": true},
   {"key": "document_id", "label": "شناسه سند", "type": "text", "required": true},
   {"key": "final_notice_file", "label": "فایل برگ قطعی", "type": "text", "required": false}
 ]}',
 'PHASE_5', 'tax_finalization_collection_unit', 'سازمان امور مالیاتی', 'document_issuance', false, true,
 ARRAY['PIT-012', 'PIT-040'],
 ARRAY['performance_tax_final_notice'],
 ARRAY['performance_tax_final_notice'],
 'صدور برگ قطعی و پرداخت مانده دو مرحله جدا هستند.'),

-- PIT-051: پرداخت مالیات قطعی
('e0000001-0000-0000-0000-000000000051', 'd0000001-0000-0000-0000-000000000001', 51, 'PIT-051', 'پرداخت مالیات قطعی', 'USER', false,
 '{"fields": [
   {"key": "payment_deadline", "label": "مهلت پرداخت (۱۰ روز)", "type": "date", "required": true},
   {"key": "payment_type", "label": "نوع پرداخت", "type": "select", "options": ["پرداخت کامل", "ترتیب پرداخت", "تقسیط"], "required": true},
   {"key": "paid_amount", "label": "مبلغ پرداخت‌شده", "type": "number", "required": false},
   {"key": "payment_date", "label": "تاریخ پرداخت", "type": "date", "required": false},
   {"key": "payment_receipt", "label": "رسید پرداخت", "type": "text", "required": false},
   {"key": "overpayment_detected", "label": "اضافه‌پرداخت تشخیص داده شد", "type": "checkbox", "required": false},
   {"key": "overpayment_amount", "label": "مبلغ اضافه‌پرداخت", "type": "number", "required": false}
 ]}',
 'PHASE_5', 'taxpayer', NULL, 'payment', false, true,
 ARRAY['PIT-050'],
 ARRAY['tax_payment_receipt'],
 ARRAY['performance_tax_final_notice'],
 'مهلت پرداخت ۱۰ روز از تاریخ ابلاغ برگ قطعی طبق ماده ۲۱۰. اگر مانده صفر باشد، وضعیت بدون پرداخت ثبت شود.')

ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  actor = EXCLUDED.actor,
  form_schema = EXCLUDED.form_schema;

-- -----------------------------------------------------------------------------
-- 10. SEED DATA: WORKFLOW TRANSITIONS
-- -----------------------------------------------------------------------------

INSERT INTO workflow_transitions (id, workflow_template_id, from_step_id, to_step_id, code, title, trigger_type, outcome_code, terminal_status, priority, description, legal_reference, condition_expression) VALUES

-- PIT-001 → PIT-002: گزارش نهایی شد → صدور برگ تشخیص
('f0000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000001', 
 'e0000001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000002',
 'T001', 'گزارش نهایی شد → صدور برگ تشخیص', 'USER_ACTION', 'REPORT_COMPLETED', NULL, 1,
 'پس از تکمیل گزارش رسیدگی، برگ تشخیص صادر می‌شود.', 'ماده ۲۳۷', 'report_completed'),

-- PIT-002 → PIT-003: برگ تشخیص صادر شد → ابلاغ
('f0000001-0000-0000-0000-000000000002', 'd0000001-0000-0000-0000-000000000001',
 'e0000001-0000-0000-0000-000000000002', 'e0000001-0000-0000-0000-000000000003',
 'T002', 'صدور برگ تشخیص → ابلاغ', 'USER_ACTION', 'NOTICE_ISSUED', NULL, 1,
 'برگ تشخیص صادر و قابل ابلاغ است.', NULL, 'notice_issued'),

-- PIT-003 → PIT-005: ابلاغ معتبر ثبت شد → شروع مهلت ۳۰روزه
('f0000001-0000-0000-0000-000000000003', 'd0000001-0000-0000-0000-000000000001',
 'e0000001-0000-0000-0000-000000000003', 'e0000001-0000-0000-0000-000000000005',
 'T003', 'ابلاغ معتبر → شروع مهلت ۳۰روزه', 'USER_ACTION', 'SERVICE_VALID', NULL, 1,
 'ابلاغ معتبر ثبت شد و مهلت ۳۰ روزه شروع می‌شود.', 'ماده ۲۳۸', 'service_valid'),

-- PIT-004 → PIT-005: دریافت گزارش → ادامه مهلت
('f0000001-0000-0000-0000-000000000004', 'd0000001-0000-0000-0000-000000000001',
 'e0000001-0000-0000-0000-000000000004', 'e0000001-0000-0000-0000-000000000005',
 'T004', 'دریافت گزارش → ادامه مهلت', 'USER_ACTION', 'DETAILS_RECEIVED', NULL, 2,
 'دریافت جزئیات گزارش. این مرحله مهلت را متوقف نمی‌کند.', NULL, 'true'),

-- PIT-005 → PIT-010: قبول کتبی
('f0000001-0000-0000-0000-000000000005', 'd0000001-0000-0000-0000-000000000001',
 'e0000001-0000-0000-0000-000000000005', 'e0000001-0000-0000-0000-000000000010',
 'T005', 'تصمیم → قبول کتبی', 'USER_ACTION', 'WRITTEN_ACCEPTANCE', NULL, 1,
 'مؤدی برگ تشخیص را کتبی قبول می‌کند.', 'ماده ۲۳۹', 'decision == WRITTEN_ACCEPTANCE'),

-- PIT-005 → PIT-011: پرداخت به مأخذ برگ
('f0000001-0000-0000-0000-000000000006', 'd0000001-0000-0000-0000-000000000001',
 'e0000001-0000-0000-0000-000000000005', 'e0000001-0000-0000-0000-000000000011',
 'T006', 'تصمیم → پرداخت', 'USER_ACTION', 'PAYMENT_AT_ASSESSMENT', NULL, 1,
 'مؤدی مالیات را براساس برگ تشخیص پرداخت می‌کند.', 'ماده ۲۳۹', 'decision == PAYMENT'),

-- PIT-005 → PIT-020: ثبت اعتراض
('f0000001-0000-0000-0000-000000000007', 'd0000001-0000-0000-0000-000000000001',
 'e0000001-0000-0000-0000-000000000005', 'e0000001-0000-0000-0000-000000000020',
 'T007', 'تصمیم → ثبت اعتراض', 'USER_ACTION', 'OBJECTION_REGISTERED', NULL, 1,
 'مؤدی ظرف ۳۰ روز اعتراض ثبت می‌کند.', 'ماده ۲۳۸', 'decision == OBJECTION'),

-- PIT-005 → PIT-030: پایان مهلت (خودکار)
('f0000001-0000-0000-0000-000000000008', 'd0000001-0000-0000-0000-000000000001',
 'e0000001-0000-0000-0000-000000000005', 'e0000001-0000-0000-0000-000000000030',
 'T008', 'مهلت تمام شد → کنترل خودکار', 'USER_ACTION', 'DEADLINE_EXPIRED', NULL, 1,
 'مهلت ۳۰ روزه تمام شده و مؤدی اقدامی نکرده است.', 'ماده ۲۳۸ و ۲۳۹', 'timeout_30_days'),

-- PIT-010 → PIT-012: قبول کتبی → قطعیت
('f0000001-0000-0000-0000-000000000009', 'd0000001-0000-0000-0000-000000000001',
 'e0000001-0000-0000-0000-000000000010', 'e0000001-0000-0000-0000-000000000012',
 'T009', 'قبول کتبی → قطعیت', 'USER_ACTION', 'ACCEPTANCE_FINALIZED', NULL, 1,
 'پس از قبول کتبی، پرونده قطعی می‌شود.', 'ماده ۲۳۹', 'acceptance_registered'),

-- PIT-011 → PIT-012: پرداخت → قطعیت
('f0000001-0000-0000-0000-000000000010', 'd0000001-0000-0000-0000-000000000001',
 'e0000001-0000-0000-0000-000000000011', 'e0000001-0000-0000-0000-000000000012',
 'T010', 'پرداخت → قطعیت', 'USER_ACTION', 'PAYMENT_FINALIZED', NULL, 1,
 'پس از پرداخت، پرونده قطعی می‌شود.', 'ماده ۲۳۹', 'payment_completed'),

-- PIT-012 → PIT-050: قطعیت → صدور برگ قطعی
('f0000001-0000-0000-0000-000000000011', 'd0000001-0000-0000-0000-000000000001',
 'e0000001-0000-0000-0000-000000000012', 'e0000001-0000-0000-0000-000000000050',
 'T011', 'قطععیت → صدور برگ قطعی', 'USER_ACTION', 'FINALIZATION_DONE', NULL, 1,
 'پرونده قطعی و برگ قطعی صادر می‌شود.', NULL, 'finalization_completed'),

-- PIT-020 → PIT-021: ثبت اعتراض → ارجاع داخلی
('f0000001-0000-0000-0000-000000000012', 'd0000001-0000-0000-0000-000000000001',
 'e0000001-0000-0000-0000-000000000020', 'e0000001-0000-0000-0000-000000000021',
 'T012', 'ثبت اعتراض → ارجاع داخلی', 'USER_ACTION', 'OBJECTION_REGISTERED', NULL, 1,
 'اعتراض ثبت و برای رسیدگی مجدد ارجاع می‌شود.', 'ماده ۲۳۸', 'objection_valid'),

-- PIT-021 → PIT-022: ارجاع داخلی → رسیدگی مجدد
('f0000001-0000-0000-0000-000000000013', 'd0000001-0000-0000-0000-000000000001',
 'e0000001-0000-0000-0000-000000000021', 'e0000001-0000-0000-0000-000000000022',
 'T013', 'ارجاع داخلی → رسیدگی مجدد', 'USER_ACTION', 'REFERRAL_ACCEPTED', NULL, 1,
 'ارجاع داخلی انجام و رسیدگی مجدد شروع می‌شود.', NULL, 'referral_completed'),

-- PIT-022 → PIT-023: نیاز به کارشناسی → صدور قرار
('f0000001-0000-0000-0000-000000000014', 'd0000001-0000-0000-0000-000000000001',
 'e0000001-0000-0000-0000-000000000022', 'e0000001-0000-0000-0000-000000000023',
 'T014', 'رسیدگی → نیاز به کارشناسی', 'USER_ACTION', 'EXPERTISE_NEEDED', NULL, 2,
 'نیاز به کارشناسی مجدد تشخیص داده شده است.', NULL, 'needs_expertise == true'),

-- PIT-022 → PIT-025: بدون کارشناسی → رسیدگی نهایی
('f0000001-0000-0000-0000-000000000015', 'd0000001-0000-0000-0000-000000000001',
 'e0000001-0000-0000-0000-000000000022', 'e0000001-0000-0000-0000-000000000025',
 'T015', 'رسیدگی → بدون کارشناسی', 'USER_ACTION', 'NO_EXPERTISE_NEEDED', NULL, 1,
 'نیازی به کارشناسی نیست و رسیدگی نهایی انجام می‌شود.', NULL, 'needs_expertise == false'),

-- PIT-023 → PIT-024: قرار صادر شد → اجرای قرار
('f0000001-0000-0000-0000-000000000016', 'd0000001-0000-0000-0000-000000000001',
 'e0000001-0000-0000-0000-000000000023', 'e0000001-0000-0000-0000-000000000024',
 'T016', 'صدور قرار → اجرای قرار', 'USER_ACTION', 'ORDER_ISSUED', NULL, 1,
 'قرار کارشناسی صادر و برای اجرا ارسال شد.', NULL, 'order_issued'),

-- PIT-024 → PIT-025: اجرای قرار → رسیدگی نهایی
('f0000001-0000-0000-0000-000000000017', 'd0000001-0000-0000-0000-000000000001',
 'e0000001-0000-0000-0000-000000000024', 'e0000001-0000-0000-0000-000000000025',
 'T017', 'اجرای قرار → رسیدگی نهایی', 'USER_ACTION', 'EXPERTISE_COMPLETED', NULL, 1,
 'گزارش اجرای قرار ثبت و رسیدگی نهایی شروع می‌شود.', NULL, 'expertise_report_registered'),

-- PIT-025 → PIT-026: رسیدگی نهایی → اعلام نتیجه
('f0000001-0000-0000-0000-000000000018', 'd0000001-0000-0000-0000-000000000001',
 'e0000001-0000-0000-0000-000000000025', 'e0000001-0000-0000-0000-000000000026',
 'T018', 'رسیدگی نهایی → اعلام نتیجه', 'USER_ACTION', 'FINAL_REVIEW_DONE', NULL, 1,
 'رسیدگی نهایی انجام و نتیجه آماده اعلام است.', NULL, 'final_review_completed'),

-- PIT-026 → PIT-027: اعلام نتیجه → تصمیم مؤدی
('f0000001-0000-0000-0000-000000000019', 'd0000001-0000-0000-0000-000000000001',
 'e0000001-0000-0000-0000-000000000026', 'e0000001-0000-0000-0000-000000000027',
 'T019', 'اعلام نتیجه → تصمیم مؤدی', 'USER_ACTION', 'RESULT_ANNOUNCED', NULL, 1,
 'نتیجه رسیدگی به مؤدی اعلام شد.', NULL, 'result_announced'),

-- PIT-027 → PIT-012: پذیرش کامل → قطعیت
('f0000001-0000-0000-0000-000000000020', 'd0000001-0000-0000-0000-000000000001',
 'e0000001-0000-0000-0000-000000000027', 'e0000001-0000-0000-0000-000000000012',
 'T020', 'پذیرش کامل نتیجه → قطعیت', 'USER_ACTION', 'FULL_ACCEPTANCE', NULL, 1,
 'مؤدی نتیجه تعدیل را کامل قبول کرده است.', NULL, 'taxpayer_decision == ACCEPTED_IN_FULL'),

-- PIT-027 → PIT-050: پذیرش جزئی + بدون اختلاف باقیمانده → قطعیت
('f0000001-0000-0000-0000-000000000021', 'd0000001-0000-0000-0000-000000000001',
 'e0000001-0000-0000-0000-000000000027', 'e0000001-0000-0000-0000-000000000050',
 'T021', 'پذیرش جزئی بدون اختلاف → صدور برگ قطعی', 'USER_ACTION', 'PARTIAL_NO_REMAINING', NULL, 2,
 'بخش پذیرفته‌شده قطعی و اختلاف باقیمانده وجود ندارد.', NULL, 'taxpayer_decision == ACCEPTED_IN_PART AND remaining_disputed == 0'),

-- PIT-027 → PIT-040: پذیرش جزئی + اختلاف باقیمانده → ارجاع به هیأت
('f0000001-0000-0000-0000-000000000022', 'd0000001-0000-0000-0000-000000000001',
 'e0000001-0000-0000-0000-000000000027', 'e0000001-0000-0000-0000-000000000040',
 'T022', 'پذیرش جزئی با اختلاف → ارجاع به هیأت', 'USER_ACTION', 'PARTIAL_WITH_REMAINING', NULL, 1,
 'بخش پذیرفته‌شده قطعی و باقی‌مانده به هیأت ارجاع می‌شود.', NULL, 'taxpayer_decision == ACCEPTED_IN_PART AND remaining_disputed > 0'),

-- PIT-027 → PIT-040: رد کامل → ارجاع به هیأت
('f0000001-0000-0000-0000-000000000023', 'd0000001-0000-0000-0000-000000000001',
 'e0000001-0000-0000-0000-000000000027', 'e0000001-0000-0000-0000-000000000040',
 'T023', 'رد کامل نتیجه → ارجاع به هیأت', 'USER_ACTION', 'FULL_REJECTION', NULL, 1,
 'مؤدی نتیجه رسیدگی را رد کرده و اختلاف به هیأت ارجاع می‌شود.', NULL, 'taxpayer_decision == REJECTED_IN_FULL'),

-- PIT-027 → PIT-040: عدم پاسخ → ارجاع به هیأت
('f0000001-0000-0000-0000-000000000024', 'd0000001-0000-0000-0000-000000000001',
 'e0000001-0000-0000-0000-000000000027', 'e0000001-0000-0000-0000-000000000040',
 'T024', 'عدم پاسخ مؤدی → ارجاع به هیأت', 'USER_ACTION', 'NO_RESPONSE', NULL, 1,
 'مؤدی پاسخ نداده و اختلاف به هیأت ارجاع می‌شود. سکوت به معنی قبول نیست.', NULL, 'taxpayer_decision == NO_RESPONSE'),

-- PIT-030 → PIT-051: ابلاغ واقعی + عدم اعتراض → قطعیت
('f0000001-0000-0000-0000-000000000025', 'd0000001-0000-0000-0000-000000000001',
 'e0000001-0000-0000-0000-000000000030', 'e0000001-0000-0000-0000-000000000031',
 'T025', 'مهلت تمام + ابلاغ واقعی → قطعیت', 'USER_ACTION', 'ACTUAL_SERVICE_NO_OBJECTION', NULL, 1,
 'ابلاغ واقعی بوده و مؤدی اعتراض نکرده. برگ تشخیص قطعی می‌شود.', 'ماده ۲۳۹', 'service_type == ACTUAL AND no_valid_objection'),

-- PIT-030 → PIT-040: ابلاغ قانونی مشمول تبصره ۲۳۹ → در حکم معترض
('f0000001-0000-0000-0000-000000000026', 'd0000001-0000-0000-0000-000000000001',
 'e0000001-0000-0000-0000-000000000030', 'e0000001-0000-0000-0000-000000000032',
 'T026', 'ابلاغ قانونی + عدم اقدام → در حکم معترض', 'USER_ACTION', 'LEGAL_SERVICE_DEEMED_OBJECTION', NULL, 1,
 'ابلاغ قانونی مشمول تبصره ماده ۲۳۹ و مؤدی اقدامی نکرده. در حکم معترض است.', 'تبصره ماده ۲۳۹', 'service_type == LEGAL AND article_239_note_applies'),

-- PIT-031 → PIT-050: قطعیت پس از ابلاغ واقعی
('f0000001-0000-0000-0000-000000000032', 'd0000001-0000-0000-0000-000000000001',
 'e0000001-0000-0000-0000-000000000031', 'e0000001-0000-0000-0000-000000000050',
 'T032', 'ثبت علت قطعیت → صدور برگ قطعی', 'SYSTEM_EVENT', 'ACTUAL_SERVICE_FINALIZED', NULL, 1,
 'علت قطعیت ثبت شده و پرداخت مستقل از صدور برگ قطعی باقی می‌ماند.', 'ماده ۲۳۹', 'finalization_reason == NO_TIMELY_OBJECTION_AFTER_ACTUAL_SERVICE'),

-- PIT-032 → PIT-040: در حکم معترض به هیأت بدوی
('f0000001-0000-0000-0000-000000000033', 'd0000001-0000-0000-0000-000000000001',
 'e0000001-0000-0000-0000-000000000032', 'e0000001-0000-0000-0000-000000000040',
 'T033', 'در حکم معترض → تهیه ارجاع هیأت بدوی', 'SYSTEM_EVENT', 'DEEMED_OBJECTION_REFERRAL', NULL, 1,
 'فقط مسیر ارجاع فعال است و قطعیت ناشی از سکوت ممنوع است.', 'تبصره ماده ۲۳۹', 'deemed_objector_due_to_legal_service'),

-- PIT-040 → Terminal: ارجاع به هیأت بدوی (نقطه خروج)
('f0000001-0000-0000-0000-000000000027', 'd0000001-0000-0000-0000-000000000001',
 'e0000001-0000-0000-0000-000000000040', NULL,
 'T027', 'ارجاع به هیأت بدوی (نقطه خروج)', 'USER_ACTION', 'REFERRED_TO_BOARD', 'COMPLETED', 1,
 'پرونده به هیأت حل اختلاف مالیاتی بدوی ارجاع شد.', 'ماده ۲۴۴', 'referral_completed'),

-- PIT-050 → PIT-051: برگ قطعی صادر شد → مهلت پرداخت
('f0000001-0000-0000-0000-000000000028', 'd0000001-0000-0000-0000-000000000001',
 'e0000001-0000-0000-0000-000000000050', 'e0000001-0000-0000-0000-000000000051',
 'T028', 'صدور برگ قطعی → شروع مهلت پرداخت', 'USER_ACTION', 'FINAL_NOTICE_ISSUED', NULL, 1,
 'برگ قطعی صادر و مهلت ۱۰ روزه پرداخت شروع شد.', 'ماده ۲۱۰', 'final_notice_issued'),

-- PIT-051 → Terminal: پرداخت کامل
('f0000001-0000-0000-0000-000000000029', 'd0000001-0000-0000-0000-000000000001',
 'e0000001-0000-0000-0000-000000000051', NULL,
 'T029', 'پرداخت کامل → پایان', 'USER_ACTION', 'FULL_PAYMENT', 'COMPLETED', 1,
 'مالیات قطعی کامل پرداخت شد.', NULL, 'payment_type == FULL AND balance_due == 0'),

-- PIT-051 → Terminal: بدون مانده
('f0000001-0000-0000-0000-000000000030', 'd0000001-0000-0000-0000-000000000001',
 'e0000001-0000-0000-0000-000000000051', NULL,
 'T030', 'بدون مانده → پایان', 'SYSTEM_EVENT', 'NO_BALANCE', 'COMPLETED', 1,
 'مانده قابل پرداخت صفر است.', NULL, 'balance_due == 0'),

-- PIT-051 → Terminal: اضافه‌پرداخت
('f0000001-0000-0000-0000-000000000031', 'd0000001-0000-0000-0000-000000000001',
 'e0000001-0000-0000-0000-000000000051', NULL,
 'T031', 'اضافه‌پرداخت → پایان', 'SYSTEM_EVENT', 'OVERPAYMENT', 'COMPLETED', 1,
 'پرداخت‌های قبلی بیشتر از مالیات قطعی است.', NULL, 'paid_amount > final_tax')

ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  trigger_type = EXCLUDED.trigger_type,
  outcome_code = EXCLUDED.outcome_code;

UPDATE obligation_versions
SET status = 'PUBLISHED', published_at = COALESCE(published_at, now()), updated_at = now()
WHERE id = 'c0000001-0000-0000-0000-000000000001'
  AND status <> 'PUBLISHED';

COMMIT;
