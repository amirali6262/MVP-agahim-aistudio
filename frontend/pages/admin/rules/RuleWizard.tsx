import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, FlaskConical, Loader2, Plus, Save, Trash2, X,
} from 'lucide-react'
import { Button } from '../../../lib/shadcn/button'
import JalaliDatePicker from '../../../components/JalaliDatePicker'
import {
  fetchRuleCenterRule,
  fetchRuleCenterRules,
  fetchRuleTests,
  deleteRuleTest,
  fetchRuleUsage,
  fetchRuleVersion,
  rulePublishCheck,
  runRuleTest,
  saveRule,
  transitionRuleVersion,
  suggestRuleCode,
  type RuleInput,
  type RuleKind,
  type RuleVersionStatus,
} from '../../../lib/ruleCenter'
import { parseJalaliDate, jalaliToGregorian, gregorianToJalali } from '../../../lib/jalaliUtils'
import { fetchRoleDefinitions } from '../../../lib/supabaseDb'

function jalaliToIso(value: string): string | null {
  const p = parseJalaliDate(value)
  if (!p) return null
  const g = jalaliToGregorian(p.year, p.month, p.day)
  return `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`
}

function isoToJalaliFa(iso?: string | null): string {
  if (!iso) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  const g = gregorianToJalali(Number(m[1]), Number(m[2]), Number(m[3]))
  return `${g.jy}/${String(g.jm).padStart(2, '0')}/${String(g.jd).padStart(2, '0')}`
}

function testBaseDate(t: { inputs?: Record<string, any> }): string {
  const inp = t.inputs ?? {}
  for (const key of ['fiscal_year_end', 'period_end']) {
    const v = inp[key]?.value
    if (v) return isoToJalaliFa(String(v))
  }
  for (const v of Object.values(inp)) {
    const val = (v as any)?.value
    if (val) return isoToJalaliFa(String(val))
  }
  return '—'
}

function testMethodLabel(t: { actual?: Record<string, any> | null }): string {
  const steps = t.actual?.steps
  if (Array.isArray(steps)) {
    const s = steps.find((x: any) => x?.step === 'interval')
    if (s?.text) return s.text
  }
  return '—'
}

function testDayDiff(t: { expected?: Record<string, any>; actual?: Record<string, any> | null }): string {
  const exp = t.expected?.effective_deadline
  const act = t.actual?.effective_deadline
  if (!exp || !act) return '—'
  const da = Date.parse(String(act))
  const db = Date.parse(String(exp))
  if (Number.isNaN(da) || Number.isNaN(db)) return '—'
  return String(Math.round(Math.abs(da - db) / 86400000))
}

function testFailureReason(t: { actual?: Record<string, any> | null; expected?: Record<string, any> }): string {
  const a = t.actual ?? {}
  if (a.error) return String(a.error)
  if (Array.isArray(a.missing) && a.missing.length > 0) return 'ورودی‌های لازم: ' + a.missing.join('، ')
  const act = a.effective_deadline
  const exp = t.expected?.effective_deadline
  if (exp && act && exp !== act) return `موعد محاسبه‌شده (${isoToJalaliFa(act)}) با موعد مورد انتظار (${isoToJalaliFa(exp)}) یکسان نیست`
  return 'نتیجه با انتظار ادمین همخوانی ندارد'
}

const inputCls =
  'w-full rounded-lg border border-zinc-700 bg-[#1d1a18] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-amber-500/70 transition'

// ── قرارداد صفحهٔ ۲ «تناوب و دوره‌سازی» (مقدار فنی پایدار؛ عنوان فارسی فقط برای نمایش) ──
const EXECUTION_MODES: Array<{ key: 'ONE_TIME' | 'RECURRING' | 'EVENT_DRIVEN'; label: string; desc: string }> = [
  { key: 'ONE_TIME', label: 'یک‌باره', desc: 'این قاعده فقط برای یک رویداد یا پرونده اجرا می‌شود.' },
  { key: 'RECURRING', label: 'تکرارشونده', desc: 'سیستم در دوره‌های مشخص، پرونده یا سررسید جدید ایجاد می‌کند.' },
  { key: 'EVENT_DRIVEN', label: 'رویدادمحور', desc: 'قاعده با وقوع یک رویداد مشخص فعال می‌شود.' },
]

const FREQ_OPTIONS: Array<{ key: string; label: string }> = [
  { key: 'DAY', label: 'روزانه' },
  { key: 'WEEK', label: 'هفتگی' },
  { key: 'MONTH', label: 'ماهانه' },
  { key: 'QUARTER', label: 'سه‌ماهه' },
  { key: 'HALF_YEAR', label: 'شش‌ماهه' },
  { key: 'YEAR', label: 'سالانه' },
  { key: 'CUSTOM', label: 'سفارشی' },
]

const PERIOD_BASIS_OPTIONS: Array<{ key: string; label: string }> = [
  { key: 'COMPANY_FISCAL_YEAR', label: 'سال مالی شرکت' },
  { key: 'CALENDAR_YEAR', label: 'سال تقویمی' },
  { key: 'CALENDAR_MONTH', label: 'ماه تقویمی' },
  { key: 'CASE_PERIOD', label: 'دوره پرونده' },
  { key: 'SOURCE_EVENT', label: 'تاریخ یا رویداد ثبت‌شده' },
  { key: 'RULE_OUTPUT', label: 'خروجی یک قاعده دیگر' },
]

const GEN_TIMING_OPTIONS: Array<{ key: string; label: string; eventBased?: boolean }> = [
  { key: 'PERIOD_START', label: 'آغاز دوره' },
  { key: 'PERIOD_END', label: 'پایان دوره' },
  { key: 'SOURCE_EVENT_RECEIVED', label: 'پس از ثبت رویداد مبنا', eventBased: true },
  { key: 'MANUAL', label: 'به‌صورت دستی' },
]

// رویدادهای ساختاریافتهٔ سامانه (همان واژگان record_case_event) — ورود متن آزاد مجاز نیست
const EVENT_OPTIONS: Array<{ key: string; label: string }> = [
  { key: 'ASSESSMENT', label: 'تشخیص/ارزیابی' },
  { key: 'OBJECTION_SUBMITTED', label: 'ثبت اعتراض' },
  { key: 'HEARING', label: 'جلسهٔ رسیدگی' },
  { key: 'DECISION', label: 'صدور رأی/تصمیم' },
  { key: 'PAYMENT_PLAN', label: 'پرداخت در اقساط' },
  { key: 'PAYMENT', label: 'پرداخت' },
  { key: 'SETTLEMENT_REQUEST', label: 'درخواست تسویه' },
  { key: 'SETTLED', label: 'تسویه' },
  { key: 'CLOSED', label: 'بستن پرونده' },
  { key: 'NOTE', label: 'یادداشت' },
]

const EVENT_SOURCE_OPTIONS: Array<{ key: string; label: string }> = [
  { key: 'CASE_EVENT', label: 'رویداد پرونده' },
  { key: 'RULE_OUTPUT', label: 'خروجی قاعدهٔ دیگر' },
]

// عنوان‌های نمایشی نوع ورودی و کانال یادآوری (مقدار فنی در value بدون تغییر می‌ماند)
const INPUT_TYPE_OPTIONS: Array<{ key: string; label: string }> = [
  { key: 'DATE', label: 'تاریخ' },
  { key: 'DATETIME', label: 'تاریخ و ساعت' },
  { key: 'TEXT', label: 'متن' },
  { key: 'NUMBER', label: 'عدد' },
  { key: 'AMOUNT', label: 'مبلغ' },
  { key: 'BOOL', label: 'بله/خیر' },
  { key: 'SELECT', label: 'فهرست انتخابی' },
  { key: 'PERIOD_REF', label: 'ارجاع دوره' },
  { key: 'FISCAL_YEAR_REF', label: 'ارجاع سال مالی' },
  { key: 'CASE_EVENT', label: 'رویداد پرونده' },
  { key: 'RULE_OUTPUT', label: 'خروجی قاعده' },
]

const CHANNEL_OPTIONS: Array<{ key: string; label: string }> = [
  { key: 'IN_APP', label: 'داخل سامانه' },
  { key: 'EMAIL', label: 'ایمیل' },
  { key: 'SMS', label: 'پیامک' },
  { key: 'PUSH', label: 'اعلان' },
]

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <label className="mb-1.5 block text-xs font-semibold text-zinc-300">
      {children}
      {hint && <span className="mr-1 font-normal text-zinc-500">({hint})</span>}
    </label>
  )
}

function Card({ title, children, danger }: { title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <div className={`rounded-2xl border ${danger ? 'border-red-900/50 bg-red-950/10' : 'border-zinc-800'} bg-[#101211] p-5`}>
      <h4 className="mb-4 text-sm font-bold text-zinc-100">{title}</h4>
      {children}
    </div>
  )
}

type Mode = 'create' | 'edit' | 'newversion'

export default function RuleWizard({
  ruleId,
  versionId,
  kind,
  mode,
  onClose,
  onSaved,
}: {
  ruleId?: string | null
  versionId?: string | null
  kind: RuleKind
  mode: Mode
  onClose: () => void
  onSaved: (ruleId: string) => Promise<void>
}) {
  const [stepIndex, setStepIndexState] = useState(0)
  // گام با اعتبارسنجی: ادامه از صفحهٔ ۲ (تناوب و دوره‌سازی) بدون دادهٔ کامل ممکن نیست
  const setStepIndex = (next: number | ((v: number) => number)) => {
    const target = typeof next === 'function' ? next(stepIndex) : next
    if (stepIndex === 1 && !isPenalty && target > stepIndex) {
      const err = recPageError()
      if (err) { setRecError(err); return }
    }
    setRecError('')
    setStepIndexState(target)
  }
  const [loading, setLoading] = useState(true)
  const [dirty, setDirty] = useState(false)

  // مشخصات
  const [titleFa, setTitleFa] = useState('')
  const [summary, setSummary] = useState('')
  const [nature, setNature] = useState<'LEGAL' | 'INTERNAL'>('INTERNAL')
  const [domain, setDomain] = useState('')
  const [authority, setAuthority] = useState('')
  const [legalSource, setLegalSource] = useState('')
  const [legalClause, setLegalClause] = useState('')
  const [validFrom, setValidFrom] = useState('')
  const [validTo, setValidTo] = useState('')
  const [code, setCode] = useState('')

  // تناوب و دوره‌سازی (صفحه ۲)
  const [scheduleMode, setScheduleMode] = useState<'ONE_TIME' | 'RECURRING' | 'EVENT_DRIVEN'>('ONE_TIME')
  const [freqUnit, setFreqUnit] = useState('YEAR')
  const [freqInterval, setFreqInterval] = useState('1')
  const [periodBasis, setPeriodBasis] = useState('COMPANY_FISCAL_YEAR')
  const [periodSourceKey, setPeriodSourceKey] = useState('')
  const [genTiming, setGenTiming] = useState('PERIOD_END')
  const [eventKey, setEventKey] = useState('')
  const [eventSource, setEventSource] = useState('CASE_EVENT')
  const [eventNewInstance, setEventNewInstance] = useState(true)
  const [eventDedup, setEventDedup] = useState(true)
  const [dedupKey, setDedupKey] = useState('')
  const [rulesForOutput, setRulesForOutput] = useState<Array<{ id: string; code: string; title_fa: string }>>([])
  const [roleOptions, setRoleOptions] = useState<Array<{ key: string; label: string }>>([])
  const [recError, setRecError] = useState('')
  // مبدأ رویداد صفحهٔ سوم (ساختاریافته)
  const [baseEventKey, setBaseEventKey] = useState('')

  // مهلت
  const [dlMethod, setDlMethod] = useState('INTERVAL_FROM_BASE')
  const [baseInput, setBaseInput] = useState('')
  const [baseFixed, setBaseFixed] = useState('PERIOD_START')
  const [gapValue, setGapValue] = useState('10')
  const [gapUnit, setGapUnit] = useState('DAY')
  const [monthApplication, setMonthApplication] = useState('END_OF_NTH_MONTH_AFTER_EVENT')
  const [direction, setDirection] = useState('AFTER')
  const [includeStart, setIncludeStart] = useState(false)
  const [countCalendar, setCountCalendar] = useState('CALENDAR_DAYS')
  const [monthCalendar, setMonthCalendar] = useState('iran_solar')
  const [missingPolicy, setMissingPolicy] = useState('LAST_DAY')
  const [tz, setTz] = useState('Asia/Tehran')
  const [holidayRoll, setHolidayRoll] = useState(true)
  const [workCalendar, setWorkCalendar] = useState('iran_official')
  const [fixedMonth, setFixedMonth] = useState('12')
  const [fixedDay, setFixedDay] = useState('29')
  const [periodPos, setPeriodPos] = useState('END')
  const [periodN, setPeriodN] = useState('1')
  const [noDeadline, setNoDeadline] = useState(false)
  const [pauses, setPauses] = useState<Array<{ start_input: string; end_input: string }>>([])
  const [extensions, setExtensions] = useState<Array<{ days: string; months: string; scope: string }>>([])
  const [reminders, setReminders] = useState<Array<{ offset_before: string; unit: string; role_key: string; channel: string }>>([])

  // جریمه
  const [condLogic, setCondLogic] = useState<'ALL' | 'ANY'>('ALL')
  const [clauses, setClauses] = useState<Array<{ field_key: string; field_label: string; operator: string; value: string }>>([])
  const [calcMethod, setCalcMethod] = useState('FIXED')
  const [fixedAmount, setFixedAmount] = useState('')
  const [ratePercent, setRatePercent] = useState('')
  const [perUnit, setPerUnit] = useState('DAY')
  const [currency, setCurrency] = useState('ریال')
  const [baseAmountInput, setBaseAmountInput] = useState('')
  const [startInput, setStartInput] = useState('effective_deadline')
  const [endInput, setEndInput] = useState('payment_date')
  const [includeFirstDay, setIncludeFirstDay] = useState(false)
  const [includeEndDay, setIncludeEndDay] = useState(false)
  const [accrualCalendar, setAccrualCalendar] = useState('CALENDAR_DAYS')
  const [minLimit, setMinLimit] = useState('')
  const [maxLimit, setMaxLimit] = useState('')
  const [roundTo, setRoundTo] = useState('1')
  const [rounding, setRounding] = useState('NEAREST')
  const [combination, setCombination] = useState('SUM')
  const [decidedCalc, setDecidedCalc] = useState<'AUTO' | 'NEEDS_REFERENCE'>('AUTO')
  const [tiers, setTiers] = useState<Array<{ up_to: string; rate_percent: string }>>([])
  const [tierMode, setTierMode] = useState('BRACKET')

  // ورودی‌ها
  const [inputs, setInputs] = useState<RuleInput[]>([])

  // آزمون
  const [testTitle, setTestTitle] = useState('')
  const [testInputs, setTestInputs] = useState<Record<string, string>>({})
  const [testFieldErrors, setTestFieldErrors] = useState<Record<string, string>>({})
  const [expectedDeadline, setExpectedDeadline] = useState('')
  const [expectedAmount, setExpectedAmount] = useState('')
  const [tests, setTests] = useState<Array<{ id: string; title: string; status: string; inputs?: Record<string, any>; expected?: Record<string, any>; actual?: Record<string, any> | null; created_at?: string }>>([])
  const [runningTest, setRunningTest] = useState(false)

  const [usage, setUsage] = useState<Array<any>>([])
  const [versionStatus, setVersionStatus] = useState<RuleVersionStatus | ''>('')
  const [saving, setSaving] = useState(false)
  const [savedVersionId, setSavedVersionId] = useState<string | null>(null)
  const [transitioning, setTransitioning] = useState(false)
  const [publishChecks, setPublishChecks] = useState<Array<{ key: string; ok: boolean; label: string }>>([])

  const isPenalty = kind === 'PENALTY'
  const pageCount = 6

  useEffect(() => {
    const onBefore = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', onBefore)
    return () => window.removeEventListener('beforeunload', onBefore)
  }, [dirty])

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        if (ruleId && mode !== 'create') {
          const rule = await fetchRuleCenterRule(ruleId)
          if (rule) {
            setTitleFa(rule.title_fa)
            setSummary(rule.summary ?? '')
            setNature(rule.nature)
            setDomain(rule.domain ?? '')
            setAuthority(rule.authority ?? '')
            setLegalSource(rule.legal_source ?? '')
            setLegalClause(rule.legal_clause ?? '')
            setValidFrom(rule.valid_from ?? '')
            setValidTo(rule.valid_to ?? '')
            setCode(rule.code)
          }
        }
        if (versionId && mode === 'edit') {
          const v = await fetchRuleVersion(versionId)
          if (v) {
            setVersionStatus(v.status)
            applyDefinition(v.definition, v.inputs)
          }
        }
      } catch (e: any) {
        toast.error(e?.message ?? 'خطا در بارگذاری قاعده')
      } finally {
        setLoading(false)
      }
      fetchRuleCenterRules()
        .then((list) => setRulesForOutput(list.map((r) => ({ id: r.id, code: r.code, title_fa: r.title_fa }))))
        .catch(() => { /* فهرست قواعد برای منبع RULE_OUTPUT؛ در نبود اتصال، انتخاب غیرفعال می‌ماند */ })
      // نقش‌های قابل انتساب برای یادآوری — از role_definitions (بدون PLATFORM_ADMIN)
      fetchRoleDefinitions()
        .then((list) => setRoleOptions(list.filter((r) => r.key !== 'PLATFORM_ADMIN').map((r) => ({ key: r.key, label: r.label || r.persian_label || r.key }))))
        .catch(() => { /* در نبود دسترسی، فهرست نقش خالی می‌ماند */ })
    })()
  }, [ruleId, versionId, mode])

  function applyDefinition(def: Record<string, any>, inputList: RuleInput[]) {
    const dl = def.deadline ?? {}
    const rec = def.recurrence ?? {}
    const calc = def.calculation ?? {}
    setInputs(inputList)
    if (rec.schedule_mode) {
      // قرارداد جدید صفحهٔ ۲
      setScheduleMode(rec.schedule_mode)
      setFreqUnit(rec.frequency_unit ?? 'YEAR')
      setFreqInterval(String(rec.frequency_interval ?? 1))
      setPeriodBasis(rec.period_basis ?? 'COMPANY_FISCAL_YEAR')
      setPeriodSourceKey(rec.period_source_key ?? '')
      setGenTiming(rec.instance_generation_timing ?? 'PERIOD_END')
      const ec = rec.event_config ?? {}
      setEventKey(ec.event_key ?? '')
      setEventSource(ec.event_source ?? 'CASE_EVENT')
      setEventNewInstance(ec.new_instance_per_occurrence !== false)
      setEventDedup(ec.prevent_duplicate !== false)
      setDedupKey(ec.dedup_key ?? '')
    } else if (rec.mode) {
      // سازگاری با ساختار قدیمی (backward compatibility)
      const legacy = rec.mode
      if (legacy === 'ONCE') {
        setScheduleMode('ONE_TIME')
      } else if (legacy === 'CALENDAR_PERIODS') {
        setScheduleMode('RECURRING')
        const u = rec.interval?.unit
        setFreqUnit(u === 'QUARTER' ? 'QUARTER' : u === 'SEMI' ? 'HALF_YEAR' : u === 'YEAR' ? 'YEAR' : u === 'CUSTOM_MONTHS' ? 'CUSTOM' : 'MONTH')
        setFreqInterval(String(rec.interval?.value ?? 1))
        setPeriodBasis(['YEAR', 'QUARTER', 'HALF_YEAR'].includes(u) ? 'CALENDAR_YEAR' : 'CALENDAR_MONTH')
        setPeriodSourceKey('')
        setGenTiming('PERIOD_START')
      } else if (legacy === 'FISCAL_YEAR_PERIODS') {
        setScheduleMode('RECURRING')
        const p = rec.fiscal_year_period
        setFreqUnit(p === 'MONTHLY' ? 'MONTH' : p === 'QUARTERLY' ? 'QUARTER' : p === 'SEMI' ? 'HALF_YEAR' : p === 'CUSTOM_MONTHS' ? 'CUSTOM' : 'YEAR')
        setFreqInterval('1')
        setPeriodBasis('COMPANY_FISCAL_YEAR')
        setPeriodSourceKey('case_fiscal_year')
        setGenTiming('PERIOD_START')
      } else if (legacy === 'EVENT' || legacy === 'OFFSET_FROM_EVENT') {
        setScheduleMode('EVENT_DRIVEN')
        setEventKey('')
        setEventSource('CASE_EVENT')
        setEventNewInstance(true)
        setEventDedup(true)
        setDedupKey('')
      }
    }
    if (dl.method) {
      setDlMethod(dl.method)
      setBaseInput(dl.interval?.base_input ?? '')
      setBaseFixed(dl.interval?.base ?? 'PERIOD_START')
      setBaseEventKey(dl.interval?.base_event ?? '')
      setGapValue(String(dl.interval?.value ?? 10))
      setGapUnit(dl.interval?.unit ?? 'DAY')
      setMonthApplication(dl.interval?.month_application ?? 'END_OF_NTH_MONTH_AFTER_EVENT')
      setDirection(dl.interval?.direction ?? 'AFTER')
      setIncludeStart(Boolean(dl.count?.include_start))
      setCountCalendar(dl.count?.calendar ?? 'CALENDAR_DAYS')
      setMonthCalendar(dl.count?.month_calendar ?? 'iran_solar')
      setMissingPolicy(dl.count?.missing_day_policy ?? 'LAST_DAY')
      setTz(dl.count?.timezone ?? 'Asia/Tehran')
      setHolidayRoll(Boolean(dl.holiday_roll?.enabled ?? true))
      setWorkCalendar(dl.holiday_roll?.calendar_id ?? 'iran_official')
      setFixedMonth(String(dl.fixed_date?.month ?? 12))
      setFixedDay(String(dl.fixed_date?.day ?? 29))
      setPeriodPos(dl.fixed_in_period?.position ?? 'END')
      setPeriodN(String(dl.fixed_in_period?.n ?? 1))
      setNoDeadline(Boolean(dl.no_deadline))
      setPauses(Array.isArray(dl.pauses) ? dl.pauses : [])
      setExtensions(Array.isArray(dl.extensions) ? dl.extensions.map((e: any) => ({ days: String(e.days ?? 0), months: String(e.months ?? 0), scope: e.scope ?? 'CASE' })) : [])
      setReminders(Array.isArray(def.reminders) ? def.reminders : [])
    }
    if (calc.method) {
      setCalcMethod(calc.method)
      setFixedAmount(calc.amount != null ? String(calc.amount) : '')
      setRatePercent(calc.rate_percent != null ? String(calc.rate_percent) : '')
      setPerUnit(calc.per_unit ?? 'DAY')
      setCurrency(calc.currency ?? 'ریال')
      setBaseAmountInput(calc.base_input ?? '')
      setStartInput(calc.start_input ?? 'effective_deadline')
      setEndInput(calc.end_input ?? 'payment_date')
      setIncludeFirstDay(Boolean(calc.include_first_day))
      setIncludeEndDay(Boolean(calc.include_end_day))
      setAccrualCalendar(calc.accrual_calendar ?? 'CALENDAR_DAYS')
      setMinLimit(calc.limits?.min != null ? String(calc.limits.min) : '')
      setMaxLimit(calc.limits?.max != null ? String(calc.limits.max) : '')
      setRoundTo(String(calc.limits?.round_to ?? 1))
      setRounding(calc.limits?.rounding ?? 'NEAREST')
      setCombination(calc.combination ?? 'SUM')
      setTierMode(calc.tier_mode ?? 'BRACKET')
      setTiers(Array.isArray(calc.tiers) ? calc.tiers.map((t: any) => ({ up_to: t.up_to != null ? String(t.up_to) : '', rate_percent: String(t.rate_percent ?? 0) })) : [])
      setDecidedCalc(def.decided?.status === 'NEEDS_REFERENCE' ? 'NEEDS_REFERENCE' : 'AUTO')
    }
    setClauses((def.conditions?.clauses ?? []).map((c: any) => ({ field_key: c.field_key ?? '', field_label: c.field_label ?? '', operator: c.operator ?? 'EQ', value: c.value?.value != null ? String(c.value.value) : '' })))
    setCondLogic(def.conditions?.logic ?? 'ALL')
  }

  function buildDefinition(): Record<string, any> {
    if (isPenalty) {
      return {
        conditions: {
          logic: condLogic,
          clauses: clauses.map((c) => ({
            source: 'CASE', field_key: c.field_key, field_label: c.field_label, operator: c.operator,
            value: { value: c.value },
          })),
        },
        calculation: {
          method: calcMethod,
          amount: calcMethod === 'FIXED' || calcMethod === 'PER_TIME_FIXED' || calcMethod === 'PER_UNIT' ? Number(fixedAmount || 0) : null,
          rate_percent: calcMethod === 'PERCENT' || calcMethod === 'PER_TIME_PERCENT' || calcMethod === 'TIERED' ? Number(ratePercent || 0) : null,
          per_unit: perUnit,
          currency,
          base_input: baseAmountInput || null,
          start_input: startInput,
          end_input: endInput,
          include_first_day: includeFirstDay,
          include_end_day: includeEndDay,
          accrual_calendar: accrualCalendar,
          working_calendar: workCalendar,
          tier_mode: tierMode,
          tiers: tierMode ? tiers.map((t) => ({ up_to: t.up_to === '' ? null : Number(t.up_to), rate_percent: Number(t.rate_percent || 0) })) : [],
          limits: { min: minLimit === '' ? null : Number(minLimit), max: maxLimit === '' ? null : Number(maxLimit), round_to: Number(roundTo || 1), rounding, order: 'LIMITS_THEN_ADJUST' },
          compound: false,
          combination,
        },
        decided: { status: decidedCalc === 'NEEDS_REFERENCE' ? 'NEEDS_REFERENCE' : 'RULE_ATTACHED' },
      }
    }
    const deadline = noDeadline
      ? { no_deadline: true, count: {}, holiday_roll: { enabled: false } }
      : {
          method: dlMethod,
          interval: dlMethod === 'INTERVAL_FROM_BASE'
            ? { value: Number(gapValue || 0), unit: gapUnit, month_application: gapUnit === 'MONTH' ? monthApplication : null, direction, base_input: baseInput || null, base: baseInput ? null : baseFixed, base_event: baseFixed === 'CASE_EVENT' && baseEventKey ? baseEventKey : null }
            : { value: 0, unit: 'DAY', direction: 'AFTER' },
          fixed_date: dlMethod === 'FIXED_DATE' ? { month: Number(fixedMonth), day: Number(fixedDay) } : {},
          fixed_in_period: dlMethod === 'FIXED_IN_PERIOD' ? { position: periodPos, n: Number(periodN || 1) } : {},
          count: { include_start: includeStart, calendar: countCalendar, month_calendar: monthCalendar, missing_day_policy: missingPolicy, timezone: tz },
          holiday_roll: { enabled: holidayRoll, calendar_id: workCalendar },
          pauses,
          extensions: extensions.map((e) => ({ days: Number(e.days || 0), months: Number(e.months || 0), scope: e.scope })),
        }
    return {
      recurrence: {
        schedule_mode: scheduleMode,
        frequency_unit: scheduleMode === 'RECURRING' ? freqUnit : null,
        frequency_interval: scheduleMode === 'RECURRING' ? Math.max(1, Math.floor(Number(freqInterval) || 1)) : null,
        period_basis: scheduleMode === 'RECURRING' ? periodBasis : null,
        period_source_key: scheduleMode === 'RECURRING' ? (periodSourceKey || null) : null,
        instance_generation_timing: scheduleMode === 'RECURRING' ? genTiming : scheduleMode === 'EVENT_DRIVEN' ? 'SOURCE_EVENT_RECEIVED' : 'MANUAL',
        event_config: scheduleMode === 'EVENT_DRIVEN' ? {
          event_key: eventKey || null,
          event_source: eventSource,
          new_instance_per_occurrence: eventNewInstance,
          prevent_duplicate: eventDedup,
          dedup_key: dedupKey || null,
        } : null,
      },
      deadline,
      reminders: reminders.map((r) => ({ offset_before: Number(r.offset_before || 0), unit: r.unit, role_key: r.role_key, channel: r.channel })),
    }
  }

  function recPageError(): string | null {
    if (scheduleMode === 'RECURRING') {
      if (!freqUnit) return 'تناوب تکرار را انتخاب کنید.'
      const n = Number(freqInterval)
      if (!Number.isInteger(n) || n < 1) return 'تکرار در هر چند دوره باید عدد صحیح بزرگ‌تر از صفر باشد.'
      if (!periodBasis) return 'مبنای تشکیل دوره را انتخاب کنید.'
      if (periodBasis === 'COMPANY_FISCAL_YEAR' && !periodSourceKey) return 'منبع سال مالی شرکت را انتخاب کنید.'
      if (periodBasis === 'SOURCE_EVENT' && !periodSourceKey) return 'رویداد منبع دوره را انتخاب کنید.'
      if (periodBasis === 'RULE_OUTPUT' && !periodSourceKey) return 'قاعده و خروجی منبع را انتخاب کنید.'
    }
    if (scheduleMode === 'EVENT_DRIVEN') {
      if (!eventKey) return 'رویداد آغازگر را از فهرست انتخاب کنید.'
      if (!eventSource) return 'منبع رویداد را انتخاب کنید.'
      if (eventDedup && !dedupKey.trim()) return 'برای جلوگیری از نمونهٔ تکراری، کلید تشخیص تکراری را تعیین کنید.'
    }
    return null
  }

  function recurrenceSummary(): string {
    if (scheduleMode === 'ONE_TIME') {
      return 'این قاعده فقط یک بار برای هر پرونده اجرا می‌شود و دورهٔ جداگانه‌ای ایجاد نمی‌کند.'
    }
    if (scheduleMode === 'EVENT_DRIVEN') {
      const ev = EVENT_OPTIONS.find((o) => o.key === eventKey)?.label ?? (eventKey ? eventKey : 'رویداد انتخاب‌شده')
      const src = EVENT_SOURCE_OPTIONS.find((o) => o.key === eventSource)?.label ?? eventSource
      const parts: string[] = [`با وقوع «${ev}» (${src}) این قاعده فعال می‌شود`]
      if (eventNewInstance) parts.push('برای هر بار وقوع نمونهٔ جدید ساخته می‌شود')
      if (eventDedup) parts.push('از نمونهٔ تکراری جلوگیری می‌شود')
      return `${parts.join('؛ ')}. موعد قانونی در صفحهٔ بعد تعیین خواهد شد.`
    }
    const freq = FREQ_OPTIONS.find((o) => o.key === freqUnit)?.label ?? freqUnit
    const basis = PERIOD_BASIS_OPTIONS.find((o) => o.key === periodBasis)?.label ?? periodBasis
    const timing = GEN_TIMING_OPTIONS.find((o) => o.key === genTiming)?.label ?? genTiming
    if (periodBasis === 'COMPANY_FISCAL_YEAR' && genTiming === 'PERIOD_END') {
      return 'برای هر سال مالی تعریف‌شده شرکت، یک دوره مستقل ایجاد می‌شود. موعد قانونی هر دوره در صفحه بعد و بر اساس پایان همان سال مالی محاسبه خواهد شد.'
    }
    return `هر ${freqInterval || '۱'} ${freq} بر اساس ${basis}، نمونهٔ تعهد در «${timing}» ساخته می‌شود. موعد قانونی هر دوره در صفحهٔ بعد تعیین خواهد شد.`
  }

  async function saveDraft() {
    if (!titleFa.trim()) return toast.error('عنوان فارسی قاعده الزامی است.')
    if (!code.trim()) setCode(suggestRuleCode(kind, titleFa))
    const finalCode = code.trim() || suggestRuleCode(kind, titleFa)
    setSaving(true)
    try {
      const newRuleId = await saveRule({
        ruleId: ruleId ?? null,
        versionId: mode === 'edit' ? versionId : null,
        kind,
        code: finalCode,
        titleFa: titleFa.trim(),
        summary: summary || null,
        domain: domain || null,
        authority: authority || null,
        legalSource: legalSource || null,
        legalClause: legalClause || null,
        nature,
        validFrom: validFrom ? jalaliToIso(validFrom) : null,
        validTo: validTo ? jalaliToIso(validTo) : null,
        definition: buildDefinition(),
        inputs,
      })
      setDirty(false)
      toast.success('پیش‌نویس قاعده ذخیره شد.')
      const createdId = newRuleId as string
      // نسخهٔ تازه‌ساخته را برای مرحلهٔ بعد نگه می‌داریم
      const fresh = await fetchRuleCenterRule(createdId)
      const draft = fresh?.versions?.find((v) => v.status === 'DRAFT')
      if (draft) {
        setSavedVersionId(draft.id)
        setVersionStatus('DRAFT')
        await loadTestsAndUsage(draft.id)
      }
      await onSaved(createdId)
    } catch (e: any) {
      toast.error(e?.message ?? 'ذخیره قاعده انجام نشد.')
    } finally {
      setSaving(false)
    }
  }

  async function loadTestsAndUsage(versionId: string) {
    const [testRows, usageRows] = await Promise.all([
      fetchRuleTests(versionId),
      fetchRuleUsage(versionId),
    ])
    setTests(testRows.map((t) => ({ id: t.id, title: t.title, status: t.status, inputs: t.inputs, expected: t.expected, actual: t.actual, created_at: t.created_at })))
    setUsage(usageRows)
  }

  async function runTest() {
    if (!savedVersionId && !versionId) return toast.error('ابتدا پیش‌نویس را ذخیره کنید.')
    const vid = (savedVersionId ?? versionId) as string
    const errors: Record<string, string> = {}
    const dateKeys = new Set<string>(['fiscal_year_end', 'period_end', 'effective_deadline', 'payment_date', 'deadline'])
    for (const i of inputs) {
      if (i.type === 'DATE' || i.type === 'DATETIME') dateKeys.add(i.key)
    }
    const requiredKeys = new Set(inputs.filter((i) => i.required === true).map((i) => i.key))
    const payload: Record<string, any> = {}
    for (const [k, v] of Object.entries(testInputs)) {
      const raw = String(v ?? '').trim()
      if (!dateKeys.has(k)) {
        const iso = raw.includes('/') ? jalaliToIso(raw) : raw
        if (iso) payload[k] = { value: iso, type: k.includes('amount') || k.includes('debt') ? 'AMOUNT' : 'DATE' }
        continue
      }
      if (!raw) {
        if (requiredKeys.has(k)) errors[k] = 'این تاریخ الزامی است.'
        else payload[k] = { value: null, type: 'DATE' }
        continue
      }
      const iso = raw.includes('/') ? jalaliToIso(raw) : raw
      if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
        errors[k] = 'تاریخ معتبر نیست.'
        continue
      }
      payload[k] = { value: iso, type: 'DATE' }
    }
    const expected: Record<string, any> = { status: 'OK' }
    if (isPenalty) {
      expected.estimated_amount = Number(expectedAmount || 0)
    } else {
      const expRaw = (expectedDeadline ?? '').trim()
      if (expRaw) {
        const expIso = jalaliToIso(expRaw)
        if (!expIso) errors['expected_deadline'] = 'تاریخ مورد انتظار معتبر نیست.'
        else expected.effective_deadline = expIso
      } else {
        expected.effective_deadline = null
      }
    }
    if (Object.keys(errors).length > 0) {
      setTestFieldErrors(errors)
      toast.error('یکی از تاریخ‌های واردشده معتبر نیست.')
      return
    }
    setTestFieldErrors({})
    setRunningTest(true)
    try {
      await runRuleTest(vid, testTitle || `آزمون ${tests.length + 1}`, payload, expected)
      toast.success('آزمون اجرا و مقایسه شد.')
      await loadTestsAndUsage(vid)
    } catch (e: any) {
      toast.error(e?.message ?? 'اجرای آزمون انجام نشد.')
    } finally {
      setRunningTest(false)
    }
  }
  async function rerunTest(t: { id: string; title: string; inputs?: Record<string, any>; expected?: Record<string, any> }) {
    const vid = (savedVersionId ?? versionId) as string
    if (!vid) return toast.error('ابتدا پیش‌نویس را ذخیره کنید.')
    setRunningTest(true)
    try {
      await runRuleTest(vid, t.title, t.inputs ?? {}, t.expected ?? { status: 'OK' })
      toast.success('آزمون دوباره اجرا شد.')
      await loadTestsAndUsage(vid)
    } catch (e: any) {
      toast.error(e?.message ?? 'اجرای مجدد آزمون انجام نشد.')
    } finally {
      setRunningTest(false)
    }
  }

  async function deleteTest(t: { id: string }) {
    if (!window.confirm('این آزمون حذف شود؟')) return
    try {
      await deleteRuleTest(t.id)
      toast.success('آزمون حذف شد.')
      const vid = (savedVersionId ?? versionId) as string
      if (vid) await loadTestsAndUsage(vid)
    } catch (e: any) {
      toast.error(e?.message ?? 'حذف آزمون انجام نشد.')
    }
  }


  async function doTransition(to: 'IN_REVIEW' | 'APPROVED' | 'PUBLISHED') {
    const vid = (savedVersionId ?? versionId) as string
    if (!vid) return toast.error('ابتدا پیش‌نویس را ذخیره کنید.')
    setTransitioning(true)
    try {
      await transitionRuleVersion(vid, to)
      toast.success(to === 'PUBLISHED' ? 'قاعده منتشر شد.' : to === 'APPROVED' ? 'نسخه تأیید شد.' : 'نسخه به بررسی رفت.')
      setVersionStatus(to)
      if (to === 'PUBLISHED') {
        const checkRes = await Promise.all(usage.filter((u) => u.status === 'ACTIVE').map((u) => rulePublishCheck(u.id)))
        setPublishChecks(checkRes.flatMap((c) => c.checks))
      }
    } catch (e: any) {
      toast.error(e?.message ?? 'انتقال وضعیت انجام نشد.')
    } finally {
      setTransitioning(false)
    }
  }

  const pages = useMemo(() => {
    if (isPenalty) {
      return [
        { key: 'spec', title: 'مشخصات و مبنای قانونی' },
        { key: 'cond', title: 'شرایط تعلق' },
        { key: 'calc', title: 'روش محاسبه' },
        { key: 'time', title: 'زمان، حدود و تعدیل' },
        { key: 'io', title: 'ورودی‌ها و محل‌های استفاده' },
        { key: 'test', title: 'آزمایش و تأیید' },
      ]
    }
    return [
      { key: 'spec', title: 'مشخصات و کاربرد' },
      { key: 'rec', title: 'تناوب و دوره‌سازی' },
      { key: 'dl', title: 'روش تعیین موعد' },
      { key: 'count', title: 'شمارش و استثناها' },
      { key: 'io', title: 'ورودی‌ها، استفاده و یادآوری' },
      { key: 'test', title: 'آزمایش و تأیید' },
    ]
  }, [isPenalty])

  if (loading) {
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70">
        <div className="flex items-center gap-2 text-zinc-300"><Loader2 className="h-5 w-5 animate-spin" />در حال بارگذاری قاعده...</div>
      </div>
    )
  }

  const usableVersionId = savedVersionId ?? versionId ?? null

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-zinc-700 bg-[#121412] p-6 shadow-2xl" dir="rtl">
        {/* سربرگ */}
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-zinc-100">
              {mode === 'create' ? `تعریف قاعدهٔ ${isPenalty ? 'جریمه' : 'مهلت/تناوب'}` : mode === 'newversion' ? 'ایجاد نسخه جدید' : 'ویرایش پیش‌نویس'} — {titleFa || 'بدون عنوان'}
            </h3>
            <p className="mt-1 text-xs text-zinc-400">
              {isPenalty ? 'جریمه از نظر تعریف و محاسبه مستقل است و می‌تواند از موعد مؤثر یک قاعدهٔ مهلت استفاده کند.' : 'تناوب و مهلت دو بخش جدا هستند؛ اقدام بدون تکرار به تناوب مجبور نمی‌شود.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {versionStatus && (
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${versionStatus === 'PUBLISHED' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60' : versionStatus === 'STOPPED' ? 'bg-zinc-800 text-zinc-300 border border-zinc-600' : 'bg-amber-950/80 text-amber-300 border border-amber-800/60'}`}>
                {versionStatus === 'DRAFT' ? 'پیش‌نویس' : versionStatus === 'IN_REVIEW' ? 'در بررسی' : versionStatus === 'APPROVED' ? 'تأییدشده' : versionStatus === 'PUBLISHED' ? 'منتشرشده' : 'متوقف'}
              </span>
            )}
            <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
          </div>
        </div>

        {/* نوار مراحل */}
        <div className="mb-6 flex flex-wrap items-center gap-1.5">
          {pages.map((p, i) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setStepIndex(i)}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${i === stepIndex ? 'bg-amber-600 text-white' : i < stepIndex ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40' : 'border border-zinc-700 text-zinc-400'}`}
            >
              {i + 1}. {p.title}
            </button>
          ))}
        </div>

        {/* محتوا */}
        {stepIndex === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FieldLabel>عنوان فارسی *</FieldLabel>
              <input className={inputCls} value={titleFa} onChange={(e) => { setTitleFa(e.target.value); setDirty(true) }} placeholder="مثال: جریمهٔ تأخیر در پرداخت هزینهٔ مجوز (فقط مثال)" />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>شرح کوتاه</FieldLabel>
              <textarea className={inputCls} rows={2} value={summary} onChange={(e) => { setSummary(e.target.value); setDirty(true) }} />
            </div>
            <div>
              <FieldLabel>ماهیت</FieldLabel>
              <select className={inputCls} value={nature} onChange={(e) => { setNature(e.target.value as any); setDirty(true) }}>
                <option value="INTERNAL">هدف داخلی</option>
                <option value="LEGAL">قانونی</option>
              </select>
            </div>
            <div>
              <FieldLabel>حوزه</FieldLabel>
              <input className={inputCls} value={domain} onChange={(e) => { setDomain(e.target.value); setDirty(true) }} placeholder="مثال: مالیات (برای جست‌وجو؛ منطق محاسبه را محدود نمی‌کند)" />
            </div>
            <div>
              <FieldLabel>مرجع</FieldLabel>
              <input className={inputCls} value={authority} onChange={(e) => { setAuthority(e.target.value); setDirty(true) }} />
            </div>
            <div>
              <FieldLabel>کلید فنی</FieldLabel>
              <input className={inputCls} dir="ltr" value={code} onChange={(e) => { setCode(e.target.value); setDirty(true) }} placeholder={suggestRuleCode(kind, titleFa || 'RULE')} />
            </div>
            {nature === 'LEGAL' && (
              <>
                <div>
                  <FieldLabel>منبع قانونی *</FieldLabel>
                  <input className={inputCls} value={legalSource} onChange={(e) => { setLegalSource(e.target.value); setDirty(true) }} placeholder="قانون، ماده…" />
                </div>
                <div>
                  <FieldLabel>بند مرتبط</FieldLabel>
                  <input className={inputCls} value={legalClause} onChange={(e) => { setLegalClause(e.target.value); setDirty(true) }} />
                </div>
              </>
            )}
            <div>
              <FieldLabel>شروع اعتبار قانونی</FieldLabel>
              <JalaliDatePicker value={validFrom} onChange={(v) => { setValidFrom(v); setDirty(true) }} size="sm" />
            </div>
            <div>
              <FieldLabel>پایان اعتبار قانونی (خالی = باز)</FieldLabel>
              <JalaliDatePicker value={validTo} onChange={(v) => { setValidTo(v); setDirty(true) }} size="sm" />
            </div>
            <p className="sm:col-span-2 text-[11px] leading-5 text-zinc-500">
              تاریخ اعتبار قانون با زمان انتشار در پلتفرم متفاوت است؛ تاریخ ملاک انتخاب نسخه صریح است (اتصال به نسخهٔ مشخص، نه «آخرین نسخه»).
            </p>
          </div>
        )}

        {stepIndex === 1 && !isPenalty && (
          <div className="space-y-5">
            <div>
              <h4 className="text-sm font-bold text-zinc-100">الگوی تکرار و ایجاد دوره</h4>
              <p className="mt-1 text-[11px] leading-5 text-zinc-500">
                مشخص کنید این تعهد چند بار تکرار می‌شود و هر دوره بر اساس چه اطلاعاتی ایجاد می‌شود. تاریخ سررسید در صفحه بعد تعیین خواهد شد.
              </p>
            </div>

            {/* نوع اجرای قاعده */}
            <div className="grid gap-3 sm:grid-cols-3">
              {EXECUTION_MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => { setScheduleMode(m.key); setRecError(''); setDirty(true) }}
                  className={`rounded-xl border p-4 text-right transition ${scheduleMode === m.key ? 'border-amber-500/70 bg-amber-950/20' : 'border-zinc-800 bg-[#141615] hover:border-zinc-600'}`}
                >
                  <p className={`text-xs font-bold ${scheduleMode === m.key ? 'text-amber-300' : 'text-zinc-200'}`}>{m.label}</p>
                  <p className="mt-1.5 text-[11px] leading-5 text-zinc-500">{m.desc}</p>
                </button>
              ))}
            </div>

            {scheduleMode === 'RECURRING' && (
              <div className="grid gap-4 rounded-2xl border border-zinc-800 bg-[#101211] p-5 sm:grid-cols-2">
                <div>
                  <FieldLabel>تناوب تکرار</FieldLabel>
                  <select className={inputCls} value={freqUnit} onChange={(e) => { setFreqUnit(e.target.value); setRecError(''); setDirty(true) }}>
                    {FREQ_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <FieldLabel>تکرار در هر چند دوره</FieldLabel>
                  <input className={inputCls} type="number" min="1" step="1" dir="ltr" value={freqInterval} onChange={(e) => { setFreqInterval(e.target.value); setRecError(''); setDirty(true) }} />
                  <p className="mt-1 text-[11px] text-zinc-500">نمونه: هر {freqInterval || '—'} {freqUnit === 'DAY' ? 'روز' : freqUnit === 'WEEK' ? 'هفته' : freqUnit === 'MONTH' ? 'ماه' : freqUnit === 'QUARTER' ? 'سه‌ماهه' : freqUnit === 'HALF_YEAR' ? 'شش‌ماهه' : freqUnit === 'YEAR' ? 'سال' : 'دوره سفارشی'}</p>
                </div>
                <div>
                  <FieldLabel>مبنای تشکیل دوره</FieldLabel>
                  <select className={inputCls} value={periodBasis} onChange={(e) => { setPeriodBasis(e.target.value); setPeriodSourceKey(''); setRecError(''); setDirty(true) }}>
                    {PERIOD_BASIS_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <FieldLabel>منبع دوره</FieldLabel>
                  {periodBasis === 'COMPANY_FISCAL_YEAR' && (
                    <div className="space-y-1">
                      <select className={inputCls} value={periodSourceKey} onChange={(e) => { setPeriodSourceKey(e.target.value); setRecError(''); setDirty(true) }}>
                        <option value="">— انتخاب منبع —</option>
                        <option value="case_fiscal_year">سال مالی منتخب پرونده</option>
                      </select>
                      <p className="text-[11px] leading-5 text-zinc-500">دوره از سال مالی واقعی همان پروندهٔ شرکت خوانده می‌شود؛ شروع سال مالی هر شرکت جدا است (لزوماً فروردین نیست) و تغییر آن در دوره‌های بعد، دوره‌های قبلی را تغییر نمی‌دهد.</p>
                    </div>
                  )}
                  {periodBasis === 'SOURCE_EVENT' && (
                    <div className="space-y-1">
                      <select className={inputCls} value={periodSourceKey} onChange={(e) => { setPeriodSourceKey(e.target.value); setRecError(''); setDirty(true) }}>
                        <option value="">— انتخاب رویداد —</option>
                        {EVENT_OPTIONS.map((o) => <option key={o.key} value={`case_event:${o.key}`}>{o.label}</option>)}
                      </select>
                      <p className="text-[11px] text-zinc-500">رویداد از فهرست رویدادهای ثبت‌شده انتخاب می‌شود؛ ورود دستی نام رویداد مجاز نیست.</p>
                    </div>
                  )}
                  {periodBasis === 'RULE_OUTPUT' && (
                    <div className="space-y-1">
                      <select className={inputCls} value={periodSourceKey} onChange={(e) => { setPeriodSourceKey(e.target.value); setRecError(''); setDirty(true) }}>
                        <option value="">— انتخاب قاعده و خروجی —</option>
                        {rulesForOutput.map((r) => (
                          <optgroup key={r.id} label={`${r.title_fa} (${r.code})`}>
                            <option value={`${r.id}::PERIOD_END`}>پایان دورهٔ محاسبه‌شده</option>
                            <option value={`${r.id}::PERIOD_START`}>شروع دورهٔ محاسبه‌شده</option>
                            <option value={`${r.id}::DEADLINE`}>موعد محاسبه‌شده</option>
                          </optgroup>
                        ))}
                      </select>
                      <p className="text-[11px] text-zinc-500">اتصال با شناسهٔ پایدار قاعده ذخیره می‌شود، نه عنوان آن. وابستگی حلقوی در محل اتصال رد می‌شود.</p>
                    </div>
                  )}
                  {(periodBasis === 'CALENDAR_YEAR' || periodBasis === 'CALENDAR_MONTH' || periodBasis === 'CASE_PERIOD') && (
                    <p className="rounded-lg border border-zinc-800 bg-[#141615] px-3 py-2 text-[11px] leading-5 text-zinc-400">
                      {periodBasis === 'CALENDAR_YEAR' ? 'دوره‌ها بر اساس سال تقویمی انتخابی (شمسی/میلادی) خوانده می‌شوند.' : periodBasis === 'CALENDAR_MONTH' ? 'دوره‌ها بر اساس ماه‌های تقویم انتخابی شکل می‌گیرند.' : 'دوره از دورهٔ پروندهٔ همان شرکت خوانده می‌شود.'}
                    </p>
                  )}
                </div>
                <div>
                  <FieldLabel>زمان ایجاد نمونهٔ تعهد</FieldLabel>
                  <select className={inputCls} value={genTiming} onChange={(e) => { setGenTiming(e.target.value); setRecError(''); setDirty(true) }}>
                    {GEN_TIMING_OPTIONS.map((o) => (
                      <option key={o.key} value={o.key} disabled={o.eventBased && periodBasis !== 'SOURCE_EVENT' && periodBasis !== 'RULE_OUTPUT'}>{o.label}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-zinc-500">زمان ساخت نمونهٔ تعهد است و با تاریخ سررسید (صفحهٔ بعد) اشتباه نشود.</p>
                </div>
              </div>
            )}

            {scheduleMode === 'EVENT_DRIVEN' && (
              <div className="grid gap-4 rounded-2xl border border-zinc-800 bg-[#101211] p-5 sm:grid-cols-2">
                <div>
                  <FieldLabel>رویداد آغازگر</FieldLabel>
                  <select className={inputCls} value={eventKey} onChange={(e) => { setEventKey(e.target.value); setRecError(''); setDirty(true) }}>
                    <option value="">— انتخاب رویداد —</option>
                    {EVENT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                  </select>
                  <p className="mt-1 text-[11px] text-zinc-500">رویداد از منابع واقعی سامانه انتخاب می‌شود؛ ورود متن آزاد برای شناسهٔ رویداد مجاز نیست.</p>
                </div>
                <div>
                  <FieldLabel>منبع رویداد</FieldLabel>
                  <select className={inputCls} value={eventSource} onChange={(e) => { setEventSource(e.target.value); setRecError(''); setDirty(true) }}>
                    {EVENT_SOURCE_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                  <input type="checkbox" checked={eventNewInstance} onChange={(e) => { setEventNewInstance(e.target.checked); setRecError(''); setDirty(true) }} className="accent-amber-500" />
                  برای هر بار وقوع رویداد، نمونهٔ جدید ساخته شود
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                  <input type="checkbox" checked={eventDedup} onChange={(e) => { setEventDedup(e.target.checked); setRecError(''); setDirty(true) }} className="accent-amber-500" />
                  جلوگیری از ایجاد نمونهٔ تکراری
                </label>
                {eventDedup && (
                  <div className="sm:col-span-2">
                    <FieldLabel>کلید تشخیص تکراری بودن</FieldLabel>
                    <input className={inputCls} dir="ltr" value={dedupKey} onChange={(e) => { setDedupKey(e.target.value); setRecError(''); setDirty(true) }} placeholder="مثال: case_id|event_key|occurred_date" />
                    <p className="mt-1 text-[11px] text-zinc-500">دریافت دوبارهٔ همان رویداد، نوبت/جریمه/یادآوری تکراری نمی‌سازد.</p>
                  </div>
                )}
              </div>
            )}

            {/* خلاصهٔ زنده */}
            <div className="rounded-xl border border-zinc-800 bg-[#141615] p-4">
              <p className="text-[11px] font-bold text-zinc-400">خلاصه</p>
              <p className="mt-1.5 text-xs leading-6 text-zinc-200">{recurrenceSummary()}</p>
            </div>

            {recError && (
              <p className="flex items-center gap-1.5 rounded-lg border border-red-900/50 bg-red-950/10 px-3 py-2 text-xs text-red-300">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {recError}
              </p>
            )}
          </div>
        )}

        {stepIndex === 1 && isPenalty && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <FieldLabel>منطق شروط</FieldLabel>
              <select className={inputCls + ' max-w-52'} value={condLogic} onChange={(e) => { setCondLogic(e.target.value as any); setDirty(true) }}>
                <option value="ALL">همهٔ شرط‌ها (AND)</option>
                <option value="ANY">حداقل یکی از شرط‌ها (OR)</option>
              </select>
            </div>
            <Card title="شرایط تعلق (فیلد واقعی + عملگر + مقدار)">
              {clauses.length === 0 && <p className="mb-3 text-xs text-zinc-500">بدون شرط — جریمه در همهٔ موارد مطرح می‌شود (برای آزمون).</p>}
              <div className="space-y-3">
                {clauses.map((c, i) => (
                  <div key={i} className="grid gap-2 rounded-lg border border-zinc-800 bg-[#141615] p-3 sm:grid-cols-[1.2fr,1fr,1fr,auto]">
                    <input className={inputCls} placeholder="کلید فیلد (مثل debt_amount)" dir="ltr" value={c.field_key} onChange={(e) => { const next = [...clauses]; next[i] = { ...c, field_key: e.target.value }; setClauses(next); setDirty(true) }} />
                    <input className={inputCls} placeholder="عنوان فارسی فیلد" value={c.field_label} onChange={(e) => { const next = [...clauses]; next[i] = { ...c, field_label: e.target.value }; setClauses(next); setDirty(true) }} />
                    <div className="flex gap-2">
                      <select className={inputCls} value={c.operator} onChange={(e) => { const next = [...clauses]; next[i] = { ...c, operator: e.target.value }; setClauses(next); setDirty(true) }}>
                        {['EQ', 'NE', 'GT', 'GTE', 'LT', 'LTE', 'IN', 'IS_SET'].map((op) => <option key={op} value={op}>{op}</option>)}
                      </select>
                      <input className={inputCls} dir="ltr" value={c.value} onChange={(e) => { const next = [...clauses]; next[i] = { ...c, value: e.target.value }; setClauses(next); setDirty(true) }} placeholder="مقدار" />
                    </div>
                    <Button variant="ghost" size="icon" className="text-red-400" onClick={() => { setClauses(clauses.filter((_, j) => j !== i)); setDirty(true) }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="mt-3 border-zinc-700 text-zinc-300 gap-1.5 text-xs" onClick={() => { setClauses([...clauses, { field_key: '', field_label: '', operator: 'GT', value: '' }]); setDirty(true) }}>
                <Plus className="h-3.5 w-3.5" /> افزودن شرط
              </Button>
              <p className="mt-2 text-[11px] text-zinc-500">اطلاعات نامعلوم با «خیر» یکسان نیست؛ نبود داده، نتیجهٔ «قابل تعیین نیست» ایجاد می‌کند، نه جریمهٔ صفر.</p>
            </Card>
          </div>
        )}

        {stepIndex === 2 && !isPenalty && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                <input type="checkbox" checked={noDeadline} onChange={(e) => { setNoDeadline(e.target.checked); setDirty(true) }} className="accent-amber-500" />
                این اتصال مهلت ندارد (بدون مهلت — صفر به معنی بدون مهلت نیست)
              </label>
            </div>
            {!noDeadline && (
              <>
                <div>
                  <FieldLabel>روش تعیین موعد</FieldLabel>
                  <select className={inputCls} value={dlMethod} onChange={(e) => { setDlMethod(e.target.value); setDirty(true) }}>
                    <option value="INTERVAL_FROM_BASE">فاصله از تاریخ/رویداد</option>
                    <option value="FIXED_DATE">تاریخ مشخص در هر دوره</option>
                    <option value="FIXED_IN_PERIOD">تاریخ مشخص در دوره (پایان/شروع)</option>
                    <option value="MULTIPLE_CHOOSE">انتخاب از چند موعد (زودتر/دیرتر)</option>
                  </select>
                </div>
                {dlMethod === 'INTERVAL_FROM_BASE' && (
                  <>
                    {gapUnit === 'MONTH' && (
                      <div className="sm:col-span-2">
                        <FieldLabel>روش اعمال ماه</FieldLabel>
                        <select className={inputCls} value={monthApplication} onChange={(e) => { setMonthApplication(e.target.value); setDirty(true) }}>
                          <option value="SAME_DAY_AFTER_N_MONTHS">تاریخ متناظر پس از N ماه</option>
                          <option value="END_OF_NTH_MONTH_AFTER_EVENT">پایان ماه N‌ام پس از رویداد</option>
                          <option value="START_OF_NTH_MONTH_AFTER_EVENT">آغاز ماه N‌ام پس از رویداد</option>
                        </select>
                      </div>
                    )}
                    <div>
                      <FieldLabel>مبدأ محاسبه</FieldLabel>
                      <select className={inputCls} value={baseInput || baseFixed} onChange={(e) => { const v = e.target.value; if (v.startsWith('INPUT:')) { setBaseInput(v.slice(6)); setBaseFixed('') } else { setBaseInput(''); setBaseFixed(v) } setDirty(true) }}>
                        <option value="PERIOD_START">شروع دورهٔ تشکیل‌شده</option>
                        <option value="PERIOD_END">پایان دورهٔ تشکیل‌شده</option>
                        <option value="FISCAL_YEAR_START">شروع سال مالی پرونده</option>
                        <option value="FISCAL_YEAR_END">پایان سال مالی پرونده</option>
                        <option value="CASE_EVENT">رویداد ثبت‌شده پرونده</option>
                        {inputs.map((i) => <option key={`INPUT:${i.key}`} value={`INPUT:${i.key}`}>ورودی: {i.label}</option>)}
                      </select>
                    </div>
                    {!baseInput && baseFixed === 'CASE_EVENT' && (
                      <div>
                        <FieldLabel>رویداد آغازگر (ساختاریافته)</FieldLabel>
                        <select className={inputCls} value={baseEventKey} onChange={(e) => { setBaseEventKey(e.target.value); setDirty(true) }}>
                          <option value="">— انتخاب رویداد —</option>
                          {EVENT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                        </select>
                        <p className="mt-1 text-[11px] text-zinc-500">مبدأ از فهرست رویدادهای ثبت‌شده انتخاب می‌شود؛ متن آزاد مجاز نیست.</p>
                      </div>
                    )}
                    <div>
                      <FieldLabel>فاصله و واحد</FieldLabel>
                      <div className="flex gap-2">
                        <input className={inputCls} type="number" min="0" dir="ltr" value={gapValue} onChange={(e) => { setGapValue(e.target.value); setDirty(true) }} />
                        <select className={inputCls} value={gapUnit} onChange={(e) => { setGapUnit(e.target.value); setDirty(true) }}>
                          <option value="DAY">روز</option>
                          <option value="MONTH">ماه (شمسی)</option>
                          <option value="YEAR">سال (شمسی)</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <FieldLabel>جهت فاصله</FieldLabel>
                      <select className={inputCls} value={direction} onChange={(e) => { setDirection(e.target.value); setDirty(true) }}>
                        <option value="AFTER">پس از</option>
                        <option value="BEFORE">پیش از (پیشرفته)</option>
                      </select>
                    </div>
                  </>
                )}
                {dlMethod === 'FIXED_DATE' && (
                  <>
                    <div>
                      <FieldLabel>ماه (شمسی)</FieldLabel>
                      <input className={inputCls} type="number" min="1" max="12" dir="ltr" value={fixedMonth} onChange={(e) => { setFixedMonth(e.target.value); setDirty(true) }} />
                    </div>
                    <div>
                      <FieldLabel>روز</FieldLabel>
                      <input className={inputCls} type="number" min="1" max="31" dir="ltr" value={fixedDay} onChange={(e) => { setFixedDay(e.target.value); setDirty(true) }} />
                    </div>
                  </>
                )}
                {dlMethod === 'FIXED_IN_PERIOD' && (
                  <>
                    <div>
                      <FieldLabel>موقعیت در دوره</FieldLabel>
                      <select className={inputCls} value={periodPos} onChange={(e) => { setPeriodPos(e.target.value); setDirty(true) }}>
                        <option value="END">پایان دوره</option>
                        <option value="START">شروع دوره</option>
                        <option value="NTH_DAY">روز N ام دوره</option>
                      </select>
                    </div>
                    {periodPos === 'NTH_DAY' && (
                      <div>
                        <FieldLabel>N</FieldLabel>
                        <input className={inputCls} type="number" min="1" dir="ltr" value={periodN} onChange={(e) => { setPeriodN(e.target.value); setDirty(true) }} />
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {stepIndex === 2 && isPenalty && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel>روش محاسبه</FieldLabel>
                <select className={inputCls} value={calcMethod} onChange={(e) => { setCalcMethod(e.target.value); setDirty(true) }}>
                  <option value="FIXED">مبلغ ثابت</option>
                  <option value="PERCENT">درصد از مبلغ مبنا</option>
                  <option value="PER_TIME_FIXED">مبلغ ثابت به ازای واحد زمان</option>
                  <option value="PER_TIME_PERCENT">درصد به ازای واحد زمان</option>
                  <option value="PER_UNIT">مبلغ به ازای تعداد/واحد</option>
                  <option value="TIERED">محاسبه پلکانی</option>
                  <option value="COMBINED">ترکیب چند جزء</option>
                  <option value="REFERENCE_DECIDED">مبلغ تعیین‌شده توسط مرجع</option>
                </select>
              </div>
              <div>
                <FieldLabel>واحد پول</FieldLabel>
                <select className={inputCls} value={currency} onChange={(e) => { setCurrency(e.target.value); setDirty(true) }}>
                  <option value="ریال">ریال</option>
                  <option value="تومان">تومان</option>
                </select>
              </div>
            </div>
            {['FIXED', 'PER_TIME_FIXED', 'PER_UNIT'].includes(calcMethod) && (
              <div>
                <FieldLabel>{calcMethod === 'PER_UNIT' ? 'مبلغ به ازای هر واحد' : calcMethod === 'PER_TIME_FIXED' ? `مبلغ ثابت به ازای هر ${perUnit}` : 'مبلغ ثابت'}</FieldLabel>
                <input className={inputCls} type="number" min="0" dir="ltr" value={fixedAmount} onChange={(e) => { setFixedAmount(e.target.value); setDirty(true) }} />
              </div>
            )}
            {['PERCENT', 'PER_TIME_PERCENT'].includes(calcMethod) && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel>نرخ (٪)</FieldLabel>
                  <input className={inputCls} type="number" min="0" dir="ltr" value={ratePercent} onChange={(e) => { setRatePercent(e.target.value); setDirty(true) }} />
                </div>
                <div>
                  <FieldLabel>ورودی مبلغ مبنا</FieldLabel>
                  <select className={inputCls} value={baseAmountInput} onChange={(e) => { setBaseAmountInput(e.target.value); setDirty(true) }}>
                    <option value="">— انتخاب ورودی —</option>
                    {inputs.filter((i) => i.type === 'AMOUNT' || i.type === 'NUMBER').map((i) => <option key={i.key} value={i.key}>{i.label} ({i.key})</option>)}
                  </select>
                </div>
              </div>
            )}
            {calcMethod === 'PER_TIME_FIXED' && (
              <div>
                <FieldLabel>واحد زمان</FieldLabel>
                <select className={inputCls} value={perUnit} onChange={(e) => { setPerUnit(e.target.value); setDirty(true) }}>
                  <option value="DAY">روز</option>
                  <option value="MONTH">ماه</option>
                </select>
              </div>
            )}
            {calcMethod === 'TIERED' && (
              <Card title="پله‌ها (نرخ هر بخش / نرخ یک پله بر کل مبلغ)">
                <div className="mb-2 flex items-center gap-3 text-xs">
                  <span className="text-zinc-400">نحوه اعمال:</span>
                  <select className={inputCls + ' max-w-60'} value={tierMode} onChange={(e) => { setTierMode(e.target.value); setDirty(true) }}>
                    <option value="BRACKET">نرخ هر بخش (مبلغ داخل هر پله)</option>
                    <option value="WHOLE">نرخ یک پله بر کل مبلغ</option>
                  </select>
                </div>
                <div className="space-y-2">
                  {tiers.map((t, i) => (
                    <div key={i} className="grid gap-2 sm:grid-cols-[1fr,1fr,auto]">
                      <input className={inputCls} dir="ltr" placeholder="تا مبلغ (خالی = بدون سقف)" value={t.up_to} onChange={(e) => { const next = [...tiers]; next[i] = { ...t, up_to: e.target.value }; setTiers(next); setDirty(true) }} />
                      <input className={inputCls} dir="ltr" placeholder="نرخ ٪" value={t.rate_percent} onChange={(e) => { const next = [...tiers]; next[i] = { ...t, rate_percent: e.target.value }; setTiers(next); setDirty(true) }} />
                      <Button variant="ghost" size="icon" className="text-red-400" onClick={() => { setTiers(tiers.filter((_, j) => j !== i)); setDirty(true) }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
                <Button variant="outline" className="mt-2 border-zinc-700 text-zinc-300 gap-1.5 text-xs" onClick={() => { setTiers([...tiers, { up_to: '', rate_percent: '' }]); setDirty(true) }}><Plus className="h-3.5 w-3.5" /> پله</Button>
              </Card>
            )}
            {calcMethod === 'REFERENCE_DECIDED' && (
              <p className="rounded-lg border border-amber-900/50 bg-amber-950/10 p-3 text-xs text-amber-300">
                مبلغ به تشخیص مرجع؛ سامانه مبلغ نهایی نمی‌سازد و فقط «نیازمند تصمیم مرجع» یا مبلغ ثبت‌شدهٔ رسمی را نگه می‌دارد.
              </p>
            )}
            <p className="text-[11px] text-zinc-500">فرمول آزاد، SQL یا کد اجرایی در اختیار ادمین عمومی قرار نمی‌گیرد.</p>
          </div>
        )}

        {stepIndex === 3 && !isPenalty && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel>تقویم شمارش روزها</FieldLabel>
              <select className={inputCls} value={countCalendar} onChange={(e) => { setCountCalendar(e.target.value); setDirty(true) }}>
                <option value="CALENDAR_DAYS">روز تقویمی</option>
                <option value="WORKING_DAYS">روز کاری (با تقویم کاری)</option>
              </select>
            </div>
            <div>
              <FieldLabel>تقویم عملیات ماه/سال</FieldLabel>
              <select className={inputCls} value={monthCalendar} onChange={(e) => { setMonthCalendar(e.target.value); setDirty(true) }}>
                <option value="iran_solar">شمسی</option>
                <option value="gregorian">میلادی</option>
              </select>
            </div>
            <div>
              <FieldLabel>شمارش روز مبدأ</FieldLabel>
              <select className={inputCls} value={String(includeStart)} onChange={(e) => { setIncludeStart(e.target.value === 'true'); setDirty(true) }}>
                <option value="false">روز مبدأ شمرده نمی‌شود</option>
                <option value="true">روز مبدأ شمرده می‌شود</option>
              </select>
            </div>
            <div>
              <FieldLabel>منطقه زمانی (تاریخ‌وساعت)</FieldLabel>
              <select className={inputCls} value={tz} onChange={(e) => { setTz(e.target.value); setDirty(true) }}>
                <option value="Asia/Tehran">تهران</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
            <div>
              <FieldLabel>روز ناموجود در ماه مقصد</FieldLabel>
              <select className={inputCls} value={missingPolicy} onChange={(e) => { setMissingPolicy(e.target.value); setDirty(true) }}>
                <option value="LAST_DAY">آخرین روز ماه مقصد</option>
                <option value="ERROR">خطا (نامعتبر)</option>
                <option value="FIRST_DAY_NEXT">اولین روز ماه بعد</option>
              </select>
            </div>
            <div>
              <FieldLabel>تقویم کاری</FieldLabel>
              <select className={inputCls} value={workCalendar} onChange={(e) => { setWorkCalendar(e.target.value); setDirty(true) }}>
                <option value="iran_official">تقویم کاری مرجع</option>
              </select>
            </div>
            <div>
              <label className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                <input type="checkbox" checked={holidayRoll} onChange={(e) => { setHolidayRoll(e.target.checked); setDirty(true) }} className="accent-amber-500" />
                اصلاح روز آخرِ تعطیل (انتقال به روز کاری بعد)
              </label>
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>بازه‌های توقف شمارش (ورودی‌های شروع/پایان)</FieldLabel>
              <div className="space-y-2">
                {pauses.map((p, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-[1fr,1fr,auto]">
                    <input className={inputCls} dir="ltr" placeholder="کلید ورودی شروع توقف" value={p.start_input} onChange={(e) => { const next = [...pauses]; next[i] = { ...p, start_input: e.target.value }; setPauses(next); setDirty(true) }} />
                    <input className={inputCls} dir="ltr" placeholder="کلید ورودی پایان توقف" value={p.end_input} onChange={(e) => { const next = [...pauses]; next[i] = { ...p, end_input: e.target.value }; setPauses(next); setDirty(true) }} />
                    <Button variant="ghost" size="icon" className="text-red-400" onClick={() => { setPauses(pauses.filter((_, j) => j !== i)); setDirty(true) }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="mt-2 border-zinc-700 text-zinc-300 gap-1.5 text-xs" onClick={() => { setPauses([...pauses, { start_input: '', end_input: '' }]); setDirty(true) }}><Plus className="h-3.5 w-3.5" /> بازه توقف</Button>
              <p className="mt-1.5 text-[11px] text-zinc-500">بازه‌های هم‌پوشان یک بار شمرده می‌شوند (ادغام خودکار).</p>
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>تمدیدها (دامنه، روز، ماه)</FieldLabel>
              <div className="space-y-2">
                {extensions.map((e, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-[1fr,1fr,1fr,auto]">
                    <select className={inputCls} value={e.scope} onChange={(ev) => { const next = [...extensions]; next[i] = { ...e, scope: ev.target.value }; setExtensions(next); setDirty(true) }}>
                      {['COMPANY', 'GROUP', 'OBLIGATION', 'VERSION', 'PERIOD', 'CASE'].map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <input className={inputCls} dir="ltr" placeholder="روز" value={e.days} onChange={(ev) => { const next = [...extensions]; next[i] = { ...e, days: ev.target.value }; setExtensions(next); setDirty(true) }} />
                    <input className={inputCls} dir="ltr" placeholder="ماه (شمسی)" value={e.months} onChange={(ev) => { const next = [...extensions]; next[i] = { ...e, months: ev.target.value }; setExtensions(next); setDirty(true) }} />
                    <Button variant="ghost" size="icon" className="text-red-400" onClick={() => { setExtensions(extensions.filter((_, j) => j !== i)); setDirty(true) }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="mt-2 border-zinc-700 text-zinc-300 gap-1.5 text-xs" onClick={() => { setExtensions([...extensions, { days: '0', months: '0', scope: 'CASE' }]); setDirty(true) }}><Plus className="h-3.5 w-3.5" /> تمدید</Button>
              <p className="mt-1.5 text-[11px] text-zinc-500">تمدید تعریف اصلی قاعده را بازنویسی نمی‌کند؛ موعد اولیه، موعد اصلاح‌شده و دلیل جدا نگه داشته می‌شوند.</p>
            </div>
          </div>
        )}

        {stepIndex === 3 && isPenalty && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel>شروع محاسبه</FieldLabel>
              <select className={inputCls} value={startInput} onChange={(e) => { setStartInput(e.target.value); setDirty(true) }}>
                <option value="effective_deadline">موعد مؤثر (از قاعدهٔ مهلت)</option>
                <option value="case_event">رویداد مشخص</option>
              </select>
              {startInput === 'case_event' && (
                <p className="mt-1.5 text-[11px] text-zinc-500">مبدأ جریمه از موعد مؤثر خوانده می‌شود؛ مدت داخل جریمه دوباره تایپ نمی‌شود. حالت دیگر فقط با منبع صریح.</p>
              )}
            </div>
            <div>
              <FieldLabel>پایان محاسبه</FieldLabel>
              <select className={inputCls} value={endInput} onChange={(e) => { setEndInput(e.target.value); setDirty(true) }}>
                <option value="payment_date">تاریخ پرداخت/انجام</option>
                <option value="calc_date">تاریخ محاسبهٔ برآورد</option>
              </select>
            </div>
            <div>
              <FieldLabel>شمارش روز موعد (اولین روز)</FieldLabel>
              <select className={inputCls} value={String(includeFirstDay)} onChange={(e) => { setIncludeFirstDay(e.target.value === 'true'); setDirty(true) }}>
                <option value="false">روز موعد شمرده نمی‌شود (شروع از روز بعد)</option>
                <option value="true">روز موعد نیز شمرده می‌شود</option>
              </select>
            </div>
            <div>
              <FieldLabel>روز انجام کار</FieldLabel>
              <select className={inputCls} value={String(includeEndDay)} onChange={(e) => { setIncludeEndDay(e.target.value === 'true'); setDirty(true) }}>
                <option value="false">روز انجام/پرداخت شمرده نمی‌شود</option>
                <option value="true">روز انجام/پرداخت شمرده می‌شود</option>
              </select>
            </div>
            <div>
              <FieldLabel>روز تقویمی یا کاری</FieldLabel>
              <select className={inputCls} value={accrualCalendar} onChange={(e) => { setAccrualCalendar(e.target.value); setDirty(true) }}>
                <option value="CALENDAR_DAYS">روز تقویمی</option>
                <option value="WORKING_DAYS">روز کاری</option>
              </select>
            </div>
            <div>
              <FieldLabel>روش اجتماع چند جریمه</FieldLabel>
              <select className={inputCls} value={combination} onChange={(e) => { setCombination(e.target.value); setDirty(true) }}>
                <option value="SUM">جمع</option>
                <option value="MAX">بیشترین</option>
                <option value="ONE">انتخاب یکی</option>
                <option value="EXCLUSIVE">منع اجتماع</option>
              </select>
              <p className="mt-1.5 text-[11px] text-zinc-500">اتصال چند قاعده به‌خودی‌خود مجوز جمع همهٔ مبالغ نیست.</p>
            </div>
            <div>
              <FieldLabel>حداقل مبلغ</FieldLabel>
              <input className={inputCls} type="number" min="0" dir="ltr" value={minLimit} onChange={(e) => { setMinLimit(e.target.value); setDirty(true) }} />
            </div>
            <div>
              <FieldLabel>حداکثر مبلغ</FieldLabel>
              <input className={inputCls} type="number" min="0" dir="ltr" value={maxLimit} onChange={(e) => { setMaxLimit(e.target.value); setDirty(true) }} />
            </div>
            <div>
              <FieldLabel>گردکردن</FieldLabel>
              <select className={inputCls} value={rounding} onChange={(e) => { setRounding(e.target.value); setDirty(true) }}>
                <option value="UP">به بالا</option>
                <option value="DOWN">به پایین</option>
                <option value="NEAREST">نزدیک‌ترین</option>
              </select>
            </div>
            <div>
              <FieldLabel>مبنای گردکردن (ریال)</FieldLabel>
              <input className={inputCls} type="number" min="1" dir="ltr" value={roundTo} onChange={(e) => { setRoundTo(e.target.value); setDirty(true) }} />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>وضعیت محاسبه</FieldLabel>
              <select className={inputCls} value={decidedCalc} onChange={(e) => { setDecidedCalc(e.target.value as any); setDirty(true) }}>
                <option value="AUTO">خودکار قابل محاسبه</option>
                <option value="NEEDS_REFERENCE">نیازمند تصمیم مرجع</option>
              </select>
            </div>
            <p className="sm:col-span-2 text-[11px] leading-5 text-zinc-500">
              معافیت/عدم تعلق با بخشودگی متفاوت است؛ بخشودگی فقط با ثبت تصمیم مجاز مرجع اعمال می‌شود و تأخیر در ثبت پرداخت، تاریخ واقعی پرداخت را تغییر نمی‌دهد.
            </p>
          </div>
        )}

        {stepIndex === 4 && (
          <div className="space-y-4">
            <Card title="ورودی‌های قاعده (نوع، واحد، الزامی)">
              <div className="space-y-2">
                {inputs.map((input, i) => (
                  <div key={input.key} className="grid items-center gap-2 rounded-lg border border-zinc-800 bg-[#141615] p-3 sm:grid-cols-[1fr,1fr,1.2fr,auto,auto]">
                    <input className={inputCls} dir="ltr" placeholder="کلید فنی (مثل base_date)" value={input.key} onChange={(e) => { const next = [...inputs]; next[i] = { ...input, key: e.target.value }; setInputs(next); setDirty(true) }} />
                    <input className={inputCls} placeholder="عنوان فارسی" value={input.label} onChange={(e) => { const next = [...inputs]; next[i] = { ...input, label: e.target.value }; setInputs(next); setDirty(true) }} />
                    <select className={inputCls} value={input.type} onChange={(e) => { const next = [...inputs]; next[i] = { ...input, type: e.target.value as any }; setInputs(next); setDirty(true) }}>
                      {INPUT_TYPE_OPTIONS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                    </select>
                    <input className={inputCls} dir="ltr" placeholder="واحد" value={input.unit ?? ''} onChange={(e) => { const next = [...inputs]; next[i] = { ...input, unit: e.target.value }; setInputs(next); setDirty(true) }} />
                    <label className="flex items-center gap-1.5 text-xs text-zinc-300">
                      <input type="checkbox" checked={input.required === true} onChange={(e) => { const next = [...inputs]; next[i] = { ...input, required: e.target.checked }; setInputs(next); setDirty(true) }} className="accent-amber-500" />
                      الزامی
                    </label>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="mt-3 border-zinc-700 text-zinc-300 gap-1.5 text-xs" onClick={() => { setInputs([...inputs, { key: `input_${inputs.length + 1}`, label: '', type: 'DATE', required: false }]); setDirty(true) }}>
                <Plus className="h-3.5 w-3.5" /> افزودن ورودی
              </Button>
            </Card>

            {!isPenalty && (
              <Card title="یادآوری‌ها (فقط برنامه‌ریزی — کانال ارسال واقعی در این نسخه وجود ندارد)">
                <div className="space-y-2">
                  {reminders.map((r, i) => (
                    <div key={i} className="grid gap-2 sm:grid-cols-[1fr,1fr,1fr,1fr,auto]">
                      <input className={inputCls} dir="ltr" placeholder="فاصله پیش از موعد" value={r.offset_before} onChange={(e) => { const next = [...reminders]; next[i] = { ...r, offset_before: e.target.value }; setReminders(next); setDirty(true) }} />
                      <select className={inputCls} value={r.unit} onChange={(e) => { const next = [...reminders]; next[i] = { ...r, unit: e.target.value }; setReminders(next); setDirty(true) }}>
                        <option value="DAY">روز</option><option value="HOUR">ساعت</option>
                      </select>
                      <select className={inputCls} value={r.role_key} onChange={(e) => { const next = [...reminders]; next[i] = { ...r, role_key: e.target.value }; setReminders(next); setDirty(true) }}>
                        {roleOptions.length > 0 ? roleOptions.map((ro) => <option key={ro.key} value={ro.key}>{ro.label}</option>) : <option value={r.role_key}>{r.role_key}</option>}
                      </select>
                      <select className={inputCls} value={r.channel} onChange={(e) => { const next = [...reminders]; next[i] = { ...r, channel: e.target.value }; setReminders(next); setDirty(true) }}>
                        {CHANNEL_OPTIONS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                      </select>
                      <Button variant="ghost" size="icon" className="text-red-400" onClick={() => { setReminders(reminders.filter((_, j) => j !== i)); setDirty(true) }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
                <Button variant="outline" className="mt-2 border-zinc-700 text-zinc-300 gap-1.5 text-xs" onClick={() => { setReminders([...reminders, { offset_before: '5', unit: 'DAY', role_key: 'MANAGER', channel: 'IN_APP' }]); setDirty(true) }}><Plus className="h-3.5 w-3.5" /> یادآوری</Button>
                <p className="mt-2 text-[11px] text-zinc-500">یادآوری مهلت یا جریمه را تغییر نمی‌دهد؛ کانال بدون ارسال واقعی «فقط قابل تعریف» است.</p>
              </Card>
            )}

            <Card title="محل‌های استفاده">
              {usage.length === 0 ? (
                <p className="text-xs text-zinc-500">هنوز به تعهد یا اقدامی متصل نشده است. اتصال از فرم تعهد یا تنظیمات اقدام انجام می‌شود.</p>
              ) : (
                <ul className="space-y-1.5 text-xs text-zinc-300">
                  {usage.map((u) => (
                    <li key={u.id} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-[#141615] px-3 py-2">
                      <span>{u.target_type === 'OBLIGATION_VERSION' ? (u.obligation_title ?? 'تعهد') : `${u.template_title ?? 'الگو'} — ${u.step_title ?? 'اقدام'}`}</span>
                      <span className={`text-[11px] ${u.status === 'ACTIVE' ? 'text-emerald-400' : u.status === 'HISTORY' ? 'text-zinc-500' : 'text-amber-400'}`}>{u.status === 'ACTIVE' ? 'فعال' : u.status === 'HISTORY' ? 'تاریخچه' : 'پیش‌نویس'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}

        {stepIndex === 5 && (
          <div className="space-y-4">
            <Card title="آزمایش با دادهٔ فرضی (نتیجهٔ مورد انتظار ادمین، مستقل از موتور)">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel>عنوان آزمون</FieldLabel>
                  <input className={inputCls} value={testTitle} onChange={(e) => setTestTitle(e.target.value)} placeholder="مثال: ۱۰ روز پس از دریافت" />
                </div>
                {!isPenalty && (
                  <div>
                    <FieldLabel>موعد مورد انتظار (شمسی)</FieldLabel>
                    <JalaliDatePicker value={expectedDeadline} onChange={setExpectedDeadline} size="sm" />
                    {testFieldErrors['expected_deadline'] && <p className="mt-1 text-[11px] text-red-400">{testFieldErrors['expected_deadline']}</p>}
                  </div>
                )}
                {isPenalty && (
                  <div>
                    <FieldLabel>مبلغ برآورد مورد انتظار (ریال)</FieldLabel>
                    <input className={inputCls} type="number" dir="ltr" value={expectedAmount} onChange={(e) => setExpectedAmount(e.target.value)} />
                  </div>
                )}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {inputs.filter((i) => i.type === 'DATE' || i.type === 'DATETIME').map((input) => (
                  <div key={input.key}>
                    <FieldLabel>{input.label}</FieldLabel>
                    <JalaliDatePicker value={testInputs[input.key] ?? ''} onChange={(v) => setTestInputs({ ...testInputs, [input.key]: v })} size="sm" />
                    {testFieldErrors[input.key] && <p className="mt-1 text-[11px] text-red-400">{testFieldErrors[input.key]}</p>}
                  </div>
                ))}
                {inputs.filter((i) => i.type === 'AMOUNT' || i.type === 'NUMBER').map((input) => (
                  <div key={input.key}>
                    <FieldLabel>{input.label}</FieldLabel>
                    <input className={inputCls} type="number" dir="ltr" value={testInputs[input.key] ?? ''} onChange={(e) => setTestInputs({ ...testInputs, [input.key]: e.target.value })} />
                  </div>
                ))}
                {!isPenalty && (
                  <>
                    <div>
                      <FieldLabel>پایان سال مالی (در صورت نیاز)</FieldLabel>
                      <JalaliDatePicker value={testInputs['fiscal_year_end'] ?? ''} onChange={(v) => setTestInputs({ ...testInputs, fiscal_year_end: v })} size="sm" />
                      {testFieldErrors['fiscal_year_end'] && <p className="mt-1 text-[11px] text-red-400">{testFieldErrors['fiscal_year_end']}</p>}
                    </div>
                    <div>
                      <FieldLabel>پایان دوره (در صورت نیاز)</FieldLabel>
                      <JalaliDatePicker value={testInputs['period_end'] ?? ''} onChange={(v) => setTestInputs({ ...testInputs, period_end: v })} size="sm" />
                      {testFieldErrors['period_end'] && <p className="mt-1 text-[11px] text-red-400">{testFieldErrors['period_end']}</p>}
                    </div>
                  </>
                )}
                {isPenalty && (
                  <>
                    <div>
                      <FieldLabel>موعد مؤثر</FieldLabel>
                      <JalaliDatePicker value={testInputs['effective_deadline'] ?? ''} onChange={(v) => setTestInputs({ ...testInputs, effective_deadline: v })} size="sm" />
                      {testFieldErrors['effective_deadline'] && <p className="mt-1 text-[11px] text-red-400">{testFieldErrors['effective_deadline']}</p>}
                    </div>
                    <div>
                      <FieldLabel>تاریخ پرداخت</FieldLabel>
                      <JalaliDatePicker value={testInputs['payment_date'] ?? ''} onChange={(v) => setTestInputs({ ...testInputs, payment_date: v })} size="sm" />
                      {testFieldErrors['payment_date'] && <p className="mt-1 text-[11px] text-red-400">{testFieldErrors['payment_date']}</p>}
                    </div>
                  </>
                )}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button variant="outline" className="border-sky-800 text-sky-300 gap-1.5 text-xs" onClick={() => void runTest()} disabled={runningTest || !usableVersionId}>
                  {runningTest ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
                  اجرا و مقایسه
                </Button>
                {!usableVersionId && <span className="text-[11px] text-zinc-500">ابتدا پیش‌نویس را ذخیره کنید.</span>}
              </div>
              {tests.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {tests.map((t) => (
                    <li key={t.id} className="rounded-lg border border-zinc-800 bg-[#141615] px-3 py-2.5 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-zinc-200">{t.title}</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`font-bold ${t.status === 'PASS' ? 'text-emerald-400' : t.status === 'FAIL' ? 'text-red-400' : 'text-amber-400'}`}>
                            {t.status === 'PASS' ? 'موفق ✓' : t.status === 'FAIL' ? 'ناموفق ✗' : 'در انتظار'}
                          </span>
                          <button type="button" onClick={() => void rerunTest(t)} disabled={runningTest} className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 hover:border-amber-600 hover:text-amber-300 disabled:opacity-40" title="اجرای مجدد آزمون">
                            <FlaskConical className="inline-block h-3 w-3" /> اجرای مجدد
                          </button>
                          <button type="button" onClick={() => void deleteTest(t)} className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-red-400 hover:border-red-700" title="حذف آزمون">
                            <Trash2 className="inline-block h-3 w-3" /> حذف
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
                        <div className="flex justify-between gap-3 text-zinc-400"><span>تاریخ مبنا</span><span className="text-zinc-200">{testBaseDate(t)}</span></div>
                        <div className="flex justify-between gap-3 text-zinc-400"><span>روش محاسبه</span><span className="text-zinc-200">{testMethodLabel(t)}</span></div>
                        <div className="flex justify-between gap-3 text-zinc-400"><span>موعد مورد انتظار</span><span className="text-zinc-200">{isoToJalaliFa(t.expected?.effective_deadline)}</span></div>
                        <div className="flex justify-between gap-3 text-zinc-400"><span>موعد محاسبه‌شده</span><span className="text-zinc-200">{isoToJalaliFa(t.actual?.effective_deadline)}</span></div>
                        <div className="flex justify-between gap-3 text-zinc-400"><span>اختلاف روز</span><span className="text-zinc-200">{testDayDiff(t)}</span></div>
                        {t.status === 'FAIL' && (
                          <div className="flex justify-between gap-3 text-zinc-400 sm:col-span-2"><span>علت شکست</span><span className="text-red-300">{testFailureReason(t)}</span></div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-[11px] text-zinc-500">آزمون‌ها با نسخهٔ قاعده ذخیره می‌شوند و برای انتشار نسخه لازم‌اند.</p>
            </Card>

            <Card title="تأیید و انتشار نسخه">
              {publishChecks.length > 0 && (
                <ul className="mb-3 space-y-1 text-xs">
                  {publishChecks.map((c, i) => (
                    <li key={i} className={`flex items-center gap-2 ${c.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                      {c.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />} {c.label}
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {versionStatus === 'DRAFT' && (
                  <Button variant="outline" className="border-amber-800 text-amber-300 gap-1.5 text-xs" onClick={() => void doTransition('IN_REVIEW')} disabled={transitioning}>
                    {transitioning && <Loader2 className="h-3.5 w-3.5 animate-spin" />} ارسال به بررسی
                  </Button>
                )}
                {versionStatus === 'IN_REVIEW' && (
                  <>
                  <Button variant="outline" className="border-emerald-800 text-emerald-300 gap-1.5 text-xs" onClick={() => void doTransition('APPROVED')} disabled={transitioning || !tests.some((t) => t.status === 'PASS')}>
                    {transitioning && <Loader2 className="h-3.5 w-3.5 animate-spin" />} تأیید نسخه
                  </Button>
                  {versionStatus === 'IN_REVIEW' && !tests.some((t) => t.status === 'PASS') && (
                    <span className="text-[11px] text-amber-400">تأیید نسخه نیازمند حداقل یک آزمون موفق است.</span>
                  )}
                  </>
                )}
                {versionStatus === 'APPROVED' && (
                  <Button className="bg-emerald-700 hover:bg-emerald-600 text-white gap-1.5 text-xs" onClick={() => void doTransition('PUBLISHED')} disabled={transitioning}>
                    {transitioning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} انتشار نسخه
                  </Button>
                )}
                {!usableVersionId && (
                  <span className="text-[11px] text-zinc-500">ذخیرهٔ پیش‌نویس برای شروع چرخهٔ تأیید لازم است.</span>
                )}
                {mode !== 'edit' && usableVersionId && !versionStatus && <span className="text-[11px] text-zinc-500">نسخه ذخیره شد؛ برای انتقال وضعیت از دکمه‌ها استفاده کنید.</span>}
              </div>
              <p className="mt-3 text-[11px] leading-5 text-zinc-500">
                تأیید فنی محاسبه و تأیید تخصصی محتوای قانون جدا ثبت می‌شوند؛ نسخهٔ منتشرشده تغییرناپذیر است و تغییر فقط با نسخهٔ جدید ممکن است. اتصال به نسخهٔ مشخص انجام می‌شود، نه «آخرین نسخه».
              </p>
            </Card>
          </div>
        )}

        {/* دکمه‌های پایین */}
        <div className="mt-6 flex items-center justify-between border-t border-zinc-800 pt-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>انصراف</Button>
            <Button variant="outline" className="border-zinc-700 text-zinc-300 gap-1.5" onClick={() => void saveDraft()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              ذخیره پیش‌نویس
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <Button variant="outline" className="border-zinc-700 text-zinc-300 gap-1.5" onClick={() => setStepIndex(stepIndex - 1)}>
                <ArrowRight className="h-4 w-4" /> قبلی
              </Button>
            )}
            {stepIndex < pageCount - 1 && (
              <Button className="bg-amber-600 hover:bg-amber-500 text-zinc-950 gap-1.5 font-semibold" onClick={() => setStepIndex(stepIndex + 1)}>
                ادامه <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
