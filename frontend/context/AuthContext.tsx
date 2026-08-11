import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured, isEmailIdentifier, normalizeIranPhone } from '../lib/supabase'
import type { AppUser } from '../lib/supabase'
import {
  mockSignIn,
  mockSignUp,
  restoreMockSession,
  clearMockSession,
} from '../lib/mockAuth'

interface AuthContextValue {
  session: Session | null
  profile: AppUser | null
  loading: boolean
  signIn: (identifier: string, password: string) => Promise<{ error: string | null }>
  signInAdmin: (identifier: string, password: string) => Promise<{ error: string | null }>
  signUp: (identifier: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  // ── Real Supabase profile fetch ───────────────────────────────────────────
  const fetchProfile = useCallback(async (userId: string): Promise<AppUser | null> => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    if (error || !data) return null
    return data as AppUser
  }, [])

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isSupabaseConfigured) {
      // Mock mode: restore from localStorage
      const stored = restoreMockSession()
      if (stored) {
        setSession(stored.session)
        setProfile(stored.profile)
      }
      setLoading(false)
      return
    }

    // Real Supabase mode
    supabase.auth.getSession().then(async ({ data }) => {
      const sess = data.session
      setSession(sess)
      if (sess?.user) {
        const p = await fetchProfile(sess.user.id)
        setProfile(p)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      setSession(sess)
      if (sess?.user) {
        const p = await fetchProfile(sess.user.id)
        setProfile(p)
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  // ── Credential helper (real mode only) ───────────────────────────────────
  function buildCredentials(identifier: string, password: string) {
    if (isEmailIdentifier(identifier)) return { email: identifier, password }
    return { phone: normalizeIranPhone(identifier), password }
  }

  // ── signIn ────────────────────────────────────────────────────────────────
  const signIn = async (identifier: string, password: string): Promise<{ error: string | null }> => {
    if (!isSupabaseConfigured) {
      const res = mockSignIn(identifier, password)
      if (res.error || !res.session || !res.profile) return { error: res.error ?? 'خطا در ورود' }
      if (res.profile.role !== 'BUSINESS_USER') {
        clearMockSession()
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
    if (!userId) return { error: 'خطا در ورود' }
    const p = await fetchProfile(userId)
    if (!p) return { error: 'پروفایل کاربری یافت نشد' }
    setProfile(p)
    return { error: null }
  }

  // ── signInAdmin ───────────────────────────────────────────────────────────
  const signInAdmin = async (identifier: string, password: string): Promise<{ error: string | null }> => {
    if (!isSupabaseConfigured) {
      const res = mockSignIn(identifier, password)
      if (res.error || !res.session || !res.profile) return { error: res.error ?? 'خطا در ورود' }
      if (res.profile.role !== 'PLATFORM_ADMIN') {
        clearMockSession()
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
    if (!userId) return { error: 'خطا در ورود' }
    const p = await fetchProfile(userId)
    if (!p) return { error: 'پروفایل کاربری یافت نشد' }
    if (p.role !== 'PLATFORM_ADMIN') {
      await supabase.auth.signOut()
      setSession(null)
      setProfile(null)
      return { error: 'دسترسی غیرمجاز. فقط مدیران پلتفرم مجاز به ورود هستند.' }
    }
    setProfile(p)
    return { error: null }
  }

  // ── signUp ────────────────────────────────────────────────────────────────
  const signUp = async (identifier: string, password: string): Promise<{ error: string | null }> => {
    if (!isSupabaseConfigured) {
      const res = mockSignUp(identifier, password)
      if (res.error || !res.session || !res.profile) return { error: res.error ?? 'خطا در ثبت‌نام' }
      setSession(res.session)
      setProfile(res.profile)
      return { error: null }
    }

    const isEmail = isEmailIdentifier(identifier)
    const creds = buildCredentials(identifier, password)
    const { data, error } = await supabase.auth.signUp(creds)
    if (error) return { error: error.message }
    const userId = data.user?.id
    if (!userId) return { error: 'خطا در ثبت‌نام' }
    const { error: profileError } = await supabase.from('users').insert({
      id: userId,
      email: isEmail ? identifier : null,
      phone: !isEmail ? normalizeIranPhone(identifier) : null,
      role: 'BUSINESS_USER',
    })
    if (profileError) return { error: profileError.message }
    return { error: null }
  }

  // ── signOut ───────────────────────────────────────────────────────────────
  const signOut = async () => {
    if (!isSupabaseConfigured) {
      clearMockSession()
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
