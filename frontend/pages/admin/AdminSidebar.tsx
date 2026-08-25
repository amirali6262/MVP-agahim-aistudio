import { useState, type ElementType } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Receipt,
  Shield,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Scale,
  CalendarClock,
  BookOpen,
  CheckSquare,
  Workflow,
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../lib/shadcn/tooltip'
import { cn } from '../../lib/shadcn/utils'
import ThemeToggle from '../../components/ThemeToggle'

// ---------------------------------------------------------------------------
// Menu configuration
// ---------------------------------------------------------------------------
interface SubItem {
  id: string
  label: string
  path: string | null
  active: boolean
}

interface MenuSection {
  id: string
  label: string
  icon: ElementType
  children: SubItem[]
}

const DEMO_MODULES_ENABLED = true

const CORE_MENU: MenuSection[] = [
  {
    id: 'overview',
    label: 'نمای کلی',
    icon: LayoutDashboard,
    children: [
      { id: 'admin-dashboard', label: 'داشبورد مدیریت', path: '/admin/dashboard', active: true },
      { id: 'user-access', label: 'کاربران و سطح دسترسی', path: '/admin/users', active: true },
    ],
  },
  {
    id: 'studio',
    label: 'طراحی فرایندها',
    icon: Workflow,
    children: [
      { id: 'compliance-studio', label: 'استودیوی تعهدات و مراحل', path: '/admin/studio', active: true },
      { id: 'circular-center', label: 'مرکز مهلت و بخشنامه', path: '/admin/circulars', active: true },
    ],
  },
]

const DEMO_MENU: MenuSection[] = [
  {
    id: 'tax',
    label: 'مالیات',
    icon: Receipt,
    children: [
      { id: 'tax-corporate', label: 'مالیات بر عملکرد اشخاص حقوقی', path: '/admin/tax/corporate', active: true },
      { id: 'tax-individual', label: 'مالیات بر عملکرد اشخاص حقیقی', path: '/admin/tax/individual', active: true },
      { id: 'vat', label: 'مالیات بر ارزش افزوده', path: '/admin/tax/vat', active: true },
      { id: 'payroll-tax', label: 'مالیات بر حقوق', path: '/admin/tax/payroll', active: true },
      { id: 'tax-duties', label: 'مالیات بر تکالیفی', path: '/admin/tax/duties', active: true },
      { id: 'claim-169', label: 'مطالبه ۱۶۹ مکرر ق.م.م', path: '/admin/tax/claim169', active: true },
    ],
  },
  {
    id: 'books',
    label: 'دفاتر تجاری و سامانه',
    icon: BookOpen,
    children: [
      { id: 'commercial-books', label: 'مهلت‌های سامانه و پلمپ دفاتر', path: '/admin/books', active: true },
    ],
  },
  {
    id: 'checklists',
    label: 'چک‌لیست‌ها',
    icon: CheckSquare,
    children: [
      { id: 'checklists-admin', label: 'طراحی چک‌لیست و ویزارد', path: '/admin/checklists', active: true },
    ],
  },
  {
    id: 'objections',
    label: 'مراحل رسیدگی و اعتراض',
    icon: Scale,
    children: [
      { id: 'objection-templates', label: 'مراحل رسیدگی و اعتراض', path: '/admin/objections/templates', active: true },
    ],
  },
  {
    id: 'extensions',
    label: 'مدیریت تمدیدها',
    icon: CalendarClock,
    children: [
      { id: 'deadline-extensions', label: 'تمدید مهلت‌های قانونی', path: '/admin/extensions', active: true },
    ],
  },
  {
    id: 'insurance',
    label: 'بیمه',
    icon: Shield,
    children: [
      { id: 'ins-contract', label: 'حق بیمه قراردادها', path: '/admin/insurance/contract', active: true },
      { id: 'ins-audit', label: 'حسابرسی بیمه', path: '/admin/insurance/audit', active: true },
    ],
  },
]

const MENU: MenuSection[] = DEMO_MODULES_ENABLED
  ? [...CORE_MENU, ...DEMO_MENU]
  : CORE_MENU

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface Props {
  collapsed: boolean
  onToggle: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function AdminSidebar({ collapsed, onToggle }: Props) {
  const location = useLocation()

  // Determine default open sections based on current path
  const defaultOpen = MENU.filter((s) =>
    s.children.some((c) => c.path && location.pathname.startsWith(c.path))
  ).map((s) => s.id)

  const [openSections, setOpenSections] = useState<string[]>(
    defaultOpen.length > 0 ? defaultOpen : ['tax']
  )

  const toggleSection = (id: string) => {
    setOpenSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }

  const handlePlaceholder = () => {
    toast.info('این بخش در حال توسعه است.')
  }

  return (
    <aside
      className={cn(
        'flex flex-col h-full border-r border-zinc-800 transition-all duration-200 ease-in-out flex-shrink-0',
        collapsed ? 'w-[72px]' : 'w-64'
      )}
      style={{ background: '#211d1a', borderRight: 'none', borderLeft: '1px solid rgb(45 40 36)' }}
    >
      {/* ── Logo / Brand ── */}
      <div
        className="flex items-center h-16 px-4 border-b border-zinc-800/80 flex-shrink-0"
        style={{ borderBottom: '1px solid rgb(45 40 36)' }}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-[#E5A93C]/20 border border-[#E5A93C]/50 flex items-center justify-center flex-shrink-0">
            <LayoutDashboard className="w-4 h-4 text-[#E5A93C]" />
          </div>
          {!collapsed && (
            <span className="text-white font-bold text-sm truncate leading-tight">
              سامانه انطباق<br />
              <span className="text-[#E5A93C] font-semibold text-xs">پنل مدیریت</span>
            </span>
          )}
        </div>
      </div>

      {/* ── Toggle button ── */}
      <button
        onClick={onToggle}
        className="flex items-center justify-center h-10 mx-3 mt-3 rounded-lg border border-zinc-700/60 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors flex-shrink-0"
        aria-label={collapsed ? 'باز کردن منو' : 'بستن منو'}
      >
        {collapsed ? (
          <ChevronLeft className="w-4 h-4" />
        ) : (
          <div className="flex items-center gap-2 w-full px-3 text-sm font-medium">
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
            <span>بستن منو</span>
          </div>
        )}
      </button>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 flex flex-col gap-1">
        {MENU.map((section) => {
          const Icon = section.icon
          const isSectionActive = section.children.some(
            (c) => c.path && location.pathname.startsWith(c.path)
          )
          const isOpen = openSections.includes(section.id)

          if (collapsed) {
            // ── Collapsed: icon only with tooltip ──
            return (
              <Tooltip key={section.id} delayDuration={200}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      onToggle()
                    }}
                    className={cn(
                      'flex items-center justify-center w-full h-10 rounded-lg transition-colors',
                      isSectionActive
                        ? 'bg-[#E5A93C] text-[#181614] font-bold'
                        : 'text-white hover:bg-zinc-800 hover:text-white'
                    )}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" className="bg-zinc-800 border-zinc-700 text-white">
                  {section.label}
                </TooltipContent>
              </Tooltip>
            )
          }

          // ── Expanded: accordion-style ──
          return (
            <div key={section.id} className="flex flex-col">
              {/* Section header */}
              <button
                onClick={() => toggleSection(section.id)}
                className={cn(
                  'flex items-center justify-between w-full h-10 px-3 rounded-lg transition-colors text-sm font-medium',
                  isSectionActive
                    ? 'text-[#E5A93C] bg-[#E5A93C]/10 font-semibold'
                    : 'text-white hover:bg-zinc-800/80 hover:text-white'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{section.label}</span>
                </div>
                <ChevronDown
                  className={cn(
                    'w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 flex-shrink-0',
                    isOpen && 'rotate-180'
                  )}
                />
              </button>

              {/* Sub items */}
              {isOpen && (
                <div className="flex flex-col gap-1 mt-1 pr-3">
                  {section.children.map((item) => {
                    const isActivePath = item.path
                      ? location.pathname.startsWith(item.path)
                      : false

                    if (!item.active || !item.path) {
                      return (
                        <button
                          key={item.id}
                          onClick={handlePlaceholder}
                          className="flex items-center gap-2 w-full h-9 px-3 rounded-lg text-xs text-zinc-500 cursor-not-allowed text-right opacity-60"
                          disabled
                        >
                          <span className="w-1 h-1 rounded-full bg-zinc-600 flex-shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      )
                    }

                    return (
                      <Link
                        key={item.id}
                        to={item.path}
                        className={cn(
                          'flex items-center gap-2.5 w-full h-9 px-3 rounded-lg text-xs transition-all',
                          isActivePath
                            ? 'bg-[#E5A93C] text-[#181614] font-bold shadow-md'
                            : 'text-zinc-200 hover:bg-zinc-800 hover:text-white font-medium'
                        )}
                      >
                        <span
                          className={cn(
                            'w-1.5 h-1.5 rounded-full flex-shrink-0',
                            isActivePath ? 'bg-[#181614]' : 'bg-zinc-400'
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* ── Sidebar Theme Toggle Footer ── */}
      <div className="p-3 border-t border-zinc-800/80 mt-auto flex-shrink-0">
        <ThemeToggle className="w-full justify-center" showText={!collapsed} />
      </div>
    </aside>
  )
}
