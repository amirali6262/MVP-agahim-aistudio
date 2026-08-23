import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { ArrowRight, Plus, Trash2, Save, GripVertical, SlidersHorizontal, Settings, X, CheckCircle2, FileText, Calendar, UploadCloud, CheckSquare, Sparkles, PlusCircle, Scale, Layers } from 'lucide-react'
import { Button } from '../../../lib/shadcn/button'
import { Input } from '../../../lib/shadcn/input'
import { Label } from '../../../lib/shadcn/label'
import { isSupabaseConfigured } from '../../../lib/supabase'
import { mockObligationsDb } from '../../../lib/mockDb'
import type { Obligation, WorkflowStep, WorkflowStepField } from '../../../lib/supabase'
import { cn } from '../../../lib/shadcn/utils'
import DeleteGuardModal from '../../../components/DeleteGuardModal'

interface StepRow extends WorkflowStep {
  isNew?: boolean
}

function uuid(): string {
  return crypto.randomUUID()
}

interface Props {
  obligation: Obligation
  onBack: () => void
  onSaved: () => void
}

export default function WorkflowStepsManager({ obligation, onBack, onSaved }: Props) {
  const [steps, setSteps] = useState<StepRow[]>([])
  const [submitting, setSubmitting] = useState(false)

  // Step Fields Modal State
  const [activeStepForFields, setActiveStepForFields] = useState<StepRow | null>(null)
  const [editingFields, setEditingFields] = useState<WorkflowStepField[]>([])

  useEffect(() => {
    const sorted = [...obligation.workflow_steps].sort((a, b) => a.order - b.order)
    setSteps(sorted)
  }, [obligation])

  // ── Step Mutations ──────────────────────────────────────────────────────────
  const addStep = () => {
    const nextOrder = steps.length > 0 ? Math.max(...steps.map((s) => s.order)) + 1 : 1
    setSteps((prev) => [
      ...prev,
      { id: uuid(), title: '', order: nextOrder, fields: [], isNew: true },
    ])
  }

  const updateStep = (
    id: string,
    field: keyof Pick<StepRow, 'title' | 'order'>,
    value: string | number
  ) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)))
  }

  // Manage Fields Modal Handlers
  const handleOpenFieldsModal = (step: StepRow) => {
    setActiveStepForFields(step)
    setEditingFields(step.fields ? [...step.fields] : [])
  }

  const handleAddFieldToStep = () => {
    const newF: WorkflowStepField = {
      id: 'f-' + uuid().slice(0, 8),
      label: 'عنوان فیلد جدید',
      key: 'field_' + (editingFields.length + 1),
      type: 'text',
      required: false,
      placeholder: '',
    }
    setEditingFields((prev) => [...prev, newF])
  }

  // Add multiple fields at once
  const handleAddMultipleFieldsToStep = (count: number = 3) => {
    const newFields: WorkflowStepField[] = Array.from({ length: count }, (_, i) => {
      const idx = editingFields.length + i + 1
      return {
        id: 'f-' + uuid().slice(0, 8),
        label: `فیلد ورودی شماره ${idx}`,
        key: `field_${idx}`,
        type: 'text',
        required: false,
        placeholder: '',
      }
    })
    setEditingFields((prev) => [...prev, ...newFields])
    toast.success(`${count} فیلد جدید همزمان اضافه شد`)
  }

  // Add predefined standard field packs
  const handleAddStandardFieldPack = (packType: 'assessment' | 'ruling' | 'general') => {
    let presetPack: WorkflowStepField[] = []
    if (packType === 'assessment') {
      presetPack = [
        {
          id: 'f-' + uuid().slice(0, 8),
          label: 'شماره برگ تشخیص / ابلاغیه',
          key: 'notice_number',
          type: 'text',
          required: true,
          placeholder: 'مثال: ۱۴۰۴/ب/۹۸۱۲',
        },
        {
          id: 'f-' + uuid().slice(0, 8),
          label: 'تاریخ ابلاغ قانونی (شمسی)',
          key: 'notice_date',
          type: 'date',
          required: true,
        },
        {
          id: 'f-' + uuid().slice(0, 8),
          label: 'مبلغ مالیات مورد مطالبه (ریال)',
          key: 'tax_amount_claimed',
          type: 'number',
          required: false,
        },
        {
          id: 'f-' + uuid().slice(0, 8),
          label: 'تصویر برگ ابلاغیه / فایل پیوست',
          key: 'notice_document_file',
          type: 'file',
          required: false,
        },
      ]
    } else if (packType === 'ruling') {
      presetPack = [
        {
          id: 'f-' + uuid().slice(0, 8),
          label: 'شماره دادنامه / رای صادره',
          key: 'ruling_number',
          type: 'text',
          required: true,
        },
        {
          id: 'f-' + uuid().slice(0, 8),
          label: 'تاریخ صدور / ابلاغ رای',
          key: 'ruling_date',
          type: 'date',
          required: true,
        },
        {
          id: 'f-' + uuid().slice(0, 8),
          label: 'نتیجه رای هیأت / مرجع',
          key: 'ruling_result_status',
          type: 'select',
          required: true,
          options: ['تعدیل مالیات', 'رد اعتراض مودی', 'نقض و تجدید رسیدگی', 'قرار کارشناسی مجدد'],
        },
        {
          id: 'f-' + uuid().slice(0, 8),
          label: 'پیوست فایل دادنامه و مدارک',
          key: 'ruling_file',
          type: 'file',
          required: false,
        },
      ]
    } else {
      presetPack = [
        {
          id: 'f-' + uuid().slice(0, 8),
          label: 'شرح و متن دفاعیه/درخواست',
          key: 'defense_text',
          type: 'text',
          required: true,
        },
        {
          id: 'f-' + uuid().slice(0, 8),
          label: 'تاریخ اقدام یا ثبت',
          key: 'submission_date',
          type: 'date',
          required: false,
        },
        {
          id: 'f-' + uuid().slice(0, 8),
          label: 'فایل لایحه اعتراضیه / ضمائم',
          key: 'defense_bill_file',
          type: 'file',
          required: false,
        },
      ]
    }
    setEditingFields((prev) => [...prev, ...presetPack])
    toast.success(`بسته فیلدهای استاندارد (${presetPack.length} فیلد) اضافه شد`)
  }

  const handleUpdateField = (
    fId: string,
    key: keyof WorkflowStepField,
    val: any
  ) => {
    setEditingFields((prev) =>
      prev.map((f) => (f.id === fId ? { ...f, [key]: val } : f))
    )
  }

  const handleDeleteField = (fId: string) => {
    setEditingFields((prev) => prev.filter((f) => f.id !== fId))
  }

  const handleSaveFieldsForStep = () => {
    if (!activeStepForFields) return
    for (const f of editingFields) {
      if (!f.label.trim()) {
        toast.error('عنوان همه فیلدها را وارد کنید.')
        return
      }
      if (!f.key.trim()) {
        toast.error('شناسه انگلیسی (Key) همه فیلدها را وارد کنید.')
        return
      }
    }

    setSteps((prev) =>
      prev.map((s) =>
        s.id === activeStepForFields.id ? { ...s, fields: editingFields } : s
      )
    )
    toast.success(`فیلدهای اختصاصی برای گام "${activeStepForFields.title || 'انتخابی'}" ثبت شد.`)
    setActiveStepForFields(null)
  }

  // Delete Guard State
  const [stepToDelete, setStepToDelete] = useState<StepRow | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)

  const handleInitiateDeleteStep = (step: StepRow) => {
    setStepToDelete(step)
    setDeleteModalOpen(true)
  }

  const handleConfirmDeleteStep = () => {
    if (!stepToDelete) return
    setSteps((prev) => prev.filter((s) => s.id !== stepToDelete.id))
    toast.success('گام با موفقیت حذف شد.')
    setDeleteModalOpen(false)
    setStepToDelete(null)
  }

  const moveStep = (id: string, direction: 'up' | 'down') => {
    setSteps((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order)
      const idx = sorted.findIndex((s) => s.id === id)
      if (idx === -1) return prev
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= sorted.length) return prev
      const current = sorted[idx]
      const swap = sorted[swapIdx]
      if (!current || !swap) return prev
      const co = current.order
      const so = swap.order
      return prev.map((s) => {
        if (s.id === current.id) return { ...s, order: so }
        if (s.id === swap.id) return { ...s, order: co }
        return s
      })
    })
  }

  // ── Save ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    for (const step of steps) {
      if (!step.title.trim()) {
        toast.error('عنوان همه مراحل را وارد کنید.')
        return
      }
      if (step.order <= 0) {
        toast.error('ترتیب نمایش باید عدد صحیح مثبت باشد.')
        return
      }
    }

    const clean: WorkflowStep[] = steps
      .map(({ isNew: _n, ...s }) => s)
      .sort((a, b) => a.order - b.order)

    setSubmitting(true)

    if (!isSupabaseConfigured) {
      // Mock path
      const result = mockObligationsDb.update(obligation.id, { workflow_steps: clean })
      if (!result) {
        toast.error('خطا: تکلیف یافت نشد.')
        setSubmitting(false)
        return
      }
      toast.success('مراحل گردش کار و فرم‌های اختصاصی گام‌ها با موفقیت ذخیره شد.')
      setSubmitting(false)
      onSaved()
      return
    }

    // The obligations schema is not part of the current database foundation yet.
    // Fail closed instead of writing to a table that does not exist.
    toast.error('ذخیره گردش کار پس از نصب ماژول تعهدات فعال می‌شود.')
    setSubmitting(false)
  }

  const sortedSteps = [...steps].sort((a, b) => a.order - b.order)

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto" style={{ background: '#0a0c0b' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-10 flex items-center gap-3 px-6 h-16 border-b border-zinc-800"
        style={{ background: '#141615' }}
      >
        <button type="button" onClick={onBack} className="text-zinc-400 hover:text-zinc-100 transition-colors" aria-label="بازگشت">
          <ArrowRight className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-zinc-100 font-bold text-base">مدیریت مراحل گردش کار و فرم‌های اختصاصی</h2>
          <p className="text-zinc-500 text-xs truncate">{obligation.title}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={addStep}
            variant="outline"
            size="sm"
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 gap-2 h-8"
          >
            <Plus className="w-3.5 h-3.5" />
            افزودن گام
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={submitting}
            className="bg-emerald-700 hover:bg-emerald-600 text-white gap-2 h-8 font-bold"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ذخیره...
              </span>
            ) : (
              <><Save className="w-3.5 h-3.5" />ذخیره تغییرات</>
            )}
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Info card */}
        <div className="rounded-xl border border-zinc-800 p-5 mb-6 grid grid-cols-2 sm:grid-cols-4 gap-4" style={{ background: '#141615' }}>
          <div>
            <p className="text-zinc-500 text-xs mb-1">تکلیف</p>
            <p className="text-zinc-200 text-sm font-medium">{obligation.title}</p>
          </div>
          <div>
            <p className="text-zinc-500 text-xs mb-1">دوره تناوب</p>
            <p className="text-zinc-200 text-sm font-medium">{obligation.recurrence}</p>
          </div>
          <div>
            <p className="text-zinc-500 text-xs mb-1">مسئول اجرا</p>
            <p className="text-zinc-200 text-sm font-medium">{obligation.responsible_party}</p>
          </div>
          <div>
            <p className="text-zinc-500 text-xs mb-1">تعداد مراحل</p>
            <p className="text-amber-400 text-sm font-bold font-mono">{steps.length} گام</p>
          </div>
        </div>

        {/* Steps list */}
        <div className="rounded-2xl border border-zinc-800 overflow-hidden mb-6" style={{ background: '#141615' }}>
          {/* Column headers */}
          <div className="grid grid-cols-[36px_1fr_180px_100px_88px_40px] gap-3 px-5 py-3 border-b border-zinc-800 bg-zinc-900/50">
            <span className="text-zinc-500 text-xs">#</span>
            <span className="text-zinc-500 text-xs">عنوان گام</span>
            <span className="text-zinc-500 text-xs text-center">فیلدهای اختصاصی</span>
            <span className="text-zinc-500 text-xs text-center">ترتیب</span>
            <span className="text-zinc-500 text-xs text-center">جابجایی</span>
            <span />
          </div>

          {sortedSteps.length === 0 ? (
            <div className="py-12 flex flex-col items-center gap-3 text-center">
              <GripVertical className="w-10 h-10 text-zinc-700" />
              <p className="text-zinc-500 text-sm">هنوز گامی تعریف نشده است.</p>
              <Button onClick={addStep} className="bg-emerald-700 hover:bg-emerald-600 text-white gap-2 mt-1" size="sm">
                <Plus className="w-3.5 h-3.5" />افزودن اولین گام
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {sortedSteps.map((step, idx) => {
                const fieldsCount = step.fields?.length || 0
                return (
                  <div
                    key={step.id}
                    className={cn(
                      'grid grid-cols-[36px_1fr_180px_100px_88px_40px] gap-3 items-center px-5 py-3.5',
                      step.isNew && 'bg-emerald-900/10'
                    )}
                  >
                    <span className="text-zinc-500 text-xs font-mono text-center">{idx + 1}</span>

                    <Input
                      value={step.title}
                      onChange={(e) => updateStep(step.id, 'title', e.target.value)}
                      placeholder="عنوان گام"
                      className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-emerald-600 h-9 text-xs"
                    />

                    {/* Manage Step Fields Button */}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleOpenFieldsModal(step)}
                      className="h-9 text-xs border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 gap-1.5 px-3 font-semibold justify-center"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>تعریف فیلدها ({fieldsCount})</span>
                    </Button>

                    <Input
                      type="number"
                      min={1}
                      value={step.order}
                      onChange={(e) => updateStep(step.id, 'order', parseInt(e.target.value, 10) || 1)}
                      className="bg-zinc-900 border-zinc-700 text-zinc-100 focus-visible:ring-emerald-600 h-9 text-xs text-center font-mono"
                      dir="ltr"
                    />

                    <div className="flex items-center justify-center gap-1">
                      <Label className="sr-only">جابجایی</Label>
                      <button
                        type="button"
                        onClick={() => moveStep(step.id, 'up')}
                        disabled={idx === 0}
                        className="w-8 h-8 rounded flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-base"
                        aria-label="انتقال به بالا"
                      >↑</button>
                      <button
                        type="button"
                        onClick={() => moveStep(step.id, 'down')}
                        disabled={idx === sortedSteps.length - 1}
                        className="w-8 h-8 rounded flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-base"
                        aria-label="انتقال به پایین"
                      >↓</button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleInitiateDeleteStep(step)}
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                      aria-label="حذف گام"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {sortedSteps.length > 0 && (
          <Button
            onClick={addStep}
            variant="outline"
            className="w-full border-dashed border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 gap-2 h-11 text-xs"
          >
            <Plus className="w-4 h-4" />افزودن گام جدید
          </Button>
        )}
      </div>

      {/* Dynamic Step Fields Modal */}
      {activeStepForFields && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-3xl bg-[#1c1917] border border-zinc-800 rounded-2xl p-6 flex flex-col gap-5 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-white font-bold text-base flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-amber-400" />
                  تعریف فیلدهای اختصاصی گام
                </h3>
                <p className="text-zinc-400 text-xs mt-0.5">
                  گام مربوطه: <span className="text-amber-300 font-bold">{activeStepForFields.title || 'بدون عنوان'}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveStepForFields(null)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Multi-Field Addition Header */}
            <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>افزودن سریع و همزمان چند فیلد</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddFieldToStep}
                    className="bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 text-xs h-7 gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+۱ فیلد</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleAddMultipleFieldsToStep(3)}
                    className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold text-xs h-7 gap-1"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>+۳ فیلد همزمان</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleAddMultipleFieldsToStep(5)}
                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs h-7 gap-1"
                  >
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                    <span>+۵ فیلد همزمان</span>
                  </Button>
                </div>
              </div>

              {/* Preset Packages */}
              <div className="flex items-center gap-1.5 pt-2 border-t border-zinc-800/80 flex-wrap text-xs">
                <span className="text-[11px] text-zinc-400 font-medium ml-1">بسته‌های فیلد آماده:</span>
                <button
                  type="button"
                  onClick={() => handleAddStandardFieldPack('assessment')}
                  className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-amber-950/60 border border-zinc-700 hover:border-amber-500/60 text-zinc-300 hover:text-amber-300 text-[11px] font-medium transition-colors flex items-center gap-1"
                >
                  <FileText className="w-3 h-3 text-amber-400" />
                  <span>بسته برگ تشخیص (۴ فیلد)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddStandardFieldPack('ruling')}
                  className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-sky-950/60 border border-zinc-700 hover:border-sky-500/60 text-zinc-300 hover:text-sky-300 text-[11px] font-medium transition-colors flex items-center gap-1"
                >
                  <Scale className="w-3 h-3 text-sky-400" />
                  <span>بسته رای دادنامه (۴ فیلد)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddStandardFieldPack('general')}
                  className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-emerald-950/60 border border-zinc-700 hover:border-emerald-500/60 text-zinc-300 hover:text-emerald-300 text-[11px] font-medium transition-colors flex items-center gap-1"
                >
                  <CheckSquare className="w-3 h-3 text-emerald-400" />
                  <span>بسته دفاعیه (۳ فیلد)</span>
                </button>
              </div>
            </div>

            {/* List of Dynamic Fields */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
                <span>لیست فیلدهای ورودی این گام ({editingFields.length} فیلد):</span>
                {editingFields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setEditingFields([])}
                    className="text-red-400 hover:text-red-300 text-[11px] flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    حذف همه فیلدها
                  </button>
                )}
              </div>

              {editingFields.length === 0 ? (
                <div className="p-8 border border-dashed border-zinc-800 rounded-xl text-center text-zinc-500 text-xs">
                  هیچ فیلد اختصاصی برای این گام تعریف نشده است. کاربر در این گام فرم سفارشی نخواهد داشت.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {editingFields.map((field, fIdx) => (
                    <div
                      key={field.id}
                      className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
                    >
                      <div className="sm:col-span-1 text-zinc-500 text-xs font-mono pb-2 text-center">
                        #{fIdx + 1}
                      </div>

                      {/* Field Label */}
                      <div className="sm:col-span-4 flex flex-col gap-1">
                        <Label className="text-zinc-300 text-[11px]">عنوان فیلد (فارسی)</Label>
                        <Input
                          value={field.label}
                          onChange={(e) => handleUpdateField(field.id, 'label', e.target.value)}
                          placeholder="مثال: درآمد مشمول مالیات"
                          className="bg-zinc-950 border-zinc-700 text-white h-8 text-xs"
                        />
                      </div>

                      {/* Field Key */}
                      <div className="sm:col-span-3 flex flex-col gap-1">
                        <Label className="text-zinc-300 text-[11px]">شناسه لاتین (Key)</Label>
                        <Input
                          value={field.key}
                          onChange={(e) => handleUpdateField(field.id, 'key', e.target.value)}
                          placeholder="taxable_income"
                          className="bg-zinc-950 border-zinc-700 text-zinc-200 font-mono h-8 text-xs"
                          dir="ltr"
                        />
                      </div>

                      {/* Field Type */}
                      <div className="sm:col-span-3 flex flex-col gap-1">
                        <Label className="text-zinc-300 text-[11px]">نوع فیلد</Label>
                        <select
                          value={field.type}
                          onChange={(e) => handleUpdateField(field.id, 'type', e.target.value as any)}
                          className="bg-zinc-950 border border-zinc-700 text-white rounded-md h-8 text-xs px-2"
                        >
                          <option value="text">متنی (مبلغ / کد)</option>
                          <option value="select">انتخابی کشویی (Select)</option>
                          <option value="number">عددی</option>
                          <option value="date">تاریخ (تقویم شمسی)</option>
                          <option value="file">بارگذاری فایل / ضمیمه</option>
                          <option value="checkbox">کادر چک‌باکس / تاییدیه</option>
                        </select>
                      </div>

                      {/* Options for Select Type */}
                      {field.type === 'select' && (
                        <div className="sm:col-span-12 flex flex-col gap-1 bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800 mt-1">
                          <Label className="text-amber-300 text-[11px]">
                            گزینه‌های کشویی (گزینه‌ها را با کاما ، یا , از هم جدا کنید):
                          </Label>
                          <Input
                            value={field.options ? field.options.join(' ، ') : ''}
                            onChange={(e) => {
                              const raw = e.target.value
                              const parsed = raw.split(/[,،]/).map((s) => s.trim()).filter(Boolean)
                              handleUpdateField(field.id, 'options', parsed)
                            }}
                            placeholder="مثال: تمکین و پذیرش برگ تشخیص ، توافق ماده ۲۳۸ ، ارجاع به هیأت بدوی"
                            className="bg-zinc-900 border-zinc-700 text-white h-8 text-xs"
                          />
                        </div>
                      )}

                      {/* Required & Delete */}
                      <div className="sm:col-span-1 flex items-center justify-end gap-2 pb-1">
                        <button
                          type="button"
                          onClick={() => handleDeleteField(field.id)}
                          className="text-zinc-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-zinc-800"
                          title="حذف فیلد"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveStepForFields(null)}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 h-9 text-xs"
              >
                انصراف
              </Button>
              <Button
                type="button"
                onClick={handleSaveFieldsForStep}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-9 text-xs px-5"
              >
                تأیید فیلدهای گام
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Guard Modal */}
      {stepToDelete && (
        <DeleteGuardModal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          title={`گام اجرایی (${stepToDelete.title || 'بدون عنوان'})`}
          entityType="گام اجرایی"
          checkResult={{
            hasDependencies: false,
            dependencies: [],
          }}
          onConfirmDelete={handleConfirmDeleteStep}
        />
      )}
    </div>
  )
}
