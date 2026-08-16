import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Bell, CalendarClock, CheckCircle2, ChevronLeft, ClipboardCheck, ExternalLink, FileText, Loader2, RefreshCw, Scale, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { Database, Json, Tables } from '../lib/database.types'
import { Button } from '../lib/shadcn/button'
import { Input } from '../lib/shadcn/input'
import { Label } from '../lib/shadcn/label'
import { Switch } from '../lib/shadcn/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../lib/shadcn/select'

type ComplianceCase = Tables<'compliance_cases'>
type CaseTask = Tables<'case_tasks'>
type WorkflowStep = Tables<'workflow_steps'>
type Notification = Tables<'notifications'>
type Deadline = Tables<'case_deadlines'>
type PenaltyEstimate = Tables<'penalty_estimates'>
type Assessment = Tables<'eligibility_assessments'>
type Summary = Database['public']['Functions']['get_tenant_compliance_summary']['Returns'][number]

interface Props { tenantId: string; tenantName: string }
interface FormField { key: string; label: string; type: 'text' | 'number' | 'date' | 'checkbox' | 'select'; required: boolean; options: string[]; placeholder?: string }
interface CaseView {
  item: ComplianceCase
  title: string
  authorityName: string | null
  officialActionUrl: string | null
  sourceUrl: string | null
  legalReference: string | null
  reason: string
  task: CaseTask | null
  step: WorkflowStep | null
  deadline: Deadline | null
  penalty: PenaltyEstimate | null
}

const emptySummary: Summary = { total_cases: 0, open_cases: 0, overdue_cases: 0, completed_cases: 0, unread_notifications: 0, total_estimated_penalties: 0 }

export default function CompanyComplianceOverview({ tenantId, tenantName }: Props) {
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [summary, setSummary] = useState<Summary>(emptySummary)
  const [cases, setCases] = useState<CaseView[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [periodKey, setPeriodKey] = useState('')

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return }
    setLoading(true)
    const [summaryResult, casesResult, notificationsResult] = await Promise.all([
      supabase.rpc('get_tenant_compliance_summary', { requested_tenant_id: tenantId }),
      supabase.from('compliance_cases').select('*').eq('tenant_id', tenantId).order('opened_at', { ascending: false }),
      supabase.from('notifications').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(8),
    ])
    const primaryError = summaryResult.error ?? casesResult.error ?? notificationsResult.error
    if (primaryError) { toast.error(primaryError.message || 'دریافت اطلاعات ناموفق بود.'); setLoading(false); return }

    const caseRows = casesResult.data ?? []
    const caseIds = caseRows.map((row) => row.id)
    const versionIds = [...new Set(caseRows.map((row) => row.obligation_version_id))]
    const assessmentIds = [...new Set(caseRows.map((row) => row.assessment_id))]
    const [tasksResult, deadlinesResult, penaltiesResult, versionsResult, assessmentsResult] = await Promise.all([
      caseIds.length ? supabase.from('case_tasks').select('*').in('case_id', caseIds).eq('status', 'ACTIVE').order('created_at', { ascending: true }) : Promise.resolve({ data: [] as CaseTask[], error: null }),
      // A later deadline can be an official extension; the original date remains stored separately.
      caseIds.length ? supabase.from('case_deadlines').select('*').in('case_id', caseIds).order('due_at', { ascending: false }) : Promise.resolve({ data: [] as Deadline[], error: null }),
      caseIds.length ? supabase.from('penalty_estimates').select('*').in('case_id', caseIds).order('calculated_as_of', { ascending: false }) : Promise.resolve({ data: [] as PenaltyEstimate[], error: null }),
      versionIds.length ? supabase.from('obligation_versions').select('id, obligation_id, source_url, legal_reference').in('id', versionIds) : Promise.resolve({ data: [] as Array<{ id: string; obligation_id: string; source_url: string | null; legal_reference: string | null }>, error: null }),
      assessmentIds.length ? supabase.from('eligibility_assessments').select('*').in('id', assessmentIds) : Promise.resolve({ data: [] as Assessment[], error: null }),
    ])
    const secondaryError = tasksResult.error ?? deadlinesResult.error ?? penaltiesResult.error ?? versionsResult.error ?? assessmentsResult.error
    if (secondaryError) { toast.error(secondaryError.message); setLoading(false); return }

    const tasks = tasksResult.data ?? []
    const stepIds = [...new Set(tasks.map((task) => task.workflow_step_id))]
    const obligationIds = [...new Set((versionsResult.data ?? []).map((version) => version.obligation_id))]
    const [stepsResult, obligationsResult] = await Promise.all([
      stepIds.length ? supabase.from('workflow_steps').select('*').in('id', stepIds) : Promise.resolve({ data: [] as WorkflowStep[], error: null }),
      obligationIds.length ? supabase.from('obligations').select('id, title, authority_name, official_action_url').in('id', obligationIds) : Promise.resolve({ data: [] as Array<{ id: string; title: string; authority_name: string | null; official_action_url: string | null }>, error: null }),
    ])
    if (stepsResult.error || obligationsResult.error) { toast.error(stepsResult.error?.message ?? obligationsResult.error?.message ?? 'دریافت جزئیات پرونده ناموفق بود.'); setLoading(false); return }

    const stepById = new Map((stepsResult.data ?? []).map((row) => [row.id, row]))
    const taskByCase = firstByCase(tasks)
    const deadlineByCase = firstByCase(deadlinesResult.data ?? [])
    const penaltyByCase = firstByCase(penaltiesResult.data ?? [])
    const assessmentById = new Map((assessmentsResult.data ?? []).map((row) => [row.id, row]))
    const versionById = new Map((versionsResult.data ?? []).map((row) => [row.id, row]))
    const obligationById = new Map((obligationsResult.data ?? []).map((row) => [row.id, row]))
    const views = caseRows.map((item): CaseView => {
      const task = taskByCase.get(item.id) ?? null
      const version = versionById.get(item.obligation_version_id)
      const obligation = version ? obligationById.get(version.obligation_id) : undefined
      return {
        item, title: obligation?.title ?? 'تعهد قانونی', authorityName: obligation?.authority_name ?? null,
        officialActionUrl: obligation?.official_action_url ?? null, sourceUrl: version?.source_url ?? null,
        legalReference: version?.legal_reference ?? null,
        reason: assessmentById.get(item.assessment_id)?.explanation || 'این تعهد براساس اطلاعات ثبت‌شده کسب‌وکار شما فعال شده است.',
        task, step: task ? stepById.get(task.workflow_step_id) ?? null : null,
        deadline: deadlineByCase.get(item.id) ?? null, penalty: penaltyByCase.get(item.id) ?? null,
      }
    })
    setSummary(summaryResult.data?.[0] ?? emptySummary)
    setNotifications(notificationsResult.data ?? [])
    setCases(views.sort(compareUrgency))
    setLoading(false)
  }, [tenantId])

  useEffect(() => { void load() }, [load])

  const runEligibility = async () => {
    setRunning(true)
    const { data, error } = await supabase.rpc('evaluate_tenant_eligibility', { requested_tenant_id: tenantId })
    setRunning(false)
    if (error) return toast.error(error.message)
    const eligible = data?.filter((item) => item.outcome === 'ELIGIBLE').length ?? 0
    const review = data?.filter((item) => item.outcome === 'REVIEW').length ?? 0
    toast.success(`تشخیص انجام شد: ${eligible} تعهد مشمول و ${review} مورد نیازمند بررسی.`)
  }

  const openCases = async () => {
    if (!periodKey.trim()) return toast.error('دوره را وارد کنید؛ مثلاً ۱۴۰۵ یا ۱۴۰۵-بهار.')
    setRunning(true)
    const { data, error } = await supabase.rpc('open_eligible_cases', { requested_tenant_id: tenantId, requested_period_key: periodKey.trim() })
    setRunning(false)
    if (error) return toast.error(error.message)
    toast.success(`${data?.length ?? 0} پروندهٔ قابل اجرا برای این دوره آماده شد.`)
    await load()
  }

  const markRead = async (id: string) => {
    const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
    if (error) toast.error(error.message); else await load()
  }

  if (loading) return <div className="flex justify-center py-24 text-zinc-400"><Loader2 className="h-7 w-7 animate-spin" /></div>

  const actionableCases = cases.filter((view) => view.task && view.step && !['COMPLETED', 'CANCELLED'].includes(view.item.status))
  const waitingCases = cases.filter((view) => !view.task && !['COMPLETED', 'CANCELLED'].includes(view.item.status))

  return (
    <section className="space-y-6 text-zinc-100" dir="rtl">
      <header className="overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-bl from-[#1b1d1b] to-[#111312] p-5 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div><p className="mb-2 text-xs font-bold text-amber-400">میز کار امروز</p><h1 className="text-2xl font-black sm:text-3xl">{tenantName}</h1><p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">مهم‌ترین اقدام‌ها بر اساس مهلت مرتب شده‌اند؛ از اولین کارت شروع کنید.</p></div>
          <Button variant="outline" size="sm" onClick={() => void load()} className="w-fit gap-2 border-zinc-700"><RefreshCw className="h-4 w-4" />به‌روزرسانی</Button>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard label="کار فوری" value={actionableCases.length} icon={<ClipboardCheck className="h-5 w-5" />} />
          <SummaryCard label="مهلت گذشته" value={summary.overdue_cases} icon={<AlertTriangle className="h-5 w-5" />} danger />
          <SummaryCard label="پرونده باز" value={summary.open_cases} icon={<CalendarClock className="h-5 w-5" />} />
          <SummaryCard label="انجام‌شده" value={summary.completed_cases} icon={<CheckCircle2 className="h-5 w-5" />} />
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr),minmax(280px,1fr)]">
        <main className="space-y-4">
          <div className="flex items-end justify-between gap-3"><div><h2 className="text-lg font-black">کارهای فوری من</h2><p className="mt-1 text-xs text-zinc-500">هر کارت فقط یک اقدام اصلی دارد.</p></div><span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-300">{actionableCases.length.toLocaleString('fa-IR')} کار</span></div>
          {actionableCases.length === 0 ? <EmptyState hasCases={cases.length > 0} /> : actionableCases.map((view) => <TaskCard key={view.task!.id} view={view} onCompleted={load} />)}
          {waitingCases.length > 0 && <div className="pt-2"><h2 className="mb-3 text-sm font-bold text-zinc-400">پرونده‌های در انتظار</h2><div className="grid gap-3 sm:grid-cols-2">{waitingCases.map((view) => <div key={view.item.id} className="rounded-2xl border border-zinc-800 bg-[#141615] p-4"><div className="flex items-center justify-between gap-3"><p className="font-bold">{view.title}</p><StatusPill status={view.item.status} /></div><p className="mt-2 text-xs leading-5 text-zinc-500">اقدام فعالی برای شما ثبت نشده است. وضعیت پرونده به‌محض ایجاد مرحله بعدی به‌روزرسانی می‌شود.</p></div>)}</div></div>}
        </main>

        <aside className="space-y-5">
          <div className="rounded-2xl border border-zinc-800 bg-[#141615] p-5"><h2 className="flex items-center gap-2 font-bold"><Bell className="h-4 w-4 text-amber-400" />پیام‌های مهم</h2><div className="mt-4 space-y-2">{notifications.length === 0 ? <p className="text-sm text-zinc-500">پیام جدیدی ندارید.</p> : notifications.map((item) => <button key={item.id} onClick={() => !item.read_at && void markRead(item.id)} className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-right transition hover:border-zinc-700"><div className="flex items-start justify-between gap-2"><span className="text-sm font-semibold">{item.title}</span>{!item.read_at && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-400" />}</div><p className="mt-1 line-clamp-3 text-xs leading-5 text-zinc-400">{item.body}</p></button>)}</div></div>
          <div className="rounded-2xl border border-zinc-800 bg-[#141615] p-5"><h2 className="flex items-center gap-2 font-bold"><ShieldCheck className="h-4 w-4 text-amber-400" />به‌روزرسانی تعهدات</h2><p className="mt-2 text-xs leading-6 text-zinc-400">پس از تغییر اطلاعات کسب‌وکار یا شروع دوره جدید، تعهدات را دوباره بررسی کنید.</p><Button onClick={runEligibility} disabled={running} variant="outline" className="mt-4 w-full border-zinc-700">{running && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}بررسی دوباره تعهدات</Button><div className="mt-4 space-y-2 border-t border-zinc-800 pt-4"><Label htmlFor="period-key">دوره جدید</Label><Input id="period-key" value={periodKey} onChange={(event) => setPeriodKey(event.target.value)} placeholder="مثلاً ۱۴۰۵-بهار" /><Button onClick={openCases} disabled={running} className="w-full">ساخت پرونده‌های دوره</Button></div></div>
          {Number(summary.total_estimated_penalties) > 0 && <div className="rounded-2xl border border-red-900/50 bg-red-950/10 p-5"><div className="flex items-center gap-2 text-red-300"><Scale className="h-4 w-4" /><span className="text-sm font-bold">برآورد جریمه پرونده‌ها</span></div><p className="mt-3 text-xl font-black">{Number(summary.total_estimated_penalties).toLocaleString('fa-IR')} <span className="text-xs font-normal text-zinc-400">ریال</span></p><p className="mt-2 text-xs leading-5 text-zinc-500">این مبلغ برآورد است و مبلغ قطعی قانونی محسوب نمی‌شود.</p></div>}
        </aside>
      </div>
    </section>
  )
}

function TaskCard({ view, onCompleted }: { view: CaseView; onCompleted: () => Promise<void> }) {
  const isOverdue = view.deadline ? new Date(view.deadline.due_at).getTime() < Date.now() : false
  const officialUrl = view.officialActionUrl ?? view.sourceUrl
  return <article className={`overflow-hidden rounded-2xl border bg-[#141615] ${isOverdue ? 'border-red-900/70' : 'border-zinc-800'}`}>
    <div className="p-5 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="mb-2 flex flex-wrap items-center gap-2"><StatusPill status={view.item.status} /><span className="text-xs text-zinc-500">دوره {view.item.period_key}</span></div><h3 className="text-lg font-black">{view.title}</h3>{view.authorityName && <p className="mt-1 text-xs text-zinc-500">مرجع: {view.authorityName}</p>}</div><DeadlineBadge deadline={view.deadline} task={view.task} /></div>
      <div className="mt-5 grid gap-3 md:grid-cols-2"><InfoBox icon={<ShieldCheck />} label="چرا برای من فعال شده؟" value={view.reason} /><InfoBox icon={<ChevronLeft />} label="اقدام بعدی" value={view.step?.title ?? 'در انتظار تعیین مرحله بعد'} highlight /><InfoBox icon={<FileText />} label="مبنای قانونی" value={view.legalReference ?? 'در منبع رسمی این تعهد درج شده است.'} /><InfoBox icon={<ClipboardCheck />} label="وضعیت پرونده" value={statusLabel(view.item.status)} /></div>
      {(officialUrl || view.penalty) && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-4 text-xs">{view.penalty ? <span className="text-zinc-400">برآورد جریمه: <strong className="text-red-300">{Number(view.penalty.estimated_amount).toLocaleString('fa-IR')} ریال</strong></span> : <span />}{officialUrl && <a href={officialUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-bold text-amber-400 hover:text-amber-300">مشاهده منبع یا سامانه رسمی <ExternalLink className="h-3.5 w-3.5" /></a>}</div>}
    </div>{view.task && view.step && <TaskForm task={view.task} step={view.step} onCompleted={onCompleted} />}
  </article>
}

function TaskForm({ task, step, onCompleted }: { task: CaseTask; step: WorkflowStep; onCompleted: () => Promise<void> }) {
  const fields = useMemo(() => parseFields(step.form_schema), [step.form_schema])
  const [values, setValues] = useState<Record<string, string | number | boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const submit = async () => {
    const missing = fields.find((field) => field.required && (values[field.key] === undefined || values[field.key] === '' || (field.type === 'checkbox' && values[field.key] !== true)))
    if (missing) return toast.error(`لطفاً «${missing.label}» را تکمیل کنید.`)
    const response: Record<string, Json> = {}
    fields.forEach((field) => { const value = values[field.key]; if (field.type === 'number' && typeof value === 'string' && value !== '') response[field.key] = Number(value); else if (value !== undefined && value !== '') response[field.key] = value })
    setSubmitting(true)
    const { error } = await supabase.rpc('complete_case_task', { requested_task_id: task.id, requested_response: response })
    setSubmitting(false)
    if (error) return toast.error(error.message)
    toast.success('این کار انجام شد و مرحله بعدی آماده است.')
    await onCompleted()
  }
  return <div className="border-t border-amber-900/40 bg-amber-950/10 p-5 sm:p-6"><p className="text-xs font-bold text-amber-400">الان چه کاری انجام دهم؟</p><h4 className="mt-1 font-black">{step.title}</h4>{step.instructions && <p className="mt-2 text-sm leading-7 text-zinc-400">{step.instructions}</p>}{fields.length > 0 && <div className="mt-4 grid gap-4 md:grid-cols-2">{fields.map((field) => <DynamicField key={field.key} field={field} value={values[field.key]} onChange={(value) => setValues((current) => ({ ...current, [field.key]: value }))} />)}</div>}<Button onClick={submit} disabled={submitting} size="lg" className="mt-5 w-full sm:w-auto">{submitting && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}ثبت انجام کار و ادامه</Button></div>
}

function DynamicField({ field, value, onChange }: { field: FormField; value: string | number | boolean | undefined; onChange: (value: string | boolean) => void }) {
  if (field.type === 'checkbox') return <div className="flex items-center justify-between rounded-lg border border-zinc-800 p-3"><Label>{field.label}{field.required ? ' *' : ''}</Label><Switch checked={Boolean(value)} onCheckedChange={onChange} /></div>
  if (field.type === 'select') return <div className="space-y-2"><Label>{field.label}{field.required ? ' *' : ''}</Label><Select value={typeof value === 'string' ? value : ''} onValueChange={onChange}><SelectTrigger><SelectValue placeholder="انتخاب کنید" /></SelectTrigger><SelectContent>{field.options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select></div>
  return <div className="space-y-2"><Label>{field.label}{field.required ? ' *' : ''}</Label><Input type={field.type} value={typeof value === 'string' || typeof value === 'number' ? value : ''} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} /></div>
}

function parseFields(schema: Json): FormField[] {
  if (!schema || Array.isArray(schema) || typeof schema !== 'object' || !Array.isArray(schema['fields'])) return []
  return schema['fields'].flatMap((item) => {
    if (!item || Array.isArray(item) || typeof item !== 'object') return []
    const type = item['type']; const key = item['key']; const label = item['label']
    if (typeof key !== 'string' || typeof label !== 'string' || !['text', 'number', 'date', 'checkbox', 'select'].includes(String(type))) return []
    return [{ key, label, type: type as FormField['type'], required: item['required'] === true, options: Array.isArray(item['options']) ? item['options'].filter((option): option is string => typeof option === 'string') : [], placeholder: typeof item['placeholder'] === 'string' ? item['placeholder'] : undefined }]
  })
}

function firstByCase<T extends { case_id: string }>(rows: T[]) { const result = new Map<string, T>(); rows.forEach((row) => { if (!result.has(row.case_id)) result.set(row.case_id, row) }); return result }
function compareUrgency(a: CaseView, b: CaseView) { if (a.task && !b.task) return -1; if (!a.task && b.task) return 1; return (a.deadline ? new Date(a.deadline.due_at).getTime() : Infinity) - (b.deadline ? new Date(b.deadline.due_at).getTime() : Infinity) }

function DeadlineBadge({ deadline, task }: { deadline: Deadline | null; task: CaseTask | null }) {
  const dueAt = deadline?.due_at ?? task?.due_at
  if (!dueAt) return <span className="w-fit rounded-full bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400">مهلت ثبت نشده</span>
  const due = new Date(dueAt); const days = Math.ceil((due.getTime() - Date.now()) / 86_400_000); const overdue = days < 0
  const text = overdue ? `${Math.abs(days).toLocaleString('fa-IR')} روز از مهلت گذشته` : days === 0 ? 'مهلت امروز' : `${days.toLocaleString('fa-IR')} روز تا مهلت`
  return <div className={`w-fit rounded-xl px-3 py-2 text-xs font-bold ${overdue ? 'bg-red-500/10 text-red-300' : days <= 7 ? 'bg-amber-400/10 text-amber-300' : 'bg-zinc-800 text-zinc-300'}`}><span>{text}</span><span className="mt-1 block font-normal opacity-75">{formatDate(dueAt)}</span></div>
}
function InfoBox({ icon, label, value, highlight = false }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) { return <div className={`rounded-xl border p-3.5 ${highlight ? 'border-amber-900/50 bg-amber-950/10' : 'border-zinc-800 bg-zinc-900/40'}`}><div className={`flex items-center gap-2 text-xs ${highlight ? 'text-amber-400' : 'text-zinc-500'}`}><span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>{label}</div><p className="mt-2 text-sm font-semibold leading-6">{value}</p></div> }
function SummaryCard({ label, value, icon, danger = false }: { label: string; value: string | number; icon: React.ReactNode; danger?: boolean }) { return <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4"><div className={danger ? 'text-red-400' : 'text-amber-400'}>{icon}</div><p className="mt-3 text-2xl font-black">{typeof value === 'number' ? value.toLocaleString('fa-IR') : value}</p><p className="mt-1 text-xs text-zinc-500">{label}</p></div> }
function StatusPill({ status }: { status: string }) { const completed = status === 'COMPLETED'; const blocked = status === 'BLOCKED'; return <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${completed ? 'bg-emerald-500/10 text-emerald-300' : blocked ? 'bg-red-500/10 text-red-300' : 'bg-blue-500/10 text-blue-300'}`}>{statusLabel(status)}</span> }
function EmptyState({ hasCases }: { hasCases: boolean }) { return <div className="rounded-2xl border border-dashed border-zinc-700 bg-[#141615] p-8 text-center"><CheckCircle2 className="mx-auto h-9 w-9 text-emerald-400" /><p className="mt-3 font-bold">{hasCases ? 'فعلاً کاری برای انجام ندارید.' : 'هنوز پرونده‌ای ساخته نشده است.'}</p><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">{hasCases ? 'پرونده‌های شما در انتظار مرحله بعد هستند.' : 'اطلاعات کسب‌وکار را تکمیل کنید و از بخش «به‌روزرسانی تعهدات» بررسی را آغاز کنید.'}</p></div> }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'تاریخ نامعتبر' : date.toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }) }
function statusLabel(status: string) { return ({ OPEN: 'باز', IN_PROGRESS: 'در حال انجام', BLOCKED: 'متوقف', COMPLETED: 'تکمیل‌شده', CANCELLED: 'لغوشده' } as Record<string, string>)[status] ?? status }
