import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowRight,
  Building2,
  FileDigit,
  Folder,
  Hash,
  LayoutDashboard,
  LogOut,
  MapPin,
  Tag,
  Users,
  ChevronDown,
  Loader2,
} from 'lucide-react'
import { fetchPublishedMenu, type PublishedCompanyMenuItem } from '../../lib/supabaseDb'
import { Button } from '../../lib/shadcn/button'
import { useAuth } from '../../context/AuthContext'
import { useTenant } from '../../context/TenantContext'
import CompanyBusinessProfile from '../../components/CompanyBusinessProfile'
import CompanyComplianceOverview from '../../components/CompanyComplianceOverview'
import CompanyMembersPage from './CompanyMembersPage'
import ThemeToggle from '../../components/ThemeToggle'

type ActiveTab = 'OVERVIEW' | 'BUSINESS_PROFILE' | 'MEMBERS'

interface CompanyMenuItemNode extends PublishedCompanyMenuItem { children: CompanyMenuItemNode[] }

function buildCompanyTree(items: PublishedCompanyMenuItem[]): CompanyMenuItemNode[] {
  const byCode = new Map<string, CompanyMenuItemNode>()
  items.forEach((i) => byCode.set(i.code, { ...i, children: [] }))
  const roots: CompanyMenuItemNode[] = []
  items
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .forEach((i) => {
      const node = byCode.get(i.code)!
      const parent = i.parent_code ? byCode.get(i.parent_code) : undefined
      if (parent) parent.children.push(node)
      else roots.push(node)
    })
  return roots
}

export default function PanelDashboard() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('OVERVIEW')
  const { signOut } = useAuth()
  const { selectedTenant, clearTenant } = useTenant()
  const navigate = useNavigate()

  // Company workspace menu (published by the platform admin) — loaded dynamically.
  const [companyMenu, setCompanyMenu] = useState<CompanyMenuItemNode[]>([])
  const [menuOpen, setMenuOpen] = useState(true)
  const [loadingMenu, setLoadingMenu] = useState(true)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadingMenu(true)
      try {
        const published = await fetchPublishedMenu()
        if (cancelled) return
        const tree = buildCompanyTree(published)
        setCompanyMenu(tree)
        const initial: Record<string, boolean> = {}
        tree.forEach((n) => (initial[n.id] = true))
        setExpandedGroups(initial)
      } finally {
        if (!cancelled) setLoadingMenu(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const hasCompanyMenu = useMemo(() => companyMenu.length > 0, [companyMenu])

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

            {/* Dynamic company menu published by the platform admin */}
            <div className="rounded-2xl border border-zinc-800 bg-[#141615] p-4">
              <button onClick={() => setMenuOpen((o) => !o)} className="mb-3 flex w-full items-center justify-between">
                <p className="flex items-center gap-2 text-xs font-bold text-zinc-400">
                  <Folder className="h-4 w-4 text-amber-400" /> منوی شرکت
                </p>
                <ChevronDown className={`h-4 w-4 text-zinc-500 transition ${menuOpen ? '' : 'rotate-180'}`} />
              </button>
              {menuOpen && (
                <div className="space-y-2">
                  {loadingMenu ? (
                    <div className="flex items-center gap-2 py-2 text-xs text-zinc-500">
                      <Loader2 className="h-4 w-4 animate-spin text-amber-400" /> در حال بارگذاری منو...
                    </div>
                  ) : !hasCompanyMenu ? (
                    <p className="py-2 text-xs text-zinc-600">هنوز منویی منتشر نشده است.</p>
                  ) : (
                    <div className="space-y-1">
                      {companyMenu.map((node) => renderCompanyMenu(node, 0, expandedGroups, setExpandedGroups))}
                    </div>
                  )}
                </div>
              )}
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

function renderCompanyMenu(
  node: CompanyMenuItemNode,
  depth: number,
  expanded: Record<string, boolean>,
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
): React.ReactNode {
  const isGroup = node.item_type === 'GROUP' && node.children.length > 0
  const open = expanded[node.id] ?? false

  return (
    <div key={node.id} className="flex flex-col">
      <button
        onClick={() => {
          if (isGroup) setExpanded((e) => ({ ...e, [node.id]: !open }))
          else if (node.form_obligation_id) {
            // Leaf linked to a published obligation → open the form page.
            window.location.href = `/panel/company-form/${node.form_obligation_id}`
          }
        }}
        className="flex w-full items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-2.5 text-right text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800"
        style={{ marginRight: `${depth * 16}px` }}
      >
        {isGroup ? (
          <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-amber-400 transition ${open ? '' : '-rotate-90'}`} />
        ) : (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
        )}
        <span className="truncate">{node.title_fa}</span>
      </button>
      {isGroup && open && node.children.map((c) => renderCompanyMenu(c, depth + 1, expanded, setExpanded))}
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

