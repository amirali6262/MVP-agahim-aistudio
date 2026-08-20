import React, { useState, useMemo, useRef, useEffect } from 'react'
import {
  Calendar as CalendarIcon,
  ChevronRight,
  ChevronLeft,
  ChevronsRight,
  ChevronsLeft,
  Clock,
  Check,
  X,
  Sparkles,
  Info,
  CalendarDays,
  Flame,
} from 'lucide-react'
import {
  JALALI_MONTHS,
  JALALI_WEEKDAYS,
  OFFICIAL_HOLIDAYS,
  TAX_DEADLINES_HIGHLIGHTS,
  getJalaliMonthDays,
  getJalaliFirstDayOfWeek,
  getTodayJalali,
  parseJalaliDate,
  formatJalaliDate,
  formatJalaliDatePersianText,
  toPersianDigits,
  toEnglishDigits,
  isJalaliLeapYear,
} from '../lib/jalaliUtils'

// Common tax and legal deadline quick chips
const COMMON_DEADLINE_PRESETS = [
  { label: 'پلمپ دفاتر (۳۱ فروردین)', dateSuffix: '01/31' },
  { label: 'اظهارنامه مشاغل (۳۱ تیر)', dateSuffix: '04/31' },
  { label: 'اظهارنامه عملکرد حقوقی (۳۱ مرداد)', dateSuffix: '05/31' },
  { label: 'ارزش افزوده تابستان (۱۵ مهر)', dateSuffix: '07/15' },
  { label: 'معاملات فصلی پاییز (۳۰ آبان)', dateSuffix: '11/30' },
  { label: 'پایان سال مالی (۲۹ اسفند)', dateSuffix: '12/29' },
]

export interface JalaliDatePickerProps {
  value?: string // e.g. '1404/05/31' or '2024-08-20'
  onChange: (value: string) => void
  label?: string
  description?: string
  placeholder?: string
  disabled?: boolean
  readOnly?: boolean
  required?: boolean
  error?: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
  showQuickPresets?: boolean
  allowClear?: boolean
}

export default function JalaliDatePicker({
  value,
  onChange,
  label,
  description,
  placeholder = 'انتخاب یا ورود تاریخ شمسی...',
  disabled = false,
  readOnly = false,
  required = false,
  error,
  className = '',
  size = 'md',
  showQuickPresets = true,
  allowClear = true,
}: JalaliDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [inputVal, setInputVal] = useState<string>('')
  const [viewMode, setViewMode] = useState<'days' | 'months' | 'years'>('days')

  const today = useMemo(() => getTodayJalali(), [])

  // Parse currently selected value
  const parsedValue = useMemo(() => {
    return parseJalaliDate(value)
  }, [value])

  // Synchronize internal text representation
  useEffect(() => {
    if (parsedValue) {
      setInputVal(formatJalaliDate(parsedValue.year, parsedValue.month, parsedValue.day))
    } else {
      setInputVal(value ? toEnglishDigits(value) : '')
    }
  }, [value, parsedValue])

  // Calendar navigation view state (defaults to value's year/month or today's)
  const [viewYear, setViewYear] = useState<number>(() => parsedValue?.year ?? today.jy)
  const [viewMonth, setViewMonth] = useState<number>(() => parsedValue?.month ?? today.jm)

  // Update view position when opening or when value changes
  useEffect(() => {
    if (parsedValue) {
      setViewYear(parsedValue.year)
      setViewMonth(parsedValue.month)
    }
  }, [parsedValue])

  // Click outside detection
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setViewMode('days')
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Month calculation for current view
  const daysInMonth = useMemo(() => {
    return getJalaliMonthDays(viewYear, viewMonth)
  }, [viewYear, viewMonth])

  // First day of week index (0 = شنبه, ..., 6 = جمعه)
  const firstDayOfWeek = useMemo(() => {
    return getJalaliFirstDayOfWeek(viewYear, viewMonth)
  }, [viewYear, viewMonth])

  // Previous month day count for blank fillers
  const prevMonthDays = useMemo(() => {
    const prevM = viewMonth === 1 ? 12 : viewMonth - 1
    const prevY = viewMonth === 1 ? viewYear - 1 : viewYear
    return getJalaliMonthDays(prevY, prevM)
  }, [viewYear, viewMonth])

  const handleSelectDate = (year: number, month: number, day: number) => {
    if (disabled || readOnly) return
    const formatted = formatJalaliDate(year, month, day)
    onChange(formatted)
    setIsOpen(false)
    setViewMode('days')
  }

  const handleClear = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    onChange('')
    setInputVal('')
  }

  const handleSelectToday = () => {
    setViewYear(today.jy)
    setViewMonth(today.jm)
    handleSelectDate(today.jy, today.jm, today.jd)
  }

  const handleSelectEndOfMonth = () => {
    const lastDay = getJalaliMonthDays(viewYear, viewMonth)
    handleSelectDate(viewYear, viewMonth, lastDay)
  }

  const handleQuickPreset = (dateSuffix: string) => {
    const target = `${viewYear}/${dateSuffix}`
    const parsed = parseJalaliDate(target)
    if (parsed) {
      handleSelectDate(parsed.year, parsed.month, parsed.day)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setInputVal(raw)
    const cleaned = toEnglishDigits(raw).replace(/[^\d\/]/g, '')
    if (cleaned.length === 10 && cleaned.split('/').length === 3) {
      const p = parseJalaliDate(cleaned)
      if (p) {
        onChange(formatJalaliDate(p.year, p.month, p.day))
      }
    }
  }

  const handleInputBlur = () => {
    if (!inputVal.trim()) {
      if (value) onChange('')
      return
    }
    const p = parseJalaliDate(inputVal)
    if (p) {
      const formatted = formatJalaliDate(p.year, p.month, p.day)
      onChange(formatted)
      setInputVal(formatted)
    } else {
      // Revert if invalid
      if (parsedValue) {
        setInputVal(formatJalaliDate(parsedValue.year, parsedValue.month, parsedValue.day))
      } else {
        setInputVal(value || '')
      }
    }
  }

  // Navigation handlers
  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewYear((y) => y - 1)
      setViewMonth(12)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewYear((y) => y + 1)
      setViewMonth(1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  const handlePrevYear = () => {
    setViewYear((y) => y - 1)
  }

  const handleNextYear = () => {
    setViewYear((y) => y + 1)
  }

  // Year decade range for years picker view
  const yearDecadeStart = Math.floor(viewYear / 12) * 12

  // Size styling
  const sizeClasses = {
    sm: 'h-9 text-xs px-2.5',
    md: 'h-10 text-xs px-3',
    lg: 'h-11 text-sm px-3.5',
  }[size]

  return (
    <div ref={containerRef} className={`relative flex flex-col gap-1.5 w-full ${className}`}>
      {/* Label and Details */}
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1">
            {label}
            {required && <span className="text-red-400 font-bold">*</span>}
          </label>
          {parsedValue && (
            <span className="text-[11px] text-amber-400/90 font-medium">
              {formatJalaliDatePersianText(parsedValue.year, parsedValue.month, parsedValue.day)}
            </span>
          )}
        </div>
      )}

      {/* Input Trigger Field */}
      <div
        className={`group relative flex items-center justify-between w-full rounded-xl border bg-[#181614] transition-all duration-200 ${sizeClasses} ${
          error
            ? 'border-red-500/80 ring-2 ring-red-500/20'
            : isOpen
            ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-md shadow-amber-950/20'
            : 'border-zinc-800 hover:border-zinc-700'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-zinc-900/50' : ''}`}
      >
        <button
          type="button"
          disabled={disabled || readOnly}
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-2 flex-1 text-right cursor-pointer"
        >
          <div className="p-1 rounded-lg bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20 transition-colors">
            <CalendarIcon className="w-4 h-4" />
          </div>

          <input
            type="text"
            disabled={disabled || readOnly}
            value={inputVal}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            dir="ltr"
            maxLength={10}
            className="w-full bg-transparent text-zinc-100 placeholder:text-zinc-500 focus:outline-none font-mono text-xs sm:text-sm font-semibold tracking-wider"
          />
        </button>

        <div className="flex items-center gap-1.5">
          {allowClear && value && !disabled && !readOnly && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-md text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="پاک کردن تاریخ"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            disabled={disabled || readOnly}
            onClick={() => setIsOpen((prev) => !prev)}
            className="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-800/80 text-zinc-400 hover:text-amber-300 border border-zinc-700/60 transition-colors cursor-pointer"
          >
            تقویم
          </button>
        </div>
      </div>

      {description && !error && (
        <p className="text-[11px] text-zinc-400 leading-tight">{description}</p>
      )}

      {error && (
        <p className="text-[11px] text-red-400 flex items-center gap-1 font-medium">
          <Info className="w-3 h-3" />
          {error}
        </p>
      )}

      {/* Popover Calendar */}
      {isOpen && (
        <div
          dir="rtl"
          className="absolute top-[calc(100%+6px)] right-0 z-50 w-80 sm:w-88 rounded-2xl border border-zinc-700/90 bg-[#191614] p-4 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevYear}
                title="سال قبل"
                className="p-1.5 rounded-lg border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handlePrevMonth}
                title="ماه قبل"
                className="p-1.5 rounded-lg border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Month & Year Title Clickers */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setViewMode(viewMode === 'months' ? 'days' : 'months')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  viewMode === 'months'
                    ? 'bg-amber-500 text-zinc-950 shadow-md'
                    : 'bg-zinc-900 text-zinc-100 hover:bg-zinc-800 border border-zinc-700/60'
                }`}
              >
                {JALALI_MONTHS[viewMonth - 1]}
              </button>

              <button
                type="button"
                onClick={() => setViewMode(viewMode === 'years' ? 'days' : 'years')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono transition-colors ${
                  viewMode === 'years'
                    ? 'bg-amber-500 text-zinc-950 shadow-md'
                    : 'bg-zinc-900 text-zinc-100 hover:bg-zinc-800 border border-zinc-700/60'
                }`}
              >
                {viewYear}
                {isJalaliLeapYear(viewYear) && (
                  <span className="mr-1 text-[9px] font-normal text-emerald-400">کبیسه</span>
                )}
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleNextMonth}
                title="ماه بعد"
                className="p-1.5 rounded-lg border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleNextYear}
                title="سال بعد"
                className="p-1.5 rounded-lg border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* VIEW: Months Selector Grid */}
          {viewMode === 'months' && (
            <div className="grid grid-cols-3 gap-2 py-3">
              {JALALI_MONTHS.map((mName, idx) => {
                const monthNum = idx + 1
                const isCurrentView = viewMonth === monthNum
                const isSelected = parsedValue?.year === viewYear && parsedValue?.month === monthNum
                return (
                  <button
                    key={monthNum}
                    type="button"
                    onClick={() => {
                      setViewMonth(monthNum)
                      setViewMode('days')
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-950/40'
                        : isCurrentView
                        ? 'bg-zinc-800 text-amber-300 border border-amber-500/40'
                        : 'bg-zinc-900/70 text-zinc-200 hover:bg-zinc-800 border border-zinc-800'
                    }`}
                  >
                    {mName}
                  </button>
                )
              })}
            </div>
          )}

          {/* VIEW: Years Selector Grid */}
          {viewMode === 'years' && (
            <div className="py-2">
              <div className="flex items-center justify-between text-[11px] text-zinc-400 pb-2 mb-2 border-b border-zinc-800/60">
                <span>انتخاب سال</span>
                <span className="font-mono">{yearDecadeStart} - {yearDecadeStart + 11}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
                {Array.from({ length: 12 }, (_, i) => yearDecadeStart + i).map((y) => {
                  const isSelected = parsedValue?.year === y
                  const isCurrentView = viewYear === y
                  return (
                    <button
                      key={y}
                      type="button"
                      onClick={() => {
                        setViewYear(y)
                        setViewMode('days')
                      }}
                      className={`py-2 px-2 rounded-xl text-xs font-bold font-mono transition-all ${
                        isSelected
                          ? 'bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-950/40'
                          : isCurrentView
                          ? 'bg-zinc-800 text-amber-300 border border-amber-500/40'
                          : 'bg-zinc-900/70 text-zinc-200 hover:bg-zinc-800 border border-zinc-800'
                      }`}
                    >
                      {y}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* VIEW: Standard Days Grid */}
          {viewMode === 'days' && (
            <>
              {/* Weekdays Row */}
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-zinc-400 py-2 border-b border-zinc-800/50">
                {JALALI_WEEKDAYS.map((wd, i) => (
                  <span
                    key={i}
                    className={`py-0.5 ${wd.isWeekend ? 'text-red-400 font-bold' : ''}`}
                    title={wd.name}
                  >
                    {wd.short}
                  </span>
                ))}
              </div>

              {/* Day Cells Grid */}
              <div className="grid grid-cols-7 gap-1 pt-2">
                {/* Blank days from previous month for alignment */}
                {Array.from({ length: firstDayOfWeek }).map((_, idx) => {
                  const dayNum = prevMonthDays - firstDayOfWeek + idx + 1
                  return (
                    <div
                      key={`prev-${idx}`}
                      className="flex items-center justify-center h-8 rounded-lg text-[11px] font-mono text-zinc-600 select-none opacity-40"
                    >
                      {dayNum}
                    </div>
                  )
                })}

                {/* Days of Current Month */}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                  const holidayKey = `${viewMonth}/${d}`
                  const isOfficialHoliday = OFFICIAL_HOLIDAYS[holidayKey]
                  const taxDeadlineInfo = TAX_DEADLINES_HIGHLIGHTS[holidayKey]
                  const isSelected =
                    parsedValue?.year === viewYear &&
                    parsedValue?.month === viewMonth &&
                    parsedValue?.day === d
                  const isToday =
                    today.jy === viewYear && today.jm === viewMonth && today.jd === d

                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => handleSelectDate(viewYear, viewMonth, d)}
                      title={
                        isOfficialHoliday
                          ? `تعطیل رسمی: ${isOfficialHoliday}`
                          : taxDeadlineInfo
                          ? `سررسید قانونی: ${taxDeadlineInfo.desc}`
                          : isToday
                          ? 'امروز'
                          : `${d} ${JALALI_MONTHS[viewMonth - 1]}`
                      }
                      className={`relative flex items-center justify-center h-8 rounded-lg text-xs font-semibold font-mono transition-all duration-100 ${
                        isSelected
                          ? 'bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-950/40 scale-105 z-10'
                          : isToday
                          ? 'border-2 border-amber-400 bg-amber-500/10 text-amber-300 font-bold'
                          : isOfficialHoliday
                          ? 'bg-red-950/40 border border-red-800/50 text-red-300 hover:bg-red-900/60'
                          : taxDeadlineInfo
                          ? 'bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 hover:bg-emerald-900/60 font-bold'
                          : 'bg-zinc-900/60 hover:bg-zinc-800 text-zinc-200 border border-zinc-800/60 hover:border-zinc-700'
                      }`}
                    >
                      {d}

                      {/* Small Indicator Dot for Tax Deadline */}
                      {taxDeadlineInfo && !isSelected && (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#191614]" />
                      )}

                      {/* Small Red Dot for Holiday */}
                      {isOfficialHoliday && !taxDeadlineInfo && !isSelected && (
                        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-red-400" />
                      )}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* Quick Compliance Presets (Optional) */}
          {showQuickPresets && (
            <div className="mt-3 pt-2.5 border-t border-zinc-800/80">
              <div className="text-[10px] font-semibold text-zinc-400 mb-1.5 flex items-center gap-1">
                <Flame className="w-3 h-3 text-amber-400" />
                سررسیدهای پرکاربرد مالیاتی سال {viewYear}:
              </div>
              <div className="flex flex-wrap gap-1">
                {COMMON_DEADLINE_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleQuickPreset(preset.dateSuffix)}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-900 hover:bg-amber-950/60 hover:text-amber-300 text-zinc-300 border border-zinc-800 hover:border-amber-700/50 transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Footer Shortcuts & Legend */}
          <div className="mt-3 pt-2.5 border-t border-zinc-800 flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectToday}
                className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-amber-300 font-medium transition-colors"
              >
                امروز ({today.formatted})
              </button>
              <button
                type="button"
                onClick={handleSelectEndOfMonth}
                className="px-2 py-0.5 rounded bg-zinc-800/60 hover:bg-zinc-700 text-zinc-300 transition-colors"
              >
                پایان ماه
              </button>
            </div>

            {allowClear && value && (
              <button
                type="button"
                onClick={handleClear}
                className="text-red-400 hover:text-red-300 transition-colors text-[10px]"
              >
                پاک کردن
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
