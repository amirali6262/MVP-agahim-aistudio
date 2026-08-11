import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { UserRole } from '../lib/supabase'

interface Props {
  children: React.ReactNode
  requireRole?: UserRole
  redirectTo?: string
}

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

  if (requireRole && profile?.role !== requireRole) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
