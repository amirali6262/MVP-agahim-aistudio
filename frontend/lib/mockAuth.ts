/**
 * Mock authentication — used when VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
 * are not configured. Credentials are stored only in localStorage.
 */
import type { Session } from '@supabase/supabase-js'
import type { AppUser, UserRole } from './supabase'

const isMockAuthRuntimeEnabled =
  import.meta.env.DEV &&
  import.meta.env['VITE_ENABLE_MOCK_AUTH'] !== 'false'

function assertMockAuthEnabled(): void {
  if (!isMockAuthRuntimeEnabled) {
    throw new Error('Mock authentication is disabled outside explicitly enabled development mode.')
  }
}

// ---------------------------------------------------------------------------
// Hardcoded demo credentials
// ---------------------------------------------------------------------------
interface MockCred {
  password: string
  role: UserRole
  id: string
}

const MOCK_USERS: Record<string, MockCred> = {
  'admin@samaneh.ir': {
    password: 'Admin@1234',
    role: 'PLATFORM_ADMIN',
    id: 'mock-admin-00000001',
  },
  'user@samaneh.ir': {
    password: 'User@1234',
    role: 'BUSINESS_USER',
    id: 'mock-user-00000002',
  },
}

// ---------------------------------------------------------------------------
// localStorage persistence
// ---------------------------------------------------------------------------
const SESSION_KEY = 'mock_auth_v1'

interface StoredMock {
  userId: string
  email: string
  role: UserRole
}

function save(s: StoredMock): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(s))
}

export function clearMockSession(): void {
  assertMockAuthEnabled()
  localStorage.removeItem(SESSION_KEY)
}

function load(): StoredMock | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as StoredMock) : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Build a fake Session that satisfies the truthiness + .user.id checks
// ---------------------------------------------------------------------------
export function buildFakeSession(userId: string, email: string): Session {
  assertMockAuthEnabled()
  return {
    access_token: 'mock-token',
    refresh_token: 'mock-refresh',
    expires_in: 86400,
    token_type: 'bearer',
    user: {
      id: userId,
      aud: 'authenticated',
      role: 'authenticated',
      email,
      phone: '',
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
    },
  } as unknown as Session
}

export function buildFakeProfile(userId: string, email: string, role: UserRole): AppUser {
  assertMockAuthEnabled()
  return { id: userId, email, phone: null, role, created_at: new Date().toISOString() }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function mockSignIn(
  identifier: string,
  password: string
): { error: string | null; session: Session | null; profile: AppUser | null } {
  assertMockAuthEnabled()
  const key = identifier.toLowerCase().trim()
  const cred = MOCK_USERS[key]
  if (!cred || cred.password !== password) {
    return { error: 'ایمیل یا رمز عبور اشتباه است.', session: null, profile: null }
  }
  save({ userId: cred.id, email: key, role: cred.role })
  return {
    error: null,
    session: buildFakeSession(cred.id, key),
    profile: buildFakeProfile(cred.id, key, cred.role),
  }
}

export function mockSignUp(
  identifier: string,
  _password: string
): { error: string | null; session: Session | null; profile: AppUser | null } {
  assertMockAuthEnabled()
  // In demo mode registration creates a new BUSINESS_USER in memory
  const key = identifier.toLowerCase().trim()
  if (MOCK_USERS[key]) {
    return { error: 'این کاربر از قبل وجود دارد.', session: null, profile: null }
  }
  const id = 'mock-new-' + Date.now()
  MOCK_USERS[key] = { password: _password, role: 'BUSINESS_USER', id }
  save({ userId: id, email: key, role: 'BUSINESS_USER' })
  return {
    error: null,
    session: buildFakeSession(id, key),
    profile: buildFakeProfile(id, key, 'BUSINESS_USER'),
  }
}

/** Restore session from localStorage on page refresh */
export function restoreMockSession(): { session: Session; profile: AppUser } | null {
  assertMockAuthEnabled()
  const s = load()
  if (!s) return null
  return {
    session: buildFakeSession(s.userId, s.email),
    profile: buildFakeProfile(s.userId, s.email, s.role),
  }
}
