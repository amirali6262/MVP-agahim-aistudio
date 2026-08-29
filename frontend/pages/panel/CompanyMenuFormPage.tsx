import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, Building2, Scale, Check, FileText, Loader2, CalendarClock, AlertTriangle } from 'lucide-react'
import { Button } from '../../lib/shadcn/button'
import { useTenant } from '../../context/TenantContext'
import { fetchObligationFormPreview, type ObligationFormPreview } from '../../lib/supabaseDb'

const DOMAIN_LABEL: Record<string, string> = { TAX: 'مالیات', INSURANCE: 'بیمه' }
const BRAND = '#5B4DE6'

export default function CompanyMenuFormPage() {
  const { obligationId } = useParams<'obligationId'>()
  const navigate = useNavigate()
  const { selectedTenant } = useTenant()
  const [form, setForm] = useState<ObligationFormPreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!obligationId) return
      setLoading(true); setError(null)
      try {
        const f = await fetchObligationFormPreview(obligationId)
        if (cancelled) return
        if (!f) setError('فرم یافت نشد یا نسخه‌ی منتشرشده‌ای ندارد.')
        else setForm(f)
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'خطا در بارگذاری فرم')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [obligationId])

  return (
    <div dir="rtl" className="min-h-screen bg-[#F7F6FB] p-4 text-zinc-900 dark:bg-[#131318] dark:text-zinc-100 sm:p-6">
      <div className="mx-auto max-w-3xl">
        <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white">
          <ArrowRight className="h-4 w-4" /> بازگشت به منوی شرکت
        </button>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-700 dark:bg-zinc-900">
          {loading ? (
            <div className="flex items-center gap-3 py-12 text-sm text-zinc-500">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: BRAND }} /> در حال بارگذاری فرم...
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <AlertTriangle className="h-8 w-8 text-red-500" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          ) : form ? (
            <CompanyFormPreview form={form} tenantName={selectedTenant?.name} />
          ) : null}
        </div>
      </div>
    </div>
  )
}

function CompanyFormPreview({ form, tenantName }: { form: ObligationFormPreview; tenantName?: string }) {
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white" style={{ background: BRAND }}>
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-zinc-900 dark:text-white">{form.title}</h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
              <Scale className="h-4 w-4" style={{ color: BRAND }} />
              <span className="font-semibold" style={{ color: BRAND }}>{DOMAIN_LABEL[form.domain] ?? form.domain}</span>
              <span className="text-zinc-300 dark:text-zinc-600">·</span>
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] dark:bg-zinc-800">{form.code}</span>
            </p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
          <Check className="h-3.5 w-3.5" /> نسخه {form.version_number} منتشرشده
        </span>
      </div>

      {tenantName && (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          شرکت <b>{tenantName}</b> · این فرم از منوی تعریف‌شده در پنل مدیریت باز شده است.
        </p>
      )}

      {form.summary && <p className="text-sm leading-7 text-zinc-700 dark:text-zinc-200">{form.summary}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <InfoTile icon={<Scale className="h-4 w-4" style={{ color: BRAND }} />} label="حوزه" value={DOMAIN_LABEL[form.domain] ?? form.domain} />
        <InfoTile icon={<Building2 className="h-4 w-4" style={{ color: BRAND }} />} label="نسخه" value={`نسخه ${form.version_number}`} />
        <InfoTile icon={<CalendarClock className="h-4 w-4" style={{ color: BRAND }} />} label="از تاریخ موثر" value={form.effective_from ? formatDate(form.effective_from) : '—'} />
        <InfoTile icon={<Check className="h-4 w-4 text-emerald-600" />} label="وضعیت" value="فعال و منتشرشده" />
      </div>

      {form.legal_reference && (
        <div className="rounded-xl bg-zinc-50 p-4 text-sm dark:bg-zinc-800/40">
          <p className="mb-1 font-bold text-zinc-500 dark:text-zinc-400">مبنای قانونی</p>
          <p className="text-zinc-700 dark:text-zinc-200">{form.legal_reference}</p>
        </div>
      )}

      <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/60 p-5 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/30 dark:text-zinc-400">
        فیلدها و روند کامل این فرم به‌زودی در همین صفحه باز می‌شود. (رندر تعاملی فرم در مرحله‌ی بعد)
      </div>
    </div>
  )
}

function InfoTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-700">
      <span className="text-zinc-400">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-zinc-400">{label}</p>
        <p className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">{value}</p>
      </div>
    </div>
  )
}

function formatDate(isoDate: string) {
  try {
    return new Date(isoDate + 'T00:00:00').toLocaleDateString('fa-IR')
  } catch {
    return isoDate
  }
}