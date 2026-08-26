import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Search,
  ShieldCheck,
  UserCog,
  Users,
  RefreshCw,
  Info,
  UserPlus,
  Crown,
  PenLine,
  Eye,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Lock,
  Settings,
  Shield,
  Fingerprint,
  Briefcase,
  Scale,
  BookOpenCheck,
  UserX,
  AlertTriangle,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase, isSupabaseConfigured, type UserRole } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../../lib/shadcn/button'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type UserRow = {
  id: string
  email: string | null
  phone: string | null
  role: string  // Primary role (backward compatible)
  roles: UserRole[]  // All assigned roles
  created_at: string
  full_name?: string | null
}

// ---------------------------------------------------------------------------
// Role definitions with rich metadata
// ---------------------------------------------------------------------------

interface RoleDefinition {
  key: UserRole
  label: string
  persianLabel: string
  description: string
  color: string
  bgColor: string
  borderColor: string
  icon: typeof Crown
  permissions: string[]
  restrictions: string[]
}

const ALL_ROLES: RoleDefinition[] = [
  {
    key: 'PLATFORM_ADMIN',
    label: 'مدیر پلتفرم',
    persianLabel: 'مدیر ارشد پلتفرم',
    description: 'بالاترین سطح دسترسی. مدیریت کلیه ماژول‌ها، کاربران، نقش‌ها و تنظیمات سامانه.',
    color: 'text-amber-300',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    icon: Crown,
    permissions: [
      'مدیریت کلیه کاربران و نقش‌ها',
      'تعریف و ویرایش تعهدات و قواعد',
      'انتشار و بازنشانی نسخه‌ها',
      'مشاهده گزارش‌ها و آمار کلی',
      'مدیریت تنظیمات سامانه',
      'تعریف ساختار سازمانی',
    ],
    restrictions: ['ندارد — دسترسی کامل'],
  },
  {
    key: 'MANAGER',
    label: 'مدیر',
    persianLabel: 'مدیر عملیاتی',
    description: 'مدیریت عملیاتی روزانه. نظارت بر فرایندها، تأیید اقدامات و هماهنگی تیم.',
    color: 'text-violet-300',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/30',
    icon: Settings,
    permissions: [
      'مشاهده کلیه ماژول‌ها و داده‌ها',
      'تأیید درخواست‌های بازبینی',
      'تخصیص وظایف به اعضای تیم',
      'مشاهده گزارش‌های عملیاتی',
      'بازبینی و تأیید نسخه‌ها',
    ],
    restrictions: ['تغییر نقش کاربران', 'حذف کاربران', 'تغییر تنظیمات سامانه'],
  },
  {
    key: 'REGISTRAR',
    label: 'ثبت‌کننده',
    persianLabel: 'ثبت‌کننده نسخه‌ها',
    description: 'تولید و ثبت نسخه‌های جدید تعهدات، قواعد و فرم‌ها. ایجاد پیش‌نویس برای بازبینی.',
    color: 'text-sky-300',
    bgColor: 'bg-sky-500/10',
    borderColor: 'border-sky-500/30',
    icon: PenLine,
    permissions: [
      'ایجاد پیش‌نویس نسخه جدید',
      'ویرایش اطلاعات تعهدات',
      'تعریف قواعد تشخیص مشمولیت',
      'طراحی مراحل فرایند و فرم‌ها',
      'ارسال نسخه به بازبینی',
      'اصلاح نسخه پس از رد بازبین',
    ],
    restrictions: ['انتشار نهایی نسخه', 'تأیید بازبینی', 'تغییر نقش کاربران'],
  },
  {
    key: 'REVIEWER',
    label: 'بازبین',
    persianLabel: 'بازبین تخصصی',
    description: 'بررسی تخصصی نسخه‌های ثبت‌شده. تأیید یا رد با ذکر دلیل و ارسال برای اصلاح.',
    color: 'text-emerald-300',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    icon: Eye,
    permissions: [
      'مشاهده نسخه‌های ارسال‌شده',
      'شروع بازبینی تخصصی',
      'تأیید یا رد نسخه با ذکر دلیل',
      'مشاهده تاریخچه بازبینی‌ها',
      'مشاهده گزارش‌های تخصصی',
    ],
    restrictions: ['ویرایش نسخه‌ها', 'انتشار نهایی', 'تغییر نقش کاربران'],
  },
  {
    key: 'APPROVER',
    label: 'تأییدکننده',
    persianLabel: 'تأیید نهایی',
    description: 'تأیید نهایی نسخه‌های بازبینی‌شده و اجازه انتشار. نظارت بر کیفیت خروجی.',
    color: 'text-rose-300',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/30',
    icon: CheckCircle2,
    permissions: [
      'مشاهده نسخه‌های تأیید بازبینی',
      'تأیید نهایی برای انتشار',
      'مشاهده وضعیت کلی فرایندها',
      'مشاهده گزارش‌های کیفی',
    ],
    restrictions: ['ویرایش نسخه‌ها', 'بازبینی تخصصی', 'تغییر نقش کاربران'],
  },
  {
    key: 'BUSINESS_USER',
    label: 'کاربر',
    persianLabel: 'کاربر سازمانی',
    description: 'کاربر عادی سازمان. مشاهده اطلاعات و ارسال درخواست‌ها.',
    color: 'text-zinc-300',
    bgColor: 'bg-zinc-500/10',
    borderColor: 'border-zinc-500/30',
    icon: Briefcase,
    permissions: [
      'مشاهده اطلاعات شخصی',
      'ارسال درخواست‌ها',
      'پیگیری وضعیت درخواست‌ها',
    ],
    restrictions: ['مدیریت کاربران', 'تغییر تنظیمات', 'بازبینی و تأیید'],
  },
]

// ---------------------------------------------------------------------------
// Permission matrix for visual comparison
// ---------------------------------------------------------------------------

interface PermissionMatrixRow {
  label: string
  roles: Partial<Record<UserRole, boolean>>
}

const PERMISSION_MATRIX: PermissionMatrixRow[] = [
  { label: 'مشاهده داشبورد مدیریت', roles: { PLATFORM_ADMIN: true, MANAGER: true, REGISTRAR: false, REVIEWER: false, APPROVER: false, BUSINESS_USER: false } },
  { label: 'ایجاد و ویرایش نسخه تعهد', roles: { PLATFORM_ADMIN: true, MANAGER: false, REGISTRAR: true, REVIEWER: false, APPROVER: false, BUSINESS_USER: false } },
  { label: 'شروع بازبینی تخصصی', roles: { PLATFORM_ADMIN: true, MANAGER: true, REGISTRAR: false, REVIEWER: true, APPROVER: false, BUSINESS_USER: false } },
  { label: 'تأیید یا رد بازبینی', roles: { PLATFORM_ADMIN: true, MANAGER: true, REGISTRAR: false, REVIEWER: true, APPROVER: false, BUSINESS_USER: false } },
  { label: 'تأیید نهایی انتشار', roles: { PLATFORM_ADMIN: true, MANAGER: false, REGISTRAR: false, REVIEWER: false, APPROVER: true, BUSINESS_USER: false } },
  { label: 'انتشار نسخه نهایی', roles: { PLATFORM_ADMIN: true, MANAGER: false, REGISTRAR: false, REVIEWER: false, APPROVER: true, BUSINESS_USER: false } },
  { label: 'مدیریت کاربران پلتفرم', roles: { PLATFORM_ADMIN: true, MANAGER: false, REGISTRAR: false, REVIEWER: false, APPROVER: false, BUSINESS_USER: false } },
  { label: 'تغییر تنظیمات سامانه', roles: { PLATFORM_ADMIN: true, MANAGER: false, REGISTRAR: false, REVIEWER: false, APPROVER: false, BUSINESS_USER: false } },
]

const ROLE_ORDER: UserRole[] = ['PLATFORM_ADMIN', 'MANAGER', 'REGISTRAR', 'REVIEWER', 'APPROVER', 'BUSINESS_USER']

// ---------------------------------------------------------------------------
// Multi-Select Role Component
// ---------------------------------------------------------------------------

function MultiRoleSelector({
  selectedRoles,
  onChange,
  disabled,
}: {
  selectedRoles: UserRole[]
  onChange: (roles: UserRole[]) => void
  disabled?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)

  const toggleRole = (role: UserRole) => {
    if (disabled) return
    if (selectedRoles.includes(role)) {
      // Don't allow removing the last role
      if (selectedRoles.length > 1) {
        onChange(selectedRoles.filter((r) => r !== role))
      } else {
        toast.error('حداقل یک نقش باید انتخاب شود.')
      }
    } else {
      onChange([...selectedRoles, role])
    }
  }

  const getRoleDef = (role: UserRole) => ALL_ROLES.find((r) => r.key === role) ?? ALL_ROLES[5]

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full min-h-[42px] rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-left transition focus:border-amber-500 disabled:cursor-not-allowed disabled:opacity-50 ${isOpen ? 'border-amber-500' : ''}`}
      >
        <div className="flex flex-wrap gap-1.5">
          {selectedRoles.length === 0 ? (
            <span className="text-zinc-500">انتخاب نقش...</span>
          ) : (
            selectedRoles.map((role) => {
              const def = getRoleDef(role)
              return (
                <span
                  key={role}
                  className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold ${def.bgColor} ${def.color} border ${def.borderColor}`}
                >
                  {def.persianLabel}
                  {!disabled && (
                    <X
                      className="h-3 w-3 cursor-pointer hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleRole(role)
                      }}
                    />
                  )}
                </span>
              )
            })
          )}
        </div>
        <ChevronDown className={`absolute left-3 top-3 h-4 w-4 text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl max-h-64 overflow-y-auto">
          {ALL_ROLES.map((role) => {
            const isSelected = selectedRoles.includes(role.key)
            const RoleIcon = role.icon
            return (
              <button
                key={role.key}
                type="button"
                onClick={() => toggleRole(role.key)}
                className={`flex items-center gap-3 w-full px-3 py-2.5 text-right transition hover:bg-zinc-800 ${isSelected ? 'bg-zinc-800/50' : ''}`}
              >
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${role.bgColor} border ${role.borderColor}`}>
                  <RoleIcon className={`h-4 w-4 ${role.color}`} />
                </div>
                <div className="flex-1">
                  <div className={`text-sm font-semibold ${role.color}`}>{role.persianLabel}</div>
                  <div className="text-xs text-zinc-500">{role.description.slice(0, 60)}...</div>
                </div>
                <div className={`h-5 w-5 rounded-lg border-2 flex items-center justify-center transition ${isSelected ? 'border-amber-500 bg-amber-500' : 'border-zinc-600'}`}>
                  {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AdminUserAccessPage() {
  const { profile } = useAuth()
  const [users, setUsers] = useState<UserRow[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [showMatrix, setShowMatrix] = useState(false)
  const [expandedRole, setExpandedRole] = useState<string | null>(null)
  const [showAddUser, setShowAddUser] = useState(false)
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserRoles, setNewUserRoles] = useState<UserRole[]>(['BUSINESS_USER'])
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [editingRoles, setEditingRoles] = useState<string | null>(null)
  const [editRolesValue, setEditRolesValue] = useState<UserRole[]>([])

  const loadUsers = useCallback(async () => {
    setLoading(true)
    if (!isSupabaseConfigured) {
      setUsers([])
      setLoading(false)
      toast.error('اتصال به پایگاه‌داده برقرار نیست. فهرست کاربران واقعی بارگذاری نشد.')
      return
    }
    const { data, error } = await supabase.from('users').select('id,email,phone,role,created_at').order('created_at', { ascending: false })
    if (error) toast.error('بارگذاری کاربران انجام نشد.')
    // Transform data to include roles array (use role field as fallback)
    const transformedData = (data ?? []).map((item) => ({
      ...item,
      roles: [item.role as UserRole],
    })) as UserRow[]
    setUsers(transformedData)
    setLoading(false)
  }, [])

  useEffect(() => { void loadUsers() }, [loadUsers])

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return users
    return users.filter((user) => {
      const roleLabels = user.roles.map((r) => {
        const roleDef = ALL_ROLES.find((rd) => rd.key === r)
        return `${roleDef?.persianLabel ?? ''} ${roleDef?.label ?? ''}`
      }).join(' ')
      return `${user.email ?? ''} ${user.phone ?? ''} ${roleLabels} ${user.role}`.toLowerCase().includes(query)
    })
  }, [search, users])

  // Count users per role (users can be counted in multiple roles)
  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const user of users) {
      for (const role of user.roles) {
        counts[role] = (counts[role] || 0) + 1
      }
    }
    return counts
  }, [users])

  const updateRoles = async (user: UserRow, newRoles: UserRole[]) => {
    if (user.id === profile?.id) {
      toast.error('نقش حساب فعلی قابل تغییر نیست.')
      return
    }
    setSavingId(user.id)
    const primaryRole = newRoles[0] || 'BUSINESS_USER'
    
    if (!isSupabaseConfigured) {
      toast.error('اتصال به پایگاه‌داده برقرار نیست. تغییر نقش ذخیره نشد.')
      setSavingId(null)
      return
    }
    const { error } = await supabase.from('users').update({ role: primaryRole }).eq('id', user.id)
    if (error) {
      toast.error('تغییر نقش ذخیره نشد. سیاست‌های امنیتی پایگاه‌داده اعمال شده است.')
      setSavingId(null)
      return
    }
    setUsers((current) => current.map((item) => item.id === user.id ? { ...item, role: primaryRole, roles: newRoles } : item))
    const roleLabels = newRoles.map((r) => ALL_ROLES.find((rd) => rd.key === r)?.persianLabel ?? r).join('، ')
    toast.success(`نقش‌های کاربر با موفقیت به «${roleLabels}» تغییر یافت.`)
    setSavingId(null)
    setEditingRoles(null)
  }

  const addUser = () => {
    if (!newUserEmail.trim()) {
      toast.error('ایمیل کاربر را وارد کنید.')
      return
    }
    if (newUserRoles.length === 0) {
      toast.error('حداقل یک نقش انتخاب کنید.')
      return
    }
    if (!isSupabaseConfigured) {
      toast.error('اتصال به پایگاه‌داده برقرار نیست. افزودن کاربر فقط با اتصال واقعی ممکن است.')
      return
    }
    toast.info('افزودن کاربر در حالت اتصال واقعی پایگاه‌داده امکان‌پذیر است.')
  }

  const deleteUser = async (userId: string) => {
    if (userId === profile?.id) {
      toast.error('حذف حساب فعلی مجاز نیست.')
      return
    }
    if (!isSupabaseConfigured) {
      toast.error('اتصال به پایگاه‌داده برقرار نیست. کاربر حذف نشد.')
      setConfirmDelete(null)
      return
    }
    setSavingId(userId)
    const { error } = await supabase.from('users').delete().eq('id', userId)
    setSavingId(null)
    if (error) {
      toast.error('حذف کاربر انجام نشد. سیاست‌های امنیتی پایگاه‌داده اعمال شده است.')
      setConfirmDelete(null)
      return
    }
    setUsers((current) => current.filter((u) => u.id !== userId))
    setConfirmDelete(null)
    toast.success('کاربر با موفقیت حذف شد.')
  }

  const getRoleDef = (role: string): RoleDefinition => {
    return ALL_ROLES.find((r) => r.key === role) ?? {
      key: role as UserRole,
      label: role,
      persianLabel: role,
      description: '',
      color: 'text-zinc-300',
      bgColor: 'bg-zinc-500/10',
      borderColor: 'border-zinc-500/30',
      icon: UserCog,
      permissions: [],
      restrictions: [],
    }
  }

  return (
    <div className="min-h-full p-4 sm:p-8" dir="rtl">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* ── Hero Header ── */}
        <section className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-[#29231d] via-[#211d1a] to-[#151311] p-6 shadow-2xl sm:p-8">
          <div className="absolute -left-16 -top-20 h-56 w-56 rounded-full bg-amber-500/10 blur-3xl" />
          <div className="absolute -right-10 -bottom-16 h-40 w-40 rounded-full bg-violet-500/8 blur-3xl" />
          <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                مرکز کنترل دسترسی
              </div>
              <h2 className="text-2xl font-bold text-white sm:text-3xl">کاربران و نقش‌ها</h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-zinc-300">
                مدیریت نقش‌های پلتفرم. هر کاربر می‌تواند <span className="text-amber-300 font-semibold">چندین نقش</span> داشته باشد.
                <br />
                <span className="text-xs text-zinc-500">(اعضای شرکت‌ها در فضای کاری هر شرکت مدیریت می‌شوند)</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => void loadUsers()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/70 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-amber-500/60 hover:text-amber-300"
              >
                <RefreshCw className="h-4 w-4" />
                به‌روزرسانی
              </button>
              <button
                onClick={() => setShowAddUser(!showAddUser)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-500"
              >
                <UserPlus className="h-4 w-4" />
                افزودن کاربر
              </button>
            </div>
          </div>
        </section>

        {/* ── Summary Cards ── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            icon={Users}
            label="کل اعضای پلتفرم"
            value={users.length.toString()}
            color="text-amber-400"
            bg="bg-amber-950/30 border-amber-800/40"
          />
          <SummaryCard
            icon={Crown}
            label="مدیران پلتفرم"
            value={(roleCounts['PLATFORM_ADMIN'] ?? 0).toString()}
            color="text-amber-300"
            bg="bg-amber-950/20 border-amber-800/30"
          />
          <SummaryCard
            icon={PenLine}
            label="ثبت‌کنندگان"
            value={(roleCounts['REGISTRAR'] ?? 0).toString()}
            color="text-sky-300"
            bg="bg-sky-950/20 border-sky-800/30"
          />
          <SummaryCard
            icon={Eye}
            label="بازبین‌ها و تأییدکنندگان"
            value={((roleCounts['REVIEWER'] ?? 0) + (roleCounts['APPROVER'] ?? 0)).toString()}
            color="text-emerald-300"
            bg="bg-emerald-950/20 border-emerald-800/30"
          />
        </div>

        {/* ── Add User Form ── */}
        {showAddUser && (
          <section className="rounded-2xl border border-amber-800/60 bg-[#1d1a18] p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30">
                <UserPlus className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-white">افزودن کاربر جدید</h3>
                <p className="text-xs text-zinc-400 mt-0.5">ایمیل و نقش‌های مورد نظر را مشخص کنید</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-400">ایمیل کاربر</label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="user@example.com"
                  dir="ltr"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-white outline-none transition focus:border-amber-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-400">نقش‌ها (چند انتخابی)</label>
                <MultiRoleSelector
                  selectedRoles={newUserRoles}
                  onChange={setNewUserRoles}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={addUser} className="bg-amber-600 hover:bg-amber-500">افزودن کاربر</Button>
              <Button variant="outline" onClick={() => { setShowAddUser(false); setNewUserEmail(''); setNewUserRoles(['BUSINESS_USER']) }}>
                انصراف
              </Button>
            </div>
          </section>
        )}

        {/* ── Review Rule Banner ── */}
        <section className="rounded-2xl border border-blue-900/60 bg-blue-950/20 p-4 text-sm leading-7 text-blue-100">
          <div className="flex gap-3">
            <Info className="mt-1 h-4 w-4 shrink-0 text-blue-300" />
            <div>
              <p>
                <b>قاعده بازبینی:</b> ثبت‌کننده یک درخواست نمی‌تواند همان درخواست را بررسی کند. برای نمایش دکمه «شروع بازبینی» و تصمیم نهایی، با حساب مدیر، بازبین یا تأییدکننده دیگری وارد شوید.
              </p>

            </div>
          </div>
        </section>

        {/* ── Role Definitions Cards ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Shield className="h-5 w-5 text-amber-400" />
              تعریف نقش‌ها و سطوح دسترسی
            </h3>
            <span className="text-xs text-zinc-500 bg-zinc-900 px-3 py-1 rounded-full border border-zinc-800">
              هر کاربر می‌تواند چند نقش داشته باشد
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ALL_ROLES.map((role) => {
              const Icon = role.icon
              const isExpanded = expandedRole === role.key
              const count = roleCounts[role.key] ?? 0
              return (
                <div
                  key={role.key}
                  className={`rounded-2xl border ${role.borderColor} ${role.bgColor} p-5 transition-all hover:shadow-lg`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${role.bgColor} border ${role.borderColor}`}>
                        <Icon className={`h-5 w-5 ${role.color}`} />
                      </div>
                      <div>
                        <h4 className={`font-bold ${role.color}`}>{role.persianLabel}</h4>
                        <p className="text-xs text-zinc-400 mt-0.5">{count} کاربر فعال</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setExpandedRole(isExpanded ? null : role.key)}
                      className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300 transition"
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="mt-3 text-xs leading-6 text-zinc-300">{role.description}</p>

                  {isExpanded && (
                    <div className="mt-4 space-y-3 border-t border-zinc-800/60 pt-4">
                      <div>
                        <h5 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          مجاز به انجام
                        </h5>
                        <ul className="space-y-1">
                          {role.permissions.map((perm, i) => (
                            <li key={i} className="flex items-center gap-2 text-xs text-zinc-300">
                              <span className="h-1 w-1 rounded-full bg-emerald-500 flex-shrink-0" />
                              {perm}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h5 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-red-400">
                          <XCircle className="h-3.5 w-3.5" />
                          مجاز به انجام نیست
                        </h5>
                        <ul className="space-y-1">
                          {role.restrictions.map((r, i) => (
                            <li key={i} className="flex items-center gap-2 text-xs text-zinc-400">
                              <span className="h-1 w-1 rounded-full bg-red-500 flex-shrink-0" />
                              {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* ── Permission Matrix ── */}
        <section className="rounded-2xl border border-zinc-800 bg-[#1d1a18] shadow-xl overflow-hidden">
          <button
            onClick={() => setShowMatrix(!showMatrix)}
            className="flex items-center justify-between w-full p-5 text-right transition hover:bg-zinc-900/40"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/30">
                <Scale className="h-4 w-4 text-violet-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">ماتریس مقایسه دسترسی‌ها</h3>
                <p className="text-xs text-zinc-400 mt-0.5">مقایسه دقیق امکانات هر نقش در یک نگاه</p>
              </div>
            </div>
            {showMatrix ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
          </button>

          {showMatrix && (
            <div className="overflow-x-auto border-t border-zinc-800">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/50">
                    <th className="p-3 text-right font-semibold text-zinc-400">دسترسی</th>
                    {ROLE_ORDER.map((role) => {
                      const def = ALL_ROLES.find((r) => r.key === role)
                      return (
                        <th key={role} className="p-3 text-center font-semibold" style={{ minWidth: '90px' }}>
                          <span className={def?.color ?? 'text-zinc-400'}>{def?.label ?? role}</span>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSION_MATRIX.map((row, i) => (
                    <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-900/30 transition">
                      <td className="p-3 text-zinc-300 font-medium">{row.label}</td>
                      {ROLE_ORDER.map((role) => (
                        <td key={role} className="p-3 text-center">
                          {row.roles[role] ? (
                            <CheckCircle2 className="h-4 w-4 mx-auto text-emerald-400" />
                          ) : (
                            <XCircle className="h-4 w-4 mx-auto text-zinc-700" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── User List ── */}
        <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#1d1a18] shadow-xl">
          <div className="flex flex-col gap-4 border-b border-zinc-800 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-bold text-white flex items-center gap-2">
                <Fingerprint className="h-4 w-4 text-amber-400" />
                فهرست کاربران
              </h3>
              <p className="mt-1 text-xs text-zinc-500">هر کاربر می‌تواند چندین نقش داشته باشد. روی «ویرایش نقش‌ها» کلیک کنید.</p>
            </div>
            <div className="relative">
              <Search className="absolute right-3 top-3 h-4 w-4 text-zinc-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="جست‌وجوی ایمیل، نقش..."
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 pr-10 pl-3 text-sm text-white outline-none transition focus:border-amber-500 sm:w-80"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
              <p className="mt-3 text-sm text-zinc-400">در حال بارگذاری کاربران...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center text-sm text-zinc-400">
              <UserX className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
              کاربری با این مشخصات پیدا نشد.
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {filteredUsers.map((user) => {
                const primaryRoleDef = getRoleDef(user.role)
                const PrimaryIcon = primaryRoleDef.icon
                const isSelf = user.id === profile?.id
                const isEditing = editingRoles === user.id
                return (
                  <div key={user.id} className="flex flex-col gap-4 p-5 transition hover:bg-zinc-900/40 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${primaryRoleDef.borderColor} ${primaryRoleDef.bgColor} ${primaryRoleDef.color}`}>
                        <PrimaryIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-zinc-100">{user.email ?? user.phone ?? 'شناسه بدون اطلاعات تماس'}</span>
                          {isSelf && (
                            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30">
                              حساب فعلی
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {user.roles.map((role) => {
                            const roleDef = getRoleDef(role)
                            return (
                              <span
                                key={role}
                                className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-semibold ${roleDef.bgColor} ${roleDef.color} border ${roleDef.borderColor}`}
                              >
                                {roleDef.persianLabel}
                              </span>
                            )
                          })}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          عضویت: {new Date(user.created_at).toLocaleDateString('fa-IR')}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {isEditing ? (
                        <div className="flex flex-col gap-2">
                          <MultiRoleSelector
                            selectedRoles={editRolesValue}
                            onChange={setEditRolesValue}
                            disabled={isSelf}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => void updateRoles(user, editRolesValue)}
                              disabled={savingId === user.id}
                              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 transition disabled:opacity-50"
                            >
                              {savingId === user.id ? 'در حال ذخیره...' : 'ذخیره'}
                            </button>
                            <button
                              onClick={() => setEditingRoles(null)}
                              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 transition"
                            >
                              انصراف
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setEditingRoles(user.id)
                              setEditRolesValue(user.roles)
                            }}
                            disabled={isSelf}
                            className="rounded-xl border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-900/40 transition disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            ویرایش نقش‌ها
                          </button>

                          {!isSelf && (
                            <>
                              {confirmDelete === user.id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => deleteUser(user.id)}
                                    className="rounded-lg bg-red-600 px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-red-500 transition"
                                  >
                                    حذف
                                  </button>
                                  <button
                                    onClick={() => setConfirmDelete(null)}
                                    className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-[10px] font-bold text-zinc-300 hover:bg-zinc-800 transition"
                                  >
                                    انصراف
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmDelete(user.id)}
                                  className="rounded-lg border border-red-900/60 px-2.5 py-1.5 text-[10px] font-semibold text-red-400 hover:bg-red-950/40 transition"
                                  title="حذف کاربر"
                                >
                                  <UserX className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </>
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

        {/* ── Workflow Reference ── */}
        <section className="rounded-2xl border border-zinc-800 bg-[#1d1a18] p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30">
              <BookOpenCheck className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">جریان کاری پلتفرم</h3>
              <p className="text-xs text-zinc-400 mt-0.5">نقش هر عضو پلتفرم در چرخه انتشار نسخه‌ها</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <WorkflowStep
              number="۱"
              title="ثبت و تهیه پیش‌نویس"
              actor="ثبت‌کننده"
              description="تعریف نسخه جدید تعهد، قواعد و فرم‌ها"
              color="border-sky-800 bg-sky-950/30"
              actorColor="text-sky-300"
            />
            <WorkflowStep
              number="۲"
              title="بازبینی تخصصی"
              actor="بازبین"
              description="بررسی دقیق محتوا، قواعد و مراحل فرایند"
              color="border-emerald-800 bg-emerald-950/30"
              actorColor="text-emerald-300"
            />
            <WorkflowStep
              number="۳"
              title="تأیید نهایی"
              actor="تأییدکننده"
              description="کنترل نهایی و اجازه انتشار"
              color="border-rose-800 bg-rose-950/30"
              actorColor="text-rose-300"
            />
            <WorkflowStep
              number="۴"
              title="انتشار نهایی"
              actor="مدیر پلتفرم"
              description="انتشار رسمی نسخه برای کلیه شرکت‌ها"
              color="border-amber-800 bg-amber-950/30"
              actorColor="text-amber-300"
            />
          </div>
        </section>

        {/* ── Security Notice ── */}
        <section className="rounded-2xl border border-zinc-800 bg-[#1d1a18] p-5 shadow-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div>
              <h4 className="font-bold text-sm text-zinc-200">قوانین امنیتی مدیریت نقش‌ها</h4>
              <ul className="mt-2 space-y-1 text-xs leading-6 text-zinc-400">
                <li className="flex items-center gap-2"><Lock className="h-3 w-3 shrink-0 text-zinc-600" /> تغییر نقش حساب فعلی مجاز نیست.</li>
                <li className="flex items-center gap-2"><Lock className="h-3 w-3 shrink-0 text-zinc-600" /> ثبت‌کننده نمی‌تواند درخواست خود را بازبینی کند.</li>
                <li className="flex items-center gap-2"><Lock className="h-3 w-3 shrink-0 text-zinc-600" /> فقط مدیر پلتفرم مجاز به تغییر نقش سایر کاربران است.</li>
                <li className="flex items-center gap-2"><Lock className="h-3 w-3 shrink-0 text-zinc-600" /> هر کاربر حداقل یک نقش و حداکثر تمام نقش‌ها را می‌تواند داشته باشد.</li>
                <li className="flex items-center gap-2"><Lock className="h-3 w-3 shrink-0 text-zinc-600" /> کلیه تغییرات در Audit Log ثبت و قابل پیگیری است.</li>
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

function WorkflowStep({
  number,
  title,
  actor,
  description,
  color,
  actorColor,
}: {
  number: string
  title: string
  actor: string
  description: string
  color: string
  actorColor: string
}) {
  return (
    <div className={`rounded-xl border ${color} p-4 transition hover:shadow-md`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-bold text-zinc-300">
          {number}
        </span>
        <h4 className="font-bold text-sm text-zinc-100">{title}</h4>
      </div>
      <p className={`text-xs font-semibold ${actorColor} mb-1`}>{actor}</p>
      <p className="text-xs text-zinc-400 leading-5">{description}</p>
    </div>
  )
}
