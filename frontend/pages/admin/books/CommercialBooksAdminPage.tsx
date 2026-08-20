import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  BookOpen,
  Plus,
  Calendar,
  Sparkles,
  Edit2,
  Trash2,
  Filter,
  Search,
  Paperclip,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  X,
  FileCheck2,
} from 'lucide-react'
import { Button } from '../../../lib/shadcn/button'
import { Input } from '../../../lib/shadcn/input'
import { Label } from '../../../lib/shadcn/label'
import { Badge } from '../../../lib/shadcn/badge'
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
import JalaliDatePicker from '../../../components/JalaliDatePicker'
import { mockCommercialBooksDb } from '../../../lib/mockDb'
import type { CommercialBookPeriod } from '../../../lib/supabase'

// Helper component for searchable Fiscal Year selection (1403 to 1600)
export function SearchableYearSelect({
  value,
  onChange,
  startYear = 1403,
  endYear = 1600,
  allowAll = false,
}: {
  value: string
  onChange: (yr: string) => void
  startYear?: number
  endYear?: number
  allowAll?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const allYears = Array.from({ length: endYear - startYear + 1 }, (_, i) => String(endYear - i))
  const filteredYears = allYears.filter((y) => y.includes(searchTerm))

  return (
    <div className="relative min-w-[140px]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full bg-zinc-900 border border-zinc-700 text-white font-bold h-10 px-3 rounded-xl flex items-center justify-between text-xs hover:border-amber-500/60 transition-all"
      >
        <span>{value === 'ALL' ? 'همه سال‌ها' : value ? `سال ${value}` : 'انتخاب سال'}</span>
        <Search className="w-3.5 h-3.5 text-amber-400 shrink-0 mr-1" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1.5 bg-[#211d1a] border border-zinc-700 rounded-xl shadow-2xl p-2.5 flex flex-col gap-2 animate-in fade-in">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute right-2.5 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="جستجوی سال (مثلاً ۱۴۰۴)..."
              className="w-full bg-zinc-900 border border-zinc-700 text-white text-xs pr-8 pl-2 py-1.5 rounded-lg focus:outline-none focus:border-amber-500 dir-rtl"
              autoFocus
            />
          </div>

          <div className="overflow-y-auto max-h-48 flex flex-col gap-0.5 pr-1">
            {allowAll && (
              <button
                type="button"
                onClick={() => {
                  onChange('ALL')
                  setOpen(false)
                  setSearchTerm('')
                }}
                className={`text-right px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  value === 'ALL' ? 'bg-[#E5A93C] text-[#181614]' : 'text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                همه سال‌ها
              </button>
            )}
            {filteredYears.length === 0 ? (
              <div className="text-center text-zinc-500 text-xs py-3">سالی با این مشخصات پیدا نشد</div>
            ) : (
              filteredYears.map((yr) => (
                <button
                  type="button"
                  key={yr}
                  onClick={() => {
                    onChange(yr)
                    setOpen(false)
                    setSearchTerm('')
                  }}
                  className={`text-right px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                    value === yr ? 'bg-[#E5A93C] text-[#181614]' : 'text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  سال {yr}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function CommercialBooksAdminPage() {
  const [fiscalYearFilter, setFiscalYearFilter] = useState('1404')
  const [periods, setPeriods] = useState<CommercialBookPeriod[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPeriod, setEditingPeriod] = useState<CommercialBookPeriod | null>(null)

  // Form State
  const [title, setTitle] = useState('')
  const [fiscalYear, setFiscalYear] = useState('1404')
  const [periodType, setPeriodType] = useState<'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL' | 'ANNUAL_SEALING'>('QUARTERLY')
  const [statutoryDeadline, setStatutoryDeadline] = useState('1404/05/31')
  const [hasExtension, setHasExtension] = useState(false)
  const [extendedDeadline, setExtendedDeadline] = useState('1405/05/31')
  const [circularNumber, setCircularNumber] = useState('')
  const [circularDate, setCircularDate] = useState('1404/05/15')
  const [attachmentName, setAttachmentName] = useState('')
  const [attachmentUrl, setAttachmentUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Preview file modal
  const [previewAttachment, setPreviewAttachment] = useState<{ url: string; name: string } | null>(null)

  const loadPeriods = () => {
    const list = mockCommercialBooksDb.getAll(fiscalYearFilter === 'ALL' ? undefined : fiscalYearFilter)
    setPeriods(list)
  }

  useEffect(() => {
    loadPeriods()
  }, [fiscalYearFilter])

  const handleOpenAdd = () => {
    setEditingPeriod(null)
    setTitle('بارگذاری سامانه دفاتر تجاری — ۳ ماهه اول')
    setFiscalYear(fiscalYearFilter === 'ALL' ? '1404' : fiscalYearFilter)
    setPeriodType('QUARTERLY')
    setStatutoryDeadline('1404/05/31')
    setHasExtension(false)
    setExtendedDeadline('1405/05/31')
    setCircularNumber('')
    setCircularDate('1404/05/15')
    setAttachmentName('')
    setAttachmentUrl('')
    setNotes('')
    setModalOpen(true)
  }

  const handleOpenEdit = (p: CommercialBookPeriod) => {
    setEditingPeriod(p)
    setTitle(p.title)
    setFiscalYear(p.fiscal_year)
    setPeriodType(p.period_type)
    setStatutoryDeadline(p.statutory_deadline)
    setHasExtension(Boolean(p.extended_deadline))
    setExtendedDeadline(p.extended_deadline || '1405/05/31')
    setCircularNumber(p.circular_number || '')
    setCircularDate(p.circular_date || '1404/05/15')
    setAttachmentName(p.attachment_name || '')
    setAttachmentUrl(p.attachment_url || '')
    setNotes(p.notes || '')
    setModalOpen(true)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) {
      toast.error('حجم فایل نباید بیشتر از ۸ مگابایت باشد.')
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      setAttachmentUrl(ev.target?.result as string)
      setAttachmentName(file.name)
      toast.success(`فایل بخشنامه "${file.name}" با موفقیت الصاق شد.`)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveAttachment = () => {
    setAttachmentName('')
    setAttachmentUrl('')
  }

  const handleDelete = (id: string, itemTitle: string) => {
    if (confirm(`آیا از حذف دوره "${itemTitle}" اطمینان دارید؟`)) {
      mockCommercialBooksDb.delete(id)
      toast.success('دوره با موفقیت حذف گردید.')
      loadPeriods()
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('عنوان دوره الزامی است.')
      return
    }
    if (!statutoryDeadline) {
      toast.error('مهلت قانونی اولیه را تعیین کنید.')
      return
    }

    setSaving(true)
    const payload = {
      title: title.trim(),
      fiscal_year: fiscalYear,
      period_type: periodType,
      statutory_deadline: statutoryDeadline,
      extended_deadline: hasExtension ? extendedDeadline : null,
      circular_number: hasExtension ? circularNumber.trim() : null,
      circular_date: hasExtension ? circularDate : null,
      attachment_url: hasExtension && attachmentUrl ? attachmentUrl : null,
      attachment_name: hasExtension && attachmentName ? attachmentName : null,
      notes: notes.trim(),
      is_active: true,
    }

    if (editingPeriod) {
      mockCommercialBooksDb.update(editingPeriod.id, payload)
      toast.success('تغییرات دوره و بخشنامه تمدید با موفقیت ذخیره گردید.')
    } else {
      mockCommercialBooksDb.create(payload)
      toast.success('دوره مهلت جدید سامانه دفاتر تجاری با موفقیت اضافه شد.')
    }

    setSaving(false)
    setModalOpen(false)
    loadPeriods()
  }

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6">
      {/* Top Banner Header */}
      <div
        className="rounded-2xl border border-zinc-800 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg"
        style={{ background: '#211d1a' }}
      >
        <div className="flex items-center gap-3.5">
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-[#E5A93C]">
            <BookOpen className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-white font-bold text-xl flex items-center gap-2">
              مدیریت دوره مهلت‌های دفاتر تجاری و بخشنامه‌ها
            </h1>
            <p className="text-zinc-400 text-xs mt-1 leading-relaxed">
              تعریف بازه‌های ۳ ماهه / ۶ ماهه / سالیانه / پلمپ سالانه طبق بخشنامه‌های جدید سازمان امور مالیاتی و الصاق فایل رسمی
            </p>
          </div>
        </div>

        <Button
          onClick={handleOpenAdd}
          className="bg-[#E5A93C] hover:bg-[#d49a2d] text-[#181614] font-bold text-xs h-10 px-5 shadow-md gap-2"
        >
          <Plus className="w-4 h-4" />
          افزودن مهلت بارگذاری / بخشنامه تمدید
        </Button>
      </div>

      {/* Filter Bar with Searchable Fiscal Year */}
      <div className="flex items-center justify-between gap-4 bg-[#1c1917] p-4 rounded-xl border border-zinc-800 flex-wrap">
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold text-zinc-300">فیلتر سال مالی (۱۴۰۳ الی ۱۶۰۰):</span>
          <SearchableYearSelect
            value={fiscalYearFilter}
            onChange={(yr) => setFiscalYearFilter(yr)}
            startYear={1403}
            endYear={1600}
            allowAll
          />
        </div>

        <div className="text-xs text-zinc-400 font-medium">
          تعداد دوره‌های ثبت‌شده: <span className="text-amber-300 font-bold font-mono">{periods.length}</span>
        </div>
      </div>

      {/* Table of Periods */}
      <div className="rounded-2xl border border-zinc-800 bg-[#1c1917] overflow-hidden shadow-xl">
        <Table>
          <TableHeader className="bg-zinc-900/90 border-b border-zinc-800">
            <TableRow>
              <TableHead className="text-zinc-300 font-bold text-xs">عنوان دوره / بارگذاری دفاتر</TableHead>
              <TableHead className="text-zinc-300 font-bold text-xs">نوع بازه</TableHead>
              <TableHead className="text-zinc-300 font-bold text-xs">سال مالی</TableHead>
              <TableHead className="text-zinc-300 font-bold text-xs">مهلت قانونی اولیه</TableHead>
              <TableHead className="text-zinc-300 font-bold text-xs">مهلت تمدیدشده (بخشنامه)</TableHead>
              <TableHead className="text-zinc-300 font-bold text-xs">بخشنامه و فایل پیوست</TableHead>
              <TableHead className="text-zinc-300 font-bold text-xs text-center">عملیات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-zinc-800/60">
            {periods.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-zinc-500 text-xs">
                  هیچ دوره‌ای برای این سال مالی تعریف نشده است.
                </TableCell>
              </TableRow>
            ) : (
              periods.map((p) => {
                const isExtended = Boolean(p.extended_deadline)
                return (
                  <TableRow key={p.id} className="hover:bg-zinc-800/40 transition-colors">
                    <TableCell className="font-bold text-zinc-100 text-xs py-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-white text-sm">{p.title}</span>
                        {p.notes && <span className="text-zinc-400 text-[11px] font-normal leading-relaxed">{p.notes}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge className="bg-zinc-800 text-zinc-200 border-zinc-700 text-[10px] font-semibold">
                        {p.period_type === 'QUARTERLY'
                          ? '۳ ماهه'
                          : p.period_type === 'SEMI_ANNUAL'
                          ? '۶ ماهه'
                          : p.period_type === 'ANNUAL'
                          ? 'سالیانه'
                          : 'پلمپ سالانه'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-amber-300 font-bold text-xs py-4">{p.fiscal_year}</TableCell>
                    <TableCell className="font-mono text-zinc-300 text-xs py-4 dir-ltr text-right">{p.statutory_deadline}</TableCell>
                    <TableCell className="py-4">
                      {isExtended ? (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-emerald-300 font-bold text-xs dir-ltr">{p.extended_deadline}</span>
                          <Badge className="bg-emerald-950/80 text-emerald-300 border-emerald-800 text-[9px]">تمدیدشده</Badge>
                        </div>
                      ) : (
                        <span className="text-zinc-500 text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-4 text-xs text-zinc-300">
                      {p.circular_number ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-amber-300 font-mono font-bold text-[11px]">شماره: {p.circular_number}</span>
                          {p.circular_date && <span className="text-zinc-400 text-[10px]">مورخ: {p.circular_date}</span>}
                          {p.attachment_url && (
                            <button
                              type="button"
                              onClick={() => setPreviewAttachment({ url: p.attachment_url!, name: p.attachment_name || 'فایل بخشنامه' })}
                              className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 underline"
                            >
                              <Paperclip className="w-3 h-3 shrink-0" />
                              <span>{p.attachment_name || 'مشاهده تصویر/PDF بخشنامه'}</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-500">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(p)}
                          className="text-amber-400 hover:bg-amber-950/40 h-8 w-8 p-0"
                          title="ویرایش مهلت و بخشنامه"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(p.id, p.title)}
                          className="text-red-400 hover:bg-red-950/40 h-8 w-8 p-0"
                          title="حذف دوره"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal Form for Adding / Editing Period & Circular Attachment */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div
            className="w-full max-w-xl rounded-2xl border border-zinc-800 p-6 flex flex-col gap-5 shadow-2xl overflow-y-auto max-h-[90vh]"
            style={{ background: '#1c1917' }}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-white font-bold text-base flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#E5A93C]" />
                {editingPeriod ? 'ویرایش دوره و بخشنامه تمدید' : 'افزودن دوره بارگذاری سامانه دفاتر تجاری'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-zinc-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-white font-medium text-xs">
                  عنوان دوره / تکلیف تجاری <span className="text-red-400">*</span>
                </Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: بارگذاری سامانه دفاتر تجاری — ۳ ماهه اول"
                  className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 h-10 text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Searchable Fiscal Year Selector (1403 to 1600) */}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-white font-medium text-xs">سال مالی (۱۴۰۳ الی ۱۶۰۰ با امکان جستجو)</Label>
                  <SearchableYearSelect
                    value={fiscalYear}
                    onChange={setFiscalYear}
                    startYear={1403}
                    endYear={1600}
                  />
                </div>

                {/* Period Type with "ANNUAL" (سالیانه) */}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-white font-medium text-xs">نوع بازه</Label>
                  <Select value={periodType} onValueChange={(v: any) => setPeriodType(v)}>
                    <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white h-10 text-xs font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#211d1a] border-zinc-700">
                      <SelectItem value="QUARTERLY" className="text-white">۳ ماهه (فصلی)</SelectItem>
                      <SelectItem value="SEMI_ANNUAL" className="text-white">۶ ماهه</SelectItem>
                      <SelectItem value="ANNUAL" className="text-white">سالیانه</SelectItem>
                      <SelectItem value="ANNUAL_SEALING" className="text-white">پلمپ سالانه</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Statutory Datepicker */}
              <JalaliDatePicker
                label="مهلت قانونی اولیه (تقویم شمسی)"
                value={statutoryDeadline}
                onChange={setStatutoryDeadline}
              />

              {/* Circular Extension Switch & File Attachment */}
              <div className="p-4 rounded-xl border border-amber-900/50 bg-amber-950/20 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    صدور بخشنامه تمدید مهلت توسط سازمان امور مالیاتی
                  </span>
                  <input
                    type="checkbox"
                    checked={hasExtension}
                    onChange={(e) => setHasExtension(e.target.checked)}
                    className="accent-[#E5A93C] w-4 h-4 rounded cursor-pointer"
                  />
                </div>

                {hasExtension && (
                  <div className="flex flex-col gap-3 pt-3 border-t border-amber-900/40">
                    <JalaliDatePicker
                      label="مهلت جدید تمدیدشده طبق بخشنامه (شمسی)"
                      value={extendedDeadline}
                      onChange={setExtendedDeadline}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-white font-medium text-xs">شماره بخشنامه سازمان</Label>
                        <Input
                          value={circularNumber}
                          onChange={(e) => setCircularNumber(e.target.value)}
                          placeholder="مثال: ۲۰۰/۱۴۰۴/۱۲۴"
                          className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 h-9 text-xs font-mono"
                          dir="ltr"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label className="text-white font-medium text-xs">تاریخ بخشنامه</Label>
                        <JalaliDatePicker
                          value={circularDate}
                          onChange={setCircularDate}
                          placeholder="انتخاب تاریخ بخشنامه..."
                          size="sm"
                        />
                      </div>
                    </div>

                    {/* Circular Document Attachment Upload (PDF or Image) */}
                    <div className="flex flex-col gap-1.5 pt-2 border-t border-amber-900/30">
                      <Label className="text-amber-200 font-bold text-xs flex items-center gap-1.5">
                        <Paperclip className="w-3.5 h-3.5 text-amber-400" />
                        الصاق تصویر یا فایل PDF بخشنامه سازمان
                      </Label>

                      {attachmentUrl ? (
                        <div className="flex items-center justify-between p-2.5 bg-zinc-900 rounded-lg border border-amber-700/60">
                          <div className="flex items-center gap-2 text-xs text-amber-300 font-medium truncate">
                            {attachmentName.endsWith('.pdf') ? (
                              <FileText className="w-4 h-4 text-red-400 shrink-0" />
                            ) : (
                              <ImageIcon className="w-4 h-4 text-blue-400 shrink-0" />
                            )}
                            <span className="truncate">{attachmentName}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => setPreviewAttachment({ url: attachmentUrl, name: attachmentName })}
                              className="p-1 text-zinc-300 hover:text-white"
                              title="پیش‌نمایش"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={handleRemoveAttachment}
                              className="p-1 text-red-400 hover:text-red-300"
                              title="حذف"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-zinc-700 hover:border-amber-500/60 rounded-xl bg-zinc-900/80 cursor-pointer transition-all">
                          <Paperclip className="w-5 h-5 text-zinc-400 mb-1" />
                          <span className="text-xs text-zinc-300 font-semibold">انتخاب یا درگ فایل PDF / تصویر بخشنامه</span>
                          <span className="text-[10px] text-zinc-500 mt-0.5">حداکثر حجم فایل: ۸ مگابایت</span>
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-white font-medium text-xs">توضیحات و خلاصه بخشنامه</Label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="توضیحات درباره نحوه ارسال صورت‌های مالی و سامانه اسناد..."
                  className="bg-zinc-900 border border-zinc-700 text-white placeholder:text-zinc-500 rounded-lg p-2.5 text-xs h-20 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalOpen(false)}
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 h-10 font-medium text-xs"
                >
                  انصراف
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-[#E5A93C] hover:bg-[#d49a2d] text-[#181614] font-bold h-10 text-xs px-6 shadow"
                >
                  {saving ? 'در حال ذخیره...' : 'ذخیره مهلت و انتشار'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attachment Preview Modal */}
      {previewAttachment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-3xl bg-[#1c1917] border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4 max-h-[90vh] shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <span className="text-white font-bold text-sm flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-amber-400" />
                تصویر / تصویر فایل بخشنامه: {previewAttachment.name}
              </span>
              <button
                type="button"
                onClick={() => setPreviewAttachment(null)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto max-h-[70vh] flex items-center justify-center bg-zinc-950 p-2 rounded-xl">
              {previewAttachment.url.startsWith('data:image/') || previewAttachment.url.match(/\.(jpeg|jpg|gif|png|webp)/i) ? (
                <img
                  src={previewAttachment.url}
                  alt={previewAttachment.name}
                  className="max-w-full max-h-[65vh] object-contain rounded-lg"
                />
              ) : (
                <iframe
                  src={previewAttachment.url}
                  title={previewAttachment.name}
                  className="w-full h-[60vh] rounded-lg border-0"
                />
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-zinc-800">
              <Button
                variant="outline"
                onClick={() => setPreviewAttachment(null)}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 h-9 text-xs"
              >
                بستن
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
