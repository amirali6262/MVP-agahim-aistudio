import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Loader2,
  PlayCircle,
  RefreshCw,
  Scale,
} from 'lucide-react'
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
type Summary = Database['public']['Functions']['get_tenant_compliance_summary']['Returns'][number]

interface Props {
  tenantId: string
  tenantName: string
}

interface FormField {
  key: string
  label: string
  type: 'text' | 'number' | 'date' | 'checkbox' | 'select'
  required: boolean
  options: string[]
  placeholder?: string
}

interface CaseView {
  item: ComplianceCase
  title: string
  officialUrl: string | null
  task: CaseTask | null
  step: WorkflowStep | null
  deadline: Deadline | null
  penalty: PenaltyEstimate | null
}

const emptySummary: Summary = {
  total_cases: 0,
  open_cases: 0,
  overdue_cases: 0,
  completed_cases: 0,
  unread_notifications: 0,
  total_estimated_penalties: 0,
}

export default function CompanyComplianceOverview({ tenantId, tenantName }: Props) {
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [summary, setSummary] = useState<Summary>(emptySummary)
  const [cases, setCases] = useState<CaseView[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [periodKey, setPeriodKey] = useState('')

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    setLoading(true)
    const [summaryResult, casesResult, notificationsResult] = await Promise.all([
      supabase.rpc('get_tenant_compliance_summary', { requested_tenant_id: tenantId }),
      supabase.from('compliance_cases').select('*').eq('tenant_id', tenantId).order('opened_at', { ascending: false }),
      supabase.from('notifications').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(20),
    ])

    if (summaryResult.error || casesResult.error || notificationsResult.error) {
      toast.error(summaryResult.error?.message ?? casesResult.error?.message ?? notificationsResult.error?.message ?? 'دریافت اطلاعات ناموفق بود.')
      setLoading(false)
      return
    }

    const caseRows = casesResult.data ?? []
    const caseIds = caseRows.map((row) => row.id)
    const versionIds = [...new Set(caseRows.map((row) => row.obligation_version_id))]

    const [tasksResult, deadlinesResult, penaltiesResult, versionsResult] = await Promise.all([
      caseIds.length
        ? supabase.from('case_tasks').select('*').in('case_id', caseIds).eq('status', 'ACTIVE')
        : Promise.resolve({ data: [] as CaseTask[], error: null }),
      caseIds.length
        ? supabase.from('case_deadlines').select('*').in('case_id', caseIds).order('due_at', { ascending: false })
        : Promise.resolve({ data: [] as Deadline[], error: null }),
      caseIds.length
        ? supabase.from('penalty_estimates').select('*').in('case_id', caseIds).order('calculated_as_of', { ascending: false })
        : Promise.resolve({ data: [] as PenaltyEstimate[], error: null }),
      versionIds.length
        ? supabase.from('obligation_versions').select('id, obligation_id').in('id', versionIds)
        : Promise.resolve({ data: [] as Array<{ id: string; obligation_id: string }>, error: null }),
    ])

    const secondaryError = tasksResult.error ?? deadlinesResult.error ?? penaltiesResult.error ?? versionsResult.error
    if (secondaryError) {
      toast.error(secondaryError.message)
      setLoading(false)
      return
    }

    const tasks = tasksResult.data ?? []
    const stepIds = [...new Set(tasks.map((task) => task.workflow_step_id))]
    const obligationIds = [...new Set((versionsResult.data ?? []).map((version) => version.obligation_id))]
    const [stepsResult, obligationsResult] = await Promise.all([
      stepIds.length
        ? supabase.from('workflow_steps').select('*').in('id', stepIds)
        : Promise.resolve({ data: [] as WorkflowStep[], error: null }),
      obligationIds.length
        ? supabase.from('obligations').select('id, title, official_action_url').in('id', obligationIds)
        : Promise.resolve({ data: [] as Array<{ id: string; title: string; official_action_url: string | null }>, error: null }),
    ])

    if (stepsResult.error || obligationsResult.error) {
      toast.error(stepsResult.error?.message ?? obligationsResult.error?.message ?? 'دریافت جزئیات پرونده ناموفق بود.')
      setLoading(false)
      return
    }

    const stepById = new Map((stepsResult.data ?? []).map((step) => [step.id, step]))
    const taskByCase = new Map(tasks.map((task) => [task.case_id, task]))
    const versionById = new Map((versionsResult.data ?? []).map((version) => [version.id, version]))
    const obligationById = new Map((obligationsResult.data ?? []).map((obligation) => [obligation.id, obligation]))
    const firstByCase = <T extends { case_id: string }>(rows: T[]) => {
      const result = new Map<string, T>()
      rows.forEach((row) => { if (!result.has(row.case_id)) result.set(row.case_id, row) })
      return result
    }
    const deadlineByCase = firstByCase(deadlinesResult.data ?? [])
    const penaltyByCase = firstByCase(penaltiesResult.data ?? [])

    setSummary(summaryResult.data?.[0] ?? emptySummary)
    setNotifications(notificationsResult.data ?? [])
    setCases(caseRows.map((item) => {
      const task = taskByCase.get(item.id) ?? null
      const version = versionById.get(item.obligation_version_id)
      const obligation = version ? obligationById.get(version.obligation_id) : undefined
      return {
        item,
        title: obligation?.title ?? 'تعهد قانونی',
        officialUrl: obligation?.official_action_url ?? null,
        task,
        step: task ? stepById.get(task.workflow_step_id) ?? null : null,
        deadline: deadlineByCase.get(item.id) ?? null,
        penalty: penaltyByCase.get(item.id) ?? null,
      }
    }))
    setLoading(false)
  }, [tenantId])

  useEffect(() => { void load() }, [load])

  const runEligibility = async () => {
    setRunning(true)
    const { data, error } = await supabase.rpc('evaluate_tenant_eligibility', { requested_tenant_id: tenantId })
    setRunning(false)
    if (error) {
      toast.error(error.message)
      return
    }
    const eligible = data?.filter((item) => item.outcome === 'ELIGIBLE').length ?? 0
    const review = data?.filter((item) => item.outcome === 'REVIEW').length ?? 0
    toast.success(`تشخیص انجام شد: ${eligible} تعهد مشمول و ${review} مورد نیازمند بررسی.`)
  }

  const openCases = async () => {
    if (!periodKey.trim()) {
      toast.error('دوره را وارد کنید؛ مثلاً ۱۴۰۵ یا ۱۴۰۵-بهار.')
      return
    }
    setRunning(true)
    const { data, error } = await supabase.rpc('open_eligible_cases', {
      requested_tenant_id: tenantId,
      requested_period_key: periodKey.trim(),
    })
    setRunning(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(`${data?.length ?? 0} پروندهٔ قابل اجرا برای این دوره آماده شد.`)
    await load()
  }

  const markRead = async (notificationId: string) => {
    const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', notificationId)
    if (error) toast.error(error.message)
    else await load()
  }

  if (loading) {
    return <div className="flex justify-center py-24 text-zinc-400"><Loader2 className="h-7 w-7 animate-spin" /></div>
  }

  return (
    <section className="space-y-6 text-zinc-100" dir="rtl">
      <div className="rounded-2xl border border-zinc-800 bg-[#141615] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl font-bold">وضعیت امروز {tenantName}</h1>
            <p className="mt-1 text-sm text-zinc-400">کار بعدی، مهلت‌ها و هشدارهای مهم در یک صفحه</p>
          </div>
          <Button variant="outline" onClick={() => void load()} className="gap-2 border-zinc-700">
            <RefreshCw className="h-4 w-4" />به‌روزرسانی
          </Button>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-5">
          <SummaryCard label="پرونده باز" value={summary.open_cases} icon={<PlayCircle />} />
          <SummaryCard label="مهلت گذشته" value={summary.overdue_cases} icon={<AlertTriangle />} danger />
          <SummaryCard label="تکمیل‌شده" value={summary.completed_cases} icon={<CheckCircle2 />} />
          <SummaryCard label="اعلان خوانده‌نشده" value={summary.unread_notifications} icon={<Bell />} />
          <SummaryCard label="برآورد جریمه (ریال)" value={Number(summary.total_estimated_penalties).toLocaleString('fa-IR')} icon={<Scale />} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr,1fr]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-bold"><ClipboardCheck className="h-5 w-5 text-amber-400" />کارهای جاری</h2>
            <span className="text-xs text-zinc-500">{cases.length} پرونده</span>
          </div>
          {cases.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-700 bg-[#141615] p-8 text-center">
              <p className="font-semibold">هنوز پرونده‌ای برای این شرکت ساخته نشده است.</p>
              <p className="mt-2 text-sm text-zinc-400">ابتدا پروفایل کسب‌وکار را کامل کنید، تشخیص را اجرا کنید و سپس دوره را بسازید.</p>
            </div>
          ) : cases.map((view) => (
            <article key={view.item.id} className="rounded-2xl border border-zinc-800 bg-[#141615] p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-bold">{view.title}</h3>
                  <p className="mt-1 text-xs text-zinc-500">دوره {view.item.period_key} · {statusLabel(view.item.status)}</p>
                </div>
                {view.officialUrl && (
                  <a href={view.officialUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300">
                    ورود به سامانه رسمی <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <Fact label="مرحله جاری" value={view.step?.title ?? (view.item.status === 'COMPLETED' ? 'پایان‌یافته' : 'بدون مرحله فعال')} />
                <Fact label="نزدیک‌ترین مهلت ثبت‌شده" value={view.deadline ? new Date(view.deadline.due_at).toLocaleDateString('fa-IR') : 'ثبت نشده'} />
                <Fact label="آخرین برآورد جریمه" value={view.penalty ? `${Number(view.penalty.estimated_amount).toLocaleString('fa-IR')} ریال` : 'محاسبه نشده'} />
                <Fact label="وضعیت" value={statusLabel(view.item.status)} />
              </div>
              {view.task && view.step && (
                <TaskForm task={view.task} step={view.step} onCompleted={load} />
              )}
            </article>
          ))}
        </div>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-zinc-800 bg-[#141615] p-5">
            <h2 className="font-bold">شروع هوشمند</h2>
            <p className="mt-1 text-xs leading-6 text-zinc-400">سیستم فقط قواعد منتشرشده توسط مدیر پلتفرم را بررسی می‌کند.</p>
            <Button onClick={runEligibility} disabled={running} className="mt-4 w-full bg-amber-500 text-zinc-950 hover:bg-amber-400">
              {running && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}تشخیص تعهدات
            </Button>
            <div className="mt-4 space-y-2">
              <Label htmlFor="period-key">دوره کاری</Label>
              <Input id="period-key" value={periodKey} onChange={(event) => setPeriodKey(event.target.value)} placeholder="مثلاً ۱۴۰۵-بهار" />
              <Button onClick={openCases} disabled={running} variant="outline" className="w-full border-zinc-700">ساخت پرونده‌های این دوره</Button>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-[#141615] p-5">
            <h2 className="flex items-center gap-2 font-bold"><Bell className="h-4 w-4 text-amber-400" />اعلان‌های اخیر</h2>
            <div className="mt-4 space-y-3">
              {notifications.length === 0 ? <p className="text-sm text-zinc-500">اعلان جدیدی ندارید.</p> : notifications.map((item) => (
                <button key={item.id} onClick={() => !item.read_at && void markRead(item.id)} className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-right">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold">{item.title}</span>
                    {!item.read_at && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-400" />}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-zinc-400">{item.body}</p>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  )
}

function TaskForm({ task, step, onCompleted }: { task: CaseTask; step: WorkflowStep; onCompleted: () => Promise<void> }) {
  const fields = useMemo(() => parseFields(step.form_schema), [step.form_schema])
  const [values, setValues] = useState<Record<string, string | number | boolean>>({})
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    const response: Record<string, Json> = {}
    fields.forEach((field) => {
      const value = values[field.key]
      if (field.type === 'number' && typeof value === 'string' && value !== '') response[field.key] = Number(value)
      else if (value !== undefined && value !== '') response[field.key] = value
    })
    setSubmitting(true)
    const { error } = await supabase.rpc('complete_case_task', { requested_task_id: task.id, requested_response: response })
    setSubmitting(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('این مرحله تکمیل شد و مرحله بعدی آماده است.')
    await onCompleted()
  }

  return (
    <div className="mt-5 rounded-xl border border-amber-900/50 bg-amber-950/10 p-4">
      <h4 className="text-sm font-bold text-amber-300">اقدام بعدی: {step.title}</h4>
      {step.instructions && <p className="mt-2 text-xs leading-6 text-zinc-400">{step.instructions}</p>}
      {fields.length > 0 && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {fields.map((field) => (
            <DynamicField key={field.key} field={field} value={values[field.key]} onChange={(value) => setValues((current) => ({ ...current, [field.key]: value }))} />
          ))}
        </div>
      )}
      <Button onClick={submit} disabled={submitting} className="mt-4 bg-amber-500 text-zinc-950 hover:bg-amber-400">
        {submitting && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}ثبت و رفتن به مرحله بعد
      </Button>
    </div>
  )
}

function DynamicField({ field, value, onChange }: { field: FormField; value: string | number | boolean | undefined; onChange: (value: string | boolean) => void }) {
  if (field.type === 'checkbox') {
    return <div className="flex items-center justify-between rounded-lg border border-zinc-800 p-3"><Label>{field.label}</Label><Switch checked={Boolean(value)} onCheckedChange={onChange} /></div>
  }
  if (field.type === 'select') {
    return <div className="space-y-2"><Label>{field.label}{field.required ? ' *' : ''}</Label><Select value={typeof value === 'string' ? value : ''} onValueChange={onChange}><SelectTrigger><SelectValue placeholder="انتخاب کنید" /></SelectTrigger><SelectContent>{field.options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select></div>
  }
  return <div className="space-y-2"><Label>{field.label}{field.required ? ' *' : ''}</Label><Input type={field.type} value={typeof value === 'string' || typeof value === 'number' ? value : ''} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} /></div>
}

function parseFields(schema: Json): FormField[] {
  if (!schema || Array.isArray(schema) || typeof schema !== 'object') return []
  const rawFields = schema['fields']
  if (!Array.isArray(rawFields)) return []
  return rawFields.flatMap((item) => {
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

function SummaryCard({ label, value, icon, danger = false }: { label: string; value: string | number; icon: React.ReactNode; danger?: boolean }) {
  return <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"><div className={danger ? 'text-red-400' : 'text-amber-400'}>{icon}</div><p className="mt-3 text-xl font-black">{value}</p><p className="mt-1 text-xs text-zinc-500">{label}</p></div>
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-zinc-900/60 p-3"><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 font-semibold">{value}</p></div>
}

function statusLabel(status: string) {
  return ({ OPEN: 'باز', IN_PROGRESS: 'در حال انجام', BLOCKED: 'متوقف', COMPLETED: 'تکمیل‌شده', CANCELLED: 'لغوشده' } as Record<string, string>)[status] ?? status
}
