import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Receipt,
  Plus,
  Search,
  Edit2,
  Trash2,
  Eye,
  X,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react'
import { Button } from '../lib/shadcn/button'
import { Input } from '../lib/shadcn/input'
import { Label } from '../lib/shadcn/label'
import { Badge } from '../lib/shadcn/badge'
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
  mockVatTaxDb,
  mockFiscalYearsDb,
  type VatTaxFiling,
} from '../lib/mockDb'

interface Props {
  tenantId: string
  tenantName: string
}

// Admin Workflow Stages for VAT
const VAT_WORKFLOW_STAGES = [
  '۱. تکمیل چک‌لیست و تطبیق خریدهای فصلی با سامانه مؤدیان',
  '۲. ارسال اظهارنامه ارزش افزوده در my.tax.gov.ir',
  '۳. صدور قبوض و پرداخت عوارض و مالیات ارزش افزوده',
  '۴. رسیدگی و قطعی شدن مالیات ارزش افزوده',
]

export default function CompanyVatCompliance({ tenantId, tenantName }: Props) {
  const [vatFilings, setVatFilings] = useState<VatTaxFiling[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [availableYears, setAvailableYears] = useState<string[]>([])

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'ADD' | 'EDIT' | 'VIEW'>('ADD')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Form Fields
  const [fiscalYear, setFiscalYear] = useState('سال مالی ۱۴۰۴')
  const [period, setPeriod] = useState('دوره بهار (سه ماهه اول)')
  const [status, setStatus] = useState(VAT_WORKFLOW_STAGES[0])
  const [trackingNumber, setTrackingNumber] = useState('')
  const [submissionDate, setSubmissionDate] = useState('1404/04/15')
  const [vatPayable, setVatPayable] = useState('')
  const [notes, setNotes] = useState('')

  // Delete Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<VatTaxFiling | null>(null)

  const loadData = () => {
    const list = mockVatTaxDb.getForTenant(tenantId)
    setVatFilings(list)

    const fYears = mockFiscalYearsDb.getForTenant(tenantId)
    if (fYears.length > 0) {
      setAvailableYears(fYears.map((fy) => fy.title))
    } else {
      setAvailableYears(['سال مالی ۱۴۰۴', 'سال مالی ۱۴۰۳', 'سال مالی ۱۴۰۲'])
    }
  }

  useEffect(() => {
    loadData()
  }, [tenantId])

  const handleOpenAdd = () => {
    setModalMode('ADD')
    setSelectedId(null)
    setFiscalYear(availableYears[0] || 'سال مالی ۱۴۰۴')
    setPeriod('دوره بهار (سه ماهه اول)')
    setStatus(VAT_WORKFLOW_STAGES[0])
    setTrackingNumber('')
    setSubmissionDate('1404/04/15')
    setVatPayable('۴۵۰,۰۰۰,۰۰۰ ریال')
    setNotes('')
    setIsModalOpen(true)
  }

  const handleOpenEdit = (item: VatTaxFiling) => {
    setModalMode('EDIT')
    setSelectedId(item.id)
    const parts = item.fiscal_year_period.split(' - ')
    setFiscalYear(parts[0] || 'سال مالی ۱۴۰۴')
    setPeriod(parts[1] || 'دوره بهار')
    setStatus(item.status)
    setTrackingNumber(item.tracking_number || '')
    setSubmissionDate(item.submission_date || '1404/04/15')
    setVatPayable(item.vat_payable || '')
    setNotes(item.notes || '')
    setIsModalOpen(true)
  }

  const handleOpenView = (item: VatTaxFiling) => {
    setModalMode('VIEW')
    setSelectedId(item.id)
    const parts = item.fiscal_year_period.split(' - ')
    setFiscalYear(parts[0] || 'سال مالی ۱۴۰۴')
    setPeriod(parts[1] || 'دوره بهار')
    setStatus(item.status)
    setTrackingNumber(item.tracking_number || '')
    setSubmissionDate(item.submission_date || '1404/04/15')
    setVatPayable(item.vat_payable || '')
    setNotes(item.notes || '')
    setIsModalOpen(true)
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    const fullPeriodTitle = `${fiscalYear} - ${period}`

    if (modalMode === 'ADD') {
      mockVatTaxDb.create({
        tenant_id: tenantId,
        fiscal_year_period: fullPeriodTitle,
        status,
        tracking_number: trackingNumber.trim(),
        submission_date: submissionDate,
        vat_payable: vatPayable.trim(),
        notes: notes.trim(),
      })
      toast.success(`دوره ارزش افزوده ${fullPeriodTitle} با موفقیت ثبت شد.`)
    } else if (modalMode === 'EDIT' && selectedId) {
      mockVatTaxDb.update(selectedId, {
        fiscal_year_period: fullPeriodTitle,
        status,
        tracking_number: trackingNumber.trim(),
        submission_date: submissionDate,
        vat_payable: vatPayable.trim(),
        notes: notes.trim(),
      })
      toast.success(`اطلاعات ارزش افزوده بروزرسانی گردید.`)
    }

    setIsModalOpen(false)
    loadData()
  }

  const handleConfirmDelete = () => {
    if (deleteTarget) {
      mockVatTaxDb.delete(deleteTarget.id)
      toast.success(`پرونده ارزش افزوده ${deleteTarget.fiscal_year_period} حذف شد.`)
      setDeleteModalOpen(false)
      setDeleteTarget(null)
      loadData()
    }
  }

  // Filter based on search query
  const filtered = vatFilings.filter((item) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase().trim()
    return (
      item.fiscal_year_period.toLowerCase().includes(q) ||
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
            <Receipt className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-zinc-100 font-bold text-lg flex items-center gap-2">
              مالیات بر ارزش افزوده
            </h2>
            <p className="text-zinc-400 text-xs mt-1">
              مدیریت دوره سه‌ماهه ارزش افزوده، تطبیق سامانه مؤدیان و قبوض پرداخت — ({tenantName})
            </p>
          </div>
        </div>

        <Button
          onClick={handleOpenAdd}
          className="bg-[#E5A93C] hover:bg-[#d49a2d] text-[#181614] font-bold text-xs h-10 px-4 shadow gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          ثبت دوره ارزش افزوده جدید
        </Button>
      </div>

      {/* Info Notice */}
      <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-950/20 text-xs text-amber-200 leading-relaxed flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-amber-300">نکته اجرایی ارزش افزوده:</span>
          {' '}طبق مقررات سامانه مؤدیان، اعتبار خریدهای فصلی باید حتماً پیش از تسلیم اظهارنامه ارزش افزوده با صورتحساب‌های الکترونیکی تطبیق داده شود.
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
            placeholder="جستجوی دوره مالی، کد رهگیری یا وضعیت..."
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
          تعداد دوره‌ها: <span className="text-amber-400 font-bold font-mono">{filtered.length}</span> مورد
        </div>
      </div>

      {/* Table List */}
      <div className="rounded-2xl border border-zinc-800 bg-[#141615] overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400 text-xs font-bold">
                <th className="p-4 w-16 text-center">ردیف</th>
                <th className="p-4">عنوان سال مالی و دوره</th>
                <th className="p-4">وضعیت (مراحل ادمین)</th>
                <th className="p-4">کد رهگیری / مبلغ</th>
                <th className="p-4 w-40 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-zinc-500">
                    هیچ داده‌ای برای مالیات بر ارزش افزوده ثبت نشده است.
                  </td>
                </tr>
              ) : (
                filtered.map((item, index) => (
                  <tr key={item.id} className="hover:bg-zinc-900/40 transition-colors">
                    {/* 1. ردیف */}
                    <td className="p-4 text-center font-mono font-bold text-zinc-400">
                      {index + 1}
                    </td>

                    {/* 2. عنوان سال مالی و دوره */}
                    <td className="p-4 font-bold text-zinc-100 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-amber-400" />
                      <span>{item.fiscal_year_period}</span>
                    </td>

                    {/* 3. وضعیت */}
                    <td className="p-4">
                      <Badge className="bg-amber-950/80 text-amber-300 border-amber-800/80 font-bold text-xs py-1 px-3">
                        {item.status}
                      </Badge>
                    </td>

                    {/* Extra details */}
                    <td className="p-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono text-zinc-200 font-bold">
                          {item.tracking_number || 'در انتظار کد رهگیری'}
                        </span>
                        {item.vat_payable && (
                          <span className="text-[10px] text-amber-300">
                            مبلغ: {item.vat_payable}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 4. عملیات */}
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenView(item)}
                          className="h-8 w-8 p-0 text-zinc-400 hover:text-amber-300 hover:bg-zinc-800"
                          title="مشاهده"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(item)}
                          className="h-8 w-8 p-0 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800"
                          title="ویرایش"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDeleteTarget(item)
                            setDeleteModalOpen(true)
                          }}
                          className="h-8 w-8 p-0 text-zinc-400 hover:text-red-400 hover:bg-red-950/40"
                          title="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add / Edit / View */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-[#1c1917] border border-zinc-800 rounded-2xl p-6 flex flex-col gap-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-white font-bold text-base flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-400" />
                {modalMode === 'ADD'
                  ? 'ثبت دوره ارزش افزوده جدید'
                  : modalMode === 'EDIT'
                  ? 'ویرایش دوره ارزش افزوده'
                  : 'مشاهده جزئیات ارزش افزوده'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col gap-4">
              {/* Year & Period */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-white font-medium text-xs">سال مالی</Label>
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
                  <Label className="text-white font-medium text-xs">دوره فصلی</Label>
                  <Select
                    disabled={modalMode === 'VIEW'}
                    value={period}
                    onValueChange={setPeriod}
                  >
                    <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white h-10 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#211d1a] border-zinc-700">
                      <SelectItem value="دوره بهار (سه ماهه اول)" className="text-white text-xs">
                        دوره بهار (سه ماهه اول)
                      </SelectItem>
                      <SelectItem value="دوره تابستان (سه ماهه دوم)" className="text-white text-xs">
                        دوره تابستان (سه ماهه دوم)
                      </SelectItem>
                      <SelectItem value="دوره پاییز (سه ماهه سوم)" className="text-white text-xs">
                        دوره پاییز (سه ماهه سوم)
                      </SelectItem>
                      <SelectItem value="دوره زمستان (سه ماهه چهارم)" className="text-white text-xs">
                        دوره زمستان (سه ماهه چهارم)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Status Selector */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-white font-medium text-xs">وضعیت (مراحل ادمین)</Label>
                <Select
                  disabled={modalMode === 'VIEW'}
                  value={status}
                  onValueChange={setStatus}
                >
                  <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white h-10 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#211d1a] border-zinc-700">
                    {VAT_WORKFLOW_STAGES.map((st) => (
                      <SelectItem key={st} value={st} className="text-white text-xs">
                        {st}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tracking Number */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-white font-medium text-xs">کد رهگیری اظهارنامه</Label>
                <Input
                  disabled={modalMode === 'VIEW'}
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="مثال: VAT-1404-01-998"
                  className="bg-zinc-900 border-zinc-700 text-white font-mono h-10 text-xs"
                  dir="ltr"
                />
              </div>

              {/* Submission Date */}
              <JalaliDatePicker
                disabled={modalMode === 'VIEW'}
                label="تاریخ ارسال / واریز (تقویم شمسی)"
                value={submissionDate}
                onChange={setSubmissionDate}
              />

              {/* Vat Payable */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-white font-medium text-xs">مبلغ مالیات و عوارض ارزش افزوده</Label>
                <Input
                  disabled={modalMode === 'VIEW'}
                  value={vatPayable}
                  onChange={(e) => setVatPayable(e.target.value)}
                  placeholder="۴۵۰,۰۰۰,۰۰۰ ریال"
                  className="bg-zinc-900 border-zinc-700 text-white h-10 text-xs"
                />
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-white font-medium text-xs">توضیحات و یادداشت</Label>
                <textarea
                  disabled={modalMode === 'VIEW'}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="توضیحات خریدهای فصلی، قبوض ارزش افزوده یا جریمه‌های عدم تسلیم..."
                  className="bg-zinc-900 border border-zinc-700 text-white rounded-xl p-3 text-xs h-20 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 h-9 text-xs"
                >
                  {modalMode === 'VIEW' ? 'بستن' : 'انصراف'}
                </Button>
                {modalMode !== 'VIEW' && (
                  <Button
                    type="submit"
                    className="bg-[#E5A93C] hover:bg-[#d49a2d] text-[#181614] font-bold h-9 text-xs px-5"
                  >
                    ذخیره اطلاعات
                  </Button>
                )}
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
          title={`حذف دوره ${deleteTarget.fiscal_year_period}`}
          description={`آیا از حذف پرونده ارزش افزوده ${deleteTarget.fiscal_year_period} اطمینان دارید؟`}
        />
      )}
    </div>
  )
}
