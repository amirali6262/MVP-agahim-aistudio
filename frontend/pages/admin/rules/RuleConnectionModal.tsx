import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle2, FlaskConical, Link2, Loader2, Save, X } from 'lucide-react'
import { Button } from '../../../lib/shadcn/button'
import JalaliDatePicker from '../../../components/JalaliDatePicker'
import type { WorkflowStepField } from '../../../lib/supabase'
import {
  calcDeadline,
  calcPenalty,
  fetchConnectionsForTarget,
  fetchRuleCenterRules,
  saveRuleConnection,
  type CalcResult,
  type DecidedStatus,
  type RuleCenterConnection,
  type RuleInput,
} from '../../../lib/ruleCenter'
import { parseJalaliDate, jalaliToGregorian } from '../../../lib/jalaliUtils'

function jalaliToIso(value: string): string | null {
  const p = parseJalaliDate(value)
  if (!p) return null
  const g = jalaliToGregorian(p.year, p.month, p.day)
  return `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`
}

const SOURCE_TYPES: Array<{ value: string; label: string }> = [
  { value: 'ACTION_FIELD', label: 'فیلد همان اقدام' },
  { value: 'OTHER_STEP_FIELD', label: 'فیلد اقدام دیگر (همین الگو)' },
  { value: 'CASE_EVENT', label: 'رویداد ثبت‌شده پرونده' },
  { value: 'PERIOD_START', label: 'شروع دوره پرونده' },
  { value: 'PERIOD_END', label: 'پایان دوره پرونده' },
  { value: 'FISCAL_YEAR_START', label: 'شروع سال مالی پرونده' },
  { value: 'FISCAL_YEAR_END', label: 'پایان سال مالی پرونده' },
  { value: 'FIXED_DATE', label: 'تاریخ ثابت' },
]

const DECIDED_OPTIONS: Array<{ value: DecidedStatus; label: string }> = [
  { value: 'UNCHECKED', label: 'بررسی نشده' },
  { value: 'NO_PENALTY', label: 'بدون جریمه — با مستند بررسی' },
  { value: 'RULE_ATTACHED', label: 'قاعده متصل و آماده' },
  { value: 'NEEDS_REFERENCE', label: 'نیازمند تصمیم مرجع' },
]

const inputCls =
  'w-full rounded-lg border border-zinc-700 bg-[#1d1a18] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-amber-500/70 transition'

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <label className="mb-1.5 block text-xs font-semibold text-zinc-300">
      {children}
      {hint && <span className="mr-1 font-normal text-zinc-500">({hint})</span>}
    </label>
  )
}

export default function RuleConnectionModal({
  open,
  onClose,
  kind,
  targetType,
  targetId,
  targetRef,
  targetLabel,
  actionFields,
  allSteps,
  onSaved,
  onConnected,
}: {
  open: boolean
  onClose: () => void
  kind: 'DEADLINE' | 'PENALTY'
  targetType: 'OBLIGATION_VERSION' | 'ACTION_STEP'
  /** برای ACTION_STEP: شناسهٔ الگو؛ برای تعهد: شناسهٔ نسخهٔ تعهد */
  targetId: string
  /** برای ACTION_STEP: شناسهٔ پایدار اقدام (step_ref) — فقط هنگام ایجاد تولید می‌شود */
  targetRef?: string | null
  targetLabel: string
  /** فیلدهای اقدام جاری (برای منبع ACTION_FIELD) */
  actionFields?: WorkflowStepField[]
  /** همهٔ اقدام‌های الگو (برای منبع OTHER_STEP_FIELD) */
  allSteps?: Array<{ step_ref?: string; title: string; fields: WorkflowStepField[] }>
  onSaved: () => Promise<void>
  /** پس از ذخیرهٔ اتصال: بازگشت نسخه و نگاشت به فرم میزبان */
  onConnected?: (versionId: string, mapping: Record<string, any>) => void
}) {
  const [rules, setRules] = useState<Array<any>>([])
  const [loading, setLoading] = useState(true)
  const [ruleId, setRuleId] = useState<string>('')
  const [versionId, setVersionId] = useState<string>('')
  const [mapping, setMapping] = useState<Record<string, any>>({})
  const [decidedStatus, setDecidedStatus] = useState<DecidedStatus>('UNCHECKED')
  const [decidedDoc, setDecidedDoc] = useState('')
  const [previewInputs, setPreviewInputs] = useState<Record<string, string>>({})
  const [calcResult, setCalcResult] = useState<CalcResult | null>(null)
  const [calculating, setCalculating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const kindLabel = kind === 'PENALTY' ? 'جریمه' : 'مهلت'

  const selectedRule = rules.find((r) => r.id === ruleId)
  const versions = useMemo(() => {
    const all = (selectedRule?.versions ?? []) as Array<{ id: string; version_number: number; status: string }>
    return [...all].sort((a, b) => b.version_number - a.version_number)
  }, [selectedRule])
  const selectedVersion: any = selectedRule?.versions?.find((v: any) => v.id === versionId) ?? null
  const inputs: RuleInput[] = Array.isArray(selectedVersion?.inputs) ? selectedVersion.inputs : []

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError('')
    setCalcResult(null)
    void (async () => {
      try {
        const [allRules, existingAll] = await Promise.all([
          fetchRuleCenterRules(),
          fetchConnectionsForTarget(targetType, targetId),
        ])
        const existing = targetType === 'ACTION_STEP' ? existingAll.filter((c) => c.target_ref === targetRef) : existingAll
        const matching = allRules.filter((r) => (kind === 'PENALTY' ? r.kind === 'PENALTY' : r.kind !== 'PENALTY'))
        setRules(matching)
        const active = existing.find((c) => c.status === 'ACTIVE') ?? existing[0]
        if (active) {
          setRuleId(active.version_id ? findRuleId(matching, active.version_id) : '')
          setVersionId(active.version_id)
          setMapping(active.mapping ?? {})
          setDecidedStatus(active.decided_status ?? 'UNCHECKED')
          setDecidedDoc(active.decided_doc ?? '')
        }
      } catch (e: any) {
        setError(e?.message ?? 'خطا در دریافت قواعد')
      } finally {
        setLoading(false)
      }
    })()
  }, [open, targetType, targetId, targetRef, kind])

  function findRuleId(rules: Array<any>, versionId: string): string {
    for (const r of rules) {
      if (r.versions?.some((v: any) => v.id === versionId)) return r.id
    }
    return ''
  }

  function selectRule(id: string) {
    setRuleId(id)
    setVersionId('')
    setMapping({})
    setCalcResult(null)
  }

  async function runPreview() {
    if (!selectedVersion) return toast.error('ابتدا نسخهٔ قاعده را انتخاب کنید.')
    setCalculating(true)
    setCalcResult(null)
    setError('')
    try {
      const inputsPayload: Record<string, any> = {}
      // ورودی‌های تعریف‌شده
      for (const input of inputs) {
        const mapped = mapping[input.key]
        const previewVal = previewInputs[input.key]
        if (mapped?.source_type === 'FIXED_DATE') {
          const iso = mapped.source_ref ? jalaliToIso(mapped.source_ref) : null
          if (iso) inputsPayload[input.key] = { value: iso, type: input.type }
        } else if (mapped?.source_type === 'PERIOD_START' || mapped?.source_type === 'FISCAL_YEAR_START' || mapped?.source_type === 'PERIOD_END' || mapped?.source_type === 'FISCAL_YEAR_END') {
          const iso = previewVal ? jalaliToIso(previewVal) : null
          if (iso) inputsPayload[input.key] = { value: iso, type: input.type }
        } else if (previewVal) {
          inputsPayload[input.key] = { value: previewVal, type: input.type }
        }
      }
      // منابع دوره/سال مالی که مستقیماً توسط قاعده استفاده می‌شوند
      for (const key of ['period_start', 'period_end', 'fiscal_year_start', 'fiscal_year_end']) {
        if (previewInputs[key] && !inputsPayload[key]) {
          const iso = jalaliToIso(previewInputs[key])
          if (iso) inputsPayload[key] = { value: iso, type: 'DATE' }
        }
      }
      if (kind === 'PENALTY') {
        // موعد مؤثر برای مبدأ جریمه (آزمایشی)
        if (!inputsPayload['effective_deadline'] && previewInputs['effective_deadline']) {
          const iso = jalaliToIso(previewInputs['effective_deadline'])
          if (iso) inputsPayload['effective_deadline'] = { value: iso, type: 'DATE' }
        }
        setCalcResult(await calcPenalty(selectedVersion.id, inputsPayload, 'PREVIEW'))
      } else {
        setCalcResult(await calcDeadline(selectedVersion.id, inputsPayload, 'PREVIEW'))
      }
    } catch (e: any) {
      setError(e?.message ?? 'محاسبه آزمایشی انجام نشد.')
    } finally {
      setCalculating(false)
    }
  }

  async function save() {
    if (!selectedVersion) return toast.error('نسخهٔ قاعده را انتخاب کنید.')
    setSaving(true)
    setError('')
    try {
      const versionStatus = selectedVersion.status
      const canActivate = versionStatus === 'PUBLISHED'
      // در حالت ساخت الگوی جدید هنوز شناسهٔ الگو وجود ندارد؛ اتصال روی گام نگه داشته می‌شود
      // و پس از اولین ذخیرهٔ الگو، همگام‌سازی در rule_center_connections انجام می‌شود.
      if (targetId) {
        await saveRuleConnection({
          versionId: selectedVersion.id,
          targetType,
          targetId,
          targetRef: targetRef ?? null,
          mapping,
          decidedStatus,
          decidedDoc: decidedDoc || null,
          active: canActivate,
        })
      }
      if (!canActivate) {
        toast.warning('نسخه هنوز منتشر نشده؛ اتصال به‌صورت پیش‌نویس ذخیره شد و انتشار/فعال‌سازی مسدود می‌ماند.')
      } else {
        toast.success('اتصال قاعده ذخیره شد.')
      }
      onConnected?.(selectedVersion.id, mapping)
      await onSaved()
      onClose()
    } catch (e: any) {
      setError(e?.message ?? 'ذخیره اتصال انجام نشد.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-zinc-700 bg-[#121412] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold text-zinc-100">
              <Link2 className="h-5 w-5 text-amber-400" />
              اتصال قاعدهٔ {kindLabel} — {targetLabel}
            </h3>
            <p className="mt-1 text-xs text-zinc-400">
              اتصال به نسخهٔ مشخصِ قاعده (نه «آخرین نسخه»). اتصال فعال فقط به نسخهٔ منتشرشده مجاز است.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-900/60 bg-red-950/20 p-3 text-xs text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-zinc-400"><Loader2 className="h-5 w-5 animate-spin" />در حال دریافت قواعد...</div>
        ) : (
          <div className="space-y-5">
            {/* انتخاب قاعده و نسخه */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel>قاعده (فقط قواعد {kindLabel})</FieldLabel>
                <select className={inputCls} value={ruleId} onChange={(e) => selectRule(e.target.value)}>
                  <option value="">— انتخاب قاعده —</option>
                  {rules.map((r) => (
                    <option key={r.id} value={r.id}>{r.title_fa} ({r.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>نسخه و وضعیت</FieldLabel>
                <select className={inputCls} value={versionId} disabled={!ruleId} onChange={(e) => { setVersionId(e.target.value); setMapping({}); setCalcResult(null) }}>
                  <option value="">— انتخاب نسخه —</option>
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      نسخه {v.version_number} — {v.status === 'PUBLISHED' ? 'منتشرشده' : v.status === 'STOPPED' ? 'متوقف' : v.status === 'DRAFT' ? 'پیش‌نویس (فقط طراحی)' : v.status}
                    </option>
                  ))}
                </select>
                {selectedVersion && selectedVersion.status !== 'PUBLISHED' && (
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] text-amber-400">
                    <AlertTriangle className="h-3 w-3" /> پیش‌نویس — قابل اتصال برای طراحی؛ انتشار/فعال‌سازی مسدود است.
                  </p>
                )}
              </div>
            </div>

            {selectedVersion && (
              <>
                {/* نگاشت ورودی‌ها */}
                <div className="rounded-xl border border-zinc-800 bg-[#1d1a18] p-4">
                  <h4 className="mb-1 text-sm font-bold text-zinc-200">نگاشت ورودی‌های قاعده به اطلاعات پرونده/اقدام</h4>
                  <p className="mb-3 text-[11px] text-zinc-500">ورودیِ بدون منبع در محاسبهٔ واقعی «در انتظار اطلاعات» می‌شود؛ با صفر جایگزین نمی‌شود.</p>
                  {inputs.length === 0 ? (
                    <p className="text-xs text-zinc-500">این قاعده ورودی تعریف‌نکرده است.</p>
                  ) : (
                    <div className="space-y-3">
                      {inputs.map((input) => {
                        const mapped = mapping[input.key]
                        return (
                          <div key={input.key} className="rounded-lg border border-zinc-800 bg-[#141615] p-3">
                            <div className="mb-2 flex items-center gap-2">
                              <span className="text-xs font-bold text-zinc-200">{input.label}</span>
                              {input.required && <span className="rounded bg-amber-950 px-1.5 py-0.5 text-[10px] text-amber-300">الزامی</span>}
                              <span className="text-[10px] text-zinc-500 ltr" dir="ltr">{input.key}</span>
                              <span className="text-[10px] text-zinc-500">{input.type}</span>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <select
                                className={inputCls}
                                value={mapped?.source_type ?? ''}
                                onChange={(e) => {
                                  const st = e.target.value
                                  const next = { ...mapping }
                                  if (!st) delete next[input.key]
                                  else next[input.key] = { source_type: st, source_ref: '', source_step_ref: '', source_step_label: '' }
                                  setMapping(next)
                                }}
                              >
                                <option value="">— بدون منبع (در انتظار) —</option>
                                {SOURCE_TYPES.filter((s) => targetType === 'ACTION_STEP' || s.value !== 'ACTION_FIELD' && s.value !== 'OTHER_STEP_FIELD').map((s) => (
                                  <option key={s.value} value={s.value}>{s.label}</option>
                                ))}
                              </select>
                              {mapped?.source_type === 'ACTION_FIELD' && (
                                <select className={inputCls} value={mapped?.source_ref ?? ''}
                                  onChange={(e) => setMapping({ ...mapping, [input.key]: { ...mapped, source_ref: e.target.value, source_step_label: actionFields?.find((f) => f.key === e.target.value)?.label } })}
                                >
                                  <option value="">— انتخاب فیلد اقدام —</option>
                                  {(actionFields ?? []).map((f) => (
                                    <option key={f.key} value={f.key}>{f.label} ({f.key})</option>
                                  ))}
                                </select>
                              )}
                              {mapped?.source_type === 'OTHER_STEP_FIELD' && (
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <select className={inputCls} value={mapped?.source_step_ref ?? ''}
                                    onChange={(e) => {
                                      const step = (allSteps ?? []).find((s) => s.step_ref === e.target.value)
                                      setMapping({ ...mapping, [input.key]: { ...mapped, source_step_ref: e.target.value, source_step_label: step?.title } })
                                    }}
                                  >
                                    <option value="">— انتخاب اقدام —</option>
                                    {(allSteps ?? []).map((s) => (
                                      <option key={s.step_ref} value={s.step_ref}>{s.title}</option>
                                    ))}
                                  </select>
                                  {mapped?.source_step_ref && (
                                    <select className={inputCls} value={mapped?.source_ref ?? ''}
                                      onChange={(e) => setMapping({ ...mapping, [input.key]: { ...mapped, source_ref: e.target.value } })}
                                    >
                                      <option value="">— انتخاب فیلد آن اقدام —</option>
                                      {(allSteps?.find((s) => s.step_ref === mapped.source_step_ref)?.fields ?? []).map((f) => (
                                        <option key={f.key} value={f.key}>{f.label} ({f.key})</option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                              )}
                              {mapped?.source_type === 'CASE_EVENT' && (
                                <input className={inputCls} dir="rtl" placeholder="کلید رویداد ساختاریافته، مانند receipt_date" value={mapped?.source_ref ?? ''}
                                  onChange={(e) => setMapping({ ...mapping, [input.key]: { ...mapped, source_ref: e.target.value } })} />
                              )}
                              {mapped?.source_type === 'FIXED_DATE' && (
                                <JalaliDatePicker value={mapped?.source_ref ?? ''} onChange={(v) => setMapping({ ...mapping, [input.key]: { ...mapped, source_ref: v } })} size="sm" />
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {kind === 'PENALTY' && (
                  <div className="rounded-xl border border-zinc-800 bg-[#1d1a18] p-4">
                    <h4 className="mb-3 text-sm font-bold text-zinc-200">وضعیت جریمهٔ این تعهد</h4>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <FieldLabel>وضعیت</FieldLabel>
                        <select className={inputCls} value={decidedStatus} onChange={(e) => setDecidedStatus(e.target.value as DecidedStatus)}>
                          {DECIDED_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <FieldLabel>مستند بررسی (برای «بدون جریمه» الزامی است)</FieldLabel>
                        <input className={inputCls} value={decidedDoc} onChange={(e) => setDecidedDoc(e.target.value)} placeholder="مرجع و نتیجهٔ بررسی…" />
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] text-zinc-500">
                      فهرست خالی خودبه‌خود «بدون جریمه» نیست؛ وضعیت باید صریح ثبت شود.
                    </p>
                  </div>
                )}

                {/* آزمایش با دادهٔ فرضی */}
                <div className="rounded-xl border border-zinc-800 bg-[#1d1a18] p-4">
                  <h4 className="mb-1 flex items-center gap-2 text-sm font-bold text-zinc-200">
                    <FlaskConical className="h-4 w-4 text-sky-400" /> آزمایش با دادهٔ فرضی (پروندهٔ واقعی تغییر نمی‌کند)
                  </h4>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {inputs.filter((i) => i.type === 'DATE' || i.type === 'DATETIME').map((input) => (
                      <div key={input.key}>
                        <FieldLabel>{input.label}</FieldLabel>
                        <JalaliDatePicker value={previewInputs[input.key] ?? ''} onChange={(v) => setPreviewInputs({ ...previewInputs, [input.key]: v })} size="sm" />
                      </div>
                    ))}
                    {inputs.filter((i) => i.type === 'AMOUNT' || i.type === 'NUMBER').map((input) => (
                      <div key={input.key}>
                        <FieldLabel>{input.label}</FieldLabel>
                        <input className={inputCls} type="number" dir="ltr" value={previewInputs[input.key] ?? ''}
                          onChange={(e) => setPreviewInputs({ ...previewInputs, [input.key]: e.target.value })}
                          placeholder={input.type === 'AMOUNT' ? 'مبلغ (ریال)' : 'عدد'} />
                      </div>
                    ))}
                    <div>
                      <FieldLabel>شروع دوره (آزمایش)</FieldLabel>
                      <JalaliDatePicker value={previewInputs['period_start'] ?? ''} onChange={(v) => setPreviewInputs({ ...previewInputs, period_start: v })} size="sm" />
                    </div>
                    <div>
                      <FieldLabel>پایان دوره (آزمایش)</FieldLabel>
                      <JalaliDatePicker value={previewInputs['period_end'] ?? ''} onChange={(v) => setPreviewInputs({ ...previewInputs, period_end: v })} size="sm" />
                    </div>
                    <div>
                      <FieldLabel>پایان سال مالی (آزمایش)</FieldLabel>
                      <JalaliDatePicker value={previewInputs['fiscal_year_end'] ?? ''} onChange={(v) => setPreviewInputs({ ...previewInputs, fiscal_year_end: v })} size="sm" />
                    </div>
                    {kind === 'PENALTY' && (
                      <>
                        <div>
                          <FieldLabel>موعد مؤثر (مبدأ جریمه)</FieldLabel>
                          <JalaliDatePicker value={previewInputs['effective_deadline'] ?? ''} onChange={(v) => setPreviewInputs({ ...previewInputs, effective_deadline: v })} size="sm" />
                        </div>
                        <div>
                          <FieldLabel>تاریخ پرداخت/انجام (پایان جریمه)</FieldLabel>
                          <JalaliDatePicker value={previewInputs['payment_date'] ?? ''} onChange={(v) => setPreviewInputs({ ...previewInputs, payment_date: v })} size="sm" />
                        </div>
                        <div>
                          <FieldLabel>تعداد واحد</FieldLabel>
                          <input className={inputCls} type="number" dir="ltr" value={previewInputs['unit_count'] ?? ''}
                            onChange={(e) => setPreviewInputs({ ...previewInputs, unit_count: e.target.value })} />
                        </div>
                      </>
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Button variant="outline" className="border-sky-800 text-sky-300 gap-1.5 text-xs" onClick={() => void runPreview()} disabled={calculating}>
                      {calculating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
                      محاسبهٔ آزمایشی
                    </Button>
                    {calcResult && (
                      <span className={`flex items-center gap-1 text-xs font-bold ${calcResult.status === 'OK' ? 'text-emerald-400' : calcResult.status === 'PENDING_INPUT' ? 'text-amber-400' : 'text-red-400'}`}>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        وضعیت: {calcResult.status}
                      </span>
                    )}
                  </div>
                  {calcResult && (
                    <div className="mt-3 rounded-lg border border-zinc-800 bg-[#101211] p-3 text-xs leading-6">
                      {calcResult.status === 'OK' && (
                        <>
                          <p className="font-bold text-zinc-200">
                            {kind === 'PENALTY'
                              ? `برآورد: ${Number(calcResult.estimated_amount ?? 0).toLocaleString('fa-IR')} ${calcResult.currency ?? 'ریال'} (روزهای مشمول: ${calcResult.days ?? 0})`
                              : `آخرین روز مجاز: ${calcResult.effective_deadline ?? '—'}${calcResult.initial_deadline ? ` (موعد اولیه: ${calcResult.initial_deadline})` : ''}`}
                          </p>
                          {calcResult.is_estimate === false && (
                            <p className="text-[11px] text-zinc-500">این مبلغ رسمی نیست؛ برآورد سامانه است.</p>
                          )}
                        </>
                      )}
                      {calcResult.status === 'PENDING_INPUT' && (
                        <p className="text-amber-300">در انتظار اطلاعات: {calcResult.missing?.join('، ')} — هیچ جایگزینی با صفر/امروز انجام نمی‌شود.</p>
                      )}
                      {calcResult.status === 'NOT_APPLICABLE' && <p className="text-zinc-400">شرط تعلق برقرار نیست (غیرمشمول).</p>}
                      {calcResult.status === 'NEEDS_REFERENCE' && <p className="text-amber-300">مبلغ به تشخیص مرجع نیاز دارد؛ سامانه مبلغ نمی‌سازد.</p>}
                      {Array.isArray(calcResult.steps) && calcResult.steps.length > 0 && (
                        <ol className="mt-2 list-inside list-decimal space-y-0.5 text-zinc-400">
                          {calcResult.steps.map((s: any, i: number) => (
                            <li key={i}>{s.text ?? s.step}{s.result ? ` ← ${s.result}` : ''}</li>
                          ))}
                        </ol>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="flex items-center justify-end gap-2 border-t border-zinc-800 pt-4">
              <Button variant="ghost" onClick={onClose}>انصراف</Button>
              <Button onClick={() => void save()} disabled={saving || !selectedVersion} className="bg-amber-600 hover:bg-amber-500 text-zinc-950 gap-1.5 font-semibold">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                ذخیره اتصال
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
