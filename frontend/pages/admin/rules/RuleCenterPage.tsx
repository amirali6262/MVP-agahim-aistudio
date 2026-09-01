import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle, CalendarClock, Copy, Eye, FlaskConical, Inbox, Loader2, Pencil, Plus, Search, ShieldAlert, Square, Trash2, X,
} from 'lucide-react'
import { Button } from '../../../lib/shadcn/button'
import {
  deleteDraftRule,
  duplicateRule,
  fetchRuleCenterRules,
  fetchRuleUsage,
  stopRuleUsage,
  type RuleCenterRule,
  type RuleKind,
} from '../../../lib/ruleCenter'
import RuleWizard from './RuleWizard'
import RuleDetailModal from './RuleDetailModal'

const KINDS: Array<{ key: RuleKind; label: string }> = [
  { key: 'RECURRENCE', label: 'تناوب' },
  { key: 'DEADLINE', label: 'مهلت' },
  { key: 'BOTH', label: 'تناوب همراه مهلت' },
  { key: 'PENALTY', label: 'جریمه' },
]

type Tab = 'DEADLINE' | 'PENALTY'

export default function RuleCenterPage() {
  const [tab, setTab] = useState<Tab>('DEADLINE')
  const [rows, setRows] = useState<Array<RuleCenterRule & { latest_version?: any }>>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [kindFilter, setKindFilter] = useState('')

  const [wizard, setWizard] = useState<{ ruleId?: string | null; versionId?: string | null; kind: RuleKind; mode: 'create' | 'edit' | 'newversion' } | null>(null)
  const [detail, setDetail] = useState<{ ruleId: string; versionId?: string } | null>(null)
  const [busy, setBusy] = useState('')

  async function load() {
    setLoading(true)
    setLoadError('')
    try {
      const data = await fetchRuleCenterRules()
      // تعداد محل‌های استفاده برای هر قاعده (نسخهٔ آخر)
      const counts = await Promise.all(
        data.map(async (r) => {
          if (!r.latest_version) return 0
          try {
            const usage = await fetchRuleUsage(r.latest_version.id)
            return usage.filter((u) => u.status === 'ACTIVE').length
          } catch {
            return 0
          }
        })
      )
      setRows(data.map((r, i) => ({ ...r, usage_count: counts[i] })))
    } catch (e: any) {
      setLoadError(e?.message ?? 'خطا در دریافت قواعد — اتصال به پایگاه‌داده را بررسی کنید.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const visible = useMemo(() => {
    const kindScope = tab === 'PENALTY' ? ['PENALTY'] : ['RECURRENCE', 'DEADLINE', 'BOTH']
    return rows
      .filter((r) => kindScope.includes(r.kind))
      .filter((r) => !search || r.title_fa.includes(search) || r.code.toLowerCase().includes(search.toLowerCase()) || (r.summary ?? '').includes(search))
      .filter((r) => !statusFilter || (r.latest_version?.status ?? '') === statusFilter)
      .filter((r) => !kindFilter || r.kind === kindFilter)
  }, [rows, tab, search, statusFilter, kindFilter])

  async function handleAction(action: 'duplicate' | 'stop' | 'delete', rule: RuleCenterRule) {
    if (busy) return
    if (action === 'delete' && !window.confirm('فقط قاعدهٔ کاملاً پیش‌نویسِ بدون اتصال حذف می‌شود. ادامه می‌دهید؟')) return
    setBusy(action + rule.id)
    try {
      if (action === 'duplicate') {
        const newId = await duplicateRule(rule.id)
        toast.success('قاعده تکثیر شد (پیش‌نویس مستقل).')
        await load()
        setWizard({ ruleId: newId, kind: rule.kind, mode: 'edit' })
      } else if (action === 'stop') {
        await stopRuleUsage(rule.id)
        toast.success('استفادهٔ جدید متوقف شد؛ سابقهٔ پرونده‌ها حفظ شد.')
        await load()
      } else {
        await deleteDraftRule(rule.id)
        toast.success('قاعدهٔ پیش‌نویس حذف شد.')
        await load()
      }
    } catch (e: any) {
      toast.error(e?.message ?? 'عملیات انجام نشد.')
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6" dir="rtl">
      {/* سربرگ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-100">
            <CalendarClock className="h-6 w-6 text-amber-400" />
            قواعد مهلت و جریمه
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            یک قاعده یک‌بار تعریف و نسخه‌بندی می‌شود؛ هر محل استفاده به نسخهٔ مشخص آن متصل است — نه «آخرین نسخه».
          </p>
        </div>
        <Button
          className="bg-amber-600 hover:bg-amber-500 text-zinc-950 gap-1.5 font-semibold"
          onClick={() => setWizard({ ruleId: null, versionId: null, kind: tab === 'PENALTY' ? 'PENALTY' : 'DEADLINE', mode: 'create' })}
        >
          <Plus className="h-4 w-4" /> قاعده جدید
        </Button>
      </div>

      {/* تب‌ها */}
      <div className="flex gap-1.5">
        {(['DEADLINE', 'PENALTY'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setTab(t); setKindFilter(''); setStatusFilter('') }}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition ${tab === t ? 'bg-amber-600 text-zinc-950' : 'border border-zinc-700 text-zinc-300 hover:border-amber-500/50'}`}
          >
            {t === 'PENALTY' ? 'جریمه‌ها' : 'تناوب و مهلت'}
          </button>
        ))}
      </div>

      {/* جست‌وجو و فیلتر */}
      <div className="grid gap-3 rounded-2xl border border-zinc-800 bg-[#101211] p-4 sm:grid-cols-[1fr,auto,auto,auto]">
        <div className="relative">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            className="w-full rounded-lg border border-zinc-700 bg-[#1d1a18] py-2 pr-9 pl-3 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-amber-500/70"
            placeholder="جست‌وجو در عنوان، کلید فنی یا شرح…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {tab === 'DEADLINE' && (
          <select className="rounded-lg border border-zinc-700 bg-[#1d1a18] px-3 py-2 text-sm text-zinc-200" value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}>
            <option value="">همهٔ انواع</option>
            {KINDS.filter((k) => k.key !== 'PENALTY').map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
          </select>
        )}
        <select className="rounded-lg border border-zinc-700 bg-[#1d1a18] px-3 py-2 text-sm text-zinc-200" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">همهٔ وضعیت‌ها</option>
          <option value="DRAFT">پیش‌نویس</option>
          <option value="IN_REVIEW">در بررسی</option>
          <option value="APPROVED">تأییدشده</option>
          <option value="PUBLISHED">منتشرشده</option>
          <option value="STOPPED">متوقف</option>
        </select>
        {(search || statusFilter || kindFilter) && (
          <Button variant="ghost" className="text-zinc-400 gap-1.5" onClick={() => { setSearch(''); setStatusFilter(''); setKindFilter('') }}>
            <X className="h-4 w-4" /> پاک‌کردن فیلتر
          </Button>
        )}
      </div>

      {/* بارگذاری / خطا / خالی */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-800 bg-[#101211] py-16 text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin" /> در حال دریافت قواعد…
        </div>
      ) : loadError ? (
        <div className="flex items-start gap-3 rounded-2xl border border-red-900/60 bg-red-950/20 p-5 text-sm text-red-300">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-bold">خطا در دریافت قواعد</p>
            <p className="mt-1 text-xs">{loadError}</p>
          </div>
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-800 bg-[#101211] py-16 text-zinc-500">
          <Inbox className="h-8 w-8" />
          <p className="text-sm">{rows.length === 0 ? 'هنوز قاعده‌ای تعریف نشده است.' : 'نتیجه‌ای برای جست‌وجوی شما یافت نشد.'}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#101211]">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-xs text-zinc-500">
                <th className="px-4 py-3 font-semibold">عنوان</th>
                <th className="px-4 py-3 font-semibold">نوع قاعده</th>
                <th className="px-4 py-3 font-semibold">خلاصه محاسبه</th>
                <th className="px-4 py-3 font-semibold">نسخه و وضعیت</th>
                <th className="px-4 py-3 font-semibold">بازه اعتبار</th>
                <th className="px-4 py-3 font-semibold">محل‌های استفاده</th>
                <th className="px-4 py-3 font-semibold">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const v = r.latest_version
                const isDraft = v?.status === 'DRAFT'
                const isPublished = v?.status === 'PUBLISHED' || v?.status === 'STOPPED'
                return (
                  <tr key={r.id} className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-900/40">
                    <td className="px-4 py-3">
                      <p className="font-bold text-zinc-100">{r.title_fa}</p>
                      <p className="mt-0.5 text-[11px] text-zinc-500 line-clamp-1">{r.summary || '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-lg bg-zinc-800 px-2 py-1 text-[11px] text-zinc-300">{KINDS.find((k) => k.key === r.kind)?.label ?? r.kind}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400 max-w-52 line-clamp-2">{ruleSummary(r)}</td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-bold text-zinc-200">نسخه {v?.version_number ?? 1}</p>
                      <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${v?.status === 'PUBLISHED' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60' : v?.status === 'STOPPED' ? 'bg-zinc-800 text-zinc-400 border border-zinc-600' : v?.status === 'APPROVED' ? 'bg-sky-950 text-sky-300 border border-sky-800/60' : v?.status === 'IN_REVIEW' ? 'bg-amber-950 text-amber-300 border border-amber-800/60' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}`}>
                        {v?.status === 'PUBLISHED' ? 'منتشرشده' : v?.status === 'STOPPED' ? 'متوقف' : v?.status === 'APPROVED' ? 'تأییدشده' : v?.status === 'IN_REVIEW' ? 'در بررسی' : 'پیش‌نویس'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-zinc-400">
                      {r.valid_from ? `${r.valid_from} → ${r.valid_to ?? 'باز'}` : 'نامحدود'}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400">{v?.usage_count ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button variant="ghost" size="sm" className="h-7 text-zinc-300 gap-1 text-[11px] px-2" title="مشاهده"
                          onClick={() => setDetail({ ruleId: r.id, versionId: v?.id })}>
                          <Eye className="h-3.5 w-3.5" /> مشاهده
                        </Button>
                        {isDraft && (
                          <Button variant="ghost" size="sm" className="h-7 text-amber-300 gap-1 text-[11px] px-2" title="ویرایش پیش‌نویس"
                            onClick={() => setWizard({ ruleId: r.id, versionId: v.id, kind: r.kind, mode: 'edit' })}>
                            <Pencil className="h-3.5 w-3.5" /> ویرایش
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 text-sky-300 gap-1 text-[11px] px-2" title="آزمایش"
                          onClick={() => setWizard({ ruleId: r.id, versionId: v?.id, kind: r.kind, mode: 'edit' })}>
                          <FlaskConical className="h-3.5 w-3.5" /> آزمایش
                        </Button>
                        {isPublished && (
                          <Button variant="ghost" size="sm" className="h-7 text-zinc-300 gap-1 text-[11px] px-2" title="ایجاد نسخه جدید"
                            onClick={() => setWizard({ ruleId: r.id, versionId: null, kind: r.kind, mode: 'newversion' })}>
                            <Copy className="h-3.5 w-3.5" /> نسخه جدید
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 text-zinc-300 gap-1 text-[11px] px-2" title="تکثیر"
                          onClick={() => void handleAction('duplicate', r)} disabled={busy === 'duplicate' + r.id}>
                          <Copy className="h-3.5 w-3.5" /> تکثیر
                        </Button>
                        {(v?.status === 'PUBLISHED' || v?.status === 'APPROVED') && (
                          <Button variant="ghost" size="sm" className="h-7 text-amber-300 gap-1 text-[11px] px-2" title="توقف استفاده جدید"
                            onClick={() => void handleAction('stop', r)} disabled={busy === 'stop' + r.id}>
                            <Square className="h-3.5 w-3.5" /> توقف
                          </Button>
                        )}
                        {isDraft && (
                          <Button variant="ghost" size="sm" className="h-7 text-red-400 gap-1 text-[11px] px-2" title="حذف (فقط پیش‌نویس بدون اتصال)"
                            onClick={() => void handleAction('delete', r)} disabled={busy === 'delete' + r.id}>
                            {busy === 'delete' + r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} حذف
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* راهنمای کوتاه */}
      <div className="rounded-2xl border border-zinc-800 bg-[#101211] p-4 text-[11px] leading-6 text-zinc-500">
        <p className="font-bold text-zinc-400 mb-1">مسیر استفاده از یک قاعده:</p>
        <ol className="list-inside list-decimal space-y-0.5">
          <li>قاعده را تعریف، آزمایش و منتشر کنید (نسخهٔ منتشرشده تغییرناپذیر است).</li>
          <li>در «ویرایش تعهد» یا «تنظیمات اقدام»، قاعده را به نسخهٔ مشخص متصل و ورودی‌ها را نگاشت کنید.</li>
          <li>انتشار تعهد / فعال‌سازی الگو فقط با اتصال معتبر ممکن است.</li>
        </ol>
      </div>

      {wizard && (
        <RuleWizard
          ruleId={wizard.ruleId}
          versionId={wizard.versionId}
          kind={wizard.kind}
          mode={wizard.mode}
          onClose={() => { setWizard(null); void load() }}
          onSaved={async () => { await load() }}
        />
      )}
      {detail && (
        <RuleDetailModal
          ruleId={detail.ruleId}
          initialVersionId={detail.versionId}
          onClose={() => setDetail(null)}
          onEditDraft={(versionId) => {
            const rule = rows.find((r) => r.id === detail.ruleId)
            setDetail(null)
            if (rule) setWizard({ ruleId: rule.id, versionId, kind: rule.kind, mode: 'edit' })
          }}
        />
      )}
    </div>
  )
}

function ruleSummary(r: RuleCenterRule & { latest_version?: any }): string {
  const def = r.latest_version?.definition ?? {}
  if (r.kind === 'PENALTY') {
    const calc = def.calculation ?? {}
    if (calc.method === 'FIXED') return `مبلغ ثابت: ${Number(calc.amount ?? 0).toLocaleString('fa-IR')} ${calc.currency ?? 'ریال'}`
    if (calc.method === 'PERCENT') return `${calc.rate_percent ?? 0}٪ از مبلغ مبنا`
    if (calc.method === 'PER_TIME_FIXED') return `${Number(calc.amount ?? 0).toLocaleString('fa-IR')} ${calc.currency ?? 'ریال'} به ازای هر ${calc.per_unit ?? 'روز'}`
    if (calc.method === 'PER_TIME_PERCENT') return `روزانه ${calc.rate_percent ?? 0}٪ از مبلغ مبنا`
    if (calc.method === 'TIERED') return `پلکانی (${calc.tier_mode === 'WHOLE' ? 'نرخ بر کل' : 'نرخ هر بخش'})`
    if (calc.method === 'REFERENCE_DECIDED') return 'نیازمند تصمیم مرجع'
    return calc.method ?? ''
  }
  const dl = def.deadline ?? {}
  if (dl.no_deadline) return 'بدون مهلت'
  const iv = dl.interval ?? {}
  if (dl.method === 'INTERVAL_FROM_BASE') return `${iv.value ?? 0} ${iv.unit ?? 'روز'} پس از مبدأ (${iv.base_input || iv.base || '—'})`
  if (dl.method === 'FIXED_DATE') return `تاریخ ثابت: ${dl.fixed_date?.month}/${dl.fixed_date?.day} شمسی`
  if (dl.method === 'FIXED_IN_PERIOD') return `در دوره: ${dl.fixed_in_period?.position === 'END' ? 'پایان' : dl.fixed_in_period?.position === 'START' ? 'شروع' : `روز ${dl.fixed_in_period?.n}`}`
  return dl.method ?? ''
}
