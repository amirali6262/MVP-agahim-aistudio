import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import {
  CheckSquare,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Filter,
  FileText,
  Info,
  ShieldCheck,
  Check,
  RotateCcw,
} from 'lucide-react'
import { Button } from '../lib/shadcn/button'
import { Badge } from '../lib/shadcn/badge'
import { Input } from '../lib/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../lib/shadcn/select'
import {
  fetchChecklistTemplates,
  fetchChecklistProgress,
  upsertChecklistProgress,
} from '../lib/supabaseDb'
import type {
  ChecklistTemplate,
  ChecklistSection,
  ChecklistItem,
  ChecklistImportance,
  TenantChecklistProgress,
} from '../lib/supabase'

interface Props {
  tenantId: string
  tenantName: string
}

export default function CompanyChecklistWizard({ tenantId, tenantName }: Props) {
  const [fiscalYear, setFiscalYear] = useState('1403')
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [activeStepIndex, setActiveStepIndex] = useState(0) // Step 0 to N-1 (Sections) + Step N (Final Summary)
  const [progress, setProgress] = useState<TenantChecklistProgress | null>(null)
  const [importanceFilter, setImportanceFilter] = useState<'ALL' | ChecklistImportance>('ALL')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [noteInput, setNoteInput] = useState('')

  useEffect(() => {
    fetchChecklistTemplates().then((list) => {
      setTemplates(list as any)
      if (list.length > 0 && !selectedTemplateId) {
        setSelectedTemplateId(list[0].id)
      }
    })
  }, [])

  const currentTemplate = useMemo(() => {
    return templates.find((t) => t.id === selectedTemplateId) || templates[0] || null
  }, [templates, selectedTemplateId])

  const loadProgress = async () => {
    if (!currentTemplate) return
    const prog = await fetchChecklistProgress(tenantId, currentTemplate.id, fiscalYear)
    setProgress(prog as any)
  }

  useEffect(() => {
    loadProgress()
    setActiveStepIndex(0)
  }, [selectedTemplateId, fiscalYear, tenantId])

  // Total items & completion metrics calculation
  const metrics = useMemo(() => {
    if (!currentTemplate || !progress) {
      return { total: 0, completed: 0, percent: 0, highTotal: 0, highDone: 0, condTotal: 0, condDone: 0, suppTotal: 0, suppDone: 0 }
    }

    let total = 0
    let completed = 0
    let highTotal = 0
    let highDone = 0
    let condTotal = 0
    let condDone = 0
    let suppTotal = 0
    let suppDone = 0

    currentTemplate.sections.forEach((sec) => {
      sec.items.forEach((item) => {
        total += 1
        const isDone = Boolean(progress.completed_items[item.id]?.completed)
        if (isDone) completed += 1

        if (item.importance === 'HIGH') {
          highTotal += 1
          if (isDone) highDone += 1
        } else if (item.importance === 'CONDITIONAL') {
          condTotal += 1
          if (isDone) condDone += 1
        } else if (item.importance === 'SUPPLEMENTARY') {
          suppTotal += 1
          if (isDone) suppDone += 1
        }
      })
    })

    const percent = total > 0 ? Math.round((completed / total) * 100) : 0
    return { total, completed, percent, highTotal, highDone, condTotal, condDone, suppTotal, suppDone }
  }, [currentTemplate, progress])

  if (!currentTemplate) {
    return <div className="text-zinc-400 text-xs text-center py-12">هیچ چک‌لیستی تعریف نشده است.</div>
  }

  const sectionsCount = currentTemplate.sections.length
  const isSummaryStep = activeStepIndex === sectionsCount
  const currentSection = !isSummaryStep ? currentTemplate.sections[activeStepIndex] : null

  const handleToggleItem = async (itemId: string) => {
    if (!progress) return
    // Build updated completed_items
    const newCompleted = { ...(progress?.completed_items || {}) }
    newCompleted[itemId] = { completed: !newCompleted[itemId]?.completed, notes: newCompleted[itemId]?.notes }
    const updated = await upsertChecklistProgress({
      tenant_id: tenantId,
      checklist_template_id: currentTemplate.id,
      fiscal_year: fiscalYear,
      completed_items: newCompleted,
      status: 'IN_PROGRESS',
    })
    if (updated) setProgress({ ...progress, ...updated, updated_at: new Date().toISOString() })
  }

  const handleSaveNote = async (itemId: string) => {
    if (!progress) return
    const newCompleted = { ...(progress?.completed_items || {}) }
    newCompleted[itemId] = { completed: newCompleted[itemId]?.completed ?? false, notes: noteInput }
    const updated = await upsertChecklistProgress({
      tenant_id: tenantId,
      checklist_template_id: currentTemplate.id,
      fiscal_year: fiscalYear,
      completed_items: newCompleted,
      status: 'IN_PROGRESS',
    })
    if (updated) setProgress({ ...progress, ...updated, updated_at: new Date().toISOString() })
    setEditingNoteId(null)
    toast.success('یادداشت کنترلی ذخیره گردید.')
  }

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Top Header Card */}
      <div
        className="rounded-2xl border border-zinc-800 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg"
        style={{ background: '#141615' }}
      >
        <div className="flex items-center gap-3.5">
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-[#E5A93C]">
            <CheckSquare className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-white font-bold text-lg flex items-center gap-2">
              ویزارد چک‌لیست ویزارت تسلیم اظهارنامه مالیاتی
            </h2>
            <p className="text-zinc-400 text-xs mt-0.5">
              تکمیل گام‌به‌گام بندهای کنترلی ویزارد برای شرکت {tenantName}
            </p>
          </div>
        </div>

        {/* Selectors */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-zinc-900/90 border border-zinc-800 p-1.5 rounded-xl">
            <span className="text-xs text-zinc-300 font-medium px-2">انتخاب چک‌لیست:</span>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white font-bold h-8 text-xs w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#211d1a] border-zinc-700 max-w-xs">
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id} className="text-xs text-white">
                    {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 bg-zinc-900/90 border border-zinc-800 p-1.5 rounded-xl">
            <Calendar className="w-4 h-4 text-amber-400 mr-1" />
            <span className="text-xs text-zinc-300 font-medium">سال مالی:</span>
            <Select value={fiscalYear} onValueChange={setFiscalYear}>
              <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white font-bold h-8 text-xs w-20 font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#211d1a] border-zinc-700">
                <SelectItem value="1404" className="text-white font-mono">۱۴۰۴</SelectItem>
                <SelectItem value="1403" className="text-white font-mono">۱۴۰۳</SelectItem>
                <SelectItem value="1402" className="text-white font-mono">۱۴۰۲</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Progress & Priority Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Overall Completion Bar */}
        <div className="md:col-span-1 rounded-2xl border border-zinc-800 bg-[#141615] p-4 flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-300 font-bold">پیشرفت کل چک‌لیست</span>
            <span className="text-amber-400 font-mono font-bold text-sm">{metrics.percent}%</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-3 overflow-hidden border border-zinc-700 mb-2">
            <div
              className="bg-[#E5A93C] h-full transition-all duration-500 rounded-full"
              style={{ width: `${metrics.percent}%` }}
            />
          </div>
          <div className="text-[11px] text-zinc-400 font-mono text-left dir-ltr">
            {metrics.completed} / {metrics.total} موارد تکمیل‌شده
          </div>
        </div>

        {/* High Priority 🔴 */}
        <div className="rounded-2xl border border-red-900/50 bg-red-950/20 p-4 flex items-center justify-between shadow-md">
          <div>
            <div className="text-red-300 font-bold text-xs flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              🔴 ضروری با اهمیت بالا
            </div>
            <p className="text-zinc-400 text-[10px] mt-1">بندهای خط قرمز ممیزی</p>
          </div>
          <div className="text-right">
            <span className="text-red-300 font-mono font-bold text-lg">{metrics.highDone}/{metrics.highTotal}</span>
          </div>
        </div>

        {/* Conditional 🟠 */}
        <div className="rounded-2xl border border-amber-900/50 bg-amber-950/20 p-4 flex items-center justify-between shadow-md">
          <div>
            <div className="text-amber-300 font-bold text-xs flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              🟠 ضروری حسب مورد
            </div>
            <p className="text-zinc-400 text-[10px] mt-1">بندهای مشروط مالیاتی</p>
          </div>
          <div className="text-right">
            <span className="text-amber-300 font-mono font-bold text-lg">{metrics.condDone}/{metrics.condTotal}</span>
          </div>
        </div>

        {/* Supplementary 🟡 */}
        <div className="rounded-2xl border border-yellow-900/40 bg-yellow-950/10 p-4 flex items-center justify-between shadow-md">
          <div>
            <div className="text-yellow-300 font-bold text-xs flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              🟡 کنترلی و تکمیلی
            </div>
            <p className="text-zinc-400 text-[10px] mt-1">جداول توجیهی و تطبیق</p>
          </div>
          <div className="text-right">
            <span className="text-yellow-300 font-mono font-bold text-lg">{metrics.suppDone}/{metrics.suppTotal}</span>
          </div>
        </div>
      </div>

      {/* Wizard Stepper Tabs */}
      <div className="bg-[#141615] rounded-2xl border border-zinc-800 p-2 flex items-center gap-1.5 overflow-x-auto scrollbar-thin scrollbar-thumb-zinc-700">
        {currentTemplate.sections.map((sec, idx) => {
          const isActive = activeStepIndex === idx
          // Check if section items are all done
          const secItems = sec.items
          const secDoneCount = secItems.filter((it) => progress?.completed_items[it.id]?.completed).length
          const isSecComplete = secItems.length > 0 && secDoneCount === secItems.length

          return (
            <button
              key={sec.id}
              onClick={() => setActiveStepIndex(idx)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-[#E5A93C] text-[#181614] shadow-md scale-105'
                  : isSecComplete
                  ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300 hover:bg-emerald-900'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              <span>{sec.title.split('.')[0]}</span>
              {isSecComplete && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
            </button>
          )
        })}

        {/* Final Summary Step Button */}
        <button
          onClick={() => setActiveStepIndex(sectionsCount)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            isSummaryStep
              ? 'bg-[#E5A93C] text-[#181614] shadow-md scale-105'
              : 'bg-amber-950/60 border border-amber-800 text-amber-300 hover:bg-amber-900/80'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>🏁 گزارش خلاصه نهایی</span>
        </button>
      </div>

      {/* Main Wizard Content Step */}
      <div className="rounded-2xl border border-zinc-800 bg-[#141615] p-6 shadow-xl min-h-[420px] flex flex-col justify-between">
        {!isSummaryStep && currentSection ? (
          <div className="flex flex-col gap-6">
            {/* Step Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4 flex-wrap gap-3">
              <div>
                <span className="text-amber-400 font-mono font-bold text-xs">
                  مرحله {activeStepIndex + 1} از {sectionsCount}
                </span>
                <h3 className="text-white font-bold text-lg mt-0.5">{currentSection.title}</h3>
              </div>

              {/* Filter by Importance */}
              <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800 text-xs">
                <Filter className="w-3.5 h-3.5 text-amber-400 mr-1 ml-1" />
                <button
                  onClick={() => setImportanceFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-xs transition-all ${
                    importanceFilter === 'ALL' ? 'bg-[#E5A93C] text-[#181614] font-bold' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  همه بندها
                </button>
                <button
                  onClick={() => setImportanceFilter('HIGH')}
                  className={`px-2.5 py-1 rounded-lg text-xs transition-all ${
                    importanceFilter === 'HIGH' ? 'bg-red-500 text-white font-bold' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  🔴 ضروری
                </button>
                <button
                  onClick={() => setImportanceFilter('CONDITIONAL')}
                  className={`px-2.5 py-1 rounded-lg text-xs transition-all ${
                    importanceFilter === 'CONDITIONAL' ? 'bg-amber-500 text-black font-bold' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  🟠 حسب مورد
                </button>
                <button
                  onClick={() => setImportanceFilter('SUPPLEMENTARY')}
                  className={`px-2.5 py-1 rounded-lg text-xs transition-all ${
                    importanceFilter === 'SUPPLEMENTARY' ? 'bg-yellow-500 text-black font-bold' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  🟡 تکمیلی
                </button>
              </div>
            </div>

            {/* Items Checklist List */}
            <div className="flex flex-col gap-3">
              {currentSection.items
                .filter((it) => importanceFilter === 'ALL' || it.importance === importanceFilter)
                .map((item) => {
                  const itemState = progress?.completed_items[item.id]
                  const isChecked = Boolean(itemState?.completed)

                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isChecked
                          ? 'border-emerald-800/80 bg-emerald-950/10'
                          : 'border-zinc-800 bg-zinc-900/80 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <button
                          type="button"
                          onClick={() => handleToggleItem(item.id)}
                          className={`mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                            isChecked
                              ? 'bg-emerald-500 text-black font-bold shadow-md'
                              : 'border-2 border-zinc-700 bg-zinc-900 hover:border-[#E5A93C]'
                          }`}
                        >
                          {isChecked && <Check className="w-4 h-4 stroke-[3]" />}
                        </button>

                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-amber-400 font-bold text-xs">{item.code}</span>
                              <span
                                onClick={() => handleToggleItem(item.id)}
                                className={`text-xs font-semibold cursor-pointer ${
                                  isChecked ? 'line-through text-zinc-400' : 'text-zinc-100'
                                }`}
                              >
                                {item.title}
                              </span>
                            </div>

                            {/* Importance Badge */}
                            <div>
                              {item.importance === 'HIGH' && (
                                <Badge className="bg-red-950 border-red-800 text-red-300 text-[10px]">
                                  🔴 ضروری
                                </Badge>
                              )}
                              {item.importance === 'CONDITIONAL' && (
                                <Badge className="bg-amber-950 border-amber-800 text-amber-300 text-[10px]">
                                  🟠 حسب مورد
                                </Badge>
                              )}
                              {item.importance === 'SUPPLEMENTARY' && (
                                <Badge className="bg-yellow-950/60 border-yellow-800/60 text-yellow-300 text-[10px]">
                                  🟡 تکمیلی
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Note View & Edit */}
                          {editingNoteId === item.id ? (
                            <div className="mt-3 flex items-center gap-2">
                              <Input
                                value={noteInput}
                                onChange={(e) => setNoteInput(e.target.value)}
                                placeholder="یادداشت و ملاحظات کنترلی حسابرس/مودی..."
                                className="bg-zinc-800 border-zinc-700 text-white text-xs h-8"
                              />
                              <Button
                                size="sm"
                                onClick={() => handleSaveNote(item.id)}
                                className="bg-[#E5A93C] text-black font-bold h-8 text-xs"
                              >
                                ذخیره
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingNoteId(null)}
                                className="text-zinc-400 h-8 text-xs"
                              >
                                انصراف
                              </Button>
                            </div>
                          ) : (
                            <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-400">
                              {itemState?.notes ? (
                                <span className="text-amber-200/90 font-medium bg-amber-950/30 px-2 py-0.5 rounded border border-amber-800/40">
                                  📝 یادداشت: {itemState.notes}
                                </span>
                              ) : (
                                <span className="text-zinc-500 italic">بدون یادداشت</span>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  setEditingNoteId(item.id)
                                  setNoteInput(itemState?.notes || '')
                                }}
                                className="text-amber-400 hover:underline"
                              >
                                {itemState?.notes ? 'ویرایش یادداشت' : '+ افزودن یادداشت'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        ) : (
          /* Final Summary & Confirmation Step */
          <div className="flex flex-col gap-6">
            <div className="border-b border-zinc-800 pb-4">
              <span className="text-emerald-400 font-mono font-bold text-xs">گام پایانی ویزارد</span>
              <h3 className="text-white font-bold text-xl mt-1 flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
                خلاصه وضعیت کنترل و تسلیم اظهارنامه مالیاتی
              </h3>
              <p className="text-zinc-400 text-xs mt-1">
                بررسی نهایی پیشرفت بندهای کنترلی برای سال مالی {fiscalYear} شرکت {tenantName}
              </p>
            </div>

            {/* Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex flex-col gap-1">
                <span className="text-zinc-400 text-xs font-semibold">بندهای خط قرمز (🔴)</span>
                <span className="text-red-400 font-mono font-bold text-xl">
                  {metrics.highDone} از {metrics.highTotal} تکمیل شده
                </span>
                {metrics.highDone < metrics.highTotal && (
                  <span className="text-red-300 text-[11px] font-medium mt-1">
                    ⚠️ {metrics.highTotal - metrics.highDone} مورد ضروری هنوز تیک نخورده است!
                  </span>
                )}
              </div>

              <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex flex-col gap-1">
                <span className="text-zinc-400 text-xs font-semibold">بندهای مشروط (🟠)</span>
                <span className="text-amber-400 font-mono font-bold text-xl">
                  {metrics.condDone} از {metrics.condTotal} تکمیل شده
                </span>
              </div>

              <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex flex-col gap-1">
                <span className="text-zinc-400 text-xs font-semibold">بندهای تکمیلی (🟡)</span>
                <span className="text-yellow-400 font-mono font-bold text-xl">
                  {metrics.suppDone} از {metrics.suppTotal} تکمیل شده
                </span>
              </div>
            </div>

            {/* Action Statement */}
            <div className="p-4 rounded-xl border border-emerald-800/60 bg-emerald-950/20 text-xs text-emerald-200 leading-relaxed flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-emerald-300">تاییدیه صحه‌گذاری نهایی اظهارنامه:</p>
                با تکمیل تمام بندهای ضروری، ریسک علی‌الرأس و جرایم عدم انطباق با سامانه مؤدیان و گزارشات فصلی به حداقل ممکن می‌رسد.
              </div>
            </div>

            <Button
              onClick={() => {
                toast.success('تاییدیه نهایی ویزارد چک‌لیست برای سال مالی ' + fiscalYear + ' با موفقیت به ثبت رسید.')
              }}
              className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold h-11 text-xs px-8 shadow-lg gap-2 self-end"
            >
              <CheckCircle2 className="w-4 h-4" />
              ثبت تاییدیه نهایی ممیزی ویزارد
            </Button>
          </div>
        )}

        {/* Bottom Stepper Controls */}
        <div className="flex items-center justify-between border-t border-zinc-800 pt-4 mt-6">
          <Button
            variant="outline"
            disabled={activeStepIndex === 0}
            onClick={() => setActiveStepIndex((prev) => Math.max(0, prev - 1))}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 h-10 text-xs gap-1.5"
          >
            <ChevronRight className="w-4 h-4" />
            مرحله قبل
          </Button>

          <span className="text-xs text-zinc-400 font-mono">
            {isSummaryStep ? 'پایان ویزارد' : `گام ${activeStepIndex + 1} از ${sectionsCount}`}
          </span>

          <Button
            disabled={isSummaryStep}
            onClick={() => setActiveStepIndex((prev) => Math.min(sectionsCount, prev + 1))}
            className="bg-[#E5A93C] hover:bg-[#d49a2d] text-[#181614] font-bold h-10 text-xs px-5 gap-1.5 shadow"
          >
            مرحله بعد
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
