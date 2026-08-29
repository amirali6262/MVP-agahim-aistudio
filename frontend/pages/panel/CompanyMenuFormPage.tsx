import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, Building2, CalendarClock, Check, ChevronLeft, FileText, Info, Loader2, Play, Scale, AlertTriangle } from 'lucide-react'
import { Button } from '../../lib/shadcn/button'
import { useTenant } from '../../context/TenantContext'
import { fetchObligationFormPreview, fetchPublishedMenu, type ObligationFormPreview, type PublishedCompanyMenuItem } from '../../lib/supabaseDb'

const BRAND = '#5B4DE6'
const BRAND_SOFT = '#EEECFC'
const DOMAIN_LABEL: Record<string, string> = { TAX: 'مالیات', INSURANCE: 'بیمه' }

export default function CompanyMenuFormPage() {
  const { obligationId } = useParams<'obligationId'>()
  const navigate = useNavigate()
  const { selectedTenant } = useTenant()

  const [form, setForm] = useState<ObligationFormPreview | null>(null)
  const [menuItem, setMenuItem] = useState<{ title_fa: string; icon: string | null; parents: string[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!obligationId) {
        setError('شناسه تکلیف در مسیر مشخص نشده است.')
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      try {
        // Resolve the linked obligation (published version).
        const [f, menu] = await Promise.all([
          fetchObligationFormPreview(obligationId).catch(() => null),
          fetchPublishedMenu().catch(() => [] as PublishedCompanyMenuItem[]),
        ])
        if (cancelled) return

        // Find the menu item this obligation is linked to, plus its breadcrumb chain.
        const item = menu.find((m) => m.form_obligation_id === obligationId) ?? null
        let parents: string[] = []
        if (item) {
          const byCode = new Map(menu.map((m) => [m.code, m]))
          let cursor = item.parent_code ? byCode.get(item.parent_code) : undefined
          while (cursor) {
            parents.unshift(cursor.title_fa)
            cursor = cursor.parent_code ? byCode.get(cursor.parent_code) : undefined
          }
        }
        setMenuItem(item ? { title_fa: item.title_fa, icon: item.icon, parents } : null)
        if (!f) setError('تکلیف متصل در دسترس نیست.')
        else setForm(f)
      } catch {
        if (!cancelled) setError('خطا در بارگذاری اطلاعات. لطفاً دوباره تلاش کنید.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [obligationId])

  const breadcrumb = useMemo(() => {
    const chain = ['فضای کاری شرکت', 'منوی شرکت']
    if (menuItem) chain.push(...menuItem.parents, menuItem.title_fa)
    return chain
  }, [menuItem])

  return (
    <div className="mx-auto max-w-3xl" dir="rtl">
      {/* ── Breadcrumb ── */}
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-[11px] text-zinc-400 dark:text-zinc-500">
        {breadcrumb.map((part, index) => (
          <span key={index} className="flex items-center gap-1">
            {index > 0 && <ChevronLeft className="h-3 w-3" />}
            <span className={index === breadcrumb.length - 1 ? 'font-bold text-zinc-700 dark:text-zinc-200' : ''}>{part}</span>
          </span>
        ))}
      </nav>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#161618]">
        {loading ? (
          <div className="flex items-center gap-3 py-16 text-sm text-zinc-500 dark:text-zinc-400">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: BRAND }} />
            در حال بارگذاری...
          </div>
        ) : error || !form ? (
          /* Controlled empty state — the linked obligation is unavailable */
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-950/40">
              <AlertTriangle className="h-7 w-7 text-red-500" />
            </span>
            <p className="text-sm font-extrabold text-zinc-800 dark:text-zinc-100">تکلیف متصل در دسترس نیست</p>
            <p className="max-w-sm text-xs leading-6 text-zinc-500 dark:text-zinc-400">
              {error ?? 'فرم مرتبط با این آیتم منو یافت نشد یا نسخه منتشرشده‌ای ندارد. با مدیر پلتفرم تماس بگیرید.'}
            </p>
            <Button variant="outline" size="sm" onClick={() => navigate('/panel/dashboard')} className="mt-2 gap-2 border-zinc-300 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
              <ArrowRight className="h-3.5 w-3.5" />
              بازگشت به داشبورد
            </Button>
          </div>
        ) : (
          <div className="space-y-5 p-5 sm:p-7">
            {/* Header */}
            <div className="flex flex-col gap-4 border-b border-zinc-100 pb-5 dark:border-zinc-800 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white" style={{ background: BRAND }}>
                  <FileText className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-[11px] font-bold" style={{ color: BRAND }}>{menuItem?.title_fa ?? 'آیتم منوی شرکت'}</p>
                  <h1 className="mt-1 text-lg font-extrabold text-zinc-900 dark:text-zinc-50">{form.title}</h1>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                    <Scale className="h-3.5 w-3.5" style={{ color: BRAND }} />
                    <span className="font-semibold" style={{ color: BRAND }}>{DOMAIN_LABEL[form.domain] ?? form.domain}</span>
                    <span className="text-zinc-300 dark:text-zinc-600">·</span>
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] dark:bg-zinc-800">{form.code}</span>
                  </p>
                </div>
              </div>
              <span className="inline-flex w-fit shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                <Check className="h-3.5 w-3.5" />
                نسخه {form.version_number.toLocaleString('fa-IR')} منتشرشده
              </span>
            </div>

            {/* Obligation facts */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <InfoTile icon={<Scale className="h-4 w-4" style={{ color: BRAND }} />} label="حوزه" value={DOMAIN_LABEL[form.domain] ?? form.domain} />
              <InfoTile icon={<Building2 className="h-4 w-4" style={{ color: BRAND }} />} label="تکلیف متصل" value={form.title} />
              <InfoTile icon={<CalendarClock className="h-4 w-4" style={{ color: BRAND }} />} label="از تاریخ موثر" value={form.effective_from ? formatDate(form.effective_from) : '—'} />
              <InfoTile icon={<Check className="h-4 w-4 text-emerald-600" />} label="وضعیت انتشار" value="فعال و منتشرشده" />
            </div>

            {form.legal_reference && (
              <div className="rounded-xl bg-zinc-50 p-4 text-xs dark:bg-zinc-800/40">
                <p className="mb-1 font-bold text-zinc-500 dark:text-zinc-400">مبنای قانونی</p>
                <p className="leading-6 text-zinc-700 dark:text-zinc-200">{form.legal_reference}</p>
              </div>
            )}

            {/* Temporary notice + disabled action */}
            <div className="flex flex-col gap-4 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/60 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-700 dark:bg-zinc-800/30">
              <div className="flex items-start gap-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0" style={{ color: BRAND }} />
                <div>
                  <p className="text-xs font-bold text-zinc-700 dark:text-zinc-200">فرم این تکلیف در مرحله بعد در دسترس قرار می‌گیرد</p>
                  <p className="mt-1 text-[11px] leading-6 text-zinc-500 dark:text-zinc-400">
                    نمایشگر عمومی فرم هنوز ساخته نشده است. اطلاعات تکلیف و نسخه منتشرشده آن در همین صفحه نمایش داده می‌شود.
                  </p>
                </div>
              </div>
              <Button size="sm" disabled className="shrink-0 gap-2 text-xs" title="نمایشگر عمومی فرم در مرحله بعد ساخته می‌شود.">
                <Play className="h-3.5 w-3.5" />
                شروع تکمیل فرم
              </Button>
            </div>

            {/* Back */}
            <div className="flex items-center justify-between border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2 text-xs text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">
                <ArrowRight className="h-3.5 w-3.5" />
                بازگشت
              </Button>
              <span className="text-[10px] text-zinc-400">{selectedTenant?.name ?? ''}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-200 px-3.5 py-3 dark:border-zinc-700">
      <span className="shrink-0 text-zinc-400">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] text-zinc-400">{label}</p>
        <p className="truncate text-xs font-bold text-zinc-800 dark:text-zinc-100">{value}</p>
      </div>
    </div>
  )
}

function formatDate(isoDate: string) {
  try {
    const date = new Date(isoDate.length === 10 ? isoDate + 'T00:00:00' : isoDate)
    if (Number.isNaN(date.getTime())) return isoDate
    return date.toLocaleDateString('fa-IR', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return isoDate
  }
}
