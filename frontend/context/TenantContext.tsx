import { createContext, useContext, useState, useEffect } from 'react'
import type { Tenant } from '../lib/supabase'

interface TenantContextValue {
  selectedTenant: Tenant | null
  selectTenant: (tenant: Tenant) => void
  clearTenant: () => void
}

const TenantContext = createContext<TenantContextValue | null>(null)

const STORAGE_KEY = 'selected_tenant'

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? (JSON.parse(raw) as Tenant) : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    if (selectedTenant) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedTenant))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [selectedTenant])

  const selectTenant = (tenant: Tenant) => setSelectedTenant(tenant)
  const clearTenant = () => setSelectedTenant(null)

  return (
    <TenantContext.Provider value={{ selectedTenant, selectTenant, clearTenant }}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext)
  if (!ctx) throw new Error('useTenant must be used inside TenantProvider')
  return ctx
}
