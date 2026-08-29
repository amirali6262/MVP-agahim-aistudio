import { useCallback, useEffect, useMemo, useState } from 'react'

import { toast } from 'sonner'
import {
  AlertTriangle, ArrowLeft, ArrowRight, Calendar, CheckCircle2, Eye, FolderKanban, Loader2,
  Lock, Pencil, Plus, Save, Send, Trash2, TriangleAlert,
} from 'lucide-react'
import { Button } from '../../lib/shadcn/button'
import { Input } from '../../lib/shadcn/input'
import { Label } from '../../lib/shadcn/label'
import { Switch } from '../../lib/shadcn/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../lib/shadcn/select'
import {
  fetchCompanyInfoDesign, saveCompanyFieldDefinition, setCompanyFieldDefinitionActive,
  deleteCompanyFieldDefinition, saveCompanyFieldOptions, saveCompanyWizardStep,
  setCompanyWizardStepActive, deleteCompanyWizardStep, publishCompanyInfoDesign,
  type CompanyFieldDefinition, type CompanyFieldOption, type CompanyFieldType, type CompanyFieldSection,
  type CompanyWidth, type CompanyWizardStep, type CompanyInfoDesign,
} from '../../lib/companyInfo'
import OptionSourcePicker from '../../components/selectionLists/OptionSourcePicker'
import FullScreenDialog from '../../components/FullScreenDialog'
import ConditionBuilder from '../../components/condition/ConditionBuilder'
import { emptyGroup, type ConditionFieldDescriptor, type ConditionRuleModel, type ConditionRow } from '../../lib/conditionSchema'

const BRAND = '#5B4DE6'
const FIELD_TYPES: Array<{ value: CompanyFieldType; label: string }> = [
  { value: 'TEXT', label: 'متن کوتاه' },
  { value: 'LONG_TEXT', label: 'متن بلند' },
  { value: 'SELECT', label: 'انتخاب تکی' },
  { value: 'MULTI_SELECT', label: 'انتخاب چندگانه' },
  { value: 'BOOLEAN', label: 'بله/خیر' },
  { value: 'NUMBER', label: 'عدد' },
  { value: 'DATE', label: 'تاریخ' },
  { value: 'NATIONAL_ID', label: 'شناسه ملی/کد ملی' },
]

export default function CompanyInfoDesignerPage() {
  const [design, setDesign] = useState<CompanyInfoDesign>({ definitions: [], options: [], steps: [], selectionLists: [], selectionOptions: [] })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tab, setTab] = useState<CompanyFieldSection>('INITIAL')
  const [publishing, setPublishing] = useState(false)

  // Field modal state
  const [fieldModalOpen, setFieldModalOpen] = useState(false)
  const [editingField, setEditingField] = useState<CompanyFieldDefinition | null>(null)
  const [fieldForm, setFieldForm] = useState<Record<string, any>>({})
  const [optionRows, setOptionRows] = useState<Array<{ id?: string; value: string; label: string }>>([])
  const [condTestValues, setCondTestValues] = useState<Record<string, string>>({})

  const conditionFieldDescriptors: ConditionFieldDescriptor[] = useMemo(() =>
    design.definitions.filter((f) => f.status === 'PUBLISHED' || f.is_active).map((f) => ({
      key: f.key,
      title: f.title,
      type: f.field_type as ConditionFieldDescriptor['type'],
      section: f.section === 'BOTH' ? 'INITIAL' : f.section,
      stepTitle: (design.steps.find((s) => s.id === f.wizard_step_id)?.title) ?? undefined,
    })),
    [design]
  )

  // Wizard step modal state
  const [stepModalOpen, setStepModalOpen] = useState(false)
  const [editingStep, setEditingStep] = useState<CompanyWizardStep | null>(null)
  const [stepForm, setStepForm] = useState<Record<string, any>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setDesign(await fetchCompanyInfoDesign())
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'دریافت طراحی اطلاعات شرکت ناموفق بود.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const optionsByField = useMemo(() => {
    const map: Record<string, CompanyFieldOption[]> = {}
    design.options.forEach((o) => { (map[o.field_id] = map[o.field_id] ?? []).push(o) })
    return map
  }, [design.options])

  const fieldsForTab = design.definitions.filter((f) => f.section === tab || f.section === 'BOTH')

  const openAddField = () => {
    setEditingField(null)
    setFieldForm({ title: '', key: '', field_type: 'TEXT', help_text: '', required: true, section: tab, wizard_step_id: null, sort_order: 1, width: 'FULL', used_in_eligibility: false, is_active: true, selection_list_id: null, condition_model: null })
    setOptionRows([{ value: '', label: '' }])
    setFieldModalOpen(true)
  }

  const openEditField = (field: CompanyFieldDefinition) => {
    setEditingField(field)
    setFieldForm({
      title: field.title, key: field.key, field_type: field.field_type, help_text: field.help_text ?? '',
      required: field.required, section: field.section, wizard_step_id: field.wizard_step_id, sort_order: field.sort_order,
      width: field.width, used_in_eligibility: field.used_in_eligibility, is_active: field.is_active,
      selection_list_id: field.selection_list_id ?? null,
      condition_model: field.condition_model ?? null,
    })
    setOptionRows((optionsByField[field.id] ?? []).map((o) => ({ id: o.id, value: o.value, label: o.label })))
    setFieldModalOpen(true)
  }

  const keyLocked = !!editingField && (editingField.is_system || (design.definitions.some((f) => f.key === fieldForm.key && f.id !== editingField.id)))

  const saveField = async () => {
    if (!fieldForm.title?.trim()) return toast.error('عنوان فیلد الزامی است.')
    if (!fieldForm.key?.trim()) return toast.error('کلید سیستمی فیلد الزامی است.')
    if (editingField?.is_system && (fieldForm.field_type !== editingField.field_type || !fieldForm.required)) {
      return toast.error('فیلدهای سیستمی قابل غیرفعال/اختیاری‌کردن نیستند.')
    }
    const type = fieldForm.field_type as CompanyFieldType
    const linkedListId = (fieldForm.selection_list_id as string | null) ?? null
    if (type === 'SELECT' || type === 'MULTI_SELECT' && !linkedListId) {
      const valid = optionRows.filter((r) => r.value.trim() && r.label.trim())
      if (valid.length === 0) return toast.error('برای فیلد انتخابی، یا گزینه تعریف کنید یا به یک فهرست انتخابی منتشرشده متصل شوید.')
    }
    try {
      const saved = await saveCompanyFieldDefinition({
        ...(editingField ? { id: editingField.id } : {}),
        key: fieldForm.key.trim(),
        title: fieldForm.title.trim(),
        field_type: type,
        help_text: fieldForm.help_text?.trim() || null,
        required: fieldForm.required !== false,
        section: fieldForm.section,
        wizard_step_id: fieldForm.wizard_step_id || null,
        sort_order: Number(fieldForm.sort_order ?? 1),
        width: fieldForm.width as CompanyWidth,
        used_in_eligibility: !!fieldForm.used_in_eligibility,
        is_active: fieldForm.is_active !== false,
        is_system: editingField?.is_system ?? false,
        is_deletable: editingField?.is_deletable ?? true,
        selection_list_id: linkedListId,
        condition_model: (fieldForm.condition_model as ConditionRuleModel | null) ?? null,
      })
      if ((type === 'SELECT' || type === 'MULTI_SELECT') && !linkedListId) {
        await saveCompanyFieldOptions(saved!.id, optionRows.filter((r) => r.value.trim() && r.label.trim()).map((r, i) => ({ ...(r.id ? { id: r.id } : {}), value: r.value.trim(), label: r.label.trim(), sort_order: i + 1 })))
      }
      toast.success(editingField ? 'فیلد به‌روزرسانی شد.' : 'فیلد افزوده شد.')
      setFieldModalOpen(false)
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در ذخیره فیلد.')
    }
  }

  const openAddStep = () => {
    setEditingStep(null)
    setStepForm({ title: '', description: '', icon: 'list', sort_order: design.steps.length + 1, columns: 1, is_active: true })
    setStepModalOpen(true)
  }

  const openEditStep = (step: CompanyWizardStep) => {
    setEditingStep(step)
    setStepForm({ title: step.title, description: step.description ?? '', icon: step.icon ?? 'list', sort_order: step.sort_order, columns: step.columns, is_active: step.is_active })
    setStepModalOpen(true)
  }

  const saveStep = async () => {
    if (!stepForm.title?.trim()) return toast.error('عنوان مرحله الزامی است.')
    try {
      await saveCompanyWizardStep({
        ...(editingStep ? { id: editingStep.id } : {}),
        title: stepForm.title.trim(),
        description: stepForm.description?.trim() || null,
        icon: stepForm.icon || null,
        sort_order: Number(stepForm.sort_order ?? 1),
        columns: Number(stepForm.columns) === 2 ? 2 : 1,
        is_active: stepForm.is_active !== false,
      })
      toast.success(editingStep ? 'مرحله به‌روزرسانی شد.' : 'مرحله افزوده شد.')
      setStepModalOpen(false)
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در ذخیره مرحله.')
    }
  }

  const publish = async () => {
    // Validation before publish
    const hasType = design.definitions.some((f) => f.status === 'PUBLISHED' && f.key === 'legal_person_type')
    const hasName = design.definitions.some((f) => f.status === 'PUBLISHED' && f.key === 'company_display_name')
    const keys = design.definitions.map((f) => f.key.toLowerCase())
    const dupKeys = keys.some((k, i) => keys.indexOf(k) !== i)
    const emptyActiveStep = design.steps.some((s) => s.status !== 'PUBLISHED' && s.is_active)
    if (dupKeys) return toast.error('کلیدهای یکتای فیلد را بررسی کنید (کلید تکراری وجود دارد).')
    if (!hasType || !hasName) {
      return toast.error('قبل از انتشار، فیلدهای «نوع شخصیت» و «نام شرکت یا کسب‌وکار» باید منتشرشده باشند.')
    }
    if (emptyActiveStep) return toast.error('یک مرحله فعال بدون ذخیره کامل وجود دارد؛ قبل از انتشار آن را تکمیل یا غیرفعال کنید.')
    setPublishing(true)
    try {
      const count = await publishCompanyInfoDesign()
      toast.success(`تنظیمات منتشر شد (${count.toLocaleString('fa-IR')} تعریف).`)
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'انتشار ناموفق بود.')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div dir="rtl" className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white px-5 py-5 shadow-sm dark:border-zinc-800 dark:bg-[#161618] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white" style={{ background: BRAND }}>
            <FolderKanban className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-base font-extrabold text-zinc-900 dark:text-zinc-50">طراحی اطلاعات شرکت</h1>
            <p className="mt-1 max-w-2xl text-[11px] leading-6 text-zinc-500 dark:text-zinc-400">
              فیلدهای اطلاعات اولیه و تکمیلی شرکت، گزینه‌ها و مراحل ویزارد تعریف و منتشر می‌شود. فقط نسخه منتشرشده در فضای کاری شرکت نمایش داده می‌شود.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} className="gap-1.5 border-zinc-300 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"><Save className="h-3.5 w-3.5" />بارگذاری</Button>
          <Button size="sm" onClick={() => void publish()} disabled={publishing} className="gap-1.5 text-xs font-bold text-white" style={{ background: BRAND }}>
            {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            انتشار تعاریف
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-white py-16 text-xs text-zinc-400 dark:border-zinc-800 dark:bg-[#161618]">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: BRAND }} /> در حال بارگذاری تعاریف از Supabase...
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-10 text-center dark:border-red-900/60 dark:bg-red-950/30">
          <TriangleAlert className="h-8 w-8 text-red-500" />
          <p className="text-sm font-bold text-red-700 dark:text-red-300">دریافت تعاریف ناموفق بود</p>
          <p className="max-w-md text-xs leading-6 text-red-600/90 dark:text-red-300/80">{loadError}</p>
          <Button size="sm" onClick={() => void load()} className="gap-2 text-xs text-white" style={{ background: BRAND }}>تلاش دوباره</Button>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5 dark:border-zinc-800 dark:bg-[#161618]">
            {(['INITIAL', 'COMPLEMENTARY'] as Array<CompanyFieldSection>).map((key) => (
              <button key={key} onClick={() => setTab(key)} className={`px-4 py-2 text-xs font-bold rounded-md transition ${tab === key ? 'text-white' : 'text-zinc-500 hover:text-zinc-700'}`} style={tab === key ? { background: BRAND } : undefined}>
                {key === 'INITIAL' ? 'اطلاعات اولیه' : 'اطلاعات تکمیلی'}
              </button>
            ))}
          </div>

          {/* Fields table */}
          <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#161618]">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
              <h2 className="text-sm font-extrabold text-zinc-900 dark:text-zinc-50">فیلدها</h2>
              <Button size="sm" onClick={openAddField} className="gap-1.5 text-xs font-bold text-white" style={{ background: BRAND }}><Plus className="h-3.5 w-3.5" />افزودن فیلد</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse text-right">
                <thead>
                  <tr className="border-b border-zinc-100 text-[11px] text-zinc-400 dark:border-zinc-800">
                    <th className="px-5 py-3 font-bold">عنوان</th><th className="px-3 py-3 font-bold">کلید</th>
                    <th className="px-3 py-3 font-bold">نوع</th><th className="px-3 py-3 font-bold">بخش</th>
                    <th className="px-3 py-3 font-bold">الزامی</th><th className="px-3 py-3 font-bold">عرض</th>
                    <th className="px-3 py-3 font-bold">وضعیت</th><th className="px-3 py-3 font-bold">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {fieldsForTab.length === 0 ? (
                    <tr><td colSpan={8} className="px-5 py-12 text-center text-xs text-zinc-400">فیلدی برای این بخش تعریف نشده است.</td></tr>
                  ) : fieldsForTab.map((field) => {
                    const published = field.status === 'PUBLISHED'
                    return (
                      <tr key={field.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/60 dark:border-zinc-800 dark:hover:bg-zinc-800/20">
                        <td className="px-5 py-3">
                          <p className="text-xs font-bold text-zinc-800 dark:text-zinc-100">{field.title}</p>
                          <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-zinc-400">{field.is_system && <Lock className="h-2.5 w-2.5" />}{field.required ? 'اجباری' : 'اختیاری'}</p>
                        </td>
                        <td className="px-3 py-3"><span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] dark:bg-zinc-800">{field.key}</span></td>
                        <td className="px-3 py-3 text-[11px] text-zinc-600 dark:text-zinc-300">{FIELD_TYPES.find((t) => t.value === field.field_type)?.label ?? field.field_type}</td>
                        <td className="px-3 py-3 text-[11px] text-zinc-600 dark:text-zinc-300">{field.section === 'BOTH' ? 'هر دو' : field.section === 'INITIAL' ? 'اولیه' : 'تکمیلی'}</td>
                        <td className="px-3 py-3 text-[11px]">{field.required ? <span className="font-bold text-red-500">*</span> : <span className="text-zinc-400">—</span>}</td>
                        <td className="px-3 py-3 text-[11px] text-zinc-600 dark:text-zinc-300">{field.width === 'FULL' ? 'تمام عرض' : 'نصف عرض'}</td>
                        <td className="px-3 py-3">
                          <span className={`inline-block rounded-full border px-2 py-0.5 text-[9px] font-bold ${published ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/20 dark:text-emerald-300' : 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/20 dark:text-amber-200'}`}>
                            {published ? 'منتشرشده' : field.is_active ? 'پیش‌نویس' : 'غیرفعال'}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400" onClick={() => openEditField(field)} title="ویرایش"><Pencil className="h-4 w-4" /></Button>
                            {!field.is_system && (
                              <>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-zinc-500 hover:bg-emerald-50 hover:text-emerald-600 dark:text-zinc-400" onClick={() => void setCompanyFieldDefinitionActive(field.id, !field.is_active).then(() => load()).catch((e) => toast.error(e.message))} title={field.is_active ? 'غیرفعال کردن' : 'فعال کردن'}><CheckCircle2 className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:text-zinc-400" onClick={() => void deleteCompanyFieldDefinition(field.id).then(() => { toast.success('فیلد حذف شد.'); load() }).catch((e) => toast.error(e.message))} title="حذف"><Trash2 className="h-4 w-4" /></Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Wizard steps */}
          <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#161618]">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
              <h2 className="text-sm font-extrabold text-zinc-900 dark:text-zinc-50">مراحل ویزارد تکمیلی</h2>
              <Button size="sm" variant="outline" onClick={openAddStep} className="gap-1.5 border-zinc-300 text-xs font-bold text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"><Plus className="h-3.5 w-3.5" />افزودن مرحله</Button>
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {design.steps.length === 0 ? (
                <div className="px-5 py-10 text-center text-xs text-zinc-400">مرحله ویزاردی تعریف نشده است.</div>
              ) : design.steps.map((step) => (
                <div key={step.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: BRAND }}>{step.sort_order}</span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-zinc-800 dark:text-zinc-100">{step.title}</p>
                      <p className="mt-0.5 text-[10px] text-zinc-400">{step.columns === 2 ? 'دو ستونه' : 'یک ستونه'} · ترتیب {step.sort_order} · {step.status === 'PUBLISHED' ? 'منتشرشده' : step.is_active ? 'پیش‌نویس' : 'غیرفعال'}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400" onClick={() => openEditStep(step)} title="ویرایش"><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-zinc-500 hover:bg-emerald-50 hover:text-emerald-600 dark:text-zinc-400" onClick={() => void setCompanyWizardStepActive(step.id, !step.is_active).then(() => load()).catch((e) => toast.error(e.message))} title={step.is_active ? 'غیرفعال' : 'فعال'}><CheckCircle2 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:text-zinc-400" onClick={() => void deleteCompanyWizardStep(step.id).then(() => { toast.success('مرحله حذف شد.'); load() }).catch((e) => toast.error(e.message))} title="حذف"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* Field modal — full page */}
      <FullScreenDialog
        open={fieldModalOpen}
        title={editingField ? 'ویرایش فیلد' : 'افزودن فیلد'}
        subtitle="تعریفی که از Supabase می‌آید؛ پس از انتشار در فضای کاری نمایش داده می‌شود."
        onBack={() => setFieldModalOpen(false)}
        footer={(
          <div className="mx-auto flex max-w-3xl items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setFieldModalOpen(false)} className="border-zinc-300 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">انصراف</Button>
            <Button size="sm" onClick={() => void saveField()} className="gap-1.5 text-xs font-bold text-white" style={{ background: BRAND }}><Save className="h-3.5 w-3.5" />ذخیره فیلد</Button>
          </div>
        )}
      >
        <div className="mx-auto max-w-3xl space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#161618]">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="عنوان نمایشی *"><Input value={fieldForm.title ?? ''} onChange={(e) => setFieldForm({ ...fieldForm, title: e.target.value })} className="h-10" /></Field>
                <Field label="کلید سیستمی *">
                  <Input value={fieldForm.key ?? ''} disabled={keyLocked} onChange={(e) => setFieldForm({ ...fieldForm, key: e.target.value })} className="h-10" />
                  {keyLocked && <p className="text-[9px] text-zinc-400">کلید سیستم قابل تغییر نیست.</p>}
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="نوع فیلد">
                  <Select value={fieldForm.field_type} onValueChange={(v) => setFieldForm({ ...fieldForm, field_type: v })} disabled={!!editingField?.is_system}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>{FIELD_TYPES.map((t) => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="بخش نمایش">
                  <Select value={fieldForm.section} onValueChange={(v) => setFieldForm({ ...fieldForm, section: v })}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INITIAL" className="text-xs">اطلاعات اولیه</SelectItem>
                      <SelectItem value="COMPLEMENTARY" className="text-xs">اطلاعات تکمیلی</SelectItem>
                      <SelectItem value="BOTH" className="text-xs">هر دو بخش</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="مرحله ویزارد">
                  <Select value={fieldForm.wizard_step_id ?? ''} onValueChange={(v) => setFieldForm({ ...fieldForm, wizard_step_id: v || null })}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="—"></SelectValue></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="" className="text-xs">ندارد</SelectItem>
                      {design.steps.map((s) => <SelectItem key={s.id} value={s.id} className="text-xs">{s.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="عرض">
                  <Select value={fieldForm.width} onValueChange={(v) => setFieldForm({ ...fieldForm, width: v })}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="FULL" className="text-xs">تمام عرض</SelectItem><SelectItem value="HALF" className="text-xs">نصف عرض</SelectItem></SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="متن راهنما"><Input value={fieldForm.help_text ?? ''} onChange={(e) => setFieldForm({ ...fieldForm, help_text: e.target.value })} className="h-10" placeholder="راهنمایی برای پر کردن این فیلد" /></Field>
              <div className="grid gap-3 sm:grid-cols-3">
                <ToggleField label="الزامی" checked={fieldForm.required !== false} disabled={!!editingField?.is_system} onChange={(v) => setFieldForm({ ...fieldForm, required: v })} />
                <ToggleField label="فعال" checked={fieldForm.is_active !== false} disabled={!!editingField?.is_system} onChange={(v) => setFieldForm({ ...fieldForm, is_active: v })} />
                <ToggleField label="استفاده در تشخیص تعهدات" checked={!!fieldForm.used_in_eligibility} onChange={(v) => setFieldForm({ ...fieldForm, used_in_eligibility: v })} />
              </div>
              {(fieldForm.field_type === 'SELECT' || fieldForm.field_type === 'MULTI_SELECT') && (
                <div className="space-y-4">
                  <OptionSourcePicker
                    value={(fieldForm.selection_list_id as string | null) ?? null}
                    onChange={(id) => setFieldForm({ ...fieldForm, selection_list_id: id })}
                    contextLabel="منبع گزینه‌ها"
                  />
                  <div className="space-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-zinc-700 dark:text-zinc-200">گزینه‌های ردیفی (در صورت عدم اتصال به فهرست)</Label>
                    </div>
                    {optionRows.map((row, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input value={row.value} onChange={(e) => { const next = [...optionRows]; next[index] = { ...next[index], value: e.target.value }; setOptionRows(next) }} placeholder="مقدار ثابت" dir="ltr" className="h-9" />
                        <Input value={row.label} onChange={(e) => { const next = [...optionRows]; next[index] = { ...next[index], label: e.target.value }; setOptionRows(next) }} placeholder="عنوان نمایشی" className="h-9" />
                        <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-red-500" onClick={() => setOptionRows(optionRows.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setOptionRows([...optionRows, { value: '', label: '' }])}><Plus className="h-3.5 w-3.5" />افزودن گزینه</Button>
                  </div>
                </div>
              )}
              <div className="space-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <p className="text-[11px] font-bold text-zinc-700 dark:text-zinc-200">شرط نمایش / شمول (اختیاری — ConditionBuilder مشترک)</p>
                <ConditionBuilder
                  model={(fieldForm.condition_model as ConditionRuleModel) || { version: 1, groups: [emptyGroup(fieldForm.key ?? 'field')] }}
                  onChange={(m) => setFieldForm({ ...fieldForm, condition_model: m })}
                  fields={conditionFieldDescriptors}
                  selectionLists={design.selectionLists}
                  selectionOptions={design.selectionOptions}
                  sourceKey={fieldForm.key ?? 'field'}
                  testValues={condTestValues}
                  onTestValuesChange={setCondTestValues}
                />
              </div>
        </div>
      </FullScreenDialog>

      {/* Wizard step modal — full page */}
      <FullScreenDialog
        open={stepModalOpen}
        title={editingStep ? 'ویرایش مرحله' : 'افزودن مرحله'}
        subtitle="مرحله‌ای از ویزارد اطلاعات شرکت که فیلدها در آن نمایش داده می‌شوند."
        onBack={() => setStepModalOpen(false)}
        footer={(
          <div className="mx-auto flex max-w-2xl items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setStepModalOpen(false)} className="border-zinc-300 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">انصراف</Button>
            <Button size="sm" onClick={() => void saveStep()} className="gap-1.5 text-xs font-bold text-white" style={{ background: BRAND }}><Save className="h-3.5 w-3.5" />ذخیره مرحله</Button>
          </div>
        )}
      >
        <div className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#161618]">
              <Field label="عنوان مرحله *"><Input value={stepForm.title ?? ''} onChange={(e) => setStepForm({ ...stepForm, title: e.target.value })} className="h-10" /></Field>
              <Field label="توضیح"><Input value={stepForm.description ?? ''} onChange={(e) => setStepForm({ ...stepForm, description: e.target.value })} className="h-10" /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="ترتیب"><Input type="number" value={stepForm.sort_order ?? 1} onChange={(e) => setStepForm({ ...stepForm, sort_order: e.target.value })} className="h-10" /></Field>
                <Field label="ستون‌ها (دسکتاپ)">
                  <Select value={String(stepForm.columns ?? 1)} onValueChange={(v) => setStepForm({ ...stepForm, columns: v })}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="1" className="text-xs">یک ستونه</SelectItem><SelectItem value="2" className="text-xs">دو ستونه</SelectItem></SelectContent>
                  </Select>
                </Field>
              </div>
              <ToggleField label="فعال" checked={stepForm.is_active !== false} onChange={(v) => setStepForm({ ...stepForm, is_active: v })} />
        </div>
      </FullScreenDialog>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs text-zinc-700 dark:text-zinc-200">{label}</Label>{children}</div>
}

function ToggleField({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2.5 dark:border-zinc-700">
      <Label className="text-xs text-zinc-700 dark:text-zinc-200">{label}</Label>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  )
}