import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Ban, Copy, Eye, KeyRound, Layers, Loader2, Lock, Pencil, Search,
} from 'lucide-react'
import { Button } from '../../lib/shadcn/button'
import { Input } from '../../lib/shadcn/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../lib/shadcn/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../lib/shadcn/table'
import FullScreenDialog from '../../components/FullScreenDialog'
import {
  fetchRegistryKeys, updateRegistryKey,
  ENTITY_LABELS, STATUS_LABELS, REGISTRY_MODULES, REGISTRY_ENTITIES,
  type SystemKeyRecord, type KeyStatus, type KeyEntityType,
} from '../../lib/systemKeys'

const BRAND = '#5B4DE6'

function faDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'short', day: 'numeric' }).format(d)
}

export default function SystemKeyRegistryPage() {
  const [rows, setRows] = useState<SystemKeyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [module, setModule] = useState('ALL')
  const [entityType, setEntityType] = useState<'ALL' | KeyEntityType>('ALL')
  const [status, setStatus] = useState<'ALL' | KeyStatus>('ALL')
  const [details, setDetails] = useState<SystemKeyRecord | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setRows(await fetchRegistryKeys()) }
    catch (e) { setError(e instanceof Error ? e.message : 'دریافت کلیدها ناموفق بود.'); setRows([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return rows.filter((r) =>
      (module === 'ALL' || r.module === module) &&
      (entityType === 'ALL' || r.entity_type === entityType) &&
      (status === 'ALL' || r.status === status) &&
      (!ql || r.full_key.toLowerCase().includes(ql) || (r.title_fa || '').toLowerCase().includes(ql))
    )
  }, [rows, q, module, entityType, status])

  const copyKey = async (k: string) => {
    try { await navigator.clipboard.writeText(k); toast.success('کلید کپی شد.') }
    catch { toast.error('کپی ناموفق بود.') }
  }

  const deactivate = async (r: SystemKeyRecord) => {
    if (r.locked) { toast.error('کلید قفل شده را نمیتوان غیرفعال کرد.'); return }
    if (!window.confirm(`کلید «${r.full_key}» غیرفعال شود؟`)) return
    try {
      await updateRegistryKey(r.id, { status: 'INACTIVE' })
      toast.success('کلید غیرفعال شد.') ; void load()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'غیرفعالکردن ناموفق بود.') }
  }

  const lockedOf = (r: SystemKeyRecord) => r.locked || r.status === 'PUBLISHED'

  return (
    <div dir="rtl" className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white px-5 py-5 shadow-sm dark:border-zinc-800 dark:bg-[#161618] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white" style={{ background: BRAND }}><KeyRound className="h-5 w-5" /></span>
          <div>
            <h1 className="text-base font-extrabold text-zinc-900 dark:text-zinc-50">فهرست کلیدهای سیستم</h1>
            <p className="mt-1 max-w-2xl text-[11px] leading-6 text-zinc-500 dark:text-zinc-400">
              رجیستری مرکزی همهٔ کلیدهای یکتای انگلیسی ادمین پلتفرم؛ مشاهده، جست‌وجو و پایش کلیدها. این صفحه برای حذف مستقیم کلیدهای استفاده‌شده نیست.
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => void load()} className="shrink-0 gap-1.5 text-xs"><Layers className="h-3.5 w-3.5" />به‌روزرسانی</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-[#161618]">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <Input dir="rtl" value={q} onChange={(e) => setQ(e.target.value)} placeholder="جست‌وجو در کلید یا عنوان فارسی…" className="h-9 pr-8 text-xs" />
        </div>
        <Select value={module} onValueChange={setModule}><SelectTrigger className="h-9 w-40 text-xs"><SelectValue placeholder="ماژول" /></SelectTrigger><SelectContent>{['ALL', ...REGISTRY_MODULES].map((m) => <SelectItem key={m} value={m} className="text-xs">{m === 'ALL' ? 'همه ماژول‌ها' : m}</SelectItem>)}</SelectContent></Select>
        <Select value={entityType} onValueChange={(v) => setEntityType(v as any)}><SelectTrigger className="h-9 w-44 text-xs"><SelectValue placeholder="نوع موجودیت" /></SelectTrigger><SelectContent>{(['ALL', ...REGISTRY_ENTITIES] as const).map((t) => <SelectItem key={t} value={t} className="text-xs">{t === 'ALL' ? 'همه انواع' : (ENTITY_LABELS[t as KeyEntityType] ?? t)}</SelectItem>)}</SelectContent></Select>
        <Select value={status} onValueChange={(v) => setStatus(v as any)}><SelectTrigger className="h-9 w-36 text-xs"><SelectValue placeholder="وضعیت" /></SelectTrigger><SelectContent>{(['ALL', 'DRAFT', 'PUBLISHED', 'INACTIVE'] as const).map((s) => <SelectItem key={s} value={s} className="text-xs">{s === 'ALL' ? 'همه وضعیت‌ها' : STATUS_LABELS[s]}</SelectItem>)}</SelectContent></Select>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-white py-16 text-xs text-zinc-400 dark:border-zinc-800 dark:bg-[#161618]">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: BRAND }} />در حال بارگذاری رجیستری کلیدها…
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-10 text-center dark:border-red-900/60 dark:bg-red-950/30">
          <p className="text-xs text-red-600 dark:text-red-300">{error}</p>
          <Button size="sm" variant="outline" onClick={() => void load()} className="gap-1.5 text-xs"><RefreshCwMini />تلاش دوباره</Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#161618]">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-100 dark:border-zinc-800">
                <TableHead className="py-3 text-right text-[11px] font-bold text-zinc-500">کلید یکتا</TableHead>
                <TableHead className="py-3 text-right text-[11px] font-bold text-zinc-500">عنوان فارسی</TableHead>
                <TableHead className="py-3 text-right text-[11px] font-bold text-zinc-500">نوع موجودیت</TableHead>
                <TableHead className="py-3 text-right text-[11px] font-bold text-zinc-500">ماژول</TableHead>
                <TableHead className="py-3 text-right text-[11px] font-bold text-zinc-500">فرم / محل استفاده</TableHead>
                <TableHead className="py-3 text-right text-[11px] font-bold text-zinc-500">وضعیت</TableHead>
                <TableHead className="py-3 text-right text-[11px] font-bold text-zinc-500">کاربرد</TableHead>
                <TableHead className="py-3 text-right text-[11px] font-bold text-zinc-500">قفل</TableHead>
                <TableHead className="py-3 text-right text-[11px] font-bold text-zinc-500">تاریخ ایجاد</TableHead>
                <TableHead className="py-3 text-right text-[11px] font-bold text-zinc-500">عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={10} className="py-12 text-center text-xs text-zinc-400">کلیدی یافت نشد.</TableCell></TableRow>
              )}
              {filtered.map((r) => {
                const locked = lockedOf(r)
                return (
                  <TableRow key={r.id} className="border-zinc-100 dark:border-zinc-800">
                    <TableCell className="py-2.5"><span dir="ltr" className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">{r.full_key}</span></TableCell>
                    <TableCell className="py-2.5 text-[12px] text-zinc-800 dark:text-zinc-100">{r.title_fa || '—'}</TableCell>
                    <TableCell className="py-2.5 text-[11px] text-zinc-500">{ENTITY_LABELS[r.entity_type] ?? r.entity_type}</TableCell>
                    <TableCell className="py-2.5 text-[11px]"><span dir="ltr" className="font-mono text-[10px] text-zinc-500">{r.module}</span></TableCell>
                    <TableCell className="py-2.5 text-[11px] text-zinc-500">{r.form_name || '—'}</TableCell>
                    <TableCell className="py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${r.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : r.status === 'INACTIVE' ? 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'}`}>{STATUS_LABELS[r.status]}</span>
                    </TableCell>
                    <TableCell className="py-2.5 text-[11px] text-zinc-500">{r.usage_count}</TableCell>
                    <TableCell className="py-2.5">{locked ? <Lock className="h-3.5 w-3.5 text-zinc-400" /> : <span className="text-[11px] text-emerald-600">باز</span>}</TableCell>
                    <TableCell className="py-2.5 text-[11px] text-zinc-500">{faDate(r.created_at)}</TableCell>
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400" title="مشاهده جزئیات" onClick={() => setDetails(r)}><Eye className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400" title="کپی کلید" onClick={() => void copyKey(r.full_key)}><Copy className="h-3.5 w-3.5" /></Button>
                        {!locked && (
                          <>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400" title="ویرایش" onClick={() => setDetails(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30" title="غیرفعال‌کردن" onClick={() => void deactivate(r)}><Ban className="h-3.5 w-3.5" /></Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Details panel */}
      <FullScreenDialog
        open={!!details}
        title="جزئیات کلید"
        subtitle={details?.full_key ?? ''}
        onBack={() => setDetails(null)}
      >
        {details && (
          <div className="mx-auto max-w-3xl space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#161618]">
            <DetailRow k="کلید یکتا" v={<code dir="ltr" className="font-mono text-xs text-zinc-800 dark:text-zinc-100">{details.full_key}</code>} />
            <DetailRow k="عنوان فارسی" v={details.title_fa || '—'} />
            <DetailRow k="نوع موجودیت" v={ENTITY_LABELS[details.entity_type] ?? details.entity_type} />
            <DetailRow k="ماژول" v={<code dir="ltr" className="font-mono text-xs text-zinc-600">{details.module}</code>} />
            <DetailRow k="فرم / صفحه" v={details.form_name || '—'} />
            <DetailRow k="رکورد اصلی" v={details.source_table ? <code dir="ltr" className="font-mono text-[11px] text-zinc-600">{details.source_table}:{details.source_record_id?.slice(0, 8)}…</code> : '—'} />
            <DetailRow k="وضعیت" v={STATUS_LABELS[details.status]} />
            <DetailRow k="قفل" v={details.locked ? `بله — ${details.lock_reason ?? 'قفل شده'}` : 'خیر'} />
            <DetailRow k="تعداد کاربرد" v={String(details.usage_count)} />
            <DetailRow k="تاریخ ایجاد" v={faDate(details.created_at)} />
            <DetailRow k="آخرین ویرایش" v={faDate(details.updated_at)} />
            <DetailRow k="ایجادکننده" v={details.created_by ?? '—'} />
            <DetailRow k="محل‌های استفاده" v={details.form_name ? `${details.form_name} • ${ENTITY_LABELS[details.entity_type]}` : '—'} />
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] leading-6 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
              تاریخچهٔ تغییرات مهم کلید در حال حاضر از همان <code dir="ltr" className="font-mono">created_at / updated_at</code> رجیستری استخراج می‌شود؛ ثبت لاگ کامل تغییرات می‌تواند در فاز بعدی به رجیستری اضافه شود.
            </p>
          </div>
        )}
      </FullScreenDialog>
    </div>
  )
}

function RefreshCwMini() { return <Layers className="h-3.5 w-3.5" /> }

function DetailRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] items-start gap-3 border-b border-zinc-100 pb-2.5 last:border-0 dark:border-zinc-800">
      <span className="text-[11px] font-bold text-zinc-500">{k}</span>
      <span className="text-[12px] text-zinc-800 dark:text-zinc-100">{v}</span>
    </div>
  )
}