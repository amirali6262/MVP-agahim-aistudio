import { useEffect, useState, useCallback, Fragment } from 'react'
import { toast } from 'sonner'
import { Plus, Edit2, Settings2, RefreshCw, AlertTriangle, ArrowUpDown, Layers, Trash2 } from 'lucide-react'
import { Button } from '../../../lib/shadcn/button'
import { Badge } from '../../../lib/shadcn/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../lib/shadcn/table'
import { fetchObligations as fetchObligationsFromDb, deleteObligation } from '../../../lib/supabaseDb'
import PenaltiesManager from './PenaltiesManager'
import type { Obligation } from '../../../lib/supabase'
import DeleteGuardModal from '../../../components/DeleteGuardModal'
import { checkObligationDependencies, type DependencyCheckResult } from '../../../lib/dependencyChecker'

interface Props {
  obligationType?: string
  onAddNew: () => void
  onEdit: (obligation: Obligation) => void
  onManageSteps: (obligation: Obligation) => void
  refreshToken: number
}

// Order phases logically for journey display
const PHASE_ORDER: Record<string, number> = {
  'مرحله قبل از اظهارنامه': 1,
  'مرحله اظهارنامه': 2,
  'مرحله پس از اظهارنامه': 3,
  'مرحله رسیدگی': 4,
  'مرحله اعتراض': 5,
  'مرحله اجرا': 6,
}

const PHASE_STYLES: Record<
  string,
  {
    pillBg: string
    stepCircle: string
    stepText: string
  }
> = {
  'مرحله قبل از اظهارنامه': {
    pillBg: 'bg-amber-950/90 text-amber-300 border-amber-800/90',
    stepCircle: 'bg-amber-900/40 border-amber-600/60 text-amber-400',
    stepText: 'text-amber-300',
  },
  'مرحله اظهارنامه': {
    pillBg: 'bg-cyan-950/90 text-cyan-300 border-cyan-800/90',
    stepCircle: 'bg-emerald-900/40 border-emerald-500/60 text-emerald-400',
    stepText: 'text-zinc-300',
  },
  'مرحله پس از اظهارنامه': {
    pillBg: 'bg-purple-950/90 text-purple-300 border-purple-800/90',
    stepCircle: 'bg-emerald-900/40 border-emerald-500/60 text-emerald-400',
    stepText: 'text-zinc-300',
  },
  'مرحله رسیدگی': {
    pillBg: 'bg-blue-950/90 text-blue-300 border-blue-800/90',
    stepCircle: 'bg-blue-900/40 border-blue-500/60 text-blue-400',
    stepText: 'text-zinc-300',
  },
  'مرحله اعتراض': {
    pillBg: 'bg-emerald-950/90 text-emerald-300 border-emerald-800/90',
    stepCircle: 'bg-emerald-900/40 border-emerald-500/60 text-emerald-400',
    stepText: 'text-zinc-300',
  },
  'مرحله اجرا': {
    pillBg: 'bg-rose-950/90 text-rose-300 border-rose-800/90',
    stepCircle: 'bg-rose-900/40 border-rose-500/60 text-rose-400',
    stepText: 'text-zinc-300',
  },
}

const DEFAULT_PHASE_STYLE = {
  pillBg: 'bg-zinc-900 text-zinc-300 border-zinc-700',
  stepCircle: 'bg-zinc-800 border-zinc-700 text-zinc-300',
  stepText: 'text-zinc-300',
}

export default function ObligationsList({ obligationType = 'TAX_CORPORATE', onAddNew, onEdit, onManageSteps, refreshToken }: Props) {
  const [obligations, setObligations] = useState<Obligation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedForPenalties, setSelectedForPenalties] = useState<Obligation | null>(null)

  // Delete Guard State
  const [itemToDelete, setItemToDelete] = useState<Obligation | null>(null)
  const [checkResult, setCheckResult] = useState<DependencyCheckResult | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const loadObligations = useCallback(async () => {
    setLoading(true)
    const raw = await fetchObligationsFromDb(obligationType === 'ALL' ? undefined : obligationType)
    
    // Sort automatically by Phase Group, then Sequence Order ascending
    const sorted = [...raw].sort((a, b) => {
      const orderA = PHASE_ORDER[a.phase_group || ''] ?? 99
      const orderB = PHASE_ORDER[b.phase_group || ''] ?? 99
      if (orderA !== orderB) return orderA - orderB
      
      const seqA = a.sequence_order ?? 999
      const seqB = b.sequence_order ?? 999
      return seqA - seqB
    })

    setObligations(sorted)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadObligations()
  }, [loadObligations, refreshToken])

  const handleInitiateDelete = async (ob: Obligation) => {
    setItemToDelete(ob)
    const res = await checkObligationDependencies(ob.id)
    setCheckResult(res)
    setDeleteModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return
    setIsDeleting(true)
    const success = await deleteObligation(itemToDelete.id)
    if (success) {
      toast.success(`تکلیف «${itemToDelete.title}» با موفقیت حذف شد.`)
      await loadObligations()
    } else {
      toast.error('خطا در حذف تکلیف.')
    }
    setIsDeleting(false)
    setDeleteModalOpen(false)
    setItemToDelete(null)
  }

  if (selectedForPenalties) {
    return (            <PenaltiesManager
        obligation={selectedForPenalties}
        onBack={() => setSelectedForPenalties(null)}
        onSaved={() => {
          setSelectedForPenalties(null)
          loadObligations()
        }}
      />
    )
  }

  // Group obligations by phase_group
  const groupedObligations = obligations.reduce((acc, ob) => {
    const phase = ob.phase_group || 'سایر تکالیف'
    if (!acc[phase]) acc[phase] = []
    acc[phase].push(ob)
    return acc
  }, {} as Record<string, Obligation[]>)

  const sortedGroupKeys = Object.keys(groupedObligations).sort((a, b) => {
    const orderA = PHASE_ORDER[a] ?? 99
    const orderB = PHASE_ORDER[b] ?? 99
    return orderA - orderB
  })

  let globalRowIndex = 0

  return (
    <div className="p-6 h-full flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-white text-xl font-bold">
            {obligationType === 'VAT'
              ? 'مالیات بر ارزش افزوده'
              : obligationType === 'TAX_CORPORATE'
              ? 'مالیات بر عملکرد اشخاص حقوقی'
              : obligationType === 'TAX_INDIVIDUAL'
              ? 'مالیات بر عملکرد اشخاص حقیقی'
              : obligationType === 'PAYROLL_TAX'
              ? 'مالیات بر درآمد حقوق'
              : obligationType === 'TAX_DUTIES'
              ? 'مالیات‌های تکلیفی'
              : obligationType === 'CLAIM_169'
              ? 'صورت معاملات فصلی (ماده ۱۶۹ مکرر)'
              : obligationType === 'INS_CONTRACT'
              ? 'حق بیمه قراردادها و لیست ماهانه'
              : obligationType === 'INS_AUDIT'
              ? 'حسابرسی بیمه‌ای دفاتر و پیمان‌ها'
              : 'مدیریت تکالیف و فرآیندهای انطباق'}
          </h2>
          <p className="text-zinc-300 text-sm mt-1">
            {obligationType === 'VAT'
              ? 'مدیریت تکالیف فصلی، اعتبارات مالیاتی، صورتحساب‌های الکترونیکی و جرایم ماده ۳۶ و ۳۷'
              : obligationType === 'TAX_CORPORATE'
              ? 'مدیریت تکالیف، تسلسل اجرا، جرایم، مراحل رسیدگی و دادرسی مالیات عملکرد حقوقی'
              : obligationType === 'TAX_INDIVIDUAL'
              ? 'مدیریت اظهارنامه اشخاص حقیقی، تبصره ماده ۱۰۰، جرایم و مراحل رسیدگی'
              : obligationType === 'PAYROLL_TAX'
              ? 'مدیریت ارسال ماهانه لیست حقوق، معافیت‌ها و مالیات مکسوره حقوق'
              : obligationType === 'TAX_DUTIES'
              ? 'مدیریت کسر و ایصال مالیات‌های تکلیفی اجاره، قراردادها و مضاربه'
              : obligationType === 'CLAIM_169'
              ? 'مدیریت ارسال فهرست معاملات فصلی، اعتبارسنجی طرف‌های معامله و جرایم مربوطه'
              : obligationType === 'INS_CONTRACT'
              ? 'مدیریت ارسال ماهانه لیست و پرداخت حق بیمه پرسنل و مفاصاحساب قراردادها'
              : obligationType === 'INS_AUDIT'
              ? 'مدیریت حسابرسی دفاتر، تطبیق دستمزد، رسیدگی هیأت‌های بدوی و تجدیدنظر تأمین اجتماعی'
              : 'مدیریت تکالیف، تسلسل اجرا، قوانین جرایم و مراحل رسیدگی'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={loadObligations}
            className="text-zinc-300 hover:text-white hover:bg-zinc-800"
            aria-label="بارگذاری مجدد"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            onClick={onAddNew}
            className="bg-[#E5A93C] hover:bg-[#d49a2d] text-[#181614] font-bold gap-2 h-9 shadow-md"
          >
            <Plus className="w-4 h-4" />
            افزودن تکلیف جدید
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'کل تکالیف', value: obligations.length },
          { label: 'فعال', value: obligations.filter((o) => o.is_active).length },
          { label: 'دارای قانون جریمه', value: obligations.filter((o) => o.penalties && o.penalties.length > 0).length },
          { label: 'دارای مراحل اجرایی', value: obligations.filter((o) => o.workflow_steps.length > 0).length },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-zinc-800 p-4"
            style={{ background: '#211d1a' }}
          >
            <p className="text-zinc-400 text-xs mb-1 font-medium">{stat.label}</p>
            <p className="text-white text-2xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Table card */}
      <div
        className="rounded-xl border border-zinc-800 overflow-hidden flex-1 shadow-md"
        style={{ background: '#211d1a' }}
      >
        {loading ? (
          <div className="p-8 flex flex-col gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-zinc-800 rounded animate-pulse" />
            ))}
          </div>
        ) : obligations.length === 0 ? (
          <div className="p-16 flex flex-col items-center gap-4 text-center">
            <Settings2 className="w-12 h-12 text-zinc-600" />
            <p className="text-zinc-300 font-medium">هنوز تکلیفی ثبت نشده است.</p>
            <Button
              onClick={onAddNew}
              className="bg-[#E5A93C] hover:bg-[#d49a2d] text-[#181614] font-bold gap-2"
            >
              <Plus className="w-4 h-4" />
              افزودن اولین تکلیف
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent bg-zinc-900/50">
                <TableHead className="text-white font-semibold text-right w-12">#</TableHead>
                <TableHead className="text-white font-semibold text-right">عنوان تکلیف</TableHead>
                <TableHead className="text-white font-semibold text-right">
                  <span className="flex items-center gap-1">
                    <ArrowUpDown className="w-3.5 h-3.5 text-[#E5A93C] ml-1" />
                    ترتیب اجرا
                  </span>
                </TableHead>
                <TableHead className="text-white font-semibold text-right">دوره تناوب</TableHead>
                <TableHead className="text-white font-semibold text-right">مسئول اجرا</TableHead>
                <TableHead className="text-white font-semibold text-right">وضعیت</TableHead>
                <TableHead className="text-white font-semibold text-right">اقدامات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedGroupKeys.map((groupName) => {
                const groupItems = groupedObligations[groupName]
                const phaseStyle = PHASE_STYLES[groupName] || DEFAULT_PHASE_STYLE

                return (
                  <Fragment key={groupName}>
                    {/* Section Pill Badge Header */}
                    <TableRow className="border-t-2 border-b border-zinc-800 bg-zinc-950/80 hover:bg-zinc-950/80">
                      <TableCell colSpan={7} className="py-2.5 px-4">
                        <div className="flex items-center justify-between">
                          <span className={`inline-flex items-center gap-1.5 px-4 py-1 rounded-full border text-xs font-bold shadow-sm ${phaseStyle.pillBg}`}>
                            <Layers className="w-3.5 h-3.5" />
                            {groupName}
                          </span>
                          <span className="text-[11px] text-zinc-300 font-medium">
                            {groupItems.length} تکلیف در این فاز
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Group Items */}
                    {groupItems.map((ob) => {
                      globalRowIndex += 1
                      return (
                        <TableRow
                          key={ob.id}
                          className="border-zinc-800/60 hover:bg-zinc-800/50 transition-colors"
                        >
                          <TableCell className="text-zinc-400 font-medium text-xs py-4 text-center">
                            {globalRowIndex}
                          </TableCell>
                          <TableCell className="text-white font-semibold py-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span>{ob.title}</span>
                              {ob.is_shared && (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-amber-950/80 text-amber-300 border border-amber-800/80 px-2 py-0.5 rounded-full font-bold">
                                  <span>🔗 تکلیف مشترک چند سرفصلی</span>
                                </span>
                              )}
                            </div>
                            {ob.objection_template_id && (
                              <span className="text-[11px] text-[#E5A93C] block mt-0.5 font-normal">
                                دارای الگوی اعتراض
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-white font-medium text-xs py-4">
                            <div className="inline-flex items-center gap-2">
                              <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold ${phaseStyle.stepCircle}`}>
                                {ob.sequence_order ?? 1}
                              </span>
                              <span className={phaseStyle.stepText}>
                                {ob.phase_group ? `${ob.phase_group} – پله ${ob.sequence_order ?? 1}` : `پله ${ob.sequence_order ?? 1}`}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-zinc-200 text-sm py-4 font-medium">
                            {ob.recurrence}
                          </TableCell>
                          <TableCell className="text-zinc-200 text-sm py-4 font-medium">
                            {ob.responsible_party}
                          </TableCell>
                          <TableCell className="py-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                ob.is_active
                                  ? 'bg-[#E5A93C]/20 text-[#E5A93C] border border-[#E5A93C]/40'
                                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                              }`}
                            >
                              {ob.is_active ? 'فعال' : 'غیرفعال'}
                            </span>
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onEdit(ob)}
                                className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 h-8 gap-1.5 text-xs"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                ویرایش
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedForPenalties(ob)}
                                className="text-amber-400 hover:text-amber-300 hover:bg-amber-950/30 h-8 gap-1.5 text-xs border border-amber-900/40"
                              >
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                                جرایم
                                {ob.penalties && ob.penalties.length > 0 && (
                                  <span className="bg-red-950 text-red-400 border border-red-800 text-[11px] font-bold px-1.5 py-0.2 rounded-full mr-1">
                                    {ob.penalties.length}
                                  </span>
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onManageSteps(ob)}
                                className="text-zinc-400 hover:text-emerald-300 hover:bg-emerald-900/30 h-8 gap-1.5 text-xs"
                              >
                                <Settings2 className="w-3.5 h-3.5" />
                                مراحل
                                {ob.workflow_steps.length > 0 && (
                                  <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-[11px] font-bold px-1.5 py-0.2 rounded-full mr-1">
                                    {ob.workflow_steps.length}
                                  </span>
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleInitiateDelete(ob)}
                                className="text-red-400 hover:text-red-300 hover:bg-red-950/40 h-8 gap-1.5 text-xs border border-red-900/30"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                حذف
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Delete Guard Modal */}
      {checkResult && itemToDelete && (
        <DeleteGuardModal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          title={itemToDelete.title}
          entityType="تکلیف مالیاتی"
          checkResult={checkResult}
          onConfirmDelete={handleConfirmDelete}
          isDeleting={isDeleting}
        />
      )}
    </div>
  )
}


