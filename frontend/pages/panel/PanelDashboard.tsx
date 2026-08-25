import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowRight,
  Building2,
  FileDigit,
  Hash,
  LayoutDashboard,
  LogOut,
  MapPin,
  Tag,
  Users,
} from 'lucide-react'
import { Button } from '../../lib/shadcn/button'
import { useAuth } from '../../context/AuthContext'
import { useTenant } from '../../context/TenantContext'
import CompanyBusinessProfile from '../../components/CompanyBusinessProfile'
import CompanyComplianceOverview from '../../components/CompanyComplianceOverview'
import CompanyMembersPage from './CompanyMembersPage'
import ThemeToggle from '../../components/ThemeToggle'

type ActiveTab = 'OVERVIEW' | 'BUSINESS_PROFILE' | 'MEMBERS'

export default function PanelDashboard() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('OVERVIEW')
  const { signOut } = useAuth()
  const { selectedTenant, clearTenant } = useTenant()
  const navigate = useNavigate()

  if (!selectedTenant) return null

  const handleSwitchTenant = () => {
    clearTenant()
    navigate('/workspace')
  }

  const handleSignOut = async () => {
    clearTenant()
    await signOut()
    toast.success('از سیستم خارج شدید')
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#F7F5F0] dark:bg-[#0a0c0b] p-4 text-[#1C231F] dark:text-zinc-100 sm:p-6" dir="rtl">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-center justify-between rounded-2xl border border-[#E5E0D8] dark:border-zinc-800 bg-white dark:bg-[#141615] px-4 py-4 shadow-xs sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={handleSwitchTenant} className="rounded-lg p-1 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 transition hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-white" aria-label="تغییر کسب‌وکار">
              <ArrowRight className="h-5 w-5" />
            </button>
            <Building2 className="h-5 w-5 shrink-0 text-[#B8842E] dark:text-amber-400" />
            <div className="min-w-0">
              <p className="truncate font-bold text-[#1C231F] dark:text-white">{selectedTenant.name}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">مرکز تعهدات قانونی</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Theme Toggle Button */}
            <ThemeToggle className="h-8 sm:h-9 text-xs px-2.5 sm:px-3" />

            <Button variant="ghost" size="sm" onClick={handleSwitchTenant} className="hidden text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white sm:flex">
              تغییر کسب‌وکار
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400">
              <LogOut className="h-4 w-4" /><span className="hidden sm:inline">خروج</span>
            </Button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[260px,1fr]">
          <aside className="space-y-4">
            <div className="rounded-2xl border border-zinc-800 bg-[#141615] p-4">
              <p className="mb-3 text-xs font-bold text-zinc-400">منوی اصلی</p>
              <div className="space-y-2">
                <NavButton active={activeTab === 'OVERVIEW'} onClick={() => setActiveTab('OVERVIEW')} icon={<LayoutDashboard className="h-4 w-4" />} label="خانه و کارهای فوری" />
                <NavButton active={activeTab === 'BUSINESS_PROFILE'} onClick={() => setActiveTab('BUSINESS_PROFILE')} icon={<Building2 className="h-4 w-4" />} label="کسب‌وکار و مشمولیت" />
                <NavButton active={activeTab === 'MEMBERS'} onClick={() => setActiveTab('MEMBERS')} icon={<Users className="h-4 w-4" />} label="اعضای شرکت" />
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-[#141615] p-5">
              <p className="mb-4 text-xs font-bold text-zinc-400">مشخصات کسب‌وکار</p>
              <div className="space-y-3">
                <InfoRow icon={<Tag className="h-4 w-4" />} label="نام" value={selectedTenant.name} />
                <InfoRow icon={<Building2 className="h-4 w-4" />} label="نوع" value={selectedTenant.entity_type} />
                {selectedTenant.national_id && <InfoRow icon={<Hash className="h-4 w-4" />} label={selectedTenant.entity_type === 'حقیقی' ? 'کد ملی' : 'شناسه ملی'} value={selectedTenant.national_id} />}
                {selectedTenant.economic_code && <InfoRow icon={<FileDigit className="h-4 w-4" />} label="کد اقتصادی" value={selectedTenant.economic_code} />}
                {selectedTenant.province && <InfoRow icon={<MapPin className="h-4 w-4" />} label="استان" value={selectedTenant.province} />}
              </div>
            </div>
          </aside>

          <main>
            {activeTab === 'OVERVIEW' && <CompanyComplianceOverview tenantId={selectedTenant.id} tenantName={selectedTenant.name} />}
            {activeTab === 'BUSINESS_PROFILE' && <CompanyBusinessProfile tenantId={selectedTenant.id} tenantName={selectedTenant.name} />}
            {activeTab === 'MEMBERS' && <CompanyMembersPage />}
          </main>
        </div>
      </div>
    </div>
  )
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-2.5 rounded-xl border p-3 text-right text-xs font-bold transition ${active ? 'border-amber-500 bg-amber-500 text-zinc-950' : 'border-zinc-800 bg-zinc-900/60 text-zinc-200 hover:bg-zinc-800'}`}>
      {icon}<span>{label}</span>
    </button>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="mt-0.5 text-amber-400">{icon}</span>
      <div className="min-w-0">
        <p className="text-zinc-500">{label}</p>
        <p className="truncate font-semibold text-zinc-200">{value}</p>
      </div>
    </div>
  )
}

