import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'

import { AuthProvider } from './context/AuthContext'
import { TenantProvider, useTenant } from './context/TenantContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import AdminLayout from './pages/admin/AdminLayout'

import AdminLogin from './pages/admin/AdminLogin'
import AdminDashboard from './pages/admin/AdminDashboard'
import { ComplianceStudioRoute } from './pages/admin/AdminComplianceStudio'
import AdminCircularCenter from './pages/admin/AdminCircularCenter'
import TaxCorporatePage from './pages/admin/tax/TaxCorporatePage'
import CommercialBooksAdminPage from './pages/admin/books/CommercialBooksAdminPage'
import ChecklistAdminPage from './pages/admin/checklists/ChecklistAdminPage'
import ObjectionTemplatesPage from './pages/admin/objections/ObjectionTemplatesPage'
import RuleCenterPage from './pages/admin/rules/RuleCenterPage'
import CompanyMenuManagerPage from './pages/admin/CompanyMenuManagerPage'
import CompanyInfoDesignerPage from './pages/admin/CompanyInfoDesignerPage'
import SelectionListsPage from './pages/admin/SelectionListsPage'
import SystemKeyRegistryPage from './pages/admin/SystemKeyRegistryPage'
import DeadlineExtensionsPage from './pages/admin/extensions/DeadlineExtensionsPage'
import AdminUserAccessPage from './pages/admin/AdminUserAccessPage'
import UserAuth from './pages/auth/UserAuth'
import WorkspacePage from './pages/workspace/WorkspacePage'
import CompanyWorkspaceShell from './pages/panel/CompanyWorkspaceShell'
import CompanyDashboard from './pages/panel/CompanyDashboard'
import PanelPlaceholderPage from './pages/panel/PanelPlaceholderPage'
import CompanyMembersPage from './pages/panel/CompanyMembersPage'
import CompanyMenuFormPage from './pages/panel/CompanyMenuFormPage'
import CompanyBusinessProfile from './components/CompanyBusinessProfile'
import CompanySettingsPage from './pages/panel/CompanySettingsPage'
import CompanyFiscalYearsPage from './pages/panel/CompanyFiscalYearsPage'
import CompanyInfoWizardPage from './pages/panel/CompanyInfoWizardPage'

import './styles/persian.css'

// Wrapper: ProtectedRoute → AdminLayout → page
function AdminPage({ children }: { children: React.ReactNode }) {
  const location = useLocation()

  return (
    <ProtectedRoute requireRole="PLATFORM_ADMIN">
      <AdminLayout key={location.pathname}>{children}</AdminLayout>
    </ProtectedRoute>
  )
}

function CompanyBusinessProfileView() {
  const { selectedTenant } = useTenant()
  if (!selectedTenant) return null
  return <CompanyBusinessProfile tenantId={selectedTenant.id} tenantName={selectedTenant.name} />
}

function TenantPage({ children }: { children: React.ReactNode }) {
  const { selectedTenant, loading } = useTenant()

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: '#0a0c0b' }}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-zinc-400 text-sm">
            در حال بررسی دسترسی به شرکت...
          </span>
        </div>
      </div>
    )
  }

  if (!selectedTenant) {
    return <Navigate to="/workspace" replace />
  }

  return <>{children}</>
}

export default function App() {
  useEffect(() => {
    document.documentElement.dir = 'rtl'

    const savedTheme = localStorage.getItem('theme')

    if (savedTheme === 'light') {
      document.documentElement.classList.remove('dark')
    } else {
      document.documentElement.classList.add('dark')
    }
  }, [])

  return (
    <ErrorBoundary>
      <AuthProvider>
        <TenantProvider>
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
              element={
                <AdminPage>
                  <AdminDashboard />
                </AdminPage>
              }
            />

            <Route
              path="/admin/studio"
              element={
                <AdminPage>
                  <ComplianceStudioRoute />
                </AdminPage>
              }
            />

            <Route
              path="/admin/circulars"
              element={
                <AdminPage>
                  <AdminCircularCenter />
                </AdminPage>
              }
            />

            <Route
              path="/admin/tax/corporate"
              element={
                <AdminPage>
                  <TaxCorporatePage type="TAX_CORPORATE" />
                </AdminPage>
              }
            />

            <Route
              path="/admin/tax/individual"
              element={
                <AdminPage>
                  <TaxCorporatePage type="TAX_INDIVIDUAL" />
                </AdminPage>
              }
            />

            <Route
              path="/admin/tax/vat"
              element={
                <AdminPage>
                  <TaxCorporatePage type="VAT" />
                </AdminPage>
              }
            />

            <Route
              path="/admin/tax/payroll"
              element={
                <AdminPage>
                  <TaxCorporatePage type="PAYROLL_TAX" />
                </AdminPage>
              }
            />

            <Route
              path="/admin/tax/duties"
              element={
                <AdminPage>
                  <TaxCorporatePage type="TAX_DUTIES" />
                </AdminPage>
              }
            />

            <Route
              path="/admin/tax/claim169"
              element={
                <AdminPage>
                  <TaxCorporatePage type="CLAIM_169" />
                </AdminPage>
              }
            />

            <Route
              path="/admin/tax/*"
              element={
                <AdminPage>
                  <TaxCorporatePage type="ALL" />
                </AdminPage>
              }
            />

            <Route
              path="/admin/insurance/contract"
              element={
                <AdminPage>
                  <TaxCorporatePage type="INS_CONTRACT" />
                </AdminPage>
              }
            />

            <Route
              path="/admin/insurance/audit"
              element={
                <AdminPage>
                  <TaxCorporatePage type="INS_AUDIT" />
                </AdminPage>
              }
            />

            <Route
              path="/admin/insurance/*"
              element={
                <AdminPage>
                  <TaxCorporatePage type="INS_CONTRACT" />
                </AdminPage>
              }
            />

            <Route
              path="/admin/books"
              element={
                <AdminPage>
                  <CommercialBooksAdminPage />
                </AdminPage>
              }
            />

            <Route
              path="/admin/checklists"
              element={
                <AdminPage>
                  <ChecklistAdminPage />
                </AdminPage>
              }
            />

            <Route
              path="/admin/objections/*"
              element={
                <AdminPage>
                  <ObjectionTemplatesPage />
                </AdminPage>
              }
            />

            <Route
              path="/admin/selection-lists"
              element={
                <AdminPage>
                  <SelectionListsPage />
                </AdminPage>
              }
            />

            <Route
              path="/admin/company-info"
              element={
                <AdminPage>
                  <CompanyInfoDesignerPage />
                </AdminPage>
              }
            />

            <Route
              path="/admin/company-menu"
              element={
                <AdminPage>
                  <CompanyMenuManagerPage />
                </AdminPage>
              }
            />

            <Route
              path="/admin/system-keys"
              element={
                <AdminPage>
                  <SystemKeyRegistryPage />
                </AdminPage>
              }
            />

            <Route
              path="/admin/users"
              element={
                <AdminPage>
                  <AdminUserAccessPage />
                </AdminPage>
              }
            />

            <Route
              path="/admin/extensions"
              element={
                <AdminPage>
                  <DeadlineExtensionsPage />
                </AdminPage>
              }
            />

            <Route
              path="/admin/rules"
              element={
                <AdminPage>
                  <RuleCenterPage />
                </AdminPage>
              }
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

            {/* ── Company workspace (shared shell: fixed menu + dynamic published menu) ── */}
            <Route
              path="/panel"
              element={
                <ProtectedRoute>
                  <TenantPage>
                    <CompanyWorkspaceShell />
                  </TenantPage>
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/panel/dashboard" replace />} />
              <Route path="dashboard" element={<CompanyDashboard />} />
              <Route
                path="calendar"
                element={
                  <PanelPlaceholderPage
                    pageKey="calendar"
                    title="تقویم و مهلت‌ها"
                    description="نمایش شمسی مهلت‌های قانونی، سررسیدها و تمدیدها به‌صورت تقویمی در این مرحله ارائه نمی‌شود."
                  />
                }
              />
              <Route
                path="tasks"
                element={
                  <PanelPlaceholderPage
                    pageKey="tasks"
                    title="کارتابل کارها"
                    description="فهرست کامل کارهای قابل‌انجام به‌صورت کارتابلی در این مرحله ارائه نمی‌شود؛ اقدامات ضروری در داشبورد قابل مشاهده است."
                  />
                }
              />
              <Route
                path="documents"
                element={
                  <PanelPlaceholderPage
                    pageKey="documents"
                    title="اسناد و مدارک"
                    description="مرکز اسناد و مدارک بارگذاری‌شده در این مرحله ارائه نمی‌شود."
                  />
                }
              />
              <Route
                path="reports"
                element={
                  <PanelPlaceholderPage
                    pageKey="reports"
                    title="گزارش‌ها"
                    description="گزارش‌های انطباق و وضعیت تعهدات در این مرحله ارائه نمی‌شود."
                  />
                }
              />
              <Route path="business" element={<CompanyBusinessProfileView />} />
              <Route path="company-info" element={<CompanyInfoWizardPage />} />
              <Route path="members" element={<CompanyMembersPage />} />
              <Route path="settings" element={<CompanySettingsPage />} />
              <Route path="fiscal-years" element={<CompanyFiscalYearsPage />} />
              <Route
                path="help"
                element={
                  <PanelPlaceholderPage
                    pageKey="help"
                    title="راهنما و پشتیبانی"
                    description="راهنمای کاربری و پشتیبانی فضای کاری شرکت در این مرحله ارائه نمی‌شود."
                  />
                }
              />
              <Route path="company-form/:obligationId" element={<CompanyMenuFormPage />} />
            </Route>

            {/* ── Fallbacks ── */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </TenantProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
