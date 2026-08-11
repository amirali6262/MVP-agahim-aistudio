import { useState, useEffect, type FormEvent } from 'react'
import { toast } from 'sonner'
import { ArrowRight, Save } from 'lucide-react'
import { Button } from '../../../lib/shadcn/button'
import { Input } from '../../../lib/shadcn/input'
import { Label } from '../../../lib/shadcn/label'
import { Switch } from '../../../lib/shadcn/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../lib/shadcn/select'
import { supabase, isSupabaseConfigured } from '../../../lib/supabase'
import { mockObligationsDb, mockObjectionTemplatesDb } from '../../../lib/mockDb'
import type { Obligation, ObjectionTemplate } from '../../../lib/supabase'

// ---------------------------------------------------------------------------
const OBLIGATION_TYPE_OPTIONS = [
  { value: 'TAX_CORPORATE', label: 'مالیات بر عملکرد اشخاص حقوقی' },
  { value: 'VAT', label: 'مالیات بر ارزش افزوده' },
  { value: 'TAX_INDIVIDUAL', label: 'مالیات بر عملکرد اشخاص حقیقی' },
  { value: 'PAYROLL_TAX', label: 'مالیات بر حقوق' },
  { value: 'TAX_DUTIES', label: 'مالیات تکلیفی' },
  { value: 'CLAIM_169', label: 'مطالبه ۱۶۹ مکرر' },
]

const RECURRENCE_OPTIONS = ['سالانه', 'فصلی (بهار، تابستان، پاییز، زمستان)', 'فصلی', 'ماهانه', 'موردی/رویداد محور', 'یکبار برای همیشه']

const BASE_EVENT_OPTIONS = [
  'پایان سال مالی مودی',
  'پایان دوره فصلی',
  'پایان ماه شمسی',
  'تاریخ ابلاغ برگ/ااختیاریه',
  'تاریخ وقوع رویداد',
  'تاریخ ثبت اعتراض توسط مودی',
  'تاریخ صدور فاکتور/صورتحساب',
  'تاریخ صدور رای/ابلاغیه',
]

const PHASE_GROUP_OPTIONS = [
  'مرحله قبل از اظهارنامه',
  'مرحله اظهارنامه',
  'مرحله پس از اظهارنامه',
  'مرحله رسیدگی',
  'مرحله اعتراض',
  'مرحله اجرا',
]

const TIME_UNIT_OPTIONS = ['روز', 'ماه', 'سال']
const RESPONSIBLE_OPTIONS = ['مودی', 'سازمان امور مالیاتی']

// ---------------------------------------------------------------------------
interface FormState {
  title: string
  obligation_type: string
  obligation_types: string[]
  is_shared: boolean
  shared_action_key: string
  recurrence: string
  base_event: string
  time_gap_value: string
  time_gap_unit: string
  responsible_party: string
  is_active: boolean
  phase_group: string
  sequence_order: string
  objection_template_id: string
}

const EMPTY: FormState = {
  title: '',
  obligation_type: 'TAX_CORPORATE',
  obligation_types: ['TAX_CORPORATE'],
  is_shared: false,
  shared_action_key: '',
  recurrence: '',
  base_event: '',
  time_gap_value: '',
  time_gap_unit: '',
  responsible_party: '',
  is_active: true,
  phase_group: '',
  sequence_order: '1',
  objection_template_id: '',
}

interface Props {
  obligation: Obligation | null
  defaultType?: string
  onBack: () => void
  onSaved: () => void
}

// ---------------------------------------------------------------------------
export default function ObligationForm({ obligation, defaultType = 'TAX_CORPORATE', onBack, onSaved }: Props) {
  const isEdit = obligation !== null
  const [form, setForm] = useState<FormState>({ ...EMPTY, obligation_type: defaultType })
  const [submitting, setSubmitting] = useState(false)
  const [templates, setTemplates] = useState<ObjectionTemplate[]>([])

  useEffect(() => {
    // Load objection templates for dropdown
    const fetched = mockObjectionTemplatesDb.getAll()
    setTemplates(fetched)
  }, [])

  useEffect(() => {
    if (obligation) {
      const types = obligation.obligation_types && obligation.obligation_types.length > 0
        ? obligation.obligation_types
        : [obligation.obligation_type || defaultType]

      setForm({
        title: obligation.title,
        obligation_type: obligation.obligation_type || defaultType,
        obligation_types: types,
        is_shared: obligation.is_shared ?? types.length > 1,
        shared_action_key: obligation.shared_action_key ?? '',
        recurrence: obligation.recurrence,
        base_event: obligation.base_event,
        time_gap_value: obligation.time_gap_value?.toString() ?? '',
        time_gap_unit: obligation.time_gap_unit ?? '',
        responsible_party: obligation.responsible_party,
        is_active: obligation.is_active,
        phase_group: obligation.phase_group ?? '',
        sequence_order: obligation.sequence_order?.toString() ?? '1',
        objection_template_id: obligation.objection_template_id ?? '',
      })
    } else {
      setForm({ ...EMPTY, obligation_type: defaultType, obligation_types: [defaultType] })
    }
  }, [obligation, defaultType])

  const set = (key: keyof FormState) => (val: any) =>
    setForm((prev) => ({ ...prev, [key]: val }))

  const toggleType = (typeVal: string) => {
    setForm((prev) => {
      const exists = prev.obligation_types.includes(typeVal)
      let nextTypes = exists
        ? prev.obligation_types.filter((t) => t !== typeVal)
        : [...prev.obligation_types, typeVal]

      if (nextTypes.length === 0) nextTypes = [prev.obligation_type]
      return {
        ...prev,
        obligation_types: nextTypes,
        is_shared: nextTypes.length > 1 || prev.is_shared,
      }
    })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) { toast.error('عنوان تکلیف الزامی است.'); return }
    if (!form.recurrence) { toast.error('دوره تناوب را انتخاب کنید.'); return }
    if (!form.base_event) { toast.error('رویداد پایه مبنا را انتخاب کنید.'); return }
    if (!form.responsible_party) { toast.error('مسئول اجرا را انتخاب کنید.'); return }

    const primaryType = form.obligation_type || defaultType
    const finalTypes = Array.from(new Set([primaryType, ...form.obligation_types]))
    const isShared = form.is_shared || finalTypes.length > 1

    const payload = {
      title: form.title.trim(),
      obligation_type: primaryType,
      obligation_types: finalTypes,
      is_shared: isShared,
      shared_action_key: isShared
        ? form.shared_action_key || (form.title.includes('پلمپ') ? 'BOOK_SEALING' : 'SHARED_ACTION_' + Date.now())
        : undefined,
      recurrence: form.recurrence,
      base_event: form.base_event,
      time_gap_value: form.time_gap_value ? parseInt(form.time_gap_value, 10) : null,
      time_gap_unit: form.time_gap_unit || null,
      responsible_party: form.responsible_party,
      is_active: form.is_active,
      phase_group: form.phase_group || null,
      sequence_order: form.sequence_order ? parseInt(form.sequence_order, 10) : 1,
      objection_template_id: form.objection_template_id || null,
    }

    setSubmitting(true)

    if (isEdit && obligation) {
      const result = mockObligationsDb.update(obligation.id, payload)
      if (!result) { toast.error('خطا: تکلیف یافت نشد.'); setSubmitting(false); return }
    } else {
      mockObligationsDb.insert({ ...payload, workflow_steps: [], penalties: [] })
    }
    toast.success(isEdit ? 'تکلیف با موفقیت ویرایش شد.' : 'تکلیف با موفقیت ثبت شد.')
    setSubmitting(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto" style={{ background: '#0a0c0b' }}>
      {/* Sticky header */}
      <div
        className="sticky top-0 z-10 flex items-center gap-3 px-6 h-16 border-b border-zinc-800"
        style={{ background: '#141615' }}
      >
        <button type="button" onClick={onBack} className="text-zinc-400 hover:text-zinc-100 transition-colors" aria-label="بازگشت">
          <ArrowRight className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-zinc-100 font-bold text-base">
            {isEdit ? 'ویرایش تکلیف' : 'افزودن تکلیف جدید'}
          </h2>
          <p className="text-zinc-500 text-xs">مالیات بر عملکرد اشخاص حقوقی</p>
        </div>
      </div>

      {/* Form body */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <form onSubmit={handleSubmit}>
          <div className="rounded-2xl border border-zinc-800 p-8 mb-6" style={{ background: '#211d1a' }}>
            <h3 className="text-[#E5A93C] font-bold text-sm mb-6 pb-3 border-b border-zinc-800/80">
              اطلاعات پایه تکلیف
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* ۱. عنوان تکلیف */}
              <div className="md:col-span-2 flex flex-col gap-2">
                <Label className="text-white font-medium text-sm">
                  عنوان تکلیف <span className="text-red-400">*</span>
                </Label>
                <Input
                  value={form.title}
                  onChange={(e) => set('title')(e.target.value)}
                  placeholder="مثال: ارسال اظهارنامه مالیات عملکرد"
                  className="bg-zinc-900/90 border-zinc-700 text-white placeholder:text-zinc-500 focus-visible:ring-[#E5A93C] h-11 font-medium"
                />
              </div>

              {/* نوع سرفصل مالیاتی اصلی و سرفصل‌های مرتبط */}
              <div className="md:col-span-2 flex flex-col gap-3 p-4 rounded-xl border border-zinc-800 bg-zinc-950/60">
                <div className="flex items-center justify-between">
                  <Label className="text-white font-medium text-sm">
                    سرفصل مالیاتی اصلی <span className="text-red-400">*</span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-400">تکلیف مشترک بین سرفصل‌ها</span>
                    <Switch
                      checked={form.is_shared}
                      onCheckedChange={(v) => set('is_shared')(v)}
                      className="data-[state=checked]:bg-[#E5A93C]"
                    />
                  </div>
                </div>

                <Select value={form.obligation_type} onValueChange={(v) => {
                  set('obligation_type')(v)
                  if (!form.obligation_types.includes(v)) {
                    toggleType(v)
                  }
                }}>
                  <SelectTrigger className="bg-zinc-900/90 border-zinc-700 text-white focus:ring-[#E5A93C] h-11 font-medium">
                    <SelectValue placeholder="انتخاب سرفصل مالیاتی اصلی..." />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-700 bg-[#211d1a]">
                    {OBLIGATION_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value} className="text-white focus:bg-zinc-800 focus:text-white">
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Multi-Select Tax Heads if shared */}
                {form.is_shared && (
                  <div className="mt-2 pt-3 border-t border-zinc-800 flex flex-col gap-2">
                    <Label className="text-amber-300 font-semibold text-xs flex items-center gap-1.5">
                      <span>🔗 سرفصل‌های مالیاتی مرتبط (همگام‌سازی خودکار شواهد و هشدارها)</span>
                    </Label>
                    <p className="text-zinc-400 text-xs leading-relaxed">
                      با انتخاب چند سرفصل (مثلاً عملکرد + ارزش افزوده)، ثبت شواهد و تکمیل این تکلیف در یکی از سرفصل‌ها، به طور خودکار وضعیت و هشدارهای تمام سرفصل‌های مرتبط را بروزرسانی می‌کند.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                      {OBLIGATION_TYPE_OPTIONS.map((opt) => {
                        const checked = form.obligation_types.includes(opt.value) || form.obligation_type === opt.value
                        return (
                          <label
                            key={opt.value}
                            className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                              checked
                                ? 'bg-[#E5A93C]/10 border-[#E5A93C]/50 text-amber-200'
                                : 'bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={opt.value === form.obligation_type}
                              onChange={() => toggleType(opt.value)}
                              className="accent-[#E5A93C] rounded w-4 h-4"
                            />
                            <span>{opt.label}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* ۲. دوره تناوب */}
              <div className="flex flex-col gap-2">
                <Label className="text-white font-medium text-sm">
                  دوره تناوب <span className="text-red-400">*</span>
                </Label>
                <Select value={form.recurrence} onValueChange={set('recurrence')}>
                  <SelectTrigger className="bg-zinc-900/90 border-zinc-700 text-white focus:ring-[#E5A93C] h-11 font-medium">
                    <SelectValue placeholder="انتخاب کنید..." />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-700 bg-[#211d1a]">
                    {RECURRENCE_OPTIONS.map((o) => (
                      <SelectItem key={o} value={o} className="text-white focus:bg-zinc-800 focus:text-white">{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* ۳. رویداد پایه مبنا */}
              <div className="flex flex-col gap-2">
                <Label className="text-white font-medium text-sm">
                  رویداد پایه مبنا <span className="text-red-400">*</span>
                </Label>
                <Select value={form.base_event} onValueChange={set('base_event')}>
                  <SelectTrigger className="bg-zinc-900/90 border-zinc-700 text-white focus:ring-[#E5A93C] h-11 font-medium">
                    <SelectValue placeholder="انتخاب کنید..." />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-700 bg-[#211d1a]">
                    {BASE_EVENT_OPTIONS.map((o) => (
                      <SelectItem key={o} value={o} className="text-white focus:bg-zinc-800 focus:text-white">{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* ۴. مقدار فاصله زمانی */}
              <div className="flex flex-col gap-2">
                <Label className="text-white font-medium text-sm">مقدار فاصله زمانی</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.time_gap_value}
                  onChange={(e) => set('time_gap_value')(e.target.value)}
                  placeholder="مثال: ۳"
                  className="bg-zinc-900/90 border-zinc-700 text-white placeholder:text-zinc-500 focus-visible:ring-[#E5A93C] h-11 font-medium"
                  dir="ltr"
                />
              </div>

              {/* ۵. واحد فاصله زمانی */}
              <div className="flex flex-col gap-2">
                <Label className="text-white font-medium text-sm">واحد فاصله زمانی</Label>
                <Select value={form.time_gap_unit} onValueChange={set('time_gap_unit')}>
                  <SelectTrigger className="bg-zinc-900/90 border-zinc-700 text-white focus:ring-[#E5A93C] h-11 font-medium">
                    <SelectValue placeholder="انتخاب کنید..." />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-700 bg-[#211d1a]">
                    {TIME_UNIT_OPTIONS.map((o) => (
                      <SelectItem key={o} value={o} className="text-white focus:bg-zinc-800 focus:text-white">{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* ۶. مسئول اجرا */}
              <div className="flex flex-col gap-2">
                <Label className="text-white font-medium text-sm">
                  مسئول اجرا <span className="text-red-400">*</span>
                </Label>
                <Select value={form.responsible_party} onValueChange={set('responsible_party')}>
                  <SelectTrigger className="bg-zinc-900/90 border-zinc-700 text-white focus:ring-[#E5A93C] h-11 font-medium">
                    <SelectValue placeholder="انتخاب کنید..." />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-700 bg-[#211d1a]">
                    {RESPONSIBLE_OPTIONS.map((o) => (
                      <SelectItem key={o} value={o} className="text-white focus:bg-zinc-800 focus:text-white">{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* ۷. وضعیت */}
              <div className="flex flex-col gap-2">
                <Label className="text-white font-medium text-sm">وضعیت</Label>
                <div className="flex items-center justify-between h-11 px-4 rounded-lg border border-zinc-700 bg-zinc-900/90">
                  <span className="text-sm font-medium text-white">
                    {form.is_active ? 'فعال' : 'غیرفعال'}
                  </span>
                  <Switch
                    checked={form.is_active}
                    onCheckedChange={(v) => set('is_active')(v)}
                    className="data-[state=checked]:bg-[#E5A93C]"
                  />
                </div>
              </div>

              {/* ----------------- Sequencing and Linking Section ----------------- */}
              <div className="md:col-span-2 pt-4 border-t border-zinc-800">
                <h4 className="text-[#E5A93C] font-bold text-sm mb-4">
                  ترتیب اجرا و الگوی اعتراض (ترتیب تسلسل و فرآیند)
                </h4>
              </div>

              {/* ۸. فاز/گروه اجرایی */}
              <div className="flex flex-col gap-2">
                <Label className="text-white font-medium text-sm">فاز/گروه اجرایی</Label>
                <Select value={form.phase_group} onValueChange={set('phase_group')}>
                  <SelectTrigger className="bg-zinc-900/90 border-zinc-700 text-white focus:ring-[#E5A93C] h-11 font-medium">
                    <SelectValue placeholder="انتخاب یا ورود فاز..." />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-700 bg-[#211d1a]">
                    {PHASE_GROUP_OPTIONS.map((o) => (
                      <SelectItem key={o} value={o} className="text-white focus:bg-zinc-800 focus:text-white">{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* ۹. ترتیب نمایش در گروه */}
              <div className="flex flex-col gap-2">
                <Label className="text-white font-medium text-sm">ترتیب نمایش در گروه (شماره پله)</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.sequence_order}
                  onChange={(e) => set('sequence_order')(e.target.value)}
                  placeholder="مثال: ۱"
                  className="bg-zinc-900/90 border-zinc-700 text-white placeholder:text-zinc-500 focus-visible:ring-[#E5A93C] h-11 font-medium"
                  dir="ltr"
                />
              </div>

              {/* ۱۰. الگوی اعتراض (اختیاری) */}
              <div className="md:col-span-2 flex flex-col gap-2">
                <Label className="text-white font-medium text-sm">الگوی اعتراض (اختیاری)</Label>
                <Select value={form.objection_template_id} onValueChange={set('objection_template_id')}>
                  <SelectTrigger className="bg-zinc-900/90 border-zinc-700 text-white focus:ring-[#E5A93C] h-11 font-medium">
                    <SelectValue placeholder="بدون الگوی اعتراض / انتخاب الگو..." />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-700 bg-[#211d1a]">
                    <SelectItem value="" className="text-zinc-400 focus:bg-zinc-800">بدون الگوی اعتراض</SelectItem>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id} className="text-white focus:bg-zinc-800 focus:text-white">
                        {t.template_name} ({t.steps?.length ?? 0} مرحله)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button
              type="submit"
              disabled={submitting}
              className="bg-[#E5A93C] hover:bg-[#d49a2d] text-[#181614] font-bold gap-2 h-11 px-8 shadow-md"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-[#181614] border-t-transparent rounded-full animate-spin" />
                  در حال ذخیره...
                </span>
              ) : (
                <><Save className="w-4 h-4" />{isEdit ? 'ذخیره تغییرات' : 'ثبت تکلیف'}</>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              disabled={submitting}
              className="border-zinc-700 text-white hover:bg-zinc-800 hover:text-white h-11 font-medium"
            >
              انصراف
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

