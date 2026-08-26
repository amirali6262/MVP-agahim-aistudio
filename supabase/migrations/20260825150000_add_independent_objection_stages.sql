-- Migration: Create independent objection stages tables
-- These are separate from the studio's workflow_steps
-- and are used by the ObjectionTemplatesPage independently.

BEGIN;

-- 1. Independent workflow steps for tax objection stages
CREATE TABLE IF NOT EXISTS tax_objection_stages (
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
  base_event text DEFAULT 'تاریخ ابلاغ برگ/اختیاریه',
  gap_value integer DEFAULT 30,
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

-- 2. Independent transitions between stages
CREATE TABLE IF NOT EXISTS tax_stage_transitions (
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

-- 3. RLS policies
ALTER TABLE tax_objection_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_stage_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read tax_objection_stages"
  ON tax_objection_stages FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated read tax_stage_transitions"
  ON tax_stage_transitions FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow platform admin write tax_objection_stages"
  ON tax_objection_stages FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'PLATFORM_ADMIN')
  );

CREATE POLICY "Allow platform admin write tax_stage_transitions"
  ON tax_stage_transitions FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'PLATFORM_ADMIN')
  );

-- 4. Insert stages for Performance Income Tax (مالیات بر عملکرد)

-- فاز ۱: تهیه گزارش و صدور برگ تشخیص
INSERT INTO tax_objection_stages (code, title_fa, description_fa, phase_code, step_type, display_order, actor_role_code, responsible_organization, base_event, gap_value, gap_unit, user_guidance_fa, legal_basis) VALUES
('PIT-001', 'تهیه گزارش رسیدگی مالیات بر عملکرد', 'انجام رسیدگی و تهیه گزارش تفصیلی توسط واحد حسابرسی', 'PHASE_1', 'MANDATORY', 1, 'TAX_AUTHORITY', 'واحد حسابرسی / رسیدگی مالیاتی', 'شروع فرایند رسیدگی', 0, 'روز', 'گزارش رسیدگی مالیاتی را با دقت تهیه و تکمیل کنید.', 'ماده ۲۱۹ قانون مالیات‌های مستقیم'),
('PIT-002', 'صدور برگ تشخیص مالیات بر عملکرد', 'صدور رسمی برگ تشخیص پس از تأیید گزارش رسیدگی', 'PHASE_1', 'MANDATORY', 2, 'TAX_AUTHORITY', 'مقام صادرکننده برگ تشخیص', 'تکمیل گزارش رسیدگی', 10, 'روز', 'برگ تشخیص پس از تأیید گزارش رسیدگی صادر می‌شود.', 'ماده ۲۳۷ قانون مالیات‌های مستقیم'),
('PIT-003', 'ابلاغ برگ تشخیص مالیات بر عملکرد', 'ابلاغ رسمی برگ تشخیص به مودی و شروع مهلت اعتراض', 'PHASE_1', 'MANDATORY', 3, 'TAX_AUTHORITY', 'واحد ابلاغ', 'صدور برگ تشخیص', 5, 'روز', 'ابلاغ باید طبق مقررات قانونی انجام شود.', 'ماده ۲۰۳ و ۲۰۸ قانون مالیات‌های مستقیم'),
('PIT-004', 'دریافت جزئیات گزارش مبنای تشخیص', 'درخواست مؤدی برای دریافت جزئیات گزارش (اختیاری)', 'PHASE_1', 'OPTIONAL', 4, 'TAXPAYER', 'سازمان امور مالیاتی', 'ابلاغ برگ تشخیص', 0, 'روز', 'این اقدام مهلت اعتراض را متوقف نمی‌کند.', 'ماده ۲۳۷ قانون مالیات‌های مستقیم'),
('PIT-005', 'مهلت تصمیم مؤدی (۳۰ روز)', 'مهلت قانونی ۳۰ روزه مؤدی برای اعتراض یا قبول برگ تشخیص', 'PHASE_1', 'DEADLINE', 5, 'TAXPAYER', 'موتور خودکار', 'ابلاغ معتبر برگ تشخیص', 30, 'روز', 'مؤدی باید ظرف ۳۰ روز تصمیم خود را اعلام کند.', 'ماده ۲۳۸ قانون مالیات‌های مستقیم'),
-- فاز ۲: قبول و پرداخت
('PIT-010', 'اعلام قبول کتبی', 'اعلام قبول کامل مؤدی نسبت به برگ تشخیص', 'PHASE_2', 'MANDATORY', 10, 'TAXPAYER', 'واحد قطعیت و وصول', 'ابلاغ برگ تشخیص', 30, 'روز', 'قبول کتبی موجب قطعیت مالیات می‌شود.', 'ماده ۲۳۹ قانون مالیات‌های مستقیم'),
('PIT-011', 'پرداخت یا ترتیب پرداخت', 'پرداخت مالیات به مأخذ برگ تشخیص یا درخواست تقسیط', 'PHASE_2', 'MANDATORY', 11, 'TAXPAYER', 'واحد قطعیت و وصول', 'قبول یا ابلاغ برگ تشخیص', 10, 'روز', 'پرداخت ظرف ۱۰ روز پس از ابلاغ برگ قطعی.', 'ماده ۲۱۰ قانون مالیات‌های مستقیم'),
('PIT-012', 'قطعیت ناشی از قبول یا رفع اختلاف', 'صدور دستور قطعیت پرونده', 'PHASE_2', 'MANDATORY', 12, 'TAX_AUTHORITY', 'واحد قطعیت و وصول', 'تکمیل پرداخت یا قبول', 5, 'روز', 'قطعیت پس از قبول یا پرداخت کامل اعمال می‌شود.', 'ماده ۲۳۹ قانون مالیات‌های مستقیم'),
-- فاز ۳: اعتراض ماده ۲۳۸
('PIT-020', 'ثبت اعتراض ماده ۲۳۸', 'ثبت رسمی اعتراض مؤدی به برگ تشخیص', 'PHASE_3', 'MANDATORY', 20, 'TAXPAYER', 'حوزه کاری اعتراضات و شکایات', 'ابلاغ برگ تشخیص', 30, 'روز', 'اعتراض باید ظرف ۳۰ روز از تاریخ ابلاغ ثبت شود.', 'ماده ۲۳۸ قانون مالیات‌های مستقیم'),
('PIT-021', 'ارجاع داخلی اعتراض', 'ارجاع پرونده به مسئول یا مسئولان مربوط ماده ۲۳۸', 'PHASE_3', 'MANDATORY', 21, 'TAX_AUTHORITY', 'حوزه کاری اعتراضات و شکایات', 'ثبت اعتراض', 5, 'روز', 'پرونده باید به مسئول رسیدگی مجدد ارجاع شود.', 'ماده ۲۳۸ قانون مالیات‌های مستقیم'),
('PIT-022', 'رسیدگی مجدد ماده ۲۳۸', 'جلسه رسیدگی توسط مسئول یا مسئولان مربوط', 'PHASE_3', 'MANDATORY', 22, 'TAX_AUTHORITY', 'مسئول یا مسئولان مربوط موضوع ماده ۲۳۸', 'ارجاع داخلی', 45, 'روز', 'حداکثر ۴۵ روز فرصت رسیدگی وجود دارد.', 'ماده ۲۳۸ قانون مالیات‌های مستقیم'),
('PIT-023', 'صدور قرار بررسی مجدد', 'صدور قرار کارشناسی در صورت نیاز (اختیاری)', 'PHASE_3', 'CONDITIONAL_EXPERT', 23, 'TAX_AUTHORITY', 'مسئول یا مسئولان مربوط موضوع ماده ۲۳۸', 'شروع رسیدگی', 0, 'روز', 'صدور قرار نباید مهلت ۴۵ روزه را خودکار تمدید کند.', 'ماده ۲۳۸ قانون مالیات‌های مستقیم'),
('PIT-024', 'اجرای قرار کارشناسی', 'تهیه گزارش اجرای قرار توسط کارشناس', 'PHASE_3', 'CONDITIONAL_EXPERT', 24, 'TAX_AUTHORITY', 'کارشناس مجری قرار', 'صدور قرار', 15, 'روز', 'گزارش اجرای قرار باید به پرونده اصلی متصل شود.', 'ماده ۲۳۸ قانون مالیات‌های مستقیم'),
('PIT-025', 'رسیدگی نهایی ماده ۲۳۸', 'رسیدگی نهایی و تعیین نتیجه', 'PHASE_3', 'MANDATORY', 25, 'TAX_AUTHORITY', 'مسئول یا مسئولان مربوط موضوع ماده ۲۳۸', 'گزارش اجرای قرار یا مستقیم', 0, 'روز', 'نتیجه رسیدگی باید مستند و قابل حسابرسی باشد.', 'ماده ۲۳۸ قانون مالیات‌های مستقیم'),
('PIT-026', 'اعلام نتیجه رسیدگی مجدد', 'اعلام نتیجه رسیدگی مجدد ماده ۲۳۸ به مؤدی', 'PHASE_3', 'MANDATORY', 26, 'TAX_AUTHORITY', 'سازمان امور مالیاتی', 'رسیدگی نهایی', 5, 'روز', 'نتیجه باید از طریق سامانه یا ابلاغ رسمی اعلام شود.', 'ماده ۲۳۸ قانون مالیات‌های مستقیم'),
('PIT-027', 'تصمیم مؤدی درباره نتیجه رسیدگی', 'اعلام قبول یا عدم قبول نتیجه رسیدگی مجدد', 'PHASE_3', 'MANDATORY', 27, 'TAXPAYER', 'موتور خودکار', 'اعلام نتیجه', 10, 'روز', 'عدم پاسخ مؤدی به معنی قبول نیست.', 'ماده ۲۳۸ قانون مالیات‌های مستقیم'),
-- فاز ۴: پایان مهلت و ارجاع
('PIT-030', 'پایان مهلت اعتراض - ابلاغ واقعی', 'قطعیت خودکار در صورت عدم اقدام مؤدی پس از ابلاغ واقعی', 'PHASE_4', 'EXPIRED_END', 30, 'TAX_AUTHORITY', 'موتور خودکار', 'انقضای مهلت ۳۰ روزه', 0, 'روز', 'مؤدی در مهلت اقدام نکرده و ابلاغ واقعی بوده است.', 'ماده ۲۳۸ و ۲۳۹ قانون مالیات‌های مستقیم'),
('PIT-031', 'پایان مهلت - ابلاغ قانونی', 'مؤدی در حکم معترض پس از ابلاغ قانونی', 'PHASE_4', 'NEXT_STAGE', 31, 'TAX_AUTHORITY', 'موتور خودکار', 'انقضای مهلت ۳۰ روزه', 0, 'روز', 'مؤدی در حکم معترض است و پرونده به هیأت ارجاع می‌شود.', 'تبصره ماده ۲۳۹ قانون مالیات‌های مستقیم'),
('PIT-032', 'ارجاع به هیأت حل اختلاف بدوی', 'ارجاع پرونده به هیأت حل اختلاف مالیاتی بدوی', 'PHASE_4', 'NEXT_STAGE', 32, 'TAX_AUTHORITY', 'واحد ارجاع', 'عدم توافق یا ارجاع خودکار', 0, 'روز', 'پرونده به هیأت بدوی ارجاع می‌شود.', 'ماده ۲۴۴ قانون مالیات‌های مستقیم'),
-- فاز ۵: قطعیت و پرداخت
('PIT-050', 'صدور برگ قطعی مالیات بر عملکرد', 'صدور رسمی برگ قطعی پس از قطعیت', 'PHASE_5', 'MANDATORY', 50, 'TAX_AUTHORITY', 'واحد قطعیت و وصول', 'قطعیت مالیات', 5, 'روز', 'برگ قطعی شامل مالیات و جرائم قطعی است.', 'ماده ۲۱۰ و ۲۳۹ قانون مالیات‌های مستقیم'),
('PIT-051', 'پرداخت مالیات قطعی', 'پرداخت مالیات ظرف ۱۰ روز پس از ابلاغ برگ قطعی', 'PHASE_5', 'MANDATORY', 51, 'TAXPAYER', 'واحد قطعیت و وصول', 'ابلاغ برگ قطعی', 10, 'روز', 'مؤدی باید ظرف ۱۰ روز مالیات قطعی را بپردازد.', 'ماده ۲۱۰ قانون مالیات‌های مستقیم')
ON CONFLICT (workflow_code, code) DO UPDATE SET
  title_fa = EXCLUDED.title_fa,
  description_fa = EXCLUDED.description_fa,
  phase_code = EXCLUDED.phase_code,
  step_type = EXCLUDED.step_type,
  display_order = EXCLUDED.display_order,
  actor_role_code = EXCLUDED.actor_role_code,
  responsible_organization = EXCLUDED.responsible_organization,
  base_event = EXCLUDED.base_event,
  gap_value = EXCLUDED.gap_value,
  gap_unit = EXCLUDED.gap_unit,
  user_guidance_fa = EXCLUDED.user_guidance_fa,
  legal_basis = EXCLUDED.legal_basis;

-- 5. Insert transitions
INSERT INTO tax_stage_transitions (from_stage_code, to_stage_code, trigger_type, condition_description, legal_basis, display_order) VALUES
('PIT-001', 'PIT-002', 'MANUAL', 'تکمیل گزارش رسیدگی', 'ماده ۲۱۹ ق.م.م', 1),
('PIT-002', 'PIT-003', 'MANUAL', 'تأیید برگ تشخیص', 'ماده ۲۳۷ ق.م.م', 2),
('PIT-003', 'PIT-004', 'MANUAL', 'درخواست جزئیات گزارش (اختیاری)', 'ماده ۲۳۷ ق.م.م', 3),
('PIT-003', 'PIT-005', 'AUTO', 'شروع مهلت ۳۰ روزه', 'ماده ۲۳۸ ق.م.م', 4),
('PIT-005', 'PIT-010', 'MANUAL', 'قبول کتبی مؤدی', 'ماده ۲۳۹ ق.م.م', 5),
('PIT-005', 'PIT-011', 'MANUAL', 'پرداخت به مأخذ برگ تشخیص', 'ماده ۲۳۹ ق.م.م', 6),
('PIT-005', 'PIT-020', 'MANUAL', 'ثبت اعتراض ماده ۲۳۸', 'ماده ۲۳۸ ق.م.م', 7),
('PIT-005', 'PIT-030', 'AUTO', 'انقضای مهلت + ابلاغ واقعی', 'ماده ۲۳۸ ق.م.م', 8),
('PIT-005', 'PIT-031', 'AUTO', 'انقضای مهلت + ابلاغ قانونی', 'تبصره ماده ۲۳۹ ق.م.م', 9),
('PIT-010', 'PIT-012', 'MANUAL', 'ثبت قبول کتبی', 'ماده ۲۳۹ ق.م.م', 10),
('PIT-011', 'PIT-012', 'MANUAL', 'تکمیل پرداخت', 'ماده ۲۳۹ و ۲۱۰ ق.م.م', 11),
('PIT-020', 'PIT-021', 'MANUAL', 'ثبت اعتراض معتبر', 'ماده ۲۳۸ ق.م.م', 12),
('PIT-021', 'PIT-022', 'MANUAL', 'ارجاع به مسئول رسیدگی', 'ماده ۲۳۸ ق.م.م', 13),
('PIT-022', 'PIT-023', 'MANUAL', 'نیاز به کارشناسی', 'ماده ۲۳۸ ق.م.م', 14),
('PIT-022', 'PIT-025', 'MANUAL', 'عدم نیاز به کارشناسی', 'ماده ۲۳۸ ق.م.م', 15),
('PIT-023', 'PIT-024', 'MANUAL', 'صدور قرار کارشناسی', 'ماده ۲۳۸ ق.م.م', 16),
('PIT-024', 'PIT-025', 'MANUAL', 'تهیه گزارش اجرای قرار', 'ماده ۲۳۸ ق.م.م', 17),
('PIT-025', 'PIT-026', 'MANUAL', 'رسیدگی نهایی', 'ماده ۲۳۸ ق.م.م', 18),
('PIT-026', 'PIT-027', 'MANUAL', 'اعلام نتیجه به مؤدی', 'ماده ۲۳۸ ق.م.م', 19),
('PIT-027', 'PIT-050', 'MANUAL', 'پذیرش کامل یا عدم اختلاف', 'ماده ۲۳۸ و ۲۳۹ ق.م.م', 20),
('PIT-027', 'PIT-032', 'MANUAL', 'عدم توافق یا عدم پاسخ', 'ماده ۲۳۸ و ۲۴۴ ق.م.م', 21),
('PIT-030', 'PIT-050', 'AUTO', 'قطعیت خودکار پس از ابلاغ واقعی', 'ماده ۲۳۸ ق.م.م', 22),
('PIT-031', 'PIT-032', 'AUTO', 'در حکم معترض - ارجاع به هیأت', 'تبصره ماده ۲۳۹ ق.م.م', 23),
('PIT-032', 'PIT-050', 'MANUAL', 'ارجاع به هیأت بدوی', 'ماده ۲۴۴ ق.م.م', 24),
('PIT-050', 'PIT-051', 'MANUAL', 'صدور برگ قطعی', 'ماده ۲۱۰ ق.م.م', 25),
('PIT-012', 'PIT-050', 'MANUAL', 'قطعیت - صدور برگ قطعی', 'ماده ۲۳۹ ق.م.م', 26)
ON CONFLICT DO NOTHING;

COMMIT;
