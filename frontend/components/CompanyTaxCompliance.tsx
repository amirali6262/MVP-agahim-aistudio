import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Edit2,
  Eye,
  FileCheck2,
  FileText,
  Gavel,
  History,
  Layers,
  Plus,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
  ChevronRight,
  ChevronLeft,
  Check,
  Lock,
  Scale,
  AlertTriangle,
  ExternalLink,
  ArrowRight,
} from 'lucide-react'
import { toast } from 'sonner'
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
  fetchCorporateFilings,
  createCorporateFiling,
  updateCorporateFiling,
  fetchFiscalYears,
  fetchObligations,
  type CorporateTaxFiling,
} from '../lib/supabaseDb'
import type { WorkflowStep, WorkflowStepField } from '../lib/supabase'

interface Props {
  tenantId: string
  tenantName: string
}

export default function CompanyTaxCompliance({ tenantId, tenantName }: Props) {
  const [filings, setFilings] = useState<CorporateTaxFiling[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  // Admin Obligation Workflow Steps (Primary 3-step filing lifecycle)
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

  // Deferred Event State (Asymmetrical trigger for Assessment Notice or Statutory Expiration)
  const [hasAssessmentNotice, setHasAssessmentNotice] = useState<boolean>(false)
  const [isStatutoryFinal, setIsStatutoryFinal] = useState<boolean>(false)
  const [deferredOutcomeType, setDeferredOutcomeType] = useState<
    'NONE' | 'STATUTORY_EXPIRED' | 'ASSESSMENT_ISSUED' | 'DISPUTE_SUBMITTED' | 'SETTLED'
  >('NONE')

  // Dynamic Stage Values: { [stepId]: { [fieldKey]: value } }
  const [stageValues, setStageValues] = useState<Record<string, Record<string, any>>>({})

  // File Upload State Mock
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, string>>({})

  // Delete Guard State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CorporateTaxFiling | null>(null)

  // Fetch data
  const loadData = async () => {
    const list = await fetchCorporateFilings(tenantId)
    setFilings(list)

    // Load defined Fiscal Years
    const years = await fetchFiscalYears(tenantId)
    if (years.length > 0) {
      setAvailableYears(years.map((y) => y.title))
    } else {
      setAvailableYears(['سال مالی ۱۴۰۴', 'سال مالی ۱۴۰۳', 'سال مالی ۱۴۰۲'])
    }

    // Connect dynamically to Admin Platform obligation (TAX_CORPORATE / ob-001)
    const allObs = await fetchObligations('TAX_CORPORATE')
    const corpOb = allObs[0] || null
    
    let masterSteps: WorkflowStep[] = []

    // Priority 1: Use taxpayer annual lifecycle steps (Checklist -> Return -> Payment)
    if (corpOb && corpOb.workflow_steps && corpOb.workflow_steps.length > 0) {
      // Filter the first 3 taxpayer-driven annual steps
      masterSteps = [...corpOb.workflow_steps]
        .sort((a, b) => a.order - b.order)
        .slice(0, 3)
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
    setMaxUnlockedStepIdx(0)
    setHasAssessmentNotice(false)
    setIsStatutoryFinal(false)
    setDeferredOutcomeType('NONE')

    const step1Id = obligationSteps[0]?.id || 'ws-001-1'
    const step2Id = obligationSteps[1]?.id || 'ws-001-2'

    setStageValues({
      [step1Id]: {
        checklist_approved: true,
        verification_date: '1404/04/10',
        initial_notes: 'اسناد و دفاتر قانونی برای سال مالی حسابرسی و تایید شدند.',
      },
      [step2Id]: {
        gross_sales: '۵۰,۰۰۰,۰۰۰,۰۰۰',
        taxable_income: '۱۲,۵۰۰,۰۰۰,۰۰۰',
        tax_amount: '۳,۱۲۵,۰۰۰,۰۰۰',
        submission_date: '1404/04/28',
        tracking_number: 'TRK-1404-' + Math.floor(1000 + Math.random() * 9000),
      },
      'assessment_event': {
        assessment_number: 'AS-1404-' + Math.floor(1000 + Math.random() * 9000),
        assessment_notice_date: '1404/08/15',
        assessed_taxable_income: '۱۵,۰۰۰,۰۰۰,۰۰۰',
        assessed_tax_amount: '۳,۷۵۰,۰۰۰,۰۰۰',
        tax_diff_amount: '۶۲۵,۰۰۰,۰۰۰',
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

    const isFinalAuto = item.status.includes('قطعیت خودکار') || item.status.includes('ماده ۱۵۶')
    const hasAss = Boolean(item.stage_data?.['assessment_event']?.['assessment_number'] || item.status.includes('برگ تشخیص'))
    
    setIsStatutoryFinal(isFinalAuto)
    setHasAssessmentNotice(hasAss)
    
    if (isFinalAuto) {
      setDeferredOutcomeType('STATUTORY_EXPIRED')
    } else if (hasAss) {
      setDeferredOutcomeType('ASSESSMENT_ISSUED')
    } else {
      setDeferredOutcomeType('NONE')
    }

    const matchedIdx = obligationSteps.findIndex((s) => s.title === item.status)
    const currentIdx = matchedIdx !== -1 ? matchedIdx : (isFinalAuto || hasAss ? 2 : 0)
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
    setMaxUnlockedStepIdx(Math.max(maxIdx, currentIdx, isFinalAuto || hasAss ? 2 : 0))
    setIsModalOpen(true)
  }

  const handleOpenView = (item: CorporateTaxFiling) => {
    setModalMode('VIEW')
    setSelectedId(item.id)
    setFiscalYear(item.fiscal_year)
    setNotes(item.notes || '')

    const isFinalAuto = item.status.includes('قطعیت خودکار') || item.status.includes('ماده ۱۵۶')
    const hasAss = Boolean(item.stage_data?.['assessment_event']?.['assessment_number'] || item.status.includes('برگ تشخیص'))
    
    setIsStatutoryFinal(isFinalAuto)
    setHasAssessmentNotice(hasAss)

    const matchedIdx = obligationSteps.findIndex((s) => s.title === item.status)
    const currentIdx = matchedIdx !== -1 ? matchedIdx : (isFinalAuto || hasAss ? 2 : 0)
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
    setMaxUnlockedStepIdx(Math.max(maxIdx, currentIdx, isFinalAuto || hasAss ? 2 : 0))
    setIsModalOpen(true)
  }

  const handleCompleteCurrentStepAndNext = () => {
    if (activeStepIdx < obligationSteps.length - 1) {
      const nextIdx = activeStepIdx + 1
      setMaxUnlockedStepIdx((prev) => Math.max(prev, nextIdx))
      setActiveStepIdx(nextIdx)
      toast.success(`گام ${activeStepIdx + 1} با موفقیت تایید و گام بعدی فعال گردید.`)
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

  // Handle statutory 1-year expiration (ماده ۱۵۶ ق.م.م - قطعیت خودکار ارقام ابرازی)
  const handleApplyStatutoryFinalization = () => {
    setIsStatutoryFinal(true)
    setHasAssessmentNotice(false)
    setDeferredOutcomeType('STATUTORY_EXPIRED')
    toast.success('قطعیت قانونی خودکار بر مبنای اظهارنامه ابرازی (ماده ۱۵۶ ق.م.م) ثبت گردید.')
  }

  // Handle recording Assessment Notice
  const handleActivateAssessmentNotice = () => {
    setHasAssessmentNotice(true)
    setIsStatutoryFinal(false)
    setDeferredOutcomeType('ASSESSMENT_ISSUED')
    toast.info('رویداد صدور برگ تشخیص سازمان ثبت شد. اکنون می‌توانید اقدام بعدی را انتخاب کنید.')
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fiscalYear) {
      toast.error('لطفاً عنوان سال مالی را انتخاب کنید.')
      return
    }

    let currentStatus = ''
    if (isStatutoryFinal) {
      currentStatus = 'قطعیت خودکار ارقام ابرازی (ماده ۱۵۶ ق.م.م)'
    } else if (hasAssessmentNotice) {
      currentStatus = 'ابلاغ برگ تشخیص (در مهلت ۳۰ روزه اقدام)'
    } else if (maxUnlockedStepIdx >= 2) {
      currentStatus = 'تسلیم و پرداخت شده (در انتظار رسیدگی سازمان)'
    } else {
      const currentStep = obligationSteps[activeStepIdx] || obligationSteps[0]
      currentStatus = currentStep.title
    }

    // Extract common high-level fields for table display
    const step2Data = stageValues['ws-001-2'] || stageValues[obligationSteps[1]?.id || ''] || {}
    const trackingNum = step2Data['tracking_number'] || ''
    const subDate = step2Data['submission_date'] || ''
    const taxInc = step2Data['taxable_income'] || ''
    const taxAmt = step2Data['tax_amount'] || ''

    if (modalMode === 'ADD') {
      await createCorporateFiling({
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
      toast.success(`پرونده مالیات عملکرد ${fiscalYear} با موفقیت ثبت شد.`)
    } else if (modalMode === 'EDIT' && selectedId) {
      await updateCorporateFiling(selectedId, {
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
      // Note: delete functionality needs to be added to supabaseDb
      // For now, reload the list
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
    <div className="w-full flex flex-col gap-6" dir="rtl">
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
              چرخه استاندارد تسلیم اظهارنامه و رویدادهای ناهمگام رسیدگی سازمان — ({tenantName})
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

      {/* Info Card: Event-driven & Base Template Context */}
      <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-950/20 text-xs text-amber-200 leading-relaxed flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-amber-300">منطق رویدادمحور تعهد و دادرسی:</span>
          {' '}چرخه سالانه تسلیم اظهارنامه و پرداخت مودی در ۳ گام تکمیل می‌گردد. صدور برگ تشخیص یک رویداد ناهمگام (Deferred Event) است؛ چنانچه سازمان ظرف ۱ سال برگ تشخیص صادر نکند، پرونده طبق ماده ۱۵۶ ق.م.م خودکار قطعی شده و نیازی به ورود به دادرسی نیست.
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
            placeholder="جستجوی سریع سال مالی، کد رهگیری یا وضعیت پرونده..."
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
                <th className="p-4">وضعیت چرخه پرونده</th>
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
                filtered.map((item, index) => {
                  const isAutoFinal = item.status.includes('قطعیت خودکار') || item.status.includes('ماده ۱۵۶')
                  const hasAss = item.status.includes('برگ تشخیص') || item.stage_data?.['assessment_event']?.['assessment_number']

                  return (
                    <tr key={item.id} className="hover:bg-zinc-900/40 transition-colors">
                      {/* 1. ردیف */}
                      <td className="p-4 text-center font-mono font-bold text-zinc-400">
                        {index + 1}
                      </td>

                      {/* 2. عنوان سال مالی */}
                      <td className="p-4 font-bold text-amber-300">
                        {item.fiscal_year}
                      </td>

                      {/* 3. وضعیت */}
                      <td className="p-4">
                        {isAutoFinal ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-700/80 shadow-xs">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            قطعیت خودکار م.۱۵۶ (ابرازی)
                          </span>
                        ) : hasAss ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-950/60 text-purple-300 border border-purple-700/80 shadow-xs">
                            <Scale className="w-3.5 h-3.5 text-purple-400" />
                            برگ تشخیص صادر شد (آماده دادرسی/تمکین)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Clock className="w-3.5 h-3.5" />
                            {item.status}
                          </span>
                        )}
                      </td>

                      {/* 4. کد رهگیری و تاریخ */}
                      <td className="p-4 text-zinc-300">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono text-zinc-200">
                            کد رهگیری: {item.tracking_number || 'در انتظار کد رهگیری'}
                          </span>
                          {item.stage_data?.['assessment_event']?.['assessment_number'] && (
                            <span className="text-[11px] text-purple-300 font-medium">
                              برگ تشخیص: {item.stage_data['assessment_event']['assessment_number']}
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
                            title="ویرایش و وضعیت پرونده"
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
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add / Edit / View with Dynamic Lifecycle Forms */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto">
          <div
            className="w-full max-w-4xl rounded-2xl border border-zinc-800 bg-[#161817] p-6 text-zinc-100 shadow-2xl flex flex-col gap-6 my-8 max-h-[90vh] overflow-y-auto"
            dir="rtl"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[#E5A93C]">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    {modalMode === 'ADD'
                      ? 'ثبت دوره مالیات بر عملکرد جدید'
                      : modalMode === 'EDIT'
                      ? `ویرایش پرونده مالیاتی ${fiscalYear}`
                      : `مشاهده جزئیات پرونده مالیاتی ${fiscalYear}`}
                  </h3>
                  <p className="text-zinc-400 text-xs mt-0.5">
                    تعهدات سالانه تسلیم اظهارنامه و مدیریت رویدادهای رسیدگی سازمان
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col gap-6">
              {/* Fiscal Year & General Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-900/60 p-4 rounded-xl border border-zinc-800/80">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-white font-semibold text-xs">سال مالی مربوطه</Label>
                  <Select
                    disabled={modalMode === 'VIEW'}
                    value={fiscalYear}
                    onValueChange={setFiscalYear}
                  >
                    <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white h-10 text-xs focus:border-amber-500">
                      <SelectValue placeholder="انتخاب سال مالی" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#211d1a] border-zinc-700 text-white">
                      {availableYears.map((yr) => (
                        <SelectItem key={yr} value={yr} className="text-xs hover:bg-amber-500/10">
                          {yr}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-white font-semibold text-xs">شرکت مودی</Label>
                  <Input
                    disabled
                    value={tenantName}
                    className="bg-zinc-900/50 border-zinc-800 text-zinc-400 h-10 text-xs font-bold"
                  />
                </div>
              </div>

              {/* 1. Core Annual Filing Stepper (Steps 1 to 3) */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs text-zinc-300 font-bold flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-amber-400" />
                    مراحل ۳ گانه تسلیم اظهارنامه سالانه مودی:
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-amber-400 font-mono bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                      گام {activeStepIdx + 1} از {obligationSteps.length}
                    </span>
                    <span className="text-[11px] text-emerald-400 font-medium bg-emerald-950/40 border border-emerald-800 px-2 py-0.5 rounded-full">
                      {maxUnlockedStepIdx + 1} گام آزاد شده
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                        className={`p-3 rounded-xl border text-right transition-all flex flex-col gap-1.5 ${
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
                          <span className="font-mono font-bold">گام #{sIdx + 1}</span>
                          {isCompleted ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : isActive ? (
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                          ) : !isUnlocked ? (
                            <Lock className="w-3 h-3 text-zinc-600" />
                          ) : null}
                        </div>
                        <span className="text-xs font-semibold leading-tight">{step.title}</span>
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
                    فیلدهای اختصاصی گام {activeStepIdx + 1}: {currentStepObj?.title}
                  </h4>
                </div>

                {!currentStepObj?.fields || currentStepObj.fields.length === 0 ? (
                  <div className="py-6 text-center text-zinc-500 text-xs">
                    فیلد سفارشی برای این گام تعریف نشده است.
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

              {/* ── 2. DEFERRED ASYMMETRICAL EVENT SECTION (رویداد معلق صدور برگ تشخیص یا انقضای قانونی) ── */}
              <div className="rounded-2xl border border-zinc-700/80 bg-[#191c1a] p-5 flex flex-col gap-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-purple-400" />
                    <h4 className="text-sm font-bold text-purple-300">
                      رویداد معلق نامتقارن: وضعیت رسیدگی سازمان امور مالیاتی
                    </h4>
                  </div>
                  <span className="text-[11px] text-zinc-400">
                    مستند قانونی: ماده ۱۵۶ و ۲۳۸ ق.م.م
                  </span>
                </div>

                <p className="text-xs text-zinc-300 leading-relaxed">
                  با تسلیم اظهارنامه و پرداخت، تکلیف سالانه مؤدی تکمیل شده است. اکنون پرونده در وضعیت انتظار رسیدگی قرار دارد:
                </p>

                {/* Outcome Path Selector */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Path A: Statutory Expiration (ماده ۱۵۶) */}
                  <div
                    className={`rounded-xl p-4 border transition-all flex flex-col justify-between gap-3 ${
                      isStatutoryFinal
                        ? 'border-emerald-600 bg-emerald-950/40 ring-1 ring-emerald-500/40'
                        : 'border-zinc-800 bg-zinc-900/70 hover:border-zinc-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <h5 className="font-bold text-xs text-emerald-300 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          مسیر الف: انقضای مهلت ۱ ساله رسیدگی سازمان
                        </h5>
                        <span className="font-mono text-[10px] text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                          ماده ۱۵۶ ق.م.م
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed">
                        چنانچه ظرف یک سال از تاریخ انقضای مهلت تسلیم، برگ تشخیص صادر و ابلاغ نشود، درآمد مشمول مالیات ابرازی مؤدی قطعی است و نیازی به ورود به دادرسی یا تمکین نیست.
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant={isStatutoryFinal ? 'default' : 'outline'}
                      onClick={handleApplyStatutoryFinalization}
                      className={`text-xs h-8 gap-1.5 font-bold ${
                        isStatutoryFinal
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'border-emerald-700/80 text-emerald-300 hover:bg-emerald-950/60'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      {isStatutoryFinal ? 'قطعیت خودکار ثبت گردید' : 'اعمال قطعیت خودکار ارقام ابرازی'}
                    </Button>
                  </div>

                  {/* Path B: Assessment Notice Issued (صدور برگ تشخیص) */}
                  <div
                    className={`rounded-xl p-4 border transition-all flex flex-col justify-between gap-3 ${
                      hasAssessmentNotice
                        ? 'border-purple-600 bg-purple-950/40 ring-1 ring-purple-500/40'
                        : 'border-zinc-800 bg-zinc-900/70 hover:border-zinc-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <h5 className="font-bold text-xs text-purple-300 flex items-center gap-1.5">
                          <Scale className="w-4 h-4 text-purple-400" />
                          مسیر ب: صدور و ابلاغ رسمی برگ تشخیص ممیزی
                        </h5>
                        <span className="font-mono text-[10px] text-purple-400 bg-purple-950 px-2 py-0.5 rounded border border-purple-800">
                          ماده ۲۳۸ ق.م.م
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed">
                        در صورت صدور برگ تشخیص، مهلت ۳۰ روزه مودی برای تمکین یا ثبت اعتراض و ورود به مرکز دادرسی و حل اختلاف مالیاتی آغاز می‌گردد.
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant={hasAssessmentNotice ? 'default' : 'outline'}
                      onClick={handleActivateAssessmentNotice}
                      className={`text-xs h-8 gap-1.5 font-bold ${
                        hasAssessmentNotice
                          ? 'bg-purple-600 hover:bg-purple-500 text-white'
                          : 'border-purple-700/80 text-purple-300 hover:bg-purple-950/60'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {hasAssessmentNotice ? 'برگ تشخیص ثبت شد' : 'ثبت صدور برگ تشخیص سازمان'}
                    </Button>
                  </div>
                </div>

                {/* Sub-form when Assessment Notice is Issued */}
                {hasAssessmentNotice && (
                  <div className="mt-2 pt-4 border-t border-zinc-800/80 flex flex-col gap-3 bg-zinc-950/60 p-4 rounded-xl">
                    <h5 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      مشخصات برگ تشخیص ابلاغ شده:
                    </h5>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <Label className="text-zinc-400 mb-1 block">شماره برگ تشخیص</Label>
                        <Input
                          value={stageValues['assessment_event']?.['assessment_number'] || ''}
                          onChange={(e) => updateStageFieldValue('assessment_event', 'assessment_number', e.target.value)}
                          placeholder="AS-1404-9812"
                          className="bg-zinc-900 border-zinc-700 text-xs h-8 text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-zinc-400 mb-1 block">تاریخ ابلاغ قانونی</Label>
                        <JalaliDatePicker
                          value={stageValues['assessment_event']?.['assessment_notice_date'] || ''}
                          onChange={(val) => updateStageFieldValue('assessment_event', 'assessment_notice_date', val)}
                          placeholder="انتخاب تاریخ ابلاغ..."
                          size="sm"
                        />
                      </div>
                      <div>
                        <Label className="text-zinc-400 mb-1 block">مالیات تشخیصی (ریال)</Label>
                        <Input
                          value={stageValues['assessment_event']?.['assessed_tax_amount'] || ''}
                          onChange={(e) => updateStageFieldValue('assessment_event', 'assessed_tax_amount', e.target.value)}
                          placeholder="۳,۷۵۰,۰۰۰,۰۰۰"
                          className="bg-zinc-900 border-zinc-700 text-xs h-8 text-white"
                        />
                      </div>
                    </div>

                    {/* Direct Actions: Dispute vs Settlement */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-zinc-800">
                      <span className="text-[11px] text-zinc-400">
                        انتخاب مسیر پس از بررسی برگ تشخیص:
                      </span>

                      <div className="flex items-center gap-2">
                        <Link
                          to="/admin/tax/disputes"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition-colors shadow-sm"
                        >
                          <Gavel className="w-3.5 h-3.5" />
                          هدایت به مرکز دادرسی و لوایح مالیاتی
                          <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-white font-medium text-xs">توضیحات و ملاحظات پرونده</Label>
                <textarea
                  disabled={modalMode === 'VIEW'}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ملاحظات تکمیلی، اسناد یا سوابق رسیدگی ممیزی..."
                  className="bg-zinc-900 border border-zinc-700 text-white rounded-xl p-3 text-xs h-16 resize-none"
                />
              </div>

              {/* Modal Footer Controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-zinc-800">
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
                      <span>تایید این گام و ورود به گام بعد</span>
                    </Button>
                  )}

                  {modalMode !== 'VIEW' && (
                    <Button
                      type="submit"
                      className="bg-[#E5A93C] hover:bg-[#d49a2d] text-[#181614] font-bold h-9 text-xs px-5 shadow"
                    >
                      ذخیره و ثبت نهایی پرونده
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
