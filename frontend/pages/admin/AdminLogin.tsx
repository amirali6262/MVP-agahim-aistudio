import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Shield, Eye, EyeOff, Sparkles, ArrowRight, KeyRound } from 'lucide-react'
import { Button } from '../../lib/shadcn/button'
import { Input } from '../../lib/shadcn/input'
import { Label } from '../../lib/shadcn/label'
import { useAuth } from '../../context/AuthContext'

const isMockAuthEnabled =
  import.meta.env.DEV && import.meta.env['VITE_ENABLE_MOCK_AUTH'] === 'true'

export default function AdminLogin() {
  const { signInAdmin, requestPasswordReset, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const recoveryMode = searchParams.get('recovery') === '1'

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (recoveryMode) {
      if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return toast.error('رمز جدید باید حداقل ۱۰ کاراکتر و شامل حرف انگلیسی و عدد باشد.')
      setSubmitting(true)
      const { error } = await updatePassword(password)
      setSubmitting(false)
      if (error) return toast.error(error)
      toast.success('رمز حساب Supabase Auth با موفقیت تغییر کرد. اکنون وارد شوید.')
      navigate('/admin/login', { replace: true })
      setPassword('')
      return
    }
    if (!identifier.trim() || !password) {
      toast.error('لطفاً تمام فیلدها را پر کنید.')
      return
    }

    setSubmitting(true)
    const { error } = await signInAdmin(identifier.trim(), password)
    setSubmitting(false)

    if (error) {
      toast.error(error)
      return
    }

    toast.success('ورود موفق')
    navigate('/admin/dashboard', { replace: true })
  }

  const handleResetPassword = async () => {
    if (!identifier.includes('@')) return toast.error('ابتدا ایمیل حساب مدیر را وارد کنید.')
    setSubmitting(true)
    const { error } = await requestPasswordReset(identifier, '/admin/login?recovery=1')
    setSubmitting(false)
    if (error) return toast.error(error)
    toast.success('اگر این ایمیل در Supabase Auth ثبت شده باشد، لینک بازیابی ارسال می‌شود.')
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: '#181614' }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-800 p-8 shadow-2xl"
        style={{ background: '#211d1a' }}
      >
        {/* Header */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-[#E5A93C]/20 border border-[#E5A93C]/50 flex items-center justify-center">
            <Shield className="w-6 h-6 text-[#E5A93C]" />
          </div>
          <h1 className="text-xl font-semibold text-zinc-100">{recoveryMode ? 'تعیین رمز جدید مدیر' : 'ورود مدیر پلتفرم'}</h1>
          <p className="text-sm text-zinc-500 text-center">
            {recoveryMode ? 'رمز جدید حساب Supabase Auth را وارد کنید' : 'این صفحه فقط برای مدیران سیستم است'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {isMockAuthEnabled && !recoveryMode && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-6 text-amber-200">
              <div className="mb-1 flex items-center gap-2 font-bold">
                <Sparkles className="h-4 w-4" />
                حالت پیش‌نمایش محلی فعال است
              </div>
              برای ورود، یک ایمیل معتبر و هر رمز عبوری وارد کنید. این نشست واقعی Supabase نیست.
            </div>
          )}
          {!recoveryMode && <div className="flex flex-col gap-2">
            <Label htmlFor="identifier" className="text-zinc-300 text-sm">
              ایمیل یا شماره موبایل
            </Label>
            <Input
              id="identifier"
              type="text"
              placeholder="admin@example.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-[#E5A93C] h-11"
              dir="ltr"
            />
          </div>}

          <div className="flex flex-col gap-2">
            <Label htmlFor="password" className="text-zinc-300 text-sm">
              {recoveryMode ? 'رمز عبور جدید' : 'رمز عبور حساب Supabase Auth'}
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={recoveryMode ? 'new-password' : 'current-password'}
                className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-[#E5A93C] h-11 pl-11"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-11 bg-[#E5A93C] hover:bg-[#d49a2d] text-[#181614] font-bold mt-2"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                در حال ورود...
              </span>
            ) : (
              recoveryMode ? 'ذخیره رمز جدید' : 'ورود به پنل مدیریت'
            )}
          </Button>

          {!recoveryMode && <Button type="button" variant="outline" disabled={submitting} onClick={() => void handleResetPassword()} className="w-full gap-2 border-amber-800/70 text-amber-300 hover:bg-amber-950/40"><KeyRound className="h-4 w-4" />فراموشی رمز عبور مدیر</Button>}

          {/* Quick Demo Fill */}
          {/* No demo buttons - use real Supabase credentials */}

          {/* User Portal Link */}
          <div className="pt-2 text-center border-t border-zinc-800/60 mt-1">
            <Link
              to="/login"
              className="text-xs text-zinc-500 hover:text-emerald-400 inline-flex items-center gap-1.5 transition-colors"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              بازگشت به صفحه ورود کاربران شرکت‌ها
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
