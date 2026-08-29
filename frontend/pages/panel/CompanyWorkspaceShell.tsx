import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowRight,
  BarChart3,
  Bell,
  Building2,
  Calendar,
  CalendarClock,
  Check,
  ChevronDown,
  ClipboardList,
  Folder,
  FolderOpen,
  Headphones,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  Settings,
  User,
  Users,
  X,
  Hash,
} from 'lucide-react'
import { Input } from '../../lib/shadcn/input'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { fetchPublishedMenu, fetchUserTenants, type PublishedCompanyMenuItem } from '../../lib/supabaseDb'
import { useAuth } from '../../context/AuthContext'
import { useTenant } from '../../context/TenantContext'
import type { Tenant } from '../../lib/supabase'
import ThemeToggle from '../../components/ThemeToggle'

const BRAND = '#5B4DE6'
const BRAND_SOFT = '#EEECFC'
const BRAND_LIGHT = '#F7F6FB'

// ─────────────────────────────────────────────────────────────────────────────
// Fixed system menu of the company workspace. These items are part of the
// workspace shell and are never replaced by the published dynamic menu.
// ─────────────────────────────────────────────────────────────────────────────

const FIXED_MENU: Array<{ to: string; label: string; icon: React.ElementType }> = [
  { to: '/panel/dashboard', label: 'داشبورد', icon: LayoutDashboard },
  { to: '/panel/calendar', label: 'تقویم و مهلت‌ها', icon: CalendarClock },
  { to: '/panel/tasks', label: 'کارتابل کارها', icon: ClipboardList },
  { to: '/panel/documents', label: 'اسناد و مدارک', icon: FolderOpen },
  { to: '/panel/reports', label: 'گزارش‌ها', icon: BarChart3 },
  { to: '/panel/business', label: 'کسب‌وکار و مشمولیت', icon: Building2 },
  { to: '/panel/members', label: 'اعضا و دسترسی‌ها', icon: Users },
  { to: '/panel/settings', label: 'تنظیمات شرکت', icon: Settings },
]

interface CompanyMenuItemNode extends PublishedCompanyMenuItem {
  children: CompanyMenuItemNode[]
}

function buildCompanyTree(items: PublishedCompanyMenuItem[]): CompanyMenuItemNode[] {
  // Only active items are ever rendered; inactive items are excluded from the tree.
  const active = items.filter((i) => i.is_active)
  const byCode = new Map<string, CompanyMenuItemNode>()
  active.forEach((i) => byCode.set(i.code, { ...i, children: [] }))
  const roots: CompanyMenuItemNode[] = []
  active
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .forEach((i) => {
      const node = byCode.get(i.code)!
      const parent = i.parent_code ? byCode.get(i.parent_code) : undefined
      if (parent) parent.children.push(node)
      else roots.push(node)
    })
  // Prune groups that ended up with no visible (active) children.
  const prune = (nodes: CompanyMenuItemNode[]): CompanyMenuItemNode[] =>
    nodes
      .filter((n) => n.item_type === 'FORM' || n.children.length > 0)
      .map((n) => ({ ...n, children: prune(n.children) }))
  return prune(roots)
}

// ─────────────────────────────────────────────────────────────────────────────
// Shell
// ─────────────────────────────────────────────────────────────────────────────

export default function CompanyWorkspaceShell() {
  const { profile, signOut } = useAuth()
  const { selectedTenant, clearTenant, selectTenant } = useTenant()
  const navigate = useNavigate()
  const location = useLocation()

  // Dynamic published company menu (defined by the platform admin).
  const [companyMenu, setCompanyMenu] = useState<CompanyMenuItemNode[]>([])
  const [menuOpen, setMenuOpen] = useState(true)
  const [loadingMenu, setLoadingMenu] = useState(true)
  const [menuError, setMenuError] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

  // Notifications for the current company + user.
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; body: string; read_at: string | null; created_at: string }>>([])
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifLoading, setNotifLoading] = useState(false)

  // Company switcher.
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [companies, setCompanies] = useState<Tenant[]>([])
  const [companySearch, setCompanySearch] = useState('')
  const [switcherLoading, setSwitcherLoading] = useState(false)

  // Mobile sidebar.
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const tenantId = selectedTenant?.id ?? null
  const userId = profile?.id ?? null
  const userLabel = profile?.email ? profile.email.split('@')[0] : profile?.phone ?? 'کاربر'

  // Top-bar refresh state ("آخرین به‌روزرسانی").
  const [refreshing, setRefreshing] = useState(false)
  const [refreshTime, setRefreshTime] = useState(() => formatRefreshTime(new Date()))

  // ── Load published menu (only affects the dynamic section on failure) ──
  useEffect(() => {
    let cancelled = false
    setLoadingMenu(true)
    setMenuError(null)
    ;(async () => {
      try {
        const published = await fetchPublishedMenu()
        if (cancelled) return
        const tree = buildCompanyTree(published)
        setCompanyMenu(tree)
        const initial: Record<string, boolean> = {}
        tree.forEach((n) => (initial[n.id] = true))
        setExpandedGroups(initial)
      } catch (err) {
        if (!cancelled) setMenuError(err instanceof Error ? err.message : 'خطا در دریافت منوی شرکت')
      } finally {
        if (!cancelled) setLoadingMenu(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // ── Load notifications whenever the company changes ──
  const loadNotifications = useCallback(async () => {
    if (!tenantId || !userId || !isSupabaseConfigured) {
      setNotifications([])
      return
    }
    setNotifLoading(true)
    const { data, error } = await supabase
      .from('notifications')
      .select('id, title, body, read_at, created_at')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(8)
    setNotifLoading(false)
    if (error) {
      console.warn('[CompanyWorkspaceShell] notifications error:', error.message)
      return
    }
    setNotifications(data ?? [])
  }, [tenantId, userId])

  useEffect(() => {
    void loadNotifications()
  }, [loadNotifications])

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read_at).length, [notifications])

  // Refresh button in the top bar: tells open pages (e.g. the dashboard) to
  // reload their data and refreshes notifications + the displayed clock.
  const handleRefresh = () => {
    setRefreshing(true)
    setRefreshTime(formatRefreshTime(new Date()))
    window.dispatchEvent(new Event('agahim:data-refresh'))
    void loadNotifications()
    setTimeout(() => setRefreshing(false), 900)
  }

  const markAllRead = async () => {
    if (!tenantId || !userId || !isSupabaseConfigured) return
    const unreadIds = notifications.filter((n) => !n.read_at).map((n) => n.id)
    if (unreadIds.length === 0) return
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .in('id', unreadIds)
    if (error) return toast.error('ثبت خوانده‌شدن اعلان‌ها ناموفق بود.')
    setNotifications((current) => current.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })))
    toast.success('اعلان‌ها خوانده شد.')
  }

  // ── Company switcher data ──
  const openSwitcher = async () => {
    setSwitcherOpen(true)
    setCompanySearch('')
    if (!userId) return
    setSwitcherLoading(true)
    if (!isSupabaseConfigured) {
      try {
        const rows = await fetchUserTenants(userId)
        setCompanies(rows.map((r: any) => r.tenants).filter((t: Tenant | null): t is Tenant => t !== null))
      } catch {
        toast.error('دریافت شرکت‌ها ناموفق بود.')
      } finally {
        setSwitcherLoading(false)
      }
      return
    }
    const { data, error } = await supabase.from('user_tenants').select('*, tenants(*)').eq('user_id', userId)
    setSwitcherLoading(false)
    if (error) {
      toast.error('دریافت شرکت‌ها ناموفق بود: ' + error.message)
      return
    }
    setCompanies((data ?? []).map((r: any) => r.tenants).filter((t: Tenant | null): t is Tenant => t !== null))
  }

  const switchCompany = (tenant: Tenant) => {
    if (tenant.id === tenantId) {
      setSwitcherOpen(false)
      return
    }
    selectTenant(tenant)
    setSwitcherOpen(false)
    setMobileNavOpen(false)
    navigate('/panel/dashboard')
  }

  const backToSelection = () => {
    setSwitcherOpen(false)
    clearTenant()
    navigate('/workspace')
  }

  const handleSignOut = async () => {
    clearTenant()
    await signOut()
    navigate('/login', { replace: true })
  }

  const filteredCompanies = companies.filter((c) => {
    const q = companySearch.trim().toLowerCase()
    if (!q) return true
    return (
      c.name.toLowerCase().includes(q) ||
      (c.national_id ?? '').includes(q) ||
      (c.economic_code ?? '').includes(q)
    )
  })

  // Close notification dropdown when the route changes.
  useEffect(() => {
    setNotifOpen(false)
    setMobileNavOpen(false)
  }, [location.pathname])

  return (
    <div dir="rtl" className="min-h-screen text-zinc-800 dark:text-zinc-100" style={{ background: BRAND_LIGHT }}>
      <div className="flex min-h-screen">
        {/* ── Sidebar (desktop) ── */}
        <aside className="sticky top-0 hidden h-screen w-[270px] shrink-0 flex-col border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#161618] lg:flex">
          <SidebarContent
            tenantName={selectedTenant?.name}
            tenantNationalId={selectedTenant?.national_id ?? undefined}
            companyMenu={companyMenu}
            loadingMenu={loadingMenu}
            menuError={menuError}
            menuOpen={menuOpen}
            setMenuOpen={setMenuOpen}
            expandedGroups={expandedGroups}
            setExpandedGroups={setExpandedGroups}
            onSwitchCompany={openSwitcher}
            onSignOut={() => void handleSignOut()}
          />
        </aside>

        {/* ── Mobile drawer ── */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileNavOpen(false)} />
            <aside className="absolute right-0 top-0 flex h-full w-[280px] flex-col border-l border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#161618]">
              <div className="flex items-center justify-between border-b border-zinc-100 p-4 dark:border-zinc-800">
                <p className="text-sm font-extrabold text-zinc-800 dark:text-zinc-100">منوی فضای شرکت</p>
                <button onClick={() => setMobileNavOpen(false)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <SidebarContent
                  tenantName={selectedTenant?.name}
                  tenantNationalId={selectedTenant?.national_id ?? undefined}
                  companyMenu={companyMenu}
                  loadingMenu={loadingMenu}
                  menuError={menuError}
                  menuOpen={menuOpen}
                  setMenuOpen={setMenuOpen}
                  expandedGroups={expandedGroups}
                  setExpandedGroups={setExpandedGroups}
                  onSwitchCompany={openSwitcher}
                  onSignOut={() => void handleSignOut()}
                />
              </div>
            </aside>
          </div>
        )}

        {/* ── Main column ── */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* ── Top bar ── */}
          <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-[#161618]/95">
            <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
              <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                <button
                  onClick={() => setMobileNavOpen(true)}
                  className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 lg:hidden"
                  aria-label="باز کردن منو"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 sm:flex">
                  <User className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-zinc-900 dark:text-zinc-50">خوش آمدید، {userLabel}</p>
                  <p className="hidden truncate text-[11px] text-zinc-500 dark:text-zinc-400 sm:block">
                    نمای کلی وضعیت انطباق و اقدامات {selectedTenant?.name ?? 'شرکت'}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
                <ThemeToggle className="h-8 text-xs px-2 sm:h-9 sm:px-3" />
                {/* Notifications */}
                <div className="relative">
                  <button
                    onClick={() => setNotifOpen((o) => !o)}
                    className="relative rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    aria-label="اعلان‌ها"
                  >
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                      <span className="absolute -left-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white" style={{ background: '#E5484D' }}>
                        {unreadCount.toLocaleString('fa-IR')}
                      </span>
                    )}
                  </button>
                  {notifOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                      <div className="absolute left-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-[#1d1d20]">
                        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
                          <p className="text-xs font-extrabold text-zinc-800 dark:text-zinc-100">اعلان‌های {selectedTenant?.name ?? 'شرکت'}</p>
                          {unreadCount > 0 && (
                            <button onClick={() => void markAllRead()} className="text-[10px] font-bold" style={{ color: BRAND }}>
                              خواندن همه
                            </button>
                          )}
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                          {notifLoading ? (
                            <div className="flex items-center justify-center gap-2 p-6 text-xs text-zinc-400">
                              <Loader2 className="h-4 w-4 animate-spin" style={{ color: BRAND }} /> در حال بارگذاری...
                            </div>
                          ) : notifications.length === 0 ? (
                            <div className="p-8 text-center text-xs text-zinc-400">اعلانی برای نمایش وجود ندارد.</div>
                          ) : (
                            notifications.map((n) => (
                              <div key={n.id} className={`border-b border-zinc-100 px-4 py-3 last:border-0 dark:border-zinc-800 ${n.read_at ? '' : 'bg-violet-50/50 dark:bg-violet-950/20'}`}>
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-xs font-bold text-zinc-800 dark:text-zinc-100">{n.title}</p>
                                  {!n.read_at && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: BRAND }} />}
                                </div>
                                <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">{n.body}</p>
                                <p className="mt-1.5 text-[10px] text-zinc-400">{formatDateTime(n.created_at)}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="hidden h-7 w-px bg-zinc-200 dark:bg-zinc-800 md:block" />

                <div className="hidden text-left md:block">
                  <p className="flex items-center justify-end gap-1.5 text-[11px] font-bold text-zinc-600 dark:text-zinc-300">
                    <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                    <span className="whitespace-nowrap">{formatGregorian(new Date())} | {formatJalali(new Date())}</span>
                  </p>
                  <button
                    onClick={handleRefresh}
                    className="mt-1 flex items-center justify-end gap-1 whitespace-nowrap text-[10px] text-zinc-400 transition hover:text-zinc-600 dark:hover:text-zinc-300"
                  >
                    <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
                    آخرین به‌روزرسانی: {refreshTime}
                  </button>
                </div>
              </div>
            </div>
          </header>

          {/* ── Page content (keyed by tenant so company data never lingers) ── */}
          <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6">
            <div key={selectedTenant?.id ?? 'no-tenant'}>
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {/* ── Company switcher panel ── */}
      {switcherOpen && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 sm:items-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSwitcherOpen(false)} />
          <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-[#1d1d20]">
            <div className="flex items-start justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
              <div>
                <h2 className="text-sm font-extrabold text-zinc-900 dark:text-zinc-50">تغییر شرکت</h2>
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">انتخاب شرکت، همه داده‌های فضای کاری را برای شرکت جدید بارگذاری می‌کند.</p>
              </div>
              <button onClick={() => setSwitcherOpen(false)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  value={companySearch}
                  onChange={(e) => setCompanySearch(e.target.value)}
                  placeholder="جست‌وجوی شرکت..."
                  className="h-10 border-zinc-200 bg-zinc-50 pr-9 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {switcherLoading ? (
                <div className="flex items-center justify-center gap-2 p-8 text-xs text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin" style={{ color: BRAND }} /> در حال بارگذاری شرکت‌ها...
                </div>
              ) : filteredCompanies.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-400">شرکتی یافت نشد.</div>
              ) : (
                <div className="space-y-2">
                  {filteredCompanies.map((c) => {
                    const isActive = c.id === tenantId
                    return (
                      <button
                        key={c.id}
                        onClick={() => switchCompany(c)}
                        className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-right transition ${
                          isActive
                            ? 'border-violet-300 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/30'
                            : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-[#161618] dark:hover:border-zinc-600'
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: isActive ? BRAND : '#A1A1AA' }}>
                            <Building2 className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-zinc-800 dark:text-zinc-100">{c.name}</p>
                            <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-zinc-400">
                              <span>{c.entity_type}</span>
                              {c.national_id && (
                                <>
                                  <span>·</span>
                                  <span className="flex items-center gap-0.5 font-mono" dir="ltr"><Hash className="h-2.5 w-2.5" />{c.national_id}</span>
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                        {isActive && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold" style={{ background: BRAND_SOFT, color: BRAND }}>
                            <Check className="h-3 w-3" />
                            شرکت فعال
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-zinc-100 px-5 py-3 dark:border-zinc-800">
              <button onClick={backToSelection} className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 py-2.5 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
                <ArrowRight className="h-3.5 w-3.5" />
                بازگشت به صفحه انتخاب شرکت
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar content (shared between desktop and mobile drawer)
// ─────────────────────────────────────────────────────────────────────────────

interface SidebarContentProps {
  tenantName?: string
  tenantNationalId?: string
  companyMenu: CompanyMenuItemNode[]
  loadingMenu: boolean
  menuError: string | null
  menuOpen: boolean
  setMenuOpen: (open: boolean) => void
  expandedGroups: Record<string, boolean>
  setExpandedGroups: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  onSwitchCompany: () => void
  onSignOut: () => void
}

function SidebarContent({
  tenantName,
  tenantNationalId,
  companyMenu,
  loadingMenu,
  menuError,
  menuOpen,
  setMenuOpen,
  expandedGroups,
  setExpandedGroups,
  onSwitchCompany,
  onSignOut,
}: SidebarContentProps) {
  return (
    <>
      {/* Brand block */}
      <div className="border-b border-zinc-100 px-4 py-5 dark:border-zinc-800">
        <p className="text-center text-xl font-black" style={{ color: BRAND }}>
          آگاهیم
        </p>
        <p className="mt-1 text-center text-[10px] text-zinc-400">پلتفرم انطباق و پایش کسب‌وکار</p>

        <button
          onClick={onSwitchCompany}
          className="mt-4 flex w-full items-center gap-2.5 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-right transition hover:border-zinc-300 dark:border-zinc-700 dark:bg-[#161618] dark:hover:border-zinc-600"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: BRAND_SOFT, color: BRAND }}>
            <Building2 className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-bold text-zinc-800 dark:text-zinc-100">{tenantName ?? 'انتخاب شرکت'}</span>
            <span className="block truncate text-[10px] text-zinc-400">{tenantNationalId ? `شناسه ملی: ${tenantNationalId}` : 'شرکت فعالی انتخاب نشده است'}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        {/* Fixed menu */}
        <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wide text-zinc-400">منوی اصلی</p>
        <nav className="space-y-1">
          {FIXED_MENU.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/panel/dashboard'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-bold transition ${
                  isActive
                    ? ''
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`
              }
              style={({ isActive }) => (isActive ? { background: BRAND_SOFT, color: BRAND } : undefined)}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Dynamic published company menu — separate section */}
        <div className="mt-6 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <button onClick={() => setMenuOpen(!menuOpen)} className="mb-2 flex w-full items-center justify-between px-2">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
              <Folder className="h-3.5 w-3.5" style={{ color: BRAND }} />
              منوی شرکت
            </p>
            <ChevronDown className={`h-3.5 w-3.5 text-zinc-400 transition ${menuOpen ? '' : 'rotate-180'}`} />
          </button>

          {menuOpen && (
            <div className="space-y-1">
              {loadingMenu ? (
                <div className="flex items-center gap-2 px-2 py-2.5 text-[11px] text-zinc-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: BRAND }} />
                  در حال بارگذاری منو...
                </div>
              ) : menuError ? (
                <p className="rounded-lg bg-red-50 px-2.5 py-2 text-[11px] leading-5 text-red-600 dark:bg-red-950/30 dark:text-red-300">
                  دریافت منوی شرکت ناموفق بود. سایر بخش‌ها بدون تغییر فعال هستند.
                </p>
              ) : companyMenu.length === 0 ? (
                <p className="px-2 py-2.5 text-[11px] text-zinc-400">هنوز منویی منتشر نشده است.</p>
              ) : (
                <div className="space-y-0.5">
                  {companyMenu.map((node) => (
                    <CompanyMenuNodeView
                      key={node.id}
                      node={node}
                      depth={0}
                      expandedGroups={expandedGroups}
                      setExpandedGroups={setExpandedGroups}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      </div>

      <div className="border-t border-zinc-100 px-3 py-3 dark:border-zinc-800">
        <nav className="space-y-1">
          <NavLink
            to="/panel/help"
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-bold transition ${
                isActive
                  ? ''
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
              }`
            }
            style={({ isActive }) => (isActive ? { background: BRAND_SOFT, color: BRAND } : undefined)}
          >
            <Headphones className="h-4 w-4 shrink-0" />
            <span className="truncate">راهنما و پشتیبانی</span>
          </NavLink>
          <button
            onClick={onSignOut}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-bold text-zinc-500 transition hover:bg-red-50 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-red-950/30 dark:hover:text-red-400"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            خروج
          </button>
        </nav>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Recursive dynamic menu renderer
// ─────────────────────────────────────────────────────────────────────────────

function CompanyMenuNodeView({
  node,
  depth,
  expandedGroups,
  setExpandedGroups,
}: {
  node: CompanyMenuItemNode
  depth: number
  expandedGroups: Record<string, boolean>
  setExpandedGroups: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
}) {
  const navigate = useNavigate()
  const isGroup = node.item_type === 'GROUP' && node.children.length > 0
  const open = expandedGroups[node.id] ?? false

  return (
    <div className="flex flex-col">
      <button
        onClick={() => {
          if (isGroup) setExpandedGroups((e) => ({ ...e, [node.id]: !open }))
          else if (node.form_obligation_id) navigate(`/panel/company-form/${node.form_obligation_id}`)
        }}
        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-right text-xs font-semibold text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        style={{ paddingRight: `${depth * 14 + 10}px` }}
      >
        {isGroup ? (
          <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition ${open ? '' : '-rotate-90'}`} style={{ color: BRAND }} />
        ) : (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: BRAND }} />
        )}
        <span className="truncate">{node.title_fa}</span>
      </button>
      {isGroup && open && node.children.map((c) => (                  <CompanyMenuNodeView key={c.id} node={c} depth={depth + 1} expandedGroups={expandedGroups} setExpandedGroups={setExpandedGroups} />
      ))}
    </div>
  )
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('fa-IR', { year: 'numeric', month: 'short', day: 'numeric' }) + ' — ' + date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
}

// Gregorian date rendered with Persian month names (e.g. «۲۹ اوت ۲۰۲۶»).
function formatGregorian(date: Date) {
  try {
    return new Intl.DateTimeFormat('fa-IR', { calendar: 'gregory', day: 'numeric', month: 'long', year: 'numeric' }).format(date)
  } catch {
    return date.toLocaleDateString('fa-IR')
  }
}

// Jalali date rendered in Persian (e.g. «شنبه، ۷ شهریور ۱۴۰۵»).
function formatJalali(date: Date) {
  try {
    return new Intl.DateTimeFormat('fa-IR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date)
  } catch {
    return ''
  }
}

function formatRefreshTime(date: Date) {
  try {
    return date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}
