import { useCallback, useEffect, useState } from 'react'
import { Building2, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { Tables } from '../lib/database.types'
import { Button } from '../lib/shadcn/button'
import { Input } from '../lib/shadcn/input'
import { Label } from '../lib/shadcn/label'
import { Switch } from '../lib/shadcn/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../lib/shadcn/select'

type Profile = Tables<'tenant_profile_versions'>
type RegistrationStatus = 'UNKNOWN' | 'NOT_REGISTERED' | 'PENDING' | 'REGISTERED'
type VatStatus = RegistrationStatus | 'NOT_REQUIRED'

interface Props {
  tenantId: string
  tenantName: string
}

const today = () => new Date().toISOString().slice(0, 10)

export default function CompanyBusinessProfile({ tenantId, tenantName }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [legalForm, setLegalForm] = useState('')
  const [primaryActivity, setPrimaryActivity] = useState('')
  const [activityCodes, setActivityCodes] = useState('')
  const [taxStatus, setTaxStatus] = useState<RegistrationStatus>('UNKNOWN')
  const [vatStatus, setVatStatus] = useState<VatStatus>('UNKNOWN')
  const [employeeCount, setEmployeeCount] = useState('0')
  const [annualRevenue, setAnnualRevenue] = useState('')
  const [branchCount, setBranchCount] = useState('0')
  const [hasContracts, setHasContracts] = useState(false)
  const [paysSalaries, setPaysSalaries] = useState(false)

  const populate = (row: Profile | null) => {
    setProfile(row)
    setLegalForm(row?.legal_form ?? '')
    setPrimaryActivity(row?.primary_activity ?? '')
    setActivityCodes(row?.activity_codes.join(', ') ?? '')
    setTaxStatus((row?.tax_registration_status as RegistrationStatus | undefined) ?? 'UNKNOWN')
    setVatStatus((row?.vat_registration_status as VatStatus | undefined) ?? 'UNKNOWN')
    setEmployeeCount(String(row?.employee_count ?? 0))
    setAnnualRevenue(row?.annual_revenue == null ? '' : String(row.annual_revenue))
    setBranchCount(String(row?.branch_count ?? 0))
    setHasContracts(row?.has_active_contracts ?? false)
    setPaysSalaries(row?.pays_salaries ?? false)
  }

  const loadProfile = useCallback(async () => {
    setLoading(true)
    if (!isSupabaseConfigured) {
      populate(null)
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('tenant_profile_versions')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('valid_to', null)
      .maybeSingle()

    if (error) toast.error(`دریافت پروفایل ناموفق بود: ${error.message}`)
    populate(data ?? null)
    setLoading(false)
  }, [tenantId])

  useEffect(() => {
    void loadProfile()
  }, [loadProfile])

  const save = async () => {
    if (!isSupabaseConfigured) {
      toast.error('اتصال Supabase برای ذخیره پروفایل لازم است.')
      return
    }

    const employees = Number(employeeCount)
    const branches = Number(branchCount)
    const revenue = annualRevenue.trim() ? Number(annualRevenue) : undefined
    if (!Number.isInteger(employees) || employees < 0 || !Number.isInteger(branches) || branches < 0) {
      toast.error('تعداد کارکنان و شعب باید عدد صحیح و غیرمنفی باشد.')
      return
    }
    if (revenue !== undefined && (!Number.isSafeInteger(revenue) || revenue < 0)) {
      toast.error('فروش سالانه باید عدد صحیح، غیرمنفی و در محدوده امن باشد.')
      return
    }

    setSaving(true)
    const { data, error } = await supabase.rpc('save_tenant_profile', {
      p_tenant_id: tenantId,
      // A later-day edit creates a new effective-dated version; edits made on
      // the same day update that day's version atomically.
      p_valid_from: today(),
      p_legal_form: legalForm.trim() || undefined,
      p_primary_activity: primaryActivity.trim() || undefined,
      p_activity_codes: activityCodes.split(',').map((item) => item.trim()).filter(Boolean),
      p_tax_registration_status: taxStatus,
      p_vat_registration_status: vatStatus,
      p_employee_count: employees,
      p_annual_revenue: revenue,
      p_branch_count: branches,
      p_has_active_contracts: hasContracts,
      p_contract_types: [],
      p_pays_salaries: paysSalaries,
      p_custom_attributes: {},
    })
    setSaving(false)

    if (error) {
      toast.error(`ذخیره پروفایل ناموفق بود: ${error.message}`)
      return
    }
    populate(data)
    toast.success('پروفایل کسب‌وکار ذخیره شد.')
  }

  if (loading) {
    return <div className="flex justify-center py-20 text-zinc-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-[#141615] p-6 text-zinc-100" dir="rtl">
      <div className="mb-6 flex items-start justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold"><Building2 className="h-5 w-5 text-amber-400" />پروفایل کسب‌وکار</h2>
          <p className="mt-1 text-sm text-zinc-400">اطلاعات {tenantName} برای تشخیص تعهدات مالیاتی و بیمه‌ای</p>
        </div>
        <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">{profile ? `معتبر از ${profile.valid_from}` : 'تکمیل‌نشده'}</span>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field label="نوع ثبتی / قالب حقوقی"><Input value={legalForm} onChange={(e) => setLegalForm(e.target.value)} placeholder="مثلاً سهامی خاص" /></Field>
        <Field label="فعالیت اصلی"><Input value={primaryActivity} onChange={(e) => setPrimaryActivity(e.target.value)} placeholder="مثلاً خدمات فناوری اطلاعات" /></Field>
        <Field label="کدهای فعالیت (با ویرگول جدا کنید)"><Input value={activityCodes} onChange={(e) => setActivityCodes(e.target.value)} placeholder="620100, 620200" dir="ltr" /></Field>
        <Field label="فروش سالانه (ریال)"><Input value={annualRevenue} onChange={(e) => setAnnualRevenue(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" dir="ltr" /></Field>
        <Field label="وضعیت ثبت مالیاتی"><StatusSelect value={taxStatus} onChange={(v) => setTaxStatus(v as RegistrationStatus)} includeNotRequired={false} /></Field>
        <Field label="وضعیت ارزش افزوده"><StatusSelect value={vatStatus} onChange={(v) => setVatStatus(v as VatStatus)} includeNotRequired /></Field>
        <Field label="تعداد کارکنان"><Input value={employeeCount} onChange={(e) => setEmployeeCount(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" dir="ltr" /></Field>
        <Field label="تعداد شعب"><Input value={branchCount} onChange={(e) => setBranchCount(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" dir="ltr" /></Field>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <Toggle label="قرارداد فعال دارد" checked={hasContracts} onChange={setHasContracts} />
        <Toggle label="به کارکنان حقوق پرداخت می‌کند" checked={paysSalaries} onChange={setPaysSalaries} />
      </div>

      <div className="mt-7 flex justify-end">
        <Button onClick={save} disabled={saving} className="gap-2 bg-amber-500 text-zinc-950 hover:bg-amber-400">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          ذخیره پروفایل
        </Button>
      </div>
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"><Label>{label}</Label><Switch checked={checked} onCheckedChange={onChange} /></div>
}

function StatusSelect({ value, onChange, includeNotRequired }: { value: string; onChange: (value: string) => void; includeNotRequired: boolean }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="UNKNOWN">نامشخص</SelectItem>
        <SelectItem value="NOT_REGISTERED">ثبت‌نام‌نشده</SelectItem>
        <SelectItem value="PENDING">در حال ثبت‌نام</SelectItem>
        <SelectItem value="REGISTERED">ثبت‌نام‌شده</SelectItem>
        {includeNotRequired && <SelectItem value="NOT_REQUIRED">غیرمشمول</SelectItem>}
      </SelectContent>
    </Select>
  )
}
