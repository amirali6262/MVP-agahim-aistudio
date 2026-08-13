import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  supabase,
  isSupabaseConfigured,
  isMockAuthEnabled,
  isEmailIdentifier,
  normalizeIranPhone,
} from '../lib/supabase'
import type { AppUser } from '../lib/supabase'

type MockAuthModule = typeof import('../lib/mockAuth')

let mockAuthModulePromise: Promise<MockAuthModule> | null = null

async function loadMockAuth(): Promise<MockAuthModule | null> {
  if (!import.meta.env.DEV || !isMockAuthEnabled) return null
  mockAuthModulePromise ??= import('../lib/mockAuth')
  return mockAuthModulePromise
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
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

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
    if (!isSupabaseConfigured) {
      if (!isMockAuthEnabled) {
        setSession(null)
        setProfile(null)
        setLoading(false)
        return
      }

      let cancelled = false
      void loadMockAuth()
        .then((mockAuth) => {
          if (cancelled || !mockAuth) return
          const stored = mockAuth.restoreMockSession()
          if (stored) {
            setSession(stored.session)
            setProfile(stored.profile)
          }
        })
        .catch(() => {
          if (!cancelled) {
            setSession(null)
            setProfile(null)
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })

      return () => {
        cancelled = true
      }
    }

    let cancelled = false

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
        if (error) {
          setSession(null)
          setProfile(null)
          return
        }
        await applyValidatedSession(data.session)
      })
      .catch(() => {
        if (!cancelled) {
          setSession(null)
          setProfile(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!nextSession?.user) {
        setSession(null)
        setProfile(null)
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
    if (!isSupabaseConfigured) {
      const mockAuth = await loadMockAuth()
      if (!mockAuth) return { error: AUTH_CONFIG_ERROR }

      const res = mockAuth.mockSignIn(identifier, password)
      if (res.error || !res.session || !res.profile) return { error: res.error ?? 'خطا در ورود' }
      if (res.profile.role !== 'BUSINESS_USER') {
        mockAuth.clearMockSession()
        return { error: 'برای ورود به پنل کاربری از صفحه /login استفاده کنید.' }
      }
      setSession(res.session)
      setProfile(res.profile)
      return { error: null }
    }

    const creds = buildCredentials(identifier, password)
    const { data, error } = await supabase.auth.signInWithPassword(creds)
    if (error) return { error: error.message }

    const userId = data.user?.id
    if (!userId || !data.session) {
      await supabase.auth.signOut()
      setSession(null)
      setProfile(null)
      return { error: 'خطا در ورود' }
    }

    const nextProfile = await fetchProfile(userId)
    if (!nextProfile) {
      await supabase.auth.signOut()
      setSession(null)
      setProfile(null)
      return { error: 'پروفایل کاربری یافت نشد' }
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
    if (!isSupabaseConfigured) {
      const mockAuth = await loadMockAuth()
      if (!mockAuth) return { error: AUTH_CONFIG_ERROR }

      const res = mockAuth.mockSignIn(identifier, password)
      if (res.error || !res.session || !res.profile) return { error: res.error ?? 'خطا در ورود' }
      if (res.profile.role !== 'PLATFORM_ADMIN') {
        mockAuth.clearMockSession()
        return { error: 'دسترسی غیرمجاز. فقط مدیران پلتفرم مجاز به ورود هستند.' }
      }
      setSession(res.session)
      setProfile(res.profile)
      return { error: null }
    }

    const creds = buildCredentials(identifier, password)
    const { data, error } = await supabase.auth.signInWithPassword(creds)
    if (error) return { error: error.message }

    const userId = data.user?.id
    if (!userId || !data.session) {
      await supabase.auth.signOut()
      setSession(null)
      setProfile(null)
      return { error: 'خطا در ورود' }
    }

    const nextProfile = await fetchProfile(userId)
    if (!nextProfile) {
      await supabase.auth.signOut()
      setSession(null)
      setProfile(null)
      return { error: 'پروفایل کاربری یافت نشد' }
    }

    if (nextProfile.role !== 'PLATFORM_ADMIN') {
      await supabase.auth.signOut()
      setSession(null)
      setProfile(null)
      return { error: 'دسترسی غیرمجاز. فقط مدیران پلتفرم مجاز به ورود هستند.' }
    }

    setSession(data.session)
    setProfile(nextProfile)
    return { error: null }
  }

  const signUp = async (identifier: string, password: string): Promise<{ error: string | null; requiresEmailConfirmation?: boolean }> => {
    if (!isSupabaseConfigured) {
      const mockAuth = await loadMockAuth()
      if (!mockAuth) return { error: AUTH_CONFIG_ERROR }

      const res = mockAuth.mockSignUp(identifier, password)
      if (res.error || !res.session || !res.profile) return { error: res.error ?? 'خطا در ثبت‌نام' }
      setSession(res.session)
      setProfile(res.profile)
      return { error: null }
    }

    const creds = buildCredentials(identifier, password)
    const { data, error } = await supabase.auth.signUp(creds)
    if (error) return { error: error.message }

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
    if (!isSupabaseConfigured) {
      const mockAuth = await loadMockAuth()
      if (mockAuth) mockAuth.clearMockSession()
    } else {
      await supabase.auth.signOut()
    }
    setSession(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, signIn, signInAdmin, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
