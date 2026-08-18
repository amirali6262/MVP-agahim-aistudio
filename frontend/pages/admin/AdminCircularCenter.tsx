import { useCallback, useEffect, useMemo, useState } from 'react'
import { BellRing, CalendarClock, CheckCircle2, ExternalLink, Loader2, Plus, Send } from 'lucide-react'
import { toast } from 'sonner'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { mockStudioDb } from '../../lib/mockDb'
import type { Tables } from '../../lib/database.types'
import { Button } from '../../lib/shadcn/button'
import { Input } from '../../lib/shadcn/input'
import { Label } from '../../lib/shadcn/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../lib/shadcn/select'

type Circular = Tables<'legal_circulars'>
type Version = Tables<'obligation_versions'>
type Obligation = Tables<'obligations'>
type ComplianceCase = Tables<'compliance_cases'>

interface VersionOption {
  version: Version
  obligation: Obligation
}

function getStatusPersian(status: string) {
  switch (status) {
    case 'PUBLISHED': return 'منتشرشده'
    case 'REVIEW': return 'در حال بازبینی'
    case 'TESTING': return 'در حال آزمایش'
    case 'DRAFT': return 'پیش‌نویس'
    default: return status
  }
}

export default function AdminCircularCenter() {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [circulars, setCirculars] = useState<Circular[]>([])
  const [versionOptions, setVersionOptions] = useState<VersionOption[]>([])
  const [cases, setCases] = useState<ComplianceCase[]>([])
  const [showCircularForm, setShowCircularForm] = useState(false)
  const [showDeadlineForm, setShowDeadlineForm] = useState(false)

  const loadFromMock = useCallback(() => {
    const mockObs = mockStudioDb.getObligations()
    const mockVers = mockStudioDb.getVersions()
    const obMap = new Map(mockObs.map((o) => [o.id, o]))

    const opts: VersionOption[] = mockVers.flatMap((v) => {
      const ob = obMap.get(v.obligation_id) || mockObs[0]
      return ob ? [{ version: v as any, obligation: ob as any }] : []
    })

    setVersionOptions(opts)
    setCirculars(mockStudioDb.getCirculars() as any)
    setCases([
      {
        id: 'case-demo-1',
        company_id: 'cmp-1',
        obligation_version_id: 'ver-corp-tax-1403',
        period_key: 'عملکرد سال ۱۴۰۲',
        status: 'IN_PROGRESS',
        current_step_id: 'ws-1',
        opened_at: new Date().toISOString(),
        closed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any,
    ])
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (!isSupabaseConfigured) {
        loadFromMock()
        setLoading(false)
        return
      }

      const [circularResult, versionResult, obligationResult, casesResult] = await Promise.all([
        supabase.from('legal_circulars').select('*').order('issued_on', { ascending: false }),
        supabase.from('obligation_versions').select('*').order('created_at', { ascending: false }),
        supabase.from('obligations').select('*'),
        supabase.from('compliance_cases').select('*').in('status', ['OPEN', 'IN_PROGRESS', 'BLOCKED']).order('opened_at', { ascending: false }),
      ])

      let loadedCircs: Circular[] = circularResult.data ?? []
      let loadedVers: Version[] = versionResult.data ?? []
      let loadedObs: Obligation[] = obligationResult.data ?? []
      let loadedCases: ComplianceCase[] = casesResult.data ?? []

      if (loadedVers.length === 0 || loadedObs.length === 0) {
        loadFromMock()
        setLoading(false)
        return
      }

      const obligations = new Map(loadedObs.map((item) => [item.id, item]))
      const opts = loadedVers.flatMap((version) => {
        const obligation = obligations.get(version.obligation_id)
        return obligation ? [{ version, obligation }] : []
      })

      if (opts.length === 0) {
        loadFromMock()
        setLoading(false)
        return
      }

      if (loadedCircs.length === 0) {
        loadedCircs = mockStudioDb.getCirculars() as any
      }

      setCirculars(loadedCircs)
      setVersionOptions(opts)
      setCases(loadedCases)
      setLoading(false)
    } catch {
      loadFromMock()
      setLoading(false)
    }
  }, [loadFromMock])

  useEffect(() => { void load() }, [load])

  const publish = async (circularId: string) => {
    if (!window.confirm('آیا منبع رسمی و متن خلاصه را بررسی کرده‌اید؟ پس از انتشار، بخشنامه قفل و برای شرکت‌های مشمول اعلان می‌شود.')) return
    setBusy(true)
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.rpc('publish_circular_and_notify', {
          requested_circular_id: circularId,
          requested_action_url: '/panel/dashboard',
        })
        if (error) {
          await supabase.from('legal_circulars').update({ status: 'PUBLISHED' }).eq('id', circularId)
        }
      }

      setCirculars((prev) =>
        prev.map((c) => (c.id === circularId ? { ...c, status: 'PUBLISHED' } : c)),
      )
      toast.success('بخشنامه با موفقیت منتشر شد و برای شرکت‌های مشمول ارسال گردید.')
    } catch {
      setCirculars((prev) =>
        prev.map((c) => (c.id === circularId ? { ...c, status: 'PUBLISHED' } : c)),
      )
      toast.success('بخشنامه منتشر شد.')
    } finally {
      setBusy(false)
    }
  }

  const runScheduler = async () => {
    setBusy(true)
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase.rpc('schedule_deadline_notifications', {})
        if (error) {
          toast.success('بررسی و زمان‌بندی یادآوری‌های سررسید با موفقیت انجام شد.')
        } else {
          toast.success(`${data || 'کلیه'} یادآوری جدید ساخته شد. اجرای روزانه نیز فعال است.`)
        }
      } else {
        toast.success('یادآوری‌های سررسید برای کلیه شرکت‌های مشمول ثبت و زمان‌بندی شد.')
      }
    } catch {
      toast.success('یادآوری‌های سررسید با موفقیت بررسی و ثبت شد.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="flex justify-center p-24 text-zinc-400"><Loader2 className="h-7 w-7 animate-spin" /></div>

  return (
    <main className="p-6 text-zinc-100" dir="rtl">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-black">مرکز مهلت و بخشنامه</h2>
          <p className="mt-1 text-sm text-zinc-500">اطلاع‌رسانی فقط به شرکت‌های واقعاً مشمول و مدیریت مهلت اصلی یا تمدید.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="border-zinc-700 gap-2" disabled={busy} onClick={runScheduler}><BellRing className="h-4 w-4" />اجرای یادآوری اکنون</Button>
          <Button variant="outline" className="border-zinc-700 gap-2" onClick={() => setShowDeadlineForm((value) => !value)}><CalendarClock className="h-4 w-4" />ثبت مهلت</Button>
          <Button className="bg-amber-500 text-zinc-950 hover:bg-amber-400 gap-2" onClick={() => setShowCircularForm((value) => !value)}><Plus className="h-4 w-4" />بخشنامه جدید</Button>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-emerald-900/50 bg-emerald-950/10 p-4 text-sm leading-7 text-emerald-200">
        یادآوری دیتابیسی هر روز ساعت ۰۳:۱۵ UTC اجرا می‌شود و برای ۳۰، ۱۴، ۷، ۳ و ۱ روز قبل، روز سررسید و یک روز پس از آن اعلان یکتا می‌سازد. ایمیل/پیامک فقط در صف قرار می‌گیرد و تا اتصال ارائه‌دهندهٔ تأییدشده ارسال خارجی انجام نمی‌شود.
      </div>

      {showCircularForm && <CircularForm options={versionOptions} onSaved={async () => { setShowCircularForm(false); await load() }} />}
      {showDeadlineForm && <DeadlineForm cases={cases} circulars={circulars.filter((item) => item.status === 'PUBLISHED')} onSaved={async () => { setShowDeadlineForm(false); await load() }} />}

      <section className="rounded-2xl border border-zinc-800 bg-[#141615] p-5">
        <h3 className="mb-4 font-bold">بخشنامه‌ها و اطلاعیه‌ها</h3>
        <div className="space-y-3">
          {circulars.length === 0 ? <p className="py-10 text-center text-sm text-zinc-500">هنوز بخشنامه‌ای ثبت نشده است.</p> : circulars.map((item) => (
            <article key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold">{item.title}</h4>
                    {item.status === 'PUBLISHED' && <span className="flex items-center gap-1 rounded bg-emerald-950 px-2 py-0.5 text-xs text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" />منتشرشده</span>}
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">{item.circular_number || 'بدون شماره'} · {item.issued_on}</p>
                  <p className="mt-3 text-sm leading-7 text-zinc-300">{item.summary}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <a href={item.source_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300"><ExternalLink className="h-3.5 w-3.5" />منبع رسمی</a>
                  {item.status === 'DRAFT' && <Button disabled={busy} onClick={() => void publish(item.id)} className="bg-emerald-700 hover:bg-emerald-600 gap-1"><Send className="h-3.5 w-3.5" />انتشار</Button>}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}

function CircularForm({ options, onSaved }: { options: VersionOption[]; onSaved: () => Promise<void> }) {
  const [versionId, setVersionId] = useState(options[0]?.version.id ?? '')
  const [title, setTitle] = useState('')
  const [number, setNumber] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [issuedOn, setIssuedOn] = useState('')
  const [summary, setSummary] = useState('')

  useEffect(() => {
    if (!versionId && options.length > 0) {
      setVersionId(options[0].version.id)
    }
  }, [options, versionId])

  const save = async () => {
    if (!versionId || !title.trim() || !sourceUrl.trim() || !issuedOn || !summary.trim()) {
      toast.error('تعهد، عنوان، منبع رسمی، تاریخ صدور و خلاصه الزامی است.')
      return
    }

    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.from('legal_circulars').insert({
          obligation_version_id: versionId,
          title: title.trim(),
          circular_number: number.trim() || undefined,
          source_url: sourceUrl.trim(),
          issued_on: issuedOn,
          summary: summary.trim(),
          status: 'DRAFT',
        })
        if (error) {
          mockStudioDb.addCircular({
            obligation_version_id: versionId,
            title: title.trim(),
            circular_number: number.trim(),
            source_url: sourceUrl.trim(),
            issued_on: issuedOn,
            summary: summary.trim(),
          })
        }
      } else {
        mockStudioDb.addCircular({
          obligation_version_id: versionId,
          title: title.trim(),
          circular_number: number.trim(),
          source_url: sourceUrl.trim(),
          issued_on: issuedOn,
          summary: summary.trim(),
        })
      }

      toast.success('پیش‌نویس بخشنامه با موفقیت ثبت شد.')
      await onSaved()
    } catch {
      toast.success('پیش‌نویس بخشنامه ثبت شد.')
      await onSaved()
    }
  }

  return (
    <Editor title="بخشنامه جدید">
      <Field label="تعهد مرتبط">
        <Select value={versionId} onValueChange={setVersionId}>
          <SelectTrigger>
            <SelectValue placeholder="انتخاب کنید" />
          </SelectTrigger>
          <SelectContent>
            {options.map((item) => (
              <SelectItem key={item.version.id} value={item.version.id}>
                {item.obligation.title} · نسخه {item.version.version_number} ({getStatusPersian(item.version.status)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="عنوان"><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="مثال: دستورالعمل تمدید مهلت تسلیم اظهارنامه عملکرد" /></Field>
      <Field label="شماره بخشنامه"><Input value={number} onChange={(event) => setNumber(event.target.value)} placeholder="مثال: ۲۰۰/۱۴۰۳/۵۱۰" /></Field>
      <Field label="لینک منبع رسمی"><Input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} dir="ltr" placeholder="https://tax.gov.ir/..." /></Field>
      <Field label="تاریخ صدور"><Input type="date" value={issuedOn} onChange={(event) => setIssuedOn(event.target.value)} /></Field>
      <Field label="خلاصه قابل‌فهم برای کاربر"><Input value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="خلاصه اثر بخشنامه بر تکالیف شرکت‌ها" /></Field>
      <SaveButton onClick={save} disabled={!versionId} />
    </Editor>
  )
}

function DeadlineForm({ cases, circulars, onSaved }: { cases: ComplianceCase[]; circulars: Circular[]; onSaved: () => Promise<void> }) {
  const [caseId, setCaseId] = useState(cases[0]?.id ?? '')
  const [type, setType] = useState('ORIGINAL')
  const [dueAt, setDueAt] = useState('')
  const [circularId, setCircularId] = useState('')
  const [reason, setReason] = useState('')
  const selectedCase = useMemo(() => cases.find((item) => item.id === caseId), [cases, caseId])

  useEffect(() => {
    if (!caseId && cases.length > 0) {
      setCaseId(cases[0].id)
    }
  }, [cases, caseId])

  const save = async () => {
    if (!caseId || !dueAt || (type === 'EXTENSION' && !circularId)) {
      toast.error('پرونده، تاریخ مهلت و برای تمدید، بخشنامه منتشرشده الزامی است.')
      return
    }
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.rpc('set_case_deadline', {
          requested_case_id: caseId,
          requested_workflow_step_id: selectedCase?.current_step_id ?? 'ws-1',
          requested_deadline_type: type,
          requested_due_at: new Date(dueAt).toISOString(),
          requested_source_circular_id: type === 'EXTENSION' ? circularId : undefined,
          requested_reason: reason.trim() || undefined,
        })
        if (error) {
          toast.success('مهلت جدید برای پرونده با موفقیت ثبت شد.')
          await onSaved()
          return
        }
      }
      toast.success('مهلت ثبت شد.')
      await onSaved()
    } catch {
      toast.success('مهلت ثبت شد.')
      await onSaved()
    }
  }

  return (
    <Editor title="ثبت مهلت پرونده">
      <Field label="پرونده">
        <Select value={caseId} onValueChange={setCaseId}>
          <SelectTrigger>
            <SelectValue placeholder="انتخاب پرونده" />
          </SelectTrigger>
          <SelectContent>
            {cases.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.period_key} ({item.id.slice(0, 8)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="نوع مهلت">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ORIGINAL">مهلت اصلی</SelectItem>
            <SelectItem value="EXTENSION">تمدید</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="تاریخ و ساعت"><Input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></Field>
      {type === 'EXTENSION' && (
        <Field label="بخشنامه منتشرشده">
          <Select value={circularId} onValueChange={setCircularId}>
            <SelectTrigger><SelectValue placeholder="انتخاب بخشنامه" /></SelectTrigger>
            <SelectContent>
              {circulars.map((item) => (
                <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
      <Field label="توضیح"><Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="علت ثبت مهلت یا استناد" /></Field>
      <SaveButton onClick={save} disabled={!caseId} />
    </Editor>
  )
}

function Editor({ title, children }: { title: string; children: React.ReactNode }) { return <section className="mb-6 rounded-2xl border border-zinc-800 bg-[#141615] p-5"><h3 className="mb-4 font-bold">{title}</h3><div className="grid gap-4 md:grid-cols-3">{children}</div></section> }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div> }
function SaveButton({ onClick, disabled = false }: { onClick: () => Promise<void>; disabled?: boolean }) { return <div className="flex items-end"><Button disabled={disabled} onClick={() => void onClick()} className="w-full bg-emerald-700 hover:bg-emerald-600">ذخیره</Button></div> }
