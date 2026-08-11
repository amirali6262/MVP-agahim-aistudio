import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Building2,
  Plus,
  Search,
  X,
  Edit2,
  Eye,
  Trash2,
  Sparkles,
  CheckCircle2,
  Calendar as CalendarIcon,
  FileText,
  UploadCloud,
  CheckSquare,
  ChevronRight,
  ChevronLeft,
  Layers,
  Lock,
  ArrowLeft,
  Check,
} from 'lucide-react'
import { Button } from '../lib/shadcn/button'
import { Input } from '../lib/shadcn/input'
import { Label } from '../lib/shadcn/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../lib/shadcn/select'
import JalaliDatePicker from './JalaliDatePicker'
import DeleteGuardModal from './DeleteGuardModal'
import {
  mockCorporateTaxDb,
  mockFiscalYearsDb,
  mockObligationsDb,
  mockObjectionTemplatesDb,
  type CorporateTaxFiling,
} from '../lib/mockDb'
import type { WorkflowStep, WorkflowStepField } from '../lib/supabase'

interface Props {
  tenantId: string
  tenantName: string
}

export default function CompanyTaxCompliance({ tenantId, tenantName }: Props) {
  const [filings, setFilings] = useState<CorporateTaxFiling[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  // Admin Obligation Workflow Steps
  const [obligationSteps, setObligationSteps] = useState<WorkflowStep[]>([])
  const [activeStepIdx, setActiveStepIdx] = useState<number>(0)
  const [maxUnlockedStepIdx, setMaxUnlockedStepIdx] = useState<number>(0)

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'ADD' | 'EDIT' | 'VIEW'>('ADD')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Form Base Fields
  const [fiscalYear, setFiscalYear] = useState('سال مالی ۱۴۰۴')
  const [availableYears, setAvailableYears] = useState<string[]>([])
  const [notes, setNotes] = useState('')

  // Dynamic Stage Values: { [stepId]: { [fieldKey]: value } }
  const [stageValues, setStageValues] = useState<Record<string, Record<string, any>>>({})

  // File Upload State Mock
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, string>>({})

  // Delete Guard State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CorporateTaxFiling | null>(null)

  // Fetch data
  const loadData = () => {
    const list = mockCorporateTaxDb.getForTenant(tenantId)
    setFilings(list)

    // Load defined Fiscal Years
    const years = mockFiscalYearsDb.getForTenant(tenantId)
    if (years.length > 0) {
      setAvailableYears(years.map((y) => y.title))
    } else {
      setAvailableYears(['سال مالی ۱۴۰۴', 'سال مالی ۱۴۰۳', 'سال مالی ۱۴۰۲'])
    }

    // Connect dynamically to Admin Platform obligation (TAX_CORPORATE / ob-001)
    const corpOb = mockObligationsDb.getAll('TAX_CORPORATE')[0] || mockObligationsDb.getById('ob-001')
    
    let masterSteps: WorkflowStep[] = []

    // Priority 1: Fetch steps directly from linked Objection Template (obj-001)
    if (corpOb && corpOb.objection_template_id) {
      const tmpl = mockObjectionTemplatesDb.getById(corpOb.objection_template_id)
      if (tmpl && tmpl.steps && tmpl.steps.length > 0) {
        masterSteps = tmpl.steps.map((st, idx) => ({
          id: st.id,
          title: st.title,
          order: idx + 1,
          fields: st.fields && st.fields.length > 0 ? st.fields : [
            { id: `f-${st.id}-1`, label: 'شماره و کد ثبتی گام', key: 'reference_number', type: 'text', required: true, placeholder: 'مثال: AS-1404-7721' },
            { id: `f-${st.id}-2`, label: 'تاریخ اقدام / ابلاغ (شمسی)', key: 'action_date', type: 'date', required: true, placeholder: '1404/08/15' },
            { id: `f-${st.id}-3`, label: 'تصویر/فایل پیوست مدارک این گام', key: 'document_file', type: 'file', required: false },
          ],
        }))
      }
    }

    // Priority 2: Fallback to obligation's own workflow_steps
    if (masterSteps.length === 0 && corpOb && corpOb.workflow_steps && corpOb.workflow_steps.length > 0) {
      masterSteps = [...corpOb.workflow_steps].sort((a, b) => a.order - b.order)
    }

    if (masterSteps.length > 0) {
      setObligationSteps(masterSteps)
    }
  }

  useEffect(() => {
    loadData()
  }, [tenantId])

  const currentStepObj = obligationSteps[activeStepIdx] || obligationSteps[0]

  const handleOpenAdd = () => {
    setModalMode('ADD')
    setSelectedId(null)
    setFiscalYear(availableYears[0] || 'سال مالی ۱۴۰۴')
    setActiveStepIdx(0)
    setMaxUnlockedStepIdx(0) // Only Step 1 is unlocked initially

    const step1Id = obligationSteps[0]?.id || 's-100a'
    const step2Id = obligationSteps[1]?.id || 's-100b'

    setStageValues({
      [step1Id]: {
        assessment_number: 'AS-1404-' + Math.floor(1000 + Math.random() * 9000),
        assessment_notice_date: '1404/08/15',
        assessed_taxable_income: '۱۵,۰۰۰,۰۰۰,۰۰۰ ریال',
        assessed_tax_amount: '۳,۷۵۰,۰۰۰,۰۰۰ ریال',
      },
      [step2Id]: {
        audit_report_number: 'REP-1404-' + Math.floor(1000 + Math.random() * 9000),
        audit_report_date: '1404/08/20',
        disallowed_items: 'رد ۵۰٪ از هزینه‌های آگهی و تبلیغات به دلیل عدم ارائه مدارک مثبته',
      },
    })
    setNotes('')
    setIsModalOpen(true)
  }

  const handleOpenEdit = (item: CorporateTaxFiling) => {
    setModalMode('EDIT')
    setSelectedId(item.id)
    setFiscalYear(item.fiscal_year)
    setNotes(item.notes || '')

    const matchedIdx = obligationSteps.findIndex((s) => s.title === item.status)
    const currentIdx = matchedIdx !== -1 ? matchedIdx : 0
    setActiveStepIdx(currentIdx)

    let maxIdx = currentIdx
    if (item.stage_data) {
      setStageValues(item.stage_data)
      obligationSteps.forEach((st, idx) => {
        if (item.stage_data && item.stage_data[st.id] && Object.keys(item.stage_data[st.id]).length > 0) {
          if (idx > maxIdx) maxIdx = idx
        }
      })
    }
    setMaxUnlockedStepIdx(Math.max(maxIdx, currentIdx))
    setIsModalOpen(true)
  }

  const handleOpenView = (item: CorporateTaxFiling) => {
    setModalMode('VIEW')
    setSelectedId(item.id)
    setFiscalYear(item.fiscal_year)
    setNotes(item.notes || '')

    const matchedIdx = obligationSteps.findIndex((s) => s.title === item.status)
    const currentIdx = matchedIdx !== -1 ? matchedIdx : 0
    setActiveStepIdx(currentIdx)

    let maxIdx = currentIdx
    if (item.stage_data) {
      setStageValues(item.stage_data)
      obligationSteps.forEach((st, idx) => {
        if (item.stage_data && item.stage_data[st.id] && Object.keys(item.stage_data[st.id]).length > 0) {
          if (idx > maxIdx) maxIdx = idx
        }
      })
    }
    setMaxUnlockedStepIdx(Math.max(maxIdx, currentIdx, obligationSteps.length - 1))
    setIsModalOpen(true)
  }

  // Complete current step and automatically advance to the next step
  const handleCompleteCurrentStepAndNext = () => {
    const nextIdx = activeStepIdx + 1
    if (nextIdx < obligationSteps.length) {
      setMaxUnlockedStepIdx((prev) => Math.max(prev, nextIdx))
      setActiveStepIdx(nextIdx)
      const nextStepTitle = obligationSteps[nextIdx]?.title || 'گام بعدی'
      toast.success(`گام "${currentStepObj?.title}" ثبت گردید. گام بعدی ("${nextStepTitle}") فعال شد.`)
    } else {
      toast.success('تمامی گام‌های فرآیند دادرسی تکمیل شدند.')
    }
  }

  const updateStageFieldValue = (stepKey: string, fieldKey: string, value: any) => {
    setStageValues((prev) => ({
      ...prev,
      [stepKey]: {
        ...(prev[stepKey] || {}),
        [fieldKey]: value,
      },
    }))
  }

  const handleFileUploadMock = (fieldKey: string, fileName: string) => {
    setUploadedFiles((prev) => ({ ...prev, [fieldKey]: fileName }))
    toast.success(`فایل ${fileName} به عنوان ضمیمه بارگذاری گردید.`)
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!fiscalYear) {
      toast.error('لطفاً عنوان سال مالی را انتخاب کنید.')
      return
    }

    const currentStep = obligationSteps[activeStepIdx] || obligationSteps[0]
    const currentStatus = currentStep.title

    // Extract common high-level fields for table display
    const step2Data = stageValues['ws-001-2'] || stageValues[obligationSteps[1]?.id || ''] || {}
    const trackingNum = step2Data['tracking_number'] || ''
    const subDate = step2Data['submission_date'] || ''
    const taxInc = step2Data['taxable_income'] || ''
    const taxAmt = step2Data['tax_amount'] || ''

    if (modalMode === 'ADD') {
      mockCorporateTaxDb.create({
        tenant_id: tenantId,
        fiscal_year: fiscalYear,
        status: currentStatus,
        tracking_number: trackingNum,
        submission_date: subDate,
        taxable_income: taxInc,
        tax_amount: taxAmt,
        notes: notes.trim(),
        stage_data: stageValues,
      })
      toast.success(`رکورد مالیات بر عملکرد ${fiscalYear} در گام "${currentStatus}" ثبت شد.`)
    } else if (modalMode === 'EDIT' && selectedId) {
      mockCorporateTaxDb.update(selectedId, {
        fiscal_year: fiscalYear,
        status: currentStatus,
        tracking_number: trackingNum,
        submission_date: subDate,
        taxable_income: taxInc,
        tax_amount: taxAmt,
        notes: notes.trim(),
        stage_data: stageValues,
      })
      toast.success(`اطلاعات مالیات بر عملکرد بروزرسانی گردید.`)
    }

    setIsModalOpen(false)
    loadData()
  }

  const handleConfirmDelete = () => {
    if (deleteTarget) {
      mockCorporateTaxDb.delete(deleteTarget.id)
      toast.success(`پرونده مالیاتی ${deleteTarget.fiscal_year} حذف گردید.`)
      setDeleteModalOpen(false)
      setDeleteTarget(null)
      loadData()
    }
  }

  // Filter based on search query
  const filtered = filings.filter((item) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase().trim()
    return (
      item.fiscal_year.toLowerCase().includes(q) ||
      item.status.toLowerCase().includes(q) ||
      (item.tracking_number && item.tracking_number.toLowerCase().includes(q))
    )
  })

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Top Banner */}
      <div
        className="rounded-2xl border border-zinc-800 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg"
        style={{ background: '#141615' }}
      >
        <div className="flex items-center gap-3.5">
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-[#E5A93C]">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-zinc-100 font-bold text-lg flex items-center gap-2">
              مالیات بر عملکرد اشخاص حقوقی
            </h2>
            <p className="text-zinc-400 text-xs mt-1">
              مدیریت گام‌به‌گام و فرم‌های پویا برای هر مرحله از تکالیف مالیاتی — ({tenantName})
            </p>
          </div>
        </div>

        <Button
          onClick={handleOpenAdd}
          className="bg-[#E5A93C] hover:bg-[#d49a2d] text-[#181614] font-bold text-xs h-10 px-4 shadow gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          ثبت دوره مالیات بر عملکرد جدید
        </Button>
      </div>

      {/* Info Card */}
      <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-950/20 text-xs text-amber-200 leading-relaxed flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-amber-300">فرم‌های پویا بر اساس گام‌های مصوب ادمین:</span>
          {' '}در هر گام اجرایی، فرم اختصاصی مربوط به همان مرحله نمایش داده می‌شود. با تغییر گام، اطلاعات مربوط به آن گام به صورت مجزا ذخیره شده و فرآیند پرونده تکمیل می‌گردد.
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-[#141615] border border-zinc-800 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-amber-400 absolute right-3 top-3" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجوی سریع سال مالی، کد رهگیری یا گام اجرایی..."
            className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 pr-10 pl-9 h-10 text-xs rounded-xl focus:border-amber-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-2.5 text-zinc-400 hover:text-white p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="text-xs text-zinc-400 font-medium px-2 shrink-0">
          تعداد پرونده‌ها: <span className="text-amber-400 font-bold font-mono">{filtered.length}</span> مورد
        </div>
      </div>

      {/* Main Data Table */}
      <div className="rounded-2xl border border-zinc-800 bg-[#141615] overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400 text-xs font-bold">
                <th className="p-4 w-16 text-center">ردیف</th>
                <th className="p-4">عنوان سال مالی</th>
                <th className="p-4">گام فعلی پرونده</th>
                <th className="p-4">اطلاعات کلی / کد رهگیری</th>
                <th className="p-4 w-40 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-zinc-500">
                    هیچ داده‌ای برای مالیات بر عملکرد ثبت نشده است.
                  </td>
                </tr>
              ) : (
                filtered.map((item, index) => (
                  <tr key={item.id} className="hover:bg-zinc-900/40 transition-colors">
                    {/* 1. ردیف */}
                    <td className="p-4 text-center font-mono font-bold text-zinc-400">
                      {index + 1}
                    </td>

                    {/* 2. عنوان سال مالی */}
                    <td className="p-4 font-bold text-amber-300">
                      {item.fiscal_year}
                    </td>

                    {/* 3. وضعیت (گام ادمین) */}
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {item.status}
                      </span>
                    </td>

                    {/* 4. کد رهگیری و تاریخ */}
                    <td className="p-4 text-zinc-300">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono text-zinc-200">
                          کد رهگیری: {item.tracking_number || 'در انتظار کد رهگیری'}
                        </span>
                        {item.stage_data?.['ws-001-4']?.['assessment_number'] && (
                          <span className="text-[11px] text-amber-400 font-medium">
                            برگ تشخیص: {item.stage_data['ws-001-4']['assessment_number']}
                          </span>
                        )}
                        {item.submission_date && (
                          <span className="text-[11px] text-zinc-500">
                            تاریخ تسلیم: {item.submission_date}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 5. عملیات */}
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenView(item)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-300 hover:bg-zinc-800 transition-colors"
                          title="مشاهده پرونده"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 transition-colors"
                          title="ویرایش و ورود به فرم گام"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteTarget(item)
                            setDeleteModalOpen(true)
                          }}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                          title="حذف پرونده"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add / Edit / View with Dynamic Forms per Stage */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-3xl bg-[#1c1917] border border-zinc-800 rounded-2xl p-6 flex flex-col gap-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-white font-bold text-base flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-400" />
                {modalMode === 'ADD'
                  ? 'ثبت پرونده جدید و ورود اطلاعات گام‌ها'
                  : modalMode === 'EDIT'
                  ? 'ویرایش پرونده و فرم اختصاصی گام'
                  : 'مشاهده جزئیات پرونده مالیاتی'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col gap-5">
              {/* Year Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-white font-medium text-xs">عنوان سال مالی پرونده</Label>
                  <Select
                    disabled={modalMode === 'VIEW'}
                    value={fiscalYear}
                    onValueChange={setFiscalYear}
                  >
                    <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white h-10 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#211d1a] border-zinc-700">
                      {availableYears.map((y) => (
                        <SelectItem key={y} value={y} className="text-white text-xs">
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-white font-medium text-xs">گام فعال فعلی پرونده</Label>
                  <div className="bg-zinc-900 border border-zinc-700 rounded-lg h-10 px-3 flex items-center text-amber-400 text-xs font-bold">
                    {currentStepObj?.title || 'تعریف نشده'}
                  </div>
                </div>
              </div>

              {/* Step Progress Stepper Bar */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs text-zinc-300 font-bold flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-amber-400" />
                    مراحل گردش کار مصوب ادمین (انتخاب گام جهت ورود اطلاعات):
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-amber-400 font-mono bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                      گام فعلی: {activeStepIdx + 1} از {obligationSteps.length}
                    </span>
                    <span className="text-[11px] text-emerald-400 font-medium bg-emerald-950/40 border border-emerald-800 px-2 py-0.5 rounded-full">
                      {maxUnlockedStepIdx + 1} گام آزاد شده
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-zinc-700">
                  {obligationSteps.map((step, sIdx) => {
                    const isActive = sIdx === activeStepIdx
                    const isUnlocked = sIdx <= maxUnlockedStepIdx
                    const isCompleted = sIdx < maxUnlockedStepIdx || (stageValues[step.id] && Object.keys(stageValues[step.id]).length > 0)

                    return (
                      <button
                        type="button"
                        key={step.id}
                        disabled={!isUnlocked && modalMode !== 'VIEW'}
                        onClick={() => setActiveStepIdx(sIdx)}
                        title={!isUnlocked ? 'پس از تکمیل گام قبلی فعال می‌شود' : step.title}
                        className={`min-w-[170px] max-w-[200px] p-2.5 rounded-xl border text-right transition-all flex flex-col gap-1 shrink-0 ${
                          isActive
                            ? 'bg-amber-500/20 border-amber-500 text-amber-200 font-bold shadow-md ring-1 ring-amber-500/50'
                            : isCompleted
                            ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300 hover:border-emerald-500/80'
                            : isUnlocked
                            ? 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                            : 'bg-zinc-950/50 border-zinc-900 text-zinc-600 opacity-60 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-mono">گام #{sIdx + 1}</span>
                          {isCompleted ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : isActive ? (
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                          ) : !isUnlocked ? (
                            <Lock className="w-3 h-3 text-zinc-600" />
                          ) : null}
                        </div>
                        <span className="text-xs truncate font-medium">{step.title}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Dynamic Stage Form Fields Container */}
              <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <h4 className="text-amber-300 font-bold text-xs flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    فیلدهای اختصاصی: {currentStepObj?.title}
                  </h4>
                  <span className="text-zinc-500 text-[11px]">
                    فیلدهای تعریف‌شده توسط مدیر سیستم
                  </span>
                </div>

                {!currentStepObj?.fields || currentStepObj.fields.length === 0 ? (
                  <div className="py-6 text-center text-zinc-500 text-xs">
                    فیلد سفارشی برای این گام تعریف نشده است. می‌توانید با زدن دکمه ذخیره، پرونده را ثبت کنید.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {currentStepObj.fields.map((field: WorkflowStepField) => {
                      const stepKey = currentStepObj.id
                      const fieldVal = stageValues[stepKey]?.[field.key] ?? ''

                      if (field.type === 'checkbox') {
                        return (
                          <div
                            key={field.id}
                            className="sm:col-span-2 flex items-center gap-3 bg-zinc-900 border border-zinc-800 p-3 rounded-xl"
                          >
                            <input
                              type="checkbox"
                              disabled={modalMode === 'VIEW'}
                              id={field.id}
                              checked={Boolean(fieldVal)}
                              onChange={(e) =>
                                updateStageFieldValue(stepKey, field.key, e.target.checked)
                              }
                              className="w-4 h-4 accent-amber-500 rounded"
                            />
                            <Label
                              htmlFor={field.id}
                              className="text-white text-xs font-semibold cursor-pointer"
                            >
                              {field.label} {field.required && <span className="text-red-400">*</span>}
                            </Label>
                          </div>
                        )
                      }

                      if (field.type === 'date') {
                        return (
                          <div key={field.id} className="flex flex-col gap-1.5">
                            <JalaliDatePicker
                              disabled={modalMode === 'VIEW'}
                              label={field.label + (field.required ? ' *' : '')}
                              value={String(fieldVal || '1404/04/28')}
                              onChange={(val) => updateStageFieldValue(stepKey, field.key, val)}
                            />
                          </div>
                        )
                      }

                      if (field.type === 'select') {
                        const opts = field.options && field.options.length > 0
                          ? field.options
                          : [
                              'تمکین و پذیرش کامل برگ تشخیص (صدور برگ قطعی)',
                              'توافق با ممیز کل (ماده ۲۳۸ قانون مالیات‌ها)',
                              'عدم توافق و ارجاع به هیأت بدوی حل اختلاف مالیاتی',
                              'اعتراض به هیأت تجدیدنظر / ماده ۲۵۱ مکرر',
                            ]

                        return (
                          <div key={field.id} className="sm:col-span-2 flex flex-col gap-2">
                            <Label className="text-white text-xs font-medium">
                              {field.label} {field.required && <span className="text-red-400">*</span>}
                            </Label>
                            <Select
                              disabled={modalMode === 'VIEW'}
                              value={String(fieldVal || opts[0])}
                              onValueChange={(val) => updateStageFieldValue(stepKey, field.key, val)}
                            >
                              <SelectTrigger className="bg-zinc-900 border-zinc-700 text-amber-300 font-bold h-10 text-xs focus:border-amber-500">
                                <SelectValue placeholder="انتخاب کنید..." />
                              </SelectTrigger>
                              <SelectContent className="bg-[#211d1a] border-zinc-700 text-white">
                                {opts.map((opt) => (
                                  <SelectItem key={opt} value={opt} className="text-xs hover:bg-amber-500/10 py-2">
                                    {opt}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {/* Informational Guidance Box for Stage 5 decisions */}
                            {field.key === 'decision_type' && (
                              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 leading-relaxed mt-1 flex items-start gap-2">
                                <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold text-amber-300">راهنمای مسیر دادرسی: </span>
                                  {String(fieldVal).includes('تمکین') &&
                                    'با انتخاب تمکین، برگ تشخیص مورد پذیرش قرار گرفته و برگ قطعی مالیات صادر می‌شود.'}
                                  {String(fieldVal).includes('ماده ۲۳۸') &&
                                    'با درخواست توافق ماده ۲۳۸، ظرف ۳۰ روز از ابلاغ می‌توانید با ممیز کل مذاکره و صورت‌جلسه توافق تنظیم کنید.'}
                                  {String(fieldVal).includes('بدوی') &&
                                    'در صورت عدم توافق، پرونده جهت رسیدگی تخصصی به هیأت ۳ نفره بدوی حل اختلاف مالیاتی ارجاع می‌گردد.'}
                                  {String(fieldVal).includes('تجدیدنظر') &&
                                    'در صورت اعتراض به رای هیأت بدوی، پرونده جهت دادرسی مجدد به هیأت تجدیدنظر ارسال می‌گردد.'}
                                  {!fieldVal && 'لطفاً یکی از گزینه‌های مسیر دادرسی یا تمکین را انتخاب نمایید.'}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      }

                      if (field.type === 'file') {
                        return (
                          <div key={field.id} className="sm:col-span-2 flex flex-col gap-1.5">
                            <Label className="text-white text-xs font-medium">
                              {field.label} {field.required && <span className="text-red-400">*</span>}
                            </Label>
                            <div className="flex items-center gap-3">
                              <label
                                className={`flex-1 border border-dashed border-zinc-700 bg-zinc-900 rounded-xl p-3 flex items-center justify-between cursor-pointer hover:border-amber-500 transition-colors ${
                                  modalMode === 'VIEW' ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                              >
                                <div className="flex items-center gap-2 text-zinc-300 text-xs">
                                  <UploadCloud className="w-4 h-4 text-amber-400" />
                                  <span>
                                    {uploadedFiles[field.key] || fieldVal || 'انتخاب فایل ضمیمه (PDF / تصویر)...'}
                                  </span>
                                </div>
                                <input
                                  type="file"
                                  disabled={modalMode === 'VIEW'}
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (file) {
                                      handleFileUploadMock(field.key, file.name)
                                      updateStageFieldValue(stepKey, field.key, file.name)
                                    }
                                  }}
                                />
                                <span className="bg-zinc-800 text-zinc-200 text-[10px] px-2.5 py-1 rounded-md">
                                  مرور...
                                </span>
                              </label>
                            </div>
                          </div>
                        )
                      }

                      // Default text / number
                      return (
                        <div key={field.id} className="flex flex-col gap-1.5">
                          <Label className="text-white text-xs font-medium">
                            {field.label} {field.required && <span className="text-red-400">*</span>}
                          </Label>
                          <Input
                            disabled={modalMode === 'VIEW'}
                            value={String(fieldVal)}
                            onChange={(e) =>
                              updateStageFieldValue(stepKey, field.key, e.target.value)
                            }
                            placeholder={field.placeholder || ''}
                            className="bg-zinc-900 border-zinc-700 text-white h-10 text-xs focus:border-amber-500"
                          />
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-white font-medium text-xs">توضیحات و ملاحظات تکمیلی پرونده</Label>
                <textarea
                  disabled={modalMode === 'VIEW'}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="توضیحات مربوط به این دوره مالیاتی..."
                  className="bg-zinc-900 border border-zinc-700 text-white rounded-xl p-3 text-xs h-16 resize-none"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-zinc-800">
                <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={activeStepIdx === 0}
                    onClick={() => setActiveStepIdx((prev) => Math.max(0, prev - 1))}
                    className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 h-9 text-xs gap-1"
                  >
                    <ChevronRight className="w-4 h-4" />
                    گام قبلی
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={activeStepIdx >= maxUnlockedStepIdx || activeStepIdx === obligationSteps.length - 1}
                    onClick={() =>
                      setActiveStepIdx((prev) => Math.min(maxUnlockedStepIdx, prev + 1))
                    }
                    className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 h-9 text-xs gap-1"
                  >
                    گام بعدی
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsModalOpen(false)}
                    className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 h-9 text-xs"
                  >
                    {modalMode === 'VIEW' ? 'بستن' : 'انصراف'}
                  </Button>

                  {modalMode !== 'VIEW' && activeStepIdx < obligationSteps.length - 1 && (
                    <Button
                      type="button"
                      onClick={handleCompleteCurrentStepAndNext}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-9 text-xs px-4 gap-1.5 shadow"
                    >
                      <Check className="w-4 h-4" />
                      <span>تکمیل این گام و ورود به گام بعد</span>
                    </Button>
                  )}

                  {modalMode !== 'VIEW' && (
                    <Button
                      type="submit"
                      className="bg-[#E5A93C] hover:bg-[#d49a2d] text-[#181614] font-bold h-9 text-xs px-5 shadow"
                    >
                      ذخیره و ثبت پرونده
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && deleteTarget && (
        <DeleteGuardModal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          onConfirm={handleConfirmDelete}
          title={`حذف پرونده ${deleteTarget.fiscal_year}`}
          description={`آیا از حذف پرونده مالیات بر عملکرد ${deleteTarget.fiscal_year} اطمینان دارید؟`}
        />
      )}
    </div>
  )
}
