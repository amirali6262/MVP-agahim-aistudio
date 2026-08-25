import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Search,
  Users,
  UserCog,
  Crown,
  Shield,
  UserPlus,
  RefreshCw,
  Info,
  UserX,
  AlertTriangle,
  Building2,
  Mail,
  Phone,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useTenant } from '../../context/TenantContext'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MemberRow = {
  id: string
  user_id: string
  tenant_id: string
  role: string
  created_at: string
  users?: { email: string | null; phone: string | null } | null
}

// ---------------------------------------------------------------------------
// Role definitions for company members
// ---------------------------------------------------------------------------

interface MemberRoleDefinition {
  key: string
  label: string
  persianLabel: string
  description: string
  color: string
  bgColor: string
  borderColor: string
  icon: typeof Crown
}

const MEMBER_ROLES: MemberRoleDefinition[] = [
  {
    key: 'OWNER',
    label: 'مالک',
    persianLabel: 'مالک شرکت',
    description: 'بالاترین دسترسی در شرکت. مدیریت اعضا، تنظیمات و کلیه عملیات.',
    color: 'text-amber-300',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    icon: Crown,
  },
  {
    key: 'ADMIN',
    label: 'مدیر شرکت',
    persianLabel: 'مدیر شرکت',
    description: 'مدیریت عملیاتی شرکت. مشاهده و ویرایش اطلاعات، مدیریت اعضا.',
    color: 'text-violet-300',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/30',
    icon: Shield,
  },
  {
    key: 'MEMBER',
    label: 'عضو',
    persianLabel: 'عضو شرکت',
    description: 'مشاهده اطلاعات و انجام وظایف محوله. دسترسی محدود به عملیات.',
    color: 'text-emerald-300',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    icon: UserCog,
  },
]

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function CompanyMembersPage() {
  const { profile } = useAuth()
  const { selectedTenant } = useTenant()
  const [members, setMembers] = useState<MemberRow[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [showAddMember, setShowAddMember] = useState(false)
  const [newMemberEmail, setNewMemberEmail] = useState('')
  const [newMemberRole, setNewMemberRole] = useState('MEMBER')
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)

  const tenantId = selectedTenant?.id

  const loadMembers = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)

    if (!isSupabaseConfigured) {
      // Mock data for demo
      setMembers([
        {
          id: 'mock-mem-1',
          user_id: 'mock-user-00000002',
          tenant_id: tenantId,
          role: 'OWNER',
          created_at: '2024-01-01T00:00:00Z',
          users: { email: 'user@samaneh.ir', phone: null },
        },
        {
          id: 'mock-mem-2',
          user_id: 'mock-user-00000003',
          tenant_id: tenantId,
          role: 'ADMIN',
          created_at: '2024-01-02T00:00:00Z',
          users: { email: 'admin@company.ir', phone: null },
        },
        {
          id: 'mock-mem-3',
          user_id: 'mock-user-00000004',
          tenant_id: tenantId,
          role: 'MEMBER',
          created_at: '2024-01-03T00:00:00Z',
          users: { email: 'member@company.ir', phone: null },
        },
      ])
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('user_tenants')
      .select('*, users(email, phone)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('بارگذاری اعضای شرکت انجام نشد.')
      console.error(error)
    }
    setMembers((data ?? []) as unknown as MemberRow[])
    setLoading(false)
  }, [tenantId])

  useEffect(() => {
    void loadMembers()
  }, [loadMembers])

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return members
    return members.filter((m) => {
      const roleDef = MEMBER_ROLES.find((r) => r.key === m.role)
      return `${m.users?.email ?? ''} ${m.users?.phone ?? ''} ${roleDef?.persianLabel ?? m.role}`.toLowerCase().includes(query)
    })
  }, [search, members])

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const m of members) {
      counts[m.role] = (counts[m.role] || 0) + 1
    }
    return counts
  }, [members])

  const updateMemberRole = async (member: MemberRow, newRole: string) => {
    if (member.user_id === profile?.id) {
      toast.error('نقش خود قابل تغییر نیست.')
      return
    }

    // Only OWNER can change roles
    const currentMember = members.find((m) => m.user_id === profile?.id)
    if (currentMember?.role !== 'OWNER') {
      toast.error('فقط مالک شرکت مجاز به تغییر نقش اعضا است.')
      return
    }

    setSavingId(member.id)

    if (!isSupabaseConfigured) {
      setMembers((current) =>
        current.map((m) => (m.id === member.id ? { ...m, role: newRole } : m))
      )
      const roleDef = MEMBER_ROLES.find((r) => r.key === newRole)
      toast.success(`نقش کاربر با موفقیت به «${roleDef?.persianLabel ?? newRole}» تغییر یافت.`)
      setSavingId(null)
      return
    }

    const { error } = await supabase
      .from('user_tenants')
      .update({ role: newRole })
      .eq('id', member.id)

    if (error) {
      toast.error('تغییر نقش ذخیره نشد.')
      setSavingId(null)
      return
    }

    setMembers((current) =>
      current.map((m) => (m.id === member.id ? { ...m, role: newRole } : m))
    )
    const roleDef = MEMBER_ROLES.find((r) => r.key === newRole)
    toast.success(`نقش کاربر با موفقیت به «${roleDef?.persianLabel ?? newRole}» تغییر یافت.`)
    setSavingId(null)
  }

  const removeMember = async (member: MemberRow) => {
    if (member.user_id === profile?.id) {
      toast.error('حذف خود از شرکت مجاز نیست.')
      return
    }

    if (!isSupabaseConfigured) {
      setMembers((current) => current.filter((m) => m.id !== member.id))
      setConfirmRemove(null)
      toast.success('عضو با موفقیت حذف شد.')
      return
    }

    const { error } = await supabase.from('user_tenants').delete().eq('id', member.id)
    if (error) {
      toast.error('حذف عضو انجام نشد.')
      return
    }
    setMembers((current) => current.filter((m) => m.id !== member.id))
    setConfirmRemove(null)
    toast.success('عضو با موفقیت حذف شد.')
  }

  const addMember = () => {
    if (!newMemberEmail.trim()) {
      toast.error('ایمیل عضو جدید را وارد کنید.')
      return
    }

    if (!isSupabaseConfigured) {
      const newMember: MemberRow = {
        id: 'mock-mem-' + Date.now(),
        user_id: 'mock-new-' + Date.now(),
        tenant_id: tenantId ?? '',
        role: newMemberRole,
        created_at: new Date().toISOString(),
        users: { email: newMemberEmail.trim(), phone: null },
      }
      setMembers((current) => [newMember, ...current])
      toast.success('عضو جدید با موفقیت اضافه شد.')
      setNewMemberEmail('')
      setNewMemberRole('MEMBER')
      setShowAddMember(false)
      return
    }

    toast.info('افزودن عضو در حالت اتصال واقعی پایگاه‌داده امکان‌پذیر است.')
  }

  const getRoleDef = (role: string): MemberRoleDefinition => {
    return (
      MEMBER_ROLES.find((r) => r.key === role) ?? {
        key: role,
        label: role,
        persianLabel: role,
        description: '',
        color: 'text-zinc-300',
        bgColor: 'bg-zinc-500/10',
        borderColor: 'border-zinc-500/30',
        icon: UserCog,
      }
    )
  }

  const isOwner = members.find((m) => m.user_id === profile?.id)?.role === 'OWNER'

  return (
    <div className="min-h-full p-4 sm:p-8" dir="rtl">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* ── Hero Header ── */}
        <section className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-[#29231d] via-[#211d1a] to-[#151311] p-6 shadow-2xl sm:p-8">
          <div className="absolute -left-16 -top-20 h-56 w-56 rounded-full bg-amber-500/10 blur-3xl" />
          <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300">
                <Building2 className="h-3.5 w-3.5" />
                مدیریت اعضای شرکت
              </div>
              <h2 className="text-2xl font-bold text-white sm:text-3xl">
                اعضای {selectedTenant?.name ?? 'شرکت'}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-zinc-300">
                مدیریت اعضای شرکت و نقش‌های آن‌ها در فضای کاری.
                تعیین کنید چه کسی مالک است، چه کسی مدیر شرکت و چه کسی عضو عادی.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => void loadMembers()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/70 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-amber-500/60 hover:text-amber-300"
              >
                <RefreshCw className="h-4 w-4" />
                به‌روزرسانی
              </button>
              {isOwner && (
                <button
                  onClick={() => setShowAddMember(!showAddMember)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-500"
                >
                  <UserPlus className="h-4 w-4" />
                  افزودن عضو
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ── Summary Cards ── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard icon={Users} label="کل اعضا" value={members.length.toString()} color="text-amber-400" bg="bg-amber-950/30 border-amber-800/40" />
          <SummaryCard icon={Crown} label="مالکان" value={(roleCounts['OWNER'] ?? 0).toString()} color="text-amber-300" bg="bg-amber-950/20 border-amber-800/30" />
          <SummaryCard icon={Shield} label="مدیران شرکت" value={(roleCounts['ADMIN'] ?? 0).toString()} color="text-violet-300" bg="bg-violet-950/20 border-violet-800/30" />
          <SummaryCard icon={UserCog} label="اعضای عادی" value={(roleCounts['MEMBER'] ?? 0).toString()} color="text-emerald-300" bg="bg-emerald-950/20 border-emerald-800/30" />
        </div>

        {/* ── Add Member Form ── */}
        {showAddMember && (
          <section className="rounded-2xl border border-amber-800/60 bg-[#1d1a18] p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30">
                <UserPlus className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-white">افزودن عضو جدید</h3>
                <p className="text-xs text-zinc-400 mt-0.5">ایمیل و نقش مورد نظر را مشخص کنید</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-zinc-400">ایمیل کاربر</label>
                <input
                  type="email"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  placeholder="user@example.com"
                  dir="ltr"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-white outline-none transition focus:border-amber-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-400">نقش در شرکت</label>
                <select
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-200 outline-none transition focus:border-amber-500"
                >
                  {MEMBER_ROLES.map((r) => (
                    <option key={r.key} value={r.key}>{r.persianLabel}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={addMember} className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-500">
                افزودن عضو
              </button>
              <button
                onClick={() => { setShowAddMember(false); setNewMemberEmail(''); setNewMemberRole('MEMBER') }}
                className="rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800"
              >
                انصراف
              </button>
            </div>
          </section>
        )}

        {/* ── Info Banner ── */}
        <section className="rounded-2xl border border-blue-900/60 bg-blue-950/20 p-4 text-sm leading-7 text-blue-100">
          <div className="flex gap-3">
            <Info className="mt-1 h-4 w-4 shrink-0 text-blue-300" />
            <div>
              <p>
                <b>تفاوت با مدیریت پلتفرم:</b> نقش‌های این صفحه مخصوص فضای کاری این شرکت هستند.
                نقش‌های پلتفرم (مدیر، ثبت‌کننده، بازبین، تأییدکننده) در بخش «کاربران و سطح دسترسی» پنل مدیریت تعریف می‌شوند.
              </p>
            </div>
          </div>
        </section>

        {/* ── Role Definitions ── */}
        <section>
          <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-amber-400" />
            نقش‌ها در شرکت
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            {MEMBER_ROLES.map((role) => {
              const Icon = role.icon
              const count = roleCounts[role.key] ?? 0
              return (
                <div key={role.key} className={`rounded-2xl border ${role.borderColor} ${role.bgColor} p-5`}>
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${role.bgColor} border ${role.borderColor}`}>
                      <Icon className={`h-5 w-5 ${role.color}`} />
                    </div>
                    <div>
                      <h4 className={`font-bold ${role.color}`}>{role.persianLabel}</h4>
                      <p className="text-xs text-zinc-400 mt-0.5">{count} نفر</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-6 text-zinc-300">{role.description}</p>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── Members List ── */}
        <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#1d1a18] shadow-xl">
          <div className="flex flex-col gap-4 border-b border-zinc-800 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-bold text-white flex items-center gap-2">
                <Users className="h-4 w-4 text-amber-400" />
                فهرست اعضا
              </h3>
              <p className="mt-1 text-xs text-zinc-500">فقط مالک شرکت مجاز به تغییر نقش و حذف اعضا است.</p>
            </div>
            <div className="relative">
              <Search className="absolute right-3 top-3 h-4 w-4 text-zinc-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="جست‌وجوی ایمیل یا نقش..."
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 pr-10 pl-3 text-sm text-white outline-none transition focus:border-amber-500 sm:w-80"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
              <p className="mt-3 text-sm text-zinc-400">در حال بارگذاری اعضا...</p>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="p-12 text-center text-sm text-zinc-400">
              <UserX className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
              عضوی با این مشخصات پیدا نشد.
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {filteredMembers.map((member) => {
                const roleDef = getRoleDef(member.role)
                const RoleIcon = roleDef.icon
                const isSelf = member.user_id === profile?.id
                return (
                  <div key={member.id} className="flex flex-col gap-4 p-5 transition hover:bg-zinc-900/40 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${roleDef.borderColor} ${roleDef.bgColor} ${roleDef.color}`}>
                        <RoleIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-zinc-100">
                            {member.users?.email ?? member.users?.phone ?? 'شناسه بدون اطلاعات'}
                          </span>
                          {isSelf && (
                            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30">
                              شما
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {member.users?.email ?? '—'}
                          </span>
                          {member.users?.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {member.users.phone}
                            </span>
                          )}
                          <span className="text-zinc-700">•</span>
                          <span>عضویت: {new Date(member.created_at).toLocaleDateString('fa-IR')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {isOwner && !isSelf ? (
                        <select
                          disabled={savingId === member.id}
                          value={member.role}
                          onChange={(e) => void updateMemberRole(member, e.target.value)}
                          className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {MEMBER_ROLES.map((r) => (
                            <option key={r.key} value={r.key}>{r.persianLabel}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${roleDef.bgColor} ${roleDef.color} border ${roleDef.borderColor}`}>
                          {roleDef.persianLabel}
                        </span>
                      )}

                      {isOwner && !isSelf && (
                        <>
                          {confirmRemove === member.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => void removeMember(member)}
                                className="rounded-lg bg-red-600 px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-red-500 transition"
                              >
                                حذف
                              </button>
                              <button
                                onClick={() => setConfirmRemove(null)}
                                className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-[10px] font-bold text-zinc-300 hover:bg-zinc-800 transition"
                              >
                                انصراف
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmRemove(member.id)}
                              className="rounded-lg border border-red-900/60 px-2.5 py-1.5 text-[10px] font-semibold text-red-400 hover:bg-red-950/40 transition"
                              title="حذف عضو"
                            >
                              <UserX className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Security Notice ── */}
        <section className="rounded-2xl border border-zinc-800 bg-[#1d1a18] p-5 shadow-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div>
              <h4 className="font-bold text-sm text-zinc-200">قوانین مدیریت اعضای شرکت</h4>
              <ul className="mt-2 space-y-1 text-xs leading-6 text-zinc-400">
                <li className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-amber-500 flex-shrink-0" /> فقط مالک شرکت مجاز به تغییر نقش و حذف اعضا است.</li>
                <li className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-amber-500 flex-shrink-0" /> مالک نمی‌تواند نقش خود را تغییر دهد یا خود را حذف کند.</li>
                <li className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-amber-500 flex-shrink-0" /> حذف مالک تنها با انتقال مالکیت به عضو دیگر امکان‌پذیر است.</li>
                <li className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-amber-500 flex-shrink-0" /> نقش‌های پلتفرم در پنل مدیریت و نقش‌های شرکت در فضای کاری مدیریت می‌شوند.</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SummaryCard({
  icon: Icon,
  label,
  value,
  color,
  bg,
}: {
  icon: typeof Users
  label: string
  value: string
  color: string
  bg: string
}) {
  return (
    <div className={`rounded-2xl border ${bg} p-5`}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-400">{label}</span>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div className="mt-3 text-2xl font-bold text-white font-mono">{value}</div>
    </div>
  )
}
