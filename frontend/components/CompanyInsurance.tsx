import { useState } from 'react'
import { toast } from 'sonner'
import {
  ShieldCheck,
  FileCheck2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  Briefcase,
  Users,
  FileText,
  Upload,
  ChevronLeft,
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

interface Props {
  tenantId: string
  tenantName: string
  initialSubTab?: 'MONTHLY_LIST' | 'ARTICLE_38'
}

export default function CompanyInsurance({ tenantId, tenantName, initialSubTab = 'MONTHLY_LIST' }: Props) {
  const [subTab, setSubTab] = useState<'MONTHLY_LIST' | 'ARTICLE_38'>(initialSubTab)
  const [fiscalYear, setFiscalYear] = useState('1404')

  // Monthly list state
  const [monthlyRecords, setMonthlyRecords] = useState([
    {
      month: 'فروردین ۱۴۰۴',
      deadline: '1404/02/31',
      trackingNo: 'SS-1404-01-9231',
      status: 'DONE',
      date: '1404/02/28',
      personnelCount: 18,
    },
    {
      month: 'اردیبهشت ۱۴۰۴',
      deadline: '1404/03/31',
      trackingNo: 'SS-1404-02-1048',
      status: 'DONE',
      date: '1404/03/29',
      personnelCount: 19,
    },
    {
      month: 'خرداد ۱۴۰۴',
      deadline: '1404/04/31',
      trackingNo: '',
      status: 'PENDING',
      date: '',
      personnelCount: 0,
    },
    {
      month: 'تیر ۱۴۰۴',
      deadline: '1404/05/31',
      trackingNo: '',
      status: 'PENDING',
      date: '',
      personnelCount: 0,
    },
  ])

  // Article 38 contracts state
  const [contracts, setContracts] = useState([
    {
      id: 'c-1',
      title: 'پیمان توسعه نرم‌افزار جامع مالیاتی',
      contractNo: 'CNT-1403-88',
      employer: 'شرکت پتروشیمی نمونه',
      amount: '۱,۲۰۰,۰۰۰,۰۰۰ ریال',
      withheldDeposit: '۶۰,۰۰۰,۰۰۰ ریال (۵٪)',
      status: 'CLEARANCE_ISSUED', // CLEARANCE_ISSUED, AUDITING, IN_PROGRESS
      clearanceNo: 'CLR-SS-8832',
      notes: 'مفاصاحساب ماده ۳۸ صادر گردیده و ۵٪ ودیعه بیمه آزاد گردید.',
    },
    {
      id: 'c-2',
      title: 'پیمان پشتیبانی شبکه و سرورها',
      contractNo: 'CNT-1404-12',
      employer: 'سازمان منطقه آزاد',
      amount: '۸۵۰,۰۰۰,۰۰۰ ریال',
      withheldDeposit: '۴۲,۵۰۰,۰۰۰ ریال (۵٪)',
      status: 'IN_PROGRESS',
      clearanceNo: '',
      notes: 'در مرحله تکمیل پرونده کارگاهی و ارائه گزارش بازرسی تأمین اجتماعی.',
    },
  ])

  // Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<any>(null)
  const [trackingInput, setTrackingInput] = useState('')
  const [personnelInput, setPersonnelInput] = useState('19')
  const [dateInput, setDateInput] = useState('1404/04/28')

  const handleOpenMonthModal = (m: any) => {
    setSelectedMonth(m)
    setTrackingInput(m.trackingNo || '')
    setPersonnelInput(m.personnelCount ? String(m.personnelCount) : '19')
    setDateInput(m.date || '1404/04/28')
    setModalOpen(true)
  }

  const handleSaveMonth = (e: React.FormEvent) => {
    e.preventDefault()
    if (!trackingInput.trim()) {
      toast.error('لطفاً کد رهگیری سامانه eservices.tamin.ir را وارد کنید.')
      return
    }

    setMonthlyRecords((prev) =>
      prev.map((item) =>
        item.month === selectedMonth.month
          ? {
              ...item,
              trackingNo: trackingInput.trim(),
              status: 'DONE',
              date: dateInput,
              personnelCount: Number(personnelInput) || 1,
            }
          : item
      )
    )

    toast.success(`کد رهگیری لیست بیمه ${selectedMonth.month} با موفقیت ثبت شد.`)
    setModalOpen(false)
  }

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Top Banner */}
      <div
        className="rounded-2xl border border-zinc-800 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg"
        style={{ background: '#141615' }}
      >
        <div className="flex items-center gap-3.5">
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-zinc-100 font-bold text-lg flex items-center gap-2">
              ماژول بیمه و سازمان تأمین اجتماعی
            </h2>
            <p className="text-zinc-400 text-xs mt-1">
              مدیریت لیست بیمه ماهانه (ماده ۳۹) و استعلام مفاصاحساب پیمان‌ها (ماده ۳۸) — ({tenantName})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-zinc-900/90 border border-zinc-800 p-2 rounded-xl">
          <Calendar className="w-4 h-4 text-emerald-400 mr-1" />
          <span className="text-xs text-zinc-300 font-medium">سال مالی:</span>
          <Select value={fiscalYear} onValueChange={setFiscalYear}>
            <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white font-bold h-8 text-xs w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-zinc-700 bg-[#211d1a]">
              <SelectItem value="1404" className="text-white">۱۴۰۴</SelectItem>
              <SelectItem value="1403" className="text-white">۱۴۰۳</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setSubTab('MONTHLY_LIST')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
            subTab === 'MONTHLY_LIST'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 border border-zinc-800'
          }`}
        >
          <Users className="w-4 h-4" />
          ارسال لیست حقوق و بیمه ماهانه (ماده ۳۹)
        </button>

        <button
          onClick={() => setSubTab('ARTICLE_38')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
            subTab === 'ARTICLE_38'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 border border-zinc-800'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          استعلام مفاصاحساب پیمان‌ها (ماده ۳۸)
        </button>
      </div>

      {/* View Content */}
      {subTab === 'MONTHLY_LIST' ? (
        <div className="flex flex-col gap-4">
          <div className="p-4 rounded-xl border border-emerald-900/50 bg-emerald-950/20 text-xs text-emerald-200 leading-relaxed">
            <span className="font-bold text-emerald-300">قانون ماده ۳۹ تأمین اجتماعی:</span>
            {' '}ارسال لیست بیمه و پرداخت حق‌بیمه ماهانه (۳۰ درصد شامل ۲۳٪ سهم کارفرما و ۷٪ سهم بیمه‌شده) حداکثر تا آخرین روز ماه بعد الزامی است. عدم ارسال لیست مشمول ۲٪ جریمه عدم ارسال و ۲٪ جریمه تأخیر در پرداخت ماهانه می‌گردد.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {monthlyRecords.map((m, idx) => (
              <div
                key={idx}
                className={`rounded-2xl border p-5 transition-all ${
                  m.status === 'DONE'
                    ? 'border-emerald-800/60 bg-emerald-950/10'
                    : 'border-zinc-800 bg-[#141615]'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-white font-bold text-sm">{m.month}</span>
                  {m.status === 'DONE' ? (
                    <Badge className="bg-emerald-950 text-emerald-300 border-emerald-800 text-[10px] gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      ارسال‌شده
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-950 text-amber-300 border-amber-800 text-[10px] gap-1">
                      <AlertCircle className="w-3 h-3 text-amber-400" />
                      منتظر ارسال لیست
                    </Badge>
                  )}
                </div>

                <div className="flex flex-col gap-2 text-xs text-zinc-300">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">مهلت قانونی ارسال:</span>
                    <span className="font-mono text-zinc-200 font-bold">{m.deadline}</span>
                  </div>

                  {m.status === 'DONE' ? (
                    <>
                      <div className="flex items-center justify-between bg-zinc-900 p-2 rounded-lg border border-emerald-900/60 mt-1">
                        <span className="text-emerald-400 font-medium">کد رهگیری:</span>
                        <span className="font-mono text-white font-bold">{m.trackingNo}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-zinc-400">
                        <span>تعداد پرسنل بیمه‌شده: <strong className="text-white">{m.personnelCount} نفر</strong></span>
                        <span>تاریخ ارسال: <strong className="text-zinc-300">{m.date}</strong></span>
                      </div>
                    </>
                  ) : (
                    <div className="text-amber-300/80 text-[11px] mt-1">
                      ⚠️ پس از دریافت برگ پرداخت از سامانه eservices.tamin.ir کد رهگیری را ثبت کنید.
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-800 flex justify-end">
                  <Button
                    onClick={() => handleOpenMonthModal(m)}
                    className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs h-8 px-4"
                  >
                    {m.status === 'DONE' ? 'ویرایش کد رهگیری' : 'ثبت کد رهگیری ارسال'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Article 38 Contracts */
        <div className="flex flex-col gap-4">
          <div className="p-4 rounded-xl border border-emerald-900/50 bg-emerald-950/20 text-xs text-emerald-200 leading-relaxed">
            <span className="font-bold text-emerald-300">ماده ۳۸ قانون تأمین اجتماعی:</span>
            {' '}کارفرمایان مکلف‌اند ۵٪ از کل مبلغ پیمان را تا ارائه گواهی مفاصاحساب سازمان تأمین اجتماعی نزد خود نگه‌دارند. ثبت آخرین وضعیت گواهی‌های مفاصاحساب پیمانکاری در این قسمت انجام می‌شود.
          </div>

          <div className="grid grid-cols-1 gap-4">
            {contracts.map((c) => (
              <div key={c.id} className="rounded-2xl border border-zinc-800 bg-[#141615] p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-zinc-100 font-bold text-base mb-1">{c.title}</h3>
                    <div className="flex items-center gap-3 text-xs text-zinc-400">
                      <span>شماره قرارداد: <strong className="text-amber-300 font-mono">{c.contractNo}</strong></span>
                      <span>واگذارکننده کار: <strong className="text-zinc-200">{c.employer}</strong></span>
                    </div>
                  </div>

                  {c.status === 'CLEARANCE_ISSUED' ? (
                    <Badge className="bg-emerald-950 text-emerald-300 border-emerald-800 text-xs font-bold gap-1 px-3 py-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      مفاصاحساب صادر گردید (آزادسازی ودیعه)
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-950 text-amber-300 border-amber-800 text-xs font-bold gap-1 px-3 py-1">
                      <Clock className="w-4 h-4 text-amber-400" />
                      در مرحله بازرسی و مکاتبه
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-zinc-900/80 p-3 rounded-xl border border-zinc-800 text-xs">
                  <div>
                    <span className="text-zinc-500">مبلغ کل قرارداد:</span>{' '}
                    <span className="text-zinc-200 font-bold">{c.amount}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">مبلغ ودیعه ۵٪ سپرده بیمه:</span>{' '}
                    <span className="text-emerald-300 font-bold">{c.withheldDeposit}</span>
                  </div>
                  {c.clearanceNo && (
                    <div className="col-span-1 sm:col-span-2">
                      <span className="text-zinc-500">شماره مفاصاحساب صادره:</span>{' '}
                      <span className="text-amber-400 font-mono font-bold">{c.clearanceNo}</span>
                    </div>
                  )}
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed">{c.notes}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && selectedMonth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-[#1c1917] border border-zinc-800 rounded-2xl p-6 flex flex-col gap-4 shadow-2xl">
            <h3 className="text-white font-bold text-base flex items-center gap-2 border-b border-zinc-800 pb-3">
              <FileCheck2 className="w-5 h-5 text-emerald-400" />
              ثبت کد رهگیری ارسال لیست بیمه — {selectedMonth.month}
            </h3>

            <form onSubmit={handleSaveMonth} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-white font-medium text-xs">کد رهگیری دریافت شده از eservices.tamin.ir</Label>
                <Input
                  value={trackingInput}
                  onChange={(e) => setTrackingInput(e.target.value)}
                  placeholder="مثال: SS-1404-03-8821"
                  className="bg-zinc-900 border-zinc-700 text-white h-10 font-mono text-sm"
                  dir="ltr"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-white font-medium text-xs">تعداد پرسنل</Label>
                  <Input
                    type="number"
                    value={personnelInput}
                    onChange={(e) => setPersonnelInput(e.target.value)}
                    className="bg-zinc-900 border-zinc-700 text-white h-10 text-xs font-mono"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-white font-medium text-xs">تاریخ ارسال</Label>
                  <Input
                    value={dateInput}
                    onChange={(e) => setDateInput(e.target.value)}
                    className="bg-zinc-900 border-zinc-700 text-white h-10 text-xs font-mono"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalOpen(false)}
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 h-9 text-xs"
                >
                  انصراف
                </Button>
                <Button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-9 text-xs px-5"
                >
                  ذخیره اطلاعات
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
