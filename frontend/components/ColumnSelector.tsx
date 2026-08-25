import { Columns2, Columns3, Columns4, LayoutGrid } from 'lucide-react'

interface ColumnSelectorProps {
  value: 1 | 2 | 3 | 4
  onChange: (cols: 1 | 2 | 3 | 4) => void
  disabled?: boolean
}

const COLUMN_OPTIONS = [
  { value: 1 as const, label: '۱ ستونه', icon: LayoutGrid, description: 'تمام عرض' },
  { value: 2 as const, label: '۲ ستونه', icon: Columns2, description: 'نصف عرض' },
  { value: 3 as const, label: '۳ ستونه', icon: Columns3, description: 'یک سوم عرض' },
  { value: 4 as const, label: '۴ ستونه', icon: Columns4, description: 'یک چهارم عرض' },
]

/**
 * کامپوننت انتخاب تعداد ستون
 * به کاربر اجازه می‌دهد تعداد ستون هر فیلد را تنظیم کند
 */
export default function ColumnSelector({ value, onChange, disabled = false }: ColumnSelectorProps) {
  return (
    <div className="flex items-center gap-1.5">
      {COLUMN_OPTIONS.map((option) => {
        const Icon = option.icon
        const isSelected = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            disabled={disabled}
            title={option.description}
            className={`
              flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold
              transition-all disabled:cursor-not-allowed disabled:opacity-50
              ${isSelected 
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50' 
                : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:border-zinc-700 hover:text-zinc-300'
              }
            `}
          >
            <Icon className="h-3 w-3" />
            <span className="hidden sm:inline">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
