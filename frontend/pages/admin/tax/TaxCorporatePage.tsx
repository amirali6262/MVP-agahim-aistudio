import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpenCheck, ExternalLink, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../../../lib/supabase'
import { mockStudioDb } from '../../../lib/mockDb'
import type { Json, Tables } from '../../../lib/database.types'
import { Button } from '../../../lib/shadcn/button'

type Obligation = Tables<'obligations'>
type Version = Tables<'obligation_versions'>
type Family = Tables<'obligation_families'>

interface PublishedItem {
  obligation: Obligation
  version: Version
  family: Family | null
}

const TYPE_LABELS: Record<string, string> = {
  ALL: 'همه تعهدات', TAX_CORPORATE: 'مالیات بر عملکرد اشخاص حقوقی', TAX_INDIVIDUAL: 'مالیات بر عملکرد اشخاص حقیقی',
  VAT: 'مالیات بر ارزش افزوده', PAYROLL_TAX: 'مالیات بر حقوق', TAX_DUTIES: 'مالیات‌های تکلیفی',
  CLAIM_169: 'مطالبه ماده ۱۶۹', INS_CONTRACT: 'حق بیمه قراردادها', INS_AUDIT: 'حسابرسی بیمه',
}

export default function TaxCorporatePage({ type = 'TAX_CORPORATE' }: { type?: string }) {
  const [items, setItems] = useState<PublishedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      if (!isSupabaseConfigured) {
        const families = mockStudioDb.getFamilies() as Family[]
        const obligations = mockStudioDb.getObligations() as Obligation[]
        const versions = mockStudioDb.getVersions() as Version[]
        setItems(buildPublishedItems(obligations, versions, families))
        return
      }
      const [obligationsResult, versionsResult, familiesResult] = await Promise.all([
        supabase.from('obligations').select('*').eq('is_active', true),
        supabase.from('obligation_versions').select('*').eq('status', 'PUBLISHED').order('version_number', { ascending: false }),
        supabase.from('obligation_families').select('*'),
      ])
      const error = obligationsResult.error ?? versionsResult.error ?? familiesResult.error
      if (error) throw error
      setItems(buildPublishedItems(obligationsResult.data ?? [], versionsResult.data ?? [], familiesResult.data ?? []))
    } catch (error) {
      setItems([])
      setLoadError(typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string' ? error.message : 'دریافت تعهدات منتشرشده انجام نشد.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])
  const visibleItems = useMemo(() => type === 'ALL' ? items : items.filter((item) => obligationTypes(item.version.recurrence_rule).includes(type)), [items, type])

  return (
    <main className="p-6 text-zinc-100" dir="rtl">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div><h2 className="text-xl font-black">{TYPE_LABELS[type] ?? type}</h2><p className="mt-1 text-sm text-zinc-500">نمای تعهدات فعال و منتشرشده این سرفصل؛ تعریف و ویرایش فقط در استودیوی تعهدات انجام می‌شود.</p></div>
        <div className="flex gap-2"><Button variant="outline" onClick={() => void load()}><RefreshCw className="ml-2 h-4 w-4" />به‌روزرسانی</Button><Button asChild className="bg-amber-500 text-zinc-950 hover:bg-amber-400"><Link to="/admin/studio"><BookOpenCheck className="ml-2 h-4 w-4" />مدیریت در استودیو</Link></Button></div>
      </div>
      {loading ? <div className="flex justify-center p-24"><Loader2 className="h-7 w-7 animate-spin text-amber-400" /></div> : loadError ? (
        <div className="rounded-2xl border border-red-900/60 bg-red-950/20 p-8 text-center"><h3 className="font-bold text-red-300">دریافت اطلاعات ناموفق بود</h3><p className="mt-2 text-sm text-red-200/70">{loadError}</p><Button variant="outline" className="mt-5 border-red-900" onClick={() => void load()}>تلاش دوباره</Button></div>
      ) : visibleItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-700 bg-[#141615] p-14 text-center"><ShieldCheck className="mx-auto h-10 w-10 text-zinc-600" /><h3 className="mt-4 font-bold">تعهد منتشرشده‌ای در این سرفصل وجود ندارد</h3><p className="mt-2 text-sm text-zinc-500">تعهد را در استودیو تعریف، بازبینی، آزمایش و منتشر کنید.</p><Button asChild className="mt-5"><Link to="/admin/studio">رفتن به استودیوی تعهدات</Link></Button></div>
      ) : <div className="grid gap-4 lg:grid-cols-2">{visibleItems.map(({ obligation, version, family }) => <article key={version.id} className="rounded-2xl border border-zinc-800 bg-[#141615] p-5 shadow-lg"><div className="flex items-start justify-between gap-3"><div><span className="rounded-full bg-emerald-950 px-2.5 py-1 text-[11px] font-bold text-emerald-300">نسخه {version.version_number} · منتشرشده</span><h3 className="mt-3 font-black">{obligation.title}</h3><p className="mt-1 text-xs text-zinc-500">{family?.title ?? 'بدون گروه'} · {obligation.code}</p></div>{obligation.official_action_url && <Button asChild size="icon" variant="outline"><a href={obligation.official_action_url} target="_blank" rel="noreferrer" aria-label="ورود به سامانه رسمی"><ExternalLink className="h-4 w-4" /></a></Button>}</div><dl className="mt-5 grid gap-3 text-xs sm:grid-cols-2"><OverviewValue label="تناوب" value={stringMeta(version.recurrence_rule, 'recurrence')} /><OverviewValue label="رویداد پایه" value={stringMeta(version.deadline_rule, 'base_event')} /><OverviewValue label="مهلت" value={deadlineLabel(version.deadline_rule)} /><OverviewValue label="مرجع قانونی" value={version.legal_reference ?? 'ثبت نشده'} /></dl>{version.audience_summary && <p className="mt-4 border-t border-zinc-800 pt-4 text-xs leading-6 text-zinc-400">{version.audience_summary}</p>}</article>)}</div>}
    </main>
  )
}

function buildPublishedItems(obligations: Obligation[], versions: Version[], families: Family[]): PublishedItem[] {
  return obligations.flatMap((obligation) => { const version = versions.find((row) => row.obligation_id === obligation.id && row.status === 'PUBLISHED'); return version ? [{ obligation, version, family: families.find((row) => row.id === obligation.family_id) ?? null }] : [] })
}
function meta(value: Json) { return value && !Array.isArray(value) && typeof value === 'object' ? value as Record<string, Json | undefined> : {} }
function obligationTypes(value: Json) { const record = meta(value); const values = record['obligation_types']; if (Array.isArray(values)) return values.filter((item): item is string => typeof item === 'string'); return typeof record['obligation_type'] === 'string' ? [record['obligation_type']] : [] }
function stringMeta(value: Json, key: string) { const result = meta(value)[key]; return typeof result === 'string' && result ? result : 'ثبت نشده' }
function deadlineLabel(value: Json) { const record = meta(value); const amount = record['time_gap_value']; const unit = record['time_gap_unit']; return amount != null && typeof unit === 'string' ? `${amount} ${unit} پس از رویداد پایه` : 'ثبت نشده' }
function OverviewValue({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-zinc-950/50 p-3"><dt className="text-zinc-500">{label}</dt><dd className="mt-1 font-semibold leading-5 text-zinc-200">{value}</dd></div> }
