import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { LogOut, User } from 'lucide-react'
import { Button } from '../../lib/shadcn/button'
import { TooltipProvider } from '../../lib/shadcn/tooltip'
import AdminSidebar from './AdminSidebar'
import { useAuth } from '../../context/AuthContext'

interface Props {
  children: React.ReactNode
}

export default function AdminLayout({ children }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    toast.success('از سیستم خارج شدید')
    navigate('/admin/login', { replace: true })
  }

  return (
    <TooltipProvider>
      {/*
        RTL flex row: first child → RIGHT side (sidebar)
                      second child → LEFT side (content)
      */}
      <div className="flex h-screen overflow-hidden" style={{ background: '#181614' }}>
        {/* Sidebar — appears on RIGHT in RTL */}
        <AdminSidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((v) => !v)}
        />

        {/* Main area — LEFT side in RTL */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Top header */}
          <header
            className="flex items-center justify-between h-16 px-6 border-b border-zinc-800/80 flex-shrink-0"
            style={{ background: '#211d1a' }}
          >
            <h1 className="text-white font-semibold text-sm hidden sm:block">
              پنل مدیریت پلتفرم
            </h1>
            <div className="flex items-center gap-3 mr-auto">
              <div className="flex items-center gap-2 text-zinc-200 text-sm">
                <User className="w-4 h-4 text-[#E5A93C]" />
                <span className="truncate max-w-[180px] font-medium text-white">
                  {profile?.email ?? profile?.phone ?? '—'}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="text-zinc-300 hover:text-red-400 hover:bg-red-900/20 gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline text-xs">خروج</span>
              </Button>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}
