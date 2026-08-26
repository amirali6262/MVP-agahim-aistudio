import {
  Receipt,
  Shield,
  Workflow,
  Scale,
  CalendarClock,
  BookOpen,
  CheckSquare,
  ArrowLeft,
  Layers,
  FileSpreadsheet,
  Building2,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { fetchObligations, fetchObjectionTemplates, fetchDeadlineExtensions } from '../../lib/supabaseDb'

export default function AdminDashboard() {
  const [obligations, setObligations] = useState<any[]>([])
  const [objectionTemplates, setObjectionTemplates] = useState<any[]>([])
  const [extensions, setExtensions] = useState<any[]>([])
  useEffect(() => {
    fetchObligations().then(setObligations)
    fetchObjectionTemplates().then(setObjectionTemplates)
    fetchDeadlineExtensions().then(setExtensions)
  }, [])

  const stats = [
    { label: 'کل تکالیف تعریف‌شده', value: obligations.length, icon: Layers, color: 'text-amber-400', bg: 'bg-amber-950/40 border-amber-800/60' },
    { label: 'الگوهای دادرسی و حل اختلاف', value: objectionTemplates.length, icon: Scale, color: 'text-purple-400', bg: 'bg-purple-950/40 border-purple-800/60' },
    { label: 'تمدیدهای فعال بخشنامه‌ای', value: extensions.length, icon: CalendarClock, color: 'text-emerald-400', bg: 'bg-emerald-950/40 border-emerald-800/60' },
    { label: 'تکالیف مالیات عملکرد', value: obligations.filter(o => o.obligation_type === 'TAX_CORPORATE' || o.obligation_type === 'TAX_INDIVIDUAL').length, icon: Receipt, color: 'text-blue-400', bg: 'bg-blue-950/40 border-blue-800/60' },
  ]

  const modules = [
    {
      title: 'استودیوی تعهدات و قواعد انطباق',
      desc: 'تعریف ساختار یافته تعهدات، قواعد شرطی مودیان، نسخه‌بندی و مراحل گردش کار',
      path: '/admin/studio',
      icon: Workflow,
      tag: 'موتور قوانین',
    },
    {
      title: 'مالیات بر عملکرد اشخاص حقوقی',
      desc: 'چرخه کامل ارسال اظهارنامه، تقسیط، رسیدگی، ماده ۲۳۸ و دادرسی مالیاتی شرکت‌ها',
      path: '/admin/tax/corporate',
      icon: Building2,
      tag: 'قانون م.م',
    },
    {
      title: 'مالیات بر ارزش افزوده (VAT)',
      desc: 'تکالیف فصلی، اعتبارسنجی صورتحساب‌ها، استرداد مالیاتی و جرایم ماده ۳۶',
      path: '/admin/tax/vat',
      icon: Receipt,
      tag: 'قانون دائمی',
    },
    {
      title: 'مالیات عملکرد اشخاص حقیقی (مشاغل)',
      desc: 'محاسبه عملکرد انفرادی و مشارکتی، بهره‌مندی از تبصره ماده ۱۰۰ ق.م.م و تقسیط',
      path: '/admin/tax/individual',
      icon: Users,
      tag: 'مشاغل',
    },
    {
      title: 'مالیات بر حقوق و مالیات‌های تکلیفی',
      desc: 'ارسال لیست ماهانه، معافیت ماده ۸۴، مالیات تکلیفی اجاره و قراردادها',
      path: '/admin/tax/payroll',
      icon: FileSpreadsheet,
      tag: 'ماده ۸۶ و ۱۹۹',
    },
    {
      title: 'صورت معاملات فصلی (ماده ۱۶۹)',
      desc: 'ارسال فهرست خرید و فروش، طرف‌های تجاری و جرایم عدم ارائه صورت معاملات',
      path: '/admin/tax/claim169',
      icon: FileSpreadsheet,
      tag: 'ماده ۱۶۹ مکرر',
    },
    {
      title: 'مراحل رسیدگی و الگوهای اعتراض',
      desc: 'طراحی درخت دادرسی مالیاتی، توافق ماده ۲۳۸، هیأت‌های بدوی، تجدیدنظر و ۲۵۱ مکرر',
      path: '/admin/objections/templates',
      icon: Scale,
      tag: 'دادرسی مالیاتی',
    },
    {
      title: 'مهلت‌های سامانه و پلمپ دفاتر تجاری',
      desc: 'مدیریت مواعد قانونی تقاضای پلمپ دفاتر روزنامه و کل و سامانه جامع تجارت',
      path: '/admin/books',
      icon: BookOpen,
      tag: 'قانون تجارت',
    },
    {
      title: 'چک‌لیست‌ها و ویزارد اقدامات',
      desc: 'طراحی و سفارشی‌سازی فرم‌ها و چک‌لیست‌های مدارک مورد نیاز هر فرآیند',
      path: '/admin/checklists',
      icon: CheckSquare,
      tag: 'ویزارد',
    },
    {
      title: 'مدیریت تمدیدها و بخشنامه‌ها',
      desc: 'تمدید مهلت‌های قانونی تکالیف براساس بخشنامه‌های صادره سازمان امور مالیاتی',
      path: '/admin/extensions',
      icon: CalendarClock,
      tag: 'بخشنامه‌ها',
    },
    {
      title: 'حق بیمه و حسابرسی تأمین اجتماعی',
      desc: 'ارسال لیست ماهانه پرسنل، مفاصاحساب ماده ۳۸ و حسابرسی دفاتر ماده ۴۷',
      path: '/admin/insurance/contract',
      icon: Shield,
      tag: 'تأمین اجتماعی',
    },
  ]

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-white text-xl font-bold">داشبورد جامع مدیریت پلتفرم</h2>
          <p className="text-zinc-400 text-sm mt-1">
            دسترسی سریع به کلیه ماژول‌های قانون مالیات‌ها، دادرسی، بخشنامه‌ها، بیمه و دفاتر تجاری
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, idx) => {
          const Icon = s.icon
          return (
            <div
              key={idx}
              className={`rounded-xl border p-4 flex items-center justify-between shadow-xs ${s.bg}`}
            >
              <div>
                <p className="text-zinc-400 text-xs font-medium">{s.label}</p>
                <p className="text-white text-2xl font-bold mt-1.5 font-mono">{s.value}</p>
              </div>
              <div className={`p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 ${s.color}`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
          )
        })}
      </div>

      {/* Modules Grid */}
      <div>
        <h3 className="text-zinc-200 font-bold text-sm mb-3">ماژول‌ها و پنل‌های مدیریتی فعال</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((m, idx) => {
            const Icon = m.icon
            return (
              <Link
                key={idx}
                to={m.path}
                className="rounded-xl border border-zinc-800/90 hover:border-amber-500/60 p-5 flex flex-col justify-between gap-4 transition-all duration-150 hover:bg-zinc-900/50 group shadow-xs"
                style={{ background: '#211d1a' }}
              >
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-[#E5A93C] group-hover:scale-105 transition-transform">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                      {m.tag}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-sm group-hover:text-amber-400 transition-colors">
                      {m.title}
                    </h4>
                    <p className="text-zinc-400 text-xs mt-1.5 line-clamp-2 leading-relaxed">
                      {m.desc}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-amber-400 font-medium pt-2 border-t border-zinc-800/80">
                  <span>ورود به ماژول</span>
                  <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
