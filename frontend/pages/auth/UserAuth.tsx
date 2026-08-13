import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Eye, EyeOff, Building2 } from 'lucide-react'
import { Button } from '../../lib/shadcn/button'
import { Input } from '../../lib/shadcn/input'
import { Label } from '../../lib/shadcn/label'
import { useAuth } from '../../context/AuthContext'

interface Props {
  mode: 'login' | 'register'
}

export default function UserAuth({ mode }: Props) {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const isRegister = mode === 'register'

  const resetForm = () => {
    setIdentifier('')
    setPassword('')
    setConfirmPassword('')
    setShowPassword(false)
    setShowConfirm(false)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!identifier.trim() || !password) {
      toast.error('لطفاً تمام فیلدها را پر کنید.')
      return
    }

    if (isRegister) {
      if (password.length < 10) {
        toast.error('رمز عبور باید حداقل ۱۰ کاراکتر باشد.')
        return
      }
      if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        toast.error('رمز عبور باید شامل حداقل یک حرف انگلیسی و یک عدد باشد.')
        return
      }
      if (password !== confirmPassword) {
        toast.error('رمز عبور و تکرار آن مطابقت ندارند.')
        return
      }
    }

    setSubmitting(true)

    if (isRegister) {
      const { error, requiresEmailConfirmation } = await signUp(identifier.trim(), password)
      setSubmitting(false)
      if (error) {
        toast.error(error)
        return
      }

      resetForm()
      if (requiresEmailConfirmation) {
        toast.success('ثبت‌نام انجام شد. لطفاً ایمیل تأیید را باز کنید و سپس وارد شوید.')
        navigate('/login', { replace: true })
        return
      }

      toast.success('ثبت‌نام و ورود با موفقیت انجام شد.')
      navigate('/workspace', { replace: true })
    } else {
      const { error } = await signIn(identifier.trim(), password)
      setSubmitting(false)
      if (error) {
        toast.error('خطا در ورود: ' + error)
        return
      }
      toast.success('خوش آمدید')
      navigate('/workspace', { replace: true })
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: '#0a0c0b' }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-800 p-8 shadow-2xl"
        style={{ background: '#141615' }}
      >
        {/* Header */}
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-emerald-900/50 border border-emerald-700 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-emerald-400" />
          </div>
          <h1 className="text-xl font-semibold text-zinc-100">
            {isRegister ? 'ایجاد حساب کاربری' : 'ورود به حساب'}
          </h1>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-lg bg-zinc-900 p-1 mb-6">
          <Link
            to="/login"
            replace
            className={`flex-1 text-center py-2 text-sm rounded-md font-medium transition-all ${
              !isRegister
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            ورود
          </Link>
          <Link
            to="/register"
            replace
            className={`flex-1 text-center py-2 text-sm rounded-md font-medium transition-all ${
              isRegister
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            ثبت‌نام
          </Link>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Identifier */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="identifier" className="text-zinc-300 text-sm">
              ایمیل یا شماره موبایل
            </Label>
            <Input
              id="identifier"
              type="text"
              placeholder="example@email.com یا 09123456789"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete={isRegister ? 'username' : 'email'}
              className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-emerald-600 h-11"
              dir="ltr"
            />
          </div>

          {/* Password */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="password" className="text-zinc-300 text-sm">
              رمز عبور
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder={isRegister ? 'حداقل ۱۰ کاراکتر، شامل حرف و عدد' : '••••••••'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-emerald-600 h-11 pl-11"
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

          {/* Confirm Password (register only) */}
          {isRegister && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm-password" className="text-zinc-300 text-sm">
                تکرار رمز عبور
              </Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="رمز عبور را دوباره وارد کنید"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-emerald-600 h-11 pl-11"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-11 bg-emerald-700 hover:bg-emerald-600 text-white font-medium mt-1"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {isRegister ? 'در حال ثبت‌نام...' : 'در حال ورود...'}
              </span>
            ) : (
              isRegister ? 'ایجاد حساب' : 'ورود'
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
