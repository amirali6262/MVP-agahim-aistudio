import { LayoutDashboard } from 'lucide-react'

export default function AdminDashboard() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-zinc-100 text-xl font-bold">داشبورد</h2>
        <p className="text-zinc-500 text-sm mt-1">خلاصه وضعیت سامانه</p>
      </div>

      <div
        className="rounded-xl border border-zinc-800 p-16 flex flex-col items-center gap-4 text-center"
        style={{ background: '#141615' }}
      >
        <LayoutDashboard className="w-14 h-14 text-zinc-700" />
        <h3 className="text-zinc-300 text-lg font-semibold">داشبورد مدیریت</h3>
        <p className="text-zinc-500 text-sm max-w-sm leading-relaxed">
          فاز ۱ و ۲ — MVP. ویجت‌های آماری و گزارش‌های مدیریتی در فازهای بعدی اضافه می‌شوند.
        </p>
      </div>
    </div>
  )
}
