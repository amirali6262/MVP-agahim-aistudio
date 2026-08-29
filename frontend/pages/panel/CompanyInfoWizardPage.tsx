import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, ChevronLeft, Loader2, TriangleAlert, RefreshCw, Save, ShieldCheck, CircleCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../../lib/shadcn/button'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { fetchPublishedCompanyFields, fetchCompanyFieldValues, upsertCompanyFieldValues, type CompanyInfoDesign } from '../../lib/companyInfo'
import CompanyDynamicFields, { type CompanyFieldValues } from '../../components/companyInfo/CompanyDynamicFields'
import { useTenant } from '../../context/TenantContext'

const BRAND = '#5B4DE6'

function isAnswered(v: string): boolean {
  return v !== undefined && v !== null && String(v).trim() !== '' && String(v) !== 'false'
}

export default function CompanyInfoWizardPage() {
  const { selectedTenant } = useTenant()
  const tenantId = selectedTenant?.id
  const navigate = useNavigate()

  const [design, setDesign] = useState<CompanyInfoDesign | null>(null)
  const [stored, setStored] = useState<Record<string, string>>({})
  const [values, setValues] = useState<CompanyFieldValues>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeStepIdx, setActiveStepIdx] = useState(0)
  const [saving, setSaving] = useState(false)
  const [eligibility, setEligibility] = useState<{ running: boolean; result: string | null; error: string | null }>({ running: false, result: null, error: null })

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const d = await fetchPublishedCompanyFields()
      setDesign(d)
      if (tenantId && isSupabaseConfigured) {
        const rows = await fetchCompanyFieldValues(tenantId)
        const map: Record<string, string> = {}
        rows.forEach((r) => { map[r.field_id] = r.value })
        setStored(map)
        setValues(map)
      } else {
        setValues({})
        setStored({})
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'دریافت اطلاعات ناموفق بود.')
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { void load() }, [load])

  const complementaryDefs = useMemo(() =>
    (design?.definitions ?? []).filter((d) => d.section === 'COMPLEMENTARY' || d.section === 'BOTH'),
    [design]
  )

  // Steps that actually contain at least one active complementary field.
  const steps = useMemo(() => {
    if (!design) return []
    return (design.steps ?? [])
      .filter((s) => s.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s) => {
        const fields = complementaryDefs.filter((f) => f.wizard_step_id === s.id)
        return { ...s, fields }
      })
      .filter((s) => s.fields.length > 0)
  }, [design, complementaryDefs])

  const unassignedFields = useMemo(() =>
    complementaryDefs.filter((f) => !f.wizard_step_id && (!design?.steps.some((s) => s.id === f.wizard_step_id))),
    [complementaryDefs, design]
  )

  const requiredVisibleCount = useMemo(() => complementaryDefs.filter((f) => f.required).length, [complementaryDefs])
  const requiredAnsweredCount = useMemo(() =>
    complementaryDefs.filter((f) => f.required && isAnswered(values[f.id])).length,
    [complementaryDefs, values]
  )
  const progress = requiredVisibleCount === 0 ? 0 : Math.round((requiredAnsweredCount / requiredVisibleCount) * 100)

  const currentFields = steps[activeStepIdx]?.fields ?? []

  const saveStep = async (advance: boolean) => {
    if (!tenantId) { toast.error('شرکتی انتخاب نشده است.'); return }
    if (!isSupabaseConfigured) { toast.error('اتصال به پایگاه داده برای ذخیره الزامی است.'); return }
    // Validate required fields of the current step (plus unassigned ones).
    const toCheck = [...currentFields, ...unassignedFields]
    const missing = toCheck.filter((f) => f.required && f.is_active && !isAnswered(values[f.id]))
    if (missing.length > 0) {
      toast.error(`فیلدهای اجباری این مرحله تکمیل نشده‌اند: ${missing.map((m) => m.title).join('، ')}`)
      setActiveStepIdx((prev) => Math.max(0, prev - 1))
      return
    }
    setSaving(true)
    try {
      const entries = complementaryDefs
        .filter((d) => values[d.id] !== undefined && values[d.id] !== null && String(values[d.id]).trim() !== '')
        .map((d) => ({ field_id: d.id, value: String(values[d.id]) }))
      await upsertCompanyFieldValues(tenantId, entries)
      setStored(values)
      toast.success('مرحله ذخیره شد.')
      if (advance) {
        setActiveStepIdx((prev) => Math.min(steps.length, prev + 1))
      } else {
        setActiveStepIdx((prev) => Math.max(0, prev - 1))
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ذخیره مرحله ناموفق بود.')
    } finally {
      setSaving(false)
    }
  }

  const runEligibility = async () => {
    if (!tenantId) { toast.error('شرکتی انتخاب نشده است.'); return }
    setEligibility({ running: true, result: null, error: null })
    try {
      if (!isSupabaseConfigured) throw new Error('اتصال به پایگاه داده برقرار نیست.')
      const { data, error } = await (supabase as any).rpc('evaluate_tenant_eligibility', { requested_tenant_id: tenantId })
      if (error) throw error
      const rows = Array.isArray(data) ? data : []
      const eligible = rows.filter((r: any) => r.outcome === 'ELIGIBLE').length
      const notEligible = rows.filter((r: any) => r.outcome === 'NOT_ELIGIBLE').length
      setEligibility({
        running: false,
        result: `موتور تشخیص اجرا شد: ${eligible.toLocaleString('fa-IR')} تعهد مشمول، ${notEligible.toLocaleString('fa-IR')} تعهد غیرمشمول.`,
        error: null,
      })
    } catch (err) {
      setEligibility({ running: false, result: null, error: err instanceof Error ? err.message : 'اجرای موتور تشخیص ناموفق بود.' })
    }
  }

  if (!tenantId) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-sm text-zinc-400" dir="rtl">
        <TriangleAlert className="h-7 w-7 text-amber-500" /> برای تکمیل اطلاعات، ابتدا یک شرکت انتخاب کنید.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20" dir="rtl">
        <Loader2 className="h-7 w-7 animate-spin" style={{ color: BRAND }} />
        <span className="text-xs text-zinc-400">در حال بارگذاری ویزارد از پایگاه داده...</span>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-800/60 bg-red-950/20 p-10 text-center" dir="rtl">
        <TriangleAlert className="h-8 w-8 text-red-400" />
        <p className="text-sm font-bold text-red-300">دریافت اطلاعات ناموفق بود</p>
        <p className="max-w-md text-xs leading-6 text-red-200/80">{loadError}</p>
        <Button size="sm" onClick={() => void load()} className="gap-2 text-xs text-white" style={{ background: BRAND }}><RefreshCw className="h-3.5 w-3.5" />تلاش دوباره</Button>
      </div>
    )
  }

  if (!design || complementaryDefs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-amber-800/60 bg-amber-950/20 p-10 text-center" dir="rtl">
        <TriangleAlert className="h-8 w-8 text-amber-400" />
        <p className="text-sm font-bold text-amber-200">مرحله ویزارد اطلاعات تکمیلی در دسترس نیست</p>
        <p className="max-w-md text-xs leading-6 text-amber-200/80">هیچ فیلد منتشرشده‌ای برای اطلاعات تکمیلی تعریف نشده است. از ادمین پلتفرم، فیلدها و مراحل ویزارد را منتشر کنید.</p>
        <Button size="sm" variant="outline" onClick={() => void load()} className="mt-2 gap-2 text-xs border-zinc-700 text-zinc-300"><RefreshCw className="h-3.5 w-3.5" />تلاش دوباره</Button>
      </div>
    )
  }

  const totalSteps = steps.length
  const lastStep = activeStepIdx >= totalSteps

  return (
    <div dir="rtl" className="mx-auto max-w-3xl space-y-5 p-2 sm:p-4">
      {/* Header */}
      <div className="rounded-2xl border border-zinc-800 bg-[#141615] px-5 py-5 text-zinc-100 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-base font-extrabold">تکمیل اطلاعات شرکت</h1>
            <p className="mt-1 max-w-xl text-[11px] leading-5 text-zinc-400">
              اطلاعات {selectedTenant?.name ?? ''} برای تشخیص درست تعهدات تکمیل می‌شود. هر مرحله ذخیره خودکار می‌شود و می‌توانید بعداً ادامه دهید.
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-emerald-700 bg-emerald-950/30 px-3 py-1 text-[10px] font-bold text-emerald-300">{progress.toLocaleString('fa-IR')}٪ تکمیل لازم</span>
        </div>
        {/* Progress bar */}
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-800">
          <div className="h-full transition-all duration-300" style={{ width: `${progress}%`, background: BRAND }} />
        </div>
        <p className="mt-2 text-[10px] text-zinc-500">
          {requiredAnsweredCount.toLocaleString('fa-IR')} از {requiredVisibleCount.toLocaleString('fa-IR')} فیلد اجباری پاسخ داده شده است.
        </p>
      </div>

      {/* Eligibility action */}
      {!lastStep && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-[#161618] px-5 py-4">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-400" />
            <div>
              <p className="text-xs font-bold text-zinc-200">به‌روزرسانی تشخیص تعهدات</p>
              <p className="mt-0.5 text-[10px] leading-4 text-zinc-400">پس از هر مرحله، موتور مشمولیت می‌تواند دوباره اجرا شود تا تعهدات جدید شناسایی شوند.</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => void runEligibility()} disabled={eligibility.running} className="gap-2 border-zinc-700 text-xs text-zinc-200 hover:bg-zinc-800">
            {eligibility.running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} اجرای تشخیص
          </Button>
        </div>
      )}
      {eligibility.result && (
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-800/60 bg-emerald-950/20 px-4 py-3 text-xs leading-5 text-emerald-200"><CircleCheck className="mt-0.5 h-4 w-4 text-emerald-400" />{eligibility.result}</div>
      )}
      {eligibility.error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-800/60 bg-red-950/20 px-4 py-3 text-xs leading-5 text-red-200"><TriangleAlert className="mt-0.5 h-4 w-4 text-red-400" />{eligibility.error}</div>
      )}

      {/* Step nav */}
      {totalSteps > 0 && !lastStep && (
        <div className="flex flex-wrap items-center gap-1.5">
          {steps.map((s, i) => (
            <button key={s.id} onClick={() => !saving && setActiveStepIdx(i)}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${i === activeStepIdx ? 'text-white shadow-sm' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
              style={i === activeStepIdx ? { background: BRAND } : undefined}>
              {s.title}
            </button>
          ))}
        </div>
      )}

      {/* Body */}
      {lastStep ? (
        <div className="rounded-2xl border border-zinc-800 bg-[#141615] p-10 text-center shadow-sm">
          <CircleCheck className="mx-auto h-9 w-9 text-emerald-400" />
          <h2 className="mt-4 text-base font-extrabold text-zinc-50">ویزارد به پایان رسید</h2>
          <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-zinc-400">اطلاعات هر مرحله جداگانه در پایگاه داده ذخیره شده است. می‌توانید اکنون موتور تشخیص تعهدات را اجرا کنید یا به داشبورد بازگردید.</p>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <Button size="sm" onClick={() => void runEligibility()} disabled={eligibility.running} className="gap-2 text-xs text-white" style={{ background: BRAND }}>
              {eligibility.running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />} اجرای تشخیص نهایی
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate('/panel/dashboard')} className="gap-2 border-zinc-700 text-xs text-zinc-300">بازگشت به داشبورد</Button>
          </div>
        </div>
      ) : steps.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-[#141615] p-10 text-center shadow-sm">
          <p className="text-xs text-zinc-400">برای اطلاعات تکمیلی، مرحله ویزاردی تعریف نشده است.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-800 bg-[#141615] p-5 shadow-sm sm:p-6">
          <div className="mb-4 border-b border-zinc-800 pb-3">
            <h3 className="text-sm font-extrabold text-zinc-50">{steps[activeStepIdx].title}</h3>
            {steps[activeStepIdx].description && <p className="mt-1 text-xs leading-5 text-zinc-400">{steps[activeStepIdx].description}</p>}
          </div>
          <CompanyDynamicFields
            definitions={currentFields}
            options={design.options}
            values={values}
            onChange={(fieldId, v) => setValues((prev) => ({ ...prev, [fieldId]: v }))}
            columns={steps[activeStepIdx].columns as 1 | 2}
          />
          {/* Unassigned complementary fields (published but not yet placed in a step) */}
          {unassignedFields.length > 0 && (
            <div className="mt-6 border-t border-zinc-800 pt-5">
              <p className="mb-3 text-[11px] font-bold text-zinc-300">سایر اطلاعات تکمیلی</p>
              <CompanyDynamicFields definitions={unassignedFields} options={design.options} values={values} onChange={(fieldId, v) => setValues((prev) => ({ ...prev, [fieldId]: v }))} columns={1} />
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      {!lastStep && steps.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="outline" disabled={saving || (activeStepIdx === 0 && unassignedFields.length === 0)} onClick={() => saveStep(false)}
            className="h-10 gap-1.5 border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-800">
            <ChevronRight className="h-4 w-4" /> ذخیره و قبلی
          </Button>
          <span className="text-[11px] text-zinc-500">{activeStepIdx + 1} از {totalSteps + 1}</span>
          <Button type="button" disabled={saving} onClick={() => saveStep(true)}
            className="h-10 gap-1.5 px-5 text-xs font-bold text-white" style={{ background: BRAND }}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            ذخیره و ادامه <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}