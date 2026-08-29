import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Building2, Loader2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../../lib/shadcn/button'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { createTenant } from '../../lib/supabaseDb'
import { useAuth } from '../../context/AuthContext'
import { fetchPublishedCompanyFields, upsertCompanyFieldValues, type CompanyInfoDesign } from '../../lib/companyInfo'
import CompanyDynamicFields, { type CompanyFieldValues } from '../../components/companyInfo/CompanyDynamicFields'

interface Props {
  onBack: () => void
  onSuccess: () => void
}

export default function AddTenantForm({ onBack, onSuccess }: Props) {
  const { session } = useAuth()

  const [design, setDesign] = useState<CompanyInfoDesign | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [values, setValues] = useState<CompanyFieldValues>({})
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setDesign(await fetchPublishedCompanyFields())
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'دریافت تعاریف ناموفق بود.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  // Only the INITIAL / BOTH published definitions are shown in the create form.
  const initialDefinitions = (design?.definitions ?? []).filter(
    (f) => f.section === 'INITIAL' || f.section === 'BOTH'
  )

  const defByKey = (key: string) => initialDefinitions.find((d) => d.key === key)
  const valByKey = (key: string) => {
    const def = defByKey(key)
    return def ? (values[def.id] ?? '') : ''
  }

  const handleSubmit = async () => {
    const typeDef = defByKey('legal_person_type')
    const nameDef = defByKey('company_display_name')

    // If definitions are missing, never fabricate the form.
    if (!design || !typeDef || !nameDef) {
      toast.error('پیکربندی فرم ایجاد شرکت در دسترس نیست.')
      return
    }

    const entityRaw = valByKey('legal_person_type')
    const name = valByKey('company_display_name')
    const nationalId = valByKey('national_identifier')

    if (!name.trim()) return toast.error('نام شرکت یا کسبوکار الزامی است.')
    if (!entityRaw) return toast.error('لطفاً نوع شخصیت را انتخاب کنید.')
    const entityType = entityRaw === 'legal_entity' ? 'حقوقی' : entityRaw === 'natural_person' ? 'حقیقی' : ''
    if (!entityType) return toast.error('نوع شخصیت نامعتبر است.')

    if (!session?.user?.id) {
      toast.error('خطا در احراز هویت. لطفاً دوباره وارد شوید.')
      return
    }

    setSubmitting(true)

    try {
      let tenantId: string | undefined
      if (!isSupabaseConfigured) {
        const data = await createTenant({
          name: name.trim(),
          entity_type: entityType,
          national_id: nationalId.trim() || undefined,
          created_by: session.user.id,
        })
        tenantId = data?.id
      } else {
        const { data, error } = await supabase.rpc('create_tenant_with_owner', {
          p_name: name.trim(),
          p_entity_type: entityType,
          p_national_id: nationalId.trim() || undefined,
        })
        if (error) throw error
        tenantId = data?.id
      }

      if (!tenantId) throw new Error('ایجاد شرکت ناموفق بود.')

      // Persist every entered field value keyed to the new company (mirrors the
      // same field definitions used by the designer — values stay in Supabase).
      const entries = initialDefinitions
        .filter((d) => values[d.id] !== undefined && values[d.id]?.trim() !== '')
        .map((d) => ({ field_id: d.id, value: values[d.id]! }))
      if (entries.length > 0 && isSupabaseConfigured) {
        await upsertCompanyFieldValues(tenantId, entries)
      }

      toast.success('شرکت با موفقیت ایجاد شد.')
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در ایجاد شرکت.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6" style={{ background: '#0a0c0b' }}>
        <Loader2 className="h-7 w-7 animate-spin text-[#7C6CF0]" />
        <span className="text-sm text-zinc-400">در حال بارگذاری فرم ایجاد شرکت از پایگاه داده...</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6" style={{ background: '#0a0c0b' }}>
      <header className="flex items-center gap-3 px-6 py-4 rounded-xl border border-zinc-800 mb-8" style={{ background: '#141615' }}>
        <button onClick={onBack} className="text-zinc-400 hover:text-zinc-100 transition-colors" aria-label="بازگشت"><ArrowRight className="w-5 h-5" /></button>
        <div className="flex items-center gap-2"><Building2 className="w-5 h-5 text-[#7C6CF0]" /><span className="text-zinc-100 font-semibold">افزودن شرکت جدید</span></div>
      </header>

      {/* Config error → never show a fabricated form */}
      {loadError ? (
        <div className="max-w-xl mx-auto rounded-2xl border border-red-800/60 bg-red-950/20 p-8 text-center">
          <TriangleAlert className="mx-auto h-8 w-8 text-red-400" />
          <p className="mt-3 text-sm font-bold text-red-300">دریافت تعاریف ناموفق بود</p>
          <p className="mt-2 text-xs leading-6 text-red-200/80">{loadError}</p>
          <Button size="sm" onClick={() => void load()} className="mt-4 gap-2 text-xs bg-[#7C6CF0] hover:bg-[#6a5ae0] text-white">تلاش دوباره</Button>
        </div>
      ) : !design || initialDefinitions.length === 0 ? (
        <div className="max-w-xl mx-auto rounded-2xl border border-amber-800/60 bg-amber-950/20 p-8 text-center">
          <TriangleAlert className="mx-auto h-8 w-8 text-amber-400" />
          <p className="mt-3 text-sm font-bold text-amber-200">پیکربندی فرم ایجاد شرکت در دسترس نیست</p>
          <p className="mt-2 text-xs leading-6 text-amber-200/80">تعریفی منتشرشده برای فیلدهای اولیه شرکت در پایگاه داده ثبت نشده است. لطفاً از بخش «طراحی اطلاعات شرکت» در ادمین پلتفرم، تعاریف را تعریف و منتشر کنید.</p>
          <Button size="sm" variant="outline" onClick={() => void load()} className="mt-4 gap-2 text-xs border-zinc-700 text-zinc-300">تلاش دوباره</Button>
        </div>
      ) : (
        <div className="max-w-xl mx-auto rounded-2xl border border-zinc-800 p-8" style={{ background: '#141615' }}>
          <div className="mb-6">
            <h2 className="text-lg font-bold text-zinc-50">مشخصات اولیه شرکت</h2>
            <p className="mt-1 text-xs leading-5 text-zinc-400">فیلدهای زیر از تعاریف منتشرشده در پایگاه داده بارگذاری شده‌اند.</p>
          </div>

          <CompanyDynamicFields
            definitions={initialDefinitions}
            options={design.options}
            selectionLists={design.selectionLists}
            selectionOptions={design.selectionOptions}
            values={values}
            onChange={(fieldId, v) => setValues((prev) => ({ ...prev, [fieldId]: v }))}
            columns={1}
          />

          <div className="flex gap-3 pt-6">
            <Button type="button" disabled={submitting} onClick={handleSubmit}
              className="flex-1 h-11 gap-2 bg-[#7C6CF0] hover:bg-[#6a5ae0] text-white font-semibold">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
              ایجاد فضای شرکت
            </Button>
            <Button type="button" variant="outline" onClick={onBack} disabled={submitting}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 h-11">انصراف</Button>
          </div>
        </div>
      )}
    </div>
  )
}