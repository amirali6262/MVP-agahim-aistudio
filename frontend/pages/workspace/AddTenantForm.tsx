import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { ArrowRight, Building2, Save } from 'lucide-react'
import { Button } from '../../lib/shadcn/button'
import { Input } from '../../lib/shadcn/input'
import { Label } from '../../lib/shadcn/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../lib/shadcn/select'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { mockTenantsDb } from '../../lib/mockDb'
import { useAuth } from '../../context/AuthContext'

const PROVINCES = [
  'آذربایجان شرقی', 'آذربایجان غربی', 'اردبیل', 'اصفهان', 'البرز',
  'ایلام', 'بوشهر', 'تهران', 'چهارمحال و بختیاری', 'خراسان جنوبی',
  'خراسان رضوی', 'خراسان شمالی', 'خوزستان', 'زنجان', 'سمنان',
  'سیستان و بلوچستان', 'فارس', 'قزوین', 'قم', 'کردستان',
  'کرمان', 'کرمانشاه', 'کهگیلویه و بویراحمد', 'گلستان', 'گیلان',
  'لرستان', 'مازندران', 'مرکزی', 'هرمزگان', 'همدان', 'یزد',
]

interface Props {
  onBack: () => void
  onSuccess: () => void
}

export default function AddTenantForm({ onBack, onSuccess }: Props) {
  const { session } = useAuth()

  const [name, setName] = useState('')
  const [entityType, setEntityType] = useState<'حقوقی' | 'حقیقی' | ''>('')
  const [nationalId, setNationalId] = useState('')
  const [economicCode, setEconomicCode] = useState('')
  const [province, setProvince] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error('نام شرکت الزامی است.')
      return
    }
    if (!entityType) {
      toast.error('لطفاً نوع شخصیت حقوقی را انتخاب کنید.')
      return
    }
    if (!session?.user?.id) {
      toast.error('خطا در احراز هویت. لطفاً دوباره وارد شوید.')
      return
    }

    setSubmitting(true)

    if (!isSupabaseConfigured) {
      // Mock path
      mockTenantsDb.insertTenant(
        {
          name: name.trim(),
          entity_type: entityType,
          national_id: nationalId.trim() || null,
          economic_code: economicCode.trim() || null,
          province: province || null,
        },
        session.user.id
      )
      toast.success('شرکت با موفقیت ثبت شد.')
      setSubmitting(false)
      onSuccess()
      return
    }

    // 1. Insert into tenants
    const { data: tenantData, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        name: name.trim(),
        entity_type: entityType,
        national_id: nationalId.trim() || null,
        economic_code: economicCode.trim() || null,
        province: province || null,
      })
      .select('id')
      .single()

    if (tenantError || !tenantData) {
      toast.error('خطا در ثبت شرکت: ' + (tenantError?.message ?? 'خطای نامشخص'))
      setSubmitting(false)
      return
    }

    // 2. Insert into user_tenants
    const { error: linkError } = await supabase.from('user_tenants').insert({
      user_id: session.user.id,
      tenant_id: tenantData['id'],
      role: 'OWNER',
    })

    if (linkError) {
      toast.error('خطا در اتصال شرکت به حساب: ' + linkError.message)
      setSubmitting(false)
      return
    }

    toast.success('شرکت با موفقیت ثبت شد.')
    setSubmitting(false)
    onSuccess()
  }

  return (
    <div className="min-h-screen p-6" style={{ background: '#0a0c0b' }}>
      {/* Header */}
      <header
        className="flex items-center gap-3 px-6 py-4 rounded-xl border border-zinc-800 mb-8"
        style={{ background: '#141615' }}
      >
        <button
          onClick={onBack}
          className="text-zinc-400 hover:text-zinc-100 transition-colors"
          aria-label="بازگشت"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-emerald-400" />
          <span className="text-zinc-100 font-semibold">افزودن شرکت جدید</span>
        </div>
      </header>

      {/* Form card */}
      <div
        className="max-w-xl mx-auto rounded-2xl border border-zinc-800 p-8"
        style={{ background: '#141615' }}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* نام شرکت */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="name" className="text-zinc-300 text-sm">
              نام شرکت <span className="text-red-400">*</span>
            </Label>
            <Input
              id="name"
              type="text"
              placeholder="مثال: شرکت فناوری ایران"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-emerald-600 h-11"
            />
          </div>

          {/* نوع شخصیت */}
          <div className="flex flex-col gap-2">
            <Label className="text-zinc-300 text-sm">
              نوع شخصیت <span className="text-red-400">*</span>
            </Label>
            <Select
              value={entityType}
              onValueChange={(v) => setEntityType(v as 'حقوقی' | 'حقیقی')}
            >
              <SelectTrigger className="bg-zinc-900 border-zinc-700 text-zinc-100 focus:ring-emerald-600 h-11">
                <SelectValue placeholder="انتخاب کنید..." />
              </SelectTrigger>
              <SelectContent
                className="border-zinc-700"
                style={{ background: '#1e2020' }}
              >
                <SelectItem value="حقوقی" className="text-zinc-100 focus:bg-zinc-700 focus:text-zinc-100">
                  حقوقی (شرکت / سازمان)
                </SelectItem>
                <SelectItem value="حقیقی" className="text-zinc-100 focus:bg-zinc-700 focus:text-zinc-100">
                  حقیقی (کسب‌وکار شخصی)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* شناسه ملی / کد ملی */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="national-id" className="text-zinc-300 text-sm">
              {entityType === 'حقیقی' ? 'کد ملی' : 'شناسه ملی'}
            </Label>
            <Input
              id="national-id"
              type="text"
              placeholder={entityType === 'حقیقی' ? '۱۰ رقم' : '۱۱ رقم'}
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value)}
              className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-emerald-600 h-11"
              dir="ltr"
            />
          </div>

          {/* کد اقتصادی */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="economic-code" className="text-zinc-300 text-sm">
              کد اقتصادی
            </Label>
            <Input
              id="economic-code"
              type="text"
              placeholder="۱۲ رقم"
              value={economicCode}
              onChange={(e) => setEconomicCode(e.target.value)}
              className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-emerald-600 h-11"
              dir="ltr"
            />
          </div>

          {/* استان */}
          <div className="flex flex-col gap-2">
            <Label className="text-zinc-300 text-sm">استان</Label>
            <Select value={province} onValueChange={setProvince}>
              <SelectTrigger className="bg-zinc-900 border-zinc-700 text-zinc-100 focus:ring-emerald-600 h-11">
                <SelectValue placeholder="انتخاب استان..." />
              </SelectTrigger>
              <SelectContent
                className="border-zinc-700 max-h-60"
                style={{ background: '#1e2020' }}
              >
                {PROVINCES.map((p) => (
                  <SelectItem
                    key={p}
                    value={p}
                    className="text-zinc-100 focus:bg-zinc-700 focus:text-zinc-100"
                  >
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              disabled={submitting}
              className="flex-1 h-11 bg-emerald-700 hover:bg-emerald-600 text-white font-medium gap-2"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  در حال ثبت...
                </span>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  ثبت شرکت
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              disabled={submitting}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 h-11"
            >
              انصراف
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
