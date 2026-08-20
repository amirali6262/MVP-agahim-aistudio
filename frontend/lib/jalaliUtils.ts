// Jalali (Solar Hijri) Date Utility Library for Enterprise Iranian Tax & Legal Compliance

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

export const JALALI_WEEKDAYS = [
  { short: 'ش', name: 'شنبه' },
  { short: 'ی', name: 'یکشنبه' },
  { short: 'د', name: 'دوشنبه' },
  { short: 'س', name: 'سه‌شنبه' },
  { short: 'چ', name: 'چهارشنبه' },
  { short: 'پ', name: 'پنج‌شنبه' },
  { short: 'ج', name: 'جمعه', isWeekend: true },
]

// Official Iranian Holidays (Month/Day based)
export const OFFICIAL_HOLIDAYS: Record<string, string> = {
  '1/1': 'عید نوروز',
  '1/2': 'عید نوروز',
  '1/3': 'عید نوروز',
  '1/4': 'عید نوروز',
  '1/12': 'روز جمهوری اسلامی',
  '1/13': 'روز طبیعت (سیزده‌بدر)',
  '3/14': 'رحلت امام خمینی',
  '3/15': 'قیام ۱۵ خرداد',
  '11/22': 'پیروزی انقلاب اسلامی',
  '12/29': 'روز ملی شدن صنعت نفت',
}

// Major statutory tax & compliance deadlines
export const TAX_DEADLINES_HIGHLIGHTS: Record<string, { label: string; desc: string; type: 'tax' | 'vat' | 'books' | 'ss' }> = {
  '1/31': { label: 'پلمپ دفاتر', desc: 'مهلت پلمپ دفاتر تجاری سال مالی جدید', type: 'books' },
  '4/31': { label: 'اظهارنامه اشخاص حقیقی', desc: 'مهلت تسلیم اظهارنامه عملکرد اشخاص حقیقی (مشاغل)', type: 'tax' },
  '5/31': { label: 'اظهارنامه عملکرد اشخاص حقوقی', desc: 'مهلت تسلیم اظهارنامه عملکرد شرکت‌ها و ارزش افزوده فصل بهار', type: 'tax' },
  '7/15': { label: 'ارزش افزوده تابستان', desc: 'مهلت تسلیم اظهارنامه مالیات بر ارزش افزوده فصل تابستان', type: 'vat' },
  '8/30': { label: 'معاملات فصلی بهار/تابستان', desc: 'مهلت ارسال صورت معاملات فصلی موضوع ماده ۱۶۹', type: 'tax' },
  '10/15': { label: 'ارزش افزوده پاییز', desc: 'مهلت تسلیم اظهارنامه مالیات بر ارزش افزوده دوره پاییز', type: 'vat' },
  '11/30': { label: 'معاملات فصلی پاییز', desc: 'مهلت ارسال صورت معاملات فصلی پاییز', type: 'tax' },
  '12/29': { label: 'پایان سال مالی', desc: 'پایان سال مالی و بستن حساب‌ها', type: 'books' },
}

export function isJalaliLeapYear(jy: number): boolean {
  const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178]
  const bl = breaks.length
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

export function getJalaliMonthDays(jy: number, jm: number): number {
  if (jm >= 1 && jm <= 6) return 31
  if (jm >= 7 && jm <= 11) return 30
  if (jm === 12) return isJalaliLeapYear(jy) ? 30 : 29
  return 30
}

export function gregorianToJalali(gy: number, gm: number, gd: number): { jy: number; jm: number; jd: number } {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
  const gy2 = (gm > 2) ? (gy + 1) : gy
  let days = 355666 + (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + g_d_m[gm - 1]
  let jy = -1595 + (33 * Math.floor(days / 12053))
  days %= 12053
  jy += 4 * Math.floor(days / 1461)
  days %= 1461
  if (days > 365) {
    jy += Math.floor((days - 1) / 365)
    days = (days - 1) % 365
  }
  const jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30)
  const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30))
  return { jy, jm, jd }
}

export function jalaliToGregorian(jy: number, jm: number, jd: number): { gy: number; gm: number; gd: number } {
  let adjustedJy = jy + 1595
  let days = -355668 + (365 * adjustedJy) + (Math.floor(adjustedJy / 33) * 8) + Math.floor(((adjustedJy % 33) + 3) / 4) + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186)
  let gy = 400 * Math.floor(days / 146097)
  days %= 146097
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524)
    days %= 36524
    if (days >= 365) days++
  }
  gy += 4 * Math.floor(days / 1461)
  days %= 1461
  if (days > 365) {
    gy += Math.floor((days - 1) / 365)
    days = (days - 1) % 365
  }
  const g_d_m = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  let gm = 0
  while (gm < 13 && days >= g_d_m[gm]) {
    days -= g_d_m[gm]
    gm++
  }
  const gd = days + 1
  return { gy, gm, gd }
}

// 0 for Saturday (شنبه), 1 for Sunday (یکشنبه), ..., 6 for Friday (جمعه)
export function getJalaliFirstDayOfWeek(jy: number, jm: number): number {
  const g = jalaliToGregorian(jy, jm, 1)
  const d = new Date(g.gy, g.gm - 1, g.gd)
  const gDay = d.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  return (gDay + 1) % 7
}

export function getTodayJalali(): { jy: number; jm: number; jd: number; formatted: string } {
  const now = new Date()
  const res = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate())
  const formatted = `${res.jy}/${String(res.jm).padStart(2, '0')}/${String(res.jd).padStart(2, '0')}`
  return { ...res, formatted }
}

// Convert English / Persian digits
export function toPersianDigits(n: number | string): string {
  const persianNums = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']
  return String(n).replace(/[0-9]/g, (w) => persianNums[+w])
}

export function toEnglishDigits(s: string): string {
  const persianToEnglish: Record<string, string> = {
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
    '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  }
  return s.replace(/[۰-۹٠-٩]/g, (w) => persianToEnglish[w] || w)
}

// Parse string like "1404/05/31" or "1404-05-31" or "2024-08-20"
export function parseJalaliDate(str?: string): { year: number; month: number; day: number } | null {
  if (!str) return null
  const cleaned = toEnglishDigits(str.trim())
  
  // Check if it's already Jalali (e.g. starts with 13xx or 14xx)
  const parts = cleaned.split(/[\/\-\.]/).map((p) => parseInt(p, 10))
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    if (parts[0] >= 1300 && parts[0] <= 1500) {
      const month = Math.min(12, Math.max(1, parts[1]))
      const maxDays = getJalaliMonthDays(parts[0], month)
      const day = Math.min(maxDays, Math.max(1, parts[2]))
      return { year: parts[0], month, day }
    } else if (parts[0] >= 1900 && parts[0] <= 2100) {
      // Gregorian date passed (e.g. HTML input date value '2024-08-20')
      const j = gregorianToJalali(parts[0], parts[1], parts[2])
      return { year: j.jy, month: j.jm, day: j.jd }
    }
  }
  return null
}

export function formatJalaliDate(jy: number, jm: number, jd: number): string {
  return `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`
}

export function formatJalaliDatePersianText(jy: number, jm: number, jd: number): string {
  return `${jd} ${JALALI_MONTHS[jm - 1]} ${jy}`
}
