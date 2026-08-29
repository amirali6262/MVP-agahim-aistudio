import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { Button } from '../lib/shadcn/button'

/**
 * Shared full-page overlay used by every add/create/edit/view form in the
 * admin platform. Opens to the full page size, shows a sticky header with a
 * «بازگشت» back button, and respects the active theme (light / dark).
 */
interface FullScreenDialogProps {
  open: boolean
  title: string
  subtitle?: string
  onBack: () => void
  children: ReactNode
  footer?: ReactNode
  maxWidth?: string
}

export default function FullScreenDialog({
  open,
  title,
  subtitle,
  onBack,
  children,
  footer,
  maxWidth = 'max-w-6xl',
}: FullScreenDialogProps) {
  if (!open) return null
  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[90] overflow-y-auto bg-zinc-50 p-4 text-zinc-900 sm:p-6 dark:bg-[#0b0d0c] dark:text-zinc-100"
    >
      <div className={`mx-auto ${maxWidth}`}>
        <div className="sticky top-0 z-20 mb-5 flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white/95 p-3 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-[#101211]/95">
          <Button
            variant="ghost"
            className="gap-2 shrink-0 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            onClick={onBack}
          >
            <ArrowRight className="h-4 w-4" />
            بازگشت
          </Button>
          <div className="min-w-0 text-center">
            <h2 className="truncate font-black">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">{subtitle}</p>}
          </div>
          <span className="w-24 shrink-0" aria-hidden />
        </div>
        {children}
        {footer && <div className="mt-6">{footer}</div>}
      </div>
    </div>
  )
}
