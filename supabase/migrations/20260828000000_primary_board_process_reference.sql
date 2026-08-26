-- ==========================================================================
-- Migration: Primary board process reference data (هیأت حل اختلاف مالیاتی بدوی)
-- Date: 2026-08-28
-- Purpose: Define the first-instance tax dispute board process for
--          performance income tax. Reference data only — no taxpayer,
--          case, amount, payment, or fictitious event is created.
--          The appeal board (تجدیدنظر) is an exit point only; its
--          internal stages are defined in a later version.
-- ==========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Actors (اقدام‌کنندگان)
-- ---------------------------------------------------------------------------
INSERT INTO public.tax_actors (code, title_fa, actor_type, organization, description_fa, min_count, max_count, is_active)
VALUES
  ('first_instance_tax_dispute_board', 'هیأت حل اختلاف مالیاتی بدوی', 'first_instance_tax_dispute_board', 'مرجع دادرسی', 'رسیدگی به اختلاف حل‌نشده ارجاعی و صدور رأی بدوی.', 3, 3, true),
  ('primary_board_member', 'عضو هیأت حل اختلاف مالیاتی بدوی', 'first_instance_tax_dispute_board', 'مرجع دادرسی', 'عضو سه‌نفره هیأت بدوی؛ جلسه فقط با حضور هر سه عضو رسمی است و تصمیم با اکثریت آرا اتخاذ می‌شود.', 3, 3, true),
  ('primary_board_secretariat', 'دبیرخانه هیأت حل اختلاف مالیاتی بدوی', 'tax_objection_unit', 'سازمان امور مالیاتی', 'ثبت دعوت‌نامه، صورت‌جلسه، رأی و سوابق دبیرخانه هیأت بدوی.', 1, 1, true)
ON CONFLICT (code) DO UPDATE SET
  title_fa = EXCLUDED.title_fa,
  actor_type = EXCLUDED.actor_type,
  organization = EXCLUDED.organization,
  description_fa = EXCLUDED.description_fa,
  min_count = EXCLUDED.min_count,
  max_count = EXCLUDED.max_count,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 2. Legal references (منابع قانونی — فقط موارد جدید؛ بقیه از LDT_*/TAX_*/CPC_* استفاده می‌شود)
-- ---------------------------------------------------------------------------
INSERT INTO public.tax_legal_references
  (code, title_fa, source_type, source_number, article_or_section, relevant_text_fa, source_url, is_active, last_verified_date)
VALUES
  ('PRIMARY_ART_246', 'ماده ۲۴۶ قانون مالیات‌های مستقیم', 'law', 'قانون مالیات‌های مستقیم', 'ماده ۲۴۶', 'ابلاغ وقت جلسه، فاصله حداقل ۱۰ روز و اثر نداشتن غیبت مؤدی یا نمایندگان.', 'https://qavanin.ir/Law/TreeText?ApproveStateNo=&IDS=892583840653829785', true, CURRENT_DATE),
  ('PRIMARY_ART_247', 'ماده ۲۴۷ قانون مالیات‌های مستقیم', 'law', 'قانون مالیات‌های مستقیم', 'ماده ۲۴۷', 'مهلت ۲۰ روزه اعتراض به رأی بدوی و انتقال پرونده به هیأت تجدیدنظر.', 'https://qavanin.ir/Law/TreeText?ApproveStateNo=&IDS=892583840653829785', true, CURRENT_DATE),
  ('PRIMARY_ART_248', 'ماده ۲۴۸ قانون مالیات‌های مستقیم', 'law', 'قانون مالیات‌های مستقیم', 'ماده ۲۴۸', 'لزوم موجه و مدلل بودن رأی هیأت.', 'https://qavanin.ir/Law/TreeText?ApproveStateNo=&IDS=892583840653829785', true, CURRENT_DATE),
  ('PRIMARY_ART_249', 'ماده ۲۴۹ قانون مالیات‌های مستقیم', 'law', 'قانون مالیات‌های مستقیم', 'ماده ۲۴۹', 'درج مأخذ در رأی و اصلاح اشتباه محاسباتی.', 'https://qavanin.ir/Law/TreeText?ApproveStateNo=&IDS=892583840653829785', true, CURRENT_DATE)
ON CONFLICT (code) DO UPDATE SET
  title_fa = EXCLUDED.title_fa,
  source_number = EXCLUDED.source_number,
  article_or_section = EXCLUDED.article_or_section,
  relevant_text_fa = EXCLUDED.relevant_text_fa,
  source_url = EXCLUDED.source_url,
  is_active = EXCLUDED.is_active,
  last_verified_date = EXCLUDED.last_verified_date,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 3. Stages (مراحل اصلی قابل نمایش + مرحله مشروط + نقطه خروج)
-- ---------------------------------------------------------------------------
INSERT INTO public.tax_objection_stages
  (workflow_code, code, title_fa, description_fa, phase_code, step_type, display_order, actor_role_code, responsible_organization, is_required, base_event, gap_value, gap_unit, user_guidance_fa, form_schema, legal_basis, is_active)
VALUES
  ('PRIMARY_BOARD', 'PRIMARY_BOARD_INVITATION', 'ابلاغ دعوت‌نامه جلسه هیأت بدوی', 'صدور و ابلاغ معتبر دعوت‌نامه جلسه با رعایت فاصله قانونی.', 'PHASE_1', 'MANDATORY', 1, 'tax_litigation_management', 'مدیریت دادرسی مالیاتی و دبیرخانه هیأت', true, 'ارجاع از رسیدگی موضوع ماده ۲۳۸', 10, 'روز', 'فاصله تاریخ ابلاغ تا روز جلسه نباید کمتر از ۱۰ روز باشد؛ روز ابلاغ و روز جلسه جزء مدت نیست. جلسه با فاصله کمتر فقط با درخواست کتبی مؤدی و موافقت مدیر دادرسی مجاز است.', '{"required_fields":["invitation_number","issue_date","service_date","effective_service_date","service_method","session_date","session_time","session_place","subject","performance_year","recipient"],"statuses":["PENDING_SERVICE","SERVED","LEGALLY_SERVED","SERVICE_FAILED","NEEDS_RESERVICE","SESSION_RESCHEDULED","REPLACEMENT_ISSUED"],"validation":{"min_days_between_service_and_session":10,"excluded_days":["service_day","session_day"],"acceleration_requires":["taxpayer_written_request","litigation_manager_approval"],"reschedule_reasons":["unexpected_holiday","missing_member_no_alternate","case_not_received","taxpayer_request_approved","authority_request_approved","member_prior_opinion","session_out_of_quorum","invitation_defect","service_defect","legal_gap_not_met"],"new_session_within_business_days":5}}', 'ماده ۲۴۶', true),
  ('PRIMARY_BOARD', 'PRIMARY_BOARD_HEARING', 'تشکیل جلسه هیأت بدوی', 'برگزاری جلسه با حضور هر سه عضو و ثبت نتیجه.', 'PHASE_2', 'MANDATORY', 2, 'first_instance_tax_dispute_board', 'هیأت حل اختلاف مالیاتی بدوی', true, 'ابلاغ معتبر دعوت‌نامه', 0, 'روز', 'جلسه فقط با حضور هر سه عضو رسمی است؛ تصمیم با اکثریت آرا اتخاذ می‌شود و نظر اقلیت باید در رأی درج شود. غیبت مؤدی یا نماینده اداره مانع رسیدگی نیست و موجب رد خودکار اعتراض نمی‌شود.', '{"required_fields":["session_number","planned_date","actual_date","start_time","end_time","session_place","quorum_status","member_ids","taxpayer_presence","authority_representative_presence","session_result"],"quorum_members":3,"majority_vote":true,"minority_opinion_required":true,"attendance":["taxpayer_present","legal_representative_present","both_present","absent"],"absence_does_not_block":["taxpayer","tax_authority_representative"],"results":["READY_FOR_PRIMARY_DECISION","EXPERT_ORDER","DEFICIENCY_ORDER","RE_EXPERT_ORDER","INATHA_ORDER","STAY_GRANTED","RESCHEDULE","NOT_QUORATE","NOT_IN_SCOPE"],"non_quorate_action":"needs_rescheduled_session"}', 'ماده ۲۴۴', true),
  ('PRIMARY_BOARD', 'PRIMARY_BOARD_SUPPLEMENTARY_REVIEW', 'رسیدگی تکمیلی هیأت بدوی', 'اجرای قرار کارشناسی، رفع نقص یا کارشناسی مجدد؛ فقط در صورت صدور واقعی قرار.', 'PHASE_2', 'CONDITIONAL', 3, 'first_instance_tax_dispute_board', 'هیأت بدوی و مجری قرار', false, 'صدور قرار کارشناسی یا رفع نقص', 60, 'روز', 'این مرحله فقط وقتی نمایش داده شود که هیأت واقعاً قرار صادر کرده باشد. مجری قرار حداکثر ظرف ۷ روز تعیین شود؛ مهلت اجرا حداکثر ۶۰ روز با یک تمدید حداکثر ۳۰ روزه.', '{"order_types":["EXPERT","DEFICIENCY","RE_EXPERT"],"executor_assignment_days":7,"execution_deadline_days":60,"max_extensions":1,"extension_max_days":30,"extension_requires":["written_request","valid_approval"],"timeline_visible_if":"order_issued","after_report":["register_report","schedule_new_session","issue_new_invitation","respect_10_day_gap"]}', 'ماده ۲۴۴', true),
  ('PRIMARY_BOARD', 'PRIMARY_BOARD_RESULT', 'نتیجه رسیدگی هیأت بدوی', 'ثبت نتیجه رسیدگی با رعایت محدودیت‌های رسیدگی.', 'PHASE_3', 'MANDATORY', 4, 'first_instance_tax_dispute_board', 'هیأت حل اختلاف مالیاتی بدوی', true, 'ختم رسیدگی', 0, 'روز', 'هیأت فقط به مواردی رسیدگی کند که مؤدی هنوز به آن‌ها معترض است؛ مبلغ تعیین‌شده پس از ماده ۲۳۸ افزایش نیابد و اقلام پذیرفته‌شده به زیان مؤدی تغییر نکنند.', '{"results":["CONFIRMATION","ADJUSTMENT","FULL_RELIEF","SUPPLEMENTARY_REVIEW","RESCHEDULE","NOT_IN_SCOPE"],"result_labels":{"CONFIRMATION":"رأی تأیید","ADJUSTMENT":"رأی تعدیل","FULL_RELIEF":"رأی رفع تعرض","SUPPLEMENTARY_REVIEW":"قرار رسیدگی تکمیلی","RESCHEDULE":"تجدید جلسه","NOT_IN_SCOPE":"نظر عدم طرح موضوع"},"scope_limits":["only_disputed_items","no_increase_over_article_238_result","no_reduction_of_confirmed_losses"]}', 'ماده ۲۴۴', true),
  ('PRIMARY_BOARD', 'PRIMARY_BOARD_DECISION_ISSUED', 'صدور رأی هیأت بدوی', 'تنظیم، امضا و ثبت رأی بدوی.', 'PHASE_4', 'MANDATORY', 5, 'first_instance_tax_dispute_board', 'هیأت بدوی و دبیرخانه هیأت', true, 'ثبت نتیجه رسیدگی', 3, 'روز کاری', 'رأی باید حداکثر ظرف ۳ روز کاری پس از ختم جلسه تنظیم، موجه و مستدل و درباره تمام بندهای اعتراض باشد و به امضای هر سه عضو برسد. قبل از امضای هر سه عضو قابل ابلاغ نیست.', '{"draft_within_business_days":3,"registration_within_business_days":10,"required_signatures":3,"not_servable_before_all_signatures":true,"minority_opinion_required":true,"required_fields":["decision_number","decision_date","decision_type","majority_opinion","minority_opinion","member_signatures","legal_basis","assessment_basis","tax_amount","penalties"]}', 'مواد ۲۴۴ و ۲۴۸', true),
  ('PRIMARY_BOARD', 'PRIMARY_BOARD_DECISION_SERVED', 'ابلاغ رأی هیأت بدوی', 'ابلاغ معتبر رأی و شروع مهلت اعتراض.', 'PHASE_5', 'MANDATORY', 6, 'tax_notification_unit', 'مرجع مسئول ابلاغ', true, 'صدور و ثبت رأی', 0, 'روز', 'مهلت اعتراض فقط پس از ابلاغ معتبر شروع شود؛ تاریخ صدور یا ثبت رأی جایگزین تاریخ ابلاغ نیست.', '{"statuses":["PENDING_SERVICE","SERVED","LEGALLY_SERVED","SERVICE_FAILED","NEEDS_RESERVICE"],"deadline_starts_from":"valid_service_only","required_fields":["decision_number","service_date","effective_service_date","service_method","service_recipient","service_receipt"]}', 'ماده ۲۰۳', true),
  ('PRIMARY_BOARD', 'PRIMARY_BOARD_APPEAL_DEADLINE', 'مهلت اعتراض به رأی هیأت بدوی', 'مهلت ۲۰ روزه اعتراض از تاریخ ابلاغ رأی.', 'PHASE_6', 'MANDATORY', 7, 'system_automation', 'موتور خودکار پلتفرم', true, 'ابلاغ معتبر رأی', 20, 'روز', 'روز ابلاغ جزء مهلت نیست و شمارش از روز بعد آغاز می‌شود؛ اگر آخرین روز مهلت تعطیل رسمی باشد، مهلت در نخستین روز کاری بعد پایان می‌یابد.', '{"appeal_days":20,"service_day_excluded":true,"holiday_rollover":true,"calendar":"Asia/Tehran","statuses":["NOT_STARTED","ACTIVE","TAXPAYER_APPEALED","TAX_AUTHORITY_APPEALED","BOTH_APPEALED","EXPIRED_WITHOUT_APPEAL","DECISION_FINAL"],"appeal_parties":["taxpayer","tax_authority","both"],"notifications":[{"at":"start"},{"at":"remaining_days":10},{"at":"remaining_days":5},{"at":"remaining_days":2},{"at":"last_day"},{"at":"expired"}]}', 'ماده ۲۴۷', true),
  ('PRIMARY_BOARD', 'PRIMARY_BOARD_DECISION_OUTCOME', 'تعیین تکلیف رأی بدوی', 'قطعیت رأی یا ارجاع به هیأت تجدیدنظر.', 'PHASE_7', 'MANDATORY', 8, 'system_automation', 'مدیریت دادرسی مالیاتی', true, 'پایان مهلت اعتراض یا ثبت اعتراض', 0, 'روز', 'اگر مهلت بدون اعتراض معتبر پایان یابد رأی بدوی قطعی می‌شود. در صورت اعتراض یک طرف یا هر دو، رأی قطعی اعلام نشود و فقط یک ارجاع به هیأت تجدیدنظر ایجاد شود. اعتراض خارج از مهلت رأی را از قطعیت خارج نمی‌کند.', '{"outcomes":["PRIMARY_DECISION_FINAL","TAXPAYER_APPEALED","TAX_AUTHORITY_APPEALED","BOTH_PARTIES_APPEALED","LATE_APPEAL_RECEIVED"],"final_basis":"no_timely_appeal","single_referral_when_both_appeal":true,"late_appeal":"kept_for_separate_legal_review","next_steps":{"PRIMARY_DECISION_FINAL":"PERFORMANCE_FINAL_ASSESSMENT_ISSUANCE","APPEALED":"APPEAL_BOARD_REFERRAL"}}', 'ماده ۲۴۷', true),
  ('PRIMARY_BOARD', 'APPEAL_BOARD_REFERRAL', 'ارجاع به هیأت حل اختلاف مالیاتی تجدیدنظر', 'نقطه خروج فرایند؛ مراحل داخلی هیأت تجدیدنظر در نسخه بعدی تعریف می‌شود.', 'PHASE_7', 'TRANSITION', 90, 'first_instance_tax_dispute_board', 'مدیریت دادرسی مالیاتی', false, 'اعتراض مؤدی یا اداره امور مالیاتی', 0, 'روز', 'فقط یک ارجاع برای هر پرونده ایجاد شود؛ ارتباط هر دو اعتراض با پرونده حفظ شود.', '{"exit_point":true,"appeal_board_process":"next_version"}', 'ماده ۲۴۷', true)
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

-- ---------------------------------------------------------------------------
-- 4. Transitions (انتقال‌های فرایند)
-- ---------------------------------------------------------------------------
INSERT INTO public.tax_stage_transitions
  (from_stage_code, to_stage_code, trigger_type, condition_description, legal_basis, display_order, is_active)
VALUES
  ('PIT-032', 'PRIMARY_BOARD_INVITATION', 'MANUAL', 'ارجاع مابه‌الاختلاف حل‌نشده به هیأت بدوی ثبت شد', 'ماده ۲۴۴', 1, true),
  ('PRIMARY_BOARD_INVITATION', 'PRIMARY_BOARD_HEARING', 'MANUAL', 'دعوت‌نامه معتبر ابلاغ شد و فاصله قانونی رعایت شد یا استثنای معتبر ثبت شد', 'ماده ۲۴۶', 2, true),
  ('PRIMARY_BOARD_HEARING', 'PRIMARY_BOARD_RESULT', 'MANUAL', 'ختم رسیدگی و آماده صدور رأی', 'ماده ۲۴۴', 3, true),
  ('PRIMARY_BOARD_HEARING', 'PRIMARY_BOARD_SUPPLEMENTARY_REVIEW', 'MANUAL', 'صدور قرار کارشناسی، رفع نقص یا کارشناسی مجدد', 'ماده ۲۴۴', 4, true),
  ('PRIMARY_BOARD_SUPPLEMENTARY_REVIEW', 'PRIMARY_BOARD_HEARING', 'MANUAL', 'گزارش اجرای قرار دریافت شد و جلسه مجدد تعیین شد', 'ماده ۲۴۴', 5, true),
  ('PRIMARY_BOARD_RESULT', 'PRIMARY_BOARD_DECISION_ISSUED', 'MANUAL', 'نتیجه رسیدگی ثبت شد و تنظیم رأی آغاز شد', 'ماده ۲۴۴', 6, true),
  ('PRIMARY_BOARD_DECISION_ISSUED', 'PRIMARY_BOARD_DECISION_SERVED', 'MANUAL', 'رأی به امضای هر سه عضو رسید و در سامانه ثبت شد', 'مواد ۲۴۴ و ۲۰۳', 7, true),
  ('PRIMARY_BOARD_DECISION_SERVED', 'PRIMARY_BOARD_APPEAL_DEADLINE', 'AUTOMATIC', 'ابلاغ معتبر رأی ثبت شد', 'ماده ۲۴۷', 8, true),
  ('PRIMARY_BOARD_APPEAL_DEADLINE', 'PRIMARY_BOARD_DECISION_OUTCOME', 'AUTOMATIC', 'مهلت ۲۰ روزه بدون اعتراض معتبر پایان یافت', 'ماده ۲۴۷', 9, true),
  ('PRIMARY_BOARD_APPEAL_DEADLINE', 'PRIMARY_BOARD_DECISION_OUTCOME', 'MANUAL', 'اعتراض معتبر داخل مهلت ثبت شد', 'ماده ۲۴۷', 10, true),
  ('PRIMARY_BOARD_DECISION_OUTCOME', 'PIT-050', 'AUTOMATIC', 'عدم اعتراض در مهلت — قطعیت رأی بدوی و ادامه برای صدور برگ قطعی', 'ماده ۲۴۷', 11, true),
  ('PRIMARY_BOARD_DECISION_OUTCOME', 'APPEAL_BOARD_REFERRAL', 'MANUAL', 'اعتراض مؤدی یا اداره امور مالیاتی — ارجاع به هیأت تجدیدنظر', 'ماده ۲۴۷', 12, true)
ON CONFLICT (from_stage_code, to_stage_code, trigger_type) DO UPDATE SET
  condition_description = EXCLUDED.condition_description,
  legal_basis = EXCLUDED.legal_basis,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

COMMIT;
