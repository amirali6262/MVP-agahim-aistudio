import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, Save, ArrowRight, CalendarClock } from 'lucide-react'
import { Button } from '../../../lib/shadcn/button'
import { Input } from '../../../lib/shadcn/input'
import { Label } from '../../../lib/shadcn/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../lib/shadcn/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../lib/shadcn/table'
import { fetchDeadlineExtensions, createDeadlineExtension, deleteDeadlineExtension, fetchObligations } from '../../../lib/supabaseDb'
import type { DeadlineExtension, Obligation } from '../../../lib/supabase'
import DeleteGuardModal from '../../../components/DeleteGuardModal'
import JalaliDatePicker from '../../../components/JalaliDatePicker'
import type { DependencyCheckResult } from '../../../lib/dependencyChecker'
import { useSelectionListOptions } from '../../../lib/selectionLists'

export default function DeadlineExtensionsPage() {
  const fiscalYears = useSelectionListOptions('fiscal_years')
  const extensionTypes = useSelectionListOptions('extension_types')
  const [extensions, setExtensions] = useState<DeadlineExtension[]>([])
  const [obligations, setObligations] = useState<Obligation[]>([])
  const [isCreating, setIsCreating] = useState(false)

  // Form Fields
  const [selectedObligationId, setSelectedObligationId] = useState('')
  const [selectedObligationTitle, setSelectedObligationTitle] = useState('')
  const [fiscalYear, setFiscalYear] = useState('۱۴۰۳')
  const [extensionType, setExtensionType] = useState<'تاریخ ثابت' | 'روزهای اضافه'>('تاریخ ثابت')
  const [value, setValue] = useState('1403/05/31')
  const [circularDescription, setCircularDescription] = useState('')

  const loadData = async () => {
    const exts = await fetchDeadlineExtensions()
    setExtensions(exts)
    const obls = await fetchObligations('TAX_CORPORATE')
    setObligations(obls)
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleOpenForm = () => {
    const defaultOb = obligations[0]
    setSelectedObligationId(defaultOb?.id || '')
    setSelectedObligationTitle(defaultOb?.title || 'اظهارنامه عملکرد حقوقی')
    setFiscalYear('۱۴۰۳')
    setExtensionType('تاریخ ثابت')
    setValue('1403/05/31')
    setCircularDescription('')
    setIsCreating(true)
  }

  const handleCloseForm = () => {
    setIsCreating(false)
  }

  const handleObligationSelect = (id: string) => {
    setSelectedObligationId(id)
    const found = obligations.find((o) => o.id === id)
    if (found) {
      setSelectedObligationTitle(found.title)
    }
  }

  const handleSave = async () => {
    if (!selectedObligationTitle) {
      toast.error('لطفاً تکلیف مورد نظر را انتخاب کنید.')
      return
    }
    if (!value.trim()) {
      toast.error('لطفاً مقدار تمدید را وارد کنید.')
      return
    }
    if (!circularDescription.trim()) {
      toast.error('شرح بخشنامه الزامی است.')
      return
    }

    await createDeadlineExtension({
      obligation_id: selectedObligationId,
      obligation_title: selectedObligationTitle,
      fiscal_year: fiscalYear,
      extension_type: extensionType,
      value: value.trim(),
      circular_description: circularDescription.trim(),
    })

    toast.success('تمدید با موفقیت ثبت شد')
    loadData()
    handleCloseForm()
  }

  // Delete Guard State
  const [itemToDelete, setItemToDelete] = useState<DeadlineExtension | null>(null)
  const [checkResult, setCheckResult] = useState<DependencyCheckResult | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)

  const handleInitiateDelete = (ext: DeadlineExtension) => {
    setItemToDelete(ext)
    // Extensions are terminal leaf nodes
    setCheckResult({
      hasDependencies: false,
      dependencies: [],
    })
    setDeleteModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return
    await deleteDeadlineExtension(itemToDelete.id)
    toast.success(`تمدید مهلت «${itemToDelete.obligation_title}» با موفقیت حذف شد.`)
    loadData()
    setDeleteModalOpen(false)
    setItemToDelete(null)
  }

  return (
    <div className="p-6 h-full flex flex-col gap-6">
      {!isCreating ? (
        <>
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-white text-xl font-bold flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-[#E5A93C]" />
                مدیریت تمدید مهلت‌ها
              </h2>
              <p className="text-zinc-300 text-sm mt-1">
                ثبت بخشنامه‌ها و تمدیدهای قانونی مهلت‌های مالیاتی
              </p>
            </div>
            <Button
              onClick={handleOpenForm}
              className="bg-[#E5A93C] hover:bg-[#d49a2d] text-[#181614] font-bold gap-2 h-9 shadow-md"
            >
              <Plus className="w-4 h-4" />
              افزودن تمدید جدید
            </Button>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-zinc-800 overflow-hidden flex-1 shadow-md" style={{ background: '#211d1a' }}>
            {extensions.length === 0 ? (
              <div className="p-16 text-center flex flex-col items-center gap-3">
                <CalendarClock className="w-10 h-10 text-zinc-600" />
                <p className="text-zinc-300 font-medium">هیچ تمدیدی ثبت نشده است.</p>
                <Button onClick={handleOpenForm} className="bg-[#E5A93C] hover:bg-[#d49a2d] text-[#181614] font-bold gap-2">
                  <Plus className="w-4 h-4" />
                  افزودن تمدید جدید
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent bg-zinc-900/50">
                    <TableHead className="text-white font-semibold text-right">تکلیف</TableHead>
                    <TableHead className="text-white font-semibold text-right">سال مالی</TableHead>
                    <TableHead className="text-white font-semibold text-right">نوع تمدید</TableHead>
                    <TableHead className="text-white font-semibold text-right">مقدار</TableHead>
                    <TableHead className="text-white font-semibold text-right">شرح بخشنامه</TableHead>
                    <TableHead className="text-white font-semibold text-right">عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {extensions.map((ext) => (
                    <TableRow key={ext.id} className="border-zinc-800 hover:bg-zinc-800/50">
                      <TableCell className="text-white font-bold py-4">
                        {ext.obligation_title}
                      </TableCell>
                      <TableCell className="text-zinc-200 py-4 font-medium">
                        {ext.fiscal_year}
                      </TableCell>
                      <TableCell className="text-zinc-200 py-4 font-medium">
                        <span className="px-2 py-0.5 rounded text-xs bg-zinc-900 border border-zinc-700 text-zinc-100 font-medium">
                          {ext.extension_type}
                        </span>
                      </TableCell>
                      <TableCell className="text-[#E5A93C] font-bold py-4 dir-ltr text-right">
                        {ext.extension_type === 'روزهای اضافه' ? `+${ext.value} روز` : ext.value}
                      </TableCell>
                      <TableCell className="text-zinc-200 text-xs py-4 max-w-sm font-medium">
                        {ext.circular_description}
                      </TableCell>
                      <TableCell className="py-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleInitiateDelete(ext)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-950/30 h-8 gap-1 text-xs"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          حذف
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </>
      ) : (
        /* Add/Edit Extension Form (Full-Screen Takeover) */
        <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: '#181614' }}>
          {/* Header */}
          <div
            className="sticky top-0 z-10 flex items-center justify-between px-6 h-16 border-b border-zinc-800"
            style={{ background: '#211d1a' }}
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCloseForm}
                className="text-zinc-300 hover:text-white transition-colors"
                aria-label="بازگشت"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-white font-bold text-base">افزودن تمدید جدید</h2>
                <p className="text-zinc-300 text-xs">ثبت و انطباق بخشنامه جدید تمدید مهلت</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseForm}
                className="border-zinc-700 text-white hover:bg-zinc-800 h-9 font-medium"
              >
                انصراف
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                className="bg-[#E5A93C] hover:bg-[#d49a2d] text-[#181614] font-bold gap-2 h-9 px-6 shadow-md"
              >
                <Save className="w-4 h-4" />
                ذخیره تمدید
              </Button>
            </div>
          </div>

          {/* Form Fields */}
          <div className="max-w-3xl mx-auto px-6 py-8">
            <div className="rounded-2xl border border-zinc-800 p-8" style={{ background: '#211d1a' }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* ۱. انتخاب تکلیف */}
                <div className="md:col-span-2 flex flex-col gap-2">
                  <Label className="text-zinc-300 text-sm">
                    انتخاب تکلیف <span className="text-red-400">*</span>
                  </Label>
                  <Select value={selectedObligationId} onValueChange={handleObligationSelect}>
                    <SelectTrigger className="bg-zinc-900 border-zinc-700 text-zinc-100 h-11">
                      <SelectValue placeholder="انتخاب کنید..." />
                    </SelectTrigger>
                    <SelectContent className="border-zinc-700" style={{ background: '#1e2020' }}>
                      {obligations.map((o) => (
                        <SelectItem key={o.id} value={o.id} className="text-zinc-100 focus:bg-zinc-700">
                          {o.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* ۲. سال مالی */}
                <div className="flex flex-col gap-2">
                  <Label className="text-zinc-300 text-sm">سال مالی</Label>
                  <Select value={fiscalYear} onValueChange={setFiscalYear}>
                    <SelectTrigger className="bg-zinc-900 border-zinc-700 text-zinc-100 h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-zinc-700" style={{ background: '#1e2020' }}>
                      {fiscalYears.map(({ key, label }) => (
                        <SelectItem key={key} value={key} className="text-zinc-100 focus:bg-zinc-700">
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* ۳. نوع تمدید */}
                <div className="flex flex-col gap-2">
                  <Label className="text-zinc-300 text-sm">نوع تمدید</Label>
                  <Select
                    value={extensionType}
                    onValueChange={(v: 'تاریخ ثابت' | 'روزهای اضافه') => {
                      setExtensionType(v)
                      if (v === 'تاریخ ثابت') setValue('1403/05/31')
                      else setValue('30')
                    }}
                  >
                    <SelectTrigger className="bg-zinc-900 border-zinc-700 text-zinc-100 h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-zinc-700" style={{ background: '#1e2020' }}>
                      {extensionTypes.map(({ key, label }) => (
                        <SelectItem key={key} value={key} className="text-zinc-100 focus:bg-zinc-700">
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* ۴. مقدار تمدید (Dynamic UI) */}
                <div className="md:col-span-2 flex flex-col gap-2">
                  <Label className="text-zinc-300 text-sm">
                    مقدار تمدید ({extensionType === 'تاریخ ثابت' ? 'تاریخ مهلت جدید' : 'تعداد روزهای اضافه'})
                  </Label>
                  {extensionType === 'تاریخ ثابت' ? (
                    <JalaliDatePicker
                      value={value}
                      onChange={setValue}
                      placeholder="انتخاب تاریخ تمدید..."
                      size="lg"
                    />
                  ) : (
                    <Input
                      type="number"
                      min={1}
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder="مثال: ۳۰"
                      className="bg-zinc-900 border-zinc-700 text-zinc-100 h-11"
                      dir="ltr"
                    />
                  )}
                </div>

                {/* ۵. شرح بخشنامه */}
                <div className="md:col-span-2 flex flex-col gap-2">
                  <Label className="text-zinc-300 text-sm">
                    شرح بخشنامه <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    value={circularDescription}
                    onChange={(e) => setCircularDescription(e.target.value)}
                    placeholder="مثال: بخشنامه ۲۰۰/۱۴۰۳ سازمان امور مالیاتی - تمدید تسلیم اظهارنامه"
                    className="bg-zinc-900 border-zinc-700 text-zinc-100 h-11"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Guard Modal */}
      {checkResult && itemToDelete && (
        <DeleteGuardModal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          title={`تمدید مهلت ${itemToDelete.obligation_title} (سال ${itemToDelete.fiscal_year})`}
          entityType="تمدید مهلت"
          checkResult={checkResult}
          onConfirmDelete={handleConfirmDelete}
        />
      )}
    </div>
  )
}
