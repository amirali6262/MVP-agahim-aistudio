import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  BookOpen,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
  Calendar,
  Sparkles,
  Clock,
  Upload,
  Paperclip,
  ExternalLink,
  X,
} from 'lucide-react'
import { Button } from '../lib/shadcn/button'
import { Input } from '../lib/shadcn/input'
import { Label } from '../lib/shadcn/label'
import { Badge } from '../lib/shadcn/badge'
import { mockCommercialBooksDb, mockFulfillmentsDb } from '../lib/mockDb'
import type { CommercialBookPeriod, TenantObligationFulfillment } from '../lib/supabase'
import { SearchableYearSelect } from '../pages/admin/books/CommercialBooksAdminPage'

interface Props {
  tenantId: string
  tenantName: string
}

export default function CompanyCommercialBooks({ tenantId, tenantName }: Props) {
  const [fiscalYear, setFiscalYear] = useState('1404')
  const [periods, setPeriods] = useState<CommercialBookPeriod[]>([])
  const [fulfillments, setFulfillments] = useState<TenantObligationFulfillment[]>([])

  // Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState<CommercialBookPeriod | null>(null)
  const [trackingNumber, setTrackingNumber] = useState('')
  const [fulfillmentDate, setFulfillmentDate] = useState('1404/05/25')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Circular Attachment Preview Modal
  const [previewAttachment, setPreviewAttachment] = useState<{ url: string; name: string } | null>(null)

  const loadData = () => {
    // Get commercial book periods for selected year
    const list = mockCommercialBooksDb.getAll(fiscalYear)
    setPeriods(list)

    // Get tenant fulfillments
    const fuls = mockFulfillmentsDb.getForTenant(tenantId)
    setFulfillments(fuls)
  }

  useEffect(() => {
    loadData()
  }, [fiscalYear, tenantId])

  const handleOpenFulfillmentModal = (p: CommercialBookPeriod) => {
    setSelectedPeriod(p)
    const existing = fulfillments.find(
      (f) => f.tenant_id === tenantId && f.fiscal_year === fiscalYear && f.shared_action_key === p.id
    )
    if (existing) {
      setTrackingNumber(existing.tracking_number || '')
      setFulfillmentDate(existing.fulfillment_date || '1404/05/25')
      setNotes(existing.notes || '')
    } else {
      setTrackingNumber('')
      setFulfillmentDate('1404/05/25')
      setNotes('')
    }
    setModalOpen(true)
  }

  const handleSubmitFulfillment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPeriod) return
    if (!trackingNumber.trim()) {
      toast.error('لطفاً کد رهگیری بارگذاری یا شماره پلمپ دفاتر را وارد کنید.')
      return
    }

    setSaving(true)
    mockFulfillmentsDb.saveFulfillment({
      tenant_id: tenantId,
      obligation_id: selectedPeriod.id,
      shared_action_key: selectedPeriod.id,
      fiscal_year: fiscalYear,
      tracking_number: trackingNumber.trim(),
      fulfillment_date: fulfillmentDate,
      notes: notes.trim(),
    })

    toast.success('کد رهگیری و شواهد دفاتر تجاری با موفقیت در سامانه ثبت شد.')
    setSaving(false)
    setModalOpen(false)
    loadData()
  }

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Top Banner & Searchable Fiscal Year Picker (1403 to 1600) */}
      <div
        className="rounded-2xl border border-zinc-800 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg"
        style={{ background: '#141615' }}
      >
        <div className="flex items-center gap-3">
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[#E5A93C]">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-zinc-100 font-bold text-lg flex items-center gap-2">
              سامانه بارگذاری دفاتر تجاری و پلمپ قانون جدید
            </h2>
            <p className="text-zinc-400 text-xs mt-0.5">
              مشاهده بخشنامه‌های تمدید مهلت سازمان و تکمیل بارگذاری ۳ ماهه/۶ ماهه/سالیانه ({tenantName})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-zinc-900/90 border border-zinc-800 p-2 rounded-xl">
          <Calendar className="w-4 h-4 text-amber-400 mr-1" />
          <span className="text-xs text-zinc-300 font-medium">سال مالی:</span>
          <SearchableYearSelect
            value={fiscalYear}
            onChange={(yr) => setFiscalYear(yr)}
            startYear={1403}
            endYear={1600}
          />
        </div>
      </div>

      {/* Info Circular Banner */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-200 leading-relaxed">
          <span className="font-bold text-amber-300">نکته کارشناسی بارگذاری سامانه دفاتر تجاری:</span>
          {' '}طبق ضوابط جدید سازمان امور مالیاتی کشور، بارگذاری اطلاعات اسناد دفاتر تجاری به صورت ۳ ماهه / ۶ ماهه / سالیانه انجام می‌شود. مهلت‌های تمدیدشده و بخشنامه‌های ابلاغی به همراه تصاویر رسمی در جدول زیر قابل دسترس هستند.
        </div>
      </div>

      {/* Commercial Book Periods List */}
      <div className="grid grid-cols-1 gap-4">
        {periods.length === 0 ? (
          <div className="text-center py-12 text-zinc-500 text-xs bg-[#141615] rounded-2xl border border-zinc-800">
            برای سال مالی {fiscalYear} هنوز مهلتی توسط ادمین ثبت نشده است.
          </div>
        ) : (
          periods.map((p) => {
            const fulfillment = fulfillments.find(
              (f) => f.tenant_id === tenantId && f.fiscal_year === fiscalYear && f.shared_action_key === p.id
            )
            const isDone = Boolean(fulfillment)
            const isExtended = Boolean(p.extended_deadline)

            return (
              <div
                key={p.id}
                className={`rounded-2xl border p-5 transition-all ${
                  isDone
                    ? 'border-emerald-800/60 bg-emerald-950/10'
                    : 'border-zinc-800 bg-[#141615]'
                }`}
              >
                <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-zinc-100 font-bold text-base">{p.title}</h3>
                      <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700 text-[10px] px-2.5">
                        {p.period_type === 'QUARTERLY'
                          ? '۳ ماهه'
                          : p.period_type === 'SEMI_ANNUAL'
                          ? '۶ ماهه'
                          : p.period_type === 'ANNUAL'
                          ? 'سالیانه'
                          : 'پلمپ سالانه'}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-zinc-400 mt-2 flex-wrap">
                      <span>
                        مهلت قانونی اولیه:{' '}
                        <span className="text-zinc-200 font-mono font-bold">{p.statutory_deadline}</span>
                      </span>

                      {isExtended && (
                        <span className="flex items-center gap-1.5 bg-emerald-950/80 border border-emerald-800/80 px-2.5 py-0.5 rounded-full text-emerald-300 font-bold text-xs">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                          مهلت تمدیدشده بخشنامه: <span className="font-mono text-white">{p.extended_deadline}</span>
                        </span>
                      )}
                    </div>

                    {p.circular_number && (
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <p className="text-amber-300/90 text-xs font-medium">
                          📜 بخشنامه سازمان امور مالیاتی: <span className="font-mono font-bold">{p.circular_number}</span> {p.circular_date && `(مورخ ${p.circular_date})`}
                        </p>
                        {p.attachment_url && (
                          <button
                            type="button"
                            onClick={() => setPreviewAttachment({ url: p.attachment_url!, name: p.attachment_name || 'فایل بخشنامه' })}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 underline bg-amber-950/60 border border-amber-800/50 px-2 py-0.5 rounded-lg"
                          >
                            <Paperclip className="w-3 h-3" />
                            <span>مشاهده تصویر / فایل بخشنامه</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    {isDone ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        تکمیل و بارگذاری‌شده
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-950/80 text-amber-300 border border-amber-800">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                        منتظر بارگذاری و ثبت
                      </span>
                    )}
                  </div>
                </div>

                {/* Fulfilled Evidence Details */}
                {fulfillment ? (
                  <div className="mt-4 pt-3 border-t border-emerald-900/40 bg-emerald-950/20 rounded-xl p-3.5 text-xs text-emerald-200 flex flex-col gap-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 font-bold text-emerald-300">
                        <FileCheck2 className="w-4 h-4 text-emerald-400" />
                        کد رهگیری سامانه بارگذاری: <span className="font-mono dir-ltr text-white bg-zinc-900 px-2.5 py-0.5 rounded border border-emerald-800/60">{fulfillment.tracking_number}</span>
                      </div>
                      <div className="flex items-center gap-1 text-emerald-400 text-[11px]">
                        <Clock className="w-3.5 h-3.5" />
                        تاریخ ثبت: {fulfillment.fulfillment_date}
                      </div>
                    </div>

                    {fulfillment.notes && (
                      <p className="text-zinc-300 text-xs mt-1 leading-relaxed">
                        توضیحات: {fulfillment.notes}
                      </p>
                    )}

                    <div className="mt-2 flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenFulfillmentModal(p)}
                        className="text-emerald-300 hover:text-white hover:bg-emerald-900/40 h-7 text-xs border border-emerald-800/50"
                      >
                        ویرایش کد رهگیری
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between flex-wrap gap-3">
                    <span className="text-zinc-400 text-xs">
                      پس از بارگذاری اطلاعات اسناد در سامانه، کد رهگیری دریافت شده را در این قسمت وارد کنید.
                    </span>
                    <Button
                      onClick={() => handleOpenFulfillmentModal(p)}
                      className="bg-[#E5A93C] hover:bg-[#d49a2d] text-[#181614] font-bold text-xs h-9 px-4 shadow"
                    >
                      <Upload className="w-4 h-4 mr-1.5" />
                      ثبت کد رهگیری بارگذاری
                    </Button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Fulfillment Registration Modal */}
      {modalOpen && selectedPeriod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div
            className="w-full max-w-lg rounded-2xl border border-zinc-800 p-6 flex flex-col gap-5 shadow-2xl"
            style={{ background: '#1c1917' }}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-white font-bold text-base flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-[#E5A93C]" />
                ثبت کد رهگیری بارگذاری سامانه دفاتر تجاری
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-zinc-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-300 font-medium">
              دوره: <span className="text-[#E5A93C] font-bold">{selectedPeriod.title}</span> (سال مالی {fiscalYear})
            </p>

            <form onSubmit={handleSubmitFulfillment} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-white font-medium text-xs">
                  کد رهگیری بارگذاری / شماره پلمپ <span className="text-red-400">*</span>
                </Label>
                <Input
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="مثال: 1404-BK-88231 یا شماره سریال بارگذاری"
                  className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 h-10 font-mono text-sm"
                  dir="ltr"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-white font-medium text-xs">
                  تاریخ بارگذاری در سامانه (شمسی)
                </Label>
                <Input
                  value={fulfillmentDate}
                  onChange={(e) => setFulfillmentDate(e.target.value)}
                  placeholder="1404/05/25"
                  className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 h-10 text-sm font-mono"
                  dir="ltr"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-white font-medium text-xs">
                  توضیحات تکمیلی (اختیاری)
                </Label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="توضیحات مربوط به تعداد سند یا فایل اکسل بارگذاری شده..."
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
                  {saving ? 'در حال ثبت...' : 'ذخیره کد رهگیری و غیرفعال‌سازی هشدارها'}
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
