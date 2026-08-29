import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Plus, Search, X, LogOut, ChevronLeft, MapPin, Hash, CircleCheck, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react'
import { Button } from '../../lib/shadcn/button'
import { Input } from '../../lib/shadcn/input'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { fetchUserTenants } from '../../lib/supabaseDb'
import type { Tenant, UserTenantWithTenant } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useTenant } from '../../context/TenantContext'
import ThemeToggle from '../../components/ThemeToggle'

const BRAND = '#5B4DE6'
const BRAND_SOFT = '#EEECFC'
const BRAND_LIGHT = '#F7F6FB'

interface Props {
  onAddNew: () => void
}

export default function TenantSwitcher({ onAddNew }: Props) {
  const { session, profile, signOut } = useAuth()
  const { selectTenant } = useTenant()
  const navigate = useNavigate()

  const [tenants, setTenants] = useState<Tenant[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTenants = useCallback(async () => {
    if (!session?.user?.id) return
    setLoading(true)
    setError(null)

    if (!isSupabaseConfigured) {
      try {
        const rows = await fetchUserTenants(session.user.id)
        const list: Tenant[] = rows
          .map((r) => r.tenants)
          .filter((t): t is Tenant => t !== null)
        setTenants(list)
      } catch (err) {
        setError('دریافت شرکت‌ها ناموفق بود. اتصال به پایگاه‌داده را بررسی کنید.')
      } finally {
        setLoading(false)
      }
      return
    }

    const { data, error: queryError } = await supabase
      .from('user_tenants')
      .select('*, tenants(*)')
      .eq('user_id', session.user.id)

    if (queryError) {
      setError(`خطا در بارگذاری شرکت‌ها: ${queryError.message}`)
      setLoading(false)
      return
    }

    const rows = (data ?? []) as UserTenantWithTenant[]
    const list: Tenant[] = rows
      .map((r) => r.tenants)
      .filter((t): t is Tenant => t !== null)

    setTenants(list)
    setLoading(false)
  }, [session?.user?.id])

  useEffect(() => {
    void fetchTenants()
  }, [fetchTenants])

  const handleSelect = (tenant: Tenant) => {
    selectTenant(tenant)
    navigate('/panel/dashboard')
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  // Filter tenants based on search query (name or national/economic identifier)
  const filteredTenants = tenants.filter((tenant) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase().trim()
    return (
      tenant.name.toLowerCase().includes(q) ||
      (tenant.entity_type && tenant.entity_type.toLowerCase().includes(q)) ||
      (tenant.national_id && tenant.national_id.includes(q)) ||
      (tenant.economic_code && tenant.economic_code.includes(q)) ||
      (tenant.province && tenant.province.toLowerCase().includes(q))
    )
  })

  return (
    <div dir="rtl" className="min-h-screen text-zinc-800 dark:text-zinc-100" style={{ background: BRAND_LIGHT }}>
      <div className="mx-auto min-h-screen w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-7">
        {/* ── Header ── */}
        <header className="mb-7 flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-4 py-3.5 shadow-sm dark:border-zinc-800 dark:bg-[#161618] sm:px-5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ background: BRAND }}>
              <Building2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100">انتخاب شرکت</p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">فضای کاری شرکت — سامانه انطباق آگاهیم</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle className="h-8 text-xs px-2.5 sm:h-9 sm:px-3" />
            <span className="hidden max-w-[180px] truncate text-xs text-zinc-500 dark:text-zinc-400 md:inline">
              {profile?.email ?? profile?.phone ?? '—'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="gap-1.5 text-xs text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-red-950/40 dark:hover:text-red-400"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">خروج</span>
            </Button>
          </div>
        </header>

        {/* ── Title + Add ── */}
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-50 sm:text-2xl">انتخاب شرکت</h1>
            <p className="mt-1.5 max-w-xl text-xs leading-6 text-zinc-500 dark:text-zinc-400 sm:text-sm">
              شرکتی را که می‌خواهید در آن کار کنید انتخاب کنید. پس از ورود، داشبورد، منو و تعهدهای همان شرکت نمایش داده می‌شود.
            </p>
          </div>
          <Button
            onClick={onAddNew}
            className="h-10 shrink-0 gap-2 text-xs font-bold text-white shadow-sm sm:h-11"
            style={{ background: BRAND }}
          >
            <Plus className="h-4 w-4" />
            افزودن شرکت
          </Button>
        </div>

        {/* ── Search ── */}
        {tenants.length > 0 && (
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-3.5 py-2.5 shadow-sm dark:border-zinc-800 dark:bg-[#161618]">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" style={{ color: BRAND }} />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جست‌وجوی شرکت بر اساس نام یا شناسه (کد ملی / کد اقتصادی)..."
                className="h-10 border-zinc-200 bg-zinc-50 pr-10 pl-9 text-xs text-zinc-800 placeholder:text-zinc-400 focus:border-transparent dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                style={{ boxShadow: 'none' }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
                  title="پاک‌کردن عبارت جستجو"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="hidden shrink-0 text-[11px] font-medium text-zinc-400 sm:block">
              نمایش <span className="font-bold text-zinc-700 dark:text-zinc-200">{filteredTenants.length.toLocaleString('fa-IR')}</span> از{' '}
              <span className="font-bold text-zinc-500">{tenants.length.toLocaleString('fa-IR')}</span> شرکت
            </div>
          </div>
        )}

        {/* ── Error state ── */}
        {!loading && error && (
          <div className="mb-5 flex flex-col items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-900/60 dark:bg-red-950/30">
            <div className="flex items-center gap-2 text-sm font-bold text-red-700 dark:text-red-300">
              <AlertTriangle className="h-5 w-5" />
              خطا در دریافت اطلاعات
            </div>
            <p className="text-xs leading-6 text-red-600/90 dark:text-red-300/80">{error}</p>
            <Button size="sm" variant="outline" onClick={() => void fetchTenants()} className="gap-2 border-red-300 text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40">
              <RefreshCw className="h-3.5 w-3.5" />
              تلاش دوباره
            </Button>
          </div>
        )}

        {/* ── Loading skeletons ── */}
        {loading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#161618]">
                <div className="mb-4 h-10 w-10 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
                <div className="mb-2 h-4 w-2/3 rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-3 w-1/3 rounded bg-zinc-100 dark:bg-zinc-800" />
              </div>
            ))}
          </div>
        )}

        {/* ── Empty: no companies at all ── */}
        {!loading && !error && tenants.length === 0 && (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-[#161618]">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl text-zinc-400" style={{ background: BRAND_SOFT }}>
              <Building2 className="h-7 w-7" />
            </span>
            <div>
              <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100">هنوز هیچ شرکتی ندارید</p>
              <p className="mx-auto mt-1.5 max-w-sm text-xs leading-6 text-zinc-500 dark:text-zinc-400">
                ابتدا شرکت خود را ثبت کنید تا بتوانید فضای کاری و تعهدهای آن را مدیریت کنید.
              </p>
            </div>
            <Button onClick={onAddNew} className="gap-2 text-xs font-bold text-white" style={{ background: BRAND }}>
              <Plus className="h-4 w-4" />
              افزودن اولین شرکت
            </Button>
          </div>
        )}

        {/* ── Empty: search has no result ── */}
        {!loading && !error && tenants.length > 0 && filteredTenants.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-zinc-700 dark:bg-[#161618]">
            <Search className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
            <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200">شرکتی با عبارت «{searchQuery}» یافت نشد.</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">عبارت دیگری را جست‌وجو کنید یا فیلتر را پاک کنید.</p>
            <Button size="sm" variant="outline" onClick={() => setSearchQuery('')} className="mt-1 border-zinc-300 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
              پاک‌کردن فیلتر جست‌وجو
            </Button>
          </div>
        )}

        {/* ── Company list ── */}
        {!loading && !error && filteredTenants.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTenants.map((tenant) => (
              <div
                key={tenant.id}
                className="group flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-[#161618] dark:hover:border-zinc-700"
              >
                <div>
                  <div className="mb-4 flex items-start justify-between gap-2">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: BRAND }}>
                      <Building2 className="h-5 w-5" />
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                      <CircleCheck className="h-3 w-3" />
                      فعال
                    </span>
                  </div>

                  <h3 className="mb-3 truncate text-base font-extrabold text-zinc-900 dark:text-zinc-50">{tenant.name}</h3>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">نوع شخصیت</span>
                      <span className="font-semibold text-zinc-700 dark:text-zinc-200">{tenant.entity_type}</span>
                    </div>
                    {tenant.national_id && (
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-zinc-400"><Hash className="h-3 w-3" />شناسه ملی</span>
                        <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-200" dir="ltr">{tenant.national_id}</span>
                      </div>
                    )}
                    {tenant.province && (
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-zinc-400"><MapPin className="h-3 w-3" />استان</span>
                        <span className="font-semibold text-zinc-700 dark:text-zinc-200">{tenant.province}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between border-t border-zinc-100 pt-2 dark:border-zinc-800">
                      <span className="text-zinc-400">آخرین ورود</span>
                      <span className="text-zinc-500 dark:text-zinc-400">—</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleSelect(tenant)}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold text-white transition hover:opacity-90"
                  style={{ background: BRAND }}
                >
                  ورود به فضای شرکت
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Footer note ── */}
        {!loading && !error && tenants.length > 0 && (
          <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
            <Loader2 className="h-3 w-3" />
            فقط شرکت‌هایی که به آن‌ها دسترسی دارید نمایش داده می‌شود.
          </p>
        )}
      </div>
    </div>
  )
}
