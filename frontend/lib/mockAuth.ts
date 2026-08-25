/**
 * Mock authentication — used only when VITE_ENABLE_MOCK_AUTH=true.
 * Credentials are stored only in localStorage.
 */
import type { Session } from '@supabase/supabase-js'
import { isMockAuthEnabled } from './supabase'
import type { AppUser, UserRole } from './supabase'

function assertMockAuthEnabled(): void {
  if (!isMockAuthEnabled) {
    throw new Error('Mock authentication is disabled outside explicitly enabled development mode.')
  }
}

// ---------------------------------------------------------------------------
// Hardcoded demo credentials
// ---------------------------------------------------------------------------
interface MockCred {
  password: string
  role: UserRole
  roles: UserRole[]  // Support for multiple roles
  id: string
}

// حساب‌های آزمایشی فقط برای تست در حالت Mock هستند
// در محیط واقعی، از ایمیل واقعی خود در Supabase استفاده کنید
const MOCK_USERS: Record<string, MockCred> = {
  // حساب اصلی مدیر (با ایمیل واقعی کاربر)
  'bahroz.mohaghegh@gmail.com': {
    password: 'Admin@1234',
    role: 'PLATFORM_ADMIN',
    roles: ['PLATFORM_ADMIN', 'MANAGER'],
    id: 'mock-admin-00000001',
  },
  // حساب‌های آزمایشی دیگر (فقط برای تست)
  'admin@samaneh.ir': {
    password: 'Admin@1234',
    role: 'PLATFORM_ADMIN',
    roles: ['PLATFORM_ADMIN', 'MANAGER'],
    id: 'mock-admin-00000001',
  },
  'manager@samaneh.ir': {
    password: 'Manager@1234',
    role: 'MANAGER',
    roles: ['MANAGER', 'REVIEWER'],
    id: 'mock-manager-00000005',
  },
  'registrar@samaneh.ir': {
    password: 'Registrar@1234',
    role: 'REGISTRAR',
    roles: ['REGISTRAR'],
    id: 'mock-registrar-00000003',
  },
  'reviewer@samaneh.ir': {
    password: 'Reviewer@1234',
    role: 'REVIEWER',
    roles: ['REVIEWER'],
    id: 'mock-reviewer-00000004',
  },
  'approver@samaneh.ir': {
    password: 'Approver@1234',
    role: 'APPROVER',
    roles: ['APPROVER', 'REVIEWER'],
    id: 'mock-approver-00000006',
  },
  'user@samaneh.ir': {
    password: 'User@1234',
    role: 'BUSINESS_USER',
    roles: ['BUSINESS_USER'],
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

export function buildFakeProfile(userId: string, email: string, role: UserRole, roles?: UserRole[]): AppUser {
  assertMockAuthEnabled()
  return { id: userId, email, phone: null, role, roles: roles ?? [role], created_at: new Date().toISOString() }
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
    profile: buildFakeProfile(cred.id, key, cred.role, cred.roles),
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
  MOCK_USERS[key] = { password: _password, role: 'BUSINESS_USER', roles: ['BUSINESS_USER'], id }
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
  // Find the mock user to get their roles
  const cred = MOCK_USERS[s.email]
  const roles = cred?.roles ?? [s.role]
  return {
    session: buildFakeSession(s.userId, s.email),
    profile: buildFakeProfile(s.userId, s.email, s.role, roles),
  }
}
