import { useState } from 'react'
import { toast } from 'sonner'
import {
  Gavel,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Download,
  Plus,
  Send,
  Building2,
  FileCheck2,
  Info,
} from 'lucide-react'
import { Button } from '../lib/shadcn/button'
import { Badge } from '../lib/shadcn/badge'
import { Input } from '../lib/shadcn/input'
import { Label } from '../lib/shadcn/label'

interface Props {
  tenantId: string
  tenantName: string
}

export default function CompanyTaxDisputes({ tenantId, tenantName }: Props) {
  const [activeStage, setActiveStage] = useState<string>('m238')
  const [selectedPet, setSelectedPet] = useState<any>(null)

  // Litigation stages definition according to Iranian Direct Tax Code
  const stages = [
    { id: 'm238', title: 'ماده ۲۳۸ (توافق با ممیز/رئیس امور)', deadline: '۳۰ روز از ابلاغ', level: 'مرحله اول' },
    { id: 'm244', title: 'هیأت بدوی (ماده ۲۴۴)', deadline: 'ارسال پرونده به هیأت', level: 'مرحله دوم' },
    { id: 'm247', title: 'هیأت تجدیدنظر (ماده ۲۴۷)', deadline: '۲۰ روز از ابلاغ رأی بدوی', level: 'مرحله سوم' },
    { id: 'm251', title: 'شورای عالی مالیاتی (ماده ۲۵۱)', deadline: '۱ ماه از ابلاغ رأی تجدیدنظر', level: 'مرحله چهارم' },
    { id: 'm251m', title: 'ماده ۲۵۱ مکرر (وزیر اقتصاد)', deadline: 'ادعای غیرعادلانه بودن', level: 'مرحله ویژه' },
    { id: 'divan', title: 'دیوان عدالت اداری', deadline: '۳ ماه از ابلاغ رأی قطعی', level: 'مرحله قضایی' },
  ]

  // Mock Active Dispute Petitions for this company
  const [disputes, setDisputes] = useState([
    {
      id: 'disp-01',
      assessmentNo: '1403/99201/01',
      type: 'مالیات بر عملکرد سال ۱۴۰۲',
      issuedAmount: '۴,۵۰۰,۰۰۰,۰۰۰ ریال',
      claimedAmount: '۱,۲۰۰,۰۰۰,۰۰۰ ریال',
      noticeDate: '1403/04/10',
      currentStage: 'm238',
      stageName: 'ماده ۲۳۸ ق.م.م (توافق با رئیس امور)',
      remainingDays: 12,
      status: 'IN_REVIEW',
      petitionText: `بسمه تعالی\nریاست محترم امور مالیاتی...\nاحتراماً پیرو برگ تشخیص شماره 1403/99201/01 به استحضار می‌رساند اقلام درآمدی شرکت طبق دفاتر پلمپ شده قانونی ثبت گردیده و هزینه‌های سال ۱۴۰۲ بر اساس ضوابط مواد ۱۴۷ و ۱۴۸ قانون مالیات‌های مستقیم بوده است. لذا درخواست تعدیل درآمد مشمول مالیات مورد استدعاست.`,
    },
    {
      id: 'disp-02',
      assessmentNo: '1402/11029/04',
      type: 'ارزش افزوده دوره زمستان ۱۴۰۱',
      issuedAmount: '۱,۸۰۰,۰۰۰,۰۰۰ ریال',
      claimedAmount: '۳۵۰,۰۰۰,۰۰۰ ریال',
      noticeDate: '1403/01/15',
      currentStage: 'm247',
      stageName: 'هیأت حل اختلاف تجدیدنظر (ماده ۲۴۷)',
      remainingDays: 5,
      status: 'HEARING_SCHEDULED',
      hearingDate: '1404/05/28 ساعت ۱۰:۳۰',
      petitionText: `هیأت محترم تجدیدنظر حل اختلاف مالیاتی...\nبا توجه به اینکه اعتبار مالیاتی خریدهای فصلی بر اساس صورتحساب‌های الکترونیکی سامانه مؤدیان تایید گردیده است، رد اعتبار مالیاتی توسط هیأت بدوی فاقد وجاهت قانونی است...`,
    },
  ])

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Top Banner */}
      <div
        className="rounded-2xl border border-zinc-800 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg"
        style={{ background: '#141615' }}
      >
        <div className="flex items-center gap-3.5">
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-[#E5A93C]">
            <Gavel className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-zinc-100 font-bold text-lg flex items-center gap-2">
              سامانه جامع لوایح، اعتراضات و دادرسی مالیاتی
            </h2>
            <p className="text-zinc-400 text-xs mt-1">
              مدیریت مراحل دادرسی از ماده ۲۳۸ تا شورای عالی و دیوان عدالت اداری — ({tenantName})
            </p>
          </div>
        </div>

        <Button
          onClick={() => toast.info('جهت ثبت اعتراض جدید، برگ تشخیص/مطالبه مربوطه را از بخش عملکرد یا ارزش افزوده انتخاب کنید.')}
          className="bg-[#E5A93C] hover:bg-[#d49a2d] text-[#181614] font-bold text-xs h-10 px-4 shadow gap-2"
        >
          <Plus className="w-4 h-4" />
          تنظیم لایحه اعتراض جدید
        </Button>
      </div>

      {/* Litigation Workflow Stages Bar */}
      <div className="bg-[#141615] border border-zinc-800 p-4 rounded-2xl flex flex-col gap-3">
        <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
          <Gavel className="w-4 h-4 text-amber-400" />
          چرخه و مراحل الگوی جامع دادرسی مالیات‌های مستقیم:
        </span>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
          {stages.map((st, i) => (
            <button
              key={st.id}
              onClick={() => setActiveStage(st.id)}
              className={`p-3 rounded-xl border text-right flex flex-col justify-between transition-all ${
                activeStage === st.id
                  ? 'border-amber-500 bg-amber-950/40 text-amber-200'
                  : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-amber-400 font-bold font-mono">{st.level}</span>
                <span className="text-[10px] text-zinc-500">مرحل {i + 1}</span>
              </div>
              <p className="text-xs font-bold text-white truncate mb-1">{st.title}</p>
              <span className="text-[10px] text-zinc-400 dir-rtl">{st.deadline}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Active Disputes List */}
      <div className="flex flex-col gap-4">
        <h3 className="text-zinc-200 font-bold text-sm flex items-center gap-2">
          <FileText className="w-4 h-4 text-amber-400" />
          پرونده‌ها و لوایح فعال در حال دادرسی ({disputes.length} پرونده)
        </h3>

        {disputes.map((d) => (
          <div
            key={d.id}
            className="rounded-2xl border border-zinc-800 bg-[#141615] p-5 flex flex-col gap-4 hover:border-amber-500/50 transition-all shadow-md"
          >
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h4 className="text-zinc-100 font-bold text-base">{d.type}</h4>
                  <Badge className="bg-amber-950 text-amber-300 border-amber-800 text-xs font-mono">
                    شماره برگ: {d.assessmentNo}
                  </Badge>
                </div>
                <p className="text-xs text-zinc-400">
                  مرحله فعلی:{' '}
                  <span className="text-amber-300 font-bold">{d.stageName}</span> | تاریخ ابلاغ:{' '}
                  <span className="font-mono text-zinc-200">{d.noticeDate}</span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold text-xs px-3 py-1 gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {d.remainingDays} روز مهلت باقی‌مانده
                </Badge>
              </div>
            </div>

            {/* Financial Amounts Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-zinc-900/90 p-3.5 rounded-xl border border-zinc-800 text-xs">
              <div>
                <span className="text-zinc-500">مالیات اصل مشخص‌شده در برگ تشخیص:</span>{' '}
                <span className="text-red-400 font-bold font-mono">{d.issuedAmount}</span>
              </div>
              <div>
                <span className="text-zinc-500">مبلغ ابرازی / مورد قبول مودی:</span>{' '}
                <span className="text-emerald-400 font-bold font-mono">{d.claimedAmount}</span>
              </div>
              {d.hearingDate && (
                <div className="col-span-1 sm:col-span-2 text-amber-300 font-bold bg-amber-950/50 p-2 rounded-lg border border-amber-800/60 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  زمان برگزاری جلسه هیأت: <span className="font-mono text-white">{d.hearingDate}</span>
                </div>
              )}
            </div>

            {/* Petition Draft Accordion Box */}
            <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col gap-2 text-xs">
              <span className="text-amber-400 font-bold flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                متن لایحه دفاعیه تنظیم‌شده:
              </span>
              <pre className="text-zinc-300 font-sans whitespace-pre-wrap leading-relaxed text-xs">
                {d.petitionText}
              </pre>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-zinc-800">
              <span className="text-zinc-500 text-xs">
                تنظیم بر اساس اصول و استانداردهای حقوقی و بخشنامه‌های صادره
              </span>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => toast.success('فایل لایحه به فرمت PDF دانلود گردید.')}
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs h-8 gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  دانلود لایحه PDF
                </Button>
                <Button
                  onClick={() => toast.success('وضعیت لایحه بروزرسانی گردید.')}
                  className="bg-[#E5A93C] hover:bg-[#d49a2d] text-[#181614] font-bold text-xs h-8 px-4"
                >
                  ویرایش و ارسال نهایی
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
