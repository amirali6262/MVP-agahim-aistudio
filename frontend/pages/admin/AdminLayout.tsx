import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ChevronLeft, LogOut, User } from 'lucide-react'
import { Button } from '../../lib/shadcn/button'
import { TooltipProvider } from '../../lib/shadcn/tooltip'
import AdminSidebar from './AdminSidebar'
import { useAuth } from '../../context/AuthContext'
import ThemeToggle from '../../components/ThemeToggle'

interface Props {
  children: React.ReactNode
}

export default function AdminLayout({ children }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const routeLabels: Record<string, string> = {
    '/admin/dashboard': 'داشبورد مدیریت', '/admin/users': 'کاربران و سطح دسترسی', '/admin/studio': 'استودیوی تعهدات',
    '/admin/processes': 'فرایندهای دادرسی مالیاتی',
    '/admin/circulars': 'مرکز مهلت و بخشنامه', '/admin/tax/corporate': 'مالیات بر عملکرد اشخاص حقوقی',
    '/admin/tax/individual': 'مالیات بر عملکرد اشخاص حقیقی', '/admin/tax/vat': 'مالیات بر ارزش افزوده',
    '/admin/tax/payroll': 'مالیات بر حقوق', '/admin/tax/duties': 'مالیات‌های تکلیفی',
    '/admin/tax/claim169': 'مطالبه ماده ۱۶۹', '/admin/books': 'دفاتر تجاری',
    '/admin/checklists': 'چک‌لیست‌ها', '/admin/objections/templates': 'مرکز رسیدگی و اعتراض',
    '/admin/extensions': 'تمدید مهلت‌ها', '/admin/insurance/contract': 'حق بیمه قراردادها',
    '/admin/insurance/audit': 'حسابرسی بیمه',
  }
  const currentLabel = routeLabels[location.pathname] ?? 'بخش مدیریت'

  const handleSignOut = async () => {
    await signOut()
    toast.success('از سیستم خارج شدید')
    navigate('/admin/login', { replace: true })
  }

  return (
    <TooltipProvider>
      {/*
        RTL flex row: first child → RIGHT side (sidebar)
                      second child → LEFT side (content)
      */}
      <div className="flex h-screen overflow-hidden bg-[#F7F5F0] dark:bg-[#181614] text-[#1C231F] dark:text-zinc-100">
        {/* Sidebar — appears on RIGHT in RTL */}
        <AdminSidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((v) => !v)}
        />

        {/* Main area — LEFT side in RTL */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Top header */}
          <header
            className="flex items-center justify-between h-16 px-4 sm:px-6 border-b border-[#E5E0D8] dark:border-zinc-800/80 bg-white dark:bg-[#211d1a] flex-shrink-0"
          >
            <h1 className="text-[#1C231F] dark:text-white font-semibold text-sm hidden sm:block">
              پنل مدیریت پلتفرم
            </h1>
            <div className="flex items-center gap-2 sm:gap-3 mr-auto">
              {/* Theme Toggle Button */}
              <ThemeToggle className="h-9 px-2.5 sm:px-3 text-xs" />

              <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-200 text-xs sm:text-sm">
                <User className="w-4 h-4 text-[#B8842E] dark:text-[#E5A93C]" />
                <span className="truncate max-w-[120px] sm:max-w-[180px] font-medium text-[#1C231F] dark:text-white">
                  {profile?.email ?? profile?.phone ?? '—'}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="text-zinc-600 dark:text-zinc-300 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 gap-1.5 px-2.5 sm:px-3"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline text-xs">خروج</span>
              </Button>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-auto bg-[#F7F5F0] dark:bg-[#181614]">
            <nav aria-label="مسیر صفحه" className="flex items-center gap-1.5 border-b border-[#E5E0D8] bg-white px-6 py-2.5 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-[#1d1a18]">
              <Link to="/admin/dashboard" className="hover:text-[#B8842E] dark:hover:text-[#E5A93C]">مدیریت</Link>
              <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" />
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">{currentLabel}</span>
            </nav>
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}
