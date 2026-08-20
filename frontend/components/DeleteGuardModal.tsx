import { ShieldAlert, AlertTriangle, Trash2, CheckCircle, FileText, CalendarClock, Layers, Info } from 'lucide-react'
import { Button } from '../lib/shadcn/button'
import type { DependencyCheckResult } from '../lib/dependencyChecker'

interface Props {
  isOpen: boolean
  onClose: () => void
  title: string
  entityType?: string
  checkResult?: DependencyCheckResult
  onConfirmDelete?: () => void
  onConfirm?: () => void
  isDeleting?: boolean
  description?: string
  allowCascadeDelete?: boolean
}

export default function DeleteGuardModal({
  isOpen,
  onClose,
  title,
  entityType = 'آیتم',
  checkResult = { hasDependencies: false, dependencies: [] },
  onConfirmDelete,
  onConfirm,
  isDeleting = false,
  description,
  allowCascadeDelete = true,
}: Props) {
  if (!isOpen) return null

  const handleConfirm = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    try {
      if (typeof onConfirmDelete === 'function') {
        await onConfirmDelete()
      } else if (typeof onConfirm === 'function') {
        await onConfirm()
      }
    } catch (err) {
      console.error('Delete modal confirm execution error:', err)
    }
  }

  const getIcon = (iconType?: string) => {
    switch (iconType) {
      case 'extension':
        return <CalendarClock className="w-4 h-4 text-amber-400 flex-shrink-0" />
      case 'penalty':
        return <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0" />
      case 'workflow':
        return <Layers className="w-4 h-4 text-blue-400 flex-shrink-0" />
      case 'template':
        return <FileText className="w-4 h-4 text-emerald-400 flex-shrink-0" />
      default:
        return <Info className="w-4 h-4 text-amber-400 flex-shrink-0" />
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
      <div
        className="w-full max-w-lg rounded-2xl border border-zinc-800 p-6 shadow-2xl overflow-hidden flex flex-col gap-5"
        style={{ background: '#1c1917' }}
      >
        {checkResult.hasDependencies && !allowCascadeDelete ? (
          /* CANNOT DELETE STATE */
          <>
            <div className="flex items-start gap-3.5 pb-4 border-b border-zinc-800">
              <div className="w-11 h-11 rounded-xl bg-red-950/80 border border-red-800/80 flex items-center justify-center flex-shrink-0">
                <ShieldAlert className="w-6 h-6 text-red-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-red-400 bg-red-950 px-2 py-0.5 rounded-md border border-red-800">
                    خطای وابستگی داده
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mt-1">
                  امکان حذف {entityType} وجود ندارد
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  «<span className="text-zinc-200 font-semibold">{title}</span>»
                </p>
              </div>
            </div>

            <div className="bg-amber-950/30 border border-amber-800/50 rounded-xl p-3.5 text-xs text-amber-200/90 leading-relaxed flex gap-2.5 items-start">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                این داده در سایر بخش‌ها و فرم‌های سامانه استفاده شده است. برای حفظ سلامت و یکپارچگی اطلاعات، ابتدا باید وابستگی‌های زیر را برطرف یا حذف کنید:
              </div>
            </div>

            <div className="flex flex-col gap-2.5 max-h-60 overflow-y-auto pr-1">
              <p className="text-xs font-bold text-zinc-300">
                لیست فرم‌ها و موارد مرتبط ({checkResult.dependencies.length} مورد):
              </p>
              {checkResult.dependencies.map((dep, index) => (
                <div
                  key={index}
                  className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-900/80 flex items-start gap-3 transition-colors"
                >
                  {getIcon(dep.iconType)}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-zinc-200">{dep.formName}</div>
                    <div className="text-[11px] text-zinc-400 mt-1 leading-normal font-medium dir-rtl">
                      {dep.details}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-zinc-800 flex justify-end">
              <Button
                type="button"
                onClick={onClose}
                className="bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold px-6 h-10"
              >
                متوجه شدم (بستن)
              </Button>
            </div>
          </>
        ) : (
          /* CAN DELETE CONFIRMATION STATE (OR CASCADE DELETE) */
          <>
            <div className="flex items-start gap-3.5 pb-4 border-b border-zinc-800">
              <div className="w-11 h-11 rounded-xl bg-amber-950/80 border border-amber-800/80 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-6 h-6 text-amber-400" />
              </div>
              <div className="flex-1">
                <span className="text-[11px] font-semibold text-amber-400 bg-amber-950 px-2 py-0.5 rounded-md border border-amber-800">
                  تأیید نهایی حذف
                </span>
                <h3 className="text-lg font-bold text-white mt-1">
                  آیا از حذف این {entityType} اطمینان دارید؟
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  «<span className="text-zinc-200 font-semibold">{description || title}</span>»
                </p>
              </div>
            </div>

            {checkResult.hasDependencies ? (
              <div className="bg-amber-950/40 border border-amber-800/60 rounded-xl p-3.5 text-xs text-amber-200 leading-relaxed flex flex-col gap-2">
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span>هشدار: {checkResult.dependencies.length} وابستگی مرتبط نیز حذف خواهند شد:</span>
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                  {checkResult.dependencies.map((dep, idx) => (
                    <div key={idx} className="text-[11px] text-zinc-300 bg-zinc-900/70 rounded p-1.5 border border-zinc-800">
                      • {dep.formName}: {dep.details}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 text-xs text-zinc-300 leading-relaxed flex gap-2.5 items-center">
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>
                  کنترل سیستم تأیید کرد: این آیتم به صورت کامل و ایمن پاک خواهد شد.
                </span>
              </div>
            )}

            <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isDeleting}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs h-10 px-5"
              >
                انصراف
              </Button>
              <Button
                type="button"
                onClick={handleConfirm}
                disabled={isDeleting}
                className="bg-red-700 hover:bg-red-600 text-white font-bold text-xs h-10 px-6 gap-2 shadow-lg"
              >
                {isDeleting ? (
                  <span>در حال حذف...</span>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    {checkResult.hasDependencies ? 'حذف به همراه موارد مرتبط' : 'حذف قطعی داده'}
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
