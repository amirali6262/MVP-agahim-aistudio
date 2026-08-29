import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  Loader2,
  RefreshCw,
  Scale,
  ShieldCheck,
  CircleDashed,
  Inbox,
} from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import type { Database, Json, Tables } from '../../lib/database.types'
import { Button } from '../../lib/shadcn/button'
import { Input } from '../../lib/shadcn/input'
import { Label } from '../../lib/shadcn/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../lib/shadcn/select'
import { Switch } from '../../lib/shadcn/switch'
import { useTenant } from '../../context/TenantContext'

const BRAND = '#5B4DE6'
const BRAND_SOFT = '#EEECFC'
const BRAND_LIGHT = '#F7F6FB'

type ComplianceCase = Tables<'compliance_cases'>
type CaseTask = Tables<'case_tasks'>
type CaseDeadline = Tables<'case_deadlines'>
type WorkflowStep = Tables<'workflow_steps'>
type WorkflowTransition = Tables<'workflow_transitions'>
type PenaltyEstimate = Tables<'penalty_estimates'>
type Assessment = Tables<'eligibility_assessments'>
type ObligationVersion = Tables<'obligation_versions'>

interface FormField {
  key: string
  label: string
  type: 'text' | 'number' | 'date' | 'checkbox' | 'select'
  required: boolean
  options: string[]
  placeholder?: string
}

type RowStatus = 'NEEDS_ACTION' | 'IN_PROGRESS' | 'WAITING' | 'COMPLETED' | 'CANCELLED' | 'OVERDUE'
type Risk = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'

interface ActionRow {
  case: ComplianceCase
  title: string
  domain: string
  period: string
  deadline: CaseDeadline | null
  task: CaseTask | null
  step: WorkflowStep | null
  transitions: WorkflowTransition[]
  penalty: PenaltyEstimate | null
  reason: string
  status: RowStatus
  risk: Risk
  assignee: string
}

interface DeadlineItem {
  id: string
  caseTitle: string
  period: string
  dueAt: string
}

const DOMAIN_LABEL: Record<string, string> = { TAX: 'مالیات', INSURANCE: 'بیمه' }

export default function CompanyDashboard() {
  const { selectedTenant } = useTenant()
  const tenantId = selectedTenant?.id ?? ''

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [rows, setRows] = useState<ActionRow[]>([])
  const [totalCases, setTotalCases] = useState(0)
  const [completedCases, setCompletedCases] = useState(0)
  const [overdueCount, setOverdueCount] = useState(0)
  const [penaltyTotal, setPenaltyTotal] = useState(0)
  const [deadlines, setDeadlines] = useState<DeadlineItem[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [dataVersion, setDataVersion] = useState(0)

  const reload = useCallback(() => setDataVersion((v) => v + 1), [])

  const load = useCallback(async () => {
    if (!tenantId) return
    if (!isSupabaseConfigured) {
      setLoadError('اتصال به پایگاه‌داده برقرار نیست.')
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError(null)

    try {
      // ── 1. Cases of this company ──
      const { data: caseRows, error: casesError } = await supabase
        .from('compliance_cases')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('opened_at', { ascending: false })
      if (casesError) throw new Error(casesError.message)
      const cases = (caseRows ?? []) as ComplianceCase[]

      const caseIds = cases.map((c) => c.id)
      const versionIds = [...new Set(cases.map((c) => c.obligation_version_id))]
      const assessmentIds = [...new Set(cases.map((c) => c.assessment_id))]

      const empty = <T,>(value: T) => value

      // ── 2. Active tasks, latest deadlines, penalties for those cases ──
      const [tasksRes, deadlinesRes, penaltiesRes, versionsRes, assessmentsRes] = await Promise.all([
        caseIds.length
          ? supabase.from('case_tasks').select('*').in('case_id', caseIds).eq('status', 'ACTIVE')
          : Promise.resolve(empty({ data: [] as CaseTask[], error: null })),
        caseIds.length
          ? supabase.from('case_deadlines').select('*').in('case_id', caseIds)
          : Promise.resolve(empty({ data: [] as CaseDeadline[], error: null })),
        caseIds.length
          ? supabase.from('penalty_estimates').select('*').in('case_id', caseIds)
          : Promise.resolve(empty({ data: [] as PenaltyEstimate[], error: null })),
        versionIds.length
          ? supabase.from('obligation_versions').select('id, obligation_id, legal_reference').in('id', versionIds)
          : Promise.resolve(empty({ data: [] as Array<{ id: string; obligation_id: string; legal_reference: string | null }>, error: null })),
        assessmentIds.length
          ? supabase.from('eligibility_assessments').select('*').in('id', assessmentIds)
          : Promise.resolve(empty({ data: [] as Assessment[], error: null })),
      ])
      const anyError = tasksRes.error ?? deadlinesRes.error ?? penaltiesRes.error ?? versionsRes.error ?? assessmentsRes.error
      if (anyError) throw new Error(anyError.message)

      const tasks = (tasksRes.data ?? []) as CaseTask[]
      const deadlinesAll = (deadlinesRes.data ?? []) as CaseDeadline[]
      const penalties = (penaltiesRes.data ?? []) as PenaltyEstimate[]
      const versions = (versionsRes.data ?? []) as Array<{ id: string; obligation_id: string; legal_reference: string | null }>
      const assessments = (assessmentsRes.data ?? []) as Assessment[]

      // ── 3. Step details + obligations + families + transitions ──
      const stepIds = [...new Set(tasks.map((t) => t.workflow_step_id))]
      const obligationIds = [...new Set(versions.map((v) => v.obligation_id))]
      const [stepsRes, obligationsRes, familiesRes, transitionsRes] = await Promise.all([
        stepIds.length ? supabase.from('workflow_steps').select('*').in('id', stepIds) : Promise.resolve(empty({ data: [] as WorkflowStep[], error: null })),
        obligationIds.length ? supabase.from('obligations').select('id, title, family_id, official_action_url, summary').in('id', obligationIds) : Promise.resolve(empty({ data: [] as Array<{ id: string; title: string; family_id: string; official_action_url: string | null; summary: string | null }>, error: null })),
        supabase.from('obligation_families').select('id, domain, title'),
        stepIds.length ? supabase.from('workflow_transitions').select('*').in('from_step_id', stepIds).eq('trigger_type', 'USER_ACTION').order('priority') : Promise.resolve(empty({ data: [] as WorkflowTransition[], error: null })),
      ])
      const secondError = stepsRes.error ?? obligationsRes.error ?? familiesRes.error ?? transitionsRes.error
      if (secondError) throw new Error(secondError.message)

      const steps = (stepsRes.data ?? []) as WorkflowStep[]
      const obligations = (obligationsRes.data ?? []) as Array<{ id: string; title: string; family_id: string; official_action_url: string | null; summary: string | null }>
      const families = (familiesRes.data ?? []) as Array<{ id: string; domain: string; title: string }>
      const transitions = (transitionsRes.data ?? []) as WorkflowTransition[]

      const stepById = new Map(steps.map((s) => [s.id, s]))
      const taskByCase = new Map<string, CaseTask>()
      tasks.forEach((t) => { if (!taskByCase.has(t.case_id)) taskByCase.set(t.case_id, t) })
      const latestDeadlineByCase = new Map<string, CaseDeadline>()
      deadlinesAll
        .slice()
        .sort((a, b) => new Date(b.due_at).getTime() - new Date(a.due_at).getTime())
        .forEach((d) => { if (!latestDeadlineByCase.has(d.case_id)) latestDeadlineByCase.set(d.case_id, d) })
      const penaltyByCase = new Map<string, PenaltyEstimate>()
      penalties
        .slice()
        .sort((a, b) => new Date(b.calculated_as_of).getTime() - new Date(a.calculated_as_of).getTime())
        .forEach((p) => { if (!penaltyByCase.has(p.case_id)) penaltyByCase.set(p.case_id, p) })
      const versionById = new Map(versions.map((v) => [v.id, v]))
      const obligationById = new Map(obligations.map((o) => [o.id, o]))
      const familyById = new Map(families.map((f) => [f.id, f]))
      const assessmentById = new Map(assessments.map((a) => [a.id, a]))

      const now = Date.now()
      const computedRows: ActionRow[] = cases.map((c) => {
        const version = versionById.get(c.obligation_version_id)
        const obligation = version ? obligationById.get(version.obligation_id) : undefined
        const family = obligation ? familyById.get(obligation.family_id) : undefined
        const task = taskByCase.get(c.id) ?? null
        const step = task ? stepById.get(task.workflow_step_id) ?? null : null
        const deadline = latestDeadlineByCase.get(c.id) ?? null
        const penalty = penaltyByCase.get(c.id) ?? null
        const due = deadline?.due_at ?? task?.due_at ?? null
        const overdue = !!due && new Date(due).getTime() < now && c.status !== 'COMPLETED' && c.status !== 'CANCELLED'

        let status: RowStatus = 'WAITING'
        if (c.status === 'COMPLETED') status = 'COMPLETED'
        else if (c.status === 'CANCELLED') status = 'CANCELLED'
        else if (overdue) status = 'OVERDUE'
        else if (task) status = c.status === 'IN_PROGRESS' || c.status === 'BLOCKED' ? 'IN_PROGRESS' : 'NEEDS_ACTION'

        let risk: Risk = 'NONE'
        if (due) {
          const days = Math.ceil((new Date(due).getTime() - now) / 86_400_000)
          risk = days < 0 ? 'HIGH' : days <= 7 ? 'MEDIUM' : 'LOW'
        }

        const actor = step?.actor
        const assignee = actor === 'USER' ? 'شما' : actor === 'PLATFORM_ADMIN' ? 'مدیر پلتفرم' : actor === 'AUTHORITY' ? 'مرجع قانونی' : '—'

        return {
          case: c,
          title: obligation?.title ?? 'تعهد قانونی',
          domain: family?.domain ?? '',
          period: c.period_key,
          deadline,
          task,
          step,
          transitions: task ? transitions.filter((t) => t.from_step_id === task.workflow_step_id) : [],
          penalty,
          reason: assessmentById.get(c.assessment_id)?.explanation || 'این تعهد بر اساس اطلاعات ثبت‌شده شرکت فعال شده است.',
          status,
          risk,
          assignee,
        }
      })

      const nonCancelled = computedRows.filter((r) => r.case.status !== 'CANCELLED')
      const completed = nonCancelled.filter((r) => r.case.status === 'COMPLETED').length
      const overdue = computedRows.filter((r) => r.status === 'OVERDUE').length
      const penaltySum = computedRows.reduce((sum, r) => sum + Number(r.penalty?.estimated_amount ?? 0), 0)

      // Nearest upcoming deadlines (per open case, latest deadline each).
      const deadlineItems: DeadlineItem[] = computedRows
        .filter((r) => r.deadline && r.case.status !== 'COMPLETED' && r.case.status !== 'CANCELLED')
        .map((r) => ({
          id: r.deadline!.id,
          caseTitle: r.title,
          period: r.period,
          dueAt: r.deadline!.due_at,
        }))
        .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
        .slice(0, 6)

      setRows(computedRows)
      setTotalCases(nonCancelled.length)
      setCompletedCases(completed)
      setOverdueCount(overdue)
      setPenaltyTotal(penaltySum)
      setDeadlines(deadlineItems)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'دریافت اطلاعات داشبورد ناموفق بود.')
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    void load()
  }, [load, dataVersion])

  // Sort: overdue first, then by deadline, then waiting.
  const sortedRows = useMemo(() => {
    const rank = { OVERDUE: 0, NEEDS_ACTION: 1, IN_PROGRESS: 2, WAITING: 3, COMPLETED: 4, CANCELLED: 5 } as const
    return [...rows].sort((a, b) => {
      const r = rank[a.status] - rank[b.status]
      if (r !== 0) return r
      const ad = a.deadline?.due_at ?? a.task?.due_at
      const bd = b.deadline?.due_at ?? b.task?.due_at
      if (ad && bd) return new Date(ad).getTime() - new Date(bd).getTime()
      if (ad) return -1
      if (bd) return 1
      return 0
    })
  }, [rows])

  const compliancePercent = totalCases > 0 ? Math.round((completedCases / totalCases) * 100) : null
  const activeCases = sortedRows.filter((r) => r.case.status !== 'COMPLETED' && r.case.status !== 'CANCELLED')

  return (
    <div className="space-y-6" dir="rtl">
      {/* ── Page header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-50 sm:text-2xl">داشبورد شرکت</h1>
          <p className="mt-1.5 max-w-2xl text-xs leading-6 text-zinc-500 dark:text-zinc-400 sm:text-sm">
            {selectedTenant?.name} — در یک نگاه بدانید چه کاری باید انجام دهید، کدام مهلت نزدیک است، کدام مورد خطر دارد و وضعیت کلی تعهدات چیست.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={reload} disabled={loading} className="w-fit gap-2 border-zinc-300 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" style={{ color: BRAND }} /> : <RefreshCw className="h-4 w-4" />}
          به‌روزرسانی
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-white py-20 text-xs text-zinc-400 dark:border-zinc-800 dark:bg-[#161618]">
          <Loader2 className="h-7 w-7 animate-spin" style={{ color: BRAND }} />
          در حال بارگذاری داده‌های شرکت...
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-10 text-center dark:border-red-900/60 dark:bg-red-950/30">
          <AlertTriangle className="h-8 w-8 text-red-500" />
          <p className="text-sm font-bold text-red-700 dark:text-red-300">دریافت داده‌ها ناموفق بود</p>
          <p className="max-w-md text-xs leading-6 text-red-600/90 dark:text-red-300/80">{loadError}</p>
          <Button size="sm" onClick={reload} className="gap-2 text-xs text-white" style={{ background: BRAND }}>
            <RefreshCw className="h-3.5 w-3.5" />
            تلاش دوباره
          </Button>
        </div>
      ) : (
        <>
          {/* ── Summary strip (single horizontal level with simple dividers) ── */}
          <section className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#161618]">
            <div className="flex min-w-max items-stretch divide-x divide-x-reverse divide-zinc-100 dark:divide-zinc-800">
              <SummaryCell
                label="وضعیت کلی انطباق"
                value={compliancePercent === null ? '—' : `${compliancePercent.toLocaleString('fa-IR')}٪`}
                hint={totalCases === 0 ? 'پرونده‌ای ثبت نشده است' : `${completedCases.toLocaleString('fa-IR')} از ${totalCases.toLocaleString('fa-IR')} پرونده`}
                icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              />
              <SummaryCell
                label="هشدارهای بحرانی"
                value={overdueCount.toLocaleString('fa-IR')}
                hint="مهلت‌های گذشته"
                danger={overdueCount > 0}
                icon={<AlertTriangle className={overdueCount > 0 ? 'h-4 w-4 text-red-500' : 'h-4 w-4 text-zinc-400'} />}
              />
              <SummaryCell
                label="اقدامات در جریان"
                value={activeCases.filter((r) => r.task).length.toLocaleString('fa-IR')}
                hint="نیازمند اقدام شما"
                icon={<ClipboardList className="h-4 w-4 text-zinc-400" style={{ color: BRAND }} />}
              />
              <SummaryCell
                label="تکمیل‌شده"
                value={completedCases.toLocaleString('fa-IR')}
                hint="پرونده مختومه"
                icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              />
              <SummaryCell
                label="در انتظار تأیید مدیر"
                value="۰"
                hint="گردش تأیید هنوز فعال نیست"
                icon={<CircleDashed className="h-4 w-4 text-amber-500" />}
              />
              {penaltyTotal > 0 && (
                <SummaryCell
                  label="برآورد جریمه"
                  value={penaltyTotal.toLocaleString('fa-IR')}
                  hint="ریال — برآورد، نه مبلغ قطعی"
                  icon={<Scale className="h-4 w-4 text-amber-500" />}
                />
              )}
            </div>
          </section>

          {/* ── Essential actions table ── */}
          <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#161618]">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
              <div>
                <h2 className="text-sm font-extrabold text-zinc-900 dark:text-zinc-50">اقدامات ضروری</h2>
                <p className="mt-0.5 text-[11px] text-zinc-400">اقدامات فوری و پرریسک در بالای جدول مرتب شده‌اند.</p>
              </div>
              <span className="rounded-full px-3 py-1 text-[11px] font-bold" style={{ background: BRAND_SOFT, color: BRAND }}>
                {activeCases.length.toLocaleString('fa-IR')} اقدام
              </span>
            </div>

            {activeCases.length === 0 ? (
              <div className="flex flex-col items-center gap-3 p-10 text-center">
                <Inbox className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
                <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200">فعلاً اقدامی برای انجام ندارید</p>
                <p className="max-w-sm text-xs leading-6 text-zinc-400">اگر پرونده‌ای برای این شرکت فعال شود، اقدام موردنیاز اینجا نمایش داده می‌شود.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse text-right">
                  <thead>
                    <tr className="border-b border-zinc-100 text-[11px] text-zinc-400 dark:border-zinc-800">
                      <th className="px-5 py-3 font-bold">عنوان اقدام</th>
                      <th className="px-3 py-3 font-bold">حوزه</th>
                      <th className="px-3 py-3 font-bold">مهلت نهایی</th>
                      <th className="px-3 py-3 font-bold">میزان ریسک</th>
                      <th className="px-3 py-3 font-bold">مسئول</th>
                      <th className="px-3 py-3 font-bold">وضعیت</th>
                      <th className="px-5 py-3 font-bold">عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows
                      .filter((r) => r.case.status !== 'COMPLETED' && r.case.status !== 'CANCELLED')
                      .map((row) => {
                        const expanded = expandedId === row.case.id
                        return (
                          <ActionRowView
                            key={row.case.id}
                            row={row}
                            expanded={expanded}
                            onToggle={() => setExpandedId(expanded ? null : row.case.id)}
                            onDone={reload}
                          />
                        )
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ── Bottom support sections ── */}
          <div className="grid gap-5 xl:grid-cols-2">
            {/* Nearest deadlines */}
            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#161618]">
              <h2 className="flex items-center gap-2 text-sm font-extrabold text-zinc-900 dark:text-zinc-50">
                <CalendarClock className="h-4 w-4" style={{ color: BRAND }} />
                نزدیک‌ترین مهلت‌ها
              </h2>
              {deadlines.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-zinc-200 p-6 text-center text-xs text-zinc-400 dark:border-zinc-700">
                  مهلت ثبت‌شده‌ای برای پرونده‌های باز وجود ندارد.
                </div>
              ) : (
                <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
                  {deadlines.map((d) => {
                    const days = Math.ceil((new Date(d.dueAt).getTime() - Date.now()) / 86_400_000)
                    const overdue = days < 0
                    return (
                      <li key={d.id} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-zinc-800 dark:text-zinc-100">{d.caseTitle}</p>
                          <p className="mt-0.5 text-[10px] text-zinc-400">دوره {d.period}</p>
                        </div>
                        <div className="shrink-0 text-left">
                          <p className="text-[11px] font-bold text-zinc-700 dark:text-zinc-200">{formatDate(d.dueAt)}</p>
                          <p className={`mt-0.5 text-[10px] font-bold ${overdue ? 'text-red-600 dark:text-red-400' : days <= 7 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {overdue ? `${Math.abs(days).toLocaleString('fa-IR')} روز گذشته` : days === 0 ? 'مهلت امروز' : `${days.toLocaleString('fa-IR')} روز مانده`}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            {/* Active processes */}
            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#161618]">
              <h2 className="flex items-center gap-2 text-sm font-extrabold text-zinc-900 dark:text-zinc-50">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                پرونده‌ها و فرایندهای فعال
              </h2>
              {activeCases.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-zinc-200 p-6 text-center text-xs text-zinc-400 dark:border-zinc-700">
                  پرونده فعالی برای این شرکت وجود ندارد.
                </div>
              ) : (
                <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
                  {activeCases.slice(0, 6).map((row) => (
                    <li key={row.case.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-zinc-800 dark:text-zinc-100">{row.title}</p>
                        <p className="mt-0.5 text-[10px] text-zinc-400">دوره {row.period}</p>
                      </div>
                      <StatusPill status={row.status} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function SummaryCell({ label, value, hint, icon, danger = false }: { label: string; value: string; hint: string; icon: React.ReactNode; danger?: boolean }) {
  return (
    <div className="w-44 px-5 py-4">
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">{label}</p>
      </div>
      <p className={`mt-2 text-xl font-black ${danger ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-zinc-50'}`}>{value}</p>
      <p className="mt-0.5 truncate text-[10px] text-zinc-400">{hint}</p>
    </div>
  )
}

function ActionRowView({ row, expanded, onToggle, onDone }: { row: ActionRow; expanded: boolean; onToggle: () => void; onDone: () => void }) {
  return (
    <>
      <tr className={`border-b border-zinc-100 transition last:border-0 hover:bg-zinc-50/60 dark:border-zinc-800 dark:hover:bg-zinc-800/20 ${expanded ? 'bg-violet-50/40 dark:bg-violet-950/10' : ''}`}>
        <td className="px-5 py-4">
          <p className="max-w-[220px] truncate text-xs font-bold text-zinc-800 dark:text-zinc-100">{row.title}</p>
          <p className="mt-1 text-[10px] text-zinc-400">دوره {row.period}</p>
        </td>
        <td className="px-3 py-4">
          <span className="rounded-md px-2 py-1 text-[10px] font-bold" style={{ background: BRAND_SOFT, color: BRAND }}>
            {DOMAIN_LABEL[row.domain] ?? (row.domain || '—')}
          </span>
        </td>
        <td className="px-3 py-4">
          {row.deadline ? (
            <div>
              <p className="text-[11px] font-bold text-zinc-700 dark:text-zinc-200">{formatDate(row.deadline.due_at)}</p>
              <p className="mt-0.5 text-[10px] text-zinc-400">{daysLabel(row.deadline.due_at)}</p>
            </div>
          ) : (
            <span className="text-[11px] text-zinc-400">مهلت ثبت نشده</span>
          )}
        </td>
        <td className="px-3 py-4"><RiskBadge risk={row.risk} /></td>
        <td className="px-3 py-4 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">{row.assignee}</td>
        <td className="px-3 py-4"><StatusPill status={row.status} /></td>
        <td className="px-5 py-4">
          {row.task && row.step ? (
            <Button size="sm" onClick={onToggle} className="gap-1.5 text-[11px] font-bold text-white" style={{ background: BRAND }}>
              <ChevronLeft className={`h-3.5 w-3.5 transition ${expanded ? 'rotate-90' : ''}`} />
              مشاهده و اقدام
            </Button>
          ) : (
            <span className="text-[11px] text-zinc-400">در انتظار مرحله بعد</span>
          )}
        </td>
      </tr>
      {expanded && row.task && row.step && (
        <tr className="border-b border-zinc-100 bg-violet-50/40 dark:border-zinc-800 dark:bg-violet-950/10">
          <td colSpan={7} className="px-5 py-5">
            <TaskForm task={row.task} step={row.step} transitions={row.transitions} reason={row.reason} onCompleted={onDone} />
          </td>
        </tr>
      )}
    </>
  )
}

function TaskForm({ task, step, transitions, reason, onCompleted }: { task: CaseTask; step: WorkflowStep; transitions: WorkflowTransition[]; reason: string; onCompleted: () => void }) {
  const fields = useMemo(() => parseFields(step.form_schema), [step.form_schema])
  const [values, setValues] = useState<Record<string, string | number | boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [transitionId, setTransitionId] = useState(transitions.length === 1 ? transitions[0].id : '')

  const submit = async () => {
    const missing = fields.find((field) => field.required && (values[field.key] === undefined || values[field.key] === '' || (field.type === 'checkbox' && values[field.key] !== true)))
    if (missing) return toast.error(`لطفاً «${missing.label}» را تکمیل کنید.`)
    if (!transitionId) return toast.error('نتیجه این مرحله را انتخاب کنید.')
    const response: Record<string, Json> = {}
    fields.forEach((field) => {
      const value = values[field.key]
      if (field.type === 'number' && typeof value === 'string' && value !== '') response[field.key] = Number(value)
      else if (value !== undefined && value !== '') response[field.key] = value
    })
    setSubmitting(true)
    const { error } = await supabase.rpc('complete_case_task', {
      requested_task_id: task.id,
      requested_transition_id: transitionId,
      requested_response: response,
    })
    setSubmitting(false)
    if (error) return toast.error(error.message)
    toast.success('این کار انجام شد و مرحله بعدی آماده است.')
    onCompleted()
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-[#161618]">
          <p className="text-[11px] font-bold text-zinc-400">چرا این اقدام فعال شده؟</p>
          <p className="mt-1.5 text-xs leading-6 text-zinc-600 dark:text-zinc-300">{reason}</p>
        </div>
        <div className="rounded-xl border border-violet-200 bg-white p-4 dark:border-violet-800/60 dark:bg-[#161618]">
          <p className="text-[11px] font-bold" style={{ color: BRAND }}>اقدام بعدی</p>
          <p className="mt-1.5 text-sm font-extrabold text-zinc-800 dark:text-zinc-100">{step.title}</p>
          {step.instructions && <p className="mt-1.5 text-xs leading-6 text-zinc-500 dark:text-zinc-400">{step.instructions}</p>}
        </div>
      </div>

      {fields.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {fields.map((field) => (
            <DynamicField key={field.key} field={field} value={values[field.key]} onChange={(value) => setValues((current) => ({ ...current, [field.key]: value }))} />
          ))}
        </div>
      )}

      {transitions.length > 0 && (
        <div className="max-w-md space-y-2">
          <Label className="text-[11px] text-zinc-500 dark:text-zinc-400">نتیجه و مسیر بعدی</Label>
          <Select value={transitionId} onValueChange={setTransitionId}>
            <SelectTrigger className="border-zinc-200 bg-white text-xs dark:border-zinc-700 dark:bg-[#161618]">
              <SelectValue placeholder="مسیر معتبر را انتخاب کنید" />
            </SelectTrigger>
            <SelectContent>
              {transitions.map((transition) => (
                <SelectItem key={transition.id} value={transition.id} className="text-xs">
                  {transition.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Button onClick={() => void submit()} disabled={submitting || transitions.length === 0} className="gap-2 text-xs font-bold text-white" style={{ background: BRAND }}>
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        ثبت نتیجه و ادامه در مسیر انتخاب‌شده
      </Button>
    </div>
  )
}

function DynamicField({ field, value, onChange }: { field: FormField; value: string | number | boolean | undefined; onChange: (value: string | boolean) => void }) {
  if (field.type === 'checkbox') {
    return (
      <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-[#161618]">
        <Label className="text-xs text-zinc-700 dark:text-zinc-200">{field.label}{field.required ? ' *' : ''}</Label>
        <Switch checked={Boolean(value)} onCheckedChange={onChange} />
      </div>
    )
  }
  if (field.type === 'select') {
    return (
      <div className="space-y-2">
        <Label className="text-xs text-zinc-700 dark:text-zinc-200">{field.label}{field.required ? ' *' : ''}</Label>
        <Select value={typeof value === 'string' ? value : ''} onValueChange={onChange}>
          <SelectTrigger className="border-zinc-200 bg-white text-xs dark:border-zinc-700 dark:bg-[#161618]">
            <SelectValue placeholder="انتخاب کنید" />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((option) => (
              <SelectItem key={option} value={option} className="text-xs">{option}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <Label className="text-xs text-zinc-700 dark:text-zinc-200">{field.label}{field.required ? ' *' : ''}</Label>
      <Input
        type={field.type}
        value={typeof value === 'string' || typeof value === 'number' ? value : ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder}
        className="h-10 border-zinc-200 bg-white text-xs dark:border-zinc-700 dark:bg-[#161618]"
      />
    </div>
  )
}

function parseFields(schema: Json): FormField[] {
  if (!schema || Array.isArray(schema) || typeof schema !== 'object' || !Array.isArray(schema['fields'])) return []
  return schema['fields'].flatMap((item) => {
    if (!item || Array.isArray(item) || typeof item !== 'object') return []
    const type = item['type']
    const key = item['key']
    const label = item['label']
    if (typeof key !== 'string' || typeof label !== 'string' || !['text', 'number', 'date', 'checkbox', 'select'].includes(String(type))) return []
    return [{
      key,
      label,
      type: type as FormField['type'],
      required: item['required'] === true,
      options: Array.isArray(item['options']) ? item['options'].filter((option): option is string => typeof option === 'string') : [],
      placeholder: typeof item['placeholder'] === 'string' ? item['placeholder'] : undefined,
    }]
  })
}

function RiskBadge({ risk }: { risk: Risk }) {
  if (risk === 'HIGH') return <span className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold text-red-600 dark:bg-red-950/40 dark:text-red-300">بالا</span>
  if (risk === 'MEDIUM') return <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-600 dark:bg-amber-950/40 dark:text-amber-300">متوسط</span>
  if (risk === 'LOW') return <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">کم</span>
  return <span className="text-[10px] text-zinc-400">—</span>
}

function StatusPill({ status }: { status: RowStatus }) {
  const map: Record<RowStatus, { label: string; cls: string }> = {
    OVERDUE: { label: 'دارای تأخیر', cls: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300' },
    NEEDS_ACTION: { label: 'نیازمند اقدام', cls: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300' },
    IN_PROGRESS: { label: 'در حال انجام', cls: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' },
    WAITING: { label: 'در انتظار مرحله بعد', cls: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400' },
    COMPLETED: { label: 'تکمیل‌شده', cls: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300' },
    CANCELLED: { label: 'لغوشده', cls: 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500' },
  }
  const item = map[status]
  return <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-bold ${item.cls}`}>{item.label}</span>
}

function daysLabel(dueAt: string) {
  const days = Math.ceil((new Date(dueAt).getTime() - Date.now()) / 86_400_000)
  if (days < 0) return `${Math.abs(days).toLocaleString('fa-IR')} روز گذشته`
  if (days === 0) return 'مهلت امروز'
  return `${days.toLocaleString('fa-IR')} روز مانده`
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'تاریخ نامعتبر'
  return date.toLocaleDateString('fa-IR', { year: 'numeric', month: 'short', day: 'numeric' })
}
