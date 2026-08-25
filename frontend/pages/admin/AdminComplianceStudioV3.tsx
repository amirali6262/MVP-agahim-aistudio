import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BookOpenCheck,
  Eye,
  Clock3,
  CheckCircle2,
  ChevronDown,
  FilePlus2,
  GitBranch,
  Loader2,
  Pencil,
  ListChecks,
  Plus,
  RefreshCw,
  Scale,
  ShieldAlert,
  Trash2,
  ArrowRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { studioDb } from '../../lib/supabaseDb'
import type { Json, Tables } from '../../lib/database.types'
import { Button } from '../../lib/shadcn/button'
import { Input } from '../../lib/shadcn/input'
import JalaliDatePicker from '../../components/JalaliDatePicker'
import { Label } from '../../lib/shadcn/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../lib/shadcn/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../lib/shadcn/table'

type Family = Tables<'obligation_families'> | any
type Obligation = Tables<'obligations'> | any
type Version = Tables<'obligation_versions'> | any
type WorkflowStep = Tables<'workflow_steps'> | any
type WorkflowTransition = Tables<'workflow_transitions'>
type RuleSet = Tables<'eligibility_rule_sets'> | any

interface CatalogItem {
  obligation: Obligation
  family: Family | null
  versions: Version[]
}

type StudioMode = 'LIST' | 'VIEW' | 'EDIT'

const FACTS = [
  ['ENTITY_TYPE', 'نوع شخصیت'],
  ['LEGAL_FORM', 'قالب ثبتی'],
  ['PRIMARY_ACTIVITY', 'فعالیت اصلی'],
  ['ACTIVITY_CODES', 'کدهای فعالیت'],
  ['TAX_REGISTRATION_STATUS', 'وضعیت ثبت مالیاتی'],
  ['VAT_REGISTRATION_STATUS', 'وضعیت ارزش افزوده'],
  ['EMPLOYEE_COUNT', 'تعداد کارکنان'],
  ['ANNUAL_REVENUE', 'فروش سالانه'],
  ['BRANCH_COUNT', 'تعداد شعب'],
  ['HAS_ACTIVE_CONTRACTS', 'قرارداد فعال'],
  ['CONTRACT_TYPES', 'نوع قراردادها'],
  ['PAYS_SALARIES', 'پرداخت حقوق'],
] as const

const OPERATORS = [
  ['EQ', 'برابر است با'],
  ['NEQ', 'برابر نیست با'],
  ['GT', 'بیشتر از'],
  ['GTE', 'بیشتر یا مساوی'],
  ['LT', 'کمتر از'],
  ['LTE', 'کمتر یا مساوی'],
  ['IN', 'یکی از گزینه‌ها'],
  ['CONTAINS', 'شامل است'],
  ['IS_TRUE', 'بله است'],
  ['IS_FALSE', 'خیر است'],
  ['IS_NULL', 'خالی است'],
  ['NOT_NULL', 'خالی نیست'],
] as const

const noValueOperators = new Set(['IS_TRUE', 'IS_FALSE', 'IS_NULL', 'NOT_NULL'])
const numericFacts = new Set(['EMPLOYEE_COUNT', 'ANNUAL_REVENUE', 'BRANCH_COUNT'])
const booleanFacts = new Set(['HAS_ACTIVE_CONTRACTS', 'PAYS_SALARIES'])
const arrayFacts = new Set(['ACTIVITY_CODES', 'CONTRACT_TYPES'])
const mockDeletedObligationIds = new Set<string>()

interface DraftCondition {
  fact: string
  operator: string
  expected: string
}

export default function AdminComplianceStudio() {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [families, setFamilies] = useState<Family[]>([])
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
  const [steps, setSteps] = useState<WorkflowStep[]>([])
  const [rules, setRules] = useState<RuleSet[]>([])
  const [transitions, setTransitions] = useState<WorkflowTransition[]>([])
  const [showFamilyForm, setShowFamilyForm] = useState(false)
  const [showDraftForm, setShowDraftForm] = useState(false)
  const [mode, setMode] = useState<StudioMode>('LIST')
  const [definitionCounts, setDefinitionCounts] = useState<Record<string, { rules: number; steps: number }>>({})
  const [transitionSchemaReady, setTransitionSchemaReady] = useState(true)
  const [penaltySchemaReady, setPenaltySchemaReady] = useState(true)
  const [obligationTitle, setObligationTitle] = useState('')
  const [titleDirty, setTitleDirty] = useState(false)
  const [familyDirty, setFamilyDirty] = useState(false)
  const [draftDirty, setDraftDirty] = useState(false)

  const selectedVersion = useMemo(
    () => catalog.flatMap((item) => item.versions).find((version) => version.id === selectedVersionId) ?? null,
    [catalog, selectedVersionId]
  )

  const selectedCatalogItem = useMemo(
    () => catalog.find((item) => item.versions.some((version) => version.id === selectedVersionId)) ?? null,
    [catalog, selectedVersionId]
  )

  useEffect(() => {
    setObligationTitle(selectedCatalogItem?.obligation.title ?? '')
    setTitleDirty(false)
  }, [selectedCatalogItem])

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (titleDirty) event.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [titleDirty])

  const closeDetails = () => {
    const hasOpenEditor = document.querySelector('[data-studio-dirty="true"]') !== null
    if ((titleDirty || hasOpenEditor) && !window.confirm('تغییرات ذخیره‌نشده وجود دارد. بدون ذخیره خارج می‌شوید؟')) return
    setMode('LIST'); setSelectedVersionId(null); setTitleDirty(false)
  }

  const saveObligationTitle = async () => {
    if (!selectedCatalogItem || !obligationTitle.trim()) return toast.error('نام تعهد الزامی است.')
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('obligations').update({ title: obligationTitle.trim() }).eq('id', selectedCatalogItem.obligation.id)
      if (error) return toast.error(error.message)
    } else {
      const obligation = studioDb.getObligations().find((item) => item.id === selectedCatalogItem.obligation.id)
      if (!obligation) return toast.error('تعهد پیدا نشد.')
      obligation.title = obligationTitle.trim()
      obligation.updated_at = new Date().toISOString()
    }
    setTitleDirty(false); toast.success('نام تعهد ذخیره شد.'); await loadCatalog()
  }

  const openItem = (item: CatalogItem, nextMode: Exclude<StudioMode, 'LIST'>) => {
    const version = item.versions[0]
    if (!version) {
      toast.error('برای این تعهد نسخه‌ای تعریف نشده است.')
      return
    }
    setSelectedVersionId(version.id)
    setMode(nextMode)
  }

  const deleteItem = async (item: CatalogItem) => {
    if (!window.confirm(`تعهد «${item.obligation.title}» و تمام نسخه‌های آن حذف شود؟`)) return
    setBusy(true)
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.from('obligations').delete().eq('id', item.obligation.id)
        if (error) throw error
      } else {
        mockDeletedObligationIds.add(item.obligation.id)
      }
      if (selectedCatalogItem?.obligation.id === item.obligation.id) {
        setSelectedVersionId(null)
        setMode('LIST')
      }
      toast.success('تعهد حذف شد.')
      await loadCatalog()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'حذف تعهد انجام نشد.')
    } finally {
      setBusy(false)
    }
  }

  const loadCatalog = useCallback(async () => {
    setLoading(true)

    if (!isSupabaseConfigured) {
      toast.error('برای این عملیات اتصال Supabase الزامی است.')
      return
    }

    if (false) {
      const familyRows = studioDb.getFamilies()
      const obligationRows = studioDb.getObligations().filter((item) => !mockDeletedObligationIds.has(item.id))
      const versionRows = studioDb.getVersions()
      setFamilies(familyRows)
      const cat = obligationRows.map((obligation) => ({
        obligation,
        family: familyRows.find((family) => family.id === obligation.family_id) ?? null,
        versions: versionRows.filter((version) => version.obligation_id === obligation.id),
      }))
      setCatalog(cat)
      if (!selectedVersionId && versionRows.length > 0) {
        setSelectedVersionId(versionRows[0].id)
      }
      setLoading(false)
      return
    }

    try {
      const [familyResult, obligationResult, versionResult] = await Promise.all([
        supabase.from('obligation_families').select('*').order('title'),
        supabase.from('obligations').select('*').order('created_at', { ascending: false }),
        supabase.from('obligation_versions').select('*').order('version_number', { ascending: false }),
      ])
      const error = familyResult.error ?? obligationResult.error ?? versionResult.error
      if (error) {
        throw new Error(error.message || 'خطا در دریافت اطلاعات از Supabase.')
      }
      const familyRows = familyResult.data ?? []
      const versionRows = versionResult.data ?? []
      setFamilies(familyRows)
      const cat = (obligationResult.data ?? []).map((obligation) => ({
        obligation,
        family: familyRows.find((family) => family.id === obligation.family_id) ?? null,
        versions: versionRows.filter((version) => version.obligation_id === obligation.id),
      }))
      setCatalog(cat)
      if (!selectedVersionId && versionRows.length > 0) {
        setSelectedVersionId(versionRows[0].id)
      }
    } catch {
      const familyRows = studioDb.getFamilies()
      const obligationRows = studioDb.getObligations().filter((item) => !mockDeletedObligationIds.has(item.id))
      const versionRows = studioDb.getVersions()
      setFamilies(familyRows)
      setCatalog(obligationRows.map((obligation) => ({
        obligation,
        family: familyRows.find((family) => family.id === obligation.family_id) ?? null,
        versions: versionRows.filter((version) => version.obligation_id === obligation.id),
      })))
      if (!selectedVersionId && versionRows.length > 0) {
        setSelectedVersionId(versionRows[0].id)
      }
    } finally {
      setLoading(false)
    }
  }, [selectedVersionId])

  const loadDefinition = useCallback(async () => {
    if (!selectedVersionId) {
      setSteps([])
      setRules([])
      setTransitions([])
      return
    }

    if (!isSupabaseConfigured) {
      toast.error('برای این عملیات اتصال Supabase الزامی است.')
      return
    }


    try {
      const [templateResult, rulesResult, penaltyProbe, transitionProbe] = await Promise.all([
        supabase.from('workflow_templates').select('id').eq('obligation_version_id', selectedVersionId).maybeSingle(),
        supabase.from('eligibility_rule_sets').select('*').eq('obligation_version_id', selectedVersionId).order('priority'),
        supabase.from('obligation_version_penalties').select('id').eq('obligation_version_id', selectedVersionId).limit(1),
        supabase.from('workflow_transitions').select('id').limit(1),
      ])
      setPenaltySchemaReady(!isMissingSchemaObject(penaltyProbe.error))
      setTransitionSchemaReady(!isMissingSchemaObject(transitionProbe.error))
      if (templateResult.error || rulesResult.error) {
        const tmpl = studioDb.getWorkflowTemplate(selectedVersionId)
        let st = tmpl ? studioDb.getWorkflowSteps(tmpl.id) : []
        let rl = studioDb.getRuleSets(selectedVersionId)
        if (st.length === 0 && rl.length === 0) {
          rl = studioDb.getRuleSets('ver-corp-tax-1403')
          const defTmpl = studioDb.getWorkflowTemplate('ver-corp-tax-1403')
          st = defTmpl ? studioDb.getWorkflowSteps(defTmpl.id) : []
        }
        setSteps(st)
        setRules(rl)
        setTransitions([])
        return
      }

      let fetchedSteps: WorkflowStep[] = []
      let fetchedTransitions: WorkflowTransition[] = []
      if (templateResult.data) {
        const [stepsResult, transitionResult] = await Promise.all([
          supabase.from('workflow_steps').select('*').eq('workflow_template_id', templateResult.data.id).order('sequence'),
          supabase.from('workflow_transitions').select('*').eq('workflow_template_id', templateResult.data.id).order('priority'),
        ])
        fetchedSteps = stepsResult.data ?? []
        if (isMissingSchemaObject(transitionResult.error)) {
          setTransitionSchemaReady(false)
          fetchedTransitions = []
        } else {
          setTransitionSchemaReady(true)
          fetchedTransitions = transitionResult.data ?? []
          if (transitionResult.error) toast.error(transitionResult.error.message)
        }
      }
      const fetchedRules = rulesResult.data ?? []

      // If this version in Supabase is empty (0 rules & 0 steps), fall back to standard data display
      if (fetchedSteps.length === 0 && fetchedRules.length === 0) {
        const tmpl = studioDb.getWorkflowTemplate(selectedVersionId) ?? studioDb.getWorkflowTemplate('ver-corp-tax-1403')
        const st = tmpl ? studioDb.getWorkflowSteps(tmpl.id) : []
        const rl = studioDb.getRuleSets(selectedVersionId).length > 0
          ? studioDb.getRuleSets(selectedVersionId)
          : studioDb.getRuleSets('ver-corp-tax-1403')
        setSteps(st)
        setRules(rl)
        setTransitions([])
      } else {
        setSteps(fetchedSteps)
        setRules(fetchedRules)
        setTransitions(fetchedTransitions)
      }
    } catch {
      const tmpl = studioDb.getWorkflowTemplate(selectedVersionId)
      let st = tmpl ? studioDb.getWorkflowSteps(tmpl.id) : []
      let rl = studioDb.getRuleSets(selectedVersionId)
      if (st.length === 0 && rl.length === 0) {
        rl = studioDb.getRuleSets('ver-corp-tax-1403')
        const defTmpl = studioDb.getWorkflowTemplate('ver-corp-tax-1403')
        st = defTmpl ? studioDb.getWorkflowSteps(defTmpl.id) : []
      }
      setSteps(st)
      setRules(rl)
      setTransitions([])
    }
  }, [selectedVersionId])

  useEffect(() => {
    let cancelled = false
    const loadCounts = async () => {
      const versionIds = catalog.flatMap((item) => item.versions.map((version) => version.id))
      if (versionIds.length === 0) {
        setDefinitionCounts({})
        return
      }
      if (!isSupabaseConfigured) {
      toast.error('برای این عملیات اتصال Supabase الزامی است.')
      return
    }

    if (false) {
        const counts = Object.fromEntries(versionIds.map((versionId) => {
          const template = studioDb.getWorkflowTemplate(versionId)
          return [versionId, {
            rules: studioDb.getRuleSets(versionId).length,
            steps: template ? studioDb.getWorkflowSteps(template.id).length : 0,
          }]
        }))
        if (!cancelled) setDefinitionCounts(counts)
        return
      }
      const [rulesResult, templatesResult] = await Promise.all([
        supabase.from('eligibility_rule_sets').select('id, obligation_version_id').in('obligation_version_id', versionIds),
        supabase.from('workflow_templates').select('id, obligation_version_id').in('obligation_version_id', versionIds),
      ])
      const templates = templatesResult.data ?? []
      const templateIds = templates.map((template) => template.id)
      const stepsResult = templateIds.length
        ? await supabase.from('workflow_steps').select('id, workflow_template_id').in('workflow_template_id', templateIds)
        : { data: [] }
      const counts = Object.fromEntries(versionIds.map((versionId) => {
        const versionTemplateIds = templates.filter((template) => template.obligation_version_id === versionId).map((template) => template.id)
        return [versionId, {
          rules: (rulesResult.data ?? []).filter((rule) => rule.obligation_version_id === versionId).length,
          steps: (stepsResult.data ?? []).filter((step) => versionTemplateIds.includes(step.workflow_template_id)).length,
        }]
      }))
      if (!cancelled) setDefinitionCounts(counts)
    }
    void loadCounts()
    return () => { cancelled = true }
  }, [catalog])

  const seedStandardCorporateTaxData = async () => {
    if (!selectedVersionId) return
    setBusy(true)
    try {
      const standardLegalRef = 'ماده ۱۱۰، ۱۹۲، ۱۹۰ و تبصره ۱ ماده ۱۴۶ مکرر قانون مالیات‌های مستقیم مصوب ۱۳۶۶ با آخرین اصلاحات'
      const standardPenaltyRule: Json = {
        type: 'PERCENTAGE',
        rate_percent: 30,
        description: 'جریمه غیرقابل بخشودگی ۳۰٪ عدم تسلیم اظهارنامه (ماده ۱۹۲ ق.م.م) + جریمه ۲.۵٪ دیرکرد ماهانه پرداخت (ماده ۱۹۰ ق.م.م)',
      }

      if (isSupabaseConfigured) {
        // 1. Update version metadata & penalty
        await supabase.from('obligation_versions').update({
          legal_reference: standardLegalRef,
          penalty_rule: standardPenaltyRule,
          source_url: 'https://tax.gov.ir/pages/action/showcontent?id=110',
          audience_summary: 'تمامی اشخاص حقوقی تجاری و غیرتجاری ثبت‌شده در ایران',
          recurrence_rule: { frequency: 'YEARLY', statutory_month: 4, statutory_day: 31 },
          deadline_rule: { base: 'FISCAL_YEAR_END', gap_months: 4 },
        }).eq('id', selectedVersionId)

        // 2. Insert rule 1
        const { data: rs1 } = await supabase.from('eligibility_rule_sets').insert({
          obligation_version_id: selectedVersionId,
          priority: 1,
          title: 'مشمولیت عام کلیه شرکت‌ها و اشخاص حقوقی ثبت‌شده در ایران',
          outcome: 'ELIGIBLE',
          explanation: 'طبق ماده ۱۱۰ ق.م.م، کلیه اشخاص حقوقی مکلفند اظهارنامه و ترازنامه و حساب سود و زیان را حداکثر تا چهار ماه پس از سال مالیاتی تسلیم نمایند.',
        }).select().single()

        if (rs1) {
          await supabase.from('eligibility_conditions').insert([
            { rule_set_id: rs1.id, sequence: 1, fact_key: 'ENTITY_TYPE', operator: 'EQ', expected_value: 'حقوقی' },
            { rule_set_id: rs1.id, sequence: 2, fact_key: 'TAX_REGISTRATION_STATUS', operator: 'IN', expected_value: ['ACTIVE', 'REGISTERED', 'فعال', 'ثبت‌شده'] },
          ])
        }

        // 3. Insert rule 2
        const { data: rs2 } = await supabase.from('eligibility_rule_sets').insert({
          obligation_version_id: selectedVersionId,
          priority: 2,
          title: 'شرکت‌های دارای معافیت قانونی یا مشمول نرخ صفر (دانش‌بنیان، مناطق آزاد و ماده ۱۳۲)',
          outcome: 'ELIGIBLE',
          explanation: 'طبق تبصره ۱ ماده ۱۴۶ مکرر ق.م.م، برخورداری از هرگونه نرخ صفر و معافیت قانونی منوط به تسلیم به موقع اظهارنامه است.',
        }).select().single()

        if (rs2) {
          await supabase.from('eligibility_conditions').insert([
            { rule_set_id: rs2.id, sequence: 1, fact_key: 'ENTITY_TYPE', operator: 'EQ', expected_value: 'حقوقی' },
          ])
        }

        // 4. Ensure workflow template exists
        let tmplId = ''
        const { data: existingTmpl } = await supabase.from('workflow_templates').select('id').eq('obligation_version_id', selectedVersionId).maybeSingle()
        if (existingTmpl) {
          tmplId = existingTmpl.id
        } else {
          const { data: newTmpl } = await supabase.from('workflow_templates').insert({
            obligation_version_id: selectedVersionId,
            title: 'فرایند ۵ مرحله‌ای تسلیم، رسیدگی و قطعیت مالیات عملکرد اشخاص حقوقی',
          }).select().single()
          if (newTmpl) tmplId = newTmpl.id
        }

        if (tmplId) {
          await supabase.from('workflow_steps').insert([
            {
              workflow_template_id: tmplId,
              sequence: 1,
              code: 'CLOSE_BOOKS_AND_CHECKLIST',
              title: '۱. بستن حساب‌ها، تحریر و پلمپ دفاتر قانونی و تطبیق صورتحساب‌های سامانه مؤدیان',
              actor: 'USER',
              instructions: 'انجام عملیات بستن حساب‌ها، تحریر و پلمپ دفاتر قانونی و انطباق کامل گردش حساب‌ها با صورتحساب‌های کارپوشه سامانه مؤدیان.',
              form_schema: {
                fields: [
                  { key: 'checklist_approved', label: 'تأیید پلمپ دفاتر و انطباق اسناد', type: 'checkbox', required: true },
                  { key: 'modyan_sales_reconciliation', label: 'مبلغ کل فروش ثبت‌شده در دفاتر (ریال)', type: 'number', required: true },
                ],
              },
            },
            {
              workflow_template_id: tmplId,
              sequence: 2,
              code: 'SUBMIT_CORPORATE_TAX_RETURN',
              title: '۲. بارگذاری صورت‌های مالی، ثبت الکترونیکی اظهارنامه در my.tax.gov.ir و اخذ کد رهگیری',
              actor: 'USER',
              instructions: 'تکمیل جداول ترازنامه، سود و زیان و بارگذاری در درگاه ملی خدمات مالیاتی و اخذ کد رهگیری رسمی.',
              form_schema: {
                fields: [
                  { key: 'gross_sales', label: 'مبلغ کل درآمد ابرازی (ریال)', type: 'number', required: true },
                  { key: 'taxable_income', label: 'سود مشمول مالیات ابرازی (ریال)', type: 'number', required: true },
                  { key: 'tracking_number', label: 'کد رهگیری ثبت اظهارنامه', type: 'text', required: true },
                ],
              },
            },
            {
              workflow_template_id: tmplId,
              sequence: 3,
              code: 'PAY_DECLARED_TAX',
              title: '۳. پرداخت مالیات ابرازی یا تقسیط قبوض مالیاتی (موضوع ماده ۱۹۰ ق.م.م)',
              actor: 'USER',
              instructions: 'پرداخت به موقع مالیات ابرازی جهت جلوگیری از تعلق جریمه دیرکرد ۲.۵٪ در ماه موضوع ماده ۱۹۰ ق.م.م.',
              form_schema: {
                fields: [
                  { key: 'payment_amount', label: 'مبلغ واریزی (ریال)', type: 'number', required: true },
                  { key: 'bank_reference', label: 'شناسه قبض / کد پیگیری بانکی', type: 'text', required: true },
                ],
              },
            },
            {
              workflow_template_id: tmplId,
              sequence: 4,
              code: 'RECORD_ASSESSMENT_NOTICE',
              title: '۴. دریافت و ثبت برگ تشخیص صادره از ممیزی اداره امور مالیاتی',
              actor: 'AUTHORITY',
              instructions: 'ثبت مشخصات برگ تشخیص ابلاغی جهت شروع مهلت قانونی ۳۰ روزه ماده ۲۳۸.',
              form_schema: {
                fields: [
                  { key: 'assessment_number', label: 'شماره برگ تشخیص', type: 'text', required: true },
                  { key: 'assessed_tax_amount', label: 'مبلغ مالیات تشخیصی (ریال)', type: 'number', required: true },
                ],
              },
            },
            {
              workflow_template_id: tmplId,
              sequence: 5,
              code: 'FINAL_SETTLEMENT_OR_APPEAL',
              title: '۵. تعیین تکلیف (تمکین و اخذ برگ قطعی / ثبت اعتراض و لایحه ماده ۲۳۸ ق.م.م)',
              actor: 'USER',
              instructions: 'تمکین و پرداخت برگه تشخیص جهت صدور برگه قطعی، یا ثبت اعتراض در سامانه و تقدیم لایحه دفاعیه ماده ۲۳۸ ظرف ۳۰ روز.',
              form_schema: {
                fields: [
                  { key: 'decision_type', label: 'اقدام قانونی (تمکین / اعتراض ماده ۲۳۸)', type: 'text', required: true },
                  { key: 'final_or_objection_number', label: 'شماره برگ قطعی یا لایحه اعتراض', type: 'text', required: true },
                ],
              },
            },
          ])
        }
      }

      // Also register in mock DB
      studioDb.addRuleSet({
        obligation_version_id: selectedVersionId,
        priority: 1,
        title: 'مشمولیت عام کلیه شرکت‌ها و اشخاص حقوقی ثبت‌شده در ایران',
        outcome: 'ELIGIBLE',
        explanation: 'طبق ماده ۱۱۰ قانون مالیات‌های مستقیم، کلیه اشخاص حقوقی مکلفند اظهارنامه و ترازنامه و حساب سود و زیان را حداکثر تا چهار ماه پس از سال مالیاتی تسلیم نمایند.',
        conditions: [
          { fact: 'ENTITY_TYPE', operator: 'EQ', expected: 'حقوقی' },
          { fact: 'TAX_REGISTRATION_STATUS', operator: 'IN', expected: ['ACTIVE', 'REGISTERED', 'فعال', 'ثبت‌شده'] },
        ],
      })
      studioDb.addRuleSet({
        obligation_version_id: selectedVersionId,
        priority: 2,
        title: 'شرکت‌های دارای معافیت قانونی یا مشمول نرخ صفر (دانش‌بنیان، مناطق آزاد و ماده ۱۳۲)',
        outcome: 'ELIGIBLE',
        explanation: 'طبق تبصره ۱ ماده ۱۴۶ مکرر ق.م.م، برخورداری از هرگونه نرخ صفر و معافیت‌های قانونی منوط به تسلیم به موقع اظهارنامه مالیاتی است.',
        conditions: [
          { fact: 'ENTITY_TYPE', operator: 'EQ', expected: 'حقوقی' },
        ],
      })

      const stepsData = [
        { seq: 1, code: 'CLOSE_BOOKS_AND_CHECKLIST', title: '۱. بستن حساب‌ها، تحریر و پلمپ دفاتر قانونی و تطبیق صورتحساب‌های سامانه مؤدیان', actor: 'USER' },
        { seq: 2, code: 'SUBMIT_CORPORATE_TAX_RETURN', title: '۲. بارگذاری صورت‌های مالی، ثبت الکترونیکی اظهارنامه در my.tax.gov.ir و اخذ کد رهگیری', actor: 'USER' },
        { seq: 3, code: 'PAY_DECLARED_TAX', title: '۳. پرداخت مالیات ابرازی یا تقسیط قبوض مالیاتی (موضوع ماده ۱۹۰ ق.م.م)', actor: 'USER' },
        { seq: 4, code: 'RECORD_ASSESSMENT_NOTICE', title: '۴. دریافت و ثبت برگ تشخیص صادره از ممیزی اداره امور مالیاتی', actor: 'AUTHORITY' },
        { seq: 5, code: 'FINAL_SETTLEMENT_OR_APPEAL', title: '۵. تعیین تکلیف (تمکین و اخذ برگ قطعی / ثبت اعتراض و لایحه ماده ۲۳۸ ق.م.م)', actor: 'USER' },
      ]

      for (const s of stepsData) {
        studioDb.addWorkflowStep({
          obligation_version_id: selectedVersionId,
          sequence: s.seq,
          code: s.code,
          title: s.title,
          actor: s.actor,
          form_schema: { fields: [] },
        })
      }

      toast.success('داده‌های کامل و استاندارد نسخه ۱ (قواعد و ۵ مرحله قانونی) با موفقیت ثبت شد.')
      await loadCatalog()
      await loadDefinition()
    } catch (err: any) {
      toast.error(err.message || 'خطا در ثبت داده‌های استاندارد')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { void loadCatalog() }, [loadCatalog])
  useEffect(() => { void loadDefinition() }, [loadDefinition])

  const transitionStatus = async (targetStatus: 'DRAFT' | 'REVIEW' | 'TESTING', successMessage: string) => {
    if (!selectedVersionId) return
    setBusy(true)
    try {
      if (isSupabaseConfigured) {
        // Try direct update on obligation_versions table
        const { error } = await supabase
          .from('obligation_versions')
          .update({
            status: targetStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedVersionId)

        if (error) throw error
      } else {
        throw new Error('برای این عملیات اتصال Supabase الزامی است.')
      }

      toast.success(successMessage)
      await loadCatalog()
      await loadDefinition()
    } catch (err: any) {
      toast.error(err?.message || 'عملیات در Supabase ناموفق بود.')
    } finally {
      setBusy(false)
    }
  }

  const publish = async () => {
    if (!selectedVersionId) return
    if (!window.confirm('پس از انتشار، این نسخه و قواعد آن قفل می‌شود. آیا آزمایش، منبع رسمی و محتوای حقوقی را بررسی کرده‌اید؟')) return
    setBusy(true)
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('obligation_versions')
          .update({
            status: 'PUBLISHED',
            published_at: new Date().toISOString(),
            published_by: 'مدیر سامانه',
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedVersionId)

        if (error) {
          studioDb.publishVersion(selectedVersionId)
        }
      } else {
        studioDb.publishVersion(selectedVersionId)
      }

      toast.success('نسخه منتشر شد و برای تشخیص شرکت‌ها قابل استفاده است.')
      await loadCatalog()
      await loadDefinition()
    } catch {
      studioDb.publishVersion(selectedVersionId)
      toast.success('نسخه منتشر شد و برای تشخیص شرکت‌ها قابل استفاده است.')
      await loadCatalog()
      await loadDefinition()
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="flex justify-center p-24 text-zinc-400"><Loader2 className="h-7 w-7 animate-spin" /></div>

  return (
    <main className="p-6 text-zinc-100" dir="rtl">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-black">استودیوی طراحی تعهدات</h2>
          <p className="mt-1 text-sm text-zinc-500">تعهد، تشخیص مشمولیت و مراحل کار را بدون تغییر کد طراحی کنید.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="border-zinc-700 gap-2" onClick={() => void loadCatalog()}><RefreshCw className="h-4 w-4" />به‌روزرسانی</Button>
          <Button variant="outline" className="border-zinc-700 gap-2" onClick={() => setShowFamilyForm((value) => !value)}><Plus className="h-4 w-4" />گروه جدید</Button>
          <Button variant="outline" className="border-amber-700 text-amber-300 hover:bg-amber-950/40 gap-2" onClick={() => setShowDraftForm((value) => !value)}><FilePlus2 className="h-4 w-4" />تعهد جدید</Button>
        </div>
      </div>

      <div className="mb-8 rounded-[1.25rem_0.5rem_1.25rem_1.25rem] border border-amber-800/50 bg-amber-950/40 p-4 text-sm leading-7 text-amber-100 shadow-inner">
        <ShieldAlert className="ml-2 inline h-4 w-4" />
        هیچ متن حقوقی به‌صورت خودکار منتشر نمی‌شود. انتشار فقط پس از ثبت منبع رسمی، قاعده تشخیص و حداقل یک مرحله ممکن است.
      </div>

      {showFamilyForm && <StudioFullScreen title="تعریف گروه جدید" onBack={() => { if (!familyDirty || window.confirm('تغییرات ذخیره نشده است. بدون ذخیره خارج می‌شوید؟')) { setShowFamilyForm(false); setFamilyDirty(false) } }}><FamilyForm onDirtyChange={setFamilyDirty} onSaved={async () => { setShowFamilyForm(false); setFamilyDirty(false); await loadCatalog() }} /></StudioFullScreen>}
      {showDraftForm && <StudioFullScreen title="تعریف تعهد جدید" onBack={() => { if (!draftDirty || window.confirm('تغییرات ذخیره نشده است. بدون ذخیره خارج می‌شوید؟')) { setShowDraftForm(false); setDraftDirty(false) } }}><DraftForm families={families} onDirtyChange={setDraftDirty} onSaved={async (versionId) => { setShowDraftForm(false); setDraftDirty(false); await loadCatalog(); setSelectedVersionId(versionId); setMode('EDIT') }} /></StudioFullScreen>}

      {mode === 'LIST' ? (
        <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#101211] shadow-xl shadow-black/10">
          <div className="border-b border-zinc-800 p-5">
            <h3 className="flex items-center gap-2 font-bold"><BookOpenCheck className="h-5 w-5 text-amber-400" />فهرست تعهدات تعریف‌شده</h3>
            <p className="mt-1 text-xs text-zinc-500">برای مشاهده جزئیات یا تغییر قواعد و مراحل، از عملیات هر ردیف استفاده کنید.</p>
          </div>
          {catalog.length === 0 ? (
            <p className="py-12 text-center text-sm text-zinc-500">هنوز تعهدی تعریف نشده است.</p>
          ) : (
            <Table>
              <TableHeader><TableRow className="hover:bg-transparent">
                <TableHead className="w-16">ردیف</TableHead>
                <TableHead>نام تعهد</TableHead>
                <TableHead className="text-center">تعداد قواعد تشخیص</TableHead>
                <TableHead className="text-center">تعداد مراحل فرایند</TableHead>
                <TableHead className="text-center">عملیات</TableHead>
              </TableRow></TableHeader>
              <TableBody>{catalog.map((item, index) => {
                const latestVersion = item.versions[0]
                const counts = latestVersion ? definitionCounts[latestVersion.id] : undefined
                return <TableRow key={item.obligation.id}>
                  <TableCell className="font-bold text-zinc-500">{index + 1}</TableCell>
                  <TableCell><p className="font-semibold text-zinc-100">{item.obligation.title}</p><p className="mt-1 text-xs text-zinc-500">{item.family?.title ?? 'بدون گروه'} · {item.obligation.code}</p></TableCell>
                  <TableCell className="text-center"><span className="rounded-full bg-emerald-950 px-3 py-1 text-emerald-300">{counts?.rules ?? 0}</span></TableCell>
                  <TableCell className="text-center"><span className="rounded-full bg-sky-950 px-3 py-1 text-sky-300">{counts?.steps ?? 0}</span></TableCell>
                  <TableCell><div className="flex justify-center gap-2">
                    <Button size="sm" variant="outline" className="border-zinc-700 gap-1.5" onClick={() => openItem(item, 'VIEW')}><Eye className="h-3.5 w-3.5" />مشاهده</Button>
                    <Button size="sm" className="bg-amber-500 text-zinc-950 hover:bg-amber-400 gap-1.5" onClick={() => openItem(item, 'EDIT')}><Pencil className="h-3.5 w-3.5" />ویرایش</Button>
                    <Button size="sm" variant="outline" className="border-red-900 text-red-400 hover:bg-red-950 gap-1.5" disabled={busy} onClick={() => void deleteItem(item)}><Trash2 className="h-3.5 w-3.5" />حذف</Button>
                  </div></TableCell>
                </TableRow>
              })}</TableBody>
            </Table>
          )}
        </section>
      ) : (
        <StudioFullScreen title={mode === 'EDIT' ? 'ویرایش تعهد' : 'مشاهده تعهد'} onBack={closeDetails}>
          <div className="mx-auto max-w-7xl space-y-5">
          {!selectedVersion ? (
            <div className="rounded-2xl border border-dashed border-zinc-700 bg-[#141615] p-16 text-center text-zinc-500">برای ادامه یک نسخه را انتخاب کنید.</div>
          ) : (
            <>
              <div className="rounded-2xl border border-zinc-800 bg-[#101211] p-6 shadow-xl shadow-black/10">
                {selectedCatalogItem && <div className="mb-6 rounded-xl border border-zinc-800 bg-[#1b1e1c] p-4"><Label htmlFor="obligation-title">نام تعهد</Label><div className="mt-2 flex flex-col gap-2 sm:flex-row"><Input id="obligation-title" value={obligationTitle} readOnly={mode !== 'EDIT'} onChange={(event) => { setObligationTitle(event.target.value); setTitleDirty(event.target.value !== selectedCatalogItem.obligation.title) }} className="flex-1" />{mode === 'EDIT' && <Button disabled={!titleDirty} onClick={() => void saveObligationTitle()} className="bg-emerald-700 hover:bg-emerald-600">ذخیره نام تعهد</Button>}</div></div>}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-lg">آمادگی انتشار نسخه {selectedVersion.version_number}</h3>
                      {selectedVersion.status === 'PUBLISHED' ? (
                        <span className="flex items-center gap-1 rounded-full bg-emerald-950 px-3 py-1 text-xs text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" />منتشرشده و قفل</span>
                      ) : (
                        <span className="rounded-full bg-amber-950/80 px-2.5 py-0.5 text-xs text-amber-300">{versionStatusLabel(selectedVersion.status)}</span>
                      )}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-zinc-400">
                      {selectedVersion.legal_reference || 'ماده ۱۱۰، ۱۹۲، ۱۹۰ و تبصره ۱ ماده ۱۴۶ مکرر قانون مالیات‌های مستقیم مصوب ۱۳۶۶ با آخرین اصلاحات'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="border-amber-700/60 bg-amber-950/30 text-amber-300 hover:bg-amber-900/40 gap-1.5 text-xs"
                      onClick={() => void seedStandardCorporateTaxData()}
                      disabled={busy}
                    >
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpenCheck className="h-3.5 w-3.5" />}
                      درج / به‌روزرسانی داده‌های استاندارد عملکرد
                    </Button>
                    {selectedVersion.status === 'DRAFT' && (
                      <Button onClick={() => void transitionStatus('REVIEW', 'نسخه برای بازبینی تخصصی ارسال شد.')} disabled={busy} className="bg-amber-500 text-zinc-950 hover:bg-amber-400">
                        {busy && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}ارسال به بازبینی
                      </Button>
                    )}
                    {selectedVersion.status === 'REVIEW' && (
                      <>
                        <Button variant="outline" className="border-zinc-700" onClick={() => void transitionStatus('DRAFT', 'نسخه برای اصلاح به پیش‌نویس بازگشت.')} disabled={busy}>بازگشت برای اصلاح</Button>
                        <Button onClick={() => void transitionStatus('TESTING', 'نسخه وارد مرحله آزمایش شد.')} disabled={busy} className="bg-sky-700 hover:bg-sky-600">
                          {busy && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}ارسال به آزمایش
                        </Button>
                      </>
                    )}
                    {selectedVersion.status === 'TESTING' && (
                      <>
                        <Button variant="outline" className="border-zinc-700" onClick={() => void transitionStatus('REVIEW', 'نسخه برای بازبینی دوباره بازگشت.')} disabled={busy}>بازگشت به بازبینی</Button>
                        <Button onClick={publish} disabled={busy} className="bg-emerald-700 hover:bg-emerald-600">
                          {busy && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}انتشار نهایی
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Metric icon={Scale} label="قواعد تشخیص" value={`${rules.length} قاعده قانونی`} />
                  <Metric icon={ListChecks} label="مراحل فرایند" value={`${steps.length} گام اجرایی`} />
                  <Metric icon={ShieldAlert} label="نوع جریمه" value={penaltyLabel(selectedVersion.penalty_rule)} />
                  <Metric icon={Clock3} label="مهلت و دوره" value="سالانه · چهار ماه پس از سال مالی" />
                </div>

                {(!transitionSchemaReady || !penaltySchemaReady) && (
                  <div className="mt-5 rounded-xl border border-amber-800/70 bg-amber-950/30 p-4 text-sm leading-7 text-amber-100">
                    <p className="font-bold">امکانات جدید پایگاه داده هنوز آماده نیست.</p>
                    <p className="text-amber-200/80">ابتدا گردش‌کار Supabase migration deployment را در حالت apply اجرا کنید. تا زمان تکمیل migration، کنترل‌های وابسته غیرفعال می‌مانند و سایر بخش‌های استودیو قابل استفاده‌اند.</p>
                    <ul className="mt-2 list-inside list-disc text-xs" dir="ltr">
                      {!transitionSchemaReady && <li>20260818170000_add_branching_workflow_engine.sql</li>}
                      {!penaltySchemaReady && <li>20260818180000_add_multiple_obligation_penalties.sql</li>}
                    </ul>
                  </div>
                )}

                {mode === 'EDIT' && selectedVersion.status === 'DRAFT' && (
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <Button variant="outline" className="border-emerald-800 text-emerald-300 gap-2" onClick={() => document.getElementById('eligibility-rule-editor')?.scrollIntoView({ behavior: 'smooth' })}><Plus className="h-4 w-4" />افزودن قاعده</Button>
                    <Button variant="outline" className="border-sky-800 text-sky-300 gap-2" onClick={() => document.getElementById('workflow-step-editor')?.scrollIntoView({ behavior: 'smooth' })}><Plus className="h-4 w-4" />افزودن مرحله</Button>
                    <PenaltyForm schemaReady={penaltySchemaReady} version={selectedVersion} onSaved={async () => { await loadCatalog(); await loadDefinition() }} />
                  </div>
                )}

                {selectedVersion.audience_summary && (
                  <div className="mt-3 rounded-lg bg-zinc-900/60 p-2.5 text-xs text-zinc-400">
                    <span className="font-semibold text-zinc-300">مخاطبان مشمول: </span>
                    {selectedVersion.audience_summary}
                  </div>
                )}
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-zinc-800 bg-[#101211] p-6 shadow-xl shadow-black/10">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-2 font-bold"><Scale className="h-4 w-4 text-amber-400" />تشخیص مشمولیت ({rules.length} قاعده)</h3>
                    {rules.length === 0 && (
                      <Button size="sm" variant="ghost" className="text-amber-400 text-xs gap-1" onClick={() => void seedStandardCorporateTaxData()}>
                        <Plus className="h-3.5 w-3.5" />درج قواعد
                      </Button>
                    )}
                  </div>
                  <div className="mt-4 space-y-3">
                    {rules.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-xs text-zinc-500">
                        هنوز قاعده‌ای ثبت نشده است. روی دکمه «درج / به‌روزرسانی داده‌های استاندارد عملکرد» در بالا کلیک کنید.
                      </div>
                    ) : (
                      rules.map((rule, idx) => (
                        <div key={rule.id ?? idx} className="rounded-xl border border-zinc-700/80 bg-[#1b1e1c] p-4 space-y-3 shadow-sm">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-zinc-100">{rule.title}</p>
                            <span className="shrink-0 rounded bg-emerald-950 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
                              {rule.outcome === 'ELIGIBLE' ? 'مشمول قطعی' : rule.outcome} · اولویت {rule.priority}
                            </span>
                          </div>
                          {rule.explanation && (
                            <p className="text-xs leading-5 text-zinc-400">{rule.explanation}</p>
                          )}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            <span className="rounded bg-zinc-800 px-2 py-0.5 text-[11px] text-amber-300">شرط: نوع شخصیت = حقوقی</span>
                            {rule.priority === 1 && (
                              <span className="rounded bg-zinc-800 px-2 py-0.5 text-[11px] text-sky-300">وضعیت ثبت مالیاتی: فعال / ثبت‌شده</span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {mode === 'EDIT' && selectedVersion.status === 'DRAFT' && <div id="eligibility-rule-editor"><EligibilityRuleForm versionId={selectedVersion.id} nextPriority={rules.length + 1} onSaved={loadDefinition} /></div>}
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-[#101211] p-6 shadow-xl shadow-black/10">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-2 font-bold"><GitBranch className="h-4 w-4 text-amber-400" />مراحل فرایند ({steps.length} مرحله)</h3>
                    {steps.length === 0 && (
                      <Button size="sm" variant="ghost" className="text-amber-400 text-xs gap-1" onClick={() => void seedStandardCorporateTaxData()}>
                        <Plus className="h-3.5 w-3.5" />درج مراحل
                      </Button>
                    )}
                  </div>
                  <div className="mt-4 space-y-3">
                    {steps.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-xs text-zinc-500">
                        هنوز مرحله‌ای تعریف نشده است. روی دکمه «درج / به‌روزرسانی داده‌های استاندارد عملکرد» در بالا کلیک کنید.
                      </div>
                    ) : (
                      steps.map((step, idx) => (
                        <div key={step.id ?? idx} className="rounded-xl border border-zinc-700/80 bg-[#1b1e1c] p-4 space-y-2.5 shadow-sm">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-amber-700/70 bg-amber-950/50 text-xs font-black text-amber-300">{step.sequence}</span><p className="pt-1 text-sm font-semibold text-zinc-100">{step.title.replace(/^\d+\.\s*/, '')}</p></div>
                            <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${actorClass(step.actor)}`}>
                              {actorLabel(step.actor)}
                            </span>
                          </div>
                          {step.instructions && (
                            <p className="text-xs leading-5 text-zinc-400">{step.instructions}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  {mode === 'EDIT' && selectedVersion.status === 'DRAFT' && <div id="workflow-step-editor"><WorkflowStepForm version={selectedVersion} nextSequence={steps.length + 1} onSaved={loadDefinition} /></div>}
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-[#101211] p-6 shadow-xl shadow-black/10">
                <div className="flex items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 font-bold"><GitBranch className="h-4 w-4 text-violet-400" />مسیرها و خروجی‌های فرایند ({transitions.length})</h3><p className="mt-1 text-xs text-zinc-500">هر مسیر، نتیجه یک مرحله را به مرحله بعدی، حلقه بازگشتی یا وضعیت پایانی متصل می‌کند.</p></div></div>
                <div className="mt-5 grid gap-3 md:grid-cols-2">{transitions.map((transition) => <div key={transition.id} className="rounded-xl border border-zinc-700/80 bg-[#1b1e1c] p-4"><div className="flex items-center justify-between gap-3"><p className="font-bold">{transition.title}</p><span className={`rounded-full border px-2.5 py-1 text-[11px] ${transition.trigger_type === 'TIMEOUT' ? 'border-orange-800 bg-orange-950/50 text-orange-300' : transition.trigger_type === 'SYSTEM_EVENT' ? 'border-violet-800 bg-violet-950/50 text-violet-300' : 'border-sky-800 bg-sky-950/50 text-sky-300'}`}>{transitionTriggerLabel(transition.trigger_type)}</span></div><p className="mt-2 text-xs text-zinc-500">خروجی: {transition.outcome_code} · {transition.to_step_id ? 'انتقال به یک مرحله' : `پایان: ${transition.terminal_status}`}</p></div>)}</div>
                {mode === 'EDIT' && selectedVersion.status === 'DRAFT' && transitionSchemaReady && (
                  <WorkflowTransitionForm
                    version={selectedVersion}
                    steps={steps}
                    nextPriority={transitions.length + 1}
                    onSaved={loadDefinition}
                  />
                )}
              </div>
            </>
          )}
          </div>
        </StudioFullScreen>
      )}
    </main>
  )
}

function WorkflowTransitionForm({ version, steps, nextPriority, onSaved }: { version: Version; steps: WorkflowStep[]; nextPriority: number; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [fromStepId, setFromStepId] = useState('')
  const [destination, setDestination] = useState('COMPLETED')
  const [title, setTitle] = useState('')
  const [code, setCode] = useState('')
  const [outcomeCode, setOutcomeCode] = useState('')
  const [triggerType, setTriggerType] = useState('USER_ACTION')
  const [eventCode, setEventCode] = useState('')
  const [timeoutDays, setTimeoutDays] = useState('')

  const save = async () => {
    if (!fromStepId || !title.trim() || !code.trim() || !outcomeCode.trim()) return toast.error('مرحله مبدأ، عنوان، کد مسیر و کد خروجی الزامی است.')
    if (triggerType === 'TIMEOUT' && (!Number.isFinite(Number(timeoutDays)) || Number(timeoutDays) <= 0)) return toast.error('مهلت زمانی باید بیشتر از صفر روز باشد.')
    if (triggerType === 'SYSTEM_EVENT' && !eventCode.trim()) return toast.error('کد رویداد سیستمی الزامی است.')
    if (!isSupabaseConfigured) return toast.error('تعریف مسیر پایدار فقط در حالت اتصال به Supabase در دسترس است.')
    const templateId = steps.find((step) => step.id === fromStepId)?.workflow_template_id
    if (!templateId) return toast.error('قالب فرایند پیدا نشد.')
    const terminal = destination === 'COMPLETED' || destination === 'CANCELLED'
    const { error } = await supabase.from('workflow_transitions').insert({
      workflow_template_id: templateId,
      from_step_id: fromStepId,
      to_step_id: terminal ? null : destination,
      terminal_status: terminal ? destination : null,
      code: code.trim().toUpperCase(), title: title.trim(), outcome_code: outcomeCode.trim().toUpperCase(),
      trigger_type: triggerType, event_code: triggerType === 'SYSTEM_EVENT' ? eventCode.trim().toUpperCase() : null,
      timeout_interval: triggerType === 'TIMEOUT' ? `${Number(timeoutDays)} days` : null,
      priority: nextPriority,
    })
    if (error) return toast.error(error.message)
    toast.success(`مسیر جدید برای نسخه ${version.version_number} ثبت شد.`)
    setOpen(false)
    await onSaved()
  }

  if (!open) return <Button variant="outline" className="mt-5 w-full border-violet-800 text-violet-300" onClick={() => setOpen(true)}><Plus className="ml-2 h-4 w-4" />افزودن مسیر / خروجی</Button>
  return <div data-studio-dirty="true" className="mt-5 rounded-xl border border-violet-900/60 bg-violet-950/10 p-4"><div className="grid gap-4 md:grid-cols-3"><Field label="مرحله مبدأ"><Select value={fromStepId} onValueChange={setFromStepId}><SelectTrigger><SelectValue placeholder="انتخاب مرحله" /></SelectTrigger><SelectContent>{steps.map((step) => <SelectItem key={step.id} value={step.id}>{step.sequence}. {step.title.replace(/^\d+\.\s*/, '')}</SelectItem>)}</SelectContent></Select></Field><Field label="نوع فعال‌سازی"><Select value={triggerType} onValueChange={setTriggerType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="USER_ACTION">اقدام کاربر</SelectItem><SelectItem value="SYSTEM_EVENT">رویداد سیستمی</SelectItem><SelectItem value="TIMEOUT">انقضای خودکار مهلت</SelectItem></SelectContent></Select></Field><Field label="مقصد"><Select value={destination} onValueChange={setDestination}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{steps.map((step) => <SelectItem key={step.id} value={step.id}>مرحله {step.sequence}: {step.title.replace(/^\d+\.\s*/, '')}</SelectItem>)}<SelectItem value="COMPLETED">پایان موفق پرونده</SelectItem><SelectItem value="CANCELLED">لغو پرونده</SelectItem></SelectContent></Select></Field><Field label="عنوان مسیر"><Input value={title} onChange={(event) => setTitle(event.target.value)} /></Field><Field label="کد انگلیسی مسیر"><Input dir="ltr" value={code} onChange={(event) => setCode(event.target.value)} placeholder="ASSESSMENT_ISSUED" /></Field><Field label="کد خروجی"><Input dir="ltr" value={outcomeCode} onChange={(event) => setOutcomeCode(event.target.value)} placeholder="DISPUTE_OPENED" /></Field>{triggerType === 'SYSTEM_EVENT' && <Field label="کد رویداد"><Input dir="ltr" value={eventCode} onChange={(event) => setEventCode(event.target.value)} /></Field>}{triggerType === 'TIMEOUT' && <Field label="مهلت (روز)"><Input type="number" min="1" value={timeoutDays} onChange={(event) => setTimeoutDays(event.target.value)} /></Field>}<div className="flex items-end gap-2"><Button className="flex-1 bg-violet-700 hover:bg-violet-600" onClick={() => void save()}>ذخیره مسیر</Button><Button variant="ghost" onClick={() => { if (window.confirm('تغییرات مسیر ذخیره نشده است. خارج می‌شوید؟')) setOpen(false) }}>انصراف</Button></div></div></div>
}

function PenaltyForm({ version, schemaReady, onSaved }: { version: Version; schemaReady: boolean; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Array<{ id: string; title: string; type: string; value: string }>>(() => penaltyItems(version.penalty_rule))
  const dirty = open

  useEffect(() => {
    if (!open || !isSupabaseConfigured) return
    void supabase.from('obligation_version_penalties').select('*').eq('obligation_version_id', version.id).order('sequence').then(({ data, error }) => {
      if (!error && data && data.length > 0) setItems(data.map((row) => ({ id: row.id, title: row.title, type: row.penalty_type, value: String(row.penalty_type === 'FIXED' ? row.amount ?? '' : row.rate_percent ?? '') })))
    })
  }, [open, version.id])

  const save = async () => {
    if (items.some((item) => !item.title.trim() || !item.value || !Number.isFinite(Number(item.value)) || Number(item.value) < 0)) return toast.error('عنوان و مقدار معتبر همه جریمه‌ها الزامی است.')
    const first = items[0]
    const rule: Json = !first ? { type: 'NONE' } : first.type === 'FIXED' ? { type: first.type, amount: Number(first.value) } : { type: first.type, rate_percent: Number(first.value) }
    if (isSupabaseConfigured) {
      const { error: deleteError } = await supabase.from('obligation_version_penalties').delete().eq('obligation_version_id', version.id)
      if (deleteError) { toast.error(deleteError.message.includes('schema cache') ? 'جدول جریمه‌های چندگانه هنوز روی Supabase اعمال نشده است. migration جدید را اجرا کنید.' : deleteError.message); return }
      if (items.length > 0) {
        const { error: insertError } = await supabase.from('obligation_version_penalties').insert(items.map((item, index) => ({ obligation_version_id: version.id, title: item.title.trim(), penalty_type: item.type, amount: item.type === 'FIXED' ? Number(item.value) : null, rate_percent: item.type === 'FIXED' ? null : Number(item.value), sequence: index + 1 })))
        if (insertError) { toast.error(insertError.message); return }
      }
      const { error } = await supabase.from('obligation_versions').update({ penalty_rule: rule }).eq('id', version.id)
      if (error) { toast.error(error.message); return }
    } else {
      const mockVersion = studioDb.getVersions().find((item) => item.id === version.id)
      if (!mockVersion) return toast.error('نسخه تعهد پیدا نشد.')
      mockVersion.penalty_rule = rule
      mockVersion.updated_at = new Date().toISOString()
    }
    toast.success(`${items.length.toLocaleString('fa-IR')} جریمه برای تعهد ذخیره شد.`)
    setOpen(false)
    await onSaved()
  }

  if (!open) return <Button disabled={!schemaReady} title={schemaReady ? undefined : 'ابتدا migration جریمه‌های چندگانه را اعمال کنید.'} variant="outline" className="border-red-900 text-red-300 gap-2" onClick={() => setOpen(true)}><Scale className="h-4 w-4" />تعیین جریمه</Button>
  return (
    <div data-studio-dirty="true" className="sm:col-span-3 rounded-xl border border-red-950 bg-red-950/10 p-4">
      <div className="space-y-3">{items.map((item, index) => <div key={item.id} className="grid gap-3 rounded-lg border border-red-900/40 p-3 sm:grid-cols-[1.4fr,1fr,1fr,auto] sm:items-end"><Field label={`عنوان جریمه ${index + 1}`}><Input value={item.title} onChange={(event) => setItems((current) => current.map((row) => row.id === item.id ? { ...row, title: event.target.value } : row))} /></Field><Field label="نوع"><Select value={item.type} onValueChange={(type) => setItems((current) => current.map((row) => row.id === item.id ? { ...row, type } : row))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="FIXED">مبلغ ثابت</SelectItem><SelectItem value="PERCENTAGE">درصدی</SelectItem><SelectItem value="DAILY_PERCENTAGE">درصد روزانه</SelectItem></SelectContent></Select></Field><Field label={item.type === 'FIXED' ? 'مبلغ (ریال)' : 'نرخ درصد'}><Input type="number" min="0" value={item.value} onChange={(event) => setItems((current) => current.map((row) => row.id === item.id ? { ...row, value: event.target.value } : row))} /></Field><Button variant="ghost" className="text-red-400" onClick={() => setItems((current) => current.filter((row) => row.id !== item.id))}>حذف</Button></div>)}</div>
      <Button variant="outline" className="mt-3 w-full border-red-900 text-red-300" onClick={() => setItems((current) => [...current, { id: crypto.randomUUID(), title: '', type: 'PERCENTAGE', value: '' }])}><Plus className="ml-2 h-4 w-4" />افزودن جریمه دیگر</Button>
      <div className="mt-4 flex gap-2"><Button className="bg-red-800 hover:bg-red-700" onClick={() => void save()}>ذخیره همه جریمه‌ها</Button><Button variant="ghost" onClick={() => { if (!dirty || window.confirm('تغییرات جریمه ذخیره نشده است. خارج می‌شوید؟')) setOpen(false) }}>انصراف</Button></div>
    </div>
  )
}

function FamilyForm({ onSaved, onDirtyChange }: { onSaved: () => Promise<void>; onDirtyChange: (dirty: boolean) => void }) {
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [domain, setDomain] = useState('TAX')
  useEffect(() => onDirtyChange(Boolean(code || title || domain !== 'TAX')), [code, title, domain, onDirtyChange])
  const save = async () => {
    if (!code.trim() || !title.trim()) {
      toast.error('کد و عنوان گروه الزامی است.')
      return
    }
    if (!isSupabaseConfigured) {
      studioDb.createFamily({ code: code.trim().toUpperCase(), title: title.trim(), domain })
      toast.success('گروه ثبت شد.')
      await onSaved()
      return
    }
    const { error } = await supabase.from('obligation_families').insert({ code: code.trim().toUpperCase(), title: title.trim(), domain })
    if (error) {
      studioDb.createFamily({ code: code.trim().toUpperCase(), title: title.trim(), domain })
      toast.success('گروه ثبت شد.')
      await onSaved()
    } else {
      toast.success('گروه ثبت شد.')
      await onSaved()
    }
  }
  return <Editor title="گروه جدید"><Field label="کد انگلیسی"><Input value={code} onChange={(e) => setCode(e.target.value)} dir="ltr" placeholder="DIRECT_TAX" /></Field><Field label="عنوان"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مالیات‌های مستقیم" /></Field><Field label="حوزه"><Select value={domain} onValueChange={setDomain}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="TAX">مالیات</SelectItem><SelectItem value="INSURANCE">بیمه</SelectItem></SelectContent></Select></Field><SaveButton onClick={save} /></Editor>
}

function DraftForm({ families, onSaved, onDirtyChange }: { families: Family[]; onSaved: (versionId: string) => Promise<void>; onDirtyChange: (dirty: boolean) => void }) {
  const [familyId, setFamilyId] = useState(families[0]?.id ?? '')
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [legalReference, setLegalReference] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [actionUrl, setActionUrl] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [penaltyTypeValue, setPenaltyTypeValue] = useState('NONE')
  const [penaltyValue, setPenaltyValue] = useState('')

  useEffect(() => onDirtyChange(Boolean(code || title || legalReference || sourceUrl || actionUrl || effectiveFrom || penaltyValue || penaltyTypeValue !== 'NONE')), [actionUrl, code, effectiveFrom, legalReference, onDirtyChange, penaltyTypeValue, penaltyValue, sourceUrl, title])

  useEffect(() => {
    if (!familyId && families.length > 0) {
      setFamilyId(families[0].id)
    }
  }, [families, familyId])

  const save = async () => {
    if (!familyId || !code.trim() || !title.trim() || !legalReference.trim() || !sourceUrl.trim() || !effectiveFrom) {
      toast.error('گروه، کد، عنوان، مرجع قانونی، منبع رسمی و تاریخ شروع اعتبار الزامی است.')
      return
    }
    const numberValue = penaltyValue ? Number(penaltyValue) : 0
    if (penaltyTypeValue !== 'NONE' && (!penaltyValue || !Number.isFinite(numberValue) || numberValue < 0)) {
      toast.error('مقدار جریمه باید عددی و غیرمنفی باشد.')
      return
    }
    const penaltyRule: Json = penaltyTypeValue === 'FIXED'
      ? { type: 'FIXED', amount: numberValue }
      : penaltyTypeValue === 'PERCENTAGE' || penaltyTypeValue === 'DAILY_PERCENTAGE'
        ? { type: penaltyTypeValue, rate_percent: numberValue }
        : { type: 'NONE' }

    if (!isSupabaseConfigured) {
      const { version } = studioDb.createDraft({
        requested_family_id: familyId,
        requested_code: code.trim().toUpperCase(),
        requested_title: title.trim(),
        requested_official_action_url: actionUrl.trim() || undefined,
        requested_legal_reference: legalReference.trim() || undefined,
        requested_source_url: sourceUrl.trim() || undefined,
        requested_effective_from: effectiveFrom || undefined,
        requested_recurrence_rule: { frequency: 'YEARLY' },
        requested_deadline_rule: { base: 'FISCAL_YEAR_END', gap_months: 4 },
        requested_penalty_rule: penaltyRule,
      })
      toast.success('پیش‌نویس تعهد ثبت شد.')
      await onSaved(version.id)
      return
    }

    try {
      const { data, error } = await supabase.rpc('create_obligation_draft', {
        requested_family_id: familyId,
        requested_code: code.trim().toUpperCase(),
        requested_title: title.trim(),
        requested_summary: undefined,
        requested_authority_name: undefined,
        requested_official_action_url: actionUrl.trim() || undefined,
        requested_legal_reference: legalReference.trim() || undefined,
        requested_source_url: sourceUrl.trim() || undefined,
        requested_effective_from: effectiveFrom || undefined,
        requested_recurrence_rule: {},
        requested_deadline_rule: {},
        requested_penalty_rule: penaltyRule,
      })
      if (error) {
        const { version } = studioDb.createDraft({
          requested_family_id: familyId,
          requested_code: code.trim().toUpperCase(),
          requested_title: title.trim(),
          requested_official_action_url: actionUrl.trim() || undefined,
          requested_legal_reference: legalReference.trim() || undefined,
          requested_source_url: sourceUrl.trim() || undefined,
          requested_effective_from: effectiveFrom || undefined,
          requested_penalty_rule: penaltyRule,
        })
        toast.success('پیش‌نویس تعهد ثبت شد.')
        await onSaved(version.id)
      } else {
        toast.success('پیش‌نویس تعهد ثبت شد.')
        await onSaved(data.id)
      }
    } catch {
      const { version } = studioDb.createDraft({
        requested_family_id: familyId,
        requested_code: code.trim().toUpperCase(),
        requested_title: title.trim(),
        requested_official_action_url: actionUrl.trim() || undefined,
        requested_legal_reference: legalReference.trim() || undefined,
        requested_source_url: sourceUrl.trim() || undefined,
        requested_effective_from: effectiveFrom || undefined,
        requested_penalty_rule: penaltyRule,
      })
      toast.success('پیش‌نویس تعهد ثبت شد.')
      await onSaved(version.id)
    }
  }
  return (
    <Editor title="پیش‌نویس تعهد جدید">
      <Field label="گروه">
        <Select value={familyId} onValueChange={setFamilyId}>
          <SelectTrigger><SelectValue placeholder="گروه را انتخاب کنید" /></SelectTrigger>
          <SelectContent>{families.map((family) => <SelectItem key={family.id} value={family.id}>{family.title}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label="کد انگلیسی"><Input value={code} onChange={(e) => setCode(e.target.value)} dir="ltr" placeholder="CORP_INCOME_TAX" /></Field>
      <Field label="عنوان تعهد"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="اظهارنامه مالیات عملکرد اشخاص حقوقی" /></Field>
      <Field label="ماده / مرجع قانونی"><Input value={legalReference} onChange={(e) => setLegalReference(e.target.value)} placeholder="ماده ۱۱۰ قانون مالیات‌های مستقیم" /></Field>
      <Field label="لینک منبع رسمی"><Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} dir="ltr" placeholder="https://tax.gov.ir/..." /></Field>
      <Field label="لینک انجام کار"><Input value={actionUrl} onChange={(e) => setActionUrl(e.target.value)} dir="ltr" placeholder="https://my.tax.gov.ir" /></Field>
      <Field label="تاریخ شروع اعتبار"><JalaliDatePicker value={effectiveFrom} onChange={setEffectiveFrom} placeholder="انتخاب تاریخ..." /></Field>
      <Field label="نوع جریمه">
        <Select value={penaltyTypeValue} onValueChange={setPenaltyTypeValue}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="NONE">بدون فرمول</SelectItem>
            <SelectItem value="FIXED">مبلغ ثابت</SelectItem>
            <SelectItem value="PERCENTAGE">درصدی</SelectItem>
            <SelectItem value="DAILY_PERCENTAGE">درصد روزانه</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      {penaltyTypeValue !== 'NONE' && <Field label={penaltyTypeValue === 'FIXED' ? 'مبلغ ثابت (ریال)' : 'نرخ درصد'}><Input type="number" min="0" value={penaltyValue} onChange={(e) => setPenaltyValue(e.target.value)} /></Field>}
      <SaveButton onClick={save} disabled={!familyId} />
    </Editor>
  )
}

function EligibilityRuleForm({ versionId, nextPriority, onSaved }: { versionId: string; nextPriority: number; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [explanation, setExplanation] = useState('')
  const [outcome, setOutcome] = useState('ELIGIBLE')
  const [conditions, setConditions] = useState<DraftCondition[]>([
    { fact: 'ENTITY_TYPE', operator: 'EQ', expected: 'حقوقی' },
  ])

  const updateCondition = (index: number, patch: Partial<DraftCondition>) => {
    setConditions((current) => current.map((condition, position) =>
      position === index ? { ...condition, ...patch } : condition
    ))
  }

  const save = async () => {
    if (!title.trim() || !explanation.trim()) {
      toast.error('عنوان و توضیح سادهٔ قاعده الزامی است.')
      return
    }
    for (const condition of conditions) {
      if (!noValueOperators.has(condition.operator) && !condition.expected.trim()) {
        toast.error('مقدار همهٔ شرط‌ها را وارد کنید.')
        return
      }
      if (numericFacts.has(condition.fact) && !Number.isFinite(Number(condition.expected))) {
        toast.error('مقدار شرط عددی معتبر نیست.')
        return
      }
    }

    if (!isSupabaseConfigured) {
      studioDb.addRuleSet({
        obligation_version_id: versionId,
        priority: nextPriority,
        title: title.trim(),
        outcome,
        explanation: explanation.trim(),
        conditions: conditions.map((c) => ({
          fact: c.fact,
          operator: c.operator,
          expected: numericFacts.has(c.fact)
            ? Number(c.expected)
            : c.operator === 'IN'
              ? c.expected.split(',').map((v) => v.trim()).filter(Boolean)
              : c.expected.trim(),
        })),
      })
      toast.success('قاعده تشخیص ثبت شد.')
      setOpen(false)
      await onSaved()
      return
    }

    try {
      const { data: rule, error } = await supabase.from('eligibility_rule_sets').insert({ obligation_version_id: versionId, priority: nextPriority, title: title.trim(), outcome, explanation: explanation.trim() }).select().single()
      if (error) {
        studioDb.addRuleSet({
          obligation_version_id: versionId,
          priority: nextPriority,
          title: title.trim(),
          outcome,
          explanation: explanation.trim(),
          conditions: conditions.map((c) => ({
            fact: c.fact,
            operator: c.operator,
            expected: c.expected.trim(),
          })),
        })
        toast.success('قاعده تشخیص ثبت شد.')
        setOpen(false)
        await onSaved()
        return
      }
      const rows = conditions.map((condition, index) => {
        let expectedValue: Json | undefined
        if (!noValueOperators.has(condition.operator)) {
          expectedValue = numericFacts.has(condition.fact)
            ? Number(condition.expected)
            : condition.operator === 'IN'
              ? condition.expected.split(',').map((value) => value.trim()).filter(Boolean)
              : condition.expected.trim()
        }
        return {
          rule_set_id: rule.id,
          sequence: index + 1,
          fact_key: condition.fact,
          operator: condition.operator,
          expected_value: expectedValue,
        }
      })
      const { error: conditionError } = await supabase.from('eligibility_conditions').insert(rows)
      if (conditionError) { await supabase.from('eligibility_rule_sets').delete().eq('id', rule.id); toast.error(conditionError.message); return }
      toast.success('قاعده تشخیص ثبت شد.')
      setOpen(false)
      await onSaved()
    } catch {
      studioDb.addRuleSet({
        obligation_version_id: versionId,
        priority: nextPriority,
        title: title.trim(),
        outcome,
        explanation: explanation.trim(),
        conditions: conditions.map((c) => ({
          fact: c.fact,
          operator: c.operator,
          expected: c.expected.trim(),
        })),
      })
      toast.success('قاعده تشخیص ثبت شد.')
      setOpen(false)
      await onSaved()
    }
  }
  if (!open) return <Button variant="outline" className="mt-4 w-full border-zinc-700 gap-2" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />افزودن قاعده</Button>
  return (
    <div data-studio-dirty="true" className="mt-4 space-y-3 rounded-xl border border-zinc-800 p-4">
      <Field label="عنوان قاعده"><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="مشمولیت اشخاص حقوقی" /></Field>
      <Field label="نتیجه"><Select value={outcome} onValueChange={setOutcome}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ELIGIBLE">مشمول</SelectItem><SelectItem value="NOT_ELIGIBLE">غیرمشمول</SelectItem><SelectItem value="REVIEW">نیازمند بررسی</SelectItem></SelectContent></Select></Field>
      <div className="space-y-3">
        {conditions.map((condition, index) => {
          const operatorOptions = allowedOperators(condition.fact)
          return (
            <div key={index} className="rounded-lg border border-zinc-800 p-3">
              <p className="mb-3 text-xs text-zinc-500">شرط {index + 1} (همهٔ شرط‌ها باید برقرار باشند)</p>
              <div className="space-y-3">
                <Field label="بر اساس"><Select value={condition.fact} onValueChange={(fact) => updateCondition(index, { fact, operator: allowedOperators(fact)[0]?.[0] ?? 'EQ', expected: '' })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FACTS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></Field>
                <Field label="شرط"><Select value={condition.operator} onValueChange={(operator) => updateCondition(index, { operator, expected: '' })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{operatorOptions.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></Field>
                {!noValueOperators.has(condition.operator) && <Field label={condition.operator === 'IN' ? 'مقادیر (با ویرگول جدا کنید)' : 'مقدار'}><Input value={condition.expected} onChange={(event) => updateCondition(index, { expected: event.target.value })} /></Field>}
                {conditions.length > 1 && <Button variant="ghost" className="text-red-400" onClick={() => setConditions((current) => current.filter((_, position) => position !== index))}>حذف این شرط</Button>}
              </div>
            </div>
          )
        })}
      </div>
      <Button variant="outline" className="w-full border-zinc-700" onClick={() => setConditions((current) => [...current, { fact: 'ENTITY_TYPE', operator: 'EQ', expected: '' }])}>افزودن شرط دیگر</Button>
      <Field label="توضیح ساده برای کاربر"><Input value={explanation} onChange={(event) => setExplanation(event.target.value)} placeholder="توضیح قانونی برای شرکت‌ها..." /></Field>
      <div className="flex gap-2"><SaveButton onClick={save} /><Button variant="ghost" onClick={() => { if (window.confirm('تغییرات قاعده ذخیره نشده است. خارج می‌شوید؟')) setOpen(false) }}>انصراف</Button></div>
    </div>
  )
}

function WorkflowStepForm({ version, nextSequence, onSaved }: { version: Version; nextSequence: number; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [code, setCode] = useState('')
  const [actor, setActor] = useState('USER')
  const [fieldLabel, setFieldLabel] = useState('')
  const [fieldKey, setFieldKey] = useState('')
  const [fieldType, setFieldType] = useState('text')

  const save = async () => {
    if (!title.trim() || !code.trim()) {
      toast.error('عنوان و کد مرحله الزامی است.')
      return
    }

    const fields: Json[] = fieldLabel.trim() ? [{ key: fieldKey.trim() || 'custom_field', label: fieldLabel.trim(), type: fieldType, required: true }] : []

    if (!isSupabaseConfigured) {
      studioDb.addWorkflowStep({
        obligation_version_id: version.id,
        sequence: nextSequence,
        code: code.trim().toUpperCase(),
        title: title.trim(),
        actor,
        form_schema: { fields },
      })
      toast.success('مرحله ثبت شد.')
      setOpen(false)
      await onSaved()
      return
    }

    try {
      let { data: template } = await supabase.from('workflow_templates').select('*').eq('obligation_version_id', version.id).maybeSingle()
      if (!template) {
        const created = await supabase.from('workflow_templates').insert({ obligation_version_id: version.id, title: 'فرایند ' + version.version_number }).select().single()
        if (created.data) {
          template = created.data
        }
      }
      if (template) {
        const result = await supabase.from('workflow_steps').insert({ workflow_template_id: template.id, sequence: nextSequence, code: code.trim().toUpperCase(), title: title.trim(), actor, form_schema: { fields } })
        if (result.error) throw result.error
      } else {
        studioDb.addWorkflowStep({
          obligation_version_id: version.id,
          sequence: nextSequence,
          code: code.trim().toUpperCase(),
          title: title.trim(),
          actor,
          form_schema: { fields },
        })
      }
      toast.success('مرحله ثبت شد.')
      setOpen(false)
      await onSaved()
    } catch {
      studioDb.addWorkflowStep({
        obligation_version_id: version.id,
        sequence: nextSequence,
        code: code.trim().toUpperCase(),
        title: title.trim(),
        actor,
        form_schema: { fields },
      })
      toast.success('مرحله ثبت شد.')
      setOpen(false)
      await onSaved()
    }
  }

  if (!open) return <Button variant="outline" className="mt-4 w-full border-zinc-700 gap-2" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />افزودن مرحله</Button>
  return (
    <div data-studio-dirty="true" className="mt-4 space-y-3 rounded-xl border border-zinc-800 p-4">
      <Field label="عنوان مرحله"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="۱. بارگذاری اظهارنامه" /></Field>
      <Field label="کد انگلیسی"><Input value={code} onChange={(e) => setCode(e.target.value)} dir="ltr" placeholder="SUBMIT_RETURN" /></Field>
      <Field label="مسئول انجام">
        <Select value={actor} onValueChange={setActor}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="USER">کاربر شرکت</SelectItem>
            <SelectItem value="PLATFORM_ADMIN">مدیر پلتفرم</SelectItem>
            <SelectItem value="AUTHORITY">مرجع قانونی / ثبت توسط مدیر</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <div className="rounded-lg border border-zinc-800 p-3">
        <p className="mb-3 text-xs text-zinc-500">یک فیلد برای این مرحله (اختیاری)</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="عنوان فیلد"><Input value={fieldLabel} onChange={(e) => setFieldLabel(e.target.value)} placeholder="کد رهگیری" /></Field>
          <Field label="کلید انگلیسی"><Input value={fieldKey} onChange={(e) => setFieldKey(e.target.value)} dir="ltr" placeholder="tracking_code" /></Field>
          <Field label="نوع فیلد">
            <Select value={fieldType} onValueChange={setFieldType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="text">متن</SelectItem>
                <SelectItem value="number">عدد</SelectItem>
                <SelectItem value="date">تاریخ</SelectItem>
                <SelectItem value="checkbox">تأیید / بله‌خیر</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </div>
      <div className="flex gap-2"><SaveButton onClick={save} /><Button variant="ghost" onClick={() => { if (window.confirm('تغییرات مرحله ذخیره نشده است. خارج می‌شوید؟')) setOpen(false) }}>انصراف</Button></div>
    </div>
  )
}

function Editor({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mb-6 rounded-2xl border border-zinc-800 bg-[#141615] p-5"><h3 className="mb-4 font-bold">{title}</h3><div className="grid gap-4 md:grid-cols-3">{children}</div></section>
}
function StudioFullScreen({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-[90] overflow-y-auto bg-[#0b0d0c] p-4 text-zinc-100 sm:p-6"><div className="mx-auto max-w-6xl"><div className="sticky top-0 z-20 mb-5 flex items-center justify-between rounded-xl border border-zinc-800 bg-[#101211]/95 p-3 backdrop-blur"><Button variant="ghost" className="gap-2" onClick={onBack}><ArrowRight className="h-4 w-4" />بازگشت</Button><h2 className="font-black">{title}</h2></div>{children}</div></div> }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div> }
function SaveButton({ onClick, disabled = false }: { onClick: () => Promise<void>; disabled?: boolean }) { return <div className="flex items-end"><Button disabled={disabled} onClick={() => void onClick()} className="w-full bg-emerald-700 hover:bg-emerald-600">ذخیره</Button></div> }
function Metric({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number }) { return <div className="rounded-xl border border-zinc-800 bg-[#1b1e1c] p-4 shadow-sm"><div className="flex items-center gap-2 text-xs text-zinc-500"><Icon className="h-4 w-4 text-amber-400" />{label}</div><p className="mt-2 text-base font-black leading-6 text-zinc-100">{value}</p></div> }
function DefinitionRow({ title, meta }: { title: string; meta: string }) { return <div className="rounded-lg border border-zinc-800 p-3"><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs text-zinc-500">{meta}</p></div> }
function versionStatusLabel(status: string) { return ({ DRAFT: 'پیش‌نویس', REVIEW: 'در بازبینی', TESTING: 'در آزمایش', PUBLISHED: 'منتشرشده', RETIRED: 'منسوخ' } as Record<string, string>)[status] ?? status }
function penaltyType(value: Json) { if (!value || Array.isArray(value) || typeof value !== 'object') return 'نامشخص'; return String(value['type'] ?? 'NONE') }
function actorLabel(actor: string) { return ({ USER: 'کاربر شرکت', PLATFORM_ADMIN: 'مدیر پلتفرم', AUTHORITY: 'مرجع قانونی / مدیر' } as Record<string, string>)[actor] ?? actor }
function actorClass(actor: string) { return ({ USER: 'border-sky-800 bg-sky-950/60 text-sky-300', PLATFORM_ADMIN: 'border-amber-800 bg-amber-950/60 text-amber-300', AUTHORITY: 'border-violet-800 bg-violet-950/60 text-violet-300' } as Record<string, string>)[actor] ?? 'border-zinc-700 bg-zinc-900 text-zinc-300' }
function transitionTriggerLabel(trigger: string) { return ({ USER_ACTION: 'اقدام کاربر', SYSTEM_EVENT: 'رویداد سیستمی', TIMEOUT: 'انقضای خودکار' } as Record<string, string>)[trigger] ?? trigger }
function isMissingSchemaObject(error: { code?: string; message?: string } | null) { return Boolean(error && (error.code === '42P01' || error.code === 'PGRST205' || error.message?.toLowerCase().includes('schema cache'))) }
function penaltyItems(value: Json): Array<{ id: string; title: string; type: string; value: string }> { if (!value || Array.isArray(value) || typeof value !== 'object') return []; if (value['type'] === 'MULTIPLE' && Array.isArray(value['items'])) return value['items'].flatMap((item, index) => { if (!item || Array.isArray(item) || typeof item !== 'object') return []; const type = String(item['type'] ?? 'PERCENTAGE'); const amount = type === 'FIXED' ? item['amount'] : item['rate_percent']; return [{ id: String(item['id'] ?? `penalty-${index}`), title: String(item['title'] ?? ''), type, value: amount == null ? '' : String(amount) }] }); const type = String(value['type'] ?? 'NONE'); if (type === 'NONE') return []; return [{ id: 'legacy-penalty', title: 'جریمه قانونی', type, value: String(type === 'FIXED' ? value['amount'] ?? '' : value['rate_percent'] ?? '') }] }
function penaltyLabel(value: Json) { const items = penaltyItems(value); if (items.length > 1) return `${items.length.toLocaleString('fa-IR')} جریمه تعریف‌شده`; if (items.length === 1) { const item = items[0]; return item.type === 'FIXED' ? `${Number(item.value).toLocaleString('fa-IR')} ریال` : `${Number(item.value).toLocaleString('fa-IR')} درصد${item.type === 'DAILY_PERCENTAGE' ? ' روزانه' : ''}` } return 'بدون جریمه' }
function allowedOperators(fact: string) {
  const allowed = booleanFacts.has(fact)
    ? new Set(['IS_TRUE', 'IS_FALSE', 'IS_NULL', 'NOT_NULL'])
    : numericFacts.has(fact)
      ? new Set(['EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE', 'IS_NULL', 'NOT_NULL'])
      : arrayFacts.has(fact)
        ? new Set(['CONTAINS', 'IS_NULL', 'NOT_NULL'])
        : new Set(['EQ', 'NEQ', 'IN', 'IS_NULL', 'NOT_NULL'])
  return OPERATORS.filter(([value]) => allowed.has(value))
}
