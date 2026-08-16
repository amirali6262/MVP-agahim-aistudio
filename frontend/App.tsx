import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'

import { AuthProvider } from './context/AuthContext'
import { TenantProvider, useTenant } from './context/TenantContext'
import ProtectedRoute from './components/ProtectedRoute'
import ConfigBanner from './components/ConfigBanner'
import AdminLayout from './pages/admin/AdminLayout'

import AdminLogin from './pages/admin/AdminLogin'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminComplianceStudio from './pages/admin/AdminComplianceStudio'
import AdminCircularCenter from './pages/admin/AdminCircularCenter'
import UserAuth from './pages/auth/UserAuth'
import WorkspacePage from './pages/workspace/WorkspacePage'
import PanelDashboard from './pages/panel/PanelDashboard'

import './styles/persian.css'

// Wrapper: ProtectedRoute → AdminLayout → page
function AdminPage({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute requireRole="PLATFORM_ADMIN">
      <AdminLayout>{children}</AdminLayout>
    </ProtectedRoute>
  )
}

function TenantPage({ children }: { children: React.ReactNode }) {
  const { selectedTenant, loading } = useTenant()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0c0b' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-zinc-400 text-sm">در حال بررسی دسترسی به شرکت...</span>
        </div>
      </div>
    )
  }

  if (!selectedTenant) return <Navigate to="/workspace" replace />

  return <>{children}</>
}

export default function App() {
  useEffect(() => {
    document.documentElement.dir = 'rtl'
    document.documentElement.classList.add('dark')
    document.documentElement.style.background = '#181614'
    document.body.style.background = '#181614'
  }, [])

  return (
    <AuthProvider>
      <TenantProvider>
        <ConfigBanner />

        <Toaster
          position="top-center"
          richColors
          dir="rtl"
          toastOptions={{
            style: {
              fontFamily: 'Vazirmatn, Tahoma, sans-serif',
              direction: 'rtl',
              textAlign: 'right',
            },
          }}
        />

        <Routes>
          {/* ── Public auth ── */}
          <Route path="/login" element={<UserAuth mode="login" />} />
          <Route path="/register" element={<UserAuth mode="register" />} />

          {/* ── Admin login (isolated, no layout) ── */}
          <Route path="/admin/login" element={<AdminLogin />} />

          {/* ── Admin panel (all behind AdminLayout + PLATFORM_ADMIN guard) ── */}
          <Route
            path="/admin/dashboard"
            element={<AdminPage><AdminDashboard /></AdminPage>}
          />
          <Route
            path="/admin/studio"
            element={<AdminPage><AdminComplianceStudio /></AdminPage>}
          />
          <Route
            path="/admin/circulars"
            element={<AdminPage><AdminCircularCenter /></AdminPage>}
          />
          <Route path="/admin/tax/*" element={<AdminPage><Navigate to="/admin/studio" replace /></AdminPage>} />
          <Route path="/admin/objections/*" element={<AdminPage><Navigate to="/admin/studio" replace /></AdminPage>} />
          <Route path="/admin/extensions" element={<AdminPage><Navigate to="/admin/circulars" replace /></AdminPage>} />
          <Route path="/admin/books" element={<AdminPage><Navigate to="/admin/studio" replace /></AdminPage>} />
          <Route path="/admin/checklists" element={<AdminPage><Navigate to="/admin/studio" replace /></AdminPage>} />

          {/* ── Protected user routes ── */}
          <Route
            path="/workspace"
            element={
              <ProtectedRoute>
                <WorkspacePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/panel/dashboard"
            element={
              <ProtectedRoute>
                <TenantPage>
                  <PanelDashboard />
                </TenantPage>
              </ProtectedRoute>
            }
          />
          <Route
            path="/panel"
            element={
              <ProtectedRoute>
                <TenantPage>
                  <Navigate to="/panel/dashboard" replace />
                </TenantPage>
              </ProtectedRoute>
            }
          />

          {/* ── Fallbacks ── */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </TenantProvider>
    </AuthProvider>
  )
}
