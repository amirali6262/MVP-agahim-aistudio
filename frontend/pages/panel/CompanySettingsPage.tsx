import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Calendar, ChevronLeft, Settings } from 'lucide-react'
import { useTenant } from '../../context/TenantContext'

const BRAND = '#5B4DE6'
const BRAND_SOFT = '#EEECFC'

export default function CompanySettingsPage() {
  const navigate = useNavigate()
  const { selectedTenant } = useTenant()

  return (
    <div className="mx-auto max-w-3xl" dir="rtl">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white" style={{ background: BRAND }}>
          <Settings className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-base font-extrabold text-zinc-900 dark:text-zinc-50">تنظیمات شرکت</h1>
          <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">پیکربندی دوره‌های مالی و تنظیمات عمومی {selectedTenant?.name ?? ''}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#161618]">
        <button
          onClick={() => navigate('/panel/fiscal-years')}
          className="flex w-full items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4 text-right transition hover:bg-zinc-50/70 dark:border-zinc-800 dark:hover:bg-zinc-800/30"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: BRAND_SOFT, color: BRAND }}>
              <Calendar className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-zinc-800 dark:text-zinc-100">تعریف سال مالی شرکت</p>
              <p className="mt-0.5 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">مدیریت بازه‌های مالی؛ این دوره‌ها به‌صورت خودکار در تمام فرم‌های تعهد نمایش داده می‌شوند.</p>
            </div>
          </div>
          <ChevronLeft className="h-4 w-4 shrink-0 text-zinc-400" />
        </button>

        <div className="flex items-center gap-2 bg-zinc-50/60 px-5 py-4 dark:bg-zinc-800/30">
          <ArrowLeft className="h-3.5 w-3.5 text-zinc-400" />
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">سایر گزینه‌های تنظیمات شرکت در این مرحله ارائه نمی‌شود.</p>
        </div>
      </div>
    </div>
  )
}