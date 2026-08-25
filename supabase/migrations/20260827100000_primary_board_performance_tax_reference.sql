BEGIN;

-- Production reference data only. No taxpayer, case, amount, payment, or fictitious event is created.
-- The catalog is intentionally independent from operational case records.

CREATE TABLE IF NOT EXISTS public.tax_objection_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_code text NOT NULL DEFAULT 'PIT',
  code text NOT NULL,
  title_fa text NOT NULL,
  description_fa text,
  phase_code text NOT NULL DEFAULT 'PHASE_1',
  step_type text NOT NULL DEFAULT 'MANDATORY',
  display_order integer NOT NULL DEFAULT 0,
  actor_role_code text NOT NULL DEFAULT 'TAX_AUTHORITY',
  responsible_organization text,
  is_required boolean DEFAULT true,
  base_event text,
  gap_value integer DEFAULT 0,
  gap_unit text DEFAULT 'روز',
  user_guidance_fa text,
  admin_guidance_fa text,
  form_schema jsonb DEFAULT '{}'::jsonb,
  legal_basis text,
  preconditions text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workflow_code, code)
);

CREATE TABLE IF NOT EXISTS public.tax_stage_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_stage_code text NOT NULL,
  to_stage_code text NOT NULL,
  trigger_type text NOT NULL DEFAULT 'MANUAL',
  condition_description text,
  legal_basis text,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(from_stage_code, to_stage_code, trigger_type)
);

ALTER TABLE public.tax_objection_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_stage_transitions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can read tax objection stages"
    ON public.tax_objection_stages FOR SELECT
    USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can read tax stage transitions"
    ON public.tax_stage_transitions FOR SELECT
    USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO public.tax_actors (code, title_fa, actor_type, organization, description_fa, is_active)
VALUES
  ('tax_litigation_management', 'مدیریت دادرسی مالیاتی', 'tax_objection_unit', 'سازمان امور مالیاتی', 'مدیریت و هماهنگی ارجاع پرونده‌ها', true),
  ('primary_board_secretariat', 'دبیرخانه هیأت حل اختلاف مالیاتی بدوی', 'tax_objection_unit', 'سازمان امور مالیاتی', 'ثبت و ابلاغ دعوت‌نامه و سوابق دبیرخانه', true)
ON CONFLICT (code) DO UPDATE SET
  title_fa = EXCLUDED.title_fa,
  organization = EXCLUDED.organization,
  description_fa = EXCLUDED.description_fa,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO public.tax_legal_references
  (code, title_fa, source_type, source_number, article_or_section, relevant_text_fa, source_url, is_active, last_verified_date)
VALUES
  ('LDT_ART_237', 'ماده ۲۳۷ قانون مالیات‌های مستقیم', 'law', 'قانون مالیات‌های مستقیم', 'ماده ۲۳۷', 'لزوم اتکای برگ تشخیص به مأخذ صحیح و دسترسی مؤدی به جزئیات گزارش.', 'https://qavanin.ir/Law/TreeText?ApproveStateNo=&IDS=892583840653829785', true, CURRENT_DATE),
  ('LDT_ART_238', 'ماده ۲۳۸ قانون مالیات‌های مستقیم', 'law', 'قانون مالیات‌های مستقیم', 'ماده ۲۳۸', 'اعتراض و رسیدگی مجدد موضوع ماده ۲۳۸.', 'https://qavanin.ir/Law/TreeText?ApproveStateNo=&IDS=892583840653829785', true, CURRENT_DATE),
  ('LDT_ART_239', 'ماده ۲۳۹ و تبصره آن', 'law', 'قانون مالیات‌های مستقیم', 'ماده ۲۳۹', 'قواعد قبول، پرداخت، ترتیب پرداخت، رفع اختلاف و آثار ابلاغ قانونی.', 'https://qavanin.ir/Law/TreeText?ApproveStateNo=&IDS=892583840653829785', true, CURRENT_DATE),
  ('LDT_ART_203_208', 'مواد ۲۰۳ و ۲۰۸ قانون مالیات‌های مستقیم', 'law', 'قانون مالیات‌های مستقیم', 'مواد ۲۰۳ و ۲۰۸', 'قواعد ابلاغ اوراق مالیاتی.', 'https://qavanin.ir/Law/TreeText?ApproveStateNo=&IDS=892583840653829785', true, CURRENT_DATE),
  ('LDT_ART_210', 'ماده ۲۱۰ قانون مالیات‌های مستقیم', 'law', 'قانون مالیات‌های مستقیم', 'ماده ۲۱۰', 'قواعد مطالبه و پرداخت مالیات قطعی.', 'https://qavanin.ir/Law/TreeText?ApproveStateNo=&IDS=892583840653829785', true, CURRENT_DATE),
  ('LDT_ART_244', 'ماده ۲۴۴ قانون مالیات‌های مستقیم', 'law', 'قانون مالیات‌های مستقیم', 'ماده ۲۴۴', 'مرجع حل اختلاف مالیاتی و ارجاع پرونده به هیأت.', 'https://qavanin.ir/Law/TreeText?ApproveStateNo=&IDS=892583840653829785', true, CURRENT_DATE),
  ('LDT_ART_246_249', 'مواد ۲۴۶ تا ۲۴۹ قانون مالیات‌های مستقیم', 'law', 'قانون مالیات‌های مستقیم', 'مواد ۲۴۶ تا ۲۴۹', 'وقت جلسه، موجه و مدلل بودن رأی و درج مأخذ در رأی.', 'https://qavanin.ir/Law/TreeText?ApproveStateNo=&IDS=892583840653829785', true, CURRENT_DATE),
  ('TAX_PROCEDURE_53380', 'دستورالعمل دادرسی مالیاتی شماره ۵۳۳۸۰', 'directive', '۵۳۳۸۰', 'مواد ۱۸، ۲۰، ۲۳ و ۳۱ تا ۳۷', 'منبع رویه‌ای فرایند دادرسی؛ متن رسمی باید مبنای کنترل حقوقی نهایی باشد.', 'https://tax.gov.ir', true, CURRENT_DATE),
  ('CPC_ART_444_445', 'مواد ۴۴۴ و ۴۴۵ قانون آیین دادرسی مدنی', 'law', 'قانون آیین دادرسی مدنی', 'مواد ۴۴۴ و ۴۴۵', 'قواعد محاسبه مهلت و تعطیلی روز پایانی.', 'https://qavanin.ir', true, CURRENT_DATE)
ON CONFLICT (code) DO UPDATE SET
  title_fa = EXCLUDED.title_fa,
  source_number = EXCLUDED.source_number,
  article_or_section = EXCLUDED.article_or_section,
  relevant_text_fa = EXCLUDED.relevant_text_fa,
  source_url = EXCLUDED.source_url,
  is_active = EXCLUDED.is_active,
  last_verified_date = EXCLUDED.last_verified_date,
  updated_at = now();

INSERT INTO public.tax_objection_stages
  (workflow_code, code, title_fa, description_fa, phase_code, step_type, display_order, actor_role_code, responsible_organization, is_required, base_event, gap_value, gap_unit, user_guidance_fa, form_schema, legal_basis, is_active)
VALUES
  ('PIT', 'PIT-001', 'تهیه گزارش رسیدگی مالیات بر عملکرد', 'انجام رسیدگی و تهیه گزارش نهایی.', 'PHASE_1', 'MANDATORY', 1, 'tax_audit_unit', 'سازمان امور مالیاتی', true, 'شروع رسیدگی', 0, 'روز', 'گزارش نهایی و تأییدشده ثبت شود.', '{"inputs":["tax_declaration","books_and_records","third_party_information"],"outputs":["tax_audit_report"],"validation":{"requires_final_approval":true}}', 'ماده ۲۱۹ و ۲۳۷', true),
  ('PIT', 'PIT-002', 'صدور برگ تشخیص مالیات بر عملکرد', 'صدور برگ تشخیص بر مبنای گزارش نهایی.', 'PHASE_1', 'MANDATORY', 2, 'tax_assessment_issuer', 'سازمان امور مالیاتی', true, 'تکمیل گزارش رسیدگی', 0, 'روز', 'برگ تشخیص بدون گزارش مبنا صادر نشود.', '{"inputs":["tax_audit_report"],"outputs":["performance_tax_assessment_notice"],"validation":{"requires_audit_report":true}}', 'ماده ۲۳۷', true),
  ('PIT', 'PIT-003', 'ابلاغ برگ تشخیص مالیات بر عملکرد', 'ابلاغ معتبر برگ تشخیص و ثبت سابقه ابلاغ.', 'PHASE_1', 'MANDATORY', 3, 'tax_notification_unit', 'سازمان امور مالیاتی یا سامانه ابلاغ', true, 'صدور برگ تشخیص', 0, 'روز', 'مهلت فقط از ابلاغ معتبر آغاز شود.', '{"inputs":["performance_tax_assessment_notice"],"outputs":["assessment_service_record"],"validation":{"service_types":["actual","legal","pending_validation","invalid"],"electronic_observation_days":10,"legal_service_day":11}}', 'مواد ۲۰۳ و ۲۰۸', true),
  ('PIT', 'PIT-004', 'دریافت جزئیات گزارش مبنای تشخیص', 'اقدام اختیاری موازی برای درخواست جزئیات گزارش.', 'PHASE_1', 'OPTIONAL', 4, 'taxpayer', 'سازمان امور مالیاتی', false, 'ابلاغ برگ تشخیص', 0, 'روز', 'این اقدام مهلت اعتراض را متوقف نمی‌کند.', '{"inputs":["audit_report_detail_request"],"outputs":["audit_report_detail_response"],"timeline_visible":false}', 'ماده ۲۳۷', true),
  ('PIT', 'PIT-005', 'مهلت اعتراض یا قبول برگ تشخیص', 'مهلت ۳۰ روزه اقدام مؤدی پس از ابلاغ معتبر.', 'PHASE_1', 'DEADLINE', 5, 'system_automation', 'موتور خودکار پلتفرم', true, 'ابلاغ معتبر برگ تشخیص', 30, 'روز تقویمی با انتقال تعطیلی', 'روز ابلاغ محاسبه نشود و تعطیلات رسمی لحاظ شود.', '{"outputs":["deadline_expiry_record","notification_record"],"legal_days":30,"reminders":[0,15,7,3,1],"calendar":"Asia/Tehran"}', 'ماده ۲۳۸', true),
  ('PIT', 'PIT-010', 'اعلام قبول کتبی', 'اعلام قبول کامل مؤدی؛ پرداخت از آن مستقل است.', 'PHASE_2', 'OPTIONAL', 10, 'taxpayer', 'مؤدی یا نماینده مجاز', false, 'مهلت تصمیم مؤدی', 0, 'روز', 'قبول کتبی به‌تنهایی به معنی ثبت پرداخت نیست.', '{"inputs":["taxpayer_acceptance"],"outputs":["performance_tax_final_notice"],"validation":{"requires_authorized_actor":true}}', 'ماده ۲۳۹', true),
  ('PIT', 'PIT-011', 'پرداخت یا ترتیب پرداخت براساس برگ تشخیص', 'پرداخت یا ترتیب پرداخت بدون تبدیل آن به مرحله اجباری همه پرونده‌ها.', 'PHASE_2', 'OPTIONAL', 11, 'taxpayer', 'واحد قطعیت و وصول', false, 'قبول یا اقدام قانونی مؤدی', 0, 'روز', 'پرداخت و قطعیت دو مفهوم مستقل هستند.', '{"inputs":["tax_payment_receipt","payment_arrangement"],"validation":{"zero_balance_status":"not_required_zero_balance","currency":"IRR"}}', 'مواد ۲۳۹ و ۲۱۰', true),
  ('PIT', 'PIT-012', 'قطعیت ناشی از قبول یا رفع اختلاف', 'ثبت نتیجه حقوقی قطعیت و صدور برگ قطعی.', 'PHASE_2', 'TERMINAL', 12, 'tax_finalization_collection_unit', 'واحد قطعیت و وصول', true, 'قبول، پرداخت، ترتیب پرداخت یا رفع اختلاف', 0, 'روز', 'قطعیت بدون اتکا به صرف پرداخت ایجاد نشود.', '{"outputs":["performance_tax_final_notice"],"allowed_reasons":["written_acceptance","payment_at_assessment_basis","approved_payment_arrangement","full_article_238_settlement"]}', 'ماده ۲۳۹', true),
  ('PIT', 'PIT-020', 'ثبت اعتراض و درخواست رسیدگی مجدد ماده ۲۳۸', 'ثبت اعتراض با هر روش قانونی معتبر و تفکیک اقلام مالی.', 'PHASE_3', 'MANDATORY', 20, 'taxpayer', 'حوزه کاری اعتراضات و شکایات', true, 'ابلاغ برگ تشخیص', 30, 'روز', 'اعتراض فاقد برگ تشخیص مرتبط نهایی نشود.', '{"inputs":["article_238_objection","objection_evidence"],"outputs":["article_238_objection"],"validation":{"accepted_methods":["electronic","in_person","postal","other_legal"],"requires_assessment_reference":true}}', 'ماده ۲۳۸', true),
  ('PIT', 'PIT-021', 'ارجاع داخلی اعتراض', 'ارجاع ثبت‌شده به مسئول یا مسئولان مربوط موضوع ماده ۲۳۸.', 'PHASE_3', 'MANDATORY', 21, 'tax_objection_unit', 'حوزه کاری اعتراضات و شکایات', true, 'ثبت اعتراض معتبر', 0, 'روز', 'تاریخ ارجاع و دریافت ثبت شود.', '{"inputs":["article_238_objection"],"outputs":["article_238_internal_referral"]}', 'ماده ۲۳۸', true),
  ('PIT', 'PIT-022', 'رسیدگی مجدد ماده ۲۳۸', 'رسیدگی مجدد حداکثر ظرف ۴۵ روز از ثبت اعتراض.', 'PHASE_3', 'MANDATORY', 22, 'article_238_responsible_officer', 'سازمان امور مالیاتی', true, 'تاریخ ثبت اعتراض معتبر', 45, 'روز قانونی', 'صدور قرار به‌تنهایی مهلت را تمدید نکند.', '{"inputs":["article_238_internal_referral","article_238_objection"],"outputs":["article_238_review_result"],"validation":{"deadline_starts_from":"objection_registered","overdue_status":"article_238_review_overdue"}}', 'ماده ۲۳۸', true),
  ('PIT', 'PIT-023', 'صدور قرار بررسی یا کارشناسی مجدد', 'قرار اختیاری و مشروط، نه مرحله دائمی برای همه پرونده‌ها.', 'PHASE_3', 'CONDITIONAL', 23, 'article_238_responsible_officer', 'سازمان امور مالیاتی', false, 'نیاز واقعی به بررسی تکمیلی', 0, 'روز', 'موضوع و دامنه قرار الزامی است.', '{"inputs":["reexamination_order"],"outputs":["reexamination_order"],"validation":{"requires_subject_and_scope":true,"does_not_extend_article_238_deadline":true}}', 'ماده ۲۳۸', true),
  ('PIT', 'PIT-024', 'اجرای قرار و ثبت گزارش اجرای قرار', 'اجرای قرار توسط مجری تعیین‌شده و ثبت گزارش.', 'PHASE_3', 'CONDITIONAL', 24, 'tax_reexamination_expert', 'سازمان امور مالیاتی یا کارشناس تعیین‌شده', false, 'صدور قرار معتبر', 0, 'روز', 'این مورد فقط پس از صدور واقعی قرار نمایش داده شود.', '{"inputs":["reexamination_order"],"outputs":["reexamination_execution_report"],"timeline_visible_if":"order_issued"}', 'ماده ۲۳۸', true),
  ('PIT', 'PIT-025', 'رسیدگی نهایی ماده ۲۳۸', 'تعیین نتیجه پس از گزارش قرار یا به‌صورت مستقیم.', 'PHASE_3', 'MANDATORY', 25, 'article_238_responsible_officer', 'سازمان امور مالیاتی', true, 'گزارش اجرای قرار یا رسیدگی مستقیم', 0, 'روز', 'نتیجه هر قلم و مبلغ واقعی ثبت شود.', '{"outputs":["article_238_review_result"],"allowed_results":["assessment_fully_rejected","objection_fully_accepted","assessment_adjusted","assessment_upheld","mixed_result","procedural_incomplete"]}', 'ماده ۲۳۸', true),
  ('PIT', 'PIT-026', 'اعلام نتیجه رسیدگی مجدد ماده ۲۳۸', 'اعلام نتیجه بدون تلقی سکوت مؤدی به‌عنوان قبول.', 'PHASE_3', 'MANDATORY', 26, 'tax_notification_unit', 'سازمان امور مالیاتی', true, 'رسیدگی نهایی ماده ۲۳۸', 0, 'روز', 'روش اعلام و تاریخ مشاهده ثبت شود.', '{"inputs":["article_238_review_result"],"outputs":["notification_record"],"validation":{"no_response_is_not_acceptance":true}}', 'ماده ۲۳۸', true),
  ('PIT', 'PIT-027', 'تصمیم مؤدی درباره نتیجه رسیدگی', 'ثبت قبول کامل، قبول بخشی، رد یا عدم پاسخ.', 'PHASE_3', 'MANDATORY', 27, 'taxpayer', 'مؤدی یا نماینده مجاز', true, 'اعلام نتیجه رسیدگی مجدد', 0, 'روز', 'مبلغ مورد قبول و مورد اختلاف جدا ثبت شوند.', '{"inputs":["taxpayer_acceptance","taxpayer_partial_acceptance","taxpayer_rejection_of_review_result"],"allowed_decisions":["accepted_in_full","accepted_in_part","rejected_in_full","no_response","not_required_no_remaining_dispute"]}', 'ماده ۲۳۸ و ۲۳۹', true),
  ('PIT', 'PIT-030', 'پایان مهلت اعتراض پس از ابلاغ واقعی', 'قطعیت فقط با شرایط قانونی و پس از کنترل نبود اقدام معتبر.', 'PHASE_4', 'TERMINAL', 30, 'system_automation', 'موتور خودکار پلتفرم', true, 'انقضای مهلت ۳۰ روزه', 0, 'روز', 'فقط برای ابلاغ واقعی و نبود اقدام مؤثر.', '{"validation":{"requires_service_type":"actual","requires_no_valid_action":true},"outputs":["deadline_expiry_record","performance_tax_final_notice"]}', 'مواد ۲۳۸ و ۲۳۹', true),
  ('PIT', 'PIT-031', 'در حکم معترض پس از ابلاغ قانونی', 'ابلاغ قانونی مشمول تبصره ماده ۲۳۹ موجب قطعیت خودکار نشود.', 'PHASE_4', 'TRANSITION', 31, 'system_automation', 'موتور خودکار پلتفرم', true, 'انقضای مهلت ۳۰ روزه', 0, 'روز', 'پرونده برای ارجاع قانونی نگهداری شود.', '{"validation":{"requires_service_type":"legal","outcome":"deemed_objector_due_to_legal_service"}}', 'تبصره ماده ۲۳۹', true),
  ('PIT', 'PIT-032', 'ارجاع به هیأت حل اختلاف مالیاتی بدوی', 'نقطه خروج این نسخه؛ مراحل داخلی هیأت بدوی در نسخه بعدی تعریف می‌شود.', 'PHASE_4', 'TRANSITION', 32, 'first_instance_tax_dispute_board', 'هیأت حل اختلاف مالیاتی بدوی', true, 'عدم توافق، عدم پاسخ یا در حکم معترض بودن', 0, 'روز', 'فقط اختلاف حل‌نشده ارجاع شود.', '{"outputs":["first_instance_board_referral"],"allowed_reasons":["article_238_no_adjustment_no_settlement","article_238_adjustment_not_accepted","article_238_partial_settlement","article_238_no_taxpayer_response","article_239_deemed_objection_after_legal_service"]}', 'ماده ۲۴۴', true),
  ('PIT', 'PIT-050', 'صدور برگ قطعی مالیات بر عملکرد', 'صدور برگ قطعی بر مبنای نتیجه واقعی و علت قطعیت مشخص.', 'PHASE_5', 'TERMINAL', 50, 'tax_finalization_collection_unit', 'واحد قطعیت و وصول', true, 'قطعیت معتبر', 0, 'روز', 'پرداخت مرحله‌ای جدا از قطعیت نگهداری شود.', '{"outputs":["performance_tax_final_notice"],"validation":{"requires_real_case_financial_values":true,"currency":"IRR"}}', 'مواد ۲۱۰ و ۲۳۹', true),
  ('PIT', 'PIT-051', 'پرداخت مالیات قطعی', 'پرداخت فقط پس از ابلاغ برگ قطعی و در صورت مانده مثبت.', 'PHASE_5', 'OPTIONAL', 51, 'taxpayer', 'مؤدی', false, 'ابلاغ برگ قطعی', 10, 'روز', 'در این نسخه عملیات اجرایی خارج از محدوده است.', '{"inputs":["tax_payment_receipt","payment_arrangement"],"statuses":["no_payment_required","overpayment_detected","payment_overdue_requires_collection_process"],"validation":{"requires_final_notice_service":true}}', 'ماده ۲۱۰', true)
ON CONFLICT (workflow_code, code) DO UPDATE SET
  title_fa = EXCLUDED.title_fa,
  description_fa = EXCLUDED.description_fa,
  phase_code = EXCLUDED.phase_code,
  step_type = EXCLUDED.step_type,
  display_order = EXCLUDED.display_order,
  actor_role_code = EXCLUDED.actor_role_code,
  responsible_organization = EXCLUDED.responsible_organization,
  is_required = EXCLUDED.is_required,
  base_event = EXCLUDED.base_event,
  gap_value = EXCLUDED.gap_value,
  gap_unit = EXCLUDED.gap_unit,
  user_guidance_fa = EXCLUDED.user_guidance_fa,
  form_schema = EXCLUDED.form_schema,
  legal_basis = EXCLUDED.legal_basis,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO public.tax_stage_transitions
  (from_stage_code, to_stage_code, trigger_type, condition_description, legal_basis, display_order, is_active)
VALUES
  ('PIT-001','PIT-002','MANUAL','گزارش نهایی و تأیید شد','ماده ۲۱۹ و ۲۳۷',1,true),
  ('PIT-002','PIT-003','MANUAL','برگ تشخیص صادر و قابل ابلاغ شد','ماده ۲۳۷',2,true),
  ('PIT-003','PIT-005','AUTOMATIC','ابلاغ معتبر ثبت شد','ماده ۲۳۸',3,true),
  ('PIT-005','PIT-010','MANUAL','قبول کتبی ثبت شد','ماده ۲۳۹',4,true),
  ('PIT-005','PIT-011','MANUAL','پرداخت یا ترتیب پرداخت معتبر ثبت شد','ماده ۲۳۹',5,true),
  ('PIT-005','PIT-020','MANUAL','اعتراض معتبر داخل مهلت ثبت شد','ماده ۲۳۸',6,true),
  ('PIT-005','PIT-030','AUTOMATIC','مهلت تمام شد و ابلاغ واقعی بود','مواد ۲۳۸ و ۲۳۹',7,true),
  ('PIT-005','PIT-031','AUTOMATIC','مهلت تمام شد و ابلاغ قانونی مشمول تبصره است','تبصره ماده ۲۳۹',8,true),
  ('PIT-010','PIT-012','MANUAL','قبول کتبی معتبر ثبت شد','ماده ۲۳۹',9,true),
  ('PIT-011','PIT-012','MANUAL','پرداخت یا ترتیب پرداخت معتبر ثبت شد','ماده ۲۳۹',10,true),
  ('PIT-020','PIT-021','MANUAL','اعتراض به مسئول مربوط ارجاع شد','ماده ۲۳۸',11,true),
  ('PIT-021','PIT-022','MANUAL','رسیدگی مجدد آغاز شد','ماده ۲۳۸',12,true),
  ('PIT-022','PIT-023','MANUAL','نیاز واقعی به قرار وجود دارد','ماده ۲۳۸',13,true),
  ('PIT-022','PIT-025','MANUAL','کارشناسی لازم نیست','ماده ۲۳۸',14,true),
  ('PIT-023','PIT-024','MANUAL','قرار معتبر صادر شد','ماده ۲۳۸',15,true),
  ('PIT-024','PIT-025','MANUAL','گزارش اجرای قرار دریافت شد','ماده ۲۳۸',16,true),
  ('PIT-025','PIT-026','MANUAL','نتیجه رسیدگی ثبت شد','ماده ۲۳۸',17,true),
  ('PIT-026','PIT-027','MANUAL','نتیجه به مؤدی اعلام شد','ماده ۲۳۸',18,true),
  ('PIT-027','PIT-050','MANUAL','اختلاف رفع شد یا مؤدی نتیجه را پذیرفت','ماده ۲۳۹',19,true),
  ('PIT-027','PIT-032','MANUAL','اختلاف باقی ماند یا مؤدی پاسخ نداد','ماده ۲۳۸ و ۲۴۴',20,true),
  ('PIT-030','PIT-050','AUTOMATIC','قطعیت ناشی از عدم اعتراض پس از ابلاغ واقعی','ماده ۲۳۹',21,true),
  ('PIT-031','PIT-032','AUTOMATIC','در حکم معترض و ارجاع به هیأت بدوی','تبصره ماده ۲۳۹',22,true),
  ('PIT-012','PIT-050','MANUAL','صدور برگ قطعی پس از قطعیت','ماده ۲۳۹',23,true),
  ('PIT-050','PIT-051','MANUAL','برگ قطعی ابلاغ و مانده مثبت است','ماده ۲۱۰',24,true)
ON CONFLICT (from_stage_code, to_stage_code, trigger_type) DO UPDATE SET
  condition_description = EXCLUDED.condition_description,
  legal_basis = EXCLUDED.legal_basis,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

COMMIT;
