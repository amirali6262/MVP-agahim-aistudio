import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Calendar, Check, Info, Loader2 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../lib/shadcn/select'
import { Label } from '../lib/shadcn/label'
import { Button } from '../lib/shadcn/button'
import { fetchFiscalYears, setCaseFiscalYear, fiscalYearOptionLabel, type TenantFiscalYear } from '../lib/supabaseDb'

const BRAND = '#5B4DE6'

interface Props {
  tenantId: string
  caseId: string
  fiscalYearId: string | null
  // Reports whether a fiscal year is attached, so the parent can gate submit.
  onRequirementChange: (met: boolean) => void
}

export default function FiscalYearSystemField({ tenantId, caseId, fiscalYearId, onRequirementChange }: Props) {
  const navigate = useNavigate()
  const [years, setYears] = useState<TenantFiscalYear[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [attached, setAttached] = useState<string | null>(fiscalYearId)

  useEffect(() => { setAttached(fiscalYearId) }, [fiscalYearId])
  useEffect(() => { onRequirementChange(Boolean(attached)) }, [attached, onRequirementChange])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const list = await fetchFiscalYears(tenantId).catch(() => [] as TenantFiscalYear[])
      if (!cancelled) setYears(list)
    })().finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [tenantId])

  const attachedYear = attached ? years.find((y) => y.id === attached) : undefined

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50/60 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/40">
        <Loader2 className="h-4 w-4 animate-spin" style={{ color: BRAND }} />
        <span className="text-[11px] text-zinc-400">در حال بارگذاری سال مالی شرکت...</span>
      </div>
    )
  }

  if (attached) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 dark:border-emerald-800/70 dark:bg-emerald-950/20">
        <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
          <Check className="h-4 w-4" />
          <span>سال مالی این تعهد (فقط‌خواندنی)</span>
        </div>
        <div className="text-left">
          <p className="text-xs font-extrabold text-zinc-800 dark:text-zinc-100">{attachedYear?.title ?? 'سال مالی تعیین‌شده'}</p>
          {attachedYear && <p className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">از {attachedYear.start_date} تا {attachedYear.end_date}</p>}
        </div>
      </div>
    )
  }

  if (years.length === 0) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50/60 px-4 py-4 dark:border-amber-700 dark:bg-amber-950/20">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-[11px] leading-6 text-amber-800 dark:text-amber-200">
            برای ایجاد این تعهد، ابتدا سال مالی شرکت را تعریف کنید.
          </p>
        </div>
        <Button size="sm" onClick={() => navigate('/panel/fiscal-years')} className="w-fit gap-1.5 text-xs font-bold text-white" style={{ background: BRAND }}>
          <Calendar className="h-3.5 w-3.5" />
          تعریف سال مالی
        </Button>
      </div>
    )
  }

  const selectable = years.filter((y) => y.status !== 'CLOSED')

  const handleSelect = async (id: string) => {
    setSaving(true)
    const result = await setCaseFiscalYear(caseId, id)
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error ?? 'اتصال سال مالی به این تعهد ناموفق بود.')
      return
    }
    setAttached(id)
    onRequirementChange(true)
    toast.success('سال مالی این تعهد ثبت شد.')
  }

  return (
    <div className="space-y-1.5 rounded-xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-700 dark:bg-[#161618]">
      <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-200">
        سال مالی <span className="text-red-500">*</span>
      </Label>
      <Select value={attached ?? ''} onValueChange={(value) => void handleSelect(value)} disabled={saving || selectable.length === 0}>
        <SelectTrigger className="h-10 border-zinc-200 bg-white text-xs dark:border-zinc-700 dark:bg-[#161618]">
          <SelectValue placeholder="دوره مالی شرکت را انتخاب کنید" />
        </SelectTrigger>
        <SelectContent>
          {selectable.map((year) => (
            <SelectItem key={year.id} value={year.id} className="text-xs">
              {fiscalYearOptionLabel(year)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {saving && <p className="flex items-center gap-1.5 text-[10px] text-zinc-400"><Loader2 className="h-3 w-3 animate-spin" />در حال ثبت...</p>}
      {selectable.length === 0 && (
        <p className="text-[10px] text-zinc-400">همه دوره‌های مالی بسته شده‌اند؛ در «تعریف سال مالی» یک دوره باز بسازید.</p>
      )}
    </div>
  )
}