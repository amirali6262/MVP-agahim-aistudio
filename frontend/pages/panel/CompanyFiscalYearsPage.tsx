import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowRight, Calendar, CalendarPlus, CheckCircle2, Edit2, Info, Loader2, Lock, Plus, RefreshCw, Trash2, TriangleAlert } from 'lucide-react'
import { Button } from '../../lib/shadcn/button'
import { Input } from '../../lib/shadcn/input'
import { Label } from '../../lib/shadcn/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../lib/shadcn/select'
import { useTenant } from '../../context/TenantContext'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import JalaliDatePicker from '../../components/JalaliDatePicker'
import DeleteGuardModal from '../../components/DeleteGuardModal'
import {
  fetchFiscalYears,
  createFiscalYear,
  updateFiscalYear,
  deleteFiscalYear,
  describeFiscalYearState,
  jalaaliToday,
  type TenantFiscalYear,
  type FiscalYearStatus,
} from '../../lib/supabaseDb'

const BRAND = '#5B4DE6'
const BRAND_SOFT = '#EEECFC'

type FyStatusKey = FiscalYearStatus

const STATE_STYLE: Record<FyStatusKey, { label: string; cls: string }> = {
  CURRENT: { label: 'جاری', cls: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300' },
  UPCOMING: { label: 'آینده', cls: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/20 dark:text-blue-300' },
  ENDED: { label: 'پایان‌یافته', cls: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/20 dark:text-amber-300' },
  CLOSED: { label: 'بسته‌شده', cls: 'border-zinc-300 bg-zinc-100 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400' },
  DRAFT: { label: 'پیش‌نویس', cls: 'border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400' },
}

interface FyWithUsage extends TenantFiscalYear {
  usageCount: number
}

export default function CompanyFiscalYearsPage() {
  const { selectedTenant } = useTenant()
  const tenantId = selectedTenant?.id ?? ''
  const tenantName = selectedTenant?.name ?? ''

  const [rows, setRows] = useState<FyWithUsage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TenantFiscalYear | null>(null)
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState(jalaaliToday() || '1404/01/01')
  const [endDate, setEndDate] = useState('')
  const [status, setStatus] = useState<TenantFiscalYear['status']>('ACTIVE')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<FyWithUsage | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const list = await fetchFiscalYears(tenantId)
      let usageCounts: Record<string, number> = {}
      if (isSupabaseConfigured && tenantId) {
        const { data, error } = await (supabase as any)
          .from('compliance_cases')
          .select('fiscal_year_id')
          .eq('tenant_id', tenantId)
          .not('fiscal_year_id', 'is', null)
        if (!error) {
          usageCounts = (data ?? []).reduce((acc: Record<string, number>, row: any) => {
            acc[row.fiscal_year_id] = (acc[row.fiscal_year_id] ?? 0) + 1
            return acc
          }, {})
        }
      }
      setRows(list.map((fy) => ({ ...fy, usageCount: usageCounts[fy.id] ?? 0 })))
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'دریافت سال‌های مالی ناموفق بود.')
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { void load() }, [load])

  const openAdd = () => {
    setEditing(null)
    setTitle('')
    setStartDate(jalaaliToday() || '1404/01/01')
    setEndDate('')
    setStatus('ACTIVE')
    setNotes('')
    setModalOpen(true)
  }

  const openEdit = (fy: TenantFiscalYear) => {
    setEditing(fy)
    setTitle(fy.title)
    setStartDate(fy.start_date)
    setEndDate(fy.end_date)
    setStatus(fy.status)
    setNotes((fy as any).notes ?? '')
    setModalOpen(true)
  }

  const openNextPeriod = (from: TenantFiscalYear) => {
    setEditing(null)
    const nextStart = addJalaliDays(from.end_date, 1)
    const nextEnd = addJalaliDays(nextStart, 365)
    setTitle(`سال مالی منتهی به ${nextEnd}`)
    setStartDate(nextStart)
    setEndDate(nextEnd)
    setStatus('ACTIVE')
    setNotes('')
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { toast.error('عنوان سال مالی الزامی است.', { position: 'top-center' }); return }
    if (!startDate || !endDate) { toast.error('تاریخ شروع و پایان الزامی است.', { position: 'top-center' }); return }
    if (endDate < startDate) { toast.error('تاریخ پایان باید بعد از تاریخ شروع باشد.', { position: 'top-center' }); return }

    setSaving(true)
    if (editing) {
      const result = await updateFiscalYear(editing.id, { title: title.trim(), start_date: startDate, end_date: endDate, status })
      setSaving(false)
      if (!result) { toast.error('به‌روزرسانی ناموفق بود (احتمالاً هم‌پوشانی یا دوره‌ی استفاده‌شده). تطبیق قواعد را بررسی کنید.', { position: 'top-center' }); return }
      toast.success('سال مالی به‌روزرسانی شد.', { position: 'top-center' })
    } else {
      const payload = {
        tenant_id: tenantId,
        title: title.trim(),
        start_date: startDate,
        end_date: endDate,
        status,
      }
      const result = await createFiscalYear(payload)
      setSaving(false)
      if (!result) { toast.error('ثبت ناموفق بود — تاریخ‌ها را بررسی کنید (ممکن است با دوره‌ای دیگر هم‌پوشانی داشته باشد).', { position: 'top-center' }); return }
      toast.success('سال مالی ثبت شد.', { position: 'top-center' })
    }
    setModalOpen(false)
    void load()
  }

  const requestDelete = (fy: FyWithUsage) => {
    if (fy.usageCount > 0) {
      toast.error('این دوره در تعهداتی استفاده شده و قابل حذف نیست؛ فقط می‌تواند بسته شود.', { position: 'top-center' })
      return
    }
    setDeleteTarget(fy)
    setDeleteModalOpen(true)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const ok = await deleteFiscalYear(deleteTarget.id)
    setDeleting(false)
    if (!ok) { toast.error('حذف ناموفق بود — احتمالاً این دوره در تعهدات استفاده شده است.', { position: 'top-center' }); return }
    toast.success(`سال مالی "${deleteTarget.title}" حذف شد.`, { position: 'top-center' })
    setDeleteModalOpen(false)
    setDeleteTarget(null)
    void load()
  }

  const closePeriod = async (fy: FyWithUsage) => {
    if (fy.status === 'CLOSED') return
    const result = await updateFiscalYear(fy.id, { status: 'CLOSED' })
    if (!result) { toast.error('بستن دوره ناموفق بود.', { position: 'top-center' }); return }
    toast.success(`دوره "${fy.title}" بسته شد.`, { position: 'top-center' })
    void load()
  }

  const canChangeDates = useMemo(() => {
    // Client hint only; the server enforces the real guard.
    return rows.filter((r) => r.usageCount > 0).map((r) => r.id)
  }, [rows])

  return (
    <div dir="rtl" className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white px-5 py-5 shadow-sm dark:border-zinc-800 dark:bg-[#161618] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white" style={{ background: BRAND }}>
            <Calendar className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-base font-extrabold text-zinc-900 dark:text-zinc-50">تعریف سال مالی شرکت</h1>
            <p className="mt-1 max-w-2xl text-[11px] leading-6 text-zinc-500 dark:text-zinc-400">
              بازه‌های مالی سالانه یا انتقالی شرکت تعریف و مدیریت می‌شود. این دوره‌ها در تمام فرم‌های تعهد به‌صورت خودکار نمایش داده می‌شوند.
            </p>
            <p className="mt-1 text-[11px] font-bold" style={{ color: BRAND }}>{tenantName}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} className="gap-1.5 border-zinc-300 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
            <RefreshCw className="h-3.5 w-3.5" />
            به‌روزرسانی
          </Button>
          <Button size="sm" onClick={openAdd} className="gap-1.5 text-xs font-bold text-white" style={{ background: BRAND }}>
            <Plus className="h-3.5 w-3.5" />
            افزودن سال مالی
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-white py-16 text-xs text-zinc-400 dark:border-zinc-800 dark:bg-[#161618]">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: BRAND }} />
          در حال بارگذاری سال‌های مالی...
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900/60 dark:bg-red-950/30">
          <TriangleAlert className="h-7 w-7 text-red-500" />
          <p className="text-sm font-bold text-red-700 dark:text-red-300">دریافت داده‌ها ناموفق بود</p>
          <p className="max-w-md text-xs leading-6 text-red-600/90 dark:text-red-300/80">{loadError}</p>
          <Button size="sm" onClick={() => void load()} className="gap-2 text-xs text-white" style={{ background: BRAND }}>تلاش دوباره</Button>
        </div>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#161618]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-right">
              <thead>
                <tr className="border-b border-zinc-100 text-[11px] text-zinc-400 dark:border-zinc-800">
                  <th className="px-5 py-3.5 font-bold">عنوان سال مالی</th>
                  <th className="px-3 py-3.5 font-bold">تاریخ شروع</th>
                  <th className="px-3 py-3.5 font-bold">تاریخ پایان</th>
                  <th className="px-3 py-3.5 font-bold">وضعیت</th>
                  <th className="px-3 py-3.5 font-bold">تعهدات متصل</th>
                  <th className="px-5 py-3.5 font-bold">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-14 text-center">
                      <div className="flex flex-col items-center gap-2 text-zinc-400">
                        <CalendarPlus className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
                        <p className="text-xs">هنوز سال مالی ثبت نشده است. با «افزودن سال مالی» شروع کنید.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((fy) => {
                    const state = describeFiscalYearState(fy)
                    const used = fy.usageCount > 0
                    const style = STATE_STYLE[state.key]
                    const isDateLocked = used && (editing?.id === fy.id)
                    return (
                      <tr key={fy.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/60 dark:border-zinc-800 dark:hover:bg-zinc-800/20">
                        <td className="px-5 py-3.5">
                          <p className="text-xs font-bold text-zinc-800 dark:text-zinc-100">{fy.title}</p>
                          {used && <span className="mt-1 inline-flex items-center gap-1 text-[9px] font-bold text-zinc-400"><Lock className="h-2.5 w-2.5" />استفاده‌شده در تعهدات</span>}
                        </td>
                        <td className="px-3 py-3.5 font-mono text-[11px] text-zinc-600 dark:text-zinc-300" dir="ltr">{fy.start_date}</td>
                        <td className="px-3 py-3.5 font-mono text-[11px] text-zinc-600 dark:text-zinc-300" dir="ltr">{fy.end_date}</td>
                        <td className="px-3 py-3.5">
                          <span className={`inline-block rounded-full border px-2.5 py-1 text-[10px] font-bold ${style.cls}`}>{style.label}</span>
                        </td>
                        <td className="px-3 py-3.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">{fy.usageCount.toLocaleString('fa-IR')}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(fy)} className="h-8 w-8 p-0 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800" title="ویرایش">
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            {fy.status !== 'CLOSED' && (
                              <Button variant="ghost" size="sm" onClick={() => void closePeriod(fy)} disabled={isDateLocked && false} className="h-8 w-8 p-0 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30" title="بستن دوره">
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => requestDelete(fy)} disabled={used} className="h-8 w-8 p-0 text-zinc-500 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-red-950/30" title={used ? 'این دوره در تعهدات استفاده شده و قابل حذف نیست' : 'حذف'}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openNextPeriod(fy)} className="h-8 w-8 p-0 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800" title="ایجاد دوره بعد">
                              <CalendarPlus className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Add / Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 sm:items-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModalOpen(false)} />
          <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-[#1d1d20]">
            <div className="flex items-start justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
              <div>
                <h2 className="text-sm font-extrabold text-zinc-900 dark:text-zinc-50">{editing ? 'ویرایش سال مالی' : 'افزودن سال مالی'}</h2>
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{editing ? 'ویرایش اطلاعات دوره مالی.' : 'پیشنهاد عنوان بر اساس تاریخ پایان به‌صورت خودکار تنظیم می‌شود.'}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)} className="h-8 w-8 p-0 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"><ArrowRight className="h-4 w-4" /></Button>
            </div>
            <form onSubmit={(e) => void handleSave(e)} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-700 dark:text-zinc-200">عنوان سال مالی <span className="text-red-500">*</span></Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً سال مالی منتهی به ۱۴۰۵/۰۶/۳۱"
                  className="h-10 border-zinc-200 bg-white text-xs dark:border-zinc-700 dark:bg-[#161618]" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <JalaliDatePicker label="تاریخ شروع" value={startDate} onChange={setStartDate} />
                <JalaliDatePicker label="تاریخ پایان" value={endDate} onChange={setEndDate} />
              </div>
              {editing && editing.status !== 'CLOSED' && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-zinc-700 dark:text-zinc-200">وضعیت</Label>
                    <Select value={status} onValueChange={(v) => setStatus(v as TenantFiscalYear['status'])}>
                      <SelectTrigger className="h-10 border-zinc-200 bg-white text-xs dark:border-zinc-700 dark:bg-[#161618]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE" className="text-xs">باز (جاری/pre فعال)</SelectItem>
                        <SelectItem value="CLOSED" className="text-xs">بسته‌شده</SelectItem>
                        <SelectItem value="DRAFT" className="text-xs">پیش‌نویس</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-zinc-700 dark:text-zinc-200">توضیحات (اختیاری)</Label>
                    <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="یادداشت درباره این دوره"
                      className="h-10 border-zinc-200 bg-white text-xs dark:border-zinc-700 dark:bg-[#161618]" />
                  </div>
                </>
              )}
              {canChangeDates.includes(editing?.id ?? '') && (
                <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-[11px] leading-5 text-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  این دوره در تعهداتی استفاده شده؛ طبق قوانین فقط امکان بستن یا ثبت توضیحات دارد و تغییر عنوان/تاریخ توسط سرور مسدود می‌شود.
                </p>
              )}
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setModalOpen(false)} className="gap-1.5 border-zinc-300 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">انصراف</Button>
                <Button type="submit" size="sm" disabled={saving} className="gap-1.5 text-xs font-bold text-white" style={{ background: BRAND }}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  {editing ? 'ذخیره تغییرات' : 'ثبت سال مالی'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteModalOpen && deleteTarget && (
        <DeleteGuardModal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          onConfirm={() => void confirmDelete()}
          title={`حذف سال مالی ${deleteTarget.title}`}
          description={`آیا از حذف سال مالی "${deleteTarget.title}" اطمینان دارید؟ این عمل بازگشت‌پذیر نیست.`}
        />
      )}
    </div>
  )
}

// ── Best-effort Jalali date arithmetic (used only for period suggestions) ──
const JALAALI_MONTH_LENGTHS = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29]

function addJalaliDays(dateStr: string, days: number): string {
  const m = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(dateStr)
  if (!m) return dateStr
  let year = Number(m[1]); let month = Number(m[2]); let day = Number(m[3])
  while (days !== 0) {
    const maxDay = JALAALI_MONTH_LENGTHS[month - 1] + (month === 12 && isLeapJalali(year) ? 1 : 0)
    if (days > 0) {
      const step = Math.min(days, maxDay - day)
      day += step; days -= step
      if (day > maxDay) { day = 1; month += 1 }
      if (month > 12) { month = 1; year += 1 }
    } else {
      if (day > 1) { day += days; days = 0 }
      else {
        month -= 1
        if (month < 1) { month = 12; year -= 1 }
        const prevMax = JALAALI_MONTH_LENGTHS[month - 1] + (month === 12 && isLeapJalali(year) ? 1 : 0)
        day = prevMax; days += 1
      }
    }
  }
  return `${pad4(year)}/${pad(month)}/${pad(day)}`
}

function isLeapJalali(year: number): boolean {
  return ((year - 473) % 4 === 3)
}

function pad(n: number) { return n < 10 ? '0' + n : String(n) }
function pad4(n: number) { return n < 1000 ? '0' + String(n) : String(n) }