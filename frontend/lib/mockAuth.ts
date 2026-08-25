/**
 * Mock authentication — used only when VITE_ENABLE_MOCK_AUTH=true.
 * Credentials are stored only in localStorage.
 *
 * In production, all auth goes through Supabase Auth.
 * This module is only for local development without Supabase.
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
// localStorage persistence
// ---------------------------------------------------------------------------
const SESSION_KEY = 'mock_auth_v1'

interface StoredMock {
  userId: string
  email: string
  role: UserRole
  roles: UserRole[]
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
// Public API — only used when VITE_ENABLE_MOCK_AUTH=true
// ---------------------------------------------------------------------------
export function mockSignIn(
  identifier: string,
  _password: string
): { error: string | null; session: Session | null; profile: AppUser | null } {
  assertMockAuthEnabled()
  // In mock mode, accept any email/password combination
  const key = identifier.toLowerCase().trim()
  if (!key.includes('@')) {
    return { error: 'ایمیل معتبر وارد کنید.', session: null, profile: null }
  }
  // Determine role from the database role if possible
  const role: UserRole = 'PLATFORM_ADMIN'
  const roles: UserRole[] = ['PLATFORM_ADMIN', 'MANAGER']
  const id = 'mock-' + Date.now()
  save({ userId: id, email: key, role, roles })
  return {
    error: null,
    session: buildFakeSession(id, key),
    profile: buildFakeProfile(id, key, role, roles),
  }
}

export function mockSignUp(
  identifier: string,
  _password: string
): { error: string | null; session: Session | null; profile: AppUser | null } {
  assertMockAuthEnabled()
  const key = identifier.toLowerCase().trim()
  const id = 'mock-new-' + Date.now()
  const role: UserRole = 'BUSINESS_USER'
  const roles: UserRole[] = ['BUSINESS_USER']
  save({ userId: id, email: key, role, roles })
  return {
    error: null,
    session: buildFakeSession(id, key),
    profile: buildFakeProfile(id, key, role, roles),
  }
}

/** Restore session from localStorage on page refresh */
export function restoreMockSession(): { session: Session; profile: AppUser } | null {
  assertMockAuthEnabled()
  const s = load()
  if (!s) return null
  return {
    session: buildFakeSession(s.userId, s.email),
    profile: buildFakeProfile(s.userId, s.email, s.role, s.roles),
  }
}
