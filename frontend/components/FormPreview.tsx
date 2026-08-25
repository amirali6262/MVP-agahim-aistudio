import { useState, useMemo } from 'react'
import { Eye, EyeOff, Maximize2, Minimize2 } from 'lucide-react'
import type { WorkflowStepField } from '../lib/supabase'

interface FormPreviewProps {
  fields: WorkflowStepField[]
  stepTitle?: string
  className?: string
}

/**
 * کامپوننت پیش‌نمایش فرم
 * فیلدها را بر اساس تعداد ستون تنظیم‌شده نمایش می‌دهد
 */
export default function FormPreview({ fields, stepTitle, className = '' }: FormPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [formData, setFormData] = useState<Record<string, string>>({})

  // گروه‌بندی فیلدها بر اساس ردیف (هر ۴ ستون یک ردیف)
  const fieldRows = useMemo(() => {
    const rows: WorkflowStepField[][] = []
    let currentRow: WorkflowStepField[] = []
    let currentRowSpan = 0

    for (const field of fields) {
      const fieldCols = field.cols || 1

      // اگر ردیف فعلی پر شد، ردیف جدید شروع کن
      if (currentRowSpan + fieldCols > 4) {
        rows.push(currentRow)
        currentRow = [field]
        currentRowSpan = fieldCols
      } else {
        currentRow.push(field)
        currentRowSpan += fieldCols
      }
    }

    // آخرین ردیف
    if (currentRow.length > 0) {
      rows.push(currentRow)
    }

    return rows
  }, [fields])

  const renderField = (field: WorkflowStepField) => {
    const fieldCols = field.cols || 1
    const colSpanClass = {
      1: 'col-span-1',
      2: 'col-span-2',
      3: 'col-span-3',
      4: 'col-span-4',
    }[fieldCols]

    const baseInputClasses = `
      w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-white
      outline-none transition focus:border-amber-500 placeholder:text-zinc-500
    `

    return (
      <div key={field.id} className={colSpanClass}>
        <label className="mb-1.5 block text-xs font-semibold text-zinc-400">
          {field.label}
          {field.required && <span className="mr-1 text-red-400">*</span>}
          {field.cols && field.cols > 1 && (
            <span className="mr-2 text-[10px] text-zinc-600">
              ({field.cols} ستونه)
            </span>
          )}
        </label>

        {field.type === 'text' && (
          <input
            type="text"
            placeholder={field.placeholder}
            value={formData[field.key] || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
            className={baseInputClasses}
            dir="rtl"
          />
        )}

        {field.type === 'number' && (
          <input
            type="number"
            placeholder={field.placeholder}
            value={formData[field.key] || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
            className={baseInputClasses}
            dir="ltr"
          />
        )}

        {field.type === 'date' && (
          <input
            type="text"
            placeholder="۱۴۰۴/۰۶/۰۱"
            value={formData[field.key] || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
            className={baseInputClasses}
            dir="ltr"
          />
        )}

        {field.type === 'select' && (
          <select
            value={formData[field.key] || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
            className={`${baseInputClasses} cursor-pointer`}
            dir="rtl"
          >
            <option value="">انتخاب کنید...</option>
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        )}

        {field.type === 'checkbox' && (
          <div className="flex items-center gap-3 py-2">
            <input
              type="checkbox"
              checked={formData[field.key] === 'true'}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                [field.key]: e.target.checked ? 'true' : 'false' 
              }))}
              className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-amber-500 focus:ring-amber-500"
            />
            <span className="text-sm text-zinc-300">{field.placeholder || 'بله'}</span>
          </div>
        )}

        {field.type === 'file' && (
          <div className="flex items-center gap-3">
            <input
              type="file"
              className="hidden"
              id={`file-${field.id}`}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  setFormData(prev => ({ ...prev, [field.key]: file.name }))
                }
              }}
            />
            <label
              htmlFor={`file-${field.id}`}
              className="cursor-pointer rounded-xl border border-dashed border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-400 transition hover:border-amber-500 hover:text-amber-300"
            >
              {formData[field.key] || 'انتخاب فایل...'}
            </label>
          </div>
        )}

        {field.helpText && (
          <p className="mt-1 text-[11px] text-zinc-500">{field.helpText}</p>
        )}
      </div>
    )
  }

  return (
    <div className={`rounded-2xl border border-zinc-800 bg-[#1d1a18] overflow-hidden ${className}`}>
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 border-b border-zinc-800 cursor-pointer hover:bg-zinc-900/50 transition"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30">
            <Eye className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">
              {stepTitle ? `پیش‌نمایش: ${stepTitle}` : 'پیش‌نمایش فرم'}
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              {fields.length} فیلد • 
              حداکثر {Math.max(...fields.map(f => f.cols || 1))} ستونه
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsExpanded(!isExpanded)
            }}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition"
            title={isExpanded ? 'بستن' : 'باز کردن'}
          >
            {isExpanded ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              // Toggle between compact and expanded view
            }}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition"
            title="تمام صفحه"
          >
            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Form Content */}
      {isExpanded && (
        <div className="p-5">
          {fields.length === 0 ? (
            <div className="py-12 text-center text-sm text-zinc-500">
              <Eye className="mx-auto mb-3 h-8 w-8 text-zinc-700" />
              هنوز فیلدی تعریف نشده است.
            </div>
          ) : (
            <div className="space-y-4">
              {fieldRows.map((row, rowIdx) => (
                <div key={rowIdx} className="grid grid-cols-4 gap-4">
                  {row.map(renderField)}
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex items-center justify-between border-t border-zinc-800 pt-4">
            <div className="text-xs text-zinc-500">
              <span className="text-amber-400 font-semibold">{fields.filter(f => f.required).length}</span> فیلد الزامی
            </div>
            <div className="flex gap-2">
              <button
                className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-300 transition hover:border-zinc-600 hover:text-white"
                onClick={() => setFormData({})}
              >
                پاک کردن فرم
              </button>
              <button
                className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-amber-500"
                onClick={() => {
                  console.log('Form data:', formData)
                  // toast.success('داده‌های فرم ثبت شد.')
                }}
              >
                ثبت (پیش‌نمایش)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
