import { CalendarClock, ClipboardList, FolderOpen, BarChart3, Settings, Headphones, Inbox, type LucideIcon } from 'lucide-react'
import { useTenant } from '../../context/TenantContext'

const BRAND = '#5B4DE6'
const BRAND_SOFT = '#EEECFC'

const ICONS: Record<string, LucideIcon> = {
  calendar: CalendarClock,
  tasks: ClipboardList,
  documents: FolderOpen,
  reports: BarChart3,
  settings: Settings,
  help: Headphones,
}

interface Props {
  pageKey: 'calendar' | 'tasks' | 'documents' | 'reports' | 'settings' | 'help'
  title: string
  description: string
}

export default function PanelPlaceholderPage({ pageKey, title, description }: Props) {
  const { selectedTenant } = useTenant()
  const Icon = ICONS[pageKey] ?? Inbox

  return (
    <div className="mx-auto max-w-3xl" dir="rtl">
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-[#161618] sm:p-12">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: BRAND_SOFT }}>
          <Icon className="h-7 w-7" style={{ color: BRAND }} />
        </span>
        <h1 className="mt-5 text-lg font-extrabold text-zinc-900 dark:text-zinc-50">{title}</h1>
        <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-zinc-500 dark:text-zinc-400">{description}</p>

        <div className="mx-auto mt-6 max-w-md rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 p-5 text-right dark:border-zinc-700 dark:bg-zinc-800/30">
          <p className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">وضعیت این بخش</p>
          <p className="mt-1.5 text-xs leading-6 text-zinc-600 dark:text-zinc-300">
            این بخش در این مرحله از توسعه در دسترس نیست و به‌محض تکمیل، بدون نیاز به تغییر منو فعال می‌شود.
            داده‌های {selectedTenant?.name ?? 'شرکت'} همچنان از همان مسیرهای امن پایگاه‌داده دریافت می‌شود.
          </p>
        </div>
      </div>
    </div>
  )
}
