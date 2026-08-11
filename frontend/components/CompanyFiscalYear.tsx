import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Calendar,
  Plus,
  Search,
  Edit2,
  Trash2,
  Eye,
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
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
import { mockFiscalYearsDb, type TenantFiscalYear } from '../lib/mockDb'

interface Props {
  tenantId: string
  tenantName: string
}

export default function CompanyFiscalYear({ tenantId, tenantName }: Props) {
  const [fiscalYears, setFiscalYears] = useState<TenantFiscalYear[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'ADD' | 'EDIT' | 'VIEW'>('ADD')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Form Fields
  const [title, setTitle] = useState('سال مالی ۱۴۰۴')
  const [startDate, setStartDate] = useState('1404/01/01')
  const [endDate, setEndDate] = useState('1404/12/29')
  const [status, setStatus] = useState<'ACTIVE' | 'CLOSED' | 'DRAFT'>('ACTIVE')

  // Delete Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<TenantFiscalYear | null>(null)

  const loadData = () => {
    const list = mockFiscalYearsDb.getForTenant(tenantId)
    setFiscalYears(list)
  }

  useEffect(() => {
    loadData()
  }, [tenantId])

  const handleOpenAdd = () => {
    setModalMode('ADD')
    setSelectedId(null)
    setTitle('سال مالی ۱۴۰۴')
    setStartDate('1404/01/01')
    setEndDate('1404/12/29')
    setStatus('ACTIVE')
    setIsModalOpen(true)
  }

  const handleOpenEdit = (fy: TenantFiscalYear) => {
    setModalMode('EDIT')
    setSelectedId(fy.id)
    setTitle(fy.title)
    setStartDate(fy.start_date)
    setEndDate(fy.end_date)
    setStatus(fy.status)
    setIsModalOpen(true)
  }

  const handleOpenView = (fy: TenantFiscalYear) => {
    setModalMode('VIEW')
    setSelectedId(fy.id)
    setTitle(fy.title)
    setStartDate(fy.start_date)
    setEndDate(fy.end_date)
    setStatus(fy.status)
    setIsModalOpen(true)
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('لطفاً عنوان سال مالی را وارد کنید.')
      return
    }
    if (!startDate || !endDate) {
      toast.error('لطفاً تاریخ شروع و پایان دوره مالی را مشخص کنید.')
      return
    }

    if (modalMode === 'ADD') {
      mockFiscalYearsDb.create({
        tenant_id: tenantId,
        title: title.trim(),
        start_date: startDate,
        end_date: endDate,
        status,
      })
      toast.success(`دوره ${title} با موفقیت تعریف گردید.`)
    } else if (modalMode === 'EDIT' && selectedId) {
      mockFiscalYearsDb.update(selectedId, {
        title: title.trim(),
        start_date: startDate,
        end_date: endDate,
        status,
      })
      toast.success(`اطلاعات ${title} بروزرسانی شد.`)
    }

    setIsModalOpen(false)
    loadData()
  }

  const handleConfirmDelete = () => {
    if (deleteTarget) {
      mockFiscalYearsDb.delete(deleteTarget.id)
      toast.success(`سال مالی "${deleteTarget.title}" حذف شد.`)
      setDeleteModalOpen(false)
      setDeleteTarget(null)
      loadData()
    }
  }

  // Filter fiscal years based on search
  const filtered = fiscalYears.filter((fy) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase().trim()
    return (
      fy.title.toLowerCase().includes(q) ||
      fy.start_date.includes(q) ||
      fy.end_date.includes(q)
    )
  })

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Header Banner */}
      <div
        className="rounded-2xl border border-zinc-800 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg"
        style={{ background: '#141615' }}
      >
        <div className="flex items-center gap-3.5">
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-[#E5A93C]">
            <Calendar className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-zinc-100 font-bold text-lg flex items-center gap-2">
              تعریف و مدیریت سال‌های مالی شرکت
            </h2>
            <p className="text-zinc-400 text-xs mt-1">
              تنظیم دقیق دوره مالی و تاریخ‌های رسمی شروع و پایان — ({tenantName})
            </p>
          </div>
        </div>

        <Button
          onClick={handleOpenAdd}
          className="bg-[#E5A93C] hover:bg-[#d49a2d] text-[#181614] font-bold text-xs h-10 px-4 shadow gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          تعریف سال مالی جدید
        </Button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-[#141615] border border-zinc-800 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-amber-400 absolute right-3 top-3" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجوی عنوان سال مالی یا تاریخ..."
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
          تعداد کل: <span className="text-amber-400 font-bold font-mono">{filtered.length}</span> سال مالی
        </div>
      </div>

      {/* Table Data List */}
      <div className="rounded-2xl border border-zinc-800 bg-[#141615] overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400 text-xs font-bold">
                <th className="p-4 w-16 text-center">ردیف</th>
                <th className="p-4">عنوان سال مالی</th>
                <th className="p-4">تاریخ شروع دوره مالی</th>
                <th className="p-4">تاریخ پایان دوره مالی</th>
                <th className="p-4">وضعیت</th>
                <th className="p-4 w-40 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-zinc-500">
                    هیچ سال مالی ثبت یا یافت نشد.
                  </td>
                </tr>
              ) : (
                filtered.map((fy, index) => (
                  <tr key={fy.id} className="hover:bg-zinc-900/40 transition-colors">
                    <td className="p-4 text-center font-mono font-bold text-zinc-400">
                      {index + 1}
                    </td>

                    <td className="p-4 font-bold text-zinc-100 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-amber-400" />
                      <span>{fy.title}</span>
                    </td>

                    <td className="p-4 font-mono font-bold text-zinc-300 dir-ltr text-right">
                      {fy.start_date}
                    </td>

                    <td className="p-4 font-mono font-bold text-zinc-300 dir-ltr text-right">
                      {fy.end_date}
                    </td>

                    <td className="p-4">
                      {fy.status === 'ACTIVE' ? (
                        <Badge className="bg-emerald-950 text-emerald-300 border-emerald-800 text-[11px] gap-1 px-2.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          دوره فعال
                        </Badge>
                      ) : fy.status === 'CLOSED' ? (
                        <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700 text-[11px] gap-1 px-2.5">
                          <Clock className="w-3 h-3 text-zinc-400" />
                          بسته شده
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-950 text-amber-300 border-amber-800 text-[11px] gap-1 px-2.5">
                          <AlertCircle className="w-3 h-3 text-amber-400" />
                          پیش‌نویس
                        </Badge>
                      )}
                    </td>

                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenView(fy)}
                          className="h-8 w-8 p-0 text-zinc-400 hover:text-amber-300 hover:bg-zinc-800"
                          title="مشاهده"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(fy)}
                          className="h-8 w-8 p-0 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800"
                          title="ویرایش"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDeleteTarget(fy)
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

      {/* Add / Edit / View Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-[#1c1917] border border-zinc-800 rounded-2xl p-6 flex flex-col gap-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-white font-bold text-base flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-400" />
                {modalMode === 'ADD'
                  ? 'تعریف سال مالی جدید'
                  : modalMode === 'EDIT'
                  ? 'ویرایش سال مالی'
                  : 'مشاهده اطلاعات سال مالی'}
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
              {/* Title Field */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-white font-medium text-xs">
                  عنوان سال مالی <span className="text-red-400">*</span>
                </Label>
                <Input
                  disabled={modalMode === 'VIEW'}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: سال مالی ۱۴۰۴"
                  className="bg-zinc-900 border-zinc-700 text-white h-10 text-xs"
                />
              </div>

              {/* Start Date Field (Jalali) */}
              <JalaliDatePicker
                disabled={modalMode === 'VIEW'}
                label="تاریخ شروع دوره مالی (تقویم شمسی)"
                value={startDate}
                onChange={(val) => setStartDate(val)}
              />

              {/* End Date Field (Jalali) */}
              <JalaliDatePicker
                disabled={modalMode === 'VIEW'}
                label="تاریخ پایان دوره مالی (تقویم شمسی)"
                value={endDate}
                onChange={(val) => setEndDate(val)}
              />

              {/* Status Select */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-white font-medium text-xs">وضعیت دوره مالی</Label>
                <Select
                  disabled={modalMode === 'VIEW'}
                  value={status}
                  onValueChange={(v: any) => setStatus(v)}
                >
                  <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white h-10 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#211d1a] border-zinc-700">
                    <SelectItem value="ACTIVE" className="text-white text-xs">
                      فعال (جاری)
                    </SelectItem>
                    <SelectItem value="CLOSED" className="text-white text-xs">
                      بسته شده
                    </SelectItem>
                    <SelectItem value="DRAFT" className="text-white text-xs">
                      پیش‌نویس
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Actions */}
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
          title={`حذف سال مالی ${deleteTarget.title}`}
          description={`آیا از حذف سال مالی "${deleteTarget.title}" اطمینان دارید؟`}
        />
      )}
    </div>
  )
}
