import { useCallback, useEffect, useMemo, useState } from 'react'
import WorkflowStepsModalV2 from './WorkflowStepsModalV2'
import PublishReadinessWorkflowModal from './PublishReadinessWorkflowModal'

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
  FolderTree,
  FolderPlus,
  Search,
  Check,
  X,
  Target,
  Rocket,
  Layers,
  SlidersHorizontal,
  ClipboardCheck,
  MessageSquare,
  UserCheck,
  Inbox,
  Copy,
  Archive,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import type { Json, Tables } from '../../lib/database.types'
import { Button } from '../../lib/shadcn/button'
import { Input } from '../../lib/shadcn/input'
import { Label } from '../../lib/shadcn/label'
import { Switch } from '../../lib/shadcn/switch'
import { Badge } from '../../lib/shadcn/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../lib/shadcn/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../lib/shadcn/table'
import DeleteGuardModal from '../../components/DeleteGuardModal'
import KeyRegistryField from '../../components/KeyRegistryField'
import JalaliDatePicker from '../../components/JalaliDatePicker'

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

const OBLIGATION_TYPE_OPTIONS = [
  ['TAX_CORPORATE', 'مالیات بر عملکرد اشخاص حقوقی'],
  ['TAX_INDIVIDUAL', 'مالیات بر عملکرد اشخاص حقیقی'],
  ['VAT', 'مالیات بر ارزش افزوده'],
  ['PAYROLL_TAX', 'مالیات بر حقوق'],
  ['TAX_DUTIES', 'مالیات تکلیفی'],
  ['CLAIM_169', 'مطالبه ۱۶۹ مکرر'],
  ['INS_CONTRACT', 'حق بیمه قراردادها'],
  ['INS_AUDIT', 'حسابرسی بیمه'],
] as const
const RECURRENCE_OPTIONS = ['سالانه', 'فصلی', 'ماهانه', 'موردی/رویداد محور', 'یک‌بار برای همیشه']
const BASE_EVENT_OPTIONS = ['پایان سال مالی مودی', 'پایان دوره فصلی', 'پایان ماه شمسی', 'تاریخ ابلاغ برگ/اخطاریه', 'تاریخ وقوع رویداد', 'تاریخ ثبت اعتراض توسط مودی', 'تاریخ صدور صورتحساب', 'تاریخ صدور رأی/ابلاغیه']
const PHASE_GROUP_OPTIONS = ['مرحله قبل از اظهارنامه', 'مرحله اظهارنامه', 'مرحله پس از اظهارنامه', 'مرحله رسیدگی', 'مرحله اعتراض', 'مرحله اجرا']

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
  const [reviewRequests, setReviewRequests] = useState<any[]>([])
  const [showFamilyForm, setShowFamilyForm] = useState(false)
  const [showDraftForm, setShowDraftForm] = useState(false)
  const [mode, setMode] = useState<StudioMode>('LIST')
  const [definitionCounts, setDefinitionCounts] = useState<Record<string, { rules: number; steps: number }>>({})
  const [transitionSchemaReady, setTransitionSchemaReady] = useState(true)
  const [penaltySchemaReady, setPenaltySchemaReady] = useState(true)
  const [familyDirty, setFamilyDirty] = useState(false)
  const [draftDirty, setDraftDirty] = useState(false)
  const [editingRule, setEditingRule] = useState<RuleSet | null>(null)
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null)
  const [activeSubModule, setActiveSubModule] = useState<
    | 'CLASSIFICATION'
    | 'RECURRENCE'
    | 'SCOPE'
    | 'PUBLISH_READINESS'
    | 'ELIGIBILITY'
    | 'WORKFLOW_STEPS'
    | 'TRANSITIONS'
    | null
  >(null)
  const [ruleConditions, setRuleConditions] = useState<Record<string, any[]>>({})
  const [deleteObligationGuard, setDeleteObligationGuard] = useState<{
    isOpen: boolean
    item: CatalogItem | null
    dependencies: Array<{ formName: string; details: string; iconType?: 'extension' | 'penalty' | 'workflow' | 'template' | 'obligation' }>
    isDeleting: boolean
    hasPublished: boolean
  }>({
    isOpen: false,
    item: null,
    dependencies: [],
    isDeleting: false,
    hasPublished: false,
  })
  const [deleteRuleGuard, setDeleteRuleGuard] = useState<{
    isOpen: boolean
    rule: RuleSet | null
    isDeleting: boolean
  }>({
    isOpen: false,
    rule: null,
    isDeleting: false,
  })
  const [deleteStepGuard, setDeleteStepGuard] = useState<{
    isOpen: boolean
    step: WorkflowStep | null
    dependencies: Array<{ formName: string; details: string; iconType?: 'extension' | 'penalty' | 'workflow' | 'template' | 'obligation' }>
    isDeleting: boolean
  }>({
    isOpen: false,
    step: null,
    dependencies: [],
    isDeleting: false,
  })

  const selectedVersion = useMemo(
    () => catalog.flatMap((item) => item.versions).find((version) => version.id === selectedVersionId) ?? null,
    [catalog, selectedVersionId]
  )

  const selectedCatalogItem = useMemo(
    () => catalog.find((item) => item.versions.some((version) => version.id === selectedVersionId)) ?? null,
    [catalog, selectedVersionId]
  )

  const closeDetails = () => {
    const hasOpenEditor = document.querySelector('[data-studio-dirty="true"]') !== null
    if (hasOpenEditor && !window.confirm('تغییرات ذخیره‌نشده وجود دارد. بدون ذخیره خارج می‌شوید؟')) return
    setMode('LIST'); setSelectedVersionId(null)
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

  const handleDeleteObligationClick = (item: CatalogItem) => {
    const deps: Array<{ formName: string; details: string; iconType?: 'extension' | 'penalty' | 'workflow' | 'template' | 'obligation' }> = []
    if (item.versions.length > 0) {
      deps.push({
        formName: 'نسخه‌های تعهد',
        details: `${item.versions.length} نسخه تعریف‌شده قانونی`,
        iconType: 'template',
      })
    }
    setDeleteObligationGuard({
      isOpen: true,
      item,
      dependencies: deps,
      isDeleting: false,
      hasPublished: item.versions.some((v) => v.status === 'PUBLISHED' || v.status === 'RETIRED'),
    })
  }

  const confirmDeleteObligation = async () => {
    const item = deleteObligationGuard.item
    if (!item) return
    
    if (deleteObligationGuard.hasPublished) {
      toast.error('این تعهد دارای نسخه منتشرشده یا منسوخ است و طبق قواعد تغییرناپذیری داده‌های حقوقی قابل حذف نیست.')
      return
    }

    const targetObligationId = item.obligation.id
    const targetTitle = item.obligation.title

    if (!isSupabaseConfigured) {
      toast.error('برای حذف تعهد اتصال Supabase الزامی است.')
      return
    }

    // Delete related rows in Supabase, then refresh the local view.
    setDeleteObligationGuard((g) => ({ ...g, isDeleting: true }))
    try {
      const versionIds = item.versions.map((v) => v.id)

      let templateIds: string[] = []
      let ruleSetIds: string[] = []
      if (versionIds.length > 0) {
        const [tmplRes, rulesRes] = await Promise.all([
          supabase.from('workflow_templates').select('id').in('obligation_version_id', versionIds),
          supabase.from('eligibility_rule_sets').select('id').in('obligation_version_id', versionIds),
        ])
        if (tmplRes.error) throw new Error('دریافت قالب‌های فرایند ناموفق بود: ' + tmplRes.error.message)
        if (rulesRes.error) throw new Error('دریافت قواعد مشمولیت ناموفق بود: ' + rulesRes.error.message)
        templateIds = (tmplRes.data ?? []).map((t) => t.id)
        ruleSetIds = (rulesRes.data ?? []).map((r) => r.id)

        if (ruleSetIds.length > 0) {
          const cRes = await supabase.from('eligibility_conditions').delete().in('rule_set_id', ruleSetIds)
          if (cRes.error) throw new Error('حذف شرایط مشمولیت ناموفق بود: ' + cRes.error.message)
          const rRes = await supabase.from('eligibility_rule_sets').delete().in('id', ruleSetIds)
          if (rRes.error) throw new Error('حذف قواعد مشمولیت ناموفق بود: ' + rRes.error.message)
        }

        if (templateIds.length > 0) {
          const trRes = await supabase.from('workflow_transitions').delete().in('workflow_template_id', templateIds)
          if (trRes.error) throw new Error('حذف انتقال‌ها ناموفق بود: ' + trRes.error.message)
          const stRes = await supabase.from('workflow_steps').delete().in('workflow_template_id', templateIds)
          if (stRes.error) throw new Error('حذف مراحل فرایند ناموفق بود: ' + stRes.error.message)
          const tmRes = await supabase.from('workflow_templates').delete().in('id', templateIds)
          if (tmRes.error) throw new Error('حذف قالب فرایند ناموفق بود: ' + tmRes.error.message)
        }

        const pRes = await supabase.from('obligation_version_penalties').delete().in('obligation_version_id', versionIds)
        if (pRes.error) throw new Error('حذف جرایم نسخه ناموفق بود: ' + pRes.error.message)
        const tRes = await (supabase as any).from('tenant_obligations').delete().eq('obligation_id', targetObligationId)
        if (tRes.error) throw new Error('حذف ارتباط شرکت‌ها ناموفق بود: ' + tRes.error.message)
        const vRes = await supabase.from('obligation_versions').delete().eq('obligation_id', targetObligationId)
        if (vRes.error) throw new Error('حذف نسخه‌های تعهد ناموفق بود: ' + vRes.error.message)
      } else {
        const tRes = await (supabase as any).from('tenant_obligations').delete().eq('obligation_id', targetObligationId)
        if (tRes.error) throw new Error('حذف ارتباط شرکت‌ها ناموفق بود: ' + tRes.error.message)
      }

      const oRes = await supabase.from('obligations').delete().eq('id', targetObligationId)
      if (oRes.error) throw new Error('حذف تعهد ناموفق بود: ' + oRes.error.message)

      await loadCatalog()
      setDeleteObligationGuard({ isOpen: false, item: null, dependencies: [], isDeleting: false, hasPublished: false })
      toast.success(`تعهد «${targetTitle}» به همراه موارد مرتبط حذف شد.`)
    } catch (err) {
      setDeleteObligationGuard((g) => ({ ...g, isDeleting: false }))
      toast.error(err instanceof Error ? err.message : 'حذف تعهد انجام نشد.')
    }
  }

  const handleCloneObligation = async (item: CatalogItem) => {
    const newTitle = window.prompt('عنوان تعهد جدید:', item.obligation.title + ' (کپی)')
    if (!newTitle) return
    const newCode = window.prompt('کد تعهد جدید:', item.obligation.code + '-copy')
    if (!newCode) return
    setBusy(true)
    try {
      if (isSupabaseConfigured) {
        // For Supabase: clone via individual inserts
        const { data: newObligation, error: obErr } = await supabase
          .from('obligations')
          .insert({ family_id: item.obligation.family_id, code: newCode, title: newTitle, summary: item.obligation.summary, authority_name: item.obligation.authority_name, official_action_url: item.obligation.official_action_url, is_active: true, created_by: 'admin' })
          .select()
          .single()
        if (obErr) throw obErr
        const latestVersion = item.versions[0]
        if (latestVersion) {
          const { data: newVersion, error: vErr } = await supabase
            .from('obligation_versions')
            .insert({ obligation_id: newObligation.id, version_number: 1, status: 'DRAFT', legal_reference: latestVersion.legal_reference, source_url: latestVersion.source_url, effective_from: latestVersion.effective_from, audience_summary: latestVersion.audience_summary, recurrence_rule: latestVersion.recurrence_rule, deadline_rule: latestVersion.deadline_rule, penalty_rule: latestVersion.penalty_rule, created_by: 'admin' })
            .select()
            .single()
          if (vErr) throw vErr
          // Clone rule sets
          const { data: ruleSets } = await supabase.from('eligibility_rule_sets').select('*').eq('obligation_version_id', latestVersion.id)
          if (ruleSets) {
            for (const rs of ruleSets) {
              const { data: newRs } = await supabase.from('eligibility_rule_sets').insert({ obligation_version_id: newVersion.id, priority: rs.priority, title: rs.title, outcome: rs.outcome, explanation: rs.explanation }).select().single()
              if (newRs) {
                const { data: conditions } = await supabase.from('eligibility_conditions').select('*').eq('rule_set_id', rs.id)
                if (conditions) {
                  const newConditions = conditions.map((c) => ({ rule_set_id: newRs.id, sequence: c.sequence, fact_key: c.fact_key, operator: c.operator, expected_value: c.expected_value }))
                  if (newConditions.length) await supabase.from('eligibility_conditions').insert(newConditions)
                }
              }
            }
          }
        }
      } else {
        throw new Error('برای کپی تعهد اتصال Supabase الزامی است.')
      }
      toast.success(`تعهد «${newTitle}» با موفقیت کپی شد.`)
      await loadCatalog()
    } catch (err) {
      toast.error('خطا در کپی تعهد: ' + (err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const loadCatalog = useCallback(async () => {
    setLoading(true)

    if (!isSupabaseConfigured) {
      toast.error('برای مشاهده کاتالوگ اتصال Supabase الزامی است.')
      setFamilies([])
      setCatalog([])
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
      const cat = (obligationResult.data ?? [])
        .map((obligation) => ({
          obligation,
          family: familyRows.find((family) => family.id === obligation.family_id) ?? null,
          versions: versionRows.filter((version) => version.obligation_id === obligation.id),
        }))
      setCatalog(cat)
      if (!selectedVersionId && versionRows.length > 0) {
        setSelectedVersionId(versionRows[0].id)
      }
    } catch (error: any) {
      toast.error(error?.message || 'دریافت اطلاعات از Supabase ناموفق بود.')
      setFamilies([])
      setCatalog([])
      return
    } finally {
      setLoading(false)
    }
  }, [selectedVersionId])

  const loadReviewRequests = useCallback(async () => {
    if (!selectedVersionId) {
      setReviewRequests([])
      return
    }
    if (!isSupabaseConfigured) {
      toast.error('برای مشاهده سوابق بازبینی اتصال Supabase الزامی است.')
      setReviewRequests([])
      return
    }
    const { data, error } = await supabase
      .from('obligation_review_requests')
      .select('*')
      .eq('obligation_version_id', selectedVersionId)
      .order('submitted_at', { ascending: false })
    if (error) {
      if (!isMissingSchemaObject(error)) toast.error(errorMessage(error, 'بارگذاری سوابق بازبینی انجام نشد.'))
      setReviewRequests([])
      return
    }
    setReviewRequests(data ?? [])
  }, [selectedVersionId])

  const loadDefinition = useCallback(async () => {
    if (!selectedVersionId) {
      setSteps([])
      setRules([])
      setTransitions([])
      setRuleConditions({})
      return
    }

    if (!isSupabaseConfigured) {
      toast.error('برای مشاهده تعریف فرایند اتصال Supabase الزامی است.')
      setSteps([])
      setRules([])
      setTransitions([])
      setRuleConditions({})
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
        throw templateResult.error ?? rulesResult.error
      }

      let fetchedSteps: WorkflowStep[] = []
      let fetchedTransitions: WorkflowTransition[] = []
      if (templateResult.data) {
        const [stepsResult, transitionResult] = await Promise.all([
          supabase.from('workflow_steps').select('*').eq('workflow_template_id', templateResult.data.id).order('sequence'),
          supabase.from('workflow_transitions').select('*').eq('workflow_template_id', templateResult.data.id).order('priority'),
        ])
        if (stepsResult.error) throw stepsResult.error
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

      setSteps(fetchedSteps)
      setRules(fetchedRules)
      setTransitions(fetchedTransitions)

      const condMap: Record<string, any[]> = {}
      if (fetchedRules.length > 0) {
        const ruleIds = fetchedRules.map((r: any) => r.id)
        const { data: condRows } = await supabase
          .from('eligibility_conditions')
          .select('*')
          .in('rule_set_id', ruleIds)
          .order('sequence')
        if (condRows) {
          condRows.forEach((c) => {
            if (!condMap[c.rule_set_id]) condMap[c.rule_set_id] = []
            condMap[c.rule_set_id].push(c)
          })
        }
      }
      setRuleConditions(condMap)
    } catch (error) {
      toast.error(errorMessage(error, 'دریافت تعریف فرایند از Supabase ناموفق بود.'))
      setSteps([])
      setRules([])
      setTransitions([])
      setRuleConditions({})
    }
  }, [selectedVersionId])

  const confirmDeleteRule = async () => {
    const rule = deleteRuleGuard.rule
    if (!rule) {
      setDeleteRuleGuard({ isOpen: false, rule: null, isDeleting: false })
      return
    }

    const targetRuleId = rule.id
    const targetTitle = rule.title
    if (!isSupabaseConfigured) {
      toast.error('برای حذف قاعده اتصال Supabase الزامی است.')
      return
    }

    try {
      const conditionsResult = await supabase.from('eligibility_conditions').delete().eq('rule_set_id', targetRuleId)
      if (conditionsResult.error) throw conditionsResult.error
      const ruleResult = await supabase.from('eligibility_rule_sets').delete().eq('id', targetRuleId)
      if (ruleResult.error) throw ruleResult.error
      setRules((prev) => prev.filter((r) => r.id !== targetRuleId))
      setRuleConditions((prev) => {
        const next = { ...prev }
        delete next[targetRuleId]
        return next
      })
      if (editingRule?.id === targetRuleId) setEditingRule(null)
      setDeleteRuleGuard({ isOpen: false, rule: null, isDeleting: false })
      toast.success(`قاعده «${targetTitle}» با موفقیت حذف شد.`)
    } catch (err) {
      toast.error(errorMessage(err, 'حذف قاعده انجام نشد.'))
    }
  }

  const confirmDeleteStep = async () => {
    const step = deleteStepGuard.step
    if (!step) {
      setDeleteStepGuard({ isOpen: false, step: null, dependencies: [], isDeleting: false })
      return
    }

    const targetStepId = step.id
    const targetTitle = step.title
    if (!isSupabaseConfigured) {
      toast.error('برای حذف مرحله اتصال Supabase الزامی است.')
      return
    }

    try {
      const transitionsResult = await supabase.from('workflow_transitions').delete().or(`from_step_id.eq.${targetStepId},to_step_id.eq.${targetStepId}`)
      if (transitionsResult.error) throw transitionsResult.error
      const stepResult = await supabase.from('workflow_steps').delete().eq('id', targetStepId)
      if (stepResult.error) throw stepResult.error
      setSteps((prev) => prev.filter((s) => s.id !== targetStepId))
      setTransitions((prev) => prev.filter((t) => t.from_step_id !== targetStepId && t.to_step_id !== targetStepId))
      if (editingStep?.id === targetStepId) setEditingStep(null)
      setDeleteStepGuard({ isOpen: false, step: null, dependencies: [], isDeleting: false })
      toast.success(`مرحله «${targetTitle}» با موفقیت حذف شد.`)
    } catch (err) {
      toast.error(errorMessage(err, 'حذف مرحله انجام نشد.'))
    }
  }

  useEffect(() => {
    let cancelled = false
    const loadCounts = async () => {
      const versionIds = catalog.flatMap((item) => item.versions.map((version) => version.id))
      if (versionIds.length === 0) {
        setDefinitionCounts({})
        return
      }
      if (!isSupabaseConfigured) {
        if (!cancelled) setDefinitionCounts({})
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
  useEffect(() => { void loadReviewRequests() }, [loadReviewRequests])

  const repairReviewRequest = async () => {
    if (!selectedVersionId) return
    await transitionStatus('DRAFT', 'نسخه برای ایجاد درخواست رسمی به پیش‌نویس برگشت.')
    await submitForReview()
  }

  const submitForReview = async () => {
    if (!selectedVersionId) return
    setBusy(true)
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.rpc('submit_obligation_version_for_review', {
          requested_version_id: selectedVersionId,
        })
        if (error) throw error
      } else {
        throw new Error('برای ثبت درخواست بازبینی اتصال Supabase الزامی است.')
      }
      toast.success('درخواست بازبینی ثبت شد و در کارتابل بازبین قرار گرفت.')
      await Promise.all([loadCatalog(), loadDefinition(), loadReviewRequests()])
    } catch (err) {
      toast.error(errorMessage(err, 'ثبت درخواست بازبینی انجام نشد.'))
    } finally {
      setBusy(false)
    }
  }

  const startReview = async () => {
    const request = reviewRequests.find((item) => item.status === 'REQUESTED')
    if (!request) {
      toast.error('درخواست در صف بازبینی پیدا نشد.')
      return
    }
    setBusy(true)
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.rpc('start_obligation_review', { requested_review_id: request.id })
        if (error) throw error
      } else {
        throw new Error('برای شروع بازبینی اتصال Supabase الزامی است.')
      }
      toast.success('درخواست بازبینی به کارتابل شما منتقل شد.')
      await loadReviewRequests()
    } catch (err) {
      const message = errorMessage(err, 'شروع بازبینی انجام نشد.')
      toast.error(message.includes('submitter cannot claim') || message.includes('ثبت‌کننده')
        ? 'شما ثبت‌کننده این درخواست هستید؛ برای شروع بازبینی باید با حساب یک بازبین یا مدیر دیگر وارد شوید.'
        : message)
    } finally {
      setBusy(false)
    }
  }

  const withdrawReview = async () => {
    const request = reviewRequests.find((item) => item.status === 'REQUESTED')
    if (!request) {
      toast.error('فقط درخواست‌های در صف بازبینی قابل بازگشت هستند.')
      return
    }
    if (!window.confirm('درخواست از صف بازبینی خارج و نسخه به پیش‌نویس برگردانده شود؟')) return
    setBusy(true)
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.rpc('withdraw_obligation_review', {
          requested_review_id: request.id,
          requested_note: 'درخواست توسط ثبت‌کننده برای اصلاح به پیش‌نویس بازگردانده شد.',
        })
        if (error) throw error
      } else {
        throw new Error('برای بازگرداندن درخواست بازبینی اتصال Supabase الزامی است.')
      }
      toast.success('درخواست بازبینی به پیش‌نویس برگشت و امکان اصلاح فعال شد.')
      await Promise.all([loadCatalog(), loadDefinition(), loadReviewRequests()])
    } catch (err) {
      toast.error(errorMessage(err, 'بازگرداندن نسخه به پیش‌نویس انجام نشد.'))
    } finally {
      setBusy(false)
    }
  }

  const decideReview = async (decision: 'approve' | 'reject') => {
    const request = reviewRequests.find((item) => ['REQUESTED', 'IN_REVIEW'].includes(item.status))
    if (!request) {
      toast.error('درخواست بازبینی فعالی برای این نسخه وجود ندارد.')
      return
    }
    const prompt = decision === 'approve'
      ? 'جمع‌بندی و مستندات تأیید بازبینی را وارد کنید:'
      : 'علت رد بازبینی و موارد اصلاحی را وارد کنید:'
    const note = window.prompt(prompt, '')?.trim()
    if (!note) return
    setBusy(true)
    try {
      if (isSupabaseConfigured) {
        if (request.status === 'REQUESTED') {
          const { error: claimError } = await supabase.rpc('start_obligation_review', { requested_review_id: request.id })
          if (claimError) throw claimError
        }
        const { error } = decision === 'approve'
          ? await supabase.rpc('approve_obligation_review', { requested_review_id: request.id, requested_note: note })
          : await supabase.rpc('reject_obligation_review', { requested_review_id: request.id, requested_note: note })
        if (error) throw error
      } else {
        throw new Error('برای ثبت تصمیم بازبینی اتصال Supabase الزامی است.')
      }
      toast.success(decision === 'approve' ? 'بازبینی تأیید شد و نسخه وارد آزمایش شد.' : 'بازبینی رد شد و نسخه برای اصلاح به پیش‌نویس برگشت.')
      await Promise.all([loadCatalog(), loadDefinition(), loadReviewRequests()])
    } catch (err) {
      toast.error(errorMessage(err, 'ثبت تصمیم بازبینی انجام نشد.'))
    } finally {
      setBusy(false)
    }
  }

  const transitionStatus = async (targetStatus: 'DRAFT' | 'REVIEW' | 'TESTING', successMessage: string) => {
    if (!selectedVersionId) return
    setBusy(true)
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.rpc('transition_obligation_version_status', {
          requested_version_id: selectedVersionId,
          requested_status: targetStatus,
        })
        if (error) throw error
      } else {
        throw new Error('برای تغییر وضعیت نسخه اتصال Supabase الزامی است.')
      }

      toast.success(successMessage)
      await loadCatalog()
      await loadDefinition()
    } catch (err) {
      toast.error(errorMessage(err, 'تغییر وضعیت نسخه انجام نشد.'))
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
        const { error } = await supabase.rpc('publish_obligation_version', {
          requested_version_id: selectedVersionId,
        })
        if (error) throw error
      } else {
        throw new Error('برای انتشار نسخه اتصال Supabase الزامی است.')
      }

      toast.success('نسخه منتشر شد و برای تشخیص شرکت‌ها قابل استفاده است.')
      await loadCatalog()
      await loadDefinition()
    } catch (err) {
      toast.error(errorMessage(err, 'انتشار نسخه انجام نشد.'))
    } finally {
      setBusy(false)
    }
  }

  const retire = async () => {
    if (!selectedVersionId) return
    if (!window.confirm('نسخه منسوخ می‌شود و دیگر برای تشخیص شرکت‌ها استفاده نخواهد شد. محتوای آن به‌عنوان سند تاریخی منتشرشده حفظ می‌شود و قابل بازگشت نیست. ادامه می‌دهید؟')) return
    setBusy(true)
    try {
      if (isSupabaseConfigured) {
        const { error } = await (supabase as any).rpc('retire_obligation_version', {
          requested_version_id: selectedVersionId,
        })
        if (error) throw error
      } else {
        throw new Error('برای منسوخ‌سازی نسخه اتصال Supabase الزامی است.')
      }

      toast.success('نسخه منسوخ شد و دیگر برای تشخیص شرکت‌ها استفاده نمی‌شود.')
      await loadCatalog()
      await loadDefinition()
    } catch (err) {
      toast.error(errorMessage(err, 'منسوخ‌سازی نسخه انجام نشد.'))
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
          <Button variant="outline" className="border-zinc-700 gap-2" onClick={() => setShowFamilyForm((value) => !value)}><FolderTree className="h-4 w-4 text-amber-400" />مدیریت و تعریف گروه‌ها</Button>
          <Button variant="outline" className="border-amber-700 text-amber-300 hover:bg-amber-950/40 gap-2" onClick={() => setShowDraftForm((value) => !value)}><FilePlus2 className="h-4 w-4" />تعهد جدید</Button>
        </div>
      </div>

      <div className="mb-8 rounded-[1.25rem_0.5rem_1.25rem_1.25rem] border border-amber-800/50 bg-amber-950/40 p-4 text-sm leading-7 text-amber-100 shadow-inner">
        <ShieldAlert className="ml-2 inline h-4 w-4" />
        هیچ متن حقوقی به‌صورت خودکار منتشر نمی‌شود. انتشار فقط پس از ثبت منبع رسمی، قاعده تشخیص و حداقل یک مرحله ممکن است.
      </div>

      {showFamilyForm && (
        <StudioFullScreen
          title="مدیریت و تعریف گروه‌ها (دسته‌بندی تکالیف)"
          onBack={() => {
            if (!familyDirty || window.confirm('تغییرات ذخیره نشده است. بدون ذخیره خارج می‌شوید؟')) {
              setShowFamilyForm(false)
              setFamilyDirty(false)
            }
          }}
        >
          <FamilyManager
            families={families}
            catalog={catalog}
            onDirtyChange={setFamilyDirty}
            onSaved={async () => {
              await loadCatalog()
            }}
          />
        </StudioFullScreen>
      )}
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
                                        <Button size="sm" variant="outline" className="border-zinc-700 gap-1.5" onClick={() => void handleCloneObligation(item)}><Copy className="h-3.5 w-3.5" />کپی</Button>
                    <Button size="sm" variant="outline" className="border-red-900 text-red-400 hover:bg-red-950 gap-1.5" disabled={busy} onClick={() => handleDeleteObligationClick(item)}><Trash2 className="h-3.5 w-3.5" />حذف</Button>
                  </div></TableCell>
                </TableRow>
              })}</TableBody>
            </Table>
          )}
        </section>
      ) : !selectedVersion || !selectedCatalogItem ? (
        <StudioFullScreen title={mode === 'EDIT' ? 'ویرایش تعهد' : 'مشاهده تعهد'} onBack={closeDetails}>
          <div className="rounded-2xl border border-dashed border-zinc-700 bg-[#141615] p-16 text-center text-zinc-500">برای ادامه یک نسخه و تعهد را انتخاب کنید.</div>
        </StudioFullScreen>
      ) : activeSubModule === 'CLASSIFICATION' ? (
        <ClassificationModal
          item={selectedCatalogItem}
          version={selectedVersion}
          mode={mode}
          onClose={() => setActiveSubModule(null)}
          onSaved={async () => { await loadCatalog(); await loadDefinition() }}
        />
      ) : activeSubModule === 'RECURRENCE' ? (
        <RecurrenceModal
          item={selectedCatalogItem}
          version={selectedVersion}
          mode={mode}
          onClose={() => setActiveSubModule(null)}
          onSaved={async () => { await loadCatalog(); await loadDefinition() }}
        />
      ) : activeSubModule === 'SCOPE' ? (
        <ScopeModal
          item={selectedCatalogItem}
          version={selectedVersion}
          mode={mode}
          onClose={() => setActiveSubModule(null)}
          onSaved={async () => { await loadCatalog(); await loadDefinition() }}
        />
      ) : activeSubModule === 'PUBLISH_READINESS' ? (
        <PublishReadinessWorkflowModal
          item={selectedCatalogItem}
          version={selectedVersion}
          rules={rules}
          steps={steps}
          reviewRequests={reviewRequests}
          penaltySchemaReady={penaltySchemaReady}
          busy={busy}
          mode={mode}
          onSeed={seedStandardCorporateTaxData}
          onSubmitForReview={submitForReview}
          onRepairReviewRequest={repairReviewRequest}
          onStartReview={startReview}
          onDecideReview={decideReview}
          onWithdrawReview={withdrawReview}
          onPublish={publish}
          onRetire={retire}
          onEditVersion={() => setActiveSubModule(null)}
          onClose={() => setActiveSubModule(null)}
          onSaved={async () => { await loadCatalog(); await loadDefinition() }}
        />
      ) : activeSubModule === 'ELIGIBILITY' ? (
        <EligibilityModal
          item={selectedCatalogItem}
          version={selectedVersion}
          rules={rules}
          ruleConditions={ruleConditions}
          editingRule={editingRule}
          setEditingRule={setEditingRule}
          onDeleteRule={(rule) => setDeleteRuleGuard({ isOpen: true, rule, isDeleting: false })}
          onSeed={seedStandardCorporateTaxData}
          busy={busy}
          mode={mode}
          onClose={() => { setEditingRule(null); setActiveSubModule(null) }}
          onSaved={loadDefinition}
        />
      ) : activeSubModule === 'WORKFLOW_STEPS' ? (
        <WorkflowStepsModalV2
          item={selectedCatalogItem}
          version={selectedVersion}
          steps={steps}
          transitions={transitions}
          editingStep={editingStep}
          setEditingStep={setEditingStep}
          onDeleteStep={(step, deps) => setDeleteStepGuard({ isOpen: true, step, dependencies: deps, isDeleting: false })}
          onSeed={seedStandardCorporateTaxData}
          busy={busy}
          mode={mode}
          onClose={() => { setEditingStep(null); setActiveSubModule(null) }}
          onSaved={loadDefinition}
        />
      ) : activeSubModule === 'TRANSITIONS' ? (
        <WorkflowTransitionsModal
          item={selectedCatalogItem}
          version={selectedVersion}
          steps={steps}
          transitions={transitions}
          transitionSchemaReady={transitionSchemaReady}
          mode={mode}
          onClose={() => setActiveSubModule(null)}
          onSaved={loadDefinition}
        />
      ) : (
        <StudioFullScreen
          title={mode === 'EDIT' ? `ویرایش تعهد: ${selectedCatalogItem?.obligation.title ?? ''}` : `مشاهده تعهد: ${selectedCatalogItem?.obligation.title ?? ''}`}
          onBack={closeDetails}
        >
          <div className="mx-auto max-w-7xl space-y-6">
            {/* Obligation Top Summary Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-[#121413] p-5 shadow-lg">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-black text-zinc-100">{selectedCatalogItem?.obligation.title}</h2>
                  <Badge variant="outline" className="border-amber-800/80 bg-amber-950/40 text-amber-300 font-mono text-xs">
                    {selectedCatalogItem?.obligation.code}
                  </Badge>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    selectedVersion.status === 'PUBLISHED'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                      : selectedVersion.status === 'RETIRED'
                        ? 'bg-zinc-800 text-zinc-300 border border-zinc-600/60'
                        : 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                  }`}>
                    نسخه {selectedVersion.version_number} ({versionStatusLabel(selectedVersion.status)})
                  </span>
                </div>
                <p className="text-xs text-zinc-400">
                  خانواده: <span className="font-semibold text-zinc-200">{selectedCatalogItem?.family?.title ?? 'عمومی'}</span> · مرجع: <span className="text-zinc-300">{selectedCatalogItem?.obligation.authority_name || 'سازمان امور مالیاتی'}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-zinc-700 hover:bg-zinc-800 gap-1.5 text-xs"
                  onClick={async () => {
                    await loadCatalog()
                    await loadDefinition()
                    toast.success('اطلاعات تعهد به‌روزرسانی شد.')
                  }}
                  disabled={busy}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
                  تازه‌سازی
                </Button>
                {selectedVersion.status === 'PUBLISHED' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-zinc-600 text-zinc-300 hover:bg-zinc-800 gap-1.5 text-xs"
                    onClick={() => {
                      void (async () => {
                        if (!window.confirm('نسخه منسوخ می‌شود و دیگر برای تشخیص شرکت‌ها استفاده نخواهد شد. محتوای آن به‌عنوان سند تاریخی منتشرشده حفظ می‌شود و قابل بازگشت نیست. ادامه می‌دهید؟')) return
                        setBusy(true)
                        try {
                          if (isSupabaseConfigured) {
                            const { error } = await (supabase as any).rpc('retire_obligation_version', { requested_version_id: selectedVersionId })
                            if (error) throw error
                          } else {
                            throw new Error('برای منسوخ‌سازی نسخه اتصال Supabase الزامی است.')
                          }
                          toast.success('نسخه منسوخ شد و دیگر برای تشخیص شرکت‌ها استفاده نمی‌شود.')
                          await loadCatalog()
                          await loadDefinition()
                        } catch (err) {
                          toast.error(errorMessage(err, 'منسوخ‌سازی نسخه انجام نشد.'))
                        } finally {
                          setBusy(false)
                        }
                      })()
                    }}
                    disabled={busy}
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
                    منسوخ‌سازی
                  </Button>
                )}
              </div>
            </div>

            {/* Section 1: اطلاعات پایه و زمان‌بندی (Visible on entry) */}
            {selectedCatalogItem && (
              <BasicIdentityForm
                key={selectedVersion.id}
                item={selectedCatalogItem}
                version={selectedVersion}
                mode={mode}
                onSaved={async () => { await loadCatalog(); await loadDefinition() }}
              />
            )}

            {/* Section 2: دکمه‌های ناوبری به بخش‌های تخصصی (تک‌دکمه‌ای و بدون کارت) */}
            <div className="rounded-2xl border border-zinc-800 bg-[#121413] p-5 shadow-lg space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-zinc-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-amber-400" />
                  <h3 className="text-base font-bold text-zinc-100">
                    بخش‌های تخصصی و پیکربندی تکمیلی
                  </h3>
                </div>
                <p className="text-xs text-zinc-400">
                  جهت دسترسی به تنظیمات پیشرفته، یکی از دکمه‌های زیر را انتخاب کنید:
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveSubModule('CLASSIFICATION')}
                  className="border-zinc-700 bg-zinc-900/90 hover:bg-amber-500 hover:text-zinc-950 text-zinc-200 text-xs font-semibold gap-1.5 h-9 px-3.5 transition-all shadow-sm"
                >
                  <SlidersHorizontal className="h-4 w-4 text-amber-400" />
                  طبقه‌بندی و مسئولیت
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveSubModule('RECURRENCE')}
                  className="border-zinc-700 bg-zinc-900/90 hover:bg-sky-500 hover:text-zinc-950 text-zinc-200 text-xs font-semibold gap-1.5 h-9 px-3.5 transition-all shadow-sm"
                >
                  <Clock3 className="h-4 w-4 text-sky-400" />
                  تناوب و مهلت قانونی
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveSubModule('SCOPE')}
                  className="border-zinc-700 bg-zinc-900/90 hover:bg-emerald-500 hover:text-zinc-950 text-zinc-200 text-xs font-semibold gap-1.5 h-9 px-3.5 transition-all shadow-sm"
                >
                  <Target className="h-4 w-4 text-emerald-400" />
                  دامنه شمول و وضعیت
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveSubModule('PUBLISH_READINESS')}
                  className="border-zinc-700 bg-zinc-900/90 hover:bg-purple-500 hover:text-zinc-950 text-zinc-200 text-xs font-semibold gap-1.5 h-9 px-3.5 transition-all shadow-sm"
                >
                  <Rocket className="h-4 w-4 text-purple-400" />
                  آمادگی انتشار و جریمه‌ها
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveSubModule('ELIGIBILITY')}
                  className="border-zinc-700 bg-zinc-900/90 hover:bg-amber-500 hover:text-zinc-950 text-zinc-200 text-xs font-semibold gap-1.5 h-9 px-3.5 transition-all shadow-sm"
                >
                  <Scale className="h-4 w-4 text-amber-400" />
                  قواعد تشخیص مشمولیت ({rules.length})
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveSubModule('WORKFLOW_STEPS')}
                  className="border-zinc-700 bg-zinc-900/90 hover:bg-sky-500 hover:text-zinc-950 text-zinc-200 text-xs font-semibold gap-1.5 h-9 px-3.5 transition-all shadow-sm"
                >
                  <ListChecks className="h-4 w-4 text-sky-400" />
                  مراحل فرایند اجرایی ({steps.length})
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveSubModule('TRANSITIONS')}
                  className="border-zinc-700 bg-zinc-900/90 hover:bg-violet-500 hover:text-zinc-950 text-zinc-200 text-xs font-semibold gap-1.5 h-9 px-3.5 transition-all shadow-sm"
                >
                  <GitBranch className="h-4 w-4 text-violet-400" />
                  مسیرها و خروجی‌ها ({transitions.length})
                </Button>
              </div>
            </div>
          </div>
        </StudioFullScreen>
      )}

      <DeleteGuardModal
        isOpen={deleteObligationGuard.isOpen}
        onClose={() => setDeleteObligationGuard({ isOpen: false, item: null, dependencies: [], isDeleting: false, hasPublished: false })}
        onConfirm={confirmDeleteObligation}
        onConfirmDelete={confirmDeleteObligation}
        title={deleteObligationGuard.item?.obligation.title ?? 'تعهد قانونی'}
        entityType="تعهد قانونی"
        description={`آیا از حذف تعهد «${deleteObligationGuard.item?.obligation.title ?? ''}» اطمینان دارید؟ تمامی نسخه‌ها، قواعد مشمولیت، مراحل فرایند و مسیرهای متناظر با آن حذف خواهند شد.`}
        checkResult={{
          hasDependencies: deleteObligationGuard.dependencies.length > 0,
          dependencies: deleteObligationGuard.dependencies as any,
        }}
        allowCascadeDelete={!deleteObligationGuard.hasPublished}
        isDeleting={deleteObligationGuard.isDeleting}
      />

      <DeleteGuardModal
        isOpen={deleteRuleGuard.isOpen}
        onClose={() => setDeleteRuleGuard({ isOpen: false, rule: null, isDeleting: false })}
        onConfirm={confirmDeleteRule}
        onConfirmDelete={confirmDeleteRule}
        title={deleteRuleGuard.rule?.title ?? 'قاعده مشمولیت'}
        entityType="قاعده مشمولیت"
        description={`آیا از حذف قاعده «${deleteRuleGuard.rule?.title ?? ''}» اطمینان دارید؟ تمامی شروط متصل به این قاعده نیز حذف خواهند شد.`}
        checkResult={{ hasDependencies: false, dependencies: [] }}
        isDeleting={deleteRuleGuard.isDeleting}
      />

      <DeleteGuardModal
        isOpen={deleteStepGuard.isOpen}
        onClose={() => setDeleteStepGuard({ isOpen: false, step: null, dependencies: [], isDeleting: false })}
        onConfirm={confirmDeleteStep}
        onConfirmDelete={confirmDeleteStep}
        title={deleteStepGuard.step?.title ?? 'مرحله فرایند'}
        entityType="مرحله فرایند"
        description={`آیا از حذف مرحله «${deleteStepGuard.step?.title ?? ''}» اطمینان دارید؟ در صورت وجود مسیرهای انتقال مرتبط، آن‌ها نیز حذف خواهند شد.`}
        checkResult={{
          hasDependencies: deleteStepGuard.dependencies.length > 0,
          dependencies: deleteStepGuard.dependencies as any,
        }}
        isDeleting={deleteStepGuard.isDeleting}
      />
    </main>
  )
}

interface BasicIdentityState {
  title: string
  summary: string
  authorityName: string
  actionUrl: string
  legalReference: string
  sourceUrl: string
  effectiveFrom: string
  effectiveTo: string
  isActive: boolean
}

function SubModuleCard({
  title,
  description,
  icon: Icon,
  iconColor = 'text-amber-400',
  metaBadge,
  actionText,
  onClick,
}: {
  title: string
  description: string
  icon: React.ElementType
  iconColor?: string
  metaBadge?: string
  actionText: string
  onClick: () => void
}) {
  return (
    <div className="group flex flex-col justify-between rounded-2xl border border-zinc-800 bg-[#121413] p-5 shadow-lg transition duration-200 hover:border-zinc-700 hover:bg-[#161817]">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/90 shadow-sm group-hover:scale-105 transition-transform">
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
          {metaBadge && (
            <span className="max-w-[150px] truncate rounded-full border border-zinc-800 bg-zinc-900/80 px-2.5 py-0.5 text-[11px] font-medium text-zinc-300">
              {metaBadge}
            </span>
          )}
        </div>
        <div>
          <h4 className="font-bold text-zinc-100 group-hover:text-amber-300 transition-colors">{title}</h4>
          <p className="mt-1 text-xs leading-5 text-zinc-400">{description}</p>
        </div>
      </div>
      <div className="mt-5 pt-3 border-t border-zinc-800/60">
        <Button
          type="button"
          onClick={onClick}
          className="w-full bg-zinc-800/90 hover:bg-amber-500 hover:text-zinc-950 text-zinc-200 text-xs font-semibold gap-1.5 transition-all shadow-sm"
        >
          {actionText}
          <ArrowRight className="h-3.5 w-3.5 rotate-180" />
        </Button>
      </div>
    </div>
  )
}

function BasicIdentityForm({
  item,
  version,
  mode,
  onSaved,
}: {
  item: CatalogItem
  version: Version
  mode: StudioMode
  onSaved: () => Promise<void>
}) {
  const [form, setForm] = useState<BasicIdentityState>({
    title: item.obligation.title ?? '',
    summary: item.obligation.summary ?? '',
    authorityName: item.obligation.authority_name ?? '',
    actionUrl: item.obligation.official_action_url ?? '',
    legalReference: version.legal_reference ?? '',
    sourceUrl: version.source_url ?? '',
    effectiveFrom: version.effective_from ?? '',
    effectiveTo: version.effective_to ?? '',
    isActive: item.obligation.is_active ?? true,
  })
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  const update = <K extends keyof BasicIdentityState>(key: K, value: BasicIdentityState[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
    setDirty(true)
  }

  const save = async () => {
    if (!form.title.trim()) return toast.error('عنوان تعهد الزامی است.')
    if ((form.sourceUrl && !form.sourceUrl.startsWith('https://')) || (form.actionUrl && !form.actionUrl.startsWith('https://'))) {
      return toast.error('نشانی‌های اینترنتی باید با https:// شروع شوند.')
    }
    setSaving(true)
    const obligationPatch = {
      title: form.title.trim(),
      summary: form.summary.trim() || null,
      authority_name: form.authorityName.trim() || null,
      official_action_url: form.actionUrl.trim() || null,
      is_active: form.isActive,
    }
    const versionPatch = {
      legal_reference: form.legalReference.trim() || null,
      source_url: form.sourceUrl.trim() || null,
      effective_from: form.effectiveFrom || null,
      effective_to: form.effectiveTo || null,
    }

    try {
      if (isSupabaseConfigured) {
        const [obligationResult, versionResult] = await Promise.all([
          supabase.from('obligations').update(obligationPatch).eq('id', item.obligation.id),
          supabase.from('obligation_versions').update(versionPatch).eq('id', version.id),
        ])
        if (obligationResult.error) throw obligationResult.error
        if (versionResult.error) throw versionResult.error
      } else {
        throw new Error('برای ذخیره اطلاعات اتصال Supabase الزامی است.')
      }
      setDirty(false)
      toast.success('اطلاعات پایه و زمان‌بندی تعهد ذخیره شد.')
      await onSaved()
    } catch (error) {
      toast.error(errorMessage(error, 'ذخیره اطلاعات پایه انجام نشد.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section id="basic-definition" data-studio-dirty={dirty ? 'true' : undefined} className="space-y-5 rounded-2xl border border-zinc-800 bg-[#101211] p-5 shadow-xl sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-800/80 pb-4">
        <div>
          <h3 className="text-lg font-black text-zinc-100 flex items-center gap-2">
            <BookOpenCheck className="h-5 w-5 text-amber-400" />
            اطلاعات پایه و زمان‌بندی
          </h3>
          <p className="mt-1 text-xs text-zinc-400">
            مشخصات هویتی، مرجع حقوقی، نشانی‌های وب و بازه زمانی اعتبار تعهد
          </p>
        </div>
        {dirty && (
          <span className="self-start rounded-full bg-amber-950/80 px-2.5 py-0.5 text-xs text-amber-300 border border-amber-800/60">
            تغییرات ذخیره‌نشده
          </span>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <FormGroup title="هویت و مستندات قانونی" description="عنوان رسمی، نام نهاد ناظر و استناد قانونی">
          <div className="sm:col-span-2">
            <Field label="عنوان تعهد *">
              <Input
                value={form.title}
                disabled={mode === 'VIEW'}
                onChange={(e) => update('title', e.target.value)}
                placeholder="مثال: تسلیم اظهارنامه عملکرد اشخاص حقوقی"
              />
            </Field>
          </div>
          <Field label="مرجع صادرکننده / ناظر">
            <Input
              value={form.authorityName}
              disabled={mode === 'VIEW'}
              onChange={(e) => update('authorityName', e.target.value)}
              placeholder="سازمان امور مالیاتی کشور"
            />
          </Field>
          <Field label="ماده / مرجع قانونی">
            <Input
              value={form.legalReference}
              disabled={mode === 'VIEW'}
              onChange={(e) => update('legalReference', e.target.value)}
              placeholder="ماده ۱۱۰ قانون مالیات‌های مستقیم"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="شرح و توضیح مختصر">
              <textarea
                value={form.summary}
                disabled={mode === 'VIEW'}
                onChange={(e) => update('summary', e.target.value)}
                rows={3}
                className="w-full rounded-md border border-zinc-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-amber-500 disabled:opacity-60"
                placeholder="شرحی مختصر از الزام قانونی و تکالیف مودی..."
              />
            </Field>
          </div>
        </FormGroup>

        <div className="space-y-5">
          <FormGroup title="بازه زمانی و اعتبار" description="تاریخ شروع و پایان اعتبار قانونی">
            <Field label="تاریخ شروع اعتبار">
              <JalaliDatePicker
                value={form.effectiveFrom}
                disabled={mode === 'VIEW'}
                placeholder="انتخاب تاریخ شروع..."
                onChange={(val) => update('effectiveFrom', val)}
              />
            </Field>
            <Field label="تاریخ پایان اعتبار">
              <JalaliDatePicker
                value={form.effectiveTo}
                disabled={mode === 'VIEW'}
                placeholder="انتخاب تاریخ پایان..."
                onChange={(val) => update('effectiveTo', val)}
              />
            </Field>
          </FormGroup>

          <FormGroup title="نشانی‌های وب و سامانه" description="پیوند به متن قانون و سامانه اجرای تکلیف">
            <Field label="نشانی منبع رسمی (URL)">
              <Input
                dir="ltr"
                value={form.sourceUrl}
                disabled={mode === 'VIEW'}
                onChange={(e) => update('sourceUrl', e.target.value)}
                placeholder="https://tax.gov.ir/..."
              />
            </Field>
            <Field label="نشانی سامانه اقدام (URL)">
              <Input
                dir="ltr"
                value={form.actionUrl}
                disabled={mode === 'VIEW'}
                onChange={(e) => update('actionUrl', e.target.value)}
                placeholder="https://my.tax.gov.ir"
              />
            </Field>
          </FormGroup>
        </div>
      </div>

      {mode === 'EDIT' && (
        <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
          <div className="flex items-center gap-3">
            <Switch
              checked={form.isActive}
              onCheckedChange={(val) => update('isActive', val)}
            />
            <span className="text-xs text-zinc-300">
              {form.isActive ? 'تعهد در سامانه فعال است' : 'تعهد غیرفعال است'}
            </span>
          </div>
          <Button
            type="button"
            disabled={!dirty || saving}
            onClick={() => void save()}
            className="min-w-40 bg-emerald-700 hover:bg-emerald-600 font-semibold"
          >
            {saving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Check className="ml-2 h-4 w-4" />}
            ذخیره اطلاعات پایه
          </Button>
        </div>
      )}
    </section>
  )
}

function ClassificationModal({
  item,
  version,
  mode,
  onClose,
  onSaved,
}: {
  item: CatalogItem
  version: Version
  mode: StudioMode
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const recurrenceRule = jsonRecord(version.recurrence_rule)
  const initialTypes = stringArray(recurrenceRule['obligation_types'])

  const [primaryType, setPrimaryType] = useState(stringValue(recurrenceRule['obligation_type'], 'TAX_CORPORATE'))
  const [relatedTypes, setRelatedTypes] = useState<string[]>(initialTypes.length ? initialTypes : [stringValue(recurrenceRule['obligation_type'], 'TAX_CORPORATE')])
  const [isShared, setIsShared] = useState(Boolean(recurrenceRule['is_shared']))
  const [sharedActionKey, setSharedActionKey] = useState(stringValue(recurrenceRule['shared_action_key']))
  const [responsibleParty, setResponsibleParty] = useState(stringValue(recurrenceRule['responsible_party'], 'مودی'))
  const [phaseGroup, setPhaseGroup] = useState(stringValue(recurrenceRule['phase_group']))
  const [sequenceOrder, setSequenceOrder] = useState(numberString(recurrenceRule['sequence_order'], '1'))
  const [objectionTemplateId, setObjectionTemplateId] = useState(stringValue(recurrenceRule['objection_template_id']))
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const toggleRelatedType = (type: string) => {
    if (type === primaryType) return
    const next = relatedTypes.includes(type) ? relatedTypes.filter((t) => t !== type) : [...relatedTypes, type]
    setRelatedTypes(Array.from(new Set([primaryType, ...next])))
    setDirty(true)
  }

  const save = async () => {
    if (!primaryType || !responsibleParty) return toast.error('سرفصل اصلی و مسئول اجرا الزامی هستند.')
    setSaving(true)
    const allTypes = Array.from(new Set([primaryType, ...relatedTypes]))
    const recurrencePatch: Json = {
      ...recurrenceRule,
      obligation_type: primaryType,
      obligation_types: allTypes,
      is_shared: isShared || allTypes.length > 1,
      shared_action_key: isShared ? sharedActionKey.trim() || null : null,
      responsible_party: responsibleParty,
      phase_group: phaseGroup || null,
      sequence_order: Number(sequenceOrder) || 1,
      objection_template_id: objectionTemplateId || null,
    }
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.from('obligation_versions').update({ recurrence_rule: recurrencePatch }).eq('id', version.id)
        if (error) throw error
      } else {
        throw new Error('برای ذخیره طبقه‌بندی اتصال Supabase الزامی است.')
      }
      toast.success('تنظیمات طبقه‌بندی و مسئولیت ذخیره شد.')
      setDirty(false)
      await onSaved()
      onClose()
    } catch (error) {
      toast.error(errorMessage(error, 'ذخیره طبقه‌بندی انجام نشد.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <StudioFullScreen title={`طبقه‌بندی و مسئولیت: ${item.obligation.title}`} onBack={onClose}>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-2xl border border-zinc-800 bg-[#101211] p-6 shadow-xl space-y-6">
          <SectionHeading
            number="۱"
            title="طبقه‌بندی، سرفصل و مسئولیت اجرایی"
            description="مشخص کنید این تکلیف متعلق به چه حوزه‌ای است و چه شخص یا نهادی متولی انجام آن است."
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="سرفصل اصلی تکلیف *">
              <Select
                value={primaryType}
                disabled={mode === 'VIEW'}
                onValueChange={(value) => {
                  setPrimaryType(value)
                  setRelatedTypes(Array.from(new Set([value, ...relatedTypes])))
                  setDirty(true)
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OBLIGATION_TYPE_OPTIONS.map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="مسئول اجرا *">
              <Select
                value={responsibleParty}
                disabled={mode === 'VIEW'}
                onValueChange={(value) => { setResponsibleParty(value); setDirty(true) }}
              >
                <SelectTrigger><SelectValue placeholder="انتخاب مسئول" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="مودی">مودی</SelectItem>
                  <SelectItem value="سازمان امور مالیاتی">سازمان امور مالیاتی</SelectItem>
                  <SelectItem value="حسابرس / کارشناس رسمی">حسابرس / کارشناس رسمی</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="فاز / گروه اجرایی">
              <Select
                value={phaseGroup}
                disabled={mode === 'VIEW'}
                onValueChange={(value) => { setPhaseGroup(value); setDirty(true) }}
              >
                <SelectTrigger><SelectValue placeholder="انتخاب فاز" /></SelectTrigger>
                <SelectContent>
                  {PHASE_GROUP_OPTIONS.map((value) => (
                    <SelectItem key={value} value={value}>{value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="ترتیب نمایش در تقویم">
              <Input
                type="number"
                min="1"
                dir="ltr"
                value={sequenceOrder}
                disabled={mode === 'VIEW'}
                onChange={(e) => { setSequenceOrder(e.target.value); setDirty(true) }}
              />
            </Field>

            <div className="sm:col-span-2 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-zinc-100">تکلیف مشترک بین چند سرفصل</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    اگر این تکلیف در چند سرفصل (مثلاً عملکرد و ارزش افزوده) رفتار مشترک دارد فعال کنید.
                  </p>
                </div>
                <Switch
                  checked={isShared}
                  disabled={mode === 'VIEW'}
                  onCheckedChange={(val) => {
                    setIsShared(val)
                    if (!val) setRelatedTypes([primaryType])
                    setDirty(true)
                  }}
                />
              </div>

              {isShared && (
                <div className="pt-2 border-t border-zinc-800 space-y-3">
                  <p className="text-xs font-semibold text-zinc-300">انتخاب سرفصل‌های مرتبط:</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {OBLIGATION_TYPE_OPTIONS.map(([val, label]) => (
                      <label key={val} className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-800 p-2.5 text-xs hover:border-zinc-700 bg-zinc-900/40">
                        <input
                          type="checkbox"
                          checked={relatedTypes.includes(val)}
                          disabled={val === primaryType || mode === 'VIEW'}
                          onChange={() => toggleRelatedType(val)}
                          className="accent-amber-500"
                        />
                        <span className={val === primaryType ? 'font-bold text-amber-300' : 'text-zinc-300'}>{label}</span>
                      </label>
                    ))}
                  </div>

                  <Field label="کلید یکتای اقدام مشترک (Shared Action Key)">
                    <Input
                      dir="ltr"
                      value={sharedActionKey}
                      disabled={mode === 'VIEW'}
                      onChange={(e) => { setSharedActionKey(e.target.value.toUpperCase()); setDirty(true) }}
                      placeholder="CORPORATE_TAX_SHARED"
                    />
                  </Field>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <Button variant="ghost" onClick={onClose}>
              انصراف و بازگشت
            </Button>
            {mode === 'EDIT' && (
              <Button
                disabled={!dirty || saving}
                onClick={() => void save()}
                className="bg-emerald-700 hover:bg-emerald-600 min-w-36 font-semibold"
              >
                {saving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Check className="ml-2 h-4 w-4" />}
                ذخیره تغییرات
              </Button>
            )}
          </div>
        </div>
      </div>
    </StudioFullScreen>
  )
}

function RecurrenceModal({
  item,
  version,
  mode,
  onClose,
  onSaved,
}: {
  item: CatalogItem
  version: Version
  mode: StudioMode
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const recurrenceRule = jsonRecord(version.recurrence_rule)
  const deadlineRule = jsonRecord(version.deadline_rule)

  const [recurrence, setRecurrence] = useState(stringValue(recurrenceRule['recurrence']))
  const [baseEvent, setBaseEvent] = useState(stringValue(deadlineRule['base_event']))
  const [timeGapValue, setTimeGapValue] = useState(numberString(deadlineRule['time_gap_value']))
  const [timeGapUnit, setTimeGapUnit] = useState(stringValue(deadlineRule['time_gap_unit'], 'ماه'))
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const save = async () => {
    if (!recurrence || !baseEvent) return toast.error('دوره تناوب و رویداد پایه الزامی هستند.')
    setSaving(true)
    const recurrencePatch: Json = {
      ...recurrenceRule,
      recurrence,
    }
    const deadlinePatch: Json = {
      ...deadlineRule,
      base_event: baseEvent,
      time_gap_value: timeGapValue ? Number(timeGapValue) : null,
      time_gap_unit: timeGapUnit || null,
    }
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.from('obligation_versions').update({
          recurrence_rule: recurrencePatch,
          deadline_rule: deadlinePatch,
        }).eq('id', version.id)
        if (error) throw error
      } else {
        throw new Error('برای ذخیره تناوب و مهلت اتصال Supabase الزامی است.')
      }
      toast.success('تنظیمات تناوب و مهلت قانونی ذخیره شد.')
      setDirty(false)
      await onSaved()
      onClose()
    } catch (error) {
      toast.error(errorMessage(error, 'ذخیره تناوب انجام نشد.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <StudioFullScreen title={`تناوب و مهلت قانونی: ${item.obligation.title}`} onBack={onClose}>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-2xl border border-zinc-800 bg-[#101211] p-6 shadow-xl space-y-6">
          <SectionHeading
            number="۲"
            title="تناوب و مهلت قانونی"
            description="مبنای محاسبه موعد قانونی، تکرار دوره‌ای و فواصل زمانی انقضای مهلت تکلیف را پیکربندی کنید."
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="دوره تناوب تکرار تکلیف *">
              <Select
                value={recurrence}
                disabled={mode === 'VIEW'}
                onValueChange={(val) => { setRecurrence(val); setDirty(true) }}
              >
                <SelectTrigger><SelectValue placeholder="انتخاب دوره تناوب" /></SelectTrigger>
                <SelectContent>
                  {RECURRENCE_OPTIONS.map((val) => (
                    <SelectItem key={val} value={val}>{val}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="رویداد پایه محاسباتی *">
              <Select
                value={baseEvent}
                disabled={mode === 'VIEW'}
                onValueChange={(val) => { setBaseEvent(val); setDirty(true) }}
              >
                <SelectTrigger><SelectValue placeholder="انتخاب رویداد پایه" /></SelectTrigger>
                <SelectContent>
                  {BASE_EVENT_OPTIONS.map((val) => (
                    <SelectItem key={val} value={val}>{val}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="فاصله زمانی تا موعد قانونی">
              <Input
                type="number"
                min="0"
                dir="ltr"
                value={timeGapValue}
                disabled={mode === 'VIEW'}
                onChange={(e) => { setTimeGapValue(e.target.value); setDirty(true) }}
                placeholder="مثال: ۴"
              />
            </Field>

            <Field label="واحد فاصله زمانی">
              <Select
                value={timeGapUnit}
                disabled={mode === 'VIEW'}
                onValueChange={(val) => { setTimeGapUnit(val); setDirty(true) }}
              >
                <SelectTrigger><SelectValue placeholder="انتخاب واحد" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="روز">روز</SelectItem>
                  <SelectItem value="ماه">ماه</SelectItem>
                  <SelectItem value="سال">سال</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="rounded-xl border border-sky-900/50 bg-sky-950/20 p-4">
            <p className="text-xs font-bold text-sky-300 mb-1">پیش‌نمایش فرمول موعد:</p>
            <p className="text-sm text-zinc-200">
              {timeGapValue && timeGapUnit && baseEvent
                ? `موعد سررسید: ${timeGapValue} ${timeGapUnit} پس از «${baseEvent}» (${recurrence || 'بدون تناوب'})`
                : 'لطفاً فیلدهای رویداد پایه و فاصله زمانی را تکمیل نمایید.'}
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <Button variant="ghost" onClick={onClose}>
              انصراف و بازگشت
            </Button>
            {mode === 'EDIT' && (
              <Button
                disabled={!dirty || saving}
                onClick={() => void save()}
                className="bg-emerald-700 hover:bg-emerald-600 min-w-36 font-semibold"
              >
                {saving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Check className="ml-2 h-4 w-4" />}
                ذخیره تغییرات
              </Button>
            )}
          </div>
        </div>
      </div>
    </StudioFullScreen>
  )
}

function ScopeModal({
  item,
  version,
  mode,
  onClose,
  onSaved,
}: {
  item: CatalogItem
  version: Version
  mode: StudioMode
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const recurrenceRule = jsonRecord(version.recurrence_rule)
  const [audienceSummary, setAudienceSummary] = useState(version.audience_summary ?? '')
  const [objectionTemplateId, setObjectionTemplateId] = useState(stringValue(recurrenceRule['objection_template_id']))
  const [isActive, setIsActive] = useState(item.obligation.is_active ?? true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const save = async () => {
    setSaving(true)
    const recurrencePatch: Json = {
      ...recurrenceRule,
      objection_template_id: objectionTemplateId.trim() || null,
    }
    try {
      if (isSupabaseConfigured) {
        const [obRes, verRes] = await Promise.all([
          supabase.from('obligations').update({ is_active: isActive }).eq('id', item.obligation.id),
          supabase.from('obligation_versions').update({
            audience_summary: audienceSummary.trim() || null,
            recurrence_rule: recurrencePatch,
          }).eq('id', version.id),
        ])
        if (obRes.error) throw obRes.error
        if (verRes.error) throw verRes.error
      } else {
        throw new Error('برای ذخیره دامنه و وضعیت اتصال Supabase الزامی است.')
      }
      toast.success('دامنه و وضعیت تعهد ذخیره شد.')
      setDirty(false)
      await onSaved()
      onClose()
    } catch (error) {
      toast.error(errorMessage(error, 'ذخیره دامنه و وضعیت انجام نشد.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <StudioFullScreen title={`دامنه و وضعیت: ${item.obligation.title}`} onBack={onClose}>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-2xl border border-zinc-800 bg-[#101211] p-6 shadow-xl space-y-6">
          <SectionHeading
            number="۳"
            title="دامنه شمول، وضعیت و الگوی اعتراض"
            description="توضیح متنی مخاطبان مشمول، الگوی مرتبط جهت اعتراض یا دادرسی، و وضعیت کلی فعالیت را تعیین کنید."
          />

          <div className="space-y-5">
            <Field label="خلاصه مخاطبان مشمول (توضیح برای مودیان)">
              <textarea
                value={audienceSummary}
                disabled={mode === 'VIEW'}
                onChange={(e) => { setAudienceSummary(e.target.value); setDirty(true) }}
                rows={4}
                className="w-full rounded-md border border-zinc-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-amber-500 disabled:opacity-60"
                placeholder="مثال: تمامی اشخاص حقوقی و شرکت‌های تجاری ثبت‌شده در ایران که در دوره مالی دارای فعالیت اقتصادی بوده‌اند..."
              />
            </Field>

            <Field label="شناسه الگوی اعتراض / دادرسی (اختیاری)">
              <Input
                dir="ltr"
                value={objectionTemplateId}
                disabled={mode === 'VIEW'}
                onChange={(e) => { setObjectionTemplateId(e.target.value); setDirty(true) }}
                placeholder="مثال: TAX_OBJECTION_TEMPLATE_V1"
              />
            </Field>

            <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
              <div>
                <p className="text-sm font-bold text-zinc-100">فعال بودن تعهد در پلتفرم</p>
                <p className="mt-1 text-xs text-zinc-400">
                  در صورت غیرفعال بودن، این تعهد در ارزیابی‌ها و تقویم جدید کاربران محاسبه نمی‌شود.
                </p>
              </div>
              <Switch
                checked={isActive}
                disabled={mode === 'VIEW'}
                onCheckedChange={(val) => { setIsActive(val); setDirty(true) }}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <Button variant="ghost" onClick={onClose}>
              انصراف و بازگشت
            </Button>
            {mode === 'EDIT' && (
              <Button
                disabled={!dirty || saving}
                onClick={() => void save()}
                className="bg-emerald-700 hover:bg-emerald-600 min-w-36 font-semibold"
              >
                {saving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Check className="ml-2 h-4 w-4" />}
                ذخیره تغییرات
              </Button>
            )}
          </div>
        </div>
      </div>
    </StudioFullScreen>
  )
}

function PublishReadinessModal({
  item,
  version,
  rules,
  steps,
  penaltySchemaReady,
  busy,
  mode,
  onSeed,
  onTransitionStatus,
  onPublish,
  onRetire,
  onClose,
  onSaved,
}: {
  item: CatalogItem
  version: Version
  rules: RuleSet[]
  steps: WorkflowStep[]
  penaltySchemaReady: boolean
  busy: boolean
  mode: StudioMode
  onSeed: () => Promise<void>
  onTransitionStatus: (status: 'DRAFT' | 'REVIEW' | 'TESTING', note: string) => Promise<void>
  onPublish: () => Promise<void>
  onRetire: () => Promise<void>
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  return (
    <StudioFullScreen title={`آمادگی انتشار نسخه ${version.version_number}: ${item.obligation.title}`} onBack={onClose}>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-2xl border border-zinc-800 bg-[#101211] p-6 shadow-xl space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-zinc-800/80 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-xl text-zinc-100">چرخه انتشار نسخه {version.version_number}</h3>
                {version.status === 'PUBLISHED' ? (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-950 px-3 py-1 text-xs text-emerald-300 border border-emerald-800/60">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    منتشرشده و قفل
                  </span>
                ) : version.status === 'RETIRED' ? (
                  <span className="flex items-center gap-1 rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300 border border-zinc-600/60">
                    <Archive className="h-3.5 w-3.5" />
                    منسوخ‌شده و قفل
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-950/80 px-2.5 py-0.5 text-xs text-amber-300 border border-amber-800/60">
                    {versionStatusLabel(version.status)}
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs leading-5 text-zinc-400">
                {version.legal_reference || 'ماده ۱۱۰، ۱۹۲، ۱۹۰ و تبصره ۱ ماده ۱۴۶ مکرر قانون مالیات‌های مستقیم'}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="border-amber-700/60 bg-amber-950/30 text-amber-300 hover:bg-amber-900/40 gap-1.5 text-xs"
                onClick={() => void onSeed()}
                disabled={busy}
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpenCheck className="h-3.5 w-3.5" />}
                درج / به‌روزرسانی داده‌های استاندارد
              </Button>
              {version.status === 'DRAFT' && mode === 'EDIT' && (
                <Button
                  onClick={() => void onTransitionStatus('REVIEW', 'نسخه برای بازبینی تخصصی ارسال شد.')}
                  disabled={busy}
                  className="bg-amber-500 text-zinc-950 hover:bg-amber-400 font-semibold"
                >
                  {busy && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  ارسال به بازبینی
                </Button>
              )}
              {version.status === 'REVIEW' && mode === 'EDIT' && (
                <>
                  <Button variant="outline" className="border-zinc-700" onClick={() => void onTransitionStatus('DRAFT', 'نسخه برای اصلاح به پیش‌نویس بازگشت.')} disabled={busy}>
                    بازگشت به پیش‌نویس
                  </Button>
                  <Button onClick={() => void onTransitionStatus('TESTING', 'نسخه وارد مرحله آزمایش شد.')} disabled={busy} className="bg-sky-700 hover:bg-sky-600 font-semibold">
                    {busy && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                    ارسال به آزمایش
                  </Button>
                </>
              )}
              {version.status === 'TESTING' && mode === 'EDIT' && (
                <>
                  <Button variant="outline" className="border-zinc-700" onClick={() => void onTransitionStatus('REVIEW', 'نسخه برای بازبینی دوباره بازگشت.')} disabled={busy}>
                    بازگشت به بازبینی
                  </Button>
                  <Button onClick={onPublish} disabled={busy} className="bg-emerald-700 hover:bg-emerald-600 font-semibold">
                    {busy && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                    انتشار نهایی نسخه
                  </Button>
                </>
              )}
              {version.status === 'PUBLISHED' && mode === 'EDIT' && (
                <Button
                  variant="outline"
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 gap-1.5 text-xs"
                  onClick={() => void onRetire()}
                  disabled={busy}
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
                  منسوخ‌سازی نسخه
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Metric icon={Scale} label="قواعد تشخیص" value={`${rules.length} قاعده قانونی`} />
            <Metric icon={ListChecks} label="مراحل فرایند" value={`${steps.length} گام اجرایی`} />
            <Metric icon={ShieldAlert} label="نوع جریمه" value={penaltyLabel(version.penalty_rule)} />
            <Metric icon={Clock3} label="مهلت و دوره" value={studioDeadlineLabel(version)} />
          </div>

          <div className="rounded-xl border border-zinc-800 bg-[#161817] p-5 space-y-4">
            <h4 className="font-bold text-zinc-100 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-red-400" />
              تنظیمات جرایم عدم انجام تکلیف
            </h4>
            <PenaltyForm
              multiPenaltyTableReady={penaltySchemaReady}
              version={version}
              onSaved={async () => { await onSaved() }}
            />
          </div>

          <div className="flex justify-end pt-3 border-t border-zinc-800">
            <Button variant="outline" onClick={onClose}>
              بستن و بازگشت به صفحه تعهد
            </Button>
          </div>
        </div>
      </div>
    </StudioFullScreen>
  )
}

function EligibilityModal({
  item,
  version,
  rules,
  ruleConditions,
  editingRule,
  setEditingRule,
  onDeleteRule,
  onSeed,
  busy,
  mode,
  onClose,
  onSaved,
}: {
  item: CatalogItem
  version: Version
  rules: RuleSet[]
  ruleConditions: Record<string, any[]>
  editingRule: RuleSet | null
  setEditingRule: (r: RuleSet | null) => void
  onDeleteRule: (r: RuleSet) => void
  onSeed: () => Promise<void>
  busy: boolean
  mode: StudioMode
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  return (
    <StudioFullScreen title={`قواعد تشخیص مشمولیت: ${item.obligation.title}`} onBack={onClose}>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-2xl border border-zinc-800 bg-[#101211] p-6 shadow-xl space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-800/80 pb-4">
            <div>
              <h3 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                <Scale className="h-5 w-5 text-amber-400" />
                مدیریت قواعد تشخیص مشمولیت ({rules.length} قاعده)
              </h3>
              <p className="mt-1 text-xs text-zinc-400">
                قواعد قانونی، ارزیابی شروط کسب‌وکار و تصمیم‌گیری خودکار مشمولیت مودی
              </p>
            </div>
            {rules.length === 0 && (
              <Button
                size="sm"
                variant="outline"
                className="border-amber-700/60 text-amber-300 hover:bg-amber-950/40 text-xs gap-1"
                onClick={() => void onSeed()}
                disabled={busy}
              >
                <Plus className="h-3.5 w-3.5" />
                درج قواعد استاندارد عملکرد
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {rules.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500">
                هنوز قاعده‌ای برای این نسخه تعریف نشده است. با استفاده از فرم زیر قاعده جدید اضافه کنید.
              </div>
            ) : (
              rules.map((rule, idx) => {
                const conds = ruleConditions[rule.id] || []
                return (
                  <div key={rule.id ?? idx} className="rounded-xl border border-zinc-700/80 bg-[#1b1e1c] p-4 space-y-3 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-zinc-100">{rule.title}</p>
                        <span className="mt-1 inline-block shrink-0 rounded bg-emerald-950 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
                          {rule.outcome === 'ELIGIBLE' ? 'مشمول قطعی' : rule.outcome === 'NOT_ELIGIBLE' ? 'غیرمشمول' : 'نیازمند بررسی'} · اولویت {rule.priority}
                        </span>
                      </div>
                      {mode === 'EDIT' && version.status === 'DRAFT' && (
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-zinc-400 hover:text-amber-300"
                            title="ویرایش قاعده"
                            onClick={() => {
                              setEditingRule(rule)
                              document.getElementById('eligibility-rule-editor')?.scrollIntoView({ behavior: 'smooth' })
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-zinc-400 hover:text-red-400"
                            title="حذف قاعده"
                            onClick={() => onDeleteRule(rule)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    {rule.explanation && (
                      <p className="text-xs leading-5 text-zinc-400">{rule.explanation}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {conds.length > 0 ? (
                        conds.map((c: any, cIdx: number) => {
                          const factEntry = FACTS.find(([k]) => k === c.fact_key)
                          const factTitle = factEntry ? factEntry[1] : c.fact_key
                          const opEntry = OPERATORS.find(([k]) => k === c.operator)
                          const opTitle = opEntry ? opEntry[1] : c.operator
                          const val = Array.isArray(c.expected_value)
                            ? c.expected_value.join('، ')
                            : c.expected_value !== null && c.expected_value !== undefined
                              ? String(c.expected_value)
                              : ''
                          return (
                            <span key={c.id ?? cIdx} className="rounded bg-zinc-800 px-2 py-0.5 text-[11px] text-amber-300">
                              شرط: {factTitle} {opTitle} {val}
                            </span>
                          )
                        })
                      ) : (
                        <span className="rounded bg-zinc-800 px-2 py-0.5 text-[11px] text-amber-300">شرط: نوع شخصیت = حقوقی</span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {mode === 'EDIT' && version.status === 'DRAFT' && (
            <div id="eligibility-rule-editor" className="pt-4 border-t border-zinc-800">
              <EligibilityRuleForm
                versionId={version.id}
                nextPriority={rules.length + 1}
                editingRule={editingRule}
                editingConditions={editingRule ? ruleConditions[editingRule.id] : undefined}
                onCancelEdit={() => setEditingRule(null)}
                onSaved={async () => {
                  setEditingRule(null)
                  await onSaved()
                }}
              />
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-zinc-800">
            <Button variant="outline" onClick={onClose}>
              بستن و بازگشت به صفحه تعهد
            </Button>
          </div>
        </div>
      </div>
    </StudioFullScreen>
  )
}

function WorkflowStepsModal({
  item,
  version,
  steps,
  transitions,
  editingStep,
  setEditingStep,
  onDeleteStep,
  onSeed,
  busy,
  mode,
  onClose,
  onSaved,
}: {
  item: CatalogItem
  version: Version
  steps: WorkflowStep[]
  transitions: WorkflowTransition[]
  editingStep: WorkflowStep | null
  setEditingStep: (s: WorkflowStep | null) => void
  onDeleteStep: (step: WorkflowStep, deps: Array<{ formName: string; details: string; iconType?: any }>) => void
  onSeed: () => Promise<void>
  busy: boolean
  mode: StudioMode
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  return (
    <StudioFullScreen title={`مراحل فرایند اجرایی: ${item.obligation.title}`} onBack={onClose}>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-2xl border border-zinc-800 bg-[#101211] p-6 shadow-xl space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-800/80 pb-4">
            <div>
              <h3 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-sky-400" />
                مدیریت مراحل فرایند اجرایی ({steps.length} مرحله)
              </h3>
              <p className="mt-1 text-xs text-zinc-400">
                گام‌های متوالی، مسئولین هر اقدام، مستندات راهنما و فیلدهای اطلاعاتی ورودی
              </p>
            </div>
            {steps.length === 0 && (
              <Button
                size="sm"
                variant="outline"
                className="border-sky-700/60 text-sky-300 hover:bg-sky-950/40 text-xs gap-1"
                onClick={() => void onSeed()}
                disabled={busy}
              >
                <Plus className="h-3.5 w-3.5" />
                درج مراحل استاندارد عملکرد
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {steps.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500">
                هنوز مرحله‌ای تعریف نشده است. با استفاده از فرم زیر گام اول را اضافه کنید.
              </div>
            ) : (
              steps.map((step, idx) => (
                <div key={step.id ?? idx} className="rounded-xl border border-zinc-700/80 bg-[#1b1e1c] p-4 space-y-2.5 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-amber-700/70 bg-amber-950/50 text-xs font-black text-amber-300">
                        {step.sequence}
                      </span>
                      <div>
                        <p className="pt-1 text-sm font-semibold text-zinc-100">{step.title.replace(/^\d+\.\s*/, '')}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="font-mono text-[10px] text-zinc-500">{step.code}</span>
                          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${actorClass(step.actor)}`}>
                            {actorLabel(step.actor)}
                          </span>
                        </div>
                      </div>
                    </div>
                    {mode === 'EDIT' && version.status === 'DRAFT' && (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-zinc-400 hover:text-sky-300"
                          title="ویرایش مرحله"
                          onClick={() => {
                            setEditingStep(step)
                            document.getElementById('workflow-step-editor')?.scrollIntoView({ behavior: 'smooth' })
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-zinc-400 hover:text-red-400"
                          title="حذف مرحله"
                          onClick={() => {
                            const relatedTransitions = transitions.filter((t) => t.from_step_id === step.id || t.to_step_id === step.id)
                            const deps = relatedTransitions.map((t) => ({
                              formName: t.title || 'مسیر انتقال',
                              details: `اتصال خروجی ${t.outcome_code}`,
                              iconType: 'workflow' as const,
                            }))
                            onDeleteStep(step, deps)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {step.instructions && (
                    <p className="text-xs leading-5 text-zinc-400">{step.instructions}</p>
                  )}
                  {step.form_schema?.fields && step.form_schema.fields.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {step.form_schema.fields.map((f: any, fIdx: number) => (
                        <span key={f.key ?? fIdx} className="rounded border border-zinc-700 bg-zinc-800/80 px-2 py-0.5 text-[10px] text-zinc-300">
                          فیلد: {f.label || f.key} ({f.type || 'text'})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {mode === 'EDIT' && version.status === 'DRAFT' && (
            <div id="workflow-step-editor" className="pt-4 border-t border-zinc-800">
              <WorkflowStepForm
                version={version}
                nextSequence={steps.length + 1}
                editingStep={editingStep}
                onCancelEdit={() => setEditingStep(null)}
                onSaved={async () => {
                  setEditingStep(null)
                  await onSaved()
                }}
              />
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-zinc-800">
            <Button variant="outline" onClick={onClose}>
              بستن و بازگشت به صفحه تعهد
            </Button>
          </div>
        </div>
      </div>
    </StudioFullScreen>
  )
}

function WorkflowTransitionsModal({
  item,
  version,
  steps,
  transitions,
  transitionSchemaReady,
  mode,
  onClose,
  onSaved,
}: {
  item: CatalogItem
  version: Version
  steps: WorkflowStep[]
  transitions: WorkflowTransition[]
  transitionSchemaReady: boolean
  mode: StudioMode
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [editingTransition, setEditingTransition] = useState<WorkflowTransition | null>(null)
  const [deleteGuard, setDeleteGuard] = useState<{
    isOpen: boolean
    transition: WorkflowTransition | null
    isDeleting: boolean
  }>({
    isOpen: false,
    transition: null,
    isDeleting: false,
  })

  const confirmDeleteTransition = async () => {
    const tr = deleteGuard.transition
    if (!tr) return
    
    // Close modal immediately and update state
    const targetId = tr.id
    const targetTitle = tr.title
    if (editingTransition?.id === targetId) setEditingTransition(null)
    setDeleteGuard({ isOpen: false, transition: null, isDeleting: false })
    toast.success(`مسیر «${targetTitle}» با موفقیت حذف شد.`)
    await onSaved()

    // Background sync with timeout
    try {
      if (isSupabaseConfigured) {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
        const syncDelete = async () => {
          await supabase.from('workflow_transitions').delete().eq('id', targetId)
        }
        await Promise.race([syncDelete(), timeoutPromise]).catch(() => {})
      }
    } catch (err) {
      console.warn('Background transition delete error:', err)
    }
  }

  return (
    <StudioFullScreen title={`مسیرها و خروجی‌های فرایند: ${item.obligation.title}`} onBack={onClose}>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-2xl border border-zinc-800 bg-[#101211] p-6 shadow-xl space-y-6">
          <div className="border-b border-zinc-800/80 pb-4">
            <h3 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-violet-400" />
              مسیرها و خروجی‌های فرایند ({transitions.length} مسیر)
            </h3>
            <p className="mt-1 text-xs text-zinc-400">
              هر مسیر، نتیجه یک مرحله را به مرحله بعدی، انقضا، رویداد سیستمی یا وضعیت پایانی پرونده متصل می‌کند.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {transitions.length === 0 ? (
              <div className="col-span-2 rounded-xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500">
                هنوز مسیری ثبت نشده است. در صورت نیاز با فرم زیر مسیر شاخه‌ای جدید ایجاد کنید.
              </div>
            ) : (
              transitions.map((transition) => (
                <div key={transition.id} className="rounded-xl border border-zinc-700/80 bg-[#1b1e1c] p-4 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold text-zinc-100">{transition.title}</p>
                    <div className="flex items-center gap-1.5">
                      <span className={`rounded-full border px-2.5 py-0.5 text-[11px] ${
                        transition.trigger_type === 'TIMEOUT'
                          ? 'border-orange-800 bg-orange-950/50 text-orange-300'
                          : transition.trigger_type === 'SYSTEM_EVENT'
                            ? 'border-violet-800 bg-violet-950/50 text-violet-300'
                            : 'border-sky-800 bg-sky-950/50 text-sky-300'
                      }`}>
                        {transitionTriggerLabel(transition.trigger_type)}
                      </span>
                      {mode === 'EDIT' && version.status === 'DRAFT' && (
                        <div className="flex items-center gap-1 mr-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-zinc-400 hover:text-violet-300"
                            title="ویرایش مسیر"
                            onClick={() => {
                              setEditingTransition(transition)
                              document.getElementById('transition-form-container')?.scrollIntoView({ behavior: 'smooth' })
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-zinc-400 hover:text-red-400"
                            title="حذف مسیر"
                            onClick={() => setDeleteGuard({ isOpen: true, transition, isDeleting: false })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400">
                    خروجی: <span className="font-mono text-zinc-300">{transition.outcome_code}</span> · {transition.to_step_id ? 'انتقال به گام بعدی' : `پایان: ${transition.terminal_status}`}
                  </p>
                </div>
              ))
            )}
          </div>

          {!transitionSchemaReady && (
            <p className="text-xs text-zinc-500">
              تا زمان فعال‌شدن مسیرهای شاخه‌ای، فرایند با ترتیب طبیعی مراحل ادامه می‌یابد.
            </p>
          )}

          {mode === 'EDIT' && version.status === 'DRAFT' && transitionSchemaReady && (
            <div id="transition-form-container" className="pt-4 border-t border-zinc-800">
              <WorkflowTransitionForm
                version={version}
                steps={steps}
                nextPriority={transitions.length + 1}
                editingTransition={editingTransition}
                onCancelEdit={() => setEditingTransition(null)}
                onSaved={async () => {
                  setEditingTransition(null)
                  await onSaved()
                }}
              />
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-zinc-800">
            <Button variant="outline" onClick={onClose}>
              بستن و بازگشت به صفحه تعهد
            </Button>
          </div>
        </div>
      </div>

      <DeleteGuardModal
        isOpen={deleteGuard.isOpen}
        onClose={() => setDeleteGuard({ isOpen: false, transition: null, isDeleting: false })}
        title={deleteGuard.transition?.title ?? 'مسیر فرایند'}
        entityType="مسیر فرایند"
        description={`آیا از حذف مسیر «${deleteGuard.transition?.title ?? ''}» اطمینان دارید؟`}
        checkResult={{ hasDependencies: false, dependencies: [] }}
        isDeleting={deleteGuard.isDeleting}
        onConfirmDelete={confirmDeleteTransition}
        onConfirm={confirmDeleteTransition}
      />
    </StudioFullScreen>
  )
}

function WorkflowTransitionForm({
  version,
  steps,
  nextPriority,
  editingTransition,
  onCancelEdit,
  onSaved,
}: {
  version: Version
  steps: WorkflowStep[]
  nextPriority: number
  editingTransition?: WorkflowTransition | null
  onCancelEdit?: () => void
  onSaved: () => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [fromStepId, setFromStepId] = useState('')
  const [destination, setDestination] = useState('COMPLETED')
  const [title, setTitle] = useState('')
  const [code, setCode] = useState('')
  const [outcomeCode, setOutcomeCode] = useState('')
  const [triggerType, setTriggerType] = useState('USER_ACTION')
  const [eventCode, setEventCode] = useState('')
  const [timeoutDays, setTimeoutDays] = useState('')

  useEffect(() => {
    if (editingTransition) {
      setOpen(true)
      setFromStepId(editingTransition.from_step_id || '')
      setDestination(editingTransition.to_step_id || editingTransition.terminal_status || 'COMPLETED')
      setTitle(editingTransition.title || '')
      setCode(editingTransition.code || '')
      setOutcomeCode(editingTransition.outcome_code || '')
      setTriggerType(editingTransition.trigger_type || 'USER_ACTION')
      setEventCode(editingTransition.event_code || '')
      const timeoutMatch = editingTransition.timeout_interval?.match(/\d+/)
      setTimeoutDays(timeoutMatch ? timeoutMatch[0] : '')
    }
  }, [editingTransition])

  const handleCancel = () => {
    if (window.confirm('تغییرات مسیر ذخیره نشده است. خارج می‌شوید؟')) {
      setOpen(false)
      setTitle('')
      setCode('')
      setOutcomeCode('')
      setEventCode('')
      setTimeoutDays('')
      onCancelEdit?.()
    }
  }

  const save = async () => {
    if (!fromStepId || !title.trim() || !code.trim() || !outcomeCode.trim()) return toast.error('مرحله مبدأ، عنوان، کد مسیر و کد خروجی الزامی است.')
    if (!isValidCode(normalizeCode(code), 80)) return toast.error('کد مسیر باید حداقل ۲ کاراکتر و فقط شامل حروف انگلیسی، عدد و زیرخط باشد.')
    if (triggerType === 'TIMEOUT' && (!Number.isFinite(Number(timeoutDays)) || Number(timeoutDays) <= 0)) return toast.error('مهلت زمانی باید بیشتر از صفر روز باشد.')
    if (triggerType === 'SYSTEM_EVENT' && !eventCode.trim()) return toast.error('کد رویداد سیستمی الزامی است.')
    if (!isSupabaseConfigured) return toast.error('تعریف مسیر پایدار فقط در حالت اتصال به Supabase در دسترس است.')
    const templateId = steps.find((step) => step.id === fromStepId)?.workflow_template_id
    if (!templateId) return toast.error('قالب فرایند پیدا نشد.')
    const terminal = destination === 'COMPLETED' || destination === 'CANCELLED'

    const payload = {
      workflow_template_id: templateId,
      from_step_id: fromStepId,
      to_step_id: terminal ? null : destination,
      terminal_status: terminal ? destination : null,
      code: normalizeCode(code),
      title: title.trim(),
      outcome_code: normalizeCode(outcomeCode),
      trigger_type: triggerType,
      event_code: triggerType === 'SYSTEM_EVENT' ? normalizeCode(eventCode) : null,
      timeout_interval: triggerType === 'TIMEOUT' ? `${Number(timeoutDays)} days` : null,
      priority: editingTransition ? editingTransition.priority : nextPriority,
    }

    if (editingTransition) {
      const { error } = await supabase.from('workflow_transitions').update(payload).eq('id', editingTransition.id)
      if (error) return toast.error(error.message)
      toast.success(`مسیر «${title.trim()}» با موفقیت ویرایش شد.`)
    } else {
      const { error } = await supabase.from('workflow_transitions').insert(payload)
      if (error) return toast.error(error.message)
      toast.success(`مسیر جدید برای نسخه ${version.version_number} ثبت شد.`)
    }

    setOpen(false)
    setTitle('')
    setCode('')
    setOutcomeCode('')
    setEventCode('')
    setTimeoutDays('')
    onCancelEdit?.()
    await onSaved()
  }

  if (!open && !editingTransition) return <Button variant="outline" className="mt-5 w-full border-violet-800 text-violet-300" onClick={() => setOpen(true)}><Plus className="ml-2 h-4 w-4" />افزودن مسیر / خروجی</Button>
  return (
    <div data-studio-dirty="true" className="mt-5 rounded-xl border border-violet-900/60 bg-violet-950/10 p-4">
      <div className="flex items-center justify-between border-b border-violet-900/40 pb-2 mb-4">
        <p className="text-sm font-bold text-violet-300">
          {editingTransition ? `ویرایش مسیر «${editingTransition.title}»` : 'افزودن مسیر / خروجی جدید'}
        </p>
        {editingTransition && (
          <span className="rounded bg-violet-950 px-2 py-0.5 text-xs text-violet-300 border border-violet-800">حالت ویرایش</span>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="مرحله مبدأ">
          <Select value={fromStepId} onValueChange={setFromStepId}>
            <SelectTrigger><SelectValue placeholder="انتخاب مرحله" /></SelectTrigger>
            <SelectContent>{steps.map((step) => <SelectItem key={step.id} value={step.id}>{step.sequence}. {step.title.replace(/^\d+\.\s*/, '')}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="نوع فعال‌سازی">
          <Select value={triggerType} onValueChange={setTriggerType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="USER_ACTION">اقدام کاربر</SelectItem>
              <SelectItem value="SYSTEM_EVENT">رویداد سیستمی</SelectItem>
              <SelectItem value="TIMEOUT">انقضای خودکار مهلت</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="مقصد">
          <Select value={destination} onValueChange={setDestination}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {steps.map((step) => <SelectItem key={step.id} value={step.id}>مرحله {step.sequence}: {step.title.replace(/^\d+\.\s*/, '')}</SelectItem>)}
              <SelectItem value="COMPLETED">پایان موفق پرونده</SelectItem>
              <SelectItem value="CANCELLED">لغو پرونده</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="عنوان مسیر">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="مثال: صدور برگه تشخیص" />
        </Field>
        <Field label="کد انگلیسی مسیر">
          <Input dir="ltr" value={code} onChange={(event) => setCode(normalizeCode(event.target.value))} maxLength={80} placeholder="ASSESSMENT_ISSUED" />
        </Field>
        <Field label="کد خروجی">
          <Input dir="ltr" value={outcomeCode} onChange={(event) => setOutcomeCode(normalizeCode(event.target.value))} placeholder="DISPUTE_OPENED" />
        </Field>
        {triggerType === 'SYSTEM_EVENT' && (
          <Field label="کد رویداد">
            <Input dir="ltr" value={eventCode} onChange={(event) => setEventCode(normalizeCode(event.target.value))} />
          </Field>
        )}
        {triggerType === 'TIMEOUT' && (
          <Field label="مهلت (روز)">
            <Input type="number" min="1" value={timeoutDays} onChange={(event) => setTimeoutDays(event.target.value)} />
          </Field>
        )}
        <div className="flex items-end gap-2 md:col-span-3">
          <Button className="bg-violet-700 hover:bg-violet-600 font-semibold" onClick={() => void save()}>
            {editingTransition ? 'ذخیره ویرایش مسیر' : 'ذخیره مسیر جدید'}
          </Button>
          <Button variant="ghost" onClick={handleCancel}>انصراف</Button>
        </div>
      </div>
    </div>
  )
}

function PenaltyForm({ version, multiPenaltyTableReady, onSaved }: { version: Version; multiPenaltyTableReady: boolean; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Array<{ id: string; title: string; type: string; value: string }>>(() => penaltyItems(version.penalty_rule))
  const dirty = open

  useEffect(() => {
    if (!open || !isSupabaseConfigured || !multiPenaltyTableReady) return
    void supabase.from('obligation_version_penalties').select('*').eq('obligation_version_id', version.id).order('sequence').then(({ data, error }) => {
      if (!error && data && data.length > 0) setItems(data.map((row) => ({ id: row.id, title: row.title, type: row.penalty_type, value: String(row.penalty_type === 'FIXED' ? row.amount ?? '' : row.rate_percent ?? '') })))
    })
  }, [open, version.id, multiPenaltyTableReady])

  const save = async () => {
    if (items.some((item) => !item.title.trim() || !item.value || !Number.isFinite(Number(item.value)) || Number(item.value) < 0)) return toast.error('عنوان و مقدار معتبر همه جریمه‌ها الزامی است.')
    const normalizedItems = items.map((item) => ({ id: item.id, title: item.title.trim(), type: item.type, ...(item.type === 'FIXED' ? { amount: Number(item.value) } : { rate_percent: Number(item.value) }) }))
    const first = normalizedItems[0]
    const rule: Json = normalizedItems.length > 1
      ? { type: 'MULTIPLE', items: normalizedItems }
      : !first
        ? { type: 'NONE' }
        : 'amount' in first
          ? { type: first.type, amount: first.amount }
          : { type: first.type, rate_percent: first.rate_percent }
    if (isSupabaseConfigured && multiPenaltyTableReady) {
      const { error: deleteError } = await supabase.from('obligation_version_penalties').delete().eq('obligation_version_id', version.id)
      if (deleteError) { toast.error(deleteError.message.includes('schema cache') ? 'جدول جریمه‌های چندگانه هنوز روی Supabase اعمال نشده است. migration جدید را اجرا کنید.' : deleteError.message); return }
      if (items.length > 0) {
        const { error: insertError } = await supabase.from('obligation_version_penalties').insert(items.map((item, index) => ({ obligation_version_id: version.id, title: item.title.trim(), penalty_type: item.type, amount: item.type === 'FIXED' ? Number(item.value) : null, rate_percent: item.type === 'FIXED' ? null : Number(item.value), sequence: index + 1 })))
        if (insertError) { toast.error(insertError.message); return }
      }
      const { error } = await supabase.from('obligation_versions').update({ penalty_rule: rule }).eq('id', version.id)
      if (error) { toast.error(error.message); return }
    } else if (isSupabaseConfigured) {
      const { error } = await supabase.from('obligation_versions').update({ penalty_rule: rule }).eq('id', version.id)
      if (error) { toast.error(error.message); return }
    } else {
      return toast.error('برای ذخیره جریمه اتصال Supabase الزامی است.')
    }
    toast.success(`${items.length.toLocaleString('fa-IR')} جریمه برای تعهد ذخیره شد.`)
    setOpen(false)
    await onSaved()
  }

  if (!open) return <Button variant="outline" className="border-red-900 text-red-300 gap-2" onClick={() => setOpen(true)}><Scale className="h-4 w-4" />تعیین جریمه</Button>
  return (
    <div data-studio-dirty="true" className="sm:col-span-3 rounded-xl border border-red-950 bg-red-950/10 p-4">
      <div className="space-y-3">{items.map((item, index) => <div key={item.id} className="grid gap-3 rounded-lg border border-red-900/40 p-3 sm:grid-cols-[1.4fr,1fr,1fr,auto] sm:items-end"><Field label={`عنوان جریمه ${index + 1}`}><Input value={item.title} onChange={(event) => setItems((current) => current.map((row) => row.id === item.id ? { ...row, title: event.target.value } : row))} /></Field><Field label="نوع"><Select value={item.type} onValueChange={(type) => setItems((current) => current.map((row) => row.id === item.id ? { ...row, type } : row))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="FIXED">مبلغ ثابت</SelectItem><SelectItem value="PERCENTAGE">درصدی</SelectItem><SelectItem value="DAILY_PERCENTAGE">درصد روزانه</SelectItem></SelectContent></Select></Field><Field label={item.type === 'FIXED' ? 'مبلغ (ریال)' : 'نرخ درصد'}><Input type="number" min="0" value={item.value} onChange={(event) => setItems((current) => current.map((row) => row.id === item.id ? { ...row, value: event.target.value } : row))} /></Field><Button variant="ghost" className="text-red-400" onClick={() => setItems((current) => current.filter((row) => row.id !== item.id))}>حذف</Button></div>)}</div>
      <Button variant="outline" className="mt-3 w-full border-red-900 text-red-300" onClick={() => setItems((current) => [...current, { id: crypto.randomUUID(), title: '', type: 'PERCENTAGE', value: '' }])}><Plus className="ml-2 h-4 w-4" />افزودن جریمه دیگر</Button>
      <div className="mt-4 flex gap-2"><Button className="bg-red-800 hover:bg-red-700" onClick={() => void save()}>ذخیره همه جریمه‌ها</Button><Button variant="ghost" onClick={() => { if (!dirty || window.confirm('تغییرات جریمه ذخیره نشده است. خارج می‌شوید؟')) setOpen(false) }}>انصراف</Button></div>
    </div>
  )
}

function FamilyManager({
  families,
  catalog,
  onSaved,
  onDirtyChange,
}: {
  families: Family[]
  catalog: CatalogItem[]
  onSaved: () => Promise<void>
  onDirtyChange: (dirty: boolean) => void
}) {
  const [editingFamily, setEditingFamily] = useState<Family | null>(null)
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [domain, setDomain] = useState('TAX')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [domainFilter, setDomainFilter] = useState<'ALL' | 'TAX' | 'INSURANCE'>('ALL')

  // Delete modal state
  const [deleteGuard, setDeleteGuard] = useState<{
    isOpen: boolean
    family: Family | null
    dependencies: Array<{ formName: string; details: string; iconType?: 'extension' | 'penalty' | 'workflow' | 'template' | 'obligation' }>
    isDeleting: boolean
  }>({
    isOpen: false,
    family: null,
    dependencies: [],
    isDeleting: false,
  })

  // Dirty check tracking
  useEffect(() => {
    if (editingFamily) {
      const isModified =
        code !== (editingFamily.code || '') ||
        title !== (editingFamily.title || '') ||
        domain !== (editingFamily.domain || 'TAX') ||
        description !== (editingFamily.description || '') ||
        isActive !== (editingFamily.is_active ?? true)
      onDirtyChange(isModified)
    } else {
      const isFilled = Boolean(code || title || domain !== 'TAX' || description || !isActive)
      onDirtyChange(isFilled)
    }
  }, [code, title, domain, description, isActive, editingFamily, onDirtyChange])

  const handleStartEdit = (family: Family) => {
    setEditingFamily(family)
    setCode(family.code || '')
    setTitle(family.title || '')
    setDomain(family.domain || 'TAX')
    setDescription(family.description || '')
    setIsActive(family.is_active ?? true)
    document.getElementById('family-form-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleCancelEdit = () => {
    setEditingFamily(null)
    setCode('')
    setTitle('')
    setDomain('TAX')
    setDescription('')
    setIsActive(true)
    onDirtyChange(false)
  }

  const handleClearForm = () => {
    setCode('')
    setTitle('')
    setDomain('TAX')
    setDescription('')
    setIsActive(true)
    onDirtyChange(false)
  }

  const handleSave = async () => {
    const normalizedCode = normalizeCode(code)

    if (!normalizedCode || !title.trim()) {
      toast.error('کد و عنوان گروه الزامی است.')
      return
    }

    if (!isValidCode(normalizedCode, 50)) {
      toast.error('کد گروه باید حداقل ۲ کاراکتر و فقط شامل حروف انگلیسی، عدد و زیرخط باشد.')
      return
    }

    setSaving(true)

    try {
      if (editingFamily) {
        // Updating existing family
        const updatePayload = {
          code: normalizedCode,
          title: title.trim(),
          domain,
          description: description.trim() || null,
          is_active: isActive,
        }

        if (isSupabaseConfigured) {
          const { error } = await supabase
            .from('obligation_families')
            .update(updatePayload)
            .eq('id', editingFamily.id)

          if (error) throw error
        } else {
          throw new Error('برای ویرایش گروه اتصال Supabase الزامی است.')
        }

        toast.success(`گروه «${title.trim()}» با موفقیت به‌روزرسانی شد.`)
        handleCancelEdit()
        await onSaved()
      } else {
        // Creating new family
        const newPayload = {
          code: normalizedCode,
          title: title.trim(),
          domain,
          description: description.trim() || null,
          is_active: isActive,
        }

        if (isSupabaseConfigured) {
          const { error } = await supabase
            .from('obligation_families')
            .insert(newPayload)

          if (error) throw error
        } else {
          throw new Error('برای ایجاد گروه اتصال Supabase الزامی است.')
        }

        toast.success(`گروه جدید «${title.trim()}» با موفقیت ثبت شد.`)
        handleClearForm()
        await onSaved()
      }
    } catch (error) {
      const message =
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof error.message === 'string'
          ? error.message
          : editingFamily
            ? 'به‌روزرسانی گروه انجام نشد.'
            : 'ثبت گروه انجام نشد.'

      toast.error(studioMutationError(error, message))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteClick = (family: Family) => {
    const dependentObligations = catalog.filter((item) => item.obligation.family_id === family.id)
    const dependencies = dependentObligations.map((item) => ({
      formName: 'تکلیف قانونی در کاتالوگ',
      details: `${item.obligation.title} (کد: ${item.obligation.code})`,
      iconType: 'obligation' as const,
    }))

    setDeleteGuard({
      isOpen: true,
      family,
      dependencies,
      isDeleting: false,
    })
  }

  const handleConfirmDelete = async () => {
    const family = deleteGuard.family
    if (!family) return

    setDeleteGuard((prev) => ({ ...prev, isDeleting: true }))

    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('obligation_families')
          .delete()
          .eq('id', family.id)

        if (error) throw error
      } else {
        throw new Error('برای حذف گروه اتصال Supabase الزامی است.')
      }

      toast.success(`گروه «${family.title}» با موفقیت حذف شد.`)
      if (editingFamily?.id === family.id) {
        handleCancelEdit()
      }
      setDeleteGuard({ isOpen: false, family: null, dependencies: [], isDeleting: false })
      await onSaved()
    } catch (error) {
      const message =
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof error.message === 'string'
          ? error.message
          : 'حذف گروه انجام نشد.'

      toast.error(studioMutationError(error, message))
      setDeleteGuard((prev) => ({ ...prev, isDeleting: false }))
    }
  }

  // Filtered families list
  const filteredFamilies = useMemo(() => {
    return families.filter((f) => {
      const matchesDomain = domainFilter === 'ALL' || f.domain === domainFilter
      const query = searchQuery.trim().toLowerCase()
      if (!query) return matchesDomain

      const titleMatch = (f.title || '').toLowerCase().includes(query)
      const codeMatch = (f.code || '').toLowerCase().includes(query)
      const descMatch = (f.description || '').toLowerCase().includes(query)
      return matchesDomain && (titleMatch || codeMatch || descMatch)
    })
  }, [families, domainFilter, searchQuery])

  // Summary counts
  const taxCount = families.filter((f) => f.domain === 'TAX').length
  const insuranceCount = families.filter((f) => f.domain === 'INSURANCE').length

  return (
    <div className="space-y-8 pb-12" dir="rtl">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-[#141615] p-4">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <FolderTree className="h-4 w-4 text-amber-400" />
            مجموع گروه‌ها
          </div>
          <p className="mt-2 text-xl font-black text-zinc-100">{families.length.toLocaleString('fa-IR')}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-[#141615] p-4">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Scale className="h-4 w-4 text-emerald-400" />
            حوزه مالیات
          </div>
          <p className="mt-2 text-xl font-black text-emerald-400">{taxCount.toLocaleString('fa-IR')}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-[#141615] p-4">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <ShieldAlert className="h-4 w-4 text-sky-400" />
            حوزه بیمه
          </div>
          <p className="mt-2 text-xl font-black text-sky-400">{insuranceCount.toLocaleString('fa-IR')}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-[#141615] p-4">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <BookOpenCheck className="h-4 w-4 text-amber-400" />
            کل تکالیف تعریف‌شده
          </div>
          <p className="mt-2 text-xl font-black text-amber-400">{catalog.length.toLocaleString('fa-IR')}</p>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Right Form Card */}
        <div id="family-form-container" className="lg:col-span-5">
          <div className={`rounded-2xl border ${editingFamily ? 'border-amber-600/80 bg-[#171612]' : 'border-zinc-800 bg-[#141615]'} p-5 shadow-xl transition-all`}>
            <div className="mb-5 flex items-center justify-between border-b border-zinc-800/80 pb-4">
              <div className="flex items-center gap-2.5">
                {editingFamily ? (
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-950/80 border border-amber-800/80 text-amber-400">
                    <Pencil className="h-4 w-4" />
                  </div>
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-950/80 border border-emerald-800/80 text-emerald-400">
                    <FolderPlus className="h-4 w-4" />
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-zinc-100">
                    {editingFamily ? 'ویرایش مشخصات گروه' : 'تعریف گروه جدید'}
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {editingFamily ? `در حال ویرایش گروه: «${editingFamily.title}»` : 'ایجاد سرفصل تازه برای تکالیف و تعهدات'}
                  </p>
                </div>
              </div>
              <Badge variant={editingFamily ? 'outline' : 'default'} className={editingFamily ? 'border-amber-700 text-amber-400 bg-amber-950/50' : 'bg-emerald-950 text-emerald-300 border-emerald-800'}>
                {editingFamily ? 'حالت ویرایش' : 'گروه جدید'}
              </Badge>
            </div>

            <div className="space-y-4">
              <Field label="کد شناسه انگلیسی (Code)">
                <Input
                  value={code}
                  onChange={(e) => setCode(normalizeCode(e.target.value))}
                  dir="ltr"
                  maxLength={50}
                  placeholder="DIRECT_TAX"
                  className="font-mono text-left bg-zinc-950/70 border-zinc-800 focus:border-amber-500"
                />
                <p className="text-[11px] text-zinc-500 mt-1">حداقل ۲ حرف بزرگ انگلیسی، عدد یا زیرخط (بدون فاصله).</p>
              </Field>

              <Field label="عنوان فارسی گروه">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: مالیات‌های مستقیم (قانون مالیات‌های مستقیم)"
                  className="bg-zinc-950/70 border-zinc-800 focus:border-amber-500"
                />
              </Field>

              <Field label="حوزه تکالیف">
                <Select value={domain} onValueChange={setDomain}>
                  <SelectTrigger className="bg-zinc-950/70 border-zinc-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TAX">مالیات (سازمان امور مالیاتی)</SelectItem>
                    <SelectItem value="INSURANCE">بیمه (سازمان تأمین اجتماعی)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="توضیحات تکمیلی (اختیاری)">
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="شرح و دامنه شمول این گروه از تکالیف..."
                  className="bg-zinc-950/70 border-zinc-800 focus:border-amber-500"
                />
              </Field>

              <div className="flex items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-3.5 mt-2">
                <div className="space-y-0.5">
                  <Label className="text-xs font-bold text-zinc-200 cursor-pointer" htmlFor="is-active-switch">
                    وضعیت فعال بودن گروه
                  </Label>
                  <p className="text-[11px] text-zinc-500">
                    گروه‌های فعال در زمان ثبت تعهد جدید قابل انتخاب خواهند بود.
                  </p>
                </div>
                <Switch
                  id="is-active-switch"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>

              <div className="pt-3 flex items-center gap-2">
                <Button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSave()}
                  className={`flex-1 font-bold text-xs h-10 gap-1.5 shadow-lg ${
                    editingFamily
                      ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : editingFamily ? (
                    <>
                      <Check className="h-4 w-4" />
                      ذخیره تغییرات گروه
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      ثبت و ایجاد گروه جدید
                    </>
                  )}
                </Button>

                {editingFamily ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancelEdit}
                    disabled={saving}
                    className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs h-10 px-4 gap-1.5"
                  >
                    <X className="h-3.5 w-3.5" />
                    انصراف
                  </Button>
                ) : (
                  (code || title || description || domain !== 'TAX' || !isActive) && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleClearForm}
                      disabled={saving}
                      className="text-zinc-400 hover:text-zinc-200 text-xs h-10 px-3"
                    >
                      پاک‌کردن
                    </Button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Left List Card */}
        <div className="lg:col-span-7">
          <div className="rounded-2xl border border-zinc-800 bg-[#101211] shadow-xl overflow-hidden flex flex-col h-full">
            <div className="border-b border-zinc-800 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 font-bold text-zinc-100">
                    <FolderTree className="h-5 w-5 text-amber-400" />
                    فهرست گروه‌های تعریف‌شده
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    برای ویرایش یا حذف هر گروه، از دکمه‌های ستون عملیات استفاده کنید.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 bg-zinc-900/80 border border-zinc-800 p-1 rounded-xl self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setDomainFilter('ALL')}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                      domainFilter === 'ALL'
                        ? 'bg-amber-500 text-zinc-950 font-bold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    همه ({families.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDomainFilter('TAX')}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                      domainFilter === 'TAX'
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    مالیات ({taxCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDomainFilter('INSURANCE')}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                      domainFilter === 'INSURANCE'
                        ? 'bg-sky-600 text-white font-bold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    بیمه ({insuranceCount})
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="جستجو بر اساس عنوان، کد انگلیسی یا شرح گروه..."
                  className="pr-9 bg-zinc-950/60 border-zinc-800 text-xs h-9"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Groups Table */}
            <div className="flex-1 overflow-x-auto">
              {filteredFamilies.length === 0 ? (
                <div className="py-16 text-center text-zinc-500 text-xs space-y-2">
                  <FolderTree className="mx-auto h-8 w-8 text-zinc-700" />
                  <p>هیچ گروهی متناسب با جستجو یافت نشد.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-zinc-800">
                      <TableHead className="w-12 text-center">ردیف</TableHead>
                      <TableHead>عنوان و کد گروه</TableHead>
                      <TableHead className="text-center">حوزه</TableHead>
                      <TableHead className="text-center">تکالیف متصل</TableHead>
                      <TableHead className="text-center">وضعیت</TableHead>
                      <TableHead className="text-center w-36">عملیات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFamilies.map((family, index) => {
                      const linkedCount = catalog.filter((item) => item.obligation.family_id === family.id).length
                      const isCurrentlyEditing = editingFamily?.id === family.id

                      return (
                        <TableRow
                          key={family.id}
                          className={`border-zinc-800/60 transition-colors ${
                            isCurrentlyEditing
                              ? 'bg-amber-950/30 border-amber-700/50'
                              : 'hover:bg-zinc-900/40'
                          }`}
                        >
                          <TableCell className="text-center font-bold text-zinc-500 text-xs">
                            {index + 1}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-zinc-100 text-sm">{family.title}</span>
                                {isCurrentlyEditing && (
                                  <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-700/50">
                                    در حال ویرایش
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="font-mono text-[11px] text-zinc-400 dir-ltr bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                                  {family.code}
                                </span>
                                {family.description && (
                                  <span className="text-[11px] text-zinc-500 truncate max-w-xs">
                                    · {family.description}
                                  </span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {family.domain === 'INSURANCE' ? (
                              <span className="rounded-full bg-sky-950/70 border border-sky-800/80 px-2.5 py-0.5 text-[11px] font-semibold text-sky-300">
                                بیمه
                              </span>
                            ) : (
                              <span className="rounded-full bg-emerald-950/70 border border-emerald-800/80 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                                مالیات
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                linkedCount > 0
                                  ? 'bg-amber-950/60 border border-amber-800/70 text-amber-300'
                                  : 'bg-zinc-900 border border-zinc-800 text-zinc-500'
                              }`}
                            >
                              {linkedCount > 0 ? `${linkedCount.toLocaleString('fa-IR')} تکلیف` : 'بدون تکلیف'}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            {family.is_active !== false ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                فعال
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-500">
                                <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
                                غیرفعال
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1.5">
                              <Button
                                size="sm"
                                variant={isCurrentlyEditing ? 'default' : 'outline'}
                                className={
                                  isCurrentlyEditing
                                    ? 'bg-amber-500 text-zinc-950 font-bold h-8 text-xs gap-1 px-2.5'
                                    : 'border-zinc-700 hover:bg-zinc-800 text-zinc-200 h-8 text-xs gap-1 px-2.5'
                                }
                                onClick={() => handleStartEdit(family)}
                              >
                                <Pencil className="h-3 w-3" />
                                ویرایش
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-red-900/60 text-red-400 hover:bg-red-950/60 h-8 text-xs gap-1 px-2.5"
                                onClick={() => handleDeleteClick(family)}
                              >
                                <Trash2 className="h-3 w-3" />
                                حذف
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
          </div>
        </div>
      </div>

      {/* Delete Guard Modal */}
      <DeleteGuardModal
        isOpen={deleteGuard.isOpen}
        onClose={() => setDeleteGuard({ isOpen: false, family: null, dependencies: [], isDeleting: false })}
        title={deleteGuard.family?.title ?? 'گروه'}
        entityType="گروه تکالیف"
        description={`گروه «${deleteGuard.family?.title ?? ''}» با کد انگلیسی ${deleteGuard.family?.code ?? ''}`}
        checkResult={{
          hasDependencies: deleteGuard.dependencies.length > 0,
          dependencies: deleteGuard.dependencies,
        }}
        isDeleting={deleteGuard.isDeleting}
        onConfirmDelete={() => void handleConfirmDelete()}
      />
    </div>
  )
}

function DraftForm({ families, onSaved, onDirtyChange }: { families: Family[]; onSaved: (versionId: string) => Promise<void>; onDirtyChange: (dirty: boolean) => void }) {
  const [familyId, setFamilyId] = useState(families[0]?.id ?? '')
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [legalReference, setLegalReference] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [actionUrl, setActionUrl] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [primaryType, setPrimaryType] = useState('TAX_CORPORATE')
  const [recurrence, setRecurrence] = useState('')
  const [baseEvent, setBaseEvent] = useState('')
  const [timeGapValue, setTimeGapValue] = useState('')
  const [timeGapUnit, setTimeGapUnit] = useState('')
  const [responsibleParty, setResponsibleParty] = useState('')
  const [penaltyTypeValue, setPenaltyTypeValue] = useState('NONE')
  const [penaltyValue, setPenaltyValue] = useState('')

  useEffect(() => onDirtyChange(Boolean(code || title || legalReference || sourceUrl || actionUrl || effectiveFrom || recurrence || baseEvent || responsibleParty || penaltyValue || penaltyTypeValue !== 'NONE')), [actionUrl, baseEvent, code, effectiveFrom, legalReference, onDirtyChange, penaltyTypeValue, penaltyValue, recurrence, responsibleParty, sourceUrl, title])

  useEffect(() => {
    if (!familyId && families.length > 0) {
      setFamilyId(families[0].id)
    }
  }, [families, familyId])

  const save = async () => {
    const normalizedCode = normalizeCode(code)
    if (!familyId || !normalizedCode || !title.trim() || !legalReference.trim() || !sourceUrl.trim() || !effectiveFrom || !recurrence || !baseEvent || !responsibleParty) {
      toast.error('گروه، کد، عنوان، مستند قانونی، تاریخ اعتبار، تناوب، رویداد پایه و مسئول اجرا الزامی است.')
      return
    }
    if (!isValidCode(normalizedCode, 80)) {
  toast.error('کد تعهد باید حداقل ۲ کاراکتر و فقط شامل حروف انگلیسی، عدد و زیرخط باشد.')
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
    const recurrenceRule: Json = { obligation_type: primaryType, obligation_types: [primaryType], is_shared: false, recurrence, responsible_party: responsibleParty, sequence_order: 1 }
    const deadlineRule: Json = { base_event: baseEvent, time_gap_value: timeGapValue ? Number(timeGapValue) : null, time_gap_unit: timeGapUnit || null }

    if (!isSupabaseConfigured) {
      toast.error('برای ثبت پیش‌نویس اتصال Supabase الزامی است.')
      return
    }

    try {
      const { data, error } = await supabase.rpc('create_obligation_draft', {
        requested_family_id: familyId,
        requested_code: normalizedCode,
        requested_title: title.trim(),
        requested_summary: undefined,
        requested_authority_name: undefined,
        requested_official_action_url: actionUrl.trim() || undefined,
        requested_legal_reference: legalReference.trim() || undefined,
        requested_source_url: sourceUrl.trim() || undefined,
        requested_effective_from: effectiveFrom || undefined,
        requested_recurrence_rule: recurrenceRule,
        requested_deadline_rule: deadlineRule,
        requested_penalty_rule: penaltyRule,
      })
      if (error) throw error
      toast.success('پیش‌نویس تعهد ثبت شد.')
      await onSaved(data.id)
    } catch (error) {
      toast.error(errorMessage(error, 'ثبت پیش‌نویس تعهد انجام نشد.'))
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
      <Field label="کد انگلیسی"><Input value={code} onChange={(e) => setCode(normalizeCode(e.target.value))} dir="ltr" maxLength={80} placeholder="CORP_INCOME_TAX" /></Field>
      <Field label="عنوان تعهد"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="اظهارنامه مالیات عملکرد اشخاص حقوقی" /></Field>
      <Field label="ماده / مرجع قانونی"><Input value={legalReference} onChange={(e) => setLegalReference(e.target.value)} placeholder="ماده ۱۱۰ قانون مالیات‌های مستقیم" /></Field>
      <Field label="لینک منبع رسمی"><Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} dir="ltr" placeholder="https://tax.gov.ir/..." /></Field>
      <Field label="لینک انجام کار"><Input value={actionUrl} onChange={(e) => setActionUrl(e.target.value)} dir="ltr" placeholder="https://my.tax.gov.ir" /></Field>
      <Field label="تاریخ شروع اعتبار"><JalaliDatePicker value={effectiveFrom} onChange={setEffectiveFrom} placeholder="انتخاب تاریخ..." /></Field>
      <Field label="سرفصل اصلی"><Select value={primaryType} onValueChange={setPrimaryType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{OBLIGATION_TYPE_OPTIONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="دوره تناوب"><Select value={recurrence} onValueChange={setRecurrence}><SelectTrigger><SelectValue placeholder="انتخاب دوره" /></SelectTrigger><SelectContent>{RECURRENCE_OPTIONS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="رویداد پایه"><Select value={baseEvent} onValueChange={setBaseEvent}><SelectTrigger><SelectValue placeholder="انتخاب رویداد" /></SelectTrigger><SelectContent>{BASE_EVENT_OPTIONS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="مسئول اجرا"><Select value={responsibleParty} onValueChange={setResponsibleParty}><SelectTrigger><SelectValue placeholder="انتخاب مسئول" /></SelectTrigger><SelectContent><SelectItem value="مودی">مودی</SelectItem><SelectItem value="سازمان امور مالیاتی">سازمان امور مالیاتی</SelectItem></SelectContent></Select></Field>
      <Field label="فاصله زمانی"><Input type="number" min="0" dir="ltr" value={timeGapValue} onChange={(e) => setTimeGapValue(e.target.value)} /></Field>
      <Field label="واحد فاصله"><Select value={timeGapUnit} onValueChange={setTimeGapUnit}><SelectTrigger><SelectValue placeholder="انتخاب واحد" /></SelectTrigger><SelectContent><SelectItem value="روز">روز</SelectItem><SelectItem value="ماه">ماه</SelectItem><SelectItem value="سال">سال</SelectItem></SelectContent></Select></Field>
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

function EligibilityRuleForm({
  versionId,
  nextPriority,
  editingRule,
  editingConditions,
  onCancelEdit,
  onSaved,
}: {
  versionId: string
  nextPriority: number
  editingRule?: RuleSet | null
  editingConditions?: Array<{ fact_key: string; operator: string; expected_value: any }>
  onCancelEdit?: () => void
  onSaved: () => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<number>(nextPriority)
  const [explanation, setExplanation] = useState('')
  const [outcome, setOutcome] = useState('ELIGIBLE')
  const [conditions, setConditions] = useState<DraftCondition[]>([
    { fact: 'ENTITY_TYPE', operator: 'EQ', expected: 'حقوقی' },
  ])

  useEffect(() => {
    if (editingRule) {
      setOpen(true)
      setTitle(editingRule.title || '')
      setPriority(editingRule.priority ?? nextPriority)
      setOutcome(editingRule.outcome || 'ELIGIBLE')
      setExplanation(editingRule.explanation || '')
      if (editingConditions && editingConditions.length > 0) {
        setConditions(
          editingConditions.map((c) => ({
            fact: c.fact_key,
            operator: c.operator,
            expected: Array.isArray(c.expected_value)
              ? c.expected_value.join(', ')
              : c.expected_value !== null && c.expected_value !== undefined
                ? String(c.expected_value)
                : '',
          }))
        )
      } else {
        setConditions([{ fact: 'ENTITY_TYPE', operator: 'EQ', expected: 'حقوقی' }])
      }
    } else {
      setPriority(nextPriority)
    }
  }, [editingRule, editingConditions, nextPriority])

  const updateCondition = (index: number, patch: Partial<DraftCondition>) => {
    setConditions((current) => current.map((condition, position) =>
      position === index ? { ...condition, ...patch } : condition
    ))
  }

  const handleCancel = () => {
    if (window.confirm('تغییرات قاعده ذخیره نشده است. خارج می‌شوید؟')) {
      setOpen(false)
      setTitle('')
      setExplanation('')
      setOutcome('ELIGIBLE')
      setConditions([{ fact: 'ENTITY_TYPE', operator: 'EQ', expected: 'حقوقی' }])
      onCancelEdit?.()
    }
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

    const currentPriority = priority > 0 ? priority : nextPriority

    if (editingRule) {
      if (!isSupabaseConfigured) {
        toast.error('برای ویرایش قاعده اتصال Supabase الزامی است.')
        return
      }

      try {
        const { error: ruleUpdateError } = await supabase
          .from('eligibility_rule_sets')
          .update({
            priority: currentPriority,
            title: title.trim(),
            outcome,
            explanation: explanation.trim(),
          })
          .eq('id', editingRule.id)

        if (ruleUpdateError) throw ruleUpdateError

        await supabase.from('eligibility_conditions').delete().eq('rule_set_id', editingRule.id)

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
            rule_set_id: editingRule.id,
            sequence: index + 1,
            fact_key: condition.fact,
            operator: condition.operator,
            expected_value: expectedValue,
          }
        })
        const { error: conditionError } = await supabase.from('eligibility_conditions').insert(rows)
        if (conditionError) {
          toast.error(conditionError.message)
          return
        }

        toast.success(`قاعده «${title.trim()}» با موفقیت ویرایش شد.`)
        setOpen(false)
        onCancelEdit?.()
        await onSaved()
      } catch (err) {
        toast.error(errorMessage(err, 'ویرایش قاعده انجام نشد.'))
      }
      return
    }

    if (!isSupabaseConfigured) {
      toast.error('برای ثبت قاعده اتصال Supabase الزامی است.')
      return
    }

    try {
      const { data: rule, error } = await supabase.from('eligibility_rule_sets').insert({ obligation_version_id: versionId, priority: currentPriority, title: title.trim(), outcome, explanation: explanation.trim() }).select().single()
      if (error) throw error
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
      setTitle('')
      setExplanation('')
      await onSaved()
    } catch (error) {
      toast.error(errorMessage(error, 'ثبت قاعده انجام نشد.'))
    }
  }

  if (!open && !editingRule) return <Button variant="outline" className="mt-4 w-full border-zinc-700 gap-2" onClick={() => { setOpen(true); setTitle(''); setExplanation(''); setOutcome('ELIGIBLE'); setConditions([{ fact: 'ENTITY_TYPE', operator: 'EQ', expected: 'حقوقی' }]) }}><Plus className="h-4 w-4" />افزودن قاعده جدید</Button>
  return (
    <div data-studio-dirty="true" className="mt-4 space-y-3 rounded-xl border border-zinc-800 bg-[#161817] p-4">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
        <p className="text-sm font-bold text-amber-300">
          {editingRule ? `ویرایش قاعده مشمولیت (${editingRule.title})` : 'افزودن قاعده مشمولیت جدید'}
        </p>
        {editingRule && (
          <span className="rounded bg-amber-950/70 px-2 py-0.5 text-xs text-amber-300 border border-amber-800/60">حالت ویرایش</span>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Field label="عنوان قاعده"><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="مشمولیت اشخاص حقوقی" /></Field>
        </div>
        <div>
          <Field label="اولویت اجرا"><Input type="number" min={1} value={priority} onChange={(event) => setPriority(Number(event.target.value))} /></Field>
        </div>
      </div>
      <Field label="نتیجه مشمولیت"><Select value={outcome} onValueChange={setOutcome}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ELIGIBLE">مشمول قطعی (ELIGIBLE)</SelectItem><SelectItem value="NOT_ELIGIBLE">غیرمشمول (NOT_ELIGIBLE)</SelectItem><SelectItem value="REVIEW">نیازمند بررسی (REVIEW)</SelectItem></SelectContent></Select></Field>
      <div className="space-y-3">
        {conditions.map((condition, index) => {
          const operatorOptions = allowedOperators(condition.fact)
          return (
            <div key={index} className="rounded-lg border border-zinc-800 bg-[#121413] p-3">
              <p className="mb-3 text-xs text-zinc-500">شرط {index + 1} (همهٔ شرط‌ها باید برقرار باشند)</p>
              <div className="space-y-3">
                <Field label="بر اساس فکت"><Select value={condition.fact} onValueChange={(fact) => updateCondition(index, { fact, operator: allowedOperators(fact)[0]?.[0] ?? 'EQ', expected: '' })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FACTS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></Field>
                <Field label="عملگر شرط"><Select value={condition.operator} onValueChange={(operator) => updateCondition(index, { operator, expected: '' })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{operatorOptions.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></Field>
                {!noValueOperators.has(condition.operator) && <Field label={condition.operator === 'IN' ? 'مقادیر (با ویرگول جدا کنید)' : 'مقدار مورد انتظار'}><Input value={condition.expected} onChange={(event) => updateCondition(index, { expected: event.target.value })} /></Field>}
                {conditions.length > 1 && <Button variant="ghost" className="text-red-400 text-xs" onClick={() => setConditions((current) => current.filter((_, position) => position !== index))}>حذف این شرط</Button>}
              </div>
            </div>
          )
        })}
      </div>
      <Button variant="outline" className="w-full border-zinc-700 text-xs gap-1" onClick={() => setConditions((current) => [...current, { fact: 'ENTITY_TYPE', operator: 'EQ', expected: '' }])}><Plus className="h-3.5 w-3.5" />افزودن شرط دیگر</Button>
      <Field label="توضیح ساده برای کاربر"><Input value={explanation} onChange={(event) => setExplanation(event.target.value)} placeholder="توضیح قانونی برای شرکت‌ها..." /></Field>
      <div className="flex gap-2">
        <SaveButton onClick={save} />
        <Button variant="ghost" onClick={handleCancel}>انصراف</Button>
      </div>
    </div>
  )
}

function WorkflowStepForm({
  version,
  nextSequence,
  editingStep,
  onCancelEdit,
  onSaved,
}: {
  version: Version
  nextSequence: number
  editingStep?: WorkflowStep | null
  onCancelEdit?: () => void
  onSaved: () => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [sequence, setSequence] = useState<number>(nextSequence)
  const [title, setTitle] = useState('')
  const [code, setCode] = useState('')
  const [actor, setActor] = useState('USER')
  const [instructions, setInstructions] = useState('')
  const [fieldLabel, setFieldLabel] = useState('')
  const [fieldKey, setFieldKey] = useState('')
  const [fieldType, setFieldType] = useState('text')

  useEffect(() => {
    if (editingStep) {
      setOpen(true)
      setSequence(editingStep.sequence ?? nextSequence)
      setTitle(editingStep.title ? editingStep.title.replace(/^\d+\.\s*/, '') : '')
      setCode(editingStep.code || '')
      setActor(editingStep.actor || 'USER')
      setInstructions(editingStep.instructions || '')
      const firstField = editingStep.form_schema?.fields?.[0]
      if (firstField) {
        setFieldLabel(firstField.label || '')
        setFieldKey(firstField.key || '')
        setFieldType(firstField.type || 'text')
      } else {
        setFieldLabel('')
        setFieldKey('')
        setFieldType('text')
      }
    } else {
      setSequence(nextSequence)
    }
  }, [editingStep, nextSequence])

  const handleCancel = () => {
    if (window.confirm('تغییرات مرحله ذخیره نشده است. خارج می‌شوید؟')) {
      setOpen(false)
      setTitle('')
      setCode('')
      setInstructions('')
      setFieldLabel('')
      setFieldKey('')
      onCancelEdit?.()
    }
  }

  const save = async () => {
    if (!title.trim() || !code.trim()) {
      toast.error('عنوان و کد مرحله الزامی است.')
      return
    }
    if (!isValidCode(normalizeCode(code), 80)) {
      toast.error('کد مرحله باید حداقل ۲ کاراکتر و فقط شامل حروف انگلیسی، عدد و زیرخط باشد.')
      return
    }

    const fields: Json[] = fieldLabel.trim() ? [{ key: fieldKey.trim() || 'custom_field', label: fieldLabel.trim(), type: fieldType, required: true }] : []
    const currentSequence = sequence > 0 ? sequence : nextSequence

    if (editingStep) {
      if (!isSupabaseConfigured) {
        toast.error('برای ویرایش مرحله اتصال Supabase الزامی است.')
        return
      }

      try {
        const { error: stepUpdateError } = await supabase
          .from('workflow_steps')
          .update({
            sequence: currentSequence,
            code: normalizeCode(code),
            title: title.trim(),
            actor,
            instructions: instructions.trim() || null,
            form_schema: { fields },
          })
          .eq('id', editingStep.id)

        if (stepUpdateError) throw stepUpdateError

        toast.success(`مرحله «${title.trim()}» با موفقیت ویرایش شد.`)
        setOpen(false)
        onCancelEdit?.()
        await onSaved()
      } catch (err) {
        toast.error(errorMessage(err, 'ویرایش مرحله انجام نشد.'))
      }
      return
    }

    if (!isSupabaseConfigured) {
      toast.error('برای ثبت مرحله اتصال Supabase الزامی است.')
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
        const result = await supabase.from('workflow_steps').insert({
          workflow_template_id: template.id,
          sequence: currentSequence,
          code: normalizeCode(code),
          title: title.trim(),
          actor,
          instructions: instructions.trim() || null,
          form_schema: { fields },
        })
        if (result.error) throw result.error
      } else {
        throw new Error('قالب فرایند در Supabase پیدا نشد.')
      }
      toast.success('مرحله ثبت شد.')
      setOpen(false)
      setTitle('')
      setCode('')
      setInstructions('')
      setFieldLabel('')
      setFieldKey('')
      await onSaved()
    } catch (error) {
      toast.error(errorMessage(error, 'ثبت مرحله انجام نشد.'))
    }
  }

  if (!open && !editingStep) return <Button variant="outline" className="mt-4 w-full border-zinc-700 gap-2" onClick={() => { setOpen(true); setTitle(''); setCode(''); setInstructions(''); setFieldLabel(''); setFieldKey('') }}><Plus className="h-4 w-4" />افزودن مرحله جدید</Button>
  return (
    <div data-studio-dirty="true" className="mt-4 space-y-3 rounded-xl border border-zinc-800 bg-[#161817] p-4">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
        <p className="text-sm font-bold text-amber-300">
          {editingStep ? `ویرایش مرحله فرایند (${editingStep.title})` : 'افزودن مرحله فرایند جدید'}
        </p>
        {editingStep && (
          <span className="rounded bg-amber-950/70 px-2 py-0.5 text-xs text-amber-300 border border-amber-800/60">حالت ویرایش</span>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-3">
          <Field label="عنوان مرحله"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="بارگذاری اظهارنامه در سامانه" /></Field>
        </div>
        <div>
          <Field label="ترتیب گام"><Input type="number" min={1} value={sequence} onChange={(e) => setSequence(Number(e.target.value))} /></Field>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="کد انگلیسی یکتا"><Input value={code} onChange={(e) => setCode(normalizeCode(e.target.value))} dir="ltr" maxLength={80} placeholder="SUBMIT_RETURN" /></Field>
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
      </div>
      <Field label="راهنمای انجام برای کاربر (اختیاری)"><Input value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="مثال: ورود به درگاه ملی خدمات مالیاتی و بارگذاری فایل تراز آزمایشی..." /></Field>
      <div className="rounded-lg border border-zinc-800 bg-[#121413] p-3">
        <p className="mb-3 text-xs text-zinc-500">فیلد ورودی فرم برای این مرحله (اختیاری)</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="عنوان فیلد"><Input value={fieldLabel} onChange={(e) => setFieldLabel(e.target.value)} placeholder="کد رهگیری اظهارنامه" /></Field>
          <Field label="کلید انگلیسی"><KeyRegistryField raw compact title={fieldLabel} entityType="WORKFLOW_STEP" module="workflow" initialKey={fieldKey} placeholder="tracking_code" onFullKeyChange={(k) => setFieldKey(k)} /></Field>
          <Field label="نوع فیلد">
            <Select value={fieldType} onValueChange={setFieldType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="text">متن (Text)</SelectItem>
                <SelectItem value="number">عدد (Number)</SelectItem>
                <SelectItem value="date">تاریخ (Date)</SelectItem>
                <SelectItem value="checkbox">تأیید / بله‌خیر (Boolean)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </div>
      <div className="flex gap-2">
        <SaveButton onClick={save} />
        <Button variant="ghost" onClick={handleCancel}>انصراف</Button>
      </div>
    </div>
  )
}

function Editor({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mb-6 rounded-2xl border border-zinc-800 bg-[#141615] p-5"><h3 className="mb-4 font-bold">{title}</h3><div className="grid gap-4 md:grid-cols-3">{children}</div></section>
}
function SectionLink({ target, label }: { target: string; label: string }) { return <Button type="button" size="sm" variant="ghost" className="shrink-0 text-xs text-zinc-300" onClick={() => document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{label}</Button> }
function SectionHeading({ number, title, description }: { number: string; title: string; description: string }) { return <div className="flex items-start gap-3 border-b border-zinc-800 pb-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 font-black text-zinc-950">{number}</span><div><h3 className="font-black text-zinc-100">{title}</h3><p className="mt-1 text-xs leading-5 text-zinc-500">{description}</p></div></div> }
function FormGroup({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <fieldset className="rounded-xl border border-zinc-800 bg-[#171918] p-4"><legend className="px-2 text-sm font-bold text-amber-300">{title}</legend><p className="mb-4 text-xs text-zinc-500">{description}</p><div className="grid gap-4 sm:grid-cols-2">{children}</div></fieldset> }
function StudioFullScreen({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-[90] overflow-y-auto bg-[#0b0d0c] p-4 text-zinc-100 sm:p-6"><div className="mx-auto max-w-6xl"><div className="sticky top-0 z-20 mb-5 flex items-center justify-between rounded-xl border border-zinc-800 bg-[#101211]/95 p-3 backdrop-blur"><Button variant="ghost" className="gap-2" onClick={onBack}><ArrowRight className="h-4 w-4" />بازگشت</Button><h2 className="font-black">{title}</h2></div>{children}</div></div> }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div> }
function SaveButton({ onClick, disabled = false }: { onClick: () => Promise<void>; disabled?: boolean }) { return <div className="flex items-end"><Button type="button" disabled={disabled} onClick={() => void onClick()} className="w-full bg-emerald-700 hover:bg-emerald-600">ذخیره</Button></div> }
function Metric({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number }) { return <div className="rounded-xl border border-zinc-800 bg-[#1b1e1c] p-4 shadow-sm"><div className="flex items-center gap-2 text-xs text-zinc-500"><Icon className="h-4 w-4 text-amber-400" />{label}</div><p className="mt-2 text-base font-black leading-6 text-zinc-100">{value}</p></div> }
function DefinitionRow({ title, meta }: { title: string; meta: string }) { return <div className="rounded-lg border border-zinc-800 p-3"><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs text-zinc-500">{meta}</p></div> }
function versionStatusLabel(status: string) { return ({ DRAFT: 'پیش‌نویس', REVIEW: 'در بازبینی', TESTING: 'در آزمایش', PUBLISHED: 'منتشرشده', RETIRED: 'منسوخ' } as Record<string, string>)[status] ?? status }
function penaltyType(value: Json) { if (!value || Array.isArray(value) || typeof value !== 'object') return 'نامشخص'; return String(value['type'] ?? 'NONE') }
function actorLabel(actor: string) { return ({ USER: 'کاربر شرکت', PLATFORM_ADMIN: 'مدیر پلتفرم', AUTHORITY: 'مرجع قانونی / مدیر' } as Record<string, string>)[actor] ?? actor }
function actorClass(actor: string) { return ({ USER: 'border-sky-800 bg-sky-950/60 text-sky-300', PLATFORM_ADMIN: 'border-amber-800 bg-amber-950/60 text-amber-300', AUTHORITY: 'border-violet-800 bg-violet-950/60 text-violet-300' } as Record<string, string>)[actor] ?? 'border-zinc-700 bg-zinc-900 text-zinc-300' }
function transitionTriggerLabel(trigger: string) { return ({ USER_ACTION: 'اقدام کاربر', SYSTEM_EVENT: 'رویداد سیستمی', TIMEOUT: 'انقضای خودکار' } as Record<string, string>)[trigger] ?? trigger }
function jsonRecord(value: Json): Record<string, Json | undefined> { return value && !Array.isArray(value) && typeof value === 'object' ? value as Record<string, Json | undefined> : {} }
function stringValue(value: Json | undefined, fallback = '') { return typeof value === 'string' ? value : fallback }
function stringArray(value: Json | undefined) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [] }
function numberString(value: Json | undefined, fallback = '') { return typeof value === 'number' || typeof value === 'string' ? String(value) : fallback }
function errorMessage(error: unknown, fallback: string) { return typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string' ? error.message : fallback }
function normalizeCode(value: string) { return value.toUpperCase().trimStart().replace(/[\s-]+/g, '_').replace(/[^A-Z0-9_]/g, '').replace(/_+/g, '_') }
function isValidCode(value: string, maxLength: number) { return value.length <= maxLength && /^[A-Z][A-Z0-9_]{1,}$/.test(value) }
function studioMutationError(error: unknown, fallback: string) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
  const message = errorMessage(error, fallback)
  if (code === '23505' || message.includes('duplicate key')) return 'این کد قبلاً ثبت شده است؛ یک کد یکتا انتخاب کنید.'
  if (code === '23514' || message.includes('_code_check')) return 'کد باید با حرف انگلیسی آغاز شود و فقط شامل حروف انگلیسی، عدد و زیرخط باشد.'
  return message
}
function studioDeadlineLabel(version: Version) { const recurrence = jsonRecord(version.recurrence_rule); const deadline = jsonRecord(version.deadline_rule); const frequency = stringValue(recurrence['recurrence'], 'بدون تناوب'); const amount = deadline['time_gap_value']; const unit = stringValue(deadline['time_gap_unit']); return amount != null && unit ? `${frequency} · ${amount} ${unit} پس از رویداد پایه` : frequency }
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
