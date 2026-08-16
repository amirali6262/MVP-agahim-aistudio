import { AlertTriangle } from 'lucide-react'
import { isMockAuthEnabled, isSupabaseConfigured } from '../lib/supabase'

export default function ConfigBanner() {
  if (isSupabaseConfigured || isMockAuthEnabled) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-900/90 border-b border-amber-600 px-4 py-2 text-right">
      <div className="flex items-center justify-end gap-2 text-amber-200 text-sm">
        <span>
          متغیرهای محیطی Supabase تنظیم نشده‌اند. فایل{' '}
          <code className="bg-amber-800 px-1 rounded font-mono text-xs">.env</code>
          {' '}را با{' '}
          <code className="bg-amber-800 px-1 rounded font-mono text-xs">VITE_SUPABASE_URL</code>
          {' '}و{' '}
          <code className="bg-amber-800 px-1 rounded font-mono text-xs">VITE_SUPABASE_PUBLISHABLE_KEY</code>
          {' '}ایجاد کنید.
        </span>
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      </div>
    </div>
  )
}
