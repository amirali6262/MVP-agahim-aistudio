/**
 * In-memory mock database — mirrors the Supabase schema.
 * Data lives in a module-level singleton; survives re-renders
 * but resets on full page reload.
 */
import { isSupabaseConfigured } from './supabase'
import type { Obligation, Tenant, UserTenantRow, UserTenantWithTenant, ObjectionTemplate, DeadlineExtension, TenantObligationFulfillment, CommercialBookPeriod, ChecklistTemplate, TenantChecklistProgress, ChecklistSection, ChecklistItem, ChecklistImportance } from './supabase'

/**
 * Demo data is enabled when Supabase is not configured or explicitly enabled.
 */
export const isMockDataEnabled =
  !isSupabaseConfigured || import.meta.env['VITE_ENABLE_MOCK_DATA'] === 'true'

function requireMockData(): void {
  if (!isMockDataEnabled) {
    throw new Error('داده‌های آزمایشی در این محیط غیرفعال است.')
  }
}

// ---------------------------------------------------------------------------
// Objection Templates — seeded data
// ---------------------------------------------------------------------------
let _objectionTemplates: ObjectionTemplate[] = isMockDataEnabled ? [
  {
    id: 'obj-001',
    template_name: 'الگوی پایه دادرسی و حل اختلاف مالیاتی (چارچوب مادر با قابلیت بازنویسی در هر نوع مالیات)',
    description: 'الگوی پایه دادرسی مالیاتی بر اساس مواد ۲۳۸، ۲۴۴، ۲۴۷، ۲۵۱، ۲۵۱ مکرر ق.م.م و دیوان عدالت اداری با امکان بازنویسی مهلت‌ها و مراجع برای هر نوع مالیات.',
    is_base_template: true,
    tax_type_overrides: [
      {
        tax_type: 'TAX_CORPORATE',
        tax_type_title: 'مالیات بر عملکرد اشخاص حقوقی',
        statutory_deadline_override: 30,
        deadline_unit: 'روز',
        legal_reference_override: 'ماده ۲۳۸ و ۲۴۴ قانون مالیات‌های مستقیم (مهلت ثبت ۳۰ روز - مهلت توافق ۴۵ روز)',
        special_tribunal_name: 'هیأت حل اختلاف مالیاتی بدوی و تجدیدنظر (ماده ۲۴۴ و ۲۴۷ ق.م.م)',
        notes: 'طبق ماده ۱۵۶ ق.م.م، چنانچه ظرف یک سال از تاریخ تسلیم اظهارنامه برگ تشخیص صادر نشود، ارقام ابرازی خودکار قطعی می‌گردد.',
        is_custom_path_active: true,
      },
      {
        tax_type: 'VAT',
        tax_type_title: 'مالیات بر ارزش افزوده (قانون دائمی)',
        statutory_deadline_override: 20,
        deadline_unit: 'روز',
        legal_reference_override: 'ماده ۳۴ و ۳۶ قانون دائمی مالیات بر ارزش افزوده و ماده ۲۳۸ ق.م.م',
        special_tribunal_name: 'هیأت‌های تخصصی حل اختلاف ارزش افزوده و کارگروه اعتبارات مالیاتی',
        notes: 'مهلت اعتراض به برگ مطالبه ارزش افزوده ظرف ۲۰ روز از تاریخ ابلاغ اداری/الکترونیکی است.',
        is_custom_path_active: true,
      },
      {
        tax_type: 'SALARY_TAX',
        tax_type_title: 'مالیات بر درآمد حقوق و مالیات‌های تکلیفی',
        statutory_deadline_override: 30,
        deadline_unit: 'روز',
        legal_reference_override: 'ماده ۸۶ و تبصره ماده ۲۱۶ قانون مالیات‌های مستقیم',
        special_tribunal_name: 'هیأت حل اختلاف مالیاتی موضوع ماده ۲۱۶ ق.م.م (رسیدگی به شکایات وصول و اجرا)',
        notes: 'دادرسی در خصوص مطالبه مالیات تکلیفی از پرداخت‌کننده از طریق هیأت ماده ۲۱۶ صورت می‌گیرد.',
        is_custom_path_active: true,
      },
      {
        tax_type: 'SEASONAL_REPORT',
        tax_type_title: 'صورت معاملات فصلی (ماده ۱۶۹ مکرر)',
        statutory_deadline_override: 30,
        deadline_unit: 'روز',
        legal_reference_override: 'ماده ۱۶۹ و تبصره‌های ماده ۱۹۲ ق.م.م (جرایم عدم ارسال صورت معاملات)',
        special_tribunal_name: 'هیأت حل اختلاف مالیاتی بدوی (ماده ۲۴۴ ق.م.م)',
        notes: 'جرایم عدم ارائه فهرست معاملات مشمول بخشودگی‌های خاص موضوع ماده ۱۹۱ ق.م.م است.',
        is_custom_path_active: true,
      },
      {
        tax_type: 'INVOICE_SYSTEM',
        tax_type_title: 'قانون پایانه‌های فروشگاهی و سامانه مؤدیان',
        statutory_deadline_override: 30,
        deadline_unit: 'روز',
        legal_reference_override: 'ماده ۹ و ۱۰ قانون پایانه‌های فروشگاهی و سامانه مؤدیان',
        special_tribunal_name: 'کارگروه ویژه راهبری سامانه مؤدیان و هیأت ۲۴۴ ق.م.م',
        notes: 'صورتحساب‌های الکترونیکی ثبت‌شده در سامانه مؤدیان معتبر بوده و رسیدگی خارج از سامانه ممنوع است.',
        is_custom_path_active: true,
      },
    ],
    steps: [
      {
        id: 's-100a',
        title: '۱. صدور برگ تشخیص مالیات اشخاص حقوقی',
        base_event: 'تاریخ ابلاغ برگه تشخیص',
        gap_value: 30,
        gap_unit: 'روز',
        step_nature: 'MANDATORY',
        actor: 'TAX_AUTHORITY',
        note: 'ابلاغ رسمی برگه تشخیص مالیات توسط ممیز یا اداره امور مالیاتی به مودی',
        fields: [
          { id: 'f-100a-1', label: 'شماره برگ تشخیص صادر شده', key: 'assessment_number', type: 'text', required: true, placeholder: 'AS-1404-7721' },
          { id: 'f-100a-2', label: 'تاریخ ابلاغ واقعی/قانونی (شروع مهلت ۳۰ روزه)', key: 'assessment_notice_date', type: 'date', required: true, placeholder: '1404/08/15' },
          { id: 'f-100a-3', label: 'درآمد مشمول مالیات تشخیصی ممیز (ریال)', key: 'assessed_taxable_income', type: 'text', required: true, placeholder: '۱۵,۰۰۰,۰۰۰,۰۰۰' },
          { id: 'f-100a-4', label: 'مبلغ مالیات تشخیصی سازمان (ریال)', key: 'assessed_tax_amount', type: 'text', required: true, placeholder: '۳,۷۵۰,۰۰۰,۰۰۰' },
          { id: 'f-100a-5', label: 'تصویر / فایل برگ تشخیص ابلاغ شده', key: 'assessment_file', type: 'file', required: false },
        ],
      },
      {
        id: 's-100b',
        title: '۲. اخذ گزارش رسیدگی ممیز / اداره امور مالیاتی',
        base_event: 'تاریخ ابلاغ برگه تشخیص',
        gap_value: 30,
        gap_unit: 'روز',
        step_nature: 'MANDATORY',
        actor: 'TAX_AUTHORITY',
        note: 'درخواست و دریافت گزارش تفصیلی رسیدگی ممیز مالیاتی جهت استخراج دلایل مابه‌التفاوت',
        fields: [
          { id: 'f-100b-1', label: 'شماره و تاریخ گزارش رسیدگی ممیز', key: 'audit_report_number', type: 'text', required: true, placeholder: 'REP-1404-9011' },
          { id: 'f-100b-2', label: 'تاریخ دریافت و فتوکپی گزارش', key: 'audit_report_date', type: 'date', required: true, placeholder: '1404/08/20' },
          { id: 'f-100b-3', label: 'خلاصه مواردی که توسط ممیز برگشت داده شده', key: 'disallowed_items', type: 'text', required: false, placeholder: 'رد بخشی از هزینه اجاره و استهلاک' },
          { id: 'f-100b-4', label: 'تصویر / فایل کامل گزارش رسیدگی ممیز', key: 'audit_report_file', type: 'file', required: false },
        ],
      },
      {
        id: 's-101',
        title: '۳. ثبت اعتراض اولیه به برگه تشخیص (ماده ۲۳۸ ق.م.م)',
        base_event: 'تاریخ ابلاغ برگه تشخیص',
        gap_value: 30,
        gap_unit: 'روز',
        step_nature: 'MANDATORY',
        actor: 'TAXPAYER',
        note: 'ثبت اعتراض رسمی مودی در سامانه یا تقدیم کتبی ظرف ۳۰ روز از ابلاغ برگه تشخیص به مسئول مربوطه (ممیز کل/رئیس امور مالیاتی)',
        fields: [
          { id: 'f-101-1', label: 'کد رهگیری / شماره ثبت اعتراض ماده ۲۳۸', key: 'objection_tracking_number', type: 'text', required: true, placeholder: 'OBJ-1404-8812' },
          { id: 'f-101-2', label: 'تاریخ ثبت اعتراض در سامانه / دبیرخانه', key: 'objection_date', type: 'date', required: true, placeholder: '1404/08/28' },
          { id: 'f-101-3', label: 'خلاصه دلایل و لایحه دفاعیه اعتراض', key: 'objection_summary', type: 'text', required: false },
          { id: 'f-101-4', label: 'تصویر لایحه و مدارک مثبته اعتراض', key: 'objection_file', type: 'file', required: false },
        ],
      },
      {
        id: 's-102',
        title: '۴. صدور و اجرای قرار کارشناسی ماده ۲۳۸ (مشروط)',
        base_event: 'تاریخ ابلاغ برگه تشخیص',
        gap_value: 30,
        gap_unit: 'روز',
        step_nature: 'CONDITIONAL_EXPERT',
        actor: 'TAX_AUTHORITY',
        note: 'در صورت صلاحدید ممیز کل جهت بررسی مجدد اسناد، دفاتر، حساب‌های بانکی و مدارک مودی',
      },
      {
        id: 's-103',
        title: '۳. اخذ گزارش رسیدگی مجدد قرار کارشناسی ماده ۲۳۸',
        base_event: 'تاریخ اجرای قرار کارشناسی',
        gap_value: 15,
        gap_unit: 'روز',
        step_nature: 'CONDITIONAL_EXPERT',
        actor: 'TAX_AUTHORITY',
        note: 'ارائه گزارش رسمی کارشناس مجری قرار به ممیز کل جهت اتخاذ تصمیم نهایی',
      },
      {
        id: 's-104',
        title: '۴. توافق ماده ۲۳۸ با ممیز کل (خاتمه پرونده)',
        base_event: 'تاریخ ابلاغ برگه تشخیص',
        gap_value: 30,
        gap_unit: 'روز',
        step_nature: 'AGREEMENT_END',
        actor: 'TAXPAYER',
        note: 'امضای صورتجلسه توافق، تعدیل مأخذ مالیاتی و صدور برگ قطعی (ختم قطعی پرونده)',
      },
      {
        id: 's-105',
        title: '۵. تمکین به برگه تشخیص (خاتمه پرونده با بخشودگی)',
        base_event: 'تاریخ ابلاغ برگه تشخیص',
        gap_value: 30,
        gap_unit: 'روز',
        step_nature: 'SETTLEMENT_END',
        actor: 'TAXPAYER',
        note: 'پذیرش مأخذ و پرداخت یا ترتیب پرداخت مالیات جهت بهره‌مندی از حداکثر بخشودگی جرایم (ماده ۱۹۰ ق.م.م)',
      },
      {
        id: 's-106',
        title: '۶. انقضای مهلت ۳۰ روزه ماده ۲۳۸ بدون اقدام (قطعیت برگه)',
        base_event: 'تاریخ ابلاغ برگه تشخیص',
        gap_value: 30,
        gap_unit: 'روز',
        step_nature: 'EXPIRED_END',
        actor: 'TAXPAYER',
        note: 'عدم ثبت اعتراض یا عدم مراجعه مودی ظرف ۳۰ روز، موجب قطعی شدن برگه تشخیص و صدور برگ قطعی می‌گردد',
      },
      {
        id: 's-107',
        title: '۷. عدم توافق/تمکین: ارجاع به هیأت حل اختلاف بدوی (ماده ۲۴۴ ق.م.م)',
        base_event: 'تاریخ ابلاغ برگه تشخیص',
        gap_value: 30,
        gap_unit: 'روز',
        step_nature: 'NEXT_STAGE',
        actor: 'TAX_AUTHORITY',
        note: 'ارسال پرونده به هیأت بدوی با انتخاب نماینده مودی (اتاق بازرگانی/جامعه حسابداران/اصناف)',
      },
      {
        id: 's-108',
        title: '۸. ابلاغ وقت رسیدگی هیأت حل اختلاف بدوی',
        base_event: 'تاریخ ابلاغ برگه تشخیص',
        gap_value: 20,
        gap_unit: 'روز',
        step_nature: 'MANDATORY',
        actor: 'TAX_AUTHORITY',
        note: 'ابلاغ تاریخ و ساعت تشکیل جلسه هیأت بدوی حداقل ۱۰ روز قبل از جلسه به مودی',
      },
      {
        id: 's-109',
        title: '۹. صدور و اجرای قرار کارشناسی هیأت بدوی (مشروط)',
        base_event: 'تاریخ صدور رای',
        gap_value: 45,
        gap_unit: 'روز',
        step_nature: 'CONDITIONAL_EXPERT',
        actor: 'TAX_AUTHORITY',
        note: 'در صورت ابهام هیأت حل اختلاف بدوی و ارجاع پرونده به مجری قرار جهت حسابرسی دقیق‌تر',
      },
      {
        id: 's-110',
        title: '۱۰. اخذ و ارائه گزارش رسیدگی اجرای قرار کارشناسی هیأت بدوی',
        base_event: 'تاریخ اجرای قرار کارشناسی',
        gap_value: 15,
        gap_unit: 'روز',
        step_nature: 'CONDITIONAL_EXPERT',
        actor: 'TAX_AUTHORITY',
        note: 'تنظیم گزارش کارشناسی توسط مجری قرار و ارائه رسمی آن به دفتر هیأت بدوی',
      },
      {
        id: 's-111',
        title: '۱۱. ابلاغ وقت جلسه دوم هیأت بدوی (بررسی گزارش قرار کارشناسی)',
        base_event: 'تاریخ اجرای قرار کارشناسی',
        gap_value: 15,
        gap_unit: 'روز',
        step_nature: 'CONDITIONAL_EXPERT',
        actor: 'TAX_AUTHORITY',
        note: 'دعوت مجدد مودی و مجری قرار جهت استماع دفاعیات بر روی گزارش کارشناسی',
      },
      {
        id: 's-112',
        title: '۱۲. صدور و ابلاغ رای هیأت حل اختلاف بدوی',
        base_event: 'تاریخ صدور رای',
        gap_value: 10,
        gap_unit: 'روز',
        step_nature: 'MANDATORY',
        actor: 'TAX_AUTHORITY',
        note: 'رسمی شدن رای هیأت بدوی و ابلاغ کتبی به مودی و اداره امور مالیاتی',
      },
      {
        id: 's-113',
        title: '۱۳. تمکین یا انقضای مهلت ۲۰ روزه تجدیدنظر (قطعیت رای بدوی)',
        base_event: 'تاریخ ابلاغ رای بدوی',
        gap_value: 20,
        gap_unit: 'روز',
        step_nature: 'EXPIRED_END',
        actor: 'TAXPAYER',
        note: 'عدم اعتراض ظرف ۲۰ روز از ابلاغ رای بدوی موجب قطعی شدن آن و صدور برگ قطعی می‌گردد',
      },
      {
        id: 's-114',
        title: '۱۴. ثبت اعتراض و تجدیدنظرخواهی (ماده ۲۴۷ ق.م.م)',
        base_event: 'تاریخ ابلاغ رای بدوی',
        gap_value: 20,
        gap_unit: 'روز',
        step_nature: 'NEXT_STAGE',
        actor: 'TAXPAYER',
        note: 'حق اعتراض ظرف ۲۰ روز برای مودی یا مامور معترض به رای بدوی جهت رسیدگی در هیأت تجدیدنظر',
      },
      {
        id: 's-115',
        title: '۱۵. ابلاغ وقت رسیدگی هیأت حل اختلاف تجدیدنظر',
        base_event: 'تاریخ ابلاغ رای بدوی',
        gap_value: 20,
        gap_unit: 'روز',
        step_nature: 'MANDATORY',
        actor: 'TAX_AUTHORITY',
        note: 'ابلاغ وقت جلسه رسیدگی هیأت تجدیدنظر حداقل ۱۰ روز قبل به مودی',
      },
      {
        id: 's-116',
        title: '۱۶. صدور و اجرای قرار کارشناسی هیأت تجدیدنظر (مشروط)',
        base_event: 'تاریخ صدور رای',
        gap_value: 45,
        gap_unit: 'روز',
        step_nature: 'CONDITIONAL_EXPERT',
        actor: 'TAX_AUTHORITY',
        note: 'بررسی مجدد مدارک توسط مجری قرار منتخب هیأت تجدیدنظر در صورت نیاز به حسابرسی مجدد',
      },
      {
        id: 's-117',
        title: '۱۷. اخذ و ارائه گزارش رسیدگی اجرای قرار کارشناسی هیأت تجدیدنظر',
        base_event: 'تاریخ اجرای قرار کارشناسی',
        gap_value: 15,
        gap_unit: 'روز',
        step_nature: 'CONDITIONAL_EXPERT',
        actor: 'TAX_AUTHORITY',
        note: 'تکمیل حسابرسی مجدد توسط مجری قرار تجدیدنظر و تحویل گزارش به دفتر هیأت',
      },
      {
        id: 's-118',
        title: '۱۸. ابلاغ وقت جلسه دوم هیأت تجدیدنظر (بررسی گزارش قرار)',
        base_event: 'تاریخ اجرای قرار کارشناسی',
        gap_value: 15,
        gap_unit: 'روز',
        step_nature: 'CONDITIONAL_EXPERT',
        actor: 'TAX_AUTHORITY',
        note: 'دعوت مجدد مودی و مجری قرار برای بررسی گزارش کارشناسی در هیأت تجدیدنظر',
      },
      {
        id: 's-119',
        title: '۱۹. صدور رای قطعی هیأت تجدیدنظر و صدور برگه قطعی',
        base_event: 'تاریخ ابلاغ رای بدوی',
        gap_value: 30,
        gap_unit: 'روز',
        step_nature: 'FINAL_NOTICE_ISSUANCE',
        actor: 'TAX_AUTHORITY',
        note: 'رای تجدیدنظر قطعی و لازم‌الاجراست و برگ قطعی صادر می‌شود (شکایت‌های بعدی مانع عملیات اجرایی نیست)',
      },
      {
        id: 's-120',
        title: '۲۰. شکایت در شورای عالی مالیاتی (ماده ۲۵۶ ق.م.م)',
        base_event: 'تاریخ ابلاغ رای بدوی',
        gap_value: 30,
        gap_unit: 'روز',
        step_nature: 'NEXT_STAGE',
        actor: 'TAXPAYER',
        note: 'شکایت شکلی ظرف ۱ ماه از ابلاغ رای قطعی به ادعای عدم رعایت قوانین و مقررات موضوعه',
      },
      {
        id: 's-121',
        title: '۲۱. صدور رای شورای عالی مالیاتی (نقض یا تایید)',
        base_event: 'تاریخ ابلاغ رای بدوی',
        gap_value: 60,
        gap_unit: 'روز',
        step_nature: 'MANDATORY',
        actor: 'TAX_AUTHORITY',
        note: 'در صورت تایید رای پرونده خاتمه می‌یابد و در صورت نقض، به هیأت همعرض ارجاع می‌شود',
      },
      {
        id: 's-122',
        title: '۲۲. ابلاغ وقت رسیدگی هیأت همعرض مالیاتی (پس از نقض شورای عالی)',
        base_event: 'تاریخ صدور رای',
        gap_value: 30,
        gap_unit: 'روز',
        step_nature: 'CONDITIONAL_EXPERT',
        actor: 'TAX_AUTHORITY',
        note: 'تشکیل جلسه هیأت حل اختلاف همعرض با ترکیب اعضای جدید پس از نقض رای در شورای عالی مالیاتی',
      },
      {
        id: 's-123',
        title: '۲۳. صدور و اجرای قرار کارشناسی هیأت همعرض شورای عالی مالیاتی (مشروط)',
        base_event: 'تاریخ صدور رای',
        gap_value: 45,
        gap_unit: 'روز',
        step_nature: 'CONDITIONAL_EXPERT',
        actor: 'TAX_AUTHORITY',
        note: 'صدور قرار کارشناسی توسط هیأت همعرض شورای عالی مالیاتی جهت حسابرسی مجدد ادعاهای مودی',
      },
      {
        id: 's-124',
        title: '۲۴. اخذ و ارائه گزارش رسیدگی اجرای قرار کارشناسی هیأت همعرض شورای عالی مالیاتی',
        base_event: 'تاریخ اجرای قرار کارشناسی',
        gap_value: 15,
        gap_unit: 'روز',
        step_nature: 'CONDITIONAL_EXPERT',
        actor: 'TAX_AUTHORITY',
        note: 'تکمیل گزارش کارشناسی قرار هیأت همعرض شورای عالی و تحویل به دفتر هیأت',
      },
      {
        id: 's-125',
        title: '۲۵. صدور و ابلاغ رای نهایی هیأت همعرض مالیاتی (پس از نقض شورا)',
        base_event: 'تاریخ صدور رای',
        gap_value: 30,
        gap_unit: 'روز',
        step_nature: 'FINAL_NOTICE_ISSUANCE',
        actor: 'TAX_AUTHORITY',
        note: 'صدور رای مجدد هیأت همعرض پس از نقض رای اولیه در شورای عالی مالیاتی',
      },
      {
        id: 's-126',
        title: '۲۶. ثبت دادخواست در دیوان عدالت اداری',
        base_event: 'تاریخ ابلاغ رای بدوی',
        gap_value: 90,
        gap_unit: 'روز',
        step_nature: 'NEXT_STAGE',
        actor: 'COURT_DIVAN',
        note: 'مهلت ۳ ماهه (مقیمین ایران) و ۶ ماهه (مقیمین خارج) جهت اعتراض به آرای قطعی هیأت‌ها در دیوان',
      },
      {
        id: 's-127',
        title: '۲۷. صدور رای شعب دیوان عدالت اداری (نقض و ارجاع به همعرض یا تایید)',
        base_event: 'تاریخ ابلاغ رای بدوی',
        gap_value: 120,
        gap_unit: 'روز',
        step_nature: 'NEXT_STAGE',
        actor: 'COURT_DIVAN',
        note: 'در صورت نقض رای قطعی توسط دیوان، پرونده جهت رسیدگی مجدد به هیأت همعرض دیوان ارسال می‌گردد',
      },
      {
        id: 's-128',
        title: '۲۸. صدور و اجرای قرار کارشناسی هیأت همعرض دیوان عدالت اداری (مشروط)',
        base_event: 'تاریخ صدور رای',
        gap_value: 45,
        gap_unit: 'روز',
        step_nature: 'CONDITIONAL_EXPERT',
        actor: 'TAX_AUTHORITY',
        note: 'صدور قرار کارشناسی مجدد توسط هیأت همعرض رسیدگی‌کننده به رای نقض شده از سوی دیوان',
      },
      {
        id: 's-129',
        title: '۲۹. اخذ و ارائه گزارش رسیدگی اجرای قرار کارشناسی هیأت همعرض دیوان عدالت اداری',
        base_event: 'تاریخ اجرای قرار کارشناسی',
        gap_value: 15,
        gap_unit: 'روز',
        step_nature: 'CONDITIONAL_EXPERT',
        actor: 'TAX_AUTHORITY',
        note: 'ارائه گزارش رسمی کارشناس مجری قرار هیأت همعرض دیوان به دفتر هیأت',
      },
      {
        id: 's-130',
        title: '۳۰. صدور و ابلاغ رای هیأت همعرض پس از نقض دیوان عدالت اداری',
        base_event: 'تاریخ صدور رای',
        gap_value: 30,
        gap_unit: 'روز',
        step_nature: 'FINAL_NOTICE_ISSUANCE',
        actor: 'TAX_AUTHORITY',
        note: 'صدور رای مجدد هیأت همعرض پیرو دستور و نقض شعب دیوان عدالت اداری',
      },
      {
        id: 's-131',
        title: '۳۱. تقاضای رسیدگی مستقیم و ورود ماهوی شعب دیوان (در صورت اصرار همعرض)',
        base_event: 'تاریخ صدور رای',
        gap_value: 30,
        gap_unit: 'روز',
        step_nature: 'NEXT_STAGE',
        actor: 'COURT_DIVAN',
        note: 'چنانچه هیأت همعرض مجدداً بر رای نقض‌شده اصرار ورزد، دیوان عدالت اداری مستقلاً رای مستقیم و ماهوی صادر می‌کند',
      },
      {
        id: 's-132',
        title: '۳۲. شکایت فوق‌العاده در هیأت ۲۵۱ مکرر (وزیر امور اقتصادی و دارایی)',
        base_event: 'تاریخ ابلاغ رای بدوی',
        gap_value: 365,
        gap_unit: 'روز',
        step_nature: 'NEXT_STAGE',
        actor: 'TAXPAYER',
        note: 'شکایت از آرای قطعی به ادعای غیرعادلانه بودن مالیات؛ رسیدگی غیرحضوری و متمرکز توسط هیأت منتخب وزیر',
      },
      {
        id: 's-133',
        title: '۳۳. صدور رای قطعی و غیرقابل تجدیدنظر هیأت ۲۵۱ مکرر',
        base_event: 'تاریخ صدور رای',
        gap_value: 180,
        gap_unit: 'روز',
        step_nature: 'FINAL_NOTICE_ISSUANCE',
        actor: 'TAX_AUTHORITY',
        note: 'تعدیل یا ابطال نهایی مالیات قطعی یا تایید مالیات توسط هیأت ویژه ۲۵۱ مکرر',
      },
    ],
    created_at: '2024-01-01T10:00:00Z',
  },
  {
    id: 'obj-002',
    template_name: 'الگوی اعتراض به اقدامات اجرایی (ماده ۲۱۶ ق.م.م)',
    steps: [
      {
        id: 's-201',
        title: '۱. ثبت اعتراض به برگه اجرایی / توقیف اموال (ماده ۲۱۶ ق.م.م)',
        base_event: 'تاریخ ابلاغ برگ/ااختیاریه',
        gap_value: 10,
        gap_unit: 'روز',
        step_nature: 'MANDATORY',
        note: 'اعتراض به صادر شدن برگه اجرایی قبل از قطعیت یا نادیده گرفتن مقررات اجرایی',
      },
      {
        id: 's-202',
        title: '۲. صدور دستور توقف موقت عملیات اجرایی (مشروط)',
        base_event: 'تاریخ ابلاغ برگ/ااختیاریه',
        gap_value: 5,
        gap_unit: 'روز',
        step_nature: 'CONDITIONAL_EXPERT',
        note: 'در صورت سپردن وثیقه یا قوی بودن دلایل مودی، هیأت ۲۱۶ دستور توقف اجرائیه صادر می‌کند.',
      },
      {
        id: 's-203',
        title: '۳. رسیدگی در هیأت حل اختلاف مالیاتی ماده ۲۱۶',
        base_event: 'تاریخ ابلاغ برگ/ااختیاریه',
        gap_value: 15,
        gap_unit: 'روز',
        step_nature: 'MANDATORY',
        note: 'بررسی شکلی قانونی بودن مراحل اجرایی و توقیف اموال',
      },
      {
        id: 's-204',
        title: '۴. توافق/تمکین و تسویه کامل پرونده اجرایی (خاتمه)',
        base_event: 'تاریخ ابلاغ برگ/ااختیاریه',
        gap_value: 15,
        gap_unit: 'روز',
        step_nature: 'AGREEMENT_END',
        note: 'پرداخت یا تقسیط بدهی اجرایی و رفع توقیف از حساب‌ها و اموال',
      },
      {
        id: 's-205',
        title: '۵. صدور رای هیأت ماده ۲۱۶ (ابطال یا تایید اجرائیه)',
        base_event: 'تاریخ صدور رای',
        gap_value: 1,
        gap_unit: 'روز',
        step_nature: 'FINAL_NOTICE_ISSUANCE',
        note: 'در صورت ابطال اجرائیه، پرونده به هیأت بدوی/ممیز کل جهت رسیدگی مجدد بازمی‌گردد.',
      },
    ],
    created_at: '2024-01-03T10:00:00Z',
  },
  {
    id: 'obj-003',
    template_name: 'الگوی اعتراض مالیات بر ارزش افزوده',
    steps: [
      {
        id: 's-301',
        title: '۱. ثبت اعتراض اولیه برگه مطالبه/استرداد ارزش افزوده',
        base_event: 'تاریخ ابلاغ برگ/ااختیاریه',
        gap_value: 20,
        gap_unit: 'روز',
        step_nature: 'MANDATORY',
        note: 'ثبت اعتراض در سامانه و تقدیم مدارک خریدهای دارای اعتبار مالیاتی',
      },
      {
        id: 's-302',
        title: '۲. اجرای قرار کارشناسی و تطبیق اعتبار صورتحساب‌ها (مشروط)',
        base_event: 'تاریخ ابلاغ برگ/ااختیاریه',
        gap_value: 30,
        gap_unit: 'روز',
        step_nature: 'CONDITIONAL_EXPERT',
        note: 'استعلام از سامانه مودیان و سامانه ارزش افزوده جهت احراز اعتبار صورتحساب‌ها',
      },
      {
        id: 's-303',
        title: '۳. توافق و تعدیل اعتبار ارزش افزوده (خاتمه)',
        base_event: 'تاریخ ابلاغ برگ/ااختیاریه',
        gap_value: 20,
        gap_unit: 'روز',
        step_nature: 'AGREEMENT_END',
        note: 'پذیرش اعتبار صورتحساب‌ها و صدور برگه قطعی تعدیل‌شده',
      },
      {
        id: 's-304',
        title: '۴. تمکین به برگه مطالبه ارزش افزوده',
        base_event: 'تاریخ ابلاغ برگ/ااختیاریه',
        gap_value: 20,
        gap_unit: 'روز',
        step_nature: 'SETTLEMENT_END',
      },
      {
        id: 's-305',
        title: '۵. انقضای مهلت ۲۰ روزه و قطعیت برگه ارزش افزوده',
        base_event: 'تاریخ ابلاغ برگ/ااختیاریه',
        gap_value: 20,
        gap_unit: 'روز',
        step_nature: 'EXPIRED_END',
      },
      {
        id: 's-306',
        title: '۶. ارجاع به هیأت حل اختلاف بدوی ارزش افزوده',
        base_event: 'تاریخ ابلاغ برگ/ااختیاریه',
        gap_value: 20,
        gap_unit: 'روز',
        step_nature: 'NEXT_STAGE',
      },
    ],
    created_at: '2024-01-05T10:00:00Z',
  },
] : []

export const mockObjectionTemplatesDb = {
  getAll(): ObjectionTemplate[] {
    return _objectionTemplates
  },
  getById(id: string): ObjectionTemplate | undefined {
    return _objectionTemplates.find((t) => t.id === id)
  },
  insert(payload: Omit<ObjectionTemplate, 'id' | 'created_at'>): ObjectionTemplate {
    requireMockData()
    const tmpl: ObjectionTemplate = {
      id: 'obj-' + Date.now(),
      ...payload,
      created_at: new Date().toISOString(),
    }
    _objectionTemplates = [tmpl, ..._objectionTemplates]
    return tmpl
  },
  update(id: string, payload: Partial<ObjectionTemplate>): ObjectionTemplate | null {
    requireMockData()
    const idx = _objectionTemplates.findIndex((t) => t.id === id)
    if (idx === -1) return null
    const updated = { ..._objectionTemplates[idx], ...payload } as ObjectionTemplate
    _objectionTemplates[idx] = updated
    return updated
  },
  delete(id: string) {
    requireMockData()
    _objectionTemplates = _objectionTemplates.filter((t) => t.id !== id)
    _obligations = _obligations.map((ob) =>
      ob.objection_template_id === id ? { ...ob, objection_template_id: null } : ob
    )
  },
}

// ---------------------------------------------------------------------------
// Deadline Extensions — seeded data
// ---------------------------------------------------------------------------
let _deadlineExtensions: DeadlineExtension[] = isMockDataEnabled ? [
  {
    id: 'ext-001',
    obligation_id: 'ob-001',
    obligation_title: 'ارسال اظهارنامه مالیات عملکرد',
    fiscal_year: '۱۴۰۲',
    extension_type: 'تاریخ ثابت',
    value: '1403/05/31',
    circular_description: 'بخشنامه ۲۰۰/۱۴۰۳ - تمدید مهلت تسلیم اظهارنامه عملکرد اشخاص حقوقی',
    created_at: '2024-02-01T10:00:00Z',
  },
  {
    id: 'ext-002',
    obligation_id: 'ob-002',
    obligation_title: 'ثبت معاملات فصلی (ماده ۱۶۹)',
    fiscal_year: '۱۴۰۳',
    extension_type: 'روزهای اضافه',
    value: '15',
    circular_description: 'دستورالعمل سازمان امور مالیاتی جهت تمدید فصلی بهار',
    created_at: '2024-03-01T10:00:00Z',
  },
] : []

export const mockDeadlineExtensionsDb = {
  getAll(): DeadlineExtension[] {
    return _deadlineExtensions
  },
  insert(payload: Omit<DeadlineExtension, 'id' | 'created_at'>): DeadlineExtension {
    requireMockData()
    const ext: DeadlineExtension = {
      id: 'ext-' + Date.now(),
      ...payload,
      created_at: new Date().toISOString(),
    }
    _deadlineExtensions = [ext, ..._deadlineExtensions]
    return ext
  },
  delete(id: string) {
    requireMockData()
    _deadlineExtensions = _deadlineExtensions.filter((e) => e.id !== id)
  },
}

// ---------------------------------------------------------------------------
// Obligations — seeded with realistic Persian tax data
// ---------------------------------------------------------------------------
let _obligations: Obligation[] = isMockDataEnabled ? [
  {
    id: 'ob-001',
    title: 'تسلیم اظهارنامه مالیات بر عملکرد اشخاص حقوقی',
    obligation_type: 'TAX_CORPORATE',
    recurrence: 'سالانه',
    base_event: 'پایان سال مالی مودی',
    time_gap_value: 4,
    time_gap_unit: 'ماه',
    responsible_party: 'مودی',
    is_active: true,
    phase_group: 'مرحله اظهارنامه',
    sequence_order: 1,
    objection_template_id: 'obj-001',
    penalties: [
      {
        id: 'p-1',
        penalty_type: 'درصدی/روزشمار',
        rate_or_amount: 30,
        calc_unit: 'یکجا',
        calc_base: 'مبلغ اصل مالیات',
        cap_limit: null,
        legal_clause: 'ماده ۱۹۲ ق.م.م - جریمه عدم تسلیم اظهارنامه (۳۰٪ غیرقابل بخشودگی برای اشخاص حقوقی)',
      },
      {
        id: 'p-2',
        penalty_type: 'درصدی/روزشمار',
        rate_or_amount: 2.5,
        calc_unit: 'ماهانه',
        calc_base: 'مبلغ مالیات ابرازی/مطالبه‌شده',
        cap_limit: null,
        legal_clause: 'ماده ۱۹۰ ق.م.م - جریمه تأخیر در پرداخت مالیات ابرازی (۲.۵٪ به ازای هر ماه تأخیر)',
      },
    ],
    workflow_steps: [
      {
        id: 'ws-001-1',
        title: '۱. تکمیل چک‌لیست و بررسی اسناد حسابداری',
        order: 1,
        fields: [
          { id: 'f-101', label: 'تأیید نهایی چک‌لیست و بررسی اسناد حسابداری', key: 'checklist_approved', type: 'checkbox', required: true },
          { id: 'f-102', label: 'تاریخ تکمیل و انطباق اسناد (شمسی)', key: 'verification_date', type: 'date', required: true, placeholder: '1404/04/10' },
          { id: 'f-103', label: 'تصویر/فایل صورت‌جلسه و چک‌لیست حسابرسی', key: 'checklist_file', type: 'file', required: false },
          { id: 'f-104', label: 'ملاحظات اولیه اسناد', key: 'initial_notes', type: 'text', required: false, placeholder: 'توضیحات تکمیلی اسناد...' },
        ],
      },
      {
        id: 'ws-001-2',
        title: '۲. ارسال اظهارنامه و اخذ کد رهگیری',
        order: 2,
        fields: [
          { id: 'f-201', label: 'مبلغ کل فروش / درآمد ابرازی (ریال)', key: 'gross_sales', type: 'text', required: true, placeholder: '۵۰,۰۰۰,۰۰۰,۰۰۰' },
          { id: 'f-202', label: 'درآمد مشمول مالیات (ریال)', key: 'taxable_income', type: 'text', required: true, placeholder: '۱۲,۵۰۰,۰۰۰,۰۰۰' },
          { id: 'f-203', label: 'سود/زیان خالص پس از کسر هزینه‌ها (ریال)', key: 'net_profit', type: 'text', required: false, placeholder: '۱۰,۰۰۰,۰۰۰,۰۰۰' },
          { id: 'f-204', label: 'مبلغ مالیات متعلقه‌ ابرازی (۲۵٪ ریال)', key: 'tax_amount', type: 'text', required: true, placeholder: '۳,۱۲۵,۰۰۰,۰۰۰' },
          { id: 'f-205', label: 'تاریخ تسلیم اظهارنامه در سامانه (شمسی)', key: 'submission_date', type: 'date', required: true, placeholder: '1404/04/28' },
          { id: 'f-206', label: 'کد رهگیری سامانه my.tax.gov.ir', key: 'tracking_number', type: 'text', required: true, placeholder: 'TRK-1404-9812' },
          { id: 'f-207', label: 'تصویر/فایل اظهارنامه تسلیم شده', key: 'tax_return_file', type: 'file', required: false },
        ],
      },
      {
        id: 'ws-001-3',
        title: '۳. پرداخت مالیات ابرازی (ماده ۱۹۰)',
        order: 3,
        fields: [
          { id: 'f-301', label: 'تاریخ پرداخت مالیات (شمسی)', key: 'payment_date', type: 'date', required: true, placeholder: '1404/04/30' },
          { id: 'f-302', label: 'مبلغ واریزی / پرداخت شده (ریال)', key: 'payment_amount', type: 'text', required: true, placeholder: '۳,۱۲۵,۰۰۰,۰۰۰' },
          { id: 'f-303', label: 'شماره فیش / کد ارجاع بانکی', key: 'bank_reference', type: 'text', required: true, placeholder: 'REF-8849201' },
          { id: 'f-304', label: 'تصویر فیش واریزی یا قبض پرداخت', key: 'payment_receipt_file', type: 'file', required: false },
        ],
      },
      {
        id: 'ws-001-4',
        title: '۴. ابلاغ و ثبت برگ تشخیص ممیزی سازمان',
        order: 4,
        fields: [
          { id: 'f-401', label: 'شماره برگ تشخیص صادر شده', key: 'assessment_number', type: 'text', required: true, placeholder: 'AS-1404-7721' },
          { id: 'f-402', label: 'تاریخ ابلاغ واقعی/قانونی (شروع مهلت ۳۰ روزه)', key: 'assessment_notice_date', type: 'date', required: true, placeholder: '1404/08/15' },
          { id: 'f-403', label: 'درآمد مشمول مالیات تشخیصی ممیز (ریال)', key: 'assessed_taxable_income', type: 'text', required: true, placeholder: '۱۵,۰۰۰,۰۰۰,۰۰۰' },
          { id: 'f-404', label: 'مبلغ مالیات تشخیصی سازمان (ریال)', key: 'assessed_tax_amount', type: 'text', required: true, placeholder: '۳,۷۵۰,۰۰۰,۰۰۰' },
          { id: 'f-405', label: 'مابه‌التفاوت مطالبه‌شده نسبت به ابرازی (ریال)', key: 'tax_diff_amount', type: 'text', required: false, placeholder: '۶۲۵,۰۰۰,۰۰۰' },
          { id: 'f-406', label: 'تصویر / فایل برگ تشخیص ابلاغ شده', key: 'assessment_file', type: 'file', required: false },
        ],
      },
      {
        id: 'ws-001-5',
        title: '۵. تعیین تکلیف (تمکین / اعتراض ماده ۲۳۸ / برگ قطعی)',
        order: 5,
        fields: [
          {
            id: 'f-501',
            label: 'تصمیم و مسیر قانونی مودی',
            key: 'decision_type',
            type: 'select',
            required: true,
            options: [
              'تمکین و پذیرش کامل برگ تشخیص (صدور برگ قطعی)',
              'توافق با ممیز کل (ماده ۲۳۸ قانون مالیات‌ها)',
              'عدم توافق و ارجاع به هیأت بدوی حل اختلاف مالیاتی',
              'اعتراض به هیأت تجدیدنظر / ماده ۲۵۱ مکرر',
            ],
          },
          { id: 'f-502', label: 'شماره برگ قطعی / کد ثبتی توافق یا اعتراض', key: 'final_or_objection_number', type: 'text', required: true, placeholder: 'FIN-1404-1002 یا OBJ-1404-8812' },
          { id: 'f-503', label: 'مبلغ مالیات قطعی نهایی (ریال)', key: 'final_tax_amount', type: 'text', required: false, placeholder: '۳,۱۲۵,۰۰۰,۰۰۰' },
          { id: 'f-504', label: 'تاریخ جلسه هیأت / ابلاغ رای یا برگ قطعی', key: 'decision_date', type: 'date', required: false },
          { id: 'f-505', label: 'تصویر برگ قطعی / آرای هیأت یا صورت‌جلسه توافق', key: 'final_notice_file', type: 'file', required: false },
        ],
      },
    ],
    created_at: '2024-01-01T10:00:00Z',
    updated_at: '2024-01-01T10:00:00Z',
  },
  {
    id: 'ob-005',
    title: 'ارسال اظهارنامه و پرداخت مالیات بر ارزش افزوده (فصلی)',
    obligation_type: 'VAT',
    recurrence: 'فصلی (بهار، تابستان، پاییز، زمستان)',
    base_event: 'پایان هر دوره فصلی',
    time_gap_value: 30,
    time_gap_unit: 'روز',
    responsible_party: 'مودی',
    is_active: true,
    phase_group: 'مرحله قبل از اظهارنامه',
    sequence_order: 1,
    objection_template_id: 'obj-003',
    penalties: [
      {
        id: 'p-vat-1',
        penalty_type: 'درصدی/روزشمار',
        rate_or_amount: 50,
        calc_unit: 'یکجا',
        calc_base: 'مبلغ اصل مالیات ارزش افزوده',
        cap_limit: null,
        legal_clause: 'ماده ۳۶ قانون مالیات بر ارزش افزوده - جریمه عدم تسلیم اظهارنامه',
      },
      {
        id: 'p-vat-2',
        penalty_type: 'درصدی/روزشمار',
        rate_or_amount: 2,
        calc_unit: 'ماهانه',
        calc_base: 'مبلغ مالیات پرداخت‌نشده',
        cap_limit: null,
        legal_clause: 'ماده ۳۷ قانون مالیات بر ارزش افزوده - جریمه تأخیر در پرداخت',
      },
    ],
    workflow_steps: [
      { id: 'ws-005-1', title: 'تکمیل چک‌لیست و تطبیق خریدهای فصلی', order: 1 },
      { id: 'ws-005-2', title: 'ارسال اظهارنامه ارزش افزوده در سامانه my.tax.gov.ir و اخذ کد رهگیری', order: 2 },
      { id: 'ws-005-3', title: 'صدور قبوض و پرداخت عوارض و مالیات ارزش افزوده', order: 3 },
    ],
    created_at: '2024-01-04T10:00:00Z',
    updated_at: '2024-01-04T10:00:00Z',
  },
  {
    id: 'ob-006',
    title: 'تسلیم اظهارنامه عملکرد اشخاص حقیقی (مشاغل گروه ۱، ۲ و ۳)',
    obligation_type: 'TAX_INDIVIDUAL',
    recurrence: 'سالانه',
    base_event: 'پایان سال مالی مودی',
    time_gap_value: 3,
    time_gap_unit: 'ماه',
    responsible_party: 'مودی',
    is_active: true,
    phase_group: 'مرحله اظهارنامه',
    sequence_order: 1,
    objection_template_id: 'obj-001',
    penalties: [
      {
        id: 'p-ind-1',
        penalty_type: 'درصدی/روزشمار',
        rate_or_amount: 30,
        calc_unit: 'یکجا',
        calc_base: 'مبلغ مالیات متعلقه',
        cap_limit: null,
        legal_clause: 'ماده ۱۹۲ ق.م.م - جریمه عدم تسلیم اظهارنامه اشخاص حقیقی',
      },
    ],
    workflow_steps: [
      { id: 'ws-006-1', title: 'محاسبه درآمد و فروش سالانه و بررسی شمول تبصره ماده ۱۰۰ ق.م.م', order: 1 },
      { id: 'ws-006-2', title: 'ارسال فرم تبصره ماده ۱۰۰ یا اظهارنامه عادی و اخذ کد رهگیری', order: 2 },
      { id: 'ws-006-3', title: 'پرداخت مالیات مقطوع یا ابرازی (یکجا یا تقسیط)', order: 3 },
    ],
    created_at: '2024-01-05T10:00:00Z',
    updated_at: '2024-01-05T10:00:00Z',
  },
  {
    id: 'ob-007',
    title: 'ارسال لیست و پرداخت مالیات بر درآمد حقوق کارکنان (ماده ۸۶ ق.م.م)',
    obligation_type: 'PAYROLL_TAX',
    recurrence: 'ماهانه',
    base_event: 'پایان ماه شمسی',
    time_gap_value: 30,
    time_gap_unit: 'روز',
    responsible_party: 'مودی',
    is_active: true,
    phase_group: 'مرحله قبل از اظهارنامه',
    sequence_order: 1,
    objection_template_id: 'obj-001',
    penalties: [
      {
        id: 'p-pay-1',
        penalty_type: 'درصدی/روزشمار',
        rate_or_amount: 2,
        calc_unit: 'یکجا',
        calc_base: 'کل حقوق و مزایای پرداختی',
        cap_limit: null,
        legal_clause: 'ماده ۱۹۷ ق.م.م - جریمه عدم تسلیم لیست حقوق کارکنان (۲٪ کل حقوق پرداختی)',
      },
      {
        id: 'p-pay-2',
        penalty_type: 'درصدی/روزشمار',
        rate_or_amount: 2.5,
        calc_unit: 'ماهانه',
        calc_base: 'مبلغ مالیات حقوق پرداخت‌نشده',
        cap_limit: null,
        legal_clause: 'ماده ۱۹۰ ق.م.م - جریمه دیرکرد در پرداخت مالیات حقوق',
      },
    ],
    workflow_steps: [
      { id: 'ws-007-1', title: 'محاسبه جدول حقوق، معافیت‌های قانونی و مالیات مکسوره', order: 1 },
      { id: 'ws-007-2', title: 'بارگذاری فایل و ارسال لیست حقوق در سامane salary.tax.gov.ir', order: 2 },
      { id: 'ws-007-3', title: 'صدور قبض مالیاتی و پرداخت به حساب سازمان', order: 3 },
    ],
    created_at: '2024-01-06T10:00:00Z',
    updated_at: '2024-01-06T10:00:00Z',
  },
  {
    id: 'ob-008',
    title: 'کسر و ایصال مالیات‌های تکلیفی (اجاره، مضاربه و سایر تکالیف)',
    obligation_type: 'TAX_DUTIES',
    recurrence: 'ماهانه',
    base_event: 'پایان ماه شمسی',
    time_gap_value: 30,
    time_gap_unit: 'روز',
    responsible_party: 'مودی',
    is_active: true,
    phase_group: 'مرحله قبل از اظهارنامه',
    sequence_order: 1,
    objection_template_id: 'obj-001',
    penalties: [
      {
        id: 'p-dut-1',
        penalty_type: 'درصدی/روزشمار',
        rate_or_amount: 10,
        calc_unit: 'یکجا',
        calc_base: 'مبلغ مالیات تکلیفی پرداخت‌نشده',
        cap_limit: null,
        legal_clause: 'ماده ۱۹۹ ق.م.م - جریمه عدم کسر یا عدم ایصال مالیات‌های تکلیفی',
      },
    ],
    workflow_steps: [
      { id: 'ws-008-1', title: 'شناسایی و کسر مبالغ مالیات تکلیفی از قراردادها یا اجاره‌بها', order: 1 },
      { id: 'ws-008-2', title: 'ثبت در سامانه پرداخت مالیات تکلیفی و واریز وجه', order: 2 },
    ],
    created_at: '2024-01-07T10:00:00Z',
    updated_at: '2024-01-07T10:00:00Z',
  },
  {
    id: 'ob-009',
    title: 'ارسال فهرست معاملات فصلی موضوع ماده ۱۶۹ مکرر ق.م.م',
    obligation_type: 'CLAIM_169',
    recurrence: 'فصلی',
    base_event: 'پایان دوره فصلی',
    time_gap_value: 45,
    time_gap_unit: 'روز',
    responsible_party: 'مودی',
    is_active: true,
    phase_group: 'مرحله قبل از اظهارنامه',
    sequence_order: 1,
    objection_template_id: 'obj-001',
    penalties: [
      {
        id: 'p-169-1',
        penalty_type: 'درصدی/روزشمار',
        rate_or_amount: 1,
        calc_unit: 'یکجا',
        calc_base: 'مبلغ کل معاملات گزارش‌نشده',
        cap_limit: null,
        legal_clause: 'ماده ۱۶۹ ق.م.م - جریمه عدم ارسال فهرست معاملات و عدم درج شماره اقتصادی (۱٪ کل معامله)',
      },
    ],
    workflow_steps: [
      { id: 'ws-009-1', title: 'تطبیق و راستی‌آزمایی صورتحساب‌های خرید و فروش و اطلاعات طرف‌های معامله', order: 1 },
      { id: 'ws-009-2', title: 'ثبت و ارسال اطلاعات در سامانه ماده ۱۶۹ و دریافت رسید نهایی', order: 2 },
    ],
    created_at: '2024-01-08T10:00:00Z',
    updated_at: '2024-01-08T10:00:00Z',
  },
  {
    id: 'ob-010',
    title: 'ارسال لیست حق بیمه ماهانه کارکنان و پیمان‌ها (ماده ۳۹ قانون تأمین اجتماعی)',
    obligation_type: 'INS_CONTRACT',
    recurrence: 'ماهانه',
    base_event: 'پایان ماه شمسی',
    time_gap_value: 30,
    time_gap_unit: 'روز',
    responsible_party: 'مودی',
    is_active: true,
    phase_group: 'مرحله قبل از اظهارنامه',
    sequence_order: 1,
    objection_template_id: 'obj-001',
    penalties: [
      {
        id: 'p-ins-1',
        penalty_type: 'درصدی/روزشمار',
        rate_or_amount: 10,
        calc_unit: 'یکجا',
        calc_base: 'مبلغ حق بیمه ماهانه',
        cap_limit: null,
        legal_clause: 'ماده ۳۹ و قانون دریافت جرایم نقدی تأمین اجتماعی - جریمه عدم ارسال لیست حق بیمه (۱۰٪)',
      },
      {
        id: 'p-ins-2',
        penalty_type: 'درصدی/روزشمار',
        rate_or_amount: 2,
        calc_unit: 'ماهانه',
        calc_base: 'مبلغ حق بیمه پرداخت‌نشده',
        cap_limit: null,
        legal_clause: 'جریمه تاخیر در پرداخت حق بیمه (۲٪ به ازای هر ماه تاخیر)',
      },
    ],
    workflow_steps: [
      { id: 'ws-010-1', title: 'تنظیم لیست کارکرد و ریز دستمزد پرسنل در نرم‌افزار بیمه', order: 1 },
      { id: 'ws-010-2', title: 'ارسال اینترنتی در سامانه eservices.tamin.ir و اخذ برگ پرداخت', order: 2 },
      { id: 'ws-010-3', title: 'پرداخت برگ پرداخت حق بیمه قبل از پایان مهلت قانونی', order: 3 },
    ],
    created_at: '2024-01-09T10:00:00Z',
    updated_at: '2024-01-09T10:00:00Z',
  },
  {
    id: 'ob-011',
    title: 'حسابرسی بیمه‌ای دفاتر و قراردادها (ماده ۴۷ قانون تأمین اجتماعی)',
    obligation_type: 'INS_AUDIT',
    recurrence: 'سالانه',
    base_event: 'تاریخ ابلاغ برگ/ااختیاریه',
    time_gap_value: 30,
    time_gap_unit: 'روز',
    responsible_party: 'مودی',
    is_active: true,
    phase_group: 'مرحله رسیدگی',
    sequence_order: 1,
    objection_template_id: 'obj-001',
    penalties: [
      {
        id: 'p-ins-audit-1',
        penalty_type: 'درصدی/روزشمار',
        rate_or_amount: 10,
        calc_unit: 'یکجا',
        calc_base: 'مابه‌التفاوت حق بیمه مطالبه‌شده',
        cap_limit: null,
        legal_clause: 'ماده ۴۷ و آیین‌نامه اجرایی حسابرسی دفاتر قانونی تأمین اجتماعی',
      },
    ],
    workflow_steps: [
      { id: 'ws-011-1', title: 'آماده‌سازی تراز کل و معین، اسناد پرداخت دستمزد و قراردادهای پیمانکاری', order: 1 },
      { id: 'ws-011-2', title: 'ارائه اسناد و دفاتر به حسابرسان سازمان تأمین اجتماعی', order: 2 },
      { id: 'ws-011-3', title: 'بررسی برگ مطالبه حق بیمه ناشی از حسابرسی و اعلام نظر/اعتراض', order: 3 },
    ],
    created_at: '2024-01-10T10:00:00Z',
    updated_at: '2024-01-10T10:00:00Z',
  },
] : []

function genId(): string {
  return 'ob-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)
}

export const mockObligationsDb = {
  getAll(type?: string): Obligation[] {
    if (!type) return _obligations.sort((a, b) => b.created_at.localeCompare(a.created_at))
    return _obligations
      .filter((o) => {
        if (o.obligation_type === type) return true
        if (o.obligation_types && o.obligation_types.includes(type)) return true
        return false
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
  },

  updateTemplateAssignments(templateId: string, selectedObligationIds: string[]) {
    requireMockData()
    _obligations = _obligations.map((ob) => {
      if (selectedObligationIds.includes(ob.id)) {
        return { ...ob, objection_template_id: templateId }
      } else if (ob.objection_template_id === templateId) {
        return { ...ob, objection_template_id: null }
      }
      return ob
    })
  },

  getById(id: string): Obligation | undefined {
    return _obligations.find((o) => o.id === id)
  },

  insert(payload: Omit<Obligation, 'id' | 'created_at' | 'updated_at'>): Obligation {
    requireMockData()
    const now = new Date().toISOString()
    const ob: Obligation = { id: genId(), ...payload, created_at: now, updated_at: now }
    _obligations = [ob, ..._obligations]
    return ob
  },

  update(id: string, payload: Partial<Omit<Obligation, 'id' | 'created_at'>>): Obligation | null {
    requireMockData()
    const idx = _obligations.findIndex((o) => o.id === id)
    if (idx === -1) return null
    const existing = _obligations[idx]
    if (!existing) return null
    const updated: Obligation = {
      ...existing,
      ...payload,
      updated_at: new Date().toISOString(),
    }
    _obligations = _obligations.map((o) => (o.id === id ? updated : o))
    return updated
  },

  delete(id: string): boolean {
    requireMockData()
    const initialLen = _obligations.length
    _obligations = _obligations.filter((o) => o.id !== id)
    return _obligations.length < initialLen
  },
}

// ---------------------------------------------------------------------------
// Tenants — seeded per mock user ID
// ---------------------------------------------------------------------------
let _tenants: Tenant[] = isMockDataEnabled ? [
  {
    id: 'tenant-001',
    name: 'شرکت فناوری اطلاعات پارسیان',
    entity_type: 'حقوقی',
    national_id: '10101234567',
    economic_code: '411123456789',
    province: 'تهران',
    created_at: '2024-01-01T10:00:00Z',
  },
  {
    id: 'tenant-002',
    name: 'موسسه حسابداری رضایی',
    entity_type: 'حقوقی',
    national_id: '10861234568',
    economic_code: '411987654321',
    province: 'اصفهان',
    created_at: '2024-01-02T10:00:00Z',
  },
] : []

let _userTenants: UserTenantRow[] = isMockDataEnabled ? [
  { id: 'ut-001', user_id: 'mock-user-00000002', tenant_id: 'tenant-001', role: 'OWNER', created_at: '2024-01-01T10:00:00Z' },
  { id: 'ut-002', user_id: 'mock-user-00000002', tenant_id: 'tenant-002', role: 'OWNER', created_at: '2024-01-02T10:00:00Z' },
] : []

export const mockTenantsDb = {
  getForUser(userId: string): UserTenantWithTenant[] {
    return _userTenants
      .filter((ut) => ut.user_id === userId)
      .map((ut) => ({
        ...ut,
        tenants: _tenants.find((t) => t.id === ut.tenant_id) ?? null,
      }))
  },

  insertTenant(
    payload: Omit<Tenant, 'id' | 'created_at'>,
    userId: string
  ): { tenant: Tenant; userTenant: typeof _userTenants[number] } {
    requireMockData()
    const now = new Date().toISOString()
    const tenant: Tenant = { id: 'tenant-' + Date.now(), ...payload, created_at: now }
    _tenants = [..._tenants, tenant]
    const ut: UserTenantRow = {
      id: 'ut-' + Date.now(),
      user_id: userId,
      tenant_id: tenant.id,
      role: 'OWNER',
      created_at: now,
    }
    _userTenants = [..._userTenants, ut]
    return { tenant, userTenant: ut }
  },
}

// ---------------------------------------------------------------------------
// Tenant Obligation Fulfillments (Evidence / Completion Data)
// ---------------------------------------------------------------------------
let _fulfillments: TenantObligationFulfillment[] = isMockDataEnabled ? [
  // Seeded example: tenant-001 fulfilled book sealing for 1402
  {
    id: 'ful-101',
    tenant_id: 'tenant-001',
    obligation_id: 'ob-002',
    shared_action_key: 'BOOK_SEALING',
    fiscal_year: '1402',
    tracking_number: '98231-PLM',
    fulfillment_date: '1402/12/25',
    fulfilled_at: '2024-03-15T10:00:00Z',
    notes: 'پلمپ دفاتر سال ۱۴۰۲ در اداره ثبت شرکت‌ها انجام و گواهی مربوطه اخذ شد.',
  },
] : []

export const mockFulfillmentsDb = {
  getForTenant(tenantId: string): TenantObligationFulfillment[] {
    return _fulfillments.filter((f) => f.tenant_id === tenantId)
  },

  getByActionOrObligation(
    tenantId: string,
    obligation: Obligation,
    fiscalYear: string
  ): TenantObligationFulfillment | undefined {
    return _fulfillments.find(
      (f) =>
        f.tenant_id === tenantId &&
        f.fiscal_year === fiscalYear &&
        ((obligation.shared_action_key && f.shared_action_key === obligation.shared_action_key) ||
          f.obligation_id === obligation.id)
    )
  },

  saveFulfillment(
    payload: Omit<TenantObligationFulfillment, 'id' | 'fulfilled_at'>
  ): TenantObligationFulfillment {
    requireMockData()
    const existingIdx = _fulfillments.findIndex(
      (f) =>
        f.tenant_id === payload.tenant_id &&
        f.fiscal_year === payload.fiscal_year &&
        ((payload.shared_action_key && f.shared_action_key === payload.shared_action_key) ||
          (payload.obligation_id && f.obligation_id === payload.obligation_id))
    )

    const item: TenantObligationFulfillment = {
      id: 'ful-' + Date.now(),
      ...payload,
      fulfilled_at: new Date().toISOString(),
    }

    if (existingIdx !== -1) {
      _fulfillments[existingIdx] = item
    } else {
      _fulfillments.push(item)
    }

    return item
  },
}

// ---------------------------------------------------------------------------
// Commercial Books & Quarterly Upload Periods (دفاتر تجاری و سامانه)
// ---------------------------------------------------------------------------
let _commercialBookPeriods: CommercialBookPeriod[] = isMockDataEnabled ? [
  {
    id: 'cbp-101',
    fiscal_year: '1404',
    period_type: 'ANNUAL_SEALING',
    title: 'اخذ پلمپ دفاتر قانونی سال مالی ۱۴۰۴ (قبل از شروع سال مالی)',
    statutory_deadline: '1403/12/29',
    extended_deadline: '1404/01/31',
    circular_number: '۲۰۰/۱۴۰۳/۸۵',
    circular_date: '1403/12/28',
    notes: 'تمدید یک‌ماهه مهلت پلمپ دفاتر تجاری سال ۱۴۰۴ طبق بخشنامه سازمان امور مالیاتی.',
    is_active: true,
    created_at: '2025-03-01T00:00:00Z',
  },
  {
    id: 'cbp-102',
    fiscal_year: '1404',
    period_type: 'QUARTERLY',
    title: 'بارگذاری سامانه دفاتر تجاری — ۳ ماهه اول (بهار ۱۴۰۴)',
    statutory_deadline: '1404/05/31',
    extended_deadline: '1405/05/31',
    circular_number: '۲۰۰/۱۴۰۴/۱۲۴',
    circular_date: '1404/05/20',
    notes: 'مهلت بارگذاری صورت‌های مالی و سامانه دفاتر تجاری ناشی از اجرای قانون جدید تا پایان مرداد ۱۴۰۵ تمدید شد.',
    is_active: true,
    created_at: '2025-04-01T00:00:00Z',
  },
  {
    id: 'cbp-103',
    fiscal_year: '1404',
    period_type: 'QUARTERLY',
    title: 'بارگذاری سامانه دفاتر تجاری — ۳ ماهه دوم (تابستان ۱۴۰۴)',
    statutory_deadline: '1404/08/30',
    extended_deadline: null,
    circular_number: null,
    circular_date: null,
    notes: 'بارگذاری اطلاعات اسناد حسابداری و دفاتر اسنادی ۳ ماهه دوم.',
    is_active: true,
    created_at: '2025-04-01T00:00:00Z',
  },
  {
    id: 'cbp-104',
    fiscal_year: '1403',
    period_type: 'SEMI_ANNUAL',
    title: 'بارگذاری سامانه دفاتر تجاری — ۶ ماهه اول ۱۴۰۳',
    statutory_deadline: '1403/08/30',
    extended_deadline: '1404/02/31',
    circular_number: '۲۰۰/۱۴۰۳/۴۲',
    circular_date: '1403/08/15',
    notes: 'تمدید مهلت ارسال و ثبت اطلاعات اسناد دفتر تجاری ۶ ماهه اول سال ۱۴۰۳.',
    is_active: true,
    created_at: '2024-04-01T00:00:00Z',
  },
] : []

export const mockCommercialBooksDb = {
  getAll(fiscalYear?: string): CommercialBookPeriod[] {
    let list = [..._commercialBookPeriods]
    if (fiscalYear) {
      list = list.filter((p) => p.fiscal_year === fiscalYear)
    }
    return list.sort((a, b) => b.statutory_deadline.localeCompare(a.statutory_deadline))
  },

  getById(id: string): CommercialBookPeriod | undefined {
    return _commercialBookPeriods.find((p) => p.id === id)
  },

  create(payload: Omit<CommercialBookPeriod, 'id' | 'created_at'>): CommercialBookPeriod {
    requireMockData()
    const item: CommercialBookPeriod = {
      id: 'cbp-' + Date.now(),
      ...payload,
      created_at: new Date().toISOString(),
    }
    _commercialBookPeriods.unshift(item)
    return item
  },

  update(id: string, payload: Partial<CommercialBookPeriod>): CommercialBookPeriod | null {
    requireMockData()
    const idx = _commercialBookPeriods.findIndex((p) => p.id === id)
    if (idx === -1) return null
    _commercialBookPeriods[idx] = {
      ..._commercialBookPeriods[idx],
      ...payload,
    }
    return _commercialBookPeriods[idx]
  },

  delete(id: string): boolean {
    requireMockData()
    const initialLen = _commercialBookPeriods.length
    _commercialBookPeriods = _commercialBookPeriods.filter((p) => p.id !== id)
    return _commercialBookPeriods.length < initialLen
  },
}

// ---------------------------------------------------------------------------
// Checklists & Wizard Controls (چک‌لیست‌های کنترلی مالیاتی)
// ---------------------------------------------------------------------------
let _checklistTemplates: ChecklistTemplate[] = isMockDataEnabled ? [
  {
    id: 'chk-tax-return-final',
    title: 'چک‌لیست نهایی کنترل و تسلیم اظهارنامه مالیاتی',
    description: 'راهنمای کنترلی، ممیزی و تسلیم اظهارنامه عملکرد سالانه و انطباق با سامانه مؤدیان و دفاتر حسابداری',
    category: 'اظهارنامه عملکرد',
    fiscal_year: '1403',
    is_active: true,
    created_at: '2025-01-01T00:00:00Z',
    sections: [
      {
        id: 'sec-1',
        title: '۱. کنترل اطلاعات سامانه‌ای',
        items: [
          { id: 'item-1-1', code: '۱-۱', title: 'کنترل حساب‌های بانکی تجاری معرفی‌شده', importance: 'HIGH' },
          { id: 'item-1-2', code: '۱-۲', title: 'کنترل حافظه مالیاتی و شناسه‌های یکتای مربوط', importance: 'CONDITIONAL' },
        ],
      },
      {
        id: 'sec-2',
        title: '۲. کنترل تراز و مانده‌های افتتاحیه',
        items: [
          { id: 'item-2-1', code: '۲-۱', title: 'تطبیق مانده‌های افتتاحیه با اظهارنامه و دفاتر سال قبل', importance: 'HIGH' },
          { id: 'item-2-2', code: '۲-۲', title: 'کنترل تساوی جمع بدهکار و بستانکار تراز', importance: 'HIGH' },
        ],
      },
      {
        id: 'sec-3',
        title: '۳. کنترل فروش و درآمد',
        items: [
          { id: 'item-3-1', code: '۳-۱', title: 'تفکیک فروش داخلی، صادراتی و سایر درآمدها', importance: 'HIGH' },
          { id: 'item-3-2', code: '۳-۲', title: 'تطبیق فروش ثبت‌شده در دفاتر با سامانه مؤدیان', importance: 'HIGH' },
          { id: 'item-3-3', code: '۳-۳', title: 'تطبیق فروش با اظهارنامه‌های مالیات بر ارزش افزوده', importance: 'HIGH' },
          { id: 'item-3-4', code: '۳-۴', title: 'تطبیق فروش با گزارش معاملات فصلی، حسب مورد', importance: 'HIGH' },
          { id: 'item-3-5', code: '۳-۵', title: 'تطبیق فروش با مبالغ دریافتی از کارتخوان‌ها و درگاه‌های پرداخت', importance: 'HIGH' },
          { id: 'item-3-6', code: '۳-۶', title: 'تطبیق فروش با واریزی حساب‌های بانکی', importance: 'HIGH' },
          { id: 'item-3-7', code: '۳-۷', title: 'کنترل درآمدهای معاف یا مشمول نرخ صفر', importance: 'CONDITIONAL' },
          { id: 'item-3-8', code: '۳-۸', title: 'تهیه جدول توجیه اختلاف میان فروش دفاتر و اطلاعات مالیاتی', importance: 'SUPPLEMENTARY' },
        ],
      },
      {
        id: 'sec-4',
        title: '۴. کنترل خرید و اسناد مربوط',
        items: [
          { id: 'item-4-1', code: '۴-۱', title: 'تطبیق خریدهای ثبت‌شده در دفاتر با صورتحساب‌های سامانه مؤدیان', importance: 'HIGH' },
          { id: 'item-4-2', code: '۴-۲', title: 'تطبیق خرید با اظهارنامه‌های مالیات بر ارزش افزوده و گزارش معاملات فصلی', importance: 'HIGH' },
          { id: 'item-4-3', code: '۴-۳', title: 'کنترل اسناد خرید، قراردادها و مدارک پرداخت', importance: 'HIGH' },
        ],
      },
      {
        id: 'sec-5',
        title: '۵. کنترل حساب‌های بانکی',
        items: [
          { id: 'item-5-1', code: '۵-۱', title: 'دریافت گردش کامل تمام حساب‌های بانکی مرتبط', importance: 'HIGH' },
          { id: 'item-5-2', code: '۵-۲', title: 'اخذ تأییدیه مانده حساب‌های بانکی در پایان سال مالی', importance: 'HIGH' },
          { id: 'item-5-3', code: '۵-۳', title: 'انجام مغایرت‌گیری ماهانه حساب‌های بانکی', importance: 'HIGH' },
          { id: 'item-5-4', code: '۵-۴', title: 'تطبیق واریزی‌های بانکی با فروش و درآمد', importance: 'HIGH' },
          {
            id: 'item-5-5',
            code: '۵-۵',
            title: 'مستندسازی واریزی‌های غیردرآمدی (وام و تسهیلات، انتقال بین حساب‌ها، آورده مالک/سهامداران، وجوه استردادی، وصول مطالبات، سایر)',
            importance: 'HIGH',
          },
          { id: 'item-5-6', code: '۵-۶', title: 'کنترل حساب‌های ارزی و نحوه تسعیر آن‌ها', importance: 'CONDITIONAL' },
        ],
      },
      {
        id: 'sec-6',
        title: '۶. کنترل استهلاک دارایی‌ها',
        items: [
          { id: 'item-6-1', code: '۶-۱', title: 'محاسبه استهلاک دارایی‌ها طبق مقررات مالیاتی', importance: 'HIGH' },
        ],
      },
      {
        id: 'sec-7',
        title: '۷. کنترل حقوق، بیمه و تکالیف مرتبط',
        items: [
          { id: 'item-7-1', code: '۷-۱', title: 'تطبیق هزینه حقوق ثبت‌شده در دفاتر با لیست حقوق', importance: 'HIGH' },
          { id: 'item-7-2', code: '۷-۲', title: 'تطبیق حقوق و مزایای کارکنان با لیست‌های بیمه', importance: 'HIGH' },
          { id: 'item-7-3', code: '۷-۳', title: 'کنترل ذخیره عیدی، سنوات و مرخصی کارکنان', importance: 'HIGH' },
          { id: 'item-7-4', code: '۷-۴', title: 'بررسی مالیات تکلیفی اجاره', importance: 'CONDITIONAL' },
          { id: 'item-7-5', code: '۷-۵', title: 'بررسی تکالیف مالیاتی قراردادها و پرداخت‌ها', importance: 'CONDITIONAL' },
          { id: 'item-7-6', code: '۷-۶', title: 'بررسی بدهی و مفاصاحساب تأمین اجتماعی پیمان‌ها', importance: 'CONDITIONAL' },
          { id: 'item-7-7', code: '۷-۷', title: 'تهیه جدول تطبیق سالانه حقوق، بیمه، مالیات و دفاتر حسابداری', importance: 'SUPPLEMENTARY' },
        ],
      },
      {
        id: 'sec-8',
        title: '۸. کنترل سامانه مؤدیان و مالیات بر ارزش افزوده',
        items: [
          { id: 'item-8-1', code: '۸-۱', title: 'کنترل تمام صورتحساب‌های فروش صادرشده', importance: 'HIGH' },
          { id: 'item-8-2', code: '۸-۲', title: 'کنترل وضعیت تأیید، رد، ابطال یا برگشت صورتحساب‌ها', importance: 'HIGH' },
          { id: 'item-8-3', code: '۸-۳', title: 'تطبیق فروش ثبت‌شده در سامانه مؤدیان با دفاتر و اظهارنامه عملکرد', importance: 'HIGH' },
          { id: 'item-8-4', code: '۸-۴', title: 'کنترل صورتحساب‌های خرید ثبت‌شده در کارپوشه', importance: 'HIGH' },
          { id: 'item-8-5', code: '۸-۵', title: 'تطبیق مالیات و عوارض ارزش افزوده با حساب‌های مربوط در دفاتر', importance: 'HIGH' },
          { id: 'item-8-6', code: '۸-۶', title: 'کنترل ارسال اظهارنامه‌های مالیات بر ارزش افزوده تمام دوره‌ها', importance: 'HIGH' },
          { id: 'item-8-7', code: '۸-۷', title: 'کنترل پرداخت بدهی مالیات بر ارزش افزوده', importance: 'HIGH' },
          { id: 'item-8-8', code: '۸-۸', title: 'تعیین تکلیف صورتحساب‌های خارج از سامانه یا فاقد اعتبار مالیاتی', importance: 'CONDITIONAL' },
          {
            id: 'item-8-9',
            code: '۸-۹',
            title: 'تهیه جدول مغایرت میان چهار منبع: دفاتر حسابداری، سامانه مؤدیان، اظهارنامه‌های مالیات بر ارزش افزوده، گردش حساب‌های بانکی',
            importance: 'SUPPLEMENTARY',
          },
        ],
      },
    ],
  },
] : []

let _tenantChecklistProgress: TenantChecklistProgress[] = []

export const mockChecklistsDb = {
  getAllTemplates(): ChecklistTemplate[] {
    return [..._checklistTemplates]
  },

  getTemplateById(id: string): ChecklistTemplate | undefined {
    return _checklistTemplates.find((t) => t.id === id)
  },

  createTemplate(payload: Omit<ChecklistTemplate, 'id' | 'created_at'>): ChecklistTemplate {
    requireMockData()
    const item: ChecklistTemplate = {
      id: 'chk-' + Date.now(),
      ...payload,
      created_at: new Date().toISOString(),
    }
    _checklistTemplates.unshift(item)
    return item
  },

  updateTemplate(id: string, payload: Partial<ChecklistTemplate>): ChecklistTemplate | null {
    requireMockData()
    const idx = _checklistTemplates.findIndex((t) => t.id === id)
    if (idx === -1) return null
    _checklistTemplates[idx] = {
      ..._checklistTemplates[idx],
      ...payload,
    }
    return _checklistTemplates[idx]
  },

  deleteTemplate(id: string): boolean {
    requireMockData()
    const initialLen = _checklistTemplates.length
    _checklistTemplates = _checklistTemplates.filter((t) => t.id !== id)
    return _checklistTemplates.length < initialLen
  },

  // Company progress tracking methods
  getTenantProgress(tenantId: string, templateId: string, fiscalYear: string): TenantChecklistProgress {
    requireMockData()
    let existing = _tenantChecklistProgress.find(
      (p) => p.tenant_id === tenantId && p.template_id === templateId && p.fiscal_year === fiscalYear
    )
    if (!existing) {
      existing = {
        id: `tcp-${tenantId}-${templateId}-${fiscalYear}`,
        tenant_id: tenantId,
        template_id: templateId,
        fiscal_year: fiscalYear,
        completed_items: {},
        updated_at: new Date().toISOString(),
      }
      _tenantChecklistProgress.push(existing)
    }
    return existing
  },

  toggleItemProgress(
    tenantId: string,
    templateId: string,
    fiscalYear: string,
    itemId: string,
    notes?: string
  ): TenantChecklistProgress {
    requireMockData()
    const prog = this.getTenantProgress(tenantId, templateId, fiscalYear)
    const current = prog.completed_items[itemId]?.completed || false
    const nextCompleted = !current

    prog.completed_items[itemId] = {
      completed: nextCompleted,
      completed_at: nextCompleted ? new Date().toISOString() : undefined,
      notes: notes ?? prog.completed_items[itemId]?.notes ?? '',
    }
    prog.updated_at = new Date().toISOString()
    return prog
  },

  updateItemNote(
    tenantId: string,
    templateId: string,
    fiscalYear: string,
    itemId: string,
    notes: string
  ): TenantChecklistProgress {
    requireMockData()
    const prog = this.getTenantProgress(tenantId, templateId, fiscalYear)
    const currentCompleted = prog.completed_items[itemId]?.completed || false

    prog.completed_items[itemId] = {
      completed: currentCompleted,
      completed_at: prog.completed_items[itemId]?.completed_at,
      notes,
    }
    prog.updated_at = new Date().toISOString()
    return prog
  },
}

// ---------------------------------------------------------------------------
// Tenant Fiscal Years (تعریف سال مالی شرکت)
// ---------------------------------------------------------------------------
export interface TenantFiscalYear {
  id: string
  tenant_id: string
  title: string // e.g. "سال مالی ۱۴۰۴"
  start_date: string // Jalali date "1404/01/01"
  end_date: string // Jalali date "1404/12/29"
  status: 'ACTIVE' | 'CLOSED' | 'DRAFT'
  created_at: string
}

let _tenantFiscalYears: TenantFiscalYear[] = isMockDataEnabled ? [
  {
    id: 'fy-101',
    tenant_id: 'tenant-001',
    title: 'سال مالی ۱۴۰۴',
    start_date: '1404/01/01',
    end_date: '1404/12/29',
    status: 'ACTIVE',
    created_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 'fy-102',
    tenant_id: 'tenant-001',
    title: 'سال مالی ۱۴۰۳',
    start_date: '1403/01/01',
    end_date: '1403/12/29',
    status: 'CLOSED',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'fy-103',
    tenant_id: 'tenant-002',
    title: 'سال مالی ۱۴۰۴',
    start_date: '1404/01/01',
    end_date: '1404/12/29',
    status: 'ACTIVE',
    created_at: '2025-01-01T00:00:00Z',
  },
] : []

export const mockFiscalYearsDb = {
  getForTenant(tenantId: string): TenantFiscalYear[] {
    return _tenantFiscalYears
      .filter((fy) => fy.tenant_id === tenantId)
      .sort((a, b) => b.title.localeCompare(a.title))
  },

  create(payload: Omit<TenantFiscalYear, 'id' | 'created_at'>): TenantFiscalYear {
    requireMockData()
    const item: TenantFiscalYear = {
      id: 'fy-' + Date.now(),
      ...payload,
      created_at: new Date().toISOString(),
    }
    _tenantFiscalYears.unshift(item)
    return item
  },

  update(id: string, payload: Partial<TenantFiscalYear>): TenantFiscalYear | null {
    requireMockData()
    const idx = _tenantFiscalYears.findIndex((fy) => fy.id === id)
    if (idx === -1) return null
    _tenantFiscalYears[idx] = { ..._tenantFiscalYears[idx], ...payload }
    return _tenantFiscalYears[idx]
  },

  delete(id: string): boolean {
    requireMockData()
    const initialLen = _tenantFiscalYears.length
    _tenantFiscalYears = _tenantFiscalYears.filter((fy) => fy.id !== id)
    return _tenantFiscalYears.length < initialLen
  },
}

// ---------------------------------------------------------------------------
// Corporate Tax Filings (مالیات بر عملکرد اشخاص حقوقی)
// ---------------------------------------------------------------------------
export interface CorporateTaxFiling {
  id: string
  tenant_id: string
  fiscal_year: string // title or year e.g. "سال مالی ۱۴۰۴"
  status: string // Admin workflow step title
  tracking_number?: string
  submission_date?: string
  taxable_income?: string
  tax_amount?: string
  notes?: string
  stage_data?: Record<string, Record<string, any>> // stage_id or stage_title -> { field_key: value }
  created_at: string
}

let _corporateTaxFilings: CorporateTaxFiling[] = isMockDataEnabled ? [
  {
    id: 'corp-101',
    tenant_id: 'tenant-001',
    fiscal_year: 'سال مالی ۱۴۰۴',
    status: '۳. پرداخت مالیات ابرازی (ماده ۱۹۰)',
    tracking_number: 'TRK-1404-9812',
    submission_date: '1404/04/28',
    taxable_income: '۱۲,۵۰۰,۰۰۰,۰۰۰ ریال',
    tax_amount: '۳,۱۲۵,۰۰۰,۰۰۰ ریال (۲۵٪)',
    notes: 'اظهارنامه تسلیم شده و مالیات ابرازی پرداخت گردیده است. در انتظار صدور برگ تشخیص سازمان.',
    stage_data: {
      'ws-001-1': { checklist_approved: true, verification_date: '1404/04/10' },
      'ws-001-2': {
        taxable_income: '۱۲,۵۰۰,۰۰۰,۰۰۰ ریال',
        tax_amount: '۳,۱۲۵,۰۰۰,۰۰۰ ریال',
        tracking_number: 'TRK-1404-9812',
        submission_date: '1404/04/28',
      },
      'ws-001-3': {
        payment_date: '1404/04/30',
        payment_amount: '۳,۱۲۵,۰۰۰,۰۰۰ ریال',
        bank_reference: 'REF-77491023',
      },
      'ws-001-4': {
        assessment_number: 'AS-1404-7721',
        assessment_notice_date: '1404/08/15',
        assessed_taxable_income: '۱۵,۰۰۰,۰۰۰,۰۰۰ ریال',
        assessed_tax_amount: '۳,۷۵۰,۰۰۰,۰۰۰ ریال',
        tax_diff_amount: '۶۲۵,۰۰۰,۰۰۰ ریال',
      },
      'ws-001-5': {
        decision_type: 'ثبت اعتراض ماده ۲۳۸',
        final_or_objection_number: 'OBJ-1404-8812',
        final_tax_amount: '۳,۳۰۰,۰۰۰,۰۰۰ ریال',
      },
    },
    created_at: '2025-04-01T00:00:00Z',
  },
  {
    id: 'corp-102',
    tenant_id: 'tenant-001',
    fiscal_year: 'سال مالی ۱۴۰۳',
    status: '۴. ابلاغ و ثبت برگ تشخیص ممیزی سازمان',
    tracking_number: 'TRK-1403-4410',
    submission_date: '1403/04/28',
    taxable_income: '۸,۴۰۰,۰۰۰,۰۰۰ ریال',
    tax_amount: '۲,۱۰۰,۰۰۰,۰۰۰ ریال',
    notes: 'برگ تشخیص ممیزی صادر گردیده و مابه‌التفاوت ابلاغ شده است. مهلت ۳۰ روزه جهت اعتراض در جریان است.',
    stage_data: {
      'ws-001-1': { checklist_approved: true, verification_date: '1403/04/12' },
      'ws-001-2': {
        taxable_income: '۸,۴۰۰,۰۰۰,۰۰۰ ریال',
        tax_amount: '۲,۱۰۰,۰۰۰,۰۰۰ ریال',
        tracking_number: 'TRK-1403-4410',
        submission_date: '1403/04/28',
      },
      'ws-001-3': {
        payment_date: '1403/04/31',
        payment_amount: '۲,۱۰۰,۰۰۰,۰۰۰ ریال',
        bank_reference: 'REF-66102948',
      },
      'ws-001-4': {
        assessment_number: 'AS-1403-9021',
        assessment_notice_date: '1403/09/20',
        assessed_taxable_income: '۱۰,۰۰۰,۰۰۰,۰۰۰ ریال',
        assessed_tax_amount: '۲,۵۰۰,۰۰۰,۰۰۰ ریال',
        tax_diff_amount: '۴۰۰,۰۰۰,۰۰۰ ریال',
      },
    },
    created_at: '2024-04-01T00:00:00Z',
  },
  {
    id: 'corp-103',
    tenant_id: 'tenant-001',
    fiscal_year: 'سال مالی ۱۴۰۲',
    status: '۵. تعیین تکلیف (تمکین / اعتراض ماده ۲۳۸ / برگ قطعی)',
    tracking_number: 'TRK-1402-1102',
    submission_date: '1402/04/29',
    taxable_income: '۶,۰۰۰,۰۰۰,۰۰۰ ریال',
    tax_amount: '۱,۵۰۰,۰۰۰,۰۰۰ ریال',
    notes: 'پرونده سال مالی ۱۴۰۲ با تمکین مودی و صدور برگ قطعی نهایی مختومه گردید.',
    stage_data: {
      'ws-001-1': { checklist_approved: true, verification_date: '1402/04/15' },
      'ws-001-2': {
        taxable_income: '۶,۰۰۰,۰۰۰,۰۰۰ ریال',
        tax_amount: '۱,۵۰۰,۰۰۰,۰۰۰ ریال',
        tracking_number: 'TRK-1402-1102',
        submission_date: '1402/04/29',
      },
      'ws-001-3': {
        payment_date: '1402/04/31',
        payment_amount: '۱,۵۰۰,۰۰۰,۰۰۰ ریال',
        bank_reference: 'REF-11029384',
      },
      'ws-001-4': {
        assessment_number: 'AS-1402-3321',
        assessment_notice_date: '1402/08/10',
        assessed_taxable_income: '۶,۰۰۰,۰۰۰,۰۰۰ ریال',
        assessed_tax_amount: '۱,۵۰۰,۰۰۰,۰۰۰ ریال',
        tax_diff_amount: '۰ ریال',
      },
      'ws-001-5': {
        decision_type: 'تمکین و دریافت برگ قطعی',
        final_or_objection_number: 'FIN-1402-9901',
        final_tax_amount: '۱,۵۰۰,۰۰۰,۰۰۰ ریال',
      },
    },
    created_at: '2023-04-01T00:00:00Z',
  },
] : []

export const mockCorporateTaxDb = {
  getForTenant(tenantId: string): CorporateTaxFiling[] {
    return _corporateTaxFilings
      .filter((c) => c.tenant_id === tenantId)
      .sort((a, b) => b.fiscal_year.localeCompare(a.fiscal_year))
  },

  create(payload: Omit<CorporateTaxFiling, 'id' | 'created_at'>): CorporateTaxFiling {
    requireMockData()
    const item: CorporateTaxFiling = {
      id: 'corp-' + Date.now(),
      ...payload,
      created_at: new Date().toISOString(),
    }
    _corporateTaxFilings.unshift(item)
    return item
  },

  update(id: string, payload: Partial<CorporateTaxFiling>): CorporateTaxFiling | null {
    requireMockData()
    const idx = _corporateTaxFilings.findIndex((c) => c.id === id)
    if (idx === -1) return null
    _corporateTaxFilings[idx] = { ..._corporateTaxFilings[idx], ...payload }
    return _corporateTaxFilings[idx]
  },

  delete(id: string): boolean {
    requireMockData()
    const initialLen = _corporateTaxFilings.length
    _corporateTaxFilings = _corporateTaxFilings.filter((c) => c.id !== id)
    return _corporateTaxFilings.length < initialLen
  },
}

// ---------------------------------------------------------------------------
// VAT Tax Filings (مالیات بر ارزش افزوده)
// ---------------------------------------------------------------------------
export interface VatTaxFiling {
  id: string
  tenant_id: string
  fiscal_year_period: string // e.g. "سال مالی ۱۴۰۴ - دوره بهار"
  status: string // Admin workflow step title
  tracking_number?: string
  submission_date?: string
  vat_payable?: string
  notes?: string
  created_at: string
}

let _vatTaxFilings: VatTaxFiling[] = isMockDataEnabled ? [
  {
    id: 'vat-101',
    tenant_id: 'tenant-001',
    fiscal_year_period: 'سال مالی ۱۴۰۴ - دوره بهار (سه ماهه اول)',
    status: '۱. تکمیل چک‌لیست و تطبیق خریدهای فصلی',
    tracking_number: 'VAT-1404-01-881',
    submission_date: '1404/04/25',
    vat_payable: '۴۵۰,۰۰۰,۰۰۰ ریال (۱۰٪)',
    notes: 'صورتحساب‌های الکترونیکی سامانه مؤدیان با لیست اعتبار خریدهای فصلی تطبیق داده شد.',
    created_at: '2025-04-01T00:00:00Z',
  },
  {
    id: 'vat-102',
    tenant_id: 'tenant-001',
    fiscal_year_period: 'سال مالی ۱۴۰۳ - دوره زمستان (سه ماهه چهارم)',
    status: '۳. صدور قبوض و پرداخت عوارض و مالیات ارزش افزوده',
    tracking_number: 'VAT-1403-04-990',
    submission_date: '1404/01/28',
    vat_payable: '۳۲۰,۰۰۰,۰۰۰ ریال',
    notes: 'قبض عوارض شهرداری و ارزش افزوده پرداخت گردید.',
    created_at: '2025-01-01T00:00:00Z',
  },
] : []

export const mockVatTaxDb = {
  getForTenant(tenantId: string): VatTaxFiling[] {
    return _vatTaxFilings
      .filter((v) => v.tenant_id === tenantId)
      .sort((a, b) => b.fiscal_year_period.localeCompare(a.fiscal_year_period))
  },

  create(payload: Omit<VatTaxFiling, 'id' | 'created_at'>): VatTaxFiling {
    requireMockData()
    const item: VatTaxFiling = {
      id: 'vat-' + Date.now(),
      ...payload,
      created_at: new Date().toISOString(),
    }
    _vatTaxFilings.unshift(item)
    return item
  },

  update(id: string, payload: Partial<VatTaxFiling>): VatTaxFiling | null {
    requireMockData()
    const idx = _vatTaxFilings.findIndex((v) => v.id === id)
    if (idx === -1) return null
    _vatTaxFilings[idx] = { ..._vatTaxFilings[idx], ...payload }
    return _vatTaxFilings[idx]
  },

  delete(id: string): boolean {
    requireMockData()
    const initialLen = _vatTaxFilings.length
    _vatTaxFilings = _vatTaxFilings.filter((v) => v.id !== id)
    return _vatTaxFilings.length < initialLen
  },
}

// ---------------------------------------------------------------------------
// Compliance Studio — Obligation Families, Obligations, Versions, Rules, Workflows
// Seeded for "مالیات بر عملکرد اشخاص حقوقی" (Corporate Income Tax)
// ---------------------------------------------------------------------------
export interface MockObligationFamily {
  id: string
  code: string
  title: string
  domain: string
  description: string | null
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface MockObligation {
  id: string
  family_id: string
  code: string
  title: string
  summary: string | null
  authority_name: string | null
  official_action_url: string | null
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface MockObligationVersion {
  id: string
  obligation_id: string
  version_number: number
  status: string
  legal_reference: string | null
  source_url: string | null
  audience_summary: string | null
  effective_from: string | null
  effective_to: string | null
  recurrence_rule: any
  deadline_rule: any
  penalty_rule: any
  published_at: string | null
  published_by: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface MockEligibilityRuleSet {
  id: string
  obligation_version_id: string
  priority: number
  title: string
  outcome: string
  explanation: string
  created_at: string
}

export interface MockEligibilityCondition {
  id: string
  rule_set_id: string
  sequence: number
  fact_key: string
  operator: string
  expected_value: any
  created_at: string
}

export interface MockWorkflowTemplate {
  id: string
  obligation_version_id: string
  title: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface MockWorkflowStep {
  id: string
  workflow_template_id: string
  sequence: number
  code: string
  title: string
  actor: string
  instructions: string | null
  form_schema: any
  due_rule?: any
  is_optional: boolean
  created_at: string
}

let _studioFamilies: MockObligationFamily[] = isMockDataEnabled ? [
  {
    id: 'fam-direct-tax',
    code: 'DIRECT_TAX',
    title: 'مالیات‌های مستقیم (قانون مالیات‌های مستقیم)',
    domain: 'TAX',
    description: 'شامل مالیات بر عملکرد اشخاص حقوقی و حقیقی، مالیات حقوق و تکالیف فصلی',
    is_active: true,
    created_by: 'system',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'fam-vat-tax',
    code: 'VAT_TAX',
    title: 'مالیات بر ارزش افزوده و پایانه‌های فروشگاهی',
    domain: 'TAX',
    description: 'تعهدات دوره‌ای ارزش افزوده و صدور صورتحساب‌های الکترونیکی سامانه مؤدیان',
    is_active: true,
    created_by: 'system',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'fam-insurance',
    code: 'SSO_INSURANCE',
    title: 'بیمه و تأمین اجتماعی',
    domain: 'INSURANCE',
    description: 'تکالیف ارسال لیست ماهانه حق بیمه کارکنان و مفاصاحساب قراردادهای پیمانکاری',
    is_active: true,
    created_by: 'system',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
] : []

let _studioObligations: MockObligation[] = isMockDataEnabled ? [
  {
    id: 'ob-corp-tax',
    family_id: 'fam-direct-tax',
    code: 'A101',
    title: 'مالیات بر عملکرد اشخاص حقوقی (ماده ۱۱۰ ق.م.م)',
    summary: 'تکلیف سالانه تسلیم اظهارنامه، ترازنامه، حساب سود و زیان و انطباق با سامانه مؤدیان و دفاتر قانونی برای تمامی شرکت‌ها و اشخاص حقوقی ظرف ۴ ماه پس از پایان سال مالی',
    authority_name: 'سازمان امور مالیاتی کشور',
    official_action_url: 'https://my.tax.gov.ir',
    is_active: true,
    created_by: 'system',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'ob-vat-return',
    family_id: 'fam-vat-tax',
    code: 'VAT_QUARTERLY_RETURN',
    title: 'اظهارنامه فصلی مالیات بر ارزش افزوده و تطبیق صورتحساب‌ها',
    summary: 'تسلیم و پرداخت فصلی عوارض و مالیات بر ارزش افزوده دوره‌های بهار، تابستان، پاییز و زمستان',
    authority_name: 'سازمان امور مالیاتی کشور',
    official_action_url: 'https://my.tax.gov.ir',
    is_active: true,
    created_by: 'system',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
  },
  {
    id: 'ob-salary-tax',
    family_id: 'fam-direct-tax',
    code: 'SALARY_TAX_MONTHLY',
    title: 'لیست ماهانه مالیات بر درآمد حقوق کارکنان (ماده ۸۶ ق.م.م)',
    summary: 'محاسبه و کسر مالیات حقوق پرسنل و تسلیم ماهانه لیست در سامانه salary.tax.gov.ir تا پایان ماه بعد',
    authority_name: 'سازمان امور مالیاتی کشور',
    official_action_url: 'https://salary.tax.gov.ir',
    is_active: true,
    created_by: 'system',
    created_at: '2024-01-03T00:00:00Z',
    updated_at: '2024-01-03T00:00:00Z',
  },
] : []

let _studioVersions: MockObligationVersion[] = isMockDataEnabled ? [
  {
    id: 'ver-corp-tax-1403',
    obligation_id: 'ob-corp-tax',
    version_number: 1,
    status: 'PUBLISHED',
    legal_reference: 'ماده ۱۱۰، ۱۹۲، ۱۹۰ و ۱۴۶ مکرر قانون مالیات‌های مستقیم مصوب ۱۳۶۶ با آخرین اصلاحات',
    source_url: 'https://tax.gov.ir/pages/action/showcontent?id=110',
    audience_summary: 'تمامی اشخاص حقوقی تجاری و غیرتجاری ثبت‌شده در ایران با سال مالی منتهی به اسفند یا سال مالی خاص',
    effective_from: '2024-03-20',
    effective_to: null,
    recurrence_rule: { frequency: 'YEARLY', statutory_month: 4, statutory_day: 31 },
    deadline_rule: { base: 'FISCAL_YEAR_END', gap_months: 4 },
    penalty_rule: {
      type: 'PERCENTAGE',
      rate_percent: 30,
      description: 'جریمه غیرقابل بخشودگی ۳۰٪ عدم تسلیم اظهارنامه (ماده ۱۹۲ ق.م.م) + جریمه ۲.۵٪ دیرکرد ماهانه پرداخت (ماده ۱۹۰ ق.م.م)',
    },
    published_at: '2024-03-20T00:00:00Z',
    published_by: 'مدیر ارشد سامانه',
    created_by: 'system',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-03-20T00:00:00Z',
  },
  {
    id: 'ver-corp-tax-1404',
    obligation_id: 'ob-corp-tax',
    version_number: 2,
    status: 'REVIEW',
    legal_reference: 'دستورالعمل جامع تسلیم اظهارنامه عملکرد سال ۱۴۰۴ با اعمال احکام قانون بودجه و اتصال سیستمی به سامانه مؤدیان',
    source_url: 'https://tax.gov.ir/circulars/1404-corp',
    audience_summary: 'اشخاص حقوقی و شرکت‌های تجاری برای عملکرد دوره مالی ۱۴۰۴',
    effective_from: '2025-03-20',
    effective_to: null,
    recurrence_rule: { frequency: 'YEARLY', statutory_month: 4, statutory_day: 31 },
    deadline_rule: { base: 'FISCAL_YEAR_END', gap_months: 4 },
    penalty_rule: { type: 'PERCENTAGE', rate_percent: 30 },
    published_at: null,
    published_by: null,
    created_by: 'کارشناس ارشد حقوقی و مالیاتی',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-10T00:00:00Z',
  },
  {
    id: 'ver-vat-1403',
    obligation_id: 'ob-vat-return',
    version_number: 1,
    status: 'PUBLISHED',
    legal_reference: 'ماده ۱۳ و ۳۶ و ۳۷ قانون دائمی مالیات بر ارزش افزوده مصوب ۱۴۰۰',
    source_url: 'https://tax.gov.ir/pages/action/showcontent?id=vat-law',
    audience_summary: 'مودیان مشمول نظام مالیات بر ارزش افزوده و اعضای سامانه مؤدیان',
    effective_from: '2024-03-20',
    effective_to: null,
    recurrence_rule: { frequency: 'QUARTERLY', statutory_days_after_quarter: 30 },
    deadline_rule: { base: 'QUARTER_END', gap_days: 30 },
    penalty_rule: { type: 'PERCENTAGE', rate_percent: 50 },
    published_at: '2024-03-20T00:00:00Z',
    published_by: 'مدیر ارشد سامانه',
    created_by: 'system',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-03-20T00:00:00Z',
  },
] : []

let _studioRuleSets: MockEligibilityRuleSet[] = isMockDataEnabled ? [
  {
    id: 'rs-corp-1',
    obligation_version_id: 'ver-corp-tax-1403',
    priority: 1,
    title: 'مشمولیت عام کلیه شرکت‌ها و اشخاص حقوقی ثبت‌شده در ایران',
    outcome: 'ELIGIBLE',
    explanation: 'طبق ماده ۱۱۰ قانون مالیات‌های مستقیم، اشخاص حقوقی مکلفند اظهارنامه و ترازنامه و حساب سود و زیان متکی به دفاتر و اسناد و مدارک خود را حداکثر تا چهار ماه پس از سال مالیاتی تسلیم نمایند.',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'rs-corp-2',
    obligation_version_id: 'ver-corp-tax-1403',
    priority: 2,
    title: 'شرکت‌های دارای معافیت قانونی یا مشمول نرخ صفر (دانش‌بنیان، مناطق آزاد و ماده ۱۳۲)',
    outcome: 'ELIGIBLE',
    explanation: 'طبق تبصره ۱ ماده ۱۴۶ مکرر ق.م.م، برخورداری از هرگونه نرخ صفر و معافیت‌های قانونی منوط به تسلیم به موقع اظهارنامه مالیاتی، دفاتر و اسناد حسابداری است.',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'rs-corp-1404-1',
    obligation_version_id: 'ver-corp-tax-1404',
    priority: 1,
    title: 'مشمولیت اشخاص حقوقی با سال مالی منطبق یا غیرمنطبق با سال شمسی',
    outcome: 'ELIGIBLE',
    explanation: 'الزام تسلیم اظهارنامه الکترونیکی سال ۱۴۰۴ برای کلیه شخصیت‌های حقوقی فعال با بارگذاری صورت‌های مالی استاندارد.',
    created_at: '2025-01-01T00:00:00Z',
  },
] : []

let _studioConditions: MockEligibilityCondition[] = isMockDataEnabled ? [
  {
    id: 'cond-corp-1',
    rule_set_id: 'rs-corp-1',
    sequence: 1,
    fact_key: 'ENTITY_TYPE',
    operator: 'EQ',
    expected_value: 'حقوقی',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'cond-corp-2',
    rule_set_id: 'rs-corp-1',
    sequence: 2,
    fact_key: 'TAX_REGISTRATION_STATUS',
    operator: 'IN',
    expected_value: ['ACTIVE', 'REGISTERED', 'فعال', 'ثبت‌شده'],
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'cond-corp-3',
    rule_set_id: 'rs-corp-2',
    sequence: 1,
    fact_key: 'ENTITY_TYPE',
    operator: 'EQ',
    expected_value: 'حقوقی',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'cond-corp-1404-1',
    rule_set_id: 'rs-corp-1404-1',
    sequence: 1,
    fact_key: 'ENTITY_TYPE',
    operator: 'EQ',
    expected_value: 'حقوقی',
    created_at: '2025-01-01T00:00:00Z',
  },
] : []

let _studioTemplates: MockWorkflowTemplate[] = isMockDataEnabled ? [
  {
    id: 'wt-corp-tax-1403',
    obligation_version_id: 'ver-corp-tax-1403',
    title: 'فرایند ۵ مرحله‌ای تسلیم، رسیدگی، پرداخت و قطعیت مالیات بر عملکرد اشخاص حقوقی',
    created_by: 'system',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'wt-corp-tax-1404',
    obligation_version_id: 'ver-corp-tax-1404',
    title: 'فرایند اظهارنامه عملکرد ۱۴۰۴ با اعتبارسنجی خودکار سامانه مؤدیان',
    created_by: 'system',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
] : []

let _studioSteps: MockWorkflowStep[] = isMockDataEnabled ? [
  {
    id: 'ws-corp-step-1',
    workflow_template_id: 'wt-corp-tax-1403',
    sequence: 1,
    code: 'CLOSE_BOOKS_AND_CHECKLIST',
    title: '۱. بستن حساب‌ها، تحریر و پلمپ دفاتر قانونی و تطبیق صورتحساب‌های سامانه مؤدیان',
    actor: 'USER',
    instructions: 'انجام عملیات پایان سال مالی شامل انطباق کامل گردش حساب‌های بانکی، مبالغ فروش ثبت‌شده با صورتحساب‌های کارپوشه سامانه مؤدیان و تأیید پلمپ دفاتر قانونی.',
    is_optional: false,
    form_schema: {
      fields: [
        { key: 'checklist_approved', label: 'تأیید پلمپ دفاتر و انطباق اسناد حسابداری', type: 'checkbox', required: true },
        { key: 'modyan_sales_reconciliation', label: 'مبلغ کل فروش ثبت‌شده در دفاتر متصل به سامانه مؤدیان (ریال)', type: 'number', required: true },
        { key: 'verification_date', label: 'تاریخ تکمیل چک‌لیست حسابرسی', type: 'date', required: true },
      ],
    },
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'ws-corp-step-2',
    workflow_template_id: 'wt-corp-tax-1403',
    sequence: 2,
    code: 'SUBMIT_CORPORATE_TAX_RETURN',
    title: '۲. بارگذاری صورت‌های مالی، ثبت الکترونیکی اظهارنامه در my.tax.gov.ir و اخذ کد رهگیری',
    actor: 'USER',
    instructions: 'تکمیل جداول ترازنامه، سود و زیان، محاسبه ۲۵٪ مالیات سود مشمول، بارگذاری در درگاه ملی خدمات مالیاتی و دریافت کد رهگیری رسمی.',
    is_optional: false,
    form_schema: {
      fields: [
        { key: 'gross_sales', label: 'مبلغ کل درآمد / فروش ابرازی (ریال)', type: 'number', required: true },
        { key: 'taxable_income', label: 'سود مشمول مالیات ابرازی (ریال)', type: 'number', required: true },
        { key: 'tax_amount', label: 'مبلغ مالیات متعلقه ابرازی (۲۵٪ سود ابرازی - ریال)', type: 'number', required: true },
        { key: 'tracking_number', label: 'کد رهگیری ثبت اظهارنامه در سامانه مالیاتی', type: 'text', required: true },
        { key: 'submission_date', label: 'تاریخ تسلیم اظهارنامه', type: 'date', required: true },
      ],
    },
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'ws-corp-step-3',
    workflow_template_id: 'wt-corp-tax-1403',
    sequence: 3,
    code: 'PAY_DECLARED_TAX',
    title: '۳. پرداخت مالیات ابرازی یا تقسیط قبوض مالیاتی (موضوع ماده ۱۹۰ ق.م.م)',
    actor: 'USER',
    instructions: 'پرداخت به موقع مالیات ابرازی یا تقسیط با اداره کل مربوطه جهت جلوگیری از تعلق جریمه دیرکرد ۲.۵٪ در ماه موضوع ماده ۱۹۰ ق.م.م.',
    is_optional: false,
    form_schema: {
      fields: [
        { key: 'payment_amount', label: 'مبلغ واریزی / پرداخت‌شده (ریال)', type: 'number', required: true },
        { key: 'bank_reference', label: 'شناسه قبض مالیاتی / کد پیگیری بانکی', type: 'text', required: true },
        { key: 'payment_date', label: 'تاریخ واریز وجه', type: 'date', required: true },
      ],
    },
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'ws-corp-step-4',
    workflow_template_id: 'wt-corp-tax-1403',
    sequence: 4,
    code: 'RECORD_ASSESSMENT_NOTICE',
    title: '۴. دریافت و ثبت برگ تشخیص صادره از ممیزی اداره امور مالیاتی',
    actor: 'AUTHORITY',
    instructions: 'ثبت اطلاعات برگ تشخیص ابلاغی سازمان امور مالیاتی و تاریخ ابلاغ واقعی/قانونی جهت شروع مهلت قانونی ۳۰ روزه ماده ۲۳۸.',
    is_optional: false,
    form_schema: {
      fields: [
        { key: 'assessment_number', label: 'شماره برگ تشخیص صادر شده', type: 'text', required: true },
        { key: 'assessed_tax_amount', label: 'مبلغ مالیات تشخیصی سازمان (ریال)', type: 'number', required: true },
        { key: 'assessment_notice_date', label: 'تاریخ ابلاغ واقعی/قانونی برگ تشخیص', type: 'date', required: true },
      ],
    },
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'ws-corp-step-5',
    workflow_template_id: 'wt-corp-tax-1403',
    sequence: 5,
    code: 'FINAL_SETTLEMENT_OR_APPEAL',
    title: '۵. تعیین تکلیف (تمکین و اخذ برگ قطعی / ثبت اعتراض و لایحه ماده ۲۳۸ ق.م.م)',
    actor: 'USER',
    instructions: 'تصمیم‌گیری ظرف مهلت ۳۰ روزه: تمکین و پرداخت برگه تشخیص جهت صدور برگه قطعی، یا ثبت اعتراض در سامانه و تقدیم لایحه دفاعیه ماده ۲۳۸.',
    is_optional: false,
    form_schema: {
      fields: [
        { key: 'decision_type', label: 'اقدام قانونی (تمکین / اعتراض ماده ۲۳۸ / هیأت حل اختلاف)', type: 'text', required: true },
        { key: 'final_or_objection_number', label: 'شماره برگ قطعی یا شماره ثبت لایحه اعتراض', type: 'text', required: true },
        { key: 'final_tax_amount', label: 'مبلغ نهایی مالیات قطعی تسویه‌شده (ریال)', type: 'number', required: false },
      ],
    },
    created_at: '2024-01-01T00:00:00Z',
  },
] : []

export const mockStudioDb = {
  getFamilies(): MockObligationFamily[] {
    return [..._studioFamilies].sort((a, b) => a.title.localeCompare(b.title, 'fa'))
  },

  createFamily(data: { code: string; title: string; domain: string; description?: string | null; is_active?: boolean }): MockObligationFamily {
    requireMockData()
    const family: MockObligationFamily = {
      id: 'fam-' + Date.now(),
      code: data.code.toUpperCase(),
      title: data.title,
      domain: data.domain,
      description: data.description ?? null,
      is_active: data.is_active ?? true,
      created_by: 'admin',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    _studioFamilies.push(family)
    return family
  },

  updateFamily(
    id: string,
    data: { code?: string; title?: string; domain?: string; description?: string | null; is_active?: boolean }
  ): MockObligationFamily | null {
    requireMockData()
    const family = _studioFamilies.find((item) => item.id === id)
    if (!family) return null
    if (data.code !== undefined) family.code = data.code.toUpperCase()
    if (data.title !== undefined) family.title = data.title
    if (data.domain !== undefined) family.domain = data.domain
    if (data.description !== undefined) family.description = data.description
    if (data.is_active !== undefined) family.is_active = data.is_active
    family.updated_at = new Date().toISOString()
    return family
  },

  deleteFamily(familyId: string): { success: boolean; error?: string } {
    requireMockData()
    const linkedObligations = _studioObligations.filter((ob) => ob.family_id === familyId)
    if (linkedObligations.length > 0) {
      return {
        success: false,
        error: `امکان حذف این گروه وجود ندارد زیرا ${linkedObligations.length} تکلیف به آن متصل است.`,
      }
    }
    const initialLength = _studioFamilies.length
    _studioFamilies = _studioFamilies.filter((item) => item.id !== familyId)
    return { success: _studioFamilies.length < initialLength }
  },

  getObligations(): MockObligation[] {
    return [..._studioObligations].sort((a, b) => b.created_at.localeCompare(a.created_at))
  },

  getVersions(): MockObligationVersion[] {
    return [..._studioVersions].sort((a, b) => b.version_number - a.version_number)
  },

  deleteObligation(obligationId: string): boolean {
    requireMockData()
    const versionIds = _studioVersions.filter((version) => version.obligation_id === obligationId).map((version) => version.id)
    const templateIds = _studioTemplates.filter((template) => versionIds.includes(template.obligation_version_id)).map((template) => template.id)
    const ruleIds = _studioRuleSets.filter((rule) => versionIds.includes(rule.obligation_version_id)).map((rule) => rule.id)
    const initialLength = _studioObligations.length
    _studioConditions = _studioConditions.filter((condition) => !ruleIds.includes(condition.rule_set_id))
    _studioRuleSets = _studioRuleSets.filter((rule) => !versionIds.includes(rule.obligation_version_id))
    _studioSteps = _studioSteps.filter((step) => !templateIds.includes(step.workflow_template_id))
    _studioTemplates = _studioTemplates.filter((template) => !versionIds.includes(template.obligation_version_id))
    _studioVersions = _studioVersions.filter((version) => version.obligation_id !== obligationId)
    _studioObligations = _studioObligations.filter((obligation) => obligation.id !== obligationId)
    return _studioObligations.length < initialLength
  },

  updateVersionPenalty(versionId: string, penaltyRule: any): boolean {
    requireMockData()
    const version = _studioVersions.find((item) => item.id === versionId)
    if (!version) return false
    version.penalty_rule = penaltyRule
    version.updated_at = new Date().toISOString()
    return true
  },

  getWorkflowTemplate(versionId: string): MockWorkflowTemplate | undefined {
    return _studioTemplates.find((t) => t.obligation_version_id === versionId)
  },

  getWorkflowSteps(templateId: string): MockWorkflowStep[] {
    return _studioSteps
      .filter((s) => s.workflow_template_id === templateId)
      .sort((a, b) => a.sequence - b.sequence)
  },

  getRuleSets(versionId: string): MockEligibilityRuleSet[] {
    return _studioRuleSets
      .filter((r) => r.obligation_version_id === versionId)
      .sort((a, b) => a.priority - b.priority)
  },

  getConditions(ruleSetId: string): MockEligibilityCondition[] {
    return _studioConditions
      .filter((c) => c.rule_set_id === ruleSetId)
      .sort((a, b) => a.sequence - b.sequence)
  },

  createDraft(params: {
    requested_family_id: string
    requested_code: string
    requested_title: string
    requested_summary?: string
    requested_authority_name?: string
    requested_official_action_url?: string
    requested_legal_reference?: string
    requested_source_url?: string
    requested_effective_from?: string
    requested_recurrence_rule?: any
    requested_deadline_rule?: any
    requested_penalty_rule?: any
  }): { obligation: MockObligation; version: MockObligationVersion } {
    requireMockData()
    let obligation = _studioObligations.find((o) => o.code === params.requested_code)
    if (!obligation) {
      obligation = {
        id: 'ob-' + Date.now(),
        family_id: params.requested_family_id,
        code: params.requested_code,
        title: params.requested_title,
        summary: params.requested_summary ?? null,
        authority_name: params.requested_authority_name ?? null,
        official_action_url: params.requested_official_action_url ?? null,
        is_active: true,
        created_by: 'admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      _studioObligations.unshift(obligation)
    }

    const existingVersions = _studioVersions.filter((v) => v.obligation_id === obligation!.id)
    const nextVersionNum = existingVersions.length > 0 ? Math.max(...existingVersions.map((v) => v.version_number)) + 1 : 1

    const version: MockObligationVersion = {
      id: 'ver-' + Date.now(),
      obligation_id: obligation.id,
      version_number: nextVersionNum,
      status: 'DRAFT',
      legal_reference: params.requested_legal_reference ?? null,
      source_url: params.requested_source_url ?? null,
      audience_summary: null,
      effective_from: params.requested_effective_from ?? null,
      effective_to: null,
      recurrence_rule: params.requested_recurrence_rule ?? {},
      deadline_rule: params.requested_deadline_rule ?? {},
      penalty_rule: params.requested_penalty_rule ?? {},
      published_at: null,
      published_by: null,
      created_by: 'admin',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    _studioVersions.unshift(version)

    // Also auto-create a workflow template for this version
    const template: MockWorkflowTemplate = {
      id: 'wt-' + Date.now(),
      obligation_version_id: version.id,
      title: 'فرایند نسخه ' + version.version_number,
      created_by: 'admin',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    _studioTemplates.push(template)

    return { obligation, version }
  },

  transitionVersionStatus(versionId: string, status: string): MockObligationVersion {
    requireMockData()
    let idx = _studioVersions.findIndex((v) => v.id === versionId)
    if (idx === -1) {
      // If version not found by exact ID, find by first match or create placeholder
      const placeholder: MockObligationVersion = {
        id: versionId,
        obligation_id: _studioObligations[0]?.id ?? 'ob-corp-tax',
        version_number: 1,
        status,
        legal_reference: 'ماده ۱۱۰، ۱۹۲، ۱۹۰ و تبصره ۱ ماده ۱۴۶ مکرر قانون مالیات‌های مستقیم',
        source_url: 'https://tax.gov.ir',
        audience_summary: 'کلیه اشخاص حقوقی',
        effective_from: '1403-01-01',
        effective_to: null,
        recurrence_rule: { frequency: 'YEARLY' },
        deadline_rule: { base: 'FISCAL_YEAR_END', gap_months: 4 },
        penalty_rule: { type: 'PERCENTAGE', rate_percent: 30 },
        published_at: null,
        published_by: null,
        created_by: 'admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      _studioVersions.push(placeholder)
      return placeholder
    }
    _studioVersions[idx] = {
      ..._studioVersions[idx],
      status,
      updated_at: new Date().toISOString(),
    }
    return _studioVersions[idx]
  },

  publishVersion(versionId: string): MockObligationVersion {
    requireMockData()
    let idx = _studioVersions.findIndex((v) => v.id === versionId)
    if (idx === -1) {
      const placeholder: MockObligationVersion = {
        id: versionId,
        obligation_id: _studioObligations[0]?.id ?? 'ob-corp-tax',
        version_number: 1,
        status: 'PUBLISHED',
        legal_reference: 'ماده ۱۱۰، ۱۹۲، ۱۹۰ و تبصره ۱ ماده ۱۴۶ مکرر قانون مالیات‌های مستقیم',
        source_url: 'https://tax.gov.ir',
        audience_summary: 'کلیه اشخاص حقوقی',
        effective_from: '1403-01-01',
        effective_to: null,
        recurrence_rule: { frequency: 'YEARLY' },
        deadline_rule: { base: 'FISCAL_YEAR_END', gap_months: 4 },
        penalty_rule: { type: 'PERCENTAGE', rate_percent: 30 },
        published_at: new Date().toISOString(),
        published_by: 'مدیر سامانه',
        created_by: 'admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      _studioVersions.push(placeholder)
      return placeholder
    }
    _studioVersions[idx] = {
      ..._studioVersions[idx],
      status: 'PUBLISHED',
      published_at: new Date().toISOString(),
      published_by: 'مدیر سامانه',
      updated_at: new Date().toISOString(),
    }
    return _studioVersions[idx]
  },

  addRuleSet(data: {
    obligation_version_id: string
    priority: number
    title: string
    outcome: string
    explanation: string
    conditions: Array<{ fact: string; operator: string; expected: any }>
  }): MockEligibilityRuleSet {
    requireMockData()
    const ruleSet: MockEligibilityRuleSet = {
      id: 'rs-' + Date.now(),
      obligation_version_id: data.obligation_version_id,
      priority: data.priority,
      title: data.title,
      outcome: data.outcome,
      explanation: data.explanation,
      created_at: new Date().toISOString(),
    }
    _studioRuleSets.push(ruleSet)

    data.conditions.forEach((c, idx) => {
      _studioConditions.push({
        id: 'cond-' + Date.now() + '-' + idx,
        rule_set_id: ruleSet.id,
        sequence: idx + 1,
        fact_key: c.fact,
        operator: c.operator,
        expected_value: c.expected,
        created_at: new Date().toISOString(),
      })
    })

    return ruleSet
  },

  updateRuleSet(
    ruleId: string,
    data: {
      priority?: number
      title?: string
      outcome?: string
      explanation?: string
      conditions?: Array<{ fact: string; operator: string; expected: any }>
    }
  ): MockEligibilityRuleSet | null {
    requireMockData()
    const idx = _studioRuleSets.findIndex((r) => r.id === ruleId)
    if (idx === -1) return null

    const existing = _studioRuleSets[idx]
    _studioRuleSets[idx] = {
      ...existing,
      priority: data.priority ?? existing.priority,
      title: data.title ?? existing.title,
      outcome: data.outcome ?? existing.outcome,
      explanation: data.explanation ?? existing.explanation,
    }

    if (data.conditions) {
      _studioConditions = _studioConditions.filter((c) => c.rule_set_id !== ruleId)
      data.conditions.forEach((c, cIdx) => {
        _studioConditions.push({
          id: 'cond-' + Date.now() + '-' + cIdx,
          rule_set_id: ruleId,
          sequence: cIdx + 1,
          fact_key: c.fact,
          operator: c.operator,
          expected_value: c.expected,
          created_at: new Date().toISOString(),
        })
      })
    }

    return _studioRuleSets[idx]
  },

  deleteRuleSet(ruleId: string): boolean {
    requireMockData()
    const initialLen = _studioRuleSets.length
    _studioConditions = _studioConditions.filter((c) => c.rule_set_id !== ruleId)
    _studioRuleSets = _studioRuleSets.filter((r) => r.id !== ruleId)
    return _studioRuleSets.length < initialLen
  },

  addWorkflowStep(data: {
    obligation_version_id: string
    sequence: number
    code: string
    title: string
    actor: string
    form_schema: any
    instructions?: string
  }): MockWorkflowStep {
    requireMockData()
    let template = _studioTemplates.find((t) => t.obligation_version_id === data.obligation_version_id)
    if (!template) {
      template = {
        id: 'wt-' + Date.now(),
        obligation_version_id: data.obligation_version_id,
        title: 'فرایند تعهد',
        created_by: 'admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      _studioTemplates.push(template)
    }

    const step: MockWorkflowStep = {
      id: 'ws-' + Date.now(),
      workflow_template_id: template.id,
      sequence: data.sequence,
      code: data.code.toUpperCase(),
      title: data.title,
      actor: data.actor,
      instructions: data.instructions ?? null,
      form_schema: data.form_schema,
      is_optional: false,
      created_at: new Date().toISOString(),
    }
    _studioSteps.push(step)
    return step
  },

  updateWorkflowStep(
    stepId: string,
    data: {
      sequence?: number
      code?: string
      title?: string
      actor?: string
      instructions?: string | null
      form_schema?: any
    }
  ): MockWorkflowStep | null {
    requireMockData()
    const idx = _studioSteps.findIndex((s) => s.id === stepId)
    if (idx === -1) return null

    const existing = _studioSteps[idx]
    _studioSteps[idx] = {
      ...existing,
      sequence: data.sequence ?? existing.sequence,
      code: data.code ? data.code.toUpperCase() : existing.code,
      title: data.title ?? existing.title,
      actor: data.actor ?? existing.actor,
      instructions: data.instructions !== undefined ? data.instructions : existing.instructions,
      form_schema: data.form_schema !== undefined ? data.form_schema : existing.form_schema,
    }

    return _studioSteps[idx]
  },

  deleteWorkflowStep(stepId: string): boolean {
    requireMockData()
    const initialLen = _studioSteps.length
    _studioSteps = _studioSteps.filter((s) => s.id !== stepId)
    return _studioSteps.length < initialLen
  },

  getCirculars(): any[] {
    return [
      {
        id: 'circ-1403-corp-01',
        obligation_version_id: 'ver-corp-tax-1403',
        title: 'دستورالعمل اجرایی نحوه تسلیم اظهارنامه مالیات بر عملکرد اشخاص حقوقی و تسهیلات تبصره ۱۰۰',
        circular_number: '۲۰۰/۱۴۰۳/۵۱۰',
        source_url: 'https://tax.gov.ir/pages/action/showcontent?id=110',
        issued_on: '1403-03-15',
        summary: 'تسهیلات ویژه تسلیم الکترونیکی اظهارنامه سال ۱۴۰۲ عملکرد اشخاص حقوقی و بخشودگی جرایم موضوع ماده ۱۹۱ ق.م.م در صورت تسلیم در موعد مقرر قانونی.',
        status: 'PUBLISHED',
        published_at: '1403-03-16T08:00:00Z',
        created_at: '2024-06-05T08:00:00Z',
      },
      {
        id: 'circ-1403-modyan-02',
        obligation_version_id: 'ver-corp-tax-1403',
        title: 'بخشنامه الزامات تطبیق کارپوشه سامانه مؤدیان با اظهارنامه مالیات بر عملکرد',
        circular_number: '۲۰۰/۱۴۰۳/۵۴۲',
        source_url: 'https://modyan.tax.gov.ir',
        issued_on: '1403-04-01',
        summary: 'ضرورت ثبت و نهایی‌سازی کلیه صورتحساب‌های الکترونیکی دوره قبل از بستن حساب‌ها و تسلیم اظهارنامه عملکرد ماده ۱۱۰.',
        status: 'PUBLISHED',
        published_at: '1403-04-02T09:00:00Z',
        created_at: '2024-06-21T09:00:00Z',
      },
    ]
  },

  addCircular(data: any): any {
    return {
      id: 'circ-' + Date.now(),
      obligation_version_id: data.obligation_version_id,
      title: data.title,
      circular_number: data.circular_number || null,
      source_url: data.source_url,
      issued_on: data.issued_on,
      summary: data.summary,
      status: 'DRAFT',
      created_at: new Date().toISOString(),
    }
  },
}
