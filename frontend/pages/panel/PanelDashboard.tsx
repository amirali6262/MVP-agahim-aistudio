import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Building2,
  ArrowRight,
  LogOut,
  MapPin,
  Tag,
  Hash,
  FileDigit,
  BookOpen,
  ShieldCheck,
  CheckSquare,
  FileText,
  Layers,
  Gavel,
  Users,
  Briefcase,
  Sparkles,
  Calendar,
  Receipt,
  LayoutDashboard,
} from 'lucide-react'
import { Button } from '../../lib/shadcn/button'
import { useAuth } from '../../context/AuthContext'
import { useTenant } from '../../context/TenantContext'
import CompanyTaxCompliance from '../../components/CompanyTaxCompliance'
import CompanyVatCompliance from '../../components/CompanyVatCompliance'
import CompanyFiscalYear from '../../components/CompanyFiscalYear'
import CompanyCommercialBooks from '../../components/CompanyCommercialBooks'
import CompanyChecklistWizard from '../../components/CompanyChecklistWizard'
import CompanyInsurance from '../../components/CompanyInsurance'
import CompanyTaxDisputes from '../../components/CompanyTaxDisputes'
import CompanyBusinessProfile from '../../components/CompanyBusinessProfile'
import CompanyComplianceOverview from '../../components/CompanyComplianceOverview'

type ActiveTab =
  | 'OVERVIEW'

type ActiveTab =
  | 'BUSINESS_PROFILE'
  | 'FISCAL_YEAR'
  | 'TAX_CORPORATE'
  | 'VAT'
  | 'TAX_DISPUTES'
  | 'INSURANCE_LIST'
  | 'INSURANCE_CLEARANCE'
  | 'CHECKLISTS'
  | 'BOOKS'

export default function PanelDashboard() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('BUSINESS_PROFILE')
  const { signOut } = useAuth()
  const { selectedTenant, clearTenant } = useTenant()
  const navigate = useNavigate()
  const showDemoModules =
    import.meta.env.DEV && import.meta.env['VITE_ENABLE_MOCK_DATA'] === 'true'

  const handleSwitchTenant = () => {
    clearTenant()
    navigate('/workspace')
  }

  const handleSignOut = async () => {
    clearTenant()
    await signOut()
    toast.success('از سیستم خارج شدید')
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto" style={{ background: '#0a0c0b' }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-4 rounded-2xl border border-zinc-800 mb-8 shadow-md"
        style={{ background: '#141615' }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={handleSwitchTenant}
            className="text-zinc-400 hover:text-zinc-100 transition-colors p-1 rounded-lg hover:bg-zinc-800"
            aria-label="تغییر شرکت"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <Building2 className="w-5 h-5 text-amber-400" />
          <span className="text-zinc-100 font-bold truncate max-w-[200px]">
            {selectedTenant?.name ?? 'پنل مدیریت شرکت'}
          </span>
          {selectedTenant?.entity_type && (
            <span className="text-xs bg-amber-950/80 text-amber-300 border border-amber-800/80 px-2.5 py-0.5 rounded-full font-semibold">
              {selectedTenant.entity_type}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSwitchTenant}
            className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 gap-2 text-xs hidden sm:flex"
          >
            تغییر شرکت
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="text-zinc-400 hover:text-red-400 hover:bg-red-900/20 gap-2 text-xs"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">خروج</span>
          </Button>
        </div>
      </header>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Tenant info card & Active Modules Navigation */}
        {selectedTenant && (
          <div className="lg:col-span-1 flex flex-col gap-6">
            <div
              className="rounded-2xl border border-zinc-800 p-6 shadow-md"
              style={{ background: '#141615' }}
            >
              <h2 className="text-zinc-200 font-bold mb-4 pb-3 border-b border-zinc-800/80 flex items-center gap-2 text-sm">
                <Building2 className="w-4 h-4 text-amber-400" />
                اطلاعات شناسنامه‌ای شرکت
              </h2>
              <div className="flex flex-col gap-3.5">
                <InfoRow icon={<Tag className="w-4 h-4" />} label="نام شرکت" value={selectedTenant.name} />
                <InfoRow icon={<Building2 className="w-4 h-4" />} label="نوع شخصیت" value={selectedTenant.entity_type} />
                {selectedTenant.national_id && (
                  <InfoRow
                    icon={<Hash className="w-4 h-4" />}
                    label={selectedTenant.entity_type === 'حقیقی' ? 'کد ملی' : 'شناسه ملی'}
                    value={selectedTenant.national_id}
                  />
                )}
                {selectedTenant.economic_code && (
                  <InfoRow icon={<FileDigit className="w-4 h-4" />} label="کد اقتصادی" value={selectedTenant.economic_code} />
                )}
                {selectedTenant.province && (
                  <InfoRow icon={<MapPin className="w-4 h-4" />} label="استان محل فعالیت" value={selectedTenant.province} />
                )}
              </div>
            </div>

            {/* Navigation Menu in Workspace Panel */}
            <div className="rounded-2xl border border-zinc-800 p-4 bg-[#141615] flex flex-col gap-5 shadow-lg">
              <span className="text-xs font-bold text-zinc-300 border-b border-zinc-800/80 pb-2">
                مسیر ساده شرکت:
              </span>

              <button
                onClick={() => setActiveTab('OVERVIEW')}
                className={`flex items-center gap-2.5 p-3 rounded-xl text-xs font-bold transition-all text-right border ${
                  activeTab === 'OVERVIEW'
                    ? 'bg-[#E5A93C] text-[#181614] border-[#E5A93C] shadow-md'
                    : 'text-zinc-200 bg-zinc-900/60 border-zinc-800 hover:bg-zinc-800'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                <span>وضعیت امروز و کار بعدی</span>
              </button>

              <button
                onClick={() => setActiveTab('BUSINESS_PROFILE')}
                className={`flex items-center gap-2.5 p-3 rounded-xl text-xs font-bold transition-all text-right border ${
                  activeTab === 'BUSINESS_PROFILE'
                    ? 'bg-[#E5A93C] text-[#181614] border-[#E5A93C] shadow-md'
                    : 'text-zinc-200 bg-zinc-900/60 border-zinc-800 hover:bg-zinc-800'
                }`}
              >
                <Building2 className="w-4 h-4 shrink-0" />
                <span>پروفایل و تشخیص مشمولیت</span>
              </button>

              {showDemoModules && (
                <>
              {/* 0. Fiscal Year Section */}
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => setActiveTab('FISCAL_YEAR')}
                  className={`flex items-center gap-2.5 p-3 rounded-xl text-xs font-bold transition-all text-right border ${
                    activeTab === 'FISCAL_YEAR'
                      ? 'bg-[#E5A93C] text-[#181614] border-[#E5A93C] shadow-md'
                      : 'text-zinc-200 bg-zinc-900/60 border-zinc-800 hover:bg-zinc-800'
                  }`}
                >
                  <Calendar className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>تعریف سال مالی</span>
                </button>
              </div>

              {/* 1. Tax Section */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-amber-400/90 flex items-center gap-1.5 px-1">
                  <FileText className="w-3.5 h-3.5" />
                  منوهای امور مالیاتی:
                </span>
                <div className="flex flex-col gap-1 pr-2 border-r-2 border-amber-500/30">
                  <button
                    onClick={() => setActiveTab('TAX_CORPORATE')}
                    className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold transition-all text-right ${
                      activeTab === 'TAX_CORPORATE'
                        ? 'bg-[#E5A93C] text-[#181614] shadow-md'
                        : 'text-zinc-300 hover:bg-zinc-800/60'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5 shrink-0" />
                    <span>مالیات بر عملکرد اشخاص حقوقی</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('VAT')}
                    className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold transition-all text-right ${
                      activeTab === 'VAT'
                        ? 'bg-[#E5A93C] text-[#181614] shadow-md'
                        : 'text-zinc-300 hover:bg-zinc-800/60'
                    }`}
                  >
                    <Receipt className="w-3.5 h-3.5 shrink-0" />
                    <span>مالیات بر ارزش افزوده</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('TAX_DISPUTES')}
                    className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold transition-all text-right ${
                      activeTab === 'TAX_DISPUTES'
                        ? 'bg-[#E5A93C] text-[#181614] shadow-md'
                        : 'text-zinc-300 hover:bg-zinc-800/60'
                    }`}
                  >
                    <Gavel className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                    <span>لوایح و دادرسی (۲۳۸ تا دیوان)</span>
                  </button>
                </div>
              </div>

              {/* 2. Insurance Section */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-emerald-400/90 flex items-center gap-1.5 px-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  منوهای بیمه و تأمین اجتماعی:
                </span>
                <div className="flex flex-col gap-1 pr-2 border-r-2 border-emerald-500/30">
                  <button
                    onClick={() => setActiveTab('INSURANCE_LIST')}
                    className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold transition-all text-right ${
                      activeTab === 'INSURANCE_LIST'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'text-zinc-300 hover:bg-zinc-800/60'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5 shrink-0" />
                    <span>ارسال لیست حقوق و بیمه ماهانه</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('INSURANCE_CLEARANCE')}
                    className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold transition-all text-right ${
                      activeTab === 'INSURANCE_CLEARANCE'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'text-zinc-300 hover:bg-zinc-800/60'
                    }`}
                  >
                    <Briefcase className="w-3.5 h-3.5 shrink-0" />
                    <span>مفاصاحساب پیمان‌ها (ماده ۳۸)</span>
                  </button>
                </div>
              </div>

              {/* 3. Three Suggested System Options */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-zinc-400 flex items-center gap-1.5 px-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  گزینه‌های پیشنهادی سیستم:
                </span>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => setActiveTab('CHECKLISTS')}
                    className={`flex items-center gap-2.5 p-3 rounded-xl text-xs font-bold transition-all text-right ${
                      activeTab === 'CHECKLISTS'
                        ? 'bg-[#E5A93C] text-[#181614] shadow-md'
                        : 'text-zinc-300 hover:bg-zinc-800/60'
                    }`}
                  >
                    <CheckSquare className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>چک‌لیست‌ها و ویزارد تسلیم</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('BOOKS')}
                    className={`flex items-center gap-2.5 p-3 rounded-xl text-xs font-bold transition-all text-right ${
                      activeTab === 'BOOKS'
                        ? 'bg-[#E5A93C] text-[#181614] shadow-md'
                        : 'text-zinc-300 hover:bg-zinc-800/60'
                    }`}
                  >
                    <BookOpen className="w-4 h-4 shrink-0" />
                    <span>سامانه دفاتر تجاری و پلمپ</span>
                  </button>
                </div>
              </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Main Workspace Area */}
        <div className={selectedTenant ? 'lg:col-span-3' : 'lg:col-span-4'}>
          {selectedTenant ? (
  activeTab === 'OVERVIEW' ? (
    <CompanyComplianceOverview tenantId={selectedTenant.id} tenantName={selectedTenant.name} />
  ) : activeTab === 'BUSINESS_PROFILE' ? (
    <CompanyBusinessProfile tenantId={selectedTenant.id} tenantName={selectedTenant.name} />
  ) : activeTab === 'FISCAL_YEAR' ? (
    <CompanyFiscalYear tenantId={selectedTenant.id} tenantName={selectedTenant.name} />
  ) : activeTab === 'TAX_CORPORATE' ? (
    <CompanyTaxCompliance tenantId={selectedTenant.id} tenantName={selectedTenant.name} />
  ) : activeTab === 'VAT' ? (
    <CompanyVatCompliance tenantId={selectedTenant.id} tenantName={selectedTenant.name} />
  ) : activeTab === 'TAX_DISPUTES' ? (
    <CompanyTaxDisputes tenantId={selectedTenant.id} tenantName={selectedTenant.name} />
  ) : activeTab === 'CHECKLISTS' ? (
    <CompanyChecklistWizard tenantId={selectedTenant.id} tenantName={selectedTenant.name} />
  ) : activeTab === 'BOOKS' ? (
    <CompanyCommercialBooks tenantId={selectedTenant.id} tenantName={selectedTenant.name} />
  ) : (
    <CompanyInsurance
      tenantId={selectedTenant.id}
      tenantName={selectedTenant.name}
      initialSubTab={activeTab === 'INSURANCE_CLEARANCE' ? 'ARTICLE_38' : 'MONTHLY_LIST'}
    />
  )
) : (
  <div className="text-zinc-400 text-center py-12">
    لطفاً ابتدا یک شرکت انتخاب کنید.
  </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// InfoRow helper
// ---------------------------------------------------------------------------
function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-zinc-500">{icon}</span>
      <div>
        <p className="text-zinc-500 text-xs">{label}</p>
        <p className="text-zinc-200 text-sm font-medium">{value}</p>
      </div>
    </div>
  )
}
