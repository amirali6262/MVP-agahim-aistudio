import { useState, useMemo } from 'react'
import { Calendar as CalendarIcon, ChevronRight, ChevronLeft, Sparkles, AlertCircle } from 'lucide-react'
import { Button } from '../lib/shadcn/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../lib/shadcn/select'

// Jalali Month Names
export const JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
]

// Official Iranian Holidays & Statutory Tax Dates (Month-Day based in Jalali)
const OFFICIAL_HOLIDAYS: Record<string, string> = {
  '1/1': 'عید نوروز',
  '1/2': 'عید نوروز',
  '1/3': 'عید نوروز',
  '1/4': 'عید نوروز',
  '1/12': 'روز جمهوری اسلامی',
  '1/13': 'روز طبیعت (سیزده بدر)',
  '3/14': 'رحلت امام خمینی',
  '3/15': 'قیام ۱۵ خرداد',
  '11/22': 'پیروزی انقلاب اسلامی',
  '12/29': 'ملی شدن صنعت نفت',
  '12/30': 'آخرین روز سال (در سال‌های کبیسه)',
}

// Major statutory tax deadline milestones
const TAX_DEADLINES_HIGHLIGHTS: Record<string, string> = {
  '1/31': 'مهلت پلمپ دفاتر سال مالی جدید',
  '4/31': 'مهلت اظهارنامه عملکرد و گزارشات فصلی',
  '5/31': 'مهلت گزارشات سه‌ماهه اول / تسلیم اظهارنامه ارزش افزوده',
  '6/31': 'پایان شش‌ماهه اول سال مالی',
  '8/30': 'مهلت گزارشات سه‌ماهه دوم',
  '11/30': 'مهلت گزارشات سه‌ماهه سوم',
}

// Years Range: 1360 to 1500
const YEARS_RANGE = Array.from({ length: 141 }, (_, i) => 1360 + i)

// Helper: check Jalali leap year
export function isJalaliLeapYear(jy: number): boolean {
  const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178]
  let bl = breaks.length
  let jp = breaks[0]
  let jump = 0

  if (jy < jp || jy >= breaks[bl - 1]) return false

  for (let i = 1; i < bl; i += 1) {
    const jm = breaks[i]
    jump = jm - jp
    if (jy < jm) break
    jp = jm
  }

  let n = jy - jp
  if (jump - n < 6) n = n - jump + (Math.floor(jump / 33) * 33)
  let leap = ((n + 1) % 33) - 1
  if (leap === -1) leap = 33

  return leap % 4 === 0
}

// Get number of days in Jalali month
export function getJalaliMonthDays(jy: number, jm: number): number {
  if (jm >= 1 && jm <= 6) return 31
  if (jm >= 7 && jm <= 11) return 30
  if (jm === 12) return isJalaliLeapYear(jy) ? 30 : 29
  return 30
}

interface Props {
  value?: string // e.g., '1404/05/31'
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  disabled?: boolean
  className?: string
}

export default function JalaliDatePicker({
  value,
  onChange,
  label,
  placeholder = 'انتخاب تاریخ شمسی...',
  disabled = false,
  className = '',
}: Props) {
  const [isOpen, setIsOpen] = useState(false)

  // Parse current value or default to current Jalali year 1403/1404
  const parsed = useMemo(() => {
    if (value && value.includes('/')) {
      const parts = value.split('/').map((p) => parseInt(p, 10))
      if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
        return { year: parts[0], month: parts[1], day: parts[2] }
      }
    }
    return { year: 1403, month: 1, day: 1 }
  }, [value])

  const [viewYear, setViewYear] = useState<number>(parsed.year)
  const [viewMonth, setViewMonth] = useState<number>(parsed.month)

  const daysInMonth = useMemo(() => {
    return getJalaliMonthDays(viewYear, viewMonth)
  }, [viewYear, viewMonth])

  const handleSelectDay = (day: number) => {
    const formattedMonth = viewMonth < 10 ? `0${viewMonth}` : `${viewMonth}`
    const formattedDay = day < 10 ? `0${day}` : `${day}`
    const selectedDateStr = `${viewYear}/${formattedMonth}/${formattedDay}`
    onChange(selectedDateStr)
    setIsOpen(false)
  }

  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      if (viewYear > 1360) {
        setViewYear(viewYear - 1)
        setViewMonth(12)
      }
    } else {
      setViewMonth(viewMonth - 1)
    }
  }

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      if (viewYear < 1500) {
        setViewYear(viewYear + 1)
        setViewMonth(1)
      }
    } else {
      setViewMonth(viewMonth + 1)
    }
  }

  return (
    <div className={`relative flex flex-col gap-1.5 ${className}`}>
      {label && <label className="text-xs font-semibold text-zinc-200">{label}</label>}

      {/* Input Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((v) => !v)}
        className={`flex items-center justify-between w-full h-10 px-3.5 rounded-xl border text-xs font-medium transition-all ${
          isOpen
            ? 'border-[#E5A93C] ring-2 ring-[#E5A93C]/20 bg-zinc-900'
            : 'border-zinc-700 bg-zinc-900/90 hover:border-zinc-600 text-white'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-[#E5A93C]" />
          <span className={value ? 'text-white font-mono dir-ltr font-bold' : 'text-zinc-500'}>
            {value || placeholder}
          </span>
        </div>
        <span className="text-[10px] text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">تقویم شمسی</span>
      </button>

      {/* Dropdown Calendar Modal */}
      {isOpen && (
        <div className="absolute top-12 right-0 z-50 w-80 rounded-2xl border border-zinc-700 bg-[#1c1917] p-4 shadow-2xl animate-in fade-in slide-in-from-top-2">
          {/* Header Controls: Year & Month Selectors */}
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-zinc-800">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg border border-zinc-800 hover:bg-zinc-800 text-zinc-300 hover:text-white"
              title="ماه قبل"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5">
              {/* Month Picker */}
              <Select
                value={viewMonth.toString()}
                onValueChange={(v) => setViewMonth(parseInt(v, 10))}
              >
                <SelectTrigger className="h-8 bg-zinc-900 border-zinc-700 text-white text-xs w-28 font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#211d1a] border-zinc-700 max-h-56">
                  {JALALI_MONTHS.map((m, idx) => (
                    <SelectItem key={idx + 1} value={(idx + 1).toString()} className="text-xs text-white">
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Year Picker (1360 to 1500) */}
              <Select
                value={viewYear.toString()}
                onValueChange={(v) => setViewYear(parseInt(v, 10))}
              >
                <SelectTrigger className="h-8 bg-zinc-900 border-zinc-700 text-white text-xs w-20 font-bold font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#211d1a] border-zinc-700 max-h-56">
                  {YEARS_RANGE.map((y) => (
                    <SelectItem key={y} value={y.toString()} className="text-xs text-white font-mono">
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg border border-zinc-800 hover:bg-zinc-800 text-zinc-300 hover:text-white"
              title="ماه بعد"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Jalali Days Header */}
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-zinc-400 py-2 border-b border-zinc-800/60">
            <span>ش</span>
            <span>ی</span>
            <span>د</span>
            <span>س</span>
            <span>چ</span>
            <span>پ</span>
            <span className="text-red-400">ج</span>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 pt-2">
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
              const holidayKey = `${viewMonth}/${d}`
              const isOfficialHoliday = OFFICIAL_HOLIDAYS[holidayKey]
              const taxDeadlineNote = TAX_DEADLINES_HIGHLIGHTS[holidayKey]
              const isSelected =
                parsed.year === viewYear && parsed.month === viewMonth && parsed.day === d

              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleSelectDay(d)}
                  title={
                    isOfficialHoliday
                      ? `تعطیل رسمی: ${isOfficialHoliday}`
                      : taxDeadlineNote
                      ? `مهلت قانونی: ${taxDeadlineNote}`
                      : `${d} ${JALALI_MONTHS[viewMonth - 1]}`
                  }
                  className={`relative flex items-center justify-center h-8 rounded-lg text-xs font-semibold font-mono transition-all ${
                    isSelected
                      ? 'bg-[#E5A93C] text-[#181614] font-bold shadow-lg scale-105'
                      : isOfficialHoliday
                      ? 'bg-red-950/60 border border-red-800/60 text-red-300 hover:bg-red-900/80'
                      : taxDeadlineNote
                      ? 'bg-amber-950/60 border border-amber-800/60 text-amber-300 hover:bg-amber-900/80'
                      : 'bg-zinc-900/50 hover:bg-zinc-800 text-zinc-200 border border-zinc-800/60'
                  }`}
                >
                  {d}
                  {taxDeadlineNote && !isSelected && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer Calendar Highlights Legend */}
          <div className="mt-3 pt-2.5 border-t border-zinc-800 flex items-center justify-between text-[10px] text-zinc-400">
            <span className="flex items-center gap-1 text-red-400">
              <span className="w-2 h-2 rounded-full bg-red-500" /> تعطیلات رسمی
            </span>
            <span className="flex items-center gap-1 text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-400" /> مهلت‌های قانونی
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange('1404/05/31')
                setIsOpen(false)
              }}
              className="text-amber-300 hover:text-white h-6 text-[10px] p-0"
            >
              انتخاب ۳۱ مرداد
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
