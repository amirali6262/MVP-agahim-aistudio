import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  supabase,
  isSupabaseConfigured,
  isEmailIdentifier,
  normalizeIranPhone,
} from '../lib/supabase'
import type { AppUser, UserRole } from '../lib/supabase'

function translateAuthError(message: string): string {
  if (!message) return 'خطایی در احراز هویت رخ داده است.'
  const msg = message.toLowerCase()
  if (msg.includes('invalid login credentials') || msg.includes('invalid_grant')) {
    return 'ایمیل یا رمز عبور اشتباه است.'
  }
  if (msg.includes('user already registered')) {
    return 'این ایمیل یا شماره قبلاً در سیستم ثبت شده است.'
  }
  if (msg.includes('email not confirmed')) {
    return 'ایمیل شما هنوز تأیید نشده است. لطفاً لینک فعال‌سازی در ایمیل خود را بررسی کنید.'
  }
  if (msg.includes('password should be at least')) {
    return 'رمز عبور باید حداقل ۶ کاراکتر باشد.'
  }
  if (msg.includes('rate limit')) {
    return 'تعداد تلاش‌ها بیش از حد مجاز است. لطفاً دقایقی دیگر امتحان کنید.'
  }
  if (msg.includes('user not found')) {
    return 'کاربری با این مشخصات در سامانه یافت نشد.'
  }
  return message
}

const AUTH_CONFIG_ERROR =
  'سامانه احراز هویت پیکربندی نشده است. لطفاً تنظیمات Supabase را بررسی کنید.'

interface AuthContextValue {
  session: Session | null
  profile: AppUser | null
  loading: boolean
  signIn: (identifier: string, password: string) => Promise<{ error: string | null }>
  signInAdmin: (identifier: string, password: string) => Promise<{ error: string | null }>
  signUp: (identifier: string, password: string) => Promise<{ error: string | null; requiresEmailConfirmation?: boolean }>
  requestPasswordReset: (email: string, redirectPath?: string) => Promise<{ error: string | null }>
  updatePassword: (password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const defaultAuthContext: AuthContextValue = {
  session: null,
  profile: null,
  loading: true,
  signIn: async () => ({ error: 'Auth not initialized' }),
  signInAdmin: async () => ({ error: 'Auth not initialized' }),
  signUp: async () => ({ error: 'Auth not initialized' }),
  requestPasswordReset: async () => ({ error: 'Auth not initialized' }),
  updatePassword: async () => ({ error: 'Auth not initialized' }),
  signOut: async () => {},
}

const AuthContext = createContext<AuthContextValue>(defaultAuthContext)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (userId: string): Promise<AppUser | null> => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    if (error || !data) return null
    return data as AppUser
  }, [])

  useEffect(() => {
    let cancelled = false

    if (!isSupabaseConfigured) {
      setSession(null)
      setProfile(null)
      setLoading(false)
      return
    }

    const applyValidatedSession = async (nextSession: Session | null) => {
      if (!nextSession?.user) {
        if (!cancelled) {
          setSession(null)
          setProfile(null)
        }
        return
      }

      const nextProfile = await fetchProfile(nextSession.user.id)
      if (cancelled) return

      if (!nextProfile) {
        setSession(null)
        setProfile(null)
        await supabase.auth.signOut()
        return
      }

      setSession(nextSession)
      setProfile(nextProfile)
    }

    void supabase.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (error || !data.session) {
          await applyValidatedSession(null)
          return
        }
        await applyValidatedSession(data.session)
      })
      .catch(async () => {
        if (!cancelled) {
          await applyValidatedSession(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!nextSession?.user) {
        void applyValidatedSession(null)
        return
      }

      // Defer database access until the auth callback has returned.
      setTimeout(() => {
        void applyValidatedSession(nextSession)
      }, 0)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  function buildCredentials(identifier: string, password: string) {
    if (isEmailIdentifier(identifier)) return { email: identifier, password }
    return { phone: normalizeIranPhone(identifier), password }
  }

  const signIn = async (identifier: string, password: string): Promise<{ error: string | null }> => {
    const trimmed = identifier.trim()

    if (!isSupabaseConfigured) {
      return { error: AUTH_CONFIG_ERROR }
    }

    const creds = buildCredentials(trimmed, password)
    const { data, error } = await supabase.auth.signInWithPassword(creds)
    if (error) {
      return { error: translateAuthError(error.message) }
    }

    const userId = data.user?.id
    if (!userId || !data.session) {
      await supabase.auth.signOut()
      setSession(null)
      setProfile(null)
      return { error: 'خطا در احراز هویت' }
    }

    const nextProfile = await fetchProfile(userId)
    if (!nextProfile) {
      await supabase.auth.signOut()
      setSession(null)
      setProfile(null)
      return { error: 'پروفایل کاربری یافت نشد.' }
    }

    if (nextProfile.role !== 'BUSINESS_USER') {
      await supabase.auth.signOut()
      setSession(null)
      setProfile(null)
      return { error: 'برای ورود به پنل کاربری از صفحه ورود مدیر استفاده کنید.' }
    }

    setSession(data.session)
    setProfile(nextProfile)
    return { error: null }
  }

  const signInAdmin = async (identifier: string, password: string): Promise<{ error: string | null }> => {
    const trimmed = identifier.trim()

    if (!isSupabaseConfigured) {
      return { error: AUTH_CONFIG_ERROR }
    }

    const creds = buildCredentials(trimmed, password)
    const { data, error } = await supabase.auth.signInWithPassword(creds)
    if (error) {
      return { error: translateAuthError(error.message) }
    }

    const userId = data.user?.id
    if (!userId || !data.session) {
      await supabase.auth.signOut()
      setSession(null)
      setProfile(null)
      return { error: 'خطا در احراز هویت' }
    }

    const nextProfile = await fetchProfile(userId)
    if (!nextProfile) {
      await supabase.auth.signOut()
      setSession(null)
      setProfile(null)
      return { error: 'پروفایل کاربری یافت نشد.' }
    }

    const adminRoles: UserRole[] = ['PLATFORM_ADMIN', 'MANAGER', 'REGISTRAR', 'REVIEWER', 'APPROVER']
    // Check roles array first, then fall back to single role field
    let userRoles: UserRole[] = []
    if (nextProfile.roles && nextProfile.roles.length > 0) {
      userRoles = nextProfile.roles
    } else if (nextProfile.role) {
      userRoles = [nextProfile.role]
    }
    
    if (userRoles.length === 0 || !userRoles.some((r) => adminRoles.includes(r))) {
      await supabase.auth.signOut()
      setSession(null)
      setProfile(null)
      return { error: 'دسترسی غیرمجاز. فقط مدیران و اعضای تیم مدیریت مجاز به ورود هستند.' }
    }

    setSession(data.session)
    setProfile(nextProfile)
    return { error: null }
  }

  const signUp = async (identifier: string, password: string): Promise<{ error: string | null; requiresEmailConfirmation?: boolean }> => {
    const trimmed = identifier.trim()
    if (!isSupabaseConfigured) {
      return { error: AUTH_CONFIG_ERROR }
    }

    const creds = buildCredentials(trimmed, password)
    const { data, error } = await supabase.auth.signUp(creds)
    if (error) return { error: translateAuthError(error.message) }

    const userId = data.user?.id
    if (!userId) return { error: 'خطا در ثبت‌نام' }

    // With Confirm Email enabled Supabase intentionally returns no session.
    // The database trigger creates the profile; it becomes readable after login.
    if (!data.session) {
      setSession(null)
      setProfile(null)
      return { error: null, requiresEmailConfirmation: true }
    }

    const createdProfile = await fetchProfile(userId)
    if (!createdProfile) {
      await supabase.auth.signOut()
      setSession(null)
      setProfile(null)
      return { error: 'پروفایل کاربری ایجاد نشد. لطفاً با پشتیبانی تماس بگیرید.' }
    }

    setSession(data.session)
    setProfile(createdProfile)
    return { error: null }
  }

  const signOut = async () => {
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut()
      } catch (err) {
        console.warn('Supabase signOut error:', err)
      }
    }
    setSession(null)
    setProfile(null)
  }

  const requestPasswordReset = async (email: string, redirectPath = '/login?recovery=1'): Promise<{ error: string | null }> => {
    const trimmed = email.trim().toLowerCase()
    if (!isSupabaseConfigured) return { error: AUTH_CONFIG_ERROR }
    if (!isEmailIdentifier(trimmed)) return { error: 'برای بازیابی رمز، ایمیل معتبر وارد کنید.' }
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: new URL(redirectPath, window.location.origin).toString(),
    })
    return { error: error ? translateAuthError(error.message) : null }
  }

  const updatePassword = async (password: string): Promise<{ error: string | null }> => {
    if (!isSupabaseConfigured) return { error: AUTH_CONFIG_ERROR }
    if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return { error: 'رمز عبور باید حداقل ۱۰ کاراکتر و شامل حرف انگلیسی و عدد باشد.' }
    }
    const { error } = await supabase.auth.updateUser({ password })
    return { error: error ? translateAuthError(error.message) : null }
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, signIn, signInAdmin, signUp, requestPasswordReset, updatePassword, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  return ctx || defaultAuthContext
}
