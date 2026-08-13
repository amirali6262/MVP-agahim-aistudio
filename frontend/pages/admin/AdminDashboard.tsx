import { ArrowLeft, LayoutDashboard } from 'lucide-react'
import { Link } from 'react-router-dom'

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
          برای تعریف تعهد، قواعد تشخیص، مراحل انجام کار و انتشار کنترل‌شده وارد استودیوی طراحی شوید.
        </p>
        <Link to="/admin/studio" className="mt-2 flex items-center gap-2 rounded-lg bg-[#E5A93C] px-5 py-2.5 text-sm font-bold text-[#181614]">
          ورود به استودیوی طراحی <ArrowLeft className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
