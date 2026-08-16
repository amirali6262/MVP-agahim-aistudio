import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { isMockAuthEnabled, isSupabaseConfigured, supabase } from '../lib/supabase'
import type { Tenant, UserTenantWithTenant } from '../lib/supabase'

interface TenantContextValue {
  selectedTenant: Tenant | null
  loading: boolean
  selectTenant: (tenant: Tenant) => void
  clearTenant: () => void
}

interface StoredTenantSelection {
  tenant_id: string
  userId: string
}

const TenantContext = createContext<TenantContextValue | null>(null)

const STORAGE_KEY = 'selected_tenant'

function readStoredSelection(): StoredTenantSelection | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const value = JSON.parse(raw) as Partial<StoredTenantSelection>
    if (typeof value.tenant_id !== 'string' || typeof value.userId !== 'string') {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }

    const selection = { tenant_id: value.tenant_id, userId: value.userId }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selection))
    return selection
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { session, loading: authLoading } = useAuth()
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)
  const [storedSelection, setStoredSelection] = useState<StoredTenantSelection | null>(readStoredSelection)
  const [loading, setLoading] = useState(true)
  const userId = session?.user?.id ?? null

  const clearTenant = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setStoredSelection(null)
    setSelectedTenant(null)
    setLoading(false)
  }, [])

  const selectTenant = useCallback((tenant: Tenant) => {
    if (!userId) {
      clearTenant()
      return
    }

    const selection = { tenant_id: tenant.id, userId }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selection))
    setStoredSelection(selection)
    setSelectedTenant(tenant)
    setLoading(true)
  }, [clearTenant, userId])

  useEffect(() => {
    if (authLoading) {
      setLoading(true)
      return
    }

    if (!userId) {
      clearTenant()
      return
    }

    if (!storedSelection || storedSelection.userId !== userId) {
      clearTenant()
      return
    }

    let cancelled = false
    setLoading(true)
    setSelectedTenant(null)

    const validateSelection = async () => {
      let tenant: Tenant | null = null

      if (!isSupabaseConfigured) {
        if (import.meta.env.DEV && isMockAuthEnabled) {
          const { mockTenantsDb } = await import('../lib/mockDb')
          tenant = mockTenantsDb
            .getForUser(userId)
            .find((row) => row.tenant_id === storedSelection.tenant_id)
            ?.tenants ?? null
        }
      } else {
        const { data, error } = await supabase
          .from('user_tenants')
          .select('*, tenants(*)')
          .eq('user_id', userId)
          .eq('tenant_id', storedSelection.tenant_id)
          .maybeSingle()

        if (!error && data) tenant = (data as UserTenantWithTenant).tenants
      }

      if (cancelled) return

      if (!tenant) {
        clearTenant()
        return
      }

      setSelectedTenant(tenant)
      setLoading(false)
    }

    void validateSelection().catch(() => {
      if (!cancelled) clearTenant()
    })

    return () => {
      cancelled = true
    }
  }, [authLoading, clearTenant, storedSelection, userId])


  return (
    <TenantContext.Provider value={{ selectedTenant, loading, selectTenant, clearTenant }}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext)
  if (!ctx) throw new Error('useTenant must be used inside TenantProvider')
  return ctx
}
