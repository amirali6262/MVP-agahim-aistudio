import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, Edit2, Save, ArrowRight, ShieldAlert, CheckCircle2, Handshake, FileCheck, Layers, GitBranch, HelpCircle, Hourglass, FileText, User, Building2, Scale, SlidersHorizontal, X, PlusCircle, Sparkles, Copy, CheckSquare, Calendar, FileUp, Hash } from 'lucide-react'
import { Button } from '../../../lib/shadcn/button'
import { Input } from '../../../lib/shadcn/input'
import { Label } from '../../../lib/shadcn/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../lib/shadcn/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../lib/shadcn/table'
import FullScreenDialog from '../../../components/FullScreenDialog'
import KeyRegistryField from '../../../components/KeyRegistryField'
import { findDuplicateRawKey, registerRawScopedKey } from '../../../lib/systemKeys'
import { fetchObjectionTemplates, fetchObligations, createObjectionTemplate, updateObjectionTemplate, deleteObjectionTemplate } from '../../../lib/supabaseDb'
import { supabase, isSupabaseConfigured } from '../../../lib/supabase'
import type { ObjectionTemplate, ObjectionStep, Obligation, ObjectionStepNature, StepActor, WorkflowStepField, TaxTypeOverride } from '../../../lib/supabase'

const DEFAULT_TAX_OVERRIDES: TaxTypeOverride[] = [
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
]
import DeleteGuardModal from '../../../components/DeleteGuardModal'
import ObjectionTimelineModal from '../../../components/ObjectionTimelineModal'
import ObjectionFlowDiagramModal from '../../../components/ObjectionFlowDiagramModal'
import { Workflow } from 'lucide-react'
import { checkObjectionTemplateDependencies, type DependencyCheckResult } from '../../../lib/dependencyChecker'

const BASE_EVENT_OPTIONS = [
  'تاریخ ابلاغ برگ/ااختیاریه',
  'تاریخ ابلاغ برگه تشخیص',
  'تاریخ صدور رای',
  'تاریخ ابلاغ رای بدوی',
  'تاریخ اجرای قرار کارشناسی',
]

const GAP_UNIT_OPTIONS = ['روز', 'ماه']

const STEP_ACTOR_OPTIONS: { value: StepActor; label: string; desc: string }[] = [
  { value: 'TAXPAYER', label: 'مودی مالیاتی', desc: 'اقدام توسط مودی یا وکیل قانونی' },
  { value: 'TAX_AUTHORITY', label: 'سازمان امور مالیاتی / هیأت‌ها', desc: 'اقدام توسط اداره مالیات، ممیز کل، هیأت‌های بدوی/تجدیدنظر/۲۵۱ مکرر' },
  { value: 'COURT_DIVAN', label: 'دیوان عدالت اداری', desc: 'اقدام توسط شعب بدوی/تجدیدنظر دیوان عدالت اداری' },
]

const STEP_NATURE_OPTIONS: { value: ObjectionStepNature; label: string; desc: string }[] = [
  { value: 'MANDATORY', label: 'مرحله اصلی و الزامی', desc: 'گام استاندارد و خطی در فرآیند اعتراض' },
  { value: 'CONDITIONAL_EXPERT', label: 'مرحله مشروط (قرار کارشناسی)', desc: 'فقط در صورت صلاحدید و صدور قرار کارشناسی اجرا می‌شود' },
  { value: 'AGREEMENT_END', label: 'نقطه پایان (توافق با ممیز/هیأت)', desc: 'توافق با ممیز کل یا هیأت (خاتمه و صدور برگ قطعی)' },
  { value: 'SETTLEMENT_END', label: 'نقطه پایان (تمکین و پرداخت)', desc: 'تمکین مودی به رای/تشخیص و پرداخت مالیات' },
  { value: 'EXPIRED_END', label: 'نقطه پایان (انقضای مهلت و برگ قطعی)', desc: 'انقضای مهلت قانونی بدون اقدام و صدور برگ قطعی' },
  { value: 'FINAL_NOTICE_ISSUANCE', label: 'صدور برگه قطعی مالیاتی', desc: 'صدور رسمی برگ قطعی پرونده مالیاتی' },
  { value: 'NEXT_STAGE', label: 'ارسال به مرحله بعد', desc: 'در صورت عدم توافق، پرونده به هیأت بدوی/تجدیدنظر/دیوان ارسال می‌شود' },
]

function renderActorBadge(actor?: StepActor) {
  switch (actor) {
    case 'TAXPAYER':
      return (
        <span className="inline-flex items-center gap-1 bg-emerald-950/80 border border-emerald-700/80 text-emerald-300 text-[11px] font-semibold px-2 py-0.5 rounded-md">
          <User className="w-3 h-3 text-emerald-400" />
          مودی
        </span>
      )
    case 'COURT_DIVAN':
      return (
        <span className="inline-flex items-center gap-1 bg-cyan-950/80 border border-cyan-700/80 text-cyan-300 text-[11px] font-semibold px-2 py-0.5 rounded-md">
          <Scale className="w-3 h-3 text-cyan-400" />
          دیوان عدالت
        </span>
      )
    case 'TAX_AUTHORITY':
    default:
      return (
        <span className="inline-flex items-center gap-1 bg-amber-950/80 border border-amber-700/80 text-amber-300 text-[11px] font-semibold px-2 py-0.5 rounded-md">
          <Building2 className="w-3 h-3 text-amber-400" />
          سازمان مالیاتی
        </span>
      )
  }
}

function renderNatureBadge(nature?: ObjectionStepNature) {
  switch (nature) {
    case 'CONDITIONAL_EXPERT':
      return (
        <span className="inline-flex items-center gap-1 bg-amber-950/80 border border-amber-700/80 text-amber-300 text-[11px] font-semibold px-2 py-0.5 rounded-md">
          <Layers className="w-3 h-3 text-amber-400" />
          مشروط (قرار کارشناسی)
        </span>
      )
    case 'AGREEMENT_END':
      return (
        <span className="inline-flex items-center gap-1 bg-emerald-950/80 border border-emerald-700/80 text-emerald-300 text-[11px] font-semibold px-2 py-0.5 rounded-md">
          <Handshake className="w-3 h-3 text-emerald-400" />
          خاتمه (توافق)
        </span>
      )
    case 'SETTLEMENT_END':
      return (
        <span className="inline-flex items-center gap-1 bg-purple-950/80 border border-purple-700/80 text-purple-300 text-[11px] font-semibold px-2 py-0.5 rounded-md">
          <FileCheck className="w-3 h-3 text-purple-400" />
          خاتمه (تمکین)
        </span>
      )
    case 'EXPIRED_END':
      return (
        <span className="inline-flex items-center gap-1 bg-rose-950/80 border border-rose-700/80 text-rose-300 text-[11px] font-semibold px-2 py-0.5 rounded-md">
          <Hourglass className="w-3 h-3 text-rose-400" />
          انقضای مهلت (برگ قطعی)
        </span>
      )
    case 'FINAL_NOTICE_ISSUANCE':
      return (
        <span className="inline-flex items-center gap-1 bg-blue-950/80 border border-blue-700/80 text-blue-300 text-[11px] font-semibold px-2 py-0.5 rounded-md">
          <FileText className="w-3 h-3 text-blue-400" />
          صدور برگ قطعی
        </span>
      )
    case 'NEXT_STAGE':
      return (
        <span className="inline-flex items-center gap-1 bg-sky-950/80 border border-sky-700/80 text-sky-300 text-[11px] font-semibold px-2 py-0.5 rounded-md">
          <GitBranch className="w-3 h-3 text-sky-400" />
          انتقال به مرحله بعد
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center gap-1 bg-zinc-800 border border-zinc-700 text-zinc-300 text-[11px] font-semibold px-2 py-0.5 rounded-md">
          اصلی / الزامی
        </span>
      )
  }
}

export default function ObjectionTemplatesPage() {
  const [templates, setTemplates] = useState<ObjectionTemplate[]>([])
  const [allObligations, setAllObligations] = useState<Obligation[]>([])
  const [editingTemplate, setEditingTemplate] = useState<ObjectionTemplate | null>(null)
  const [selectedTimelineTemplate, setSelectedTimelineTemplate] = useState<ObjectionTemplate | null>(null)
  const [selectedDiagramTemplate, setSelectedDiagramTemplate] = useState<ObjectionTemplate | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Form State
  const [templateName, setTemplateName] = useState('')
  const [isBaseTemplate, setIsBaseTemplate] = useState(true)
  const [steps, setSteps] = useState<ObjectionStep[]>([])
  const [taxOverrides, setTaxOverrides] = useState<TaxTypeOverride[]>(DEFAULT_TAX_OVERRIDES)
  const [selectedObligationIds, setSelectedObligationIds] = useState<string[]>([])

  // Step Fields Modal State
  const [editingStepForFields, setEditingStepForFields] = useState<ObjectionStep | null>(null)
  const [stepFields, setStepFields] = useState<WorkflowStepField[]>([])

  const handleOpenStepFieldsModal = (step: ObjectionStep) => {
    setEditingStepForFields(step)
    setStepFields(step.fields || [])
  }

  const handleSaveStepFields = () => {
    if (!editingStepForFields) return
    handleUpdateStep(editingStepForFields.id, 'fields', stepFields)
    toast.success('فیلدهای پویا با موفقیت برای این گام ذخیره شدند')
    setEditingStepForFields(null)
  }

  const handleAddFieldToStep = () => {
    const newF: WorkflowStepField = {
      id: 'f-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
      label: 'عنوان فیلد جدید',
      key: 'field_' + Date.now().toString().slice(-4),
      type: 'text',
      required: false,
    }
    setStepFields([...stepFields, newF])
  }

  // Add multiple fields at once (Batch Add)
  const handleAddMultipleFieldsToStep = (count: number = 3) => {
    const newFields: WorkflowStepField[] = Array.from({ length: count }, (_, i) => {
      const idx = stepFields.length + i + 1
      return {
        id: 'f-' + Date.now() + '-' + i + '-' + Math.random().toString(36).slice(2, 5),
        label: `فیلد ورودی شماره ${idx}`,
        key: `field_${idx}_${Date.now().toString().slice(-3)}`,
        type: 'text',
        required: false,
      }
    })
    setStepFields([...stepFields, ...newFields])
    toast.success(`${count} فیلد جدید به لیست افزوده شد`)
  }

  // Add standard tax/objection form field package
  const handleAddStandardFieldPack = (packType: 'assessment' | 'ruling' | 'general') => {
    let presetPack: WorkflowStepField[] = []
    const now = Date.now()

    if (packType === 'assessment') {
      presetPack = [
        {
          id: `f-${now}-1`,
          label: 'شماره برگ تشخیص / ابلاغیه',
          key: 'notice_number',
          type: 'text',
          required: true,
          placeholder: 'مثال: ۱۴۰۴/ب/۹۸۱۲',
        },
        {
          id: `f-${now}-2`,
          label: 'تاریخ ابلاغ قانونی (شمسی)',
          key: 'notice_date',
          type: 'date',
          required: true,
        },
        {
          id: `f-${now}-3`,
          label: 'مبلغ مالیات مورد مطالبه (ریال)',
          key: 'tax_amount_claimed',
          type: 'number',
          required: false,
        },
        {
          id: `f-${now}-4`,
          label: 'تصویر / فایل برگ ابلاغیه',
          key: 'notice_document_file',
          type: 'file',
          required: false,
        },
      ]
    } else if (packType === 'ruling') {
      presetPack = [
        {
          id: `f-${now}-1`,
          label: 'شماره دادنامه / رای صادره',
          key: 'ruling_number',
          type: 'text',
          required: true,
        },
        {
          id: `f-${now}-2`,
          label: 'تاریخ صدور / ابلاغ رای',
          key: 'ruling_date',
          type: 'date',
          required: true,
        },
        {
          id: `f-${now}-3`,
          label: 'نتیجه رای هیأت / مرجع',
          key: 'ruling_result_status',
          type: 'select',
          required: true,
          options: ['تعدیل مالیات', 'رد اعتراض مودی (تایید برگه)', 'نقض و تجدید رسیدگی', 'قرار کارشناسی مجدد'],
        },
        {
          id: `f-${now}-4`,
          label: 'پیوست فایل دادنامه و مستندات',
          key: 'ruling_file',
          type: 'file',
          required: false,
        },
      ]
    } else {
      presetPack = [
        {
          id: `f-${now}-1`,
          label: 'شرح و متن دفاعیه/درخواست',
          key: 'defense_text',
          type: 'text',
          required: true,
        },
        {
          id: `f-${now}-2`,
          label: 'تاریخ اقدام یا ثبت',
          key: 'submission_date',
          type: 'date',
          required: false,
        },
        {
          id: `f-${now}-3`,
          label: 'فایل لایحه اعتراضیه / مدارک',
          key: 'defense_bill_file',
          type: 'file',
          required: false,
        },
      ]
    }

    setStepFields([...stepFields, ...presetPack])
    toast.success(`بسته فیلدهای استاندارد (${presetPack.length} فیلد) اضافه شد`)
  }

  const handleRemoveFieldFromStep = (id: string) => {
    setStepFields(stepFields.filter((f) => f.id !== id))
  }

  const handleUpdateStepField = (id: string, key: keyof WorkflowStepField, val: any) => {
    setStepFields(
      stepFields.map((f) => (f.id === id ? { ...f, [key]: val } : f))
    )
  }

  const handleUpdateTaxOverride = (taxType: string, key: keyof TaxTypeOverride, val: any) => {
    setTaxOverrides((prev) =>
      prev.map((item) => (item.tax_type === taxType ? { ...item, [key]: val } : item))
    )
  }

  const loadData = async () => {
    // Load both user-defined templates and the existing legal-stage catalog.
    // Failure of one source must not prevent the other source from being shown.
    let objectionTemplates: ObjectionTemplate[] = []
    try {
      objectionTemplates = await fetchObjectionTemplates()
    } catch (error) {
      console.warn('[ObjectionTemplatesPage] custom templates:', error)
      toast.error('بارگذاری الگوهای سفارشی انجام نشد؛ مراحل قانونی موجود نمایش داده می‌شوند.')
    }
    let obligations: Obligation[] = []
    try {
      obligations = await fetchObligations()
    } catch (error) {
      console.warn('[ObjectionTemplatesPage] obligations:', error)
    }
    setAllObligations(obligations)

    if (!isSupabaseConfigured) {
      setTemplates(objectionTemplates)
      return
    }

    // When Supabase is configured, also fetch from the independent objection stages table.
    // This query is optional: if the table does not exist or returns no rows,
    // the custom objection templates are still shown.
    try {
      const { data: stages, error: stagesError } = await (supabase as any)
        .from('tax_objection_stages')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true })

      if (stagesError) {
        console.warn('[ObjectionTemplatesPage] tax_objection_stages query error:', stagesError.message)
      }

      if (!stagesError && stages && stages.length > 0) {
        const mappedSteps: ObjectionStep[] = stages.map((s: any) => {
          const formFields: WorkflowStepField[] =
            s.form_schema?.fields?.map((f: any) => ({
              id: f.key || s.id + '-field',
              label: f.label || f.key,
              key: f.key,
              type: f.type || 'text',
              required: f.required ?? false,
              placeholder: f.placeholder,
              options: f.options,
            })) ?? []

          // Map actor role to StepActor
          const actorRole = (s.actor_role_code || '') as string
          let actor: StepActor = 'TAX_AUTHORITY'
          if (actorRole.includes('taxpayer') || actorRole === 'TAXPAYER') actor = 'TAXPAYER'
          else if (actorRole.includes('divan') || actorRole === 'COURT_DIVAN') actor = 'COURT_DIVAN'

          // Map step type to ObjectionStepNature
          let stepNature: ObjectionStepNature = 'MANDATORY'
          const stepType = (s.step_type || '') as string
          if (stepType === 'CONDITIONAL_EXPERT') stepNature = 'CONDITIONAL_EXPERT'
          else if (stepType === 'EXPIRED_END') stepNature = 'EXPIRED_END'
          else if (stepType === 'NEXT_STAGE') stepNature = 'NEXT_STAGE'
          else if (stepType === 'DEADLINE') stepNature = 'MANDATORY'
          else if (stepType === 'OPTIONAL') stepNature = 'MANDATORY'

          return {
            id: s.id,
            title: s.title_fa || s.code,
            base_event: s.base_event || 'تاریخ ابلاغ برگ/اختیاریه',
            gap_value: s.gap_value ?? 30,
            gap_unit: s.gap_unit || 'روز',
            step_nature: stepNature,
            actor,
            note: s.user_guidance_fa || s.description_fa || '',
            fields: formFields,
          }
        })

        // Group by phase_code to create separate templates per phase
        const phaseMap = new Map<string, { title: string; steps: ObjectionStep[] }>()
        for (const s of stages) {
          const phase = s.phase_code || 'PHASE_1'
          if (!phaseMap.has(phase)) {
            const phaseNames: Record<string, string> = {
              PHASE_1: 'فاز ۱: تهیه گزارش و صدور برگ تشخیص',
              PHASE_2: 'فاز ۲: قبول و پرداخت',
              PHASE_3: 'فاز ۳: اعتراض ماده ۲۳۸',
              PHASE_4: 'فاز ۴: پایان مهلت و ارجاع',
              PHASE_5: 'فاز ۵: قطعیت و پرداخت',
            }
            phaseMap.set(phase, { title: phaseNames[phase] || phase, steps: [] })
          }
        }

        for (const step of mappedSteps) {
          const stage = (stages as any[]).find((s: any) => s.id === step.id)
          const phase = (stage?.phase_code || 'PHASE_1')
          phaseMap.get(phase)?.steps.push(step)
        }

        const dbTemplates: ObjectionTemplate[] = Array.from(phaseMap.entries()).map(
          ([phase, { title, steps }]) => ({
            id: `db-phase-${phase}`,
            template_name: title,
            is_base_template: true,
            steps,
            created_at: new Date().toISOString(),
          })
        )

        // Also create one combined template with all steps
        const combinedTemplate: ObjectionTemplate = {
          id: 'db-combined-pit',
          template_name: 'مالیات بر عملکرد ـ از تهیه گزارش رسیدگی تا قطعیت مالیات یا ارجاع به هیأت حل اختلاف مالیاتی بدوی',
          is_base_template: true,
          steps: mappedSteps,
          created_at: new Date().toISOString(),
        }

        setTemplates([combinedTemplate, ...dbTemplates, ...objectionTemplates])
      } else {
        setTemplates(objectionTemplates)
      }
    } catch (error) {
      console.warn('[ObjectionTemplatesPage] legal stages:', error)
      if (objectionTemplates.length === 0) {
        toast.error('بارگذاری مراحل رسیدگی و اعتراضات از پایگاه‌داده انجام نشد.')
      }
      setTemplates(objectionTemplates)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleOpenForm = async (tmpl?: ObjectionTemplate) => {
    const obligations = await fetchObligations()
    setAllObligations(obligations)

    if (tmpl) {
      setEditingTemplate(tmpl)
      setTemplateName(tmpl.template_name)
      setIsBaseTemplate(tmpl.is_base_template ?? true)
      setSteps(tmpl.steps || [])
      setTaxOverrides(tmpl.tax_type_overrides || DEFAULT_TAX_OVERRIDES)
      const linked = obligations
        .filter((o) => o.objection_template_id === tmpl.id)
        .map((o) => o.id)
      setSelectedObligationIds(linked)
      setIsCreating(false)
    } else {
      setEditingTemplate(null)
      setTemplateName('')
      setIsBaseTemplate(true)
      setSteps([
        {
          id: 'step-' + Date.now(),
          title: 'ثبت اعتراض اولیه ماده ۲۳۸',
          base_event: 'تاریخ ابلاغ برگ/ااختیاریه',
          gap_value: 30,
          gap_unit: 'روز',
        },
      ])
      setTaxOverrides(DEFAULT_TAX_OVERRIDES)
      setSelectedObligationIds([])
      setIsCreating(true)
    }
  }

  const handleCloseForm = () => {
    setEditingTemplate(null)
    setIsCreating(false)
    setTemplateName('')
    setSteps([])
    setTaxOverrides(DEFAULT_TAX_OVERRIDES)
    setSelectedObligationIds([])
  }

  const handleAddPresetStep = (nature: ObjectionStepNature) => {
    let preset: Partial<ObjectionStep> = {}
    if (nature === 'CONDITIONAL_EXPERT') {
      preset = {
        title: 'صدور و اجرای قرار کارشناسی (مشروط)',
        base_event: 'تاریخ ابلاغ برگه تشخیص',
        gap_value: 30,
        gap_unit: 'روز',
        step_nature: 'CONDITIONAL_EXPERT',
        actor: 'TAX_AUTHORITY',
        note: 'در صورت صلاحدید ممیز کل یا هیأت جهت بررسی مجدد دفاتر و اسناد صادر می‌شود',
      }
    } else if (nature === 'AGREEMENT_END') {
      preset = {
        title: 'خاتمه پرونده: توافق با ممیز کل / هیأت',
        base_event: 'تاریخ ابلاغ برگه تشخیص',
        gap_value: 30,
        gap_unit: 'روز',
        step_nature: 'AGREEMENT_END',
        actor: 'TAXPAYER',
        note: 'امضای توافق‌نامه و ختم قطعی عملیات رسیدگی به اعتراض',
      }
    } else if (nature === 'SETTLEMENT_END') {
      preset = {
        title: 'خاتمه پرونده: تمکین و پرداخت مالیات',
        base_event: 'تاریخ ابلاغ برگه تشخیص',
        gap_value: 30,
        gap_unit: 'روز',
        step_nature: 'SETTLEMENT_END',
        actor: 'TAXPAYER',
        note: 'پذیرش مأخذ و پرداخت جهت استفاده از بخشودگی جرایم (ماده ۱۹۰)',
      }
    } else if (nature === 'EXPIRED_END') {
      preset = {
        title: 'خاتمه پرونده: انقضای مهلت قانونی و قطعیت برگه',
        base_event: 'تاریخ ابلاغ برگه تشخیص',
        gap_value: 30,
        gap_unit: 'روز',
        step_nature: 'EXPIRED_END',
        actor: 'TAXPAYER',
        note: 'عدم ثبت اعتراض ظرف مهلت مقرر موجب قطعیت مالیات و صدور برگ قطعی می‌گردد',
      }
    } else if (nature === 'FINAL_NOTICE_ISSUANCE') {
      preset = {
        title: 'صدور برگه قطعی مالیاتی',
        base_event: 'تاریخ صدور رای',
        gap_value: 30,
        gap_unit: 'روز',
        step_nature: 'FINAL_NOTICE_ISSUANCE',
        actor: 'TAX_AUTHORITY',
        note: 'صدور برگه قطعی رسمی و ارسال به واحد وصول و اجرا',
      }
    } else if (nature === 'NEXT_STAGE') {
      preset = {
        title: 'عدم توافق/تمکین: ارجاع به هیأت حل اختلاف بدوی',
        base_event: 'تاریخ ابلاغ برگه تشخیص',
        gap_value: 30,
        gap_unit: 'روز',
        step_nature: 'NEXT_STAGE',
        actor: 'TAX_AUTHORITY',
        note: 'ارسال پرونده به هیأت بدوی در صورت عدم تحقق توافق یا تمکین',
      }
    } else {
      preset = {
        title: '',
        base_event: 'تاریخ ابلاغ برگ/ااختیاریه',
        gap_value: 20,
        gap_unit: 'روز',
        step_nature: 'MANDATORY',
        actor: 'TAXPAYER',
        note: '',
      }
    }

    const newStep: ObjectionStep = {
      id: 'step-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
      title: preset.title || '',
      base_event: preset.base_event || 'تاریخ ابلاغ برگ/ااختیاریه',
      gap_value: preset.gap_value ?? 20,
      gap_unit: preset.gap_unit || 'روز',
      step_nature: preset.step_nature || 'MANDATORY',
      note: preset.note || '',
    }

    setSteps((prev) => [...prev, newStep])
  }

  const handleAddStepRow = () => {
    handleAddPresetStep('MANDATORY')
  }

  const handleDeleteStepRow = (id: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== id))
  }

  const handleUpdateStep = (id: string, key: keyof ObjectionStep, value: any) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [key]: value } : s))
    )
  }

  const handleSaveTemplate = async () => {
    if (isSaving) return
    if (!templateName.trim()) {
      toast.error('لطفاً نام الگو را وارد نمایید.')
      return
    }
    if (steps.length === 0) {
      toast.error('حداقل یک مرحله اعتراض باید تعریف شود.')
      return
    }
    for (const step of steps) {
      if (!step.title.trim()) {
        toast.error('عنوان تمام مراحل باید مشخص شود.')
        return
      }
    }
    // Scoped uniqueness: within each objection stage, no duplicate data key.
    for (const step of steps) {
      const dup = findDuplicateRawKey(((step as any).fields ?? []).map((f: any) => f.key))
      if (dup) {
        toast.error(`شناسه کلید داده «${dup}» در مرحله «${step.title}» تکراری است.`)
        return
      }
    }

    setIsSaving(true)
    try {
      const payload = {
        template_name: templateName.trim(),
        steps,
      }
      if (editingTemplate) {
        await updateObjectionTemplate(editingTemplate.id, payload)
      } else {
        await createObjectionTemplate(payload)
      }

      // Best-effort central registration of every scoped raw data key.
      for (const step of steps) {
        for (const f of ((step as any).fields ?? []) as any[]) {
          if (!f.key) continue
          void registerRawScopedKey(
            { module: 'objection', entityType: 'OBJECTION_STEP', scopeType: 'tax_objection_stages', scopeCode: step.title || 'step', scopeId: String((step as any).id ?? editingTemplate?.id ?? ''), titleFa: f.label || '' },
            f.key,
          )
        }
      }

      toast.success('الگوی اعتراض و مراحل آن با موفقیت ذخیره شدند.')
      await loadData()
      handleCloseForm()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'خطای ناشناخته'
      toast.error(`ذخیره الگوی اعتراض انجام نشد: ${message}`)
    } finally {
      setIsSaving(false)
    }
  }

  // Delete Guard State
  const [itemToDelete, setItemToDelete] = useState<ObjectionTemplate | null>(null)
  const [checkResult, setCheckResult] = useState<DependencyCheckResult | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)

  const handleInitiateDeleteTemplate = async (tmpl: ObjectionTemplate) => {
    setItemToDelete(tmpl)
    const res = await checkObjectionTemplateDependencies(tmpl.id)
    setCheckResult(res)
    setDeleteModalOpen(true)
  }

  const handleConfirmDeleteTemplate = async () => {
    if (!itemToDelete) return
    await deleteObjectionTemplate(itemToDelete.id)
    toast.success(`الگوی اعتراض «${itemToDelete.template_name}» با موفقیت حذف شد.`)
    loadData()
    setDeleteModalOpen(false)
    setItemToDelete(null)
  }

  const showForm = isCreating || editingTemplate !== null

  return (
    <div className="p-6 h-full flex flex-col gap-6">
      {/* List Header */}
      {!showForm && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-white text-xl font-bold flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-[#E5A93C]" />
                تعریف مراحل رسیدگی و اعتراضات
              </h2>
              <p className="text-zinc-300 text-sm mt-1">
                تعریف الگوهای فرآیند، فیلدهای پویا و مراحل جامع رسیدگی و اعتراضات مالیاتی
              </p>
            </div>
            <Button
              onClick={() => handleOpenForm()}
              className="bg-[#E5A93C] hover:bg-[#d49a2d] text-[#181614] font-bold gap-2 h-9 shadow-md"
            >
              <Plus className="w-4 h-4" />
              افزودن الگوی جدید
            </Button>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-zinc-800 overflow-hidden flex-1 shadow-md" style={{ background: '#211d1a' }}>
            {templates.length === 0 ? (
              <div className="p-16 text-center flex flex-col items-center gap-3">
                <ShieldAlert className="w-10 h-10 text-zinc-600" />
                <p className="text-zinc-300 font-medium">هیچ الگوی اعتراضی تعریف نشده است.</p>
                <Button onClick={() => handleOpenForm()} className="bg-[#E5A93C] hover:bg-[#d49a2d] text-[#181614] font-bold gap-2">
                  <Plus className="w-4 h-4" />
                  ایجاد اولین الگو
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent bg-zinc-900/50">
                    <TableHead className="text-white font-semibold text-right">نام الگو</TableHead>
                    <TableHead className="text-white font-semibold text-right">تعداد مراحل</TableHead>
                    <TableHead className="text-white font-semibold text-right">روند و مراحل پرونده</TableHead>
                    <TableHead className="text-white font-semibold text-right">تکالیف مرتبط</TableHead>
                    <TableHead className="text-white font-semibold text-right">عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((tmpl) => {
                    const linked = allObligations.filter((o) => o.objection_template_id === tmpl.id)
                    return (
                      <TableRow key={tmpl.id} className="border-zinc-800 hover:bg-zinc-800/50">
                        <TableCell className="text-white font-bold py-4">
                          {tmpl.template_name}
                        </TableCell>
                        <TableCell className="text-[#E5A93C] font-bold py-4">
                          {tmpl.steps?.length ?? 0} مرحله
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedDiagramTemplate(tmpl)}
                              title="نمایش نمودار درختی و گرافیکی روند با تفکیک رنگ مراجع (مودی: قرمز | سازمان: سبز | دیوان: زرد)"
                              className="border-emerald-600/80 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 font-bold text-xs h-9 px-3 gap-1.5 shadow-sm transition-all"
                            >
                              <Workflow className="w-4 h-4 text-emerald-400" />
                              نمودار درختی (Diagram)
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedTimelineTemplate(tmpl)}
                              className="border-amber-700/80 bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 font-bold text-xs h-9 px-3 gap-1.5 shadow-sm transition-all"
                            >
                              <GitBranch className="w-4 h-4 text-amber-400" />
                              مشاهده روندنما (Timeline)
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-zinc-200 text-xs py-4">
                          {linked.length === 0 ? (
                            <span className="text-zinc-500">بدون تکلیف متصل</span>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <span className="text-[#E5A93C] font-bold">{linked.length} تکلیف</span>
                              <span className="text-[11px] text-zinc-300 truncate max-w-xs font-medium">
                                {linked.map((l) => l.title).join(' ، ')}
                              </span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedDiagramTemplate(tmpl)}
                              title="مشاهده نمودار درختی روند"
                              className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/30 h-8 px-2 gap-1 font-medium text-xs"
                            >
                              <Workflow className="w-4 h-4 text-emerald-400" />
                              نمودار
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenForm(tmpl)}
                              className="text-white hover:text-white hover:bg-zinc-800 h-8 gap-1 font-medium"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              ویرایش الگو
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleInitiateDeleteTemplate(tmpl)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-950/30 h-8 gap-1 text-xs"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              حذف الگو
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </>
      )}

      {/* Full-Screen Takeover Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: '#181614' }}>
          <div
            className="sticky top-0 z-10 flex items-center justify-between px-6 h-16 border-b border-zinc-800"
            style={{ background: '#211d1a' }}
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCloseForm}
                className="text-zinc-400 hover:text-zinc-100 transition-colors"
                aria-label="بازگشت"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-zinc-100 font-bold text-base">
                  {editingTemplate ? 'ویرایش الگوی اعتراض' : 'افزودن الگوی اعتراض جدید'}
                </h2>
                <p className="text-zinc-500 text-xs">تعریف مراحل قانونی و زمان‌بندی اعتراضات</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSelectedDiagramTemplate({
                    id: editingTemplate?.id || 'preview',
                    template_name: templateName || 'پیش‌نمایش الگوی اعتراض',
                    steps,
                    created_at: new Date().toISOString(),
                  })
                }}
                className="border-emerald-600/80 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 font-bold text-xs h-9 px-3.5 gap-2 shadow-sm transition-all"
              >
                <Workflow className="w-4 h-4 text-emerald-400" />
                پیش‌نمایش نمودار درختی
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSelectedTimelineTemplate({
                    id: editingTemplate?.id || 'preview',
                    template_name: templateName || 'پیش‌نمایش الگوی اعتراض',
                    steps,
                    created_at: new Date().toISOString(),
                  })
                }}
                className="border-amber-700/80 bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 font-bold text-xs h-9 px-3.5 gap-2 shadow-sm transition-all"
              >
                <GitBranch className="w-4 h-4 text-amber-400" />
                مشاهده روندنما
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseForm}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 h-9"
              >
                انصراف
              </Button>
              <Button
                type="button"
                onClick={handleSaveTemplate}
                disabled={isSaving}
                className="bg-[#E5A93C] hover:bg-[#d49a2d] text-[#181614] font-bold gap-2 h-9 px-6"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'در حال ذخیره...' : 'ذخیره الگو'}
              </Button>
            </div>
          </div>

          <div className="max-w-4xl mx-auto px-6 py-8">
            <div className="rounded-2xl border border-zinc-800 p-6 mb-6" style={{ background: '#141615' }}>
              <div className="mb-6">
                <Label className="text-zinc-300 text-sm mb-2 block">
                  نام الگو <span className="text-red-400">*</span>
                </Label>
                <Input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="مثال: الگوی استاندارد مالیاتی (ماده ۲۳۸)"
                  className="bg-zinc-900 border-zinc-700 text-zinc-100 h-11 text-sm"
                />
              </div>

              <div className="pt-4 border-t border-zinc-800">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div>
                    <h3 className="text-[#E5A93C] font-semibold text-sm">مراحل و گام‌های اعتراض</h3>
                    <p className="text-zinc-400 text-xs mt-0.5">
                      تعریف گام‌های اصلی، گام‌های مشروط (مانند قرار کارشناسی) و نقاط پایان فرآیند (توافق یا تمکین)
                    </p>
                  </div>
                </div>

                {/* Quick Add Presets Bar */}
                <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 mb-4 flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs text-zinc-300 font-bold flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-[#E5A93C]" />
                    افزودن سریع گام:
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddPresetStep('MANDATORY')}
                      className="border-zinc-700 hover:bg-zinc-800 text-zinc-200 text-[11px] h-7 gap-1"
                    >
                      <Plus className="w-3 h-3 text-zinc-400" />
                      گام اصلی
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddPresetStep('CONDITIONAL_EXPERT')}
                      className="border-amber-800/60 bg-amber-950/30 hover:bg-amber-900/50 text-amber-300 text-[11px] h-7 gap-1"
                    >
                      <Layers className="w-3 h-3 text-amber-400" />
                      قرار کارشناسی (مشروط)
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddPresetStep('AGREEMENT_END')}
                      className="border-emerald-800/60 bg-emerald-950/30 hover:bg-emerald-900/50 text-emerald-300 text-[11px] h-7 gap-1"
                    >
                      <Handshake className="w-3 h-3 text-emerald-400" />
                      نقطه پایان: توافق
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddPresetStep('SETTLEMENT_END')}
                      className="border-purple-800/60 bg-purple-950/30 hover:bg-purple-900/50 text-purple-300 text-[11px] h-7 gap-1"
                    >
                      <FileCheck className="w-3 h-3 text-purple-400" />
                      نقطه پایان: تمکین
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddPresetStep('EXPIRED_END')}
                      className="border-rose-800/60 bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 text-[11px] h-7 gap-1"
                    >
                      <Hourglass className="w-3 h-3 text-rose-400" />
                      نقطه پایان: انقضای مهلت
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddPresetStep('FINAL_NOTICE_ISSUANCE')}
                      className="border-blue-800/60 bg-blue-950/30 hover:bg-blue-900/50 text-blue-300 text-[11px] h-7 gap-1"
                    >
                      <FileText className="w-3 h-3 text-blue-400" />
                      صدور برگ قطعی
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddPresetStep('NEXT_STAGE')}
                      className="border-sky-800/60 bg-sky-950/30 hover:bg-sky-900/50 text-sky-300 text-[11px] h-7 gap-1"
                    >
                      <GitBranch className="w-3 h-3 text-sky-400" />
                      ارسال به مرحله بعد
                    </Button>
                  </div>
                </div>

                {/* Steps List Cards */}
                <div className="flex flex-col gap-4">
                  {steps.map((step, index) => {
                    const nature = step.step_nature || 'MANDATORY'
                    const cardBorderColor =
                      nature === 'CONDITIONAL_EXPERT'
                        ? 'border-amber-800/60 bg-amber-950/10'
                        : nature === 'AGREEMENT_END'
                        ? 'border-emerald-800/60 bg-emerald-950/10'
                        : nature === 'SETTLEMENT_END'
                        ? 'border-purple-800/60 bg-purple-950/10'
                        : nature === 'NEXT_STAGE'
                        ? 'border-sky-800/60 bg-sky-950/10'
                        : 'border-zinc-800 bg-zinc-900/60'

                    return (
                      <div
                        key={step.id}
                        className={`rounded-xl border p-4 relative transition-all ${cardBorderColor}`}
                      >
                        <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800/80">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-zinc-300 font-bold text-xs bg-zinc-950 px-2.5 py-1 rounded-md border border-zinc-800">
                              گام #{index + 1}
                            </span>
                            {renderNatureBadge(nature)}
                            {renderActorBadge(step.actor)}
                          </div>

                          {steps.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteStepRow(step.id)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-950/30 h-7 text-xs px-2"
                            >
                              <Trash2 className="w-3.5 h-3.5 ml-1" />
                              حذف گام
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                          {/* ۱. مسئول / مرجع اقدام */}
                          <div className="md:col-span-2 flex flex-col gap-1.5">
                            <Label className="text-zinc-300 text-xs">مرجع / مسئول اقدام</Label>
                            <Select
                              value={step.actor || 'TAXPAYER'}
                              onValueChange={(v) => handleUpdateStep(step.id, 'actor', v)}
                            >
                              <SelectTrigger className="bg-zinc-950 border-zinc-700 text-zinc-100 h-9 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="border-zinc-700" style={{ background: '#1e2020' }}>
                                {STEP_ACTOR_OPTIONS.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value} className="text-zinc-100 focus:bg-zinc-700 text-xs">
                                    <div className="flex flex-col py-0.5">
                                      <span className="font-semibold">{opt.label}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* ۲. ماهیت و نوع گام */}
                          <div className="md:col-span-2 flex flex-col gap-1.5">
                            <Label className="text-zinc-300 text-xs">نوع / ماهیت گام</Label>
                            <Select
                              value={step.step_nature || 'MANDATORY'}
                              onValueChange={(v) => handleUpdateStep(step.id, 'step_nature', v)}
                            >
                              <SelectTrigger className="bg-zinc-950 border-zinc-700 text-zinc-100 h-9 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="border-zinc-700" style={{ background: '#1e2020' }}>
                                {STEP_NATURE_OPTIONS.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value} className="text-zinc-100 focus:bg-zinc-700 text-xs">
                                    <div className="flex flex-col py-0.5">
                                      <span className="font-semibold">{opt.label}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* ۳. عنوان گام */}
                          <div className="md:col-span-2 flex flex-col gap-1.5">
                            <Label className="text-zinc-300 text-xs">عنوان گام</Label>
                            <Input
                              value={step.title}
                              onChange={(e) => handleUpdateStep(step.id, 'title', e.target.value)}
                              placeholder="مثال: ثبت اعتراض اولیه ماده ۲۳۸ یا اجرای قرار کارشناسی"
                              className="bg-zinc-950 border-zinc-700 text-zinc-100 h-9 text-xs"
                            />
                          </div>

                          {/* ۳. رویداد پایه */}
                          <div className="md:col-span-3 flex flex-col gap-1.5">
                            <Label className="text-zinc-300 text-xs">مبنای محاسبه زمان (رویداد پایه)</Label>
                            <Select
                              value={step.base_event}
                              onValueChange={(v) => handleUpdateStep(step.id, 'base_event', v)}
                            >
                              <SelectTrigger className="bg-zinc-950 border-zinc-700 text-zinc-100 h-9 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="border-zinc-700" style={{ background: '#1e2020' }}>
                                {BASE_EVENT_OPTIONS.map((o) => (
                                  <SelectItem key={o} value={o} className="text-zinc-100 focus:bg-zinc-700 text-xs">{o}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* ۴. مقدار مهلت */}
                          <div className="md:col-span-1.5 flex flex-col gap-1.5">
                            <Label className="text-zinc-300 text-xs">مقدار مهلت</Label>
                            <Input
                              type="number"
                              min={0}
                              value={step.gap_value}
                              onChange={(e) =>
                                handleUpdateStep(step.id, 'gap_value', parseInt(e.target.value, 10) || 0)
                              }
                              placeholder="۳۰"
                              className="bg-zinc-950 border-zinc-700 text-zinc-100 h-9 text-xs"
                              dir="ltr"
                            />
                          </div>

                          {/* ۵. واحد مهلت */}
                          <div className="md:col-span-1.5 flex flex-col gap-1.5">
                            <Label className="text-zinc-300 text-xs">واحد مهلت</Label>
                            <Select
                              value={step.gap_unit}
                              onValueChange={(v) => handleUpdateStep(step.id, 'gap_unit', v)}
                            >
                              <SelectTrigger className="bg-zinc-950 border-zinc-700 text-zinc-100 h-9 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="border-zinc-700" style={{ background: '#1e2020' }}>
                                {GAP_UNIT_OPTIONS.map((o) => (
                                  <SelectItem key={o} value={o} className="text-zinc-100 focus:bg-zinc-700 text-xs">{o}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* ۶. توضیحات و راهنمای اجرایی */}
                          <div className="md:col-span-6 flex flex-col gap-1.5 pt-1">
                            <Label className="text-zinc-400 text-[11px] flex items-center gap-1">
                              توضیحات و راهنمای اجرایی این گام (اختیاری)
                            </Label>
                            <Input
                              value={step.note || ''}
                              onChange={(e) => handleUpdateStep(step.id, 'note', e.target.value)}
                              placeholder="مثال: در صورت عدم توافق با ممیز کل یا صدور قرار کارشناسی، این فرم تحویل شود..."
                              className="bg-zinc-950/80 border-zinc-800 text-zinc-300 h-8 text-xs placeholder:text-zinc-600"
                            />
                          </div>

                          {/* ۷. فیلدهای پویا اختصاصی این گام */}
                          <div className="md:col-span-6 flex items-center justify-between pt-2 border-t border-zinc-800/60 mt-1 flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenStepFieldsModal(step)}
                              className="h-8 text-xs border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 gap-1.5 px-3 font-semibold"
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5" />
                              <span>تعریف فیلدهای اختصاصی گام ({step.fields?.length || 0} فیلد)</span>
                            </Button>
                            {step.fields && step.fields.length > 0 && (
                              <span className="text-[11px] text-zinc-400 bg-zinc-950 px-2 py-1 rounded border border-zinc-800">
                                فیلدها: {step.fields.map((f) => f.label).join('، ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* ── بخش بازنویسی الگوی پایه برای انواع مختلف مالیات (Tax-Specific Overrides) ── */}
              <div className="pt-6 mt-6 border-t border-zinc-800 flex flex-col gap-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-purple-300 font-bold text-sm flex items-center gap-2">
                      <Scale className="w-4 h-4 text-purple-400" />
                      تنظیمات بازنویسی و مهلت‌های قانونی بر اساس نوع مالیات (Tax-Specific Overrides)
                    </h3>
                    <p className="text-zinc-400 text-xs mt-0.5">
                      الگوی پایه دادرسی به‌صورت پیش‌فرض برای تمامی پرونده‌ها اعمال می‌شود، اما می‌توانید برای هر نوع مالیات مهلت‌ها، مراجع اختصاصی و ارجاعات قانونی را بازنویسی (Override) نمایید.
                    </p>
                  </div>
                  <span className="text-xs text-purple-300 bg-purple-950/60 border border-purple-800 px-3 py-1 rounded-full font-medium">
                    {taxOverrides.length} نوع مالیات تعریف‌شده
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3.5">
                  {taxOverrides.map((ov) => (
                    <div
                      key={ov.tax_type}
                      className="bg-zinc-950/70 border border-zinc-800/80 hover:border-purple-800/60 rounded-xl p-4 flex flex-col gap-3 transition-colors shadow-xs"
                    >
                      <div className="flex items-center justify-between border-b border-zinc-800/60 pb-2.5 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                          <span className="font-bold text-xs text-zinc-100">{ov.tax_type_title}</span>
                          <span className="font-mono text-[10px] text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                            {ov.tax_type}
                          </span>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                          <input
                            type="checkbox"
                            checked={ov.is_custom_path_active !== false}
                            onChange={(e) =>
                              handleUpdateTaxOverride(ov.tax_type, 'is_custom_path_active', e.target.checked)
                            }
                            className="w-3.5 h-3.5 accent-purple-500 rounded"
                          />
                          <span>فعال‌سازی مسیر و مهلت‌های اختصاصی</span>
                        </label>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="flex flex-col gap-1">
                          <Label className="text-zinc-400 text-[11px]">مهلت قانونی ثبت اعتراض</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={ov.statutory_deadline_override ?? 30}
                              onChange={(e) =>
                                handleUpdateTaxOverride(
                                  ov.tax_type,
                                  'statutory_deadline_override',
                                  parseInt(e.target.value, 10) || 0
                                )
                              }
                              className="bg-zinc-900 border-zinc-700 text-purple-300 font-mono font-bold h-8 text-xs text-center"
                            />
                            <span className="text-zinc-400 text-xs shrink-0">روز</span>
                          </div>
                        </div>

                        <div className="sm:col-span-2 flex flex-col gap-1">
                          <Label className="text-zinc-400 text-[11px]">استناد قانونی اختصاصی</Label>
                          <Input
                            value={ov.legal_reference_override || ''}
                            onChange={(e) =>
                              handleUpdateTaxOverride(ov.tax_type, 'legal_reference_override', e.target.value)
                            }
                            placeholder="مثال: ماده ۳۴ قانون دائمی مالیات بر ارزش افزوده"
                            className="bg-zinc-900 border-zinc-700 text-zinc-200 h-8 text-xs"
                          />
                        </div>

                        <div className="sm:col-span-3 flex flex-col gap-1">
                          <Label className="text-zinc-400 text-[11px]">مرجع و هیأت حل اختلاف تخصصی</Label>
                          <Input
                            value={ov.special_tribunal_name || ''}
                            onChange={(e) =>
                              handleUpdateTaxOverride(ov.tax_type, 'special_tribunal_name', e.target.value)
                            }
                            placeholder="مثال: هیأت تخصصی ارزش افزوده / هیأت ۲۱۶ ق.م.م"
                            className="bg-zinc-900 border-zinc-700 text-zinc-200 h-8 text-xs"
                          />
                        </div>

                        <div className="sm:col-span-3 flex flex-col gap-1">
                          <Label className="text-zinc-400 text-[11px]">نکات و شرایط قانونی رسیدگی</Label>
                          <Input
                            value={ov.notes || ''}
                            onChange={(e) =>
                              handleUpdateTaxOverride(ov.tax_type, 'notes', e.target.value)
                            }
                            placeholder="ملاحظات قانونی، قطعیت خودکار ماده ۱۵۶ یا شرایط خاص..."
                            className="bg-zinc-900 border-zinc-700 text-zinc-300 h-8 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* بخش تکالیف مرتبط */}
              <div className="pt-6 mt-6 border-t border-zinc-800">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div>
                    <h3 className="text-[#E5A93C] font-semibold text-sm">تکالیف مرتبط با این الگوی اعتراض</h3>
                    <p className="text-zinc-500 text-xs mt-0.5">
                      تکالیفی که می‌خواهید از این الگوی اعتراض استفاده نمایند را انتخاب کنید (از تمام منوها):
                    </p>
                  </div>
                  <span className="text-xs text-[#E5A93C] bg-[#E5A93C]/10 border border-[#E5A93C]/30 px-3 py-1 rounded-full font-medium">
                    {selectedObligationIds.length} تکلیف انتخاب‌شده
                  </span>
                </div>

                {allObligations.length === 0 ? (
                  <p className="text-zinc-500 text-xs py-3">هیچ تکلیفی در سیستم تعریف نشده است.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl style-menu">
                    {allObligations.map((ob) => {
                      const isChecked = selectedObligationIds.includes(ob.id)
                      return (
                        <label
                          key={ob.id}
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-[#E5A93C]/10 border-[#E5A93C]/50 text-zinc-100 shadow-sm'
                              : 'bg-zinc-950/50 border-zinc-800/80 text-zinc-400 hover:border-zinc-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedObligationIds((prev) => [...prev, ob.id])
                              } else {
                                setSelectedObligationIds((prev) => prev.filter((id) => id !== ob.id))
                              }
                            }}
                            className="w-4 h-4 rounded border-zinc-700 text-[#E5A93C] focus:ring-[#E5A93C] bg-zinc-900 accent-[#E5A93C]"
                          />
                          <div className="flex-1 text-xs">
                            <div className="font-semibold text-zinc-200">{ob.title}</div>
                            <div className="text-[11px] text-zinc-500 flex items-center gap-2 mt-1">
                              <span>دوره: {ob.recurrence}</span>
                              {ob.phase_group && <span>• {ob.phase_group}</span>}
                            </div>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Timeline Modal */}
      <ObjectionTimelineModal
        isOpen={selectedTimelineTemplate !== null}
        onClose={() => setSelectedTimelineTemplate(null)}
        template={selectedTimelineTemplate}
        linkedObligations={
          selectedTimelineTemplate
            ? allObligations.filter((o) => o.objection_template_id === selectedTimelineTemplate.id)
            : []
        }
      />

      {/* Tree / Flowchart Diagram Modal */}
      <ObjectionFlowDiagramModal
        isOpen={selectedDiagramTemplate !== null}
        onClose={() => setSelectedDiagramTemplate(null)}
        template={selectedDiagramTemplate}
        linkedObligations={
          selectedDiagramTemplate
            ? allObligations.filter((o) => o.objection_template_id === selectedDiagramTemplate.id)
            : []
        }
      />

      {/* Step Fields Modal */}
      {editingStepForFields && (
        <FullScreenDialog
          open
          title={`تعریف فیلدهای پویا برای ${editingStepForFields.title}`}
          subtitle="این فیلدها در محیط کاربری شرکت هنگام رسیدن به این گام نمایش داده می‌شوند"
          onBack={() => setEditingStepForFields(null)}
          footer={
            <div className="flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditingStepForFields(null)}
                className="text-zinc-400 text-xs h-9"
              >
                انصراف
              </Button>
              <Button
                type="button"
                onClick={handleSaveStepFields}
                className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold text-xs h-9 gap-1.5 px-4"
              >
                <Save className="w-4 h-4" />
                <span>ذخیره فیلدهای این گام</span>
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-4">
              {/* Batch Actions & Quick Templates Header */}
              <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>افزودن سریع و همزمان چند فیلد</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddFieldToStep}
                      className="bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 text-xs h-7 gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+۱ فیلد</span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleAddMultipleFieldsToStep(3)}
                      className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold text-xs h-7 gap-1"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>+۳ فیلد همزمان</span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleAddMultipleFieldsToStep(5)}
                      className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs h-7 gap-1"
                    >
                      <Layers className="w-3.5 h-3.5 text-amber-400" />
                      <span>+۵ فیلد همزمان</span>
                    </Button>
                  </div>
                </div>

                {/* Preset Packages */}
                <div className="flex items-center gap-1.5 pt-2 border-t border-zinc-800/80 flex-wrap text-xs">
                  <span className="text-[11px] text-zinc-400 font-medium ml-1">بسته‌های فیلد آماده:</span>
                  <button
                    type="button"
                    onClick={() => handleAddStandardFieldPack('assessment')}
                    className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-amber-950/60 border border-zinc-700 hover:border-amber-500/60 text-zinc-300 hover:text-amber-300 text-[11px] font-medium transition-colors flex items-center gap-1"
                  >
                    <FileText className="w-3 h-3 text-amber-400" />
                    <span>بسته برگ تشخیص (۴ فیلد)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddStandardFieldPack('ruling')}
                    className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-sky-950/60 border border-zinc-700 hover:border-sky-500/60 text-zinc-300 hover:text-sky-300 text-[11px] font-medium transition-colors flex items-center gap-1"
                  >
                    <Scale className="w-3 h-3 text-sky-400" />
                    <span>بسته رای هیأت / دادنامه (۴ فیلد)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddStandardFieldPack('general')}
                    className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-emerald-950/60 border border-zinc-700 hover:border-emerald-500/60 text-zinc-300 hover:text-emerald-300 text-[11px] font-medium transition-colors flex items-center gap-1"
                  >
                    <CheckSquare className="w-3 h-3 text-emerald-400" />
                    <span>بسته لایحه و دفاعیه (۳ فیلد)</span>
                  </button>
                </div>
              </div>

              {stepFields.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-900/30 text-zinc-500 text-xs flex flex-col items-center gap-2">
                  <SlidersHorizontal className="w-8 h-8 text-zinc-600" />
                  <span>هیچ فیلد پویایی برای این گام تعریف نشده است.</span>
                  <span className="text-zinc-400 text-[11px]">جهت اضافه کردن سریع، از دکمه‌های «+۳ فیلد همزمان» یا «بسته‌های فیلد آماده» در بالا استفاده نمایید.</span>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
                    <span>لیست فیلدهای تعریف‌شده ({stepFields.length} فیلد):</span>
                    {stepFields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setStepFields([])}
                        className="text-red-400 hover:text-red-300 text-[11px] flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        حذف همه فیلدها
                      </button>
                    )}
                  </div>
                  {stepFields.map((field, idx) => (
                    <div key={field.id} className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/80 flex flex-col gap-3 hover:border-zinc-700 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-amber-400 bg-amber-950/40 border border-amber-800/60 px-2 py-0.5 rounded">
                            فیلد #{idx + 1}
                          </span>
                          <span className="text-xs font-semibold text-zinc-200">
                            {field.label || 'بدون عنوان'}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveFieldFromStep(field.id)}
                          className="h-7 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30"
                        >
                          <Trash2 className="w-3.5 h-3.5 ml-1" />
                          حذف
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="flex flex-col gap-1">
                          <Label className="text-xs text-zinc-300">عنوان فیلد (نمایش به کاربر)</Label>
                          <Input
                            value={field.label}
                            onChange={(e) => handleUpdateStepField(field.id, 'label', e.target.value)}
                            placeholder="مثال: شماره برگ تشخیص"
                            className="bg-zinc-950 border-zinc-700 text-zinc-100 h-8 text-xs"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <Label className="text-xs text-zinc-300">شناسه کلید داده (key)</Label>
                          <KeyRegistryField
                            raw
                            compact
                            title={field.label}
                            entityType="OBJECTION_STEP"
                            module="objection"
                            initialKey={field.key}
                            placeholder="assessment_number"
                            onFullKeyChange={(k) => handleUpdateStepField(field.id, 'key', k)}
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <Label className="text-xs text-zinc-300">نوع فیلد ورودی</Label>
                          <Select
                            value={field.type}
                            onValueChange={(val) => handleUpdateStepField(field.id, 'type', val)}
                          >
                            <SelectTrigger className="bg-zinc-950 border-zinc-700 text-zinc-100 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="border-zinc-700" style={{ background: '#1e2020' }}>
                              <SelectItem value="text" className="text-xs text-zinc-100">متن کوتاه (Text)</SelectItem>
                              <SelectItem value="number" className="text-xs text-zinc-100">عددی / مبلغ (Number)</SelectItem>
                              <SelectItem value="date" className="text-xs text-zinc-100">تقویم شمسی (Date)</SelectItem>
                              <SelectItem value="file" className="text-xs text-zinc-100">بارگذاری فایل / پیوست (File)</SelectItem>
                              <SelectItem value="select" className="text-xs text-zinc-100">لیست کشویی (Select)</SelectItem>
                              <SelectItem value="checkbox" className="text-xs text-zinc-100">چک‌باکس تأییدی (Checkbox)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {field.type === 'select' && (
                          <div className="md:col-span-3 flex flex-col gap-1 bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800">
                            <Label className="text-xs text-amber-300">گزینه‌های لیست کشویی (با کاما جدا کنید)</Label>
                            <Input
                              value={field.options ? field.options.join(', ') : ''}
                              onChange={(e) =>
                                handleUpdateStepField(
                                  field.id,
                                  'options',
                                  e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                                )
                              }
                              placeholder="گزینه ۱, گزینه ۲, گزینه ۳"
                              className="bg-zinc-900 border-zinc-700 text-zinc-100 h-8 text-xs"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

        </FullScreenDialog>
      )}

      {/* Delete Guard Modal */}
      {checkResult && itemToDelete && (
        <DeleteGuardModal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          title={itemToDelete.template_name}
          entityType="الگوی اعتراض"
          checkResult={checkResult}
          onConfirmDelete={handleConfirmDeleteTemplate}
        />
      )}
    </div>
  )
}
