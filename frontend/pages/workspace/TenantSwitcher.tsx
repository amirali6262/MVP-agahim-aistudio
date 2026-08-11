import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Building2, Plus, MapPin, Tag, ChevronLeft, LogOut, Search, X } from 'lucide-react'
import { Button } from '../../lib/shadcn/button'
import { Input } from '../../lib/shadcn/input'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { mockTenantsDb } from '../../lib/mockDb'
import type { Tenant, UserTenantWithTenant } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useTenant } from '../../context/TenantContext'

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

  const fetchTenants = useCallback(async () => {
    if (!session?.user?.id) return
    setLoading(true)

    if (!isSupabaseConfigured) {
      const rows = mockTenantsDb.getForUser(session.user.id)
      const list: Tenant[] = rows
        .map((r) => r.tenants)
        .filter((t): t is Tenant => t !== null)
      setTenants(list)
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('user_tenants')
      .select('*, tenants(*)')
      .eq('user_id', session.user.id)

    if (error) {
      toast.error('خطا در بارگذاری شرکت‌ها: ' + error.message)
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

  // Filter tenants based on search query
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
    <div className="min-h-screen p-6 max-w-7xl mx-auto" style={{ background: '#0a0c0b' }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-4 rounded-xl border border-zinc-800 mb-8"
        style={{ background: '#141615' }}
      >
        <div className="flex items-center gap-3">
          <Building2 className="w-5 h-5 text-[#E5A93C]" />
          <span className="text-zinc-100 font-bold">انتخاب شرکت و محیط کاری</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-zinc-400 text-sm truncate max-w-[200px]">
            {profile?.email ?? profile?.phone ?? '—'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="text-zinc-400 hover:text-red-400 hover:bg-red-900/20 gap-2 text-xs"
          >
            <LogOut className="w-4 h-4" />
            خروج
          </Button>
        </div>
      </header>

      {/* Top Title & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-zinc-100 text-xl font-bold">شرکت‌های شما</h2>
          <p className="text-zinc-400 text-xs mt-1">
            جهت ورود به پنل تکالیف مالیاتی و دفاتر تجاری، شرکت مورد نظر را انتخاب نمایید.
          </p>
        </div>

        <Button
          onClick={onAddNew}
          className="bg-[#E5A93C] hover:bg-[#d49a2d] text-[#181614] font-bold text-xs h-10 px-4 shadow gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          افزودن شرکت جدید
        </Button>
      </div>

      {/* Search Input Bar */}
      {tenants.length > 0 && (
        <div className="mb-6 bg-[#141615] border border-zinc-800 p-3.5 rounded-2xl flex items-center gap-3 shadow-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-amber-400 absolute right-3 top-3" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی سریع شرکت (بر اساس نام شرکت، شناسه/کد ملی، کد اقتصادی یا استان)..."
              className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 pr-10 pl-9 h-10 text-xs rounded-xl focus:border-amber-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-2.5 text-zinc-400 hover:text-white p-0.5"
                title="پاک‌کردن عبارت جستجو"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="text-xs text-zinc-400 font-medium px-2 shrink-0">
            نمایش <span className="text-amber-400 font-bold font-mono">{filteredTenants.length}</span> از{' '}
            <span className="text-zinc-300 font-mono">{tenants.length}</span> شرکت
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-zinc-800 p-6 animate-pulse"
              style={{ background: '#141615' }}
            >
              <div className="h-5 bg-zinc-800 rounded w-2/3 mb-3" />
              <div className="h-4 bg-zinc-800 rounded w-1/3 mb-2" />
              <div className="h-4 bg-zinc-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state (No tenants at all) */}
      {!loading && tenants.length === 0 && (
        <div
          className="rounded-2xl border border-zinc-800 p-12 flex flex-col items-center gap-4 text-center"
          style={{ background: '#141615' }}
        >
          <Building2 className="w-12 h-12 text-zinc-700" />
          <p className="text-zinc-400 text-sm">هنوز هیچ شرکتی اضافه نکرده‌اید.</p>
          <Button
            onClick={onAddNew}
            className="bg-[#E5A93C] hover:bg-[#d49a2d] text-[#181614] font-bold text-xs gap-2"
          >
            <Plus className="w-4 h-4" />
            افزودن اولین شرکت
          </Button>
        </div>
      )}

      {/* Empty Search Result State */}
      {!loading && tenants.length > 0 && filteredTenants.length === 0 && (
        <div
          className="rounded-2xl border border-zinc-800 p-10 flex flex-col items-center gap-3 text-center"
          style={{ background: '#141615' }}
        >
          <Search className="w-10 h-10 text-amber-500/50 mb-1" />
          <p className="text-zinc-200 font-bold text-sm">شرکتی با عبارت "{searchQuery}" یافت نشد.</p>
          <p className="text-zinc-500 text-xs">عبارت دیگری را جستجو کرده یا فیلتر را پاک کنید.</p>
          <Button
            variant="outline"
            onClick={() => setSearchQuery('')}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs h-9 mt-2"
          >
            پاک‌کردن فیلتر جستجو
          </Button>
        </div>
      )}

      {/* Tenant grid */}
      {!loading && filteredTenants.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTenants.map((tenant) => (
            <button
              key={tenant.id}
              onClick={() => handleSelect(tenant)}
              className="group rounded-2xl border border-zinc-800 p-6 text-right hover:border-amber-500/80 hover:shadow-xl hover:shadow-amber-950/20 transition-all cursor-pointer w-full flex flex-col justify-between"
              style={{ background: '#141615' }}
            >
              <div>
                <div className="flex items-start justify-between mb-4">
                  <ChevronLeft className="w-5 h-5 text-zinc-600 group-hover:text-amber-400 transition-colors mt-0.5" />
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-amber-400" />
                  </div>
                </div>

                <h3 className="text-zinc-100 font-bold text-base mb-3 truncate group-hover:text-amber-300 transition-colors">
                  {tenant.name}
                </h3>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-zinc-400 text-xs">
                    <Tag className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="font-semibold text-zinc-300">{tenant.entity_type}</span>
                  </div>

                  {tenant.national_id && (
                    <div className="text-zinc-400 text-xs flex items-center gap-2">
                      <span className="text-zinc-500">شناسه/کد ملی:</span>
                      <span className="font-mono text-zinc-200 font-bold">{tenant.national_id}</span>
                    </div>
                  )}

                  {tenant.province && (
                    <div className="flex items-center gap-2 text-zinc-500 text-xs mt-1">
                      <MapPin className="w-3.5 h-3.5 text-amber-400/70" />
                      <span>{tenant.province}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-amber-400 font-bold group-hover:translate-x-[-2px] transition-transform">
                <span>ورود به پنل تکالیف</span>
                <ChevronLeft className="w-4 h-4" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
