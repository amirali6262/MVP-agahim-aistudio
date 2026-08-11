import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'

import { AuthProvider } from './context/AuthContext'
import { TenantProvider } from './context/TenantContext'
import ProtectedRoute from './components/ProtectedRoute'
import ConfigBanner from './components/ConfigBanner'
import AdminLayout from './pages/admin/AdminLayout'

import AdminLogin from './pages/admin/AdminLogin'
import AdminDashboard from './pages/admin/AdminDashboard'
import TaxCorporatePage from './pages/admin/tax/TaxCorporatePage'
import ObjectionTemplatesPage from './pages/admin/objections/ObjectionTemplatesPage'
import DeadlineExtensionsPage from './pages/admin/extensions/DeadlineExtensionsPage'
import CommercialBooksAdminPage from './pages/admin/books/CommercialBooksAdminPage'
import ChecklistAdminPage from './pages/admin/checklists/ChecklistAdminPage'
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
            path="/admin/tax/corporate"
            element={<AdminPage><TaxCorporatePage type="TAX_CORPORATE" /></AdminPage>}
          />
          <Route
            path="/admin/tax/vat"
            element={<AdminPage><TaxCorporatePage type="VAT" /></AdminPage>}
          />
          <Route
            path="/admin/objections/templates"
            element={<AdminPage><ObjectionTemplatesPage /></AdminPage>}
          />
          <Route
            path="/admin/extensions"
            element={<AdminPage><DeadlineExtensionsPage /></AdminPage>}
          />
          <Route
            path="/admin/books"
            element={<AdminPage><CommercialBooksAdminPage /></AdminPage>}
          />
          <Route
            path="/admin/checklists"
            element={<AdminPage><ChecklistAdminPage /></AdminPage>}
          />

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
                <PanelDashboard />
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
