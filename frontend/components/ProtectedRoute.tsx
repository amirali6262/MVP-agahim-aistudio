import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { UserRole } from '../lib/supabase'

interface Props {
  children: React.ReactNode
  requireRole?: UserRole
  redirectTo?: string
}

const ADMIN_ROLES: UserRole[] = ['PLATFORM_ADMIN', 'MANAGER', 'REGISTRAR', 'REVIEWER', 'APPROVER']

export default function ProtectedRoute({ children, requireRole, redirectTo }: Props) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0c0b' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-zinc-400 text-sm">در حال بارگذاری...</span>
        </div>
      </div>
    )
  }

  if (!session) {
    const to = redirectTo ?? (requireRole === 'PLATFORM_ADMIN' ? '/admin/login' : '/login')
    return <Navigate to={to} state={{ from: location }} replace />
  }

  if (requireRole) {
    // Check if user has any of the required roles (supports multiple roles)
    const userRoles: UserRole[] = profile?.roles ?? (profile?.role ? [profile.role] : [])
    
    if (requireRole === 'PLATFORM_ADMIN') {
      // For admin routes, check if user has any admin-level role
      if (!profile || !userRoles.some((r) => ADMIN_ROLES.includes(r))) {
        return <Navigate to="/login" replace />
      }
    } else {
      // For specific role requirement, check if user has that role
      if (!profile || !userRoles.includes(requireRole)) {
        return <Navigate to="/login" replace />
      }
    }
  }

  return <>{children}</>
}
