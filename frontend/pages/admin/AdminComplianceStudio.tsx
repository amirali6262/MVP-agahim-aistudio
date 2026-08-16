import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  FilePlus2,
  GitBranch,
  Loader2,
  Plus,
  RefreshCw,
  Scale,
  ShieldAlert,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import type { Json, Tables } from '../../lib/database.types'
import { Button } from '../../lib/shadcn/button'
import { Input } from '../../lib/shadcn/input'
import { Label } from '../../lib/shadcn/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../lib/shadcn/select'

type Family = Tables<'obligation_families'>
type Obligation = Tables<'obligations'>
type Version = Tables<'obligation_versions'>
type WorkflowStep = Tables<'workflow_steps'>
type RuleSet = Tables<'eligibility_rule_sets'>

interface CatalogItem {
  obligation: Obligation
  family: Family | null
  versions: Version[]
}

const FACTS = [
  ['ENTITY_TYPE', 'نوع شخصیت'],
  ['LEGAL_FORM', 'قالب ثبتی'],
  ['PRIMARY_ACTIVITY', 'فعالیت اصلی'],
  ['ACTIVITY_CODES', 'کدهای فعالیت'],
  ['TAX_REGISTRATION_STATUS', 'وضعیت ثبت مالیاتی'],
  ['VAT_REGISTRATION_STATUS', 'وضعیت ارزش افزوده'],
  ['EMPLOYEE_COUNT', 'تعداد کارکنان'],
  ['ANNUAL_REVENUE', 'فروش سالانه'],
  ['BRANCH_COUNT', 'تعداد شعب'],
  ['HAS_ACTIVE_CONTRACTS', 'قرارداد فعال'],
  ['CONTRACT_TYPES', 'نوع قراردادها'],
  ['PAYS_SALARIES', 'پرداخت حقوق'],
] as const

const OPERATORS = [
  ['EQ', 'برابر است با'],
  ['NEQ', 'برابر نیست با'],
  ['GT', 'بیشتر از'],
  ['GTE', 'بیشتر یا مساوی'],
  ['LT', 'کمتر از'],
  ['LTE', 'کمتر یا مساوی'],
  ['IN', 'یکی از گزینه‌ها'],
  ['CONTAINS', 'شامل است'],
  ['IS_TRUE', 'بله است'],
  ['IS_FALSE', 'خیر است'],
  ['IS_NULL', 'خالی است'],
  ['NOT_NULL', 'خالی نیست'],
] as const

const noValueOperators = new Set(['IS_TRUE', 'IS_FALSE', 'IS_NULL', 'NOT_NULL'])
const numericFacts = new Set(['EMPLOYEE_COUNT', 'ANNUAL_REVENUE', 'BRANCH_COUNT'])
const booleanFacts = new Set(['HAS_ACTIVE_CONTRACTS', 'PAYS_SALARIES'])
const arrayFacts = new Set(['ACTIVITY_CODES', 'CONTRACT_TYPES'])

interface DraftCondition {
  fact: string
  operator: string
  expected: string
}

export default function AdminComplianceStudio() {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [families, setFamilies] = useState<Family[]>([])
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
  const [steps, setSteps] = useState<WorkflowStep[]>([])
  const [rules, setRules] = useState<RuleSet[]>([])
  const [showFamilyForm, setShowFamilyForm] = useState(false)
  const [showDraftForm, setShowDraftForm] = useState(false)

  const selectedVersion = useMemo(
    () => catalog.flatMap((item) => item.versions).find((version) => version.id === selectedVersionId) ?? null,
    [catalog, selectedVersionId]
  )

  const loadCatalog = useCallback(async () => {
    setLoading(true)
    const [familyResult, obligationResult, versionResult] = await Promise.all([
      supabase.from('obligation_families').select('*').order('title'),
      supabase.from('obligations').select('*').order('created_at', { ascending: false }),
      supabase.from('obligation_versions').select('*').order('version_number', { ascending: false }),
    ])
    const error = familyResult.error ?? obligationResult.error ?? versionResult.error
    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }
    const familyRows = familyResult.data ?? []
    const versionRows = versionResult.data ?? []
    setFamilies(familyRows)
    setCatalog((obligationResult.data ?? []).map((obligation) => ({
      obligation,
      family: familyRows.find((family) => family.id === obligation.family_id) ?? null,
      versions: versionRows.filter((version) => version.obligation_id === obligation.id),
    })))
    setLoading(false)
  }, [])

  const loadDefinition = useCallback(async () => {
    if (!selectedVersionId) {
      setSteps([])
      setRules([])
      return
    }
    const [templateResult, rulesResult] = await Promise.all([
      supabase.from('workflow_templates').select('id').eq('obligation_version_id', selectedVersionId).maybeSingle(),
      supabase.from('eligibility_rule_sets').select('*').eq('obligation_version_id', selectedVersionId).order('priority'),
    ])
    if (templateResult.error || rulesResult.error) {
      toast.error(templateResult.error?.message ?? rulesResult.error?.message ?? 'دریافت طراحی ناموفق بود.')
      return
    }
    if (templateResult.data) {
      const { data, error } = await supabase.from('workflow_steps').select('*').eq('workflow_template_id', templateResult.data.id).order('sequence')
      if (error) toast.error(error.message)
      setSteps(data ?? [])
    } else {
      setSteps([])
    }
    setRules(rulesResult.data ?? [])
  }, [selectedVersionId])

  useEffect(() => { void loadCatalog() }, [loadCatalog])
  useEffect(() => { void loadDefinition() }, [loadDefinition])

  const transitionStatus = async (targetStatus: 'DRAFT' | 'REVIEW' | 'TESTING', successMessage: string) => {
    if (!selectedVersionId) return
    setBusy(true)
    const { error } = await supabase.rpc('transition_obligation_version_status', {
      requested_version_id: selectedVersionId,
      requested_target_status: targetStatus,
    })
    setBusy(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(successMessage)
    await loadCatalog()
  }

  const publish = async () => {
    if (!selectedVersionId) return
    if (!window.confirm('پس از انتشار، این نسخه و قواعد آن قفل می‌شود. آیا آزمایش، منبع رسمی و محتوای حقوقی را بررسی کرده‌اید؟')) return
    setBusy(true)
    const { error } = await supabase.rpc('publish_obligation_version', { requested_version_id: selectedVersionId })
    setBusy(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('نسخه منتشر شد و برای تشخیص شرکت‌ها قابل استفاده است.')
    await loadCatalog()
  }

  if (loading) return <div className="flex justify-center p-24 text-zinc-400"><Loader2 className="h-7 w-7 animate-spin" /></div>

  return (
    <main className="p-6 text-zinc-100" dir="rtl">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-black">استودیوی طراحی تعهدات</h2>
          <p className="mt-1 text-sm text-zinc-500">تعهد، تشخیص مشمولیت و مراحل کار را بدون تغییر کد طراحی کنید.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="border-zinc-700 gap-2" onClick={() => void loadCatalog()}><RefreshCw className="h-4 w-4" />به‌روزرسانی</Button>
          <Button variant="outline" className="border-zinc-700 gap-2" onClick={() => setShowFamilyForm((value) => !value)}><Plus className="h-4 w-4" />گروه جدید</Button>
          <Button className="bg-amber-500 text-zinc-950 hover:bg-amber-400 gap-2" onClick={() => setShowDraftForm((value) => !value)}><FilePlus2 className="h-4 w-4" />تعهد جدید</Button>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-amber-900/50 bg-amber-950/10 p-4 text-sm leading-7 text-amber-200">
        <ShieldAlert className="ml-2 inline h-4 w-4" />
        هیچ متن حقوقی به‌صورت خودکار منتشر نمی‌شود. انتشار فقط پس از ثبت منبع رسمی، قاعده تشخیص و حداقل یک مرحله ممکن است.
      </div>

      {showFamilyForm && <FamilyForm onSaved={async () => { setShowFamilyForm(false); await loadCatalog() }} />}
      {showDraftForm && <DraftForm families={families} onSaved={async (versionId) => { setShowDraftForm(false); await loadCatalog(); setSelectedVersionId(versionId) }} />}

      <div className="grid gap-6 xl:grid-cols-[1fr,1.6fr]">
        <section className="rounded-2xl border border-zinc-800 bg-[#141615] p-5">
          <h3 className="mb-4 flex items-center gap-2 font-bold"><BookOpenCheck className="h-5 w-5 text-amber-400" />کاتالوگ</h3>
          <div className="space-y-3">
            {catalog.length === 0 ? <p className="py-8 text-center text-sm text-zinc-500">هنوز تعهدی تعریف نشده است.</p> : catalog.map((item) => (
              <div key={item.obligation.id} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <p className="font-semibold">{item.obligation.title}</p>
                <p className="mt-1 text-xs text-zinc-500">{item.family?.title ?? 'بدون گروه'} · {item.obligation.code}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.versions.map((version) => (
                    <button key={version.id} onClick={() => setSelectedVersionId(version.id)} className={`rounded-lg border px-3 py-2 text-xs ${
                      selectedVersionId === version.id ? 'border-amber-500 bg-amber-500 text-zinc-950' : 'border-zinc-700 text-zinc-300'
                    }`}>نسخه {version.version_number} · {versionStatusLabel(version.status)}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-5">
          {!selectedVersion ? (
            <div className="rounded-2xl border border-dashed border-zinc-700 bg-[#141615] p-16 text-center text-zinc-500">برای ادامه یک نسخه را انتخاب کنید.</div>
          ) : (
            <>
              <div className="rounded-2xl border border-zinc-800 bg-[#141615] p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-bold">آمادگی انتشار نسخه {selectedVersion.version_number}</h3>
                    <p className="mt-1 text-xs text-zinc-500">{selectedVersion.legal_reference || 'مرجع قانونی ثبت نشده'}</p>
                  </div>
                  {selectedVersion.status === 'PUBLISHED' ? (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-950 px-3 py-1 text-xs text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" />منتشرشده و قفل</span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {selectedVersion.status === 'DRAFT' && (
                        <Button onClick={() => void transitionStatus('REVIEW', 'نسخه برای بازبینی تخصصی ارسال شد.')} disabled={busy} className="bg-amber-500 text-zinc-950 hover:bg-amber-400">
                          {busy && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}ارسال به بازبینی
                        </Button>
                      )}
                      {selectedVersion.status === 'REVIEW' && (
                        <>
                          <Button variant="outline" className="border-zinc-700" onClick={() => void transitionStatus('DRAFT', 'نسخه برای اصلاح به پیش‌نویس بازگشت.')} disabled={busy}>بازگشت برای اصلاح</Button>
                          <Button onClick={() => void transitionStatus('TESTING', 'نسخه وارد مرحله آزمایش شد.')} disabled={busy} className="bg-sky-700 hover:bg-sky-600">
                            {busy && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}ارسال به آزمایش
                          </Button>
                        </>
                      )}
                      {selectedVersion.status === 'TESTING' && (
                        <>
                          <Button variant="outline" className="border-zinc-700" onClick={() => void transitionStatus('REVIEW', 'نسخه برای بازبینی دوباره بازگشت.')} disabled={busy}>بازگشت به بازبینی</Button>
                          <Button onClick={publish} disabled={busy} className="bg-emerald-700 hover:bg-emerald-600">
                            {busy && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}انتشار نهایی
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <Metric label="قواعد تشخیص" value={rules.length} />
                  <Metric label="مراحل فرایند" value={steps.length} />
                  <Metric label="نوع جریمه" value={penaltyType(selectedVersion.penalty_rule)} />
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div className="rounded-2xl border border-zinc-800 bg-[#141615] p-5">
                  <h3 className="flex items-center gap-2 font-bold"><Scale className="h-4 w-4 text-amber-400" />تشخیص مشمولیت</h3>
                  <div className="mt-4 space-y-2">{rules.map((rule) => <DefinitionRow key={rule.id} title={rule.title} meta={`${rule.outcome} · اولویت ${rule.priority}`} />)}</div>
                  {selectedVersion.status === 'DRAFT' && <EligibilityRuleForm versionId={selectedVersion.id} nextPriority={rules.length + 1} onSaved={loadDefinition} />}
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-[#141615] p-5">
                  <h3 className="flex items-center gap-2 font-bold"><GitBranch className="h-4 w-4 text-amber-400" />مراحل فرایند</h3>
                  <div className="mt-4 space-y-2">{steps.map((step) => <DefinitionRow key={step.id} title={`${step.sequence}. ${step.title}`} meta={actorLabel(step.actor)} />)}</div>
                  {selectedVersion.status === 'DRAFT' && <WorkflowStepForm version={selectedVersion} nextSequence={steps.length + 1} onSaved={loadDefinition} />}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  )
}

function FamilyForm({ onSaved }: { onSaved: () => Promise<void> }) {
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [domain, setDomain] = useState('TAX')
  const save = async () => {
    const { error } = await supabase.from('obligation_families').insert({ code: code.trim().toUpperCase(), title: title.trim(), domain })
    if (error) toast.error(error.message)
    else { toast.success('گروه ثبت شد.'); await onSaved() }
  }
  return <Editor title="گروه جدید"><Field label="کد انگلیسی"><Input value={code} onChange={(e) => setCode(e.target.value)} dir="ltr" /></Field><Field label="عنوان"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field><Field label="حوزه"><Select value={domain} onValueChange={setDomain}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="TAX">مالیات</SelectItem><SelectItem value="INSURANCE">بیمه</SelectItem></SelectContent></Select></Field><SaveButton onClick={save} /></Editor>
}

function DraftForm({ families, onSaved }: { families: Family[]; onSaved: (versionId: string) => Promise<void> }) {
  const [familyId, setFamilyId] = useState(families[0]?.id ?? '')
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [legalReference, setLegalReference] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [actionUrl, setActionUrl] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [penaltyTypeValue, setPenaltyTypeValue] = useState('NONE')
  const [penaltyValue, setPenaltyValue] = useState('')
  const save = async () => {
    if (!familyId || !code.trim() || !title.trim() || !legalReference.trim() || !sourceUrl.trim() || !effectiveFrom) {
      toast.error('گروه، کد، عنوان، مرجع قانونی، منبع رسمی و تاریخ شروع اعتبار الزامی است.')
      return
    }
    const numberValue = penaltyValue ? Number(penaltyValue) : 0
    if (penaltyTypeValue !== 'NONE' && (!penaltyValue || !Number.isFinite(numberValue) || numberValue < 0)) {
      toast.error('مقدار جریمه باید عددی و غیرمنفی باشد.')
      return
    }
    const penaltyRule: Json = penaltyTypeValue === 'FIXED'
      ? { type: 'FIXED', amount: numberValue }
      : penaltyTypeValue === 'PERCENTAGE' || penaltyTypeValue === 'DAILY_PERCENTAGE'
        ? { type: penaltyTypeValue, rate_percent: numberValue }
        : { type: 'NONE' }
    const { data, error } = await supabase.rpc('create_obligation_draft', {
      requested_family_id: familyId,
      requested_code: code.trim().toUpperCase(),
      requested_title: title.trim(),
      requested_summary: undefined,
      requested_authority_name: undefined,
      requested_official_action_url: actionUrl.trim() || undefined,
      requested_legal_reference: legalReference.trim() || undefined,
      requested_source_url: sourceUrl.trim() || undefined,
      requested_effective_from: effectiveFrom || undefined,
      requested_recurrence_rule: {},
      requested_deadline_rule: {},
      requested_penalty_rule: penaltyRule,
    })
    if (error) toast.error(error.message)
    else { toast.success('پیش‌نویس تعهد ثبت شد.'); await onSaved(data.id) }
  }
  return <Editor title="پیش‌نویس تعهد جدید"><Field label="گروه"><Select value={familyId} onValueChange={setFamilyId}><SelectTrigger><SelectValue placeholder="گروه را انتخاب کنید" /></SelectTrigger><SelectContent>{families.map((family) => <SelectItem key={family.id} value={family.id}>{family.title}</SelectItem>)}</SelectContent></Select></Field><Field label="کد انگلیسی"><Input value={code} onChange={(e) => setCode(e.target.value)} dir="ltr" /></Field><Field label="عنوان تعهد"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field><Field label="ماده / مرجع قانونی"><Input value={legalReference} onChange={(e) => setLegalReference(e.target.value)} /></Field><Field label="لینک منبع رسمی"><Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} dir="ltr" placeholder="https://..." /></Field><Field label="لینک انجام کار"><Input value={actionUrl} onChange={(e) => setActionUrl(e.target.value)} dir="ltr" placeholder="https://..." /></Field><Field label="تاریخ شروع اعتبار"><Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} /></Field><Field label="نوع جریمه"><Select value={penaltyTypeValue} onValueChange={setPenaltyTypeValue}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NONE">بدون فرمول</SelectItem><SelectItem value="FIXED">مبلغ ثابت</SelectItem><SelectItem value="PERCENTAGE">درصدی</SelectItem><SelectItem value="DAILY_PERCENTAGE">درصد روزانه</SelectItem></SelectContent></Select></Field>{penaltyTypeValue !== 'NONE' && <Field label={penaltyTypeValue === 'FIXED' ? 'مبلغ ثابت (ریال)' : 'نرخ درصد'}><Input type="number" min="0" value={penaltyValue} onChange={(e) => setPenaltyValue(e.target.value)} /></Field>}<SaveButton onClick={save} disabled={!familyId} /></Editor>
}

function EligibilityRuleForm({ versionId, nextPriority, onSaved }: { versionId: string; nextPriority: number; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [explanation, setExplanation] = useState('')
  const [outcome, setOutcome] = useState('ELIGIBLE')
  const [conditions, setConditions] = useState<DraftCondition[]>([
    { fact: 'ENTITY_TYPE', operator: 'EQ', expected: '' },
  ])

  const updateCondition = (index: number, patch: Partial<DraftCondition>) => {
    setConditions((current) => current.map((condition, position) =>
      position === index ? { ...condition, ...patch } : condition
    ))
  }

  const save = async () => {
    if (!title.trim() || !explanation.trim()) {
      toast.error('عنوان و توضیح سادهٔ قاعده الزامی است.')
      return
    }
    for (const condition of conditions) {
      if (!noValueOperators.has(condition.operator) && !condition.expected.trim()) {
        toast.error('مقدار همهٔ شرط‌ها را وارد کنید.')
        return
      }
      if (numericFacts.has(condition.fact) && !Number.isFinite(Number(condition.expected))) {
        toast.error('مقدار شرط عددی معتبر نیست.')
        return
      }
    }
    const { data: rule, error } = await supabase.from('eligibility_rule_sets').insert({ obligation_version_id: versionId, priority: nextPriority, title: title.trim(), outcome, explanation: explanation.trim() }).select().single()
    if (error) { toast.error(error.message); return }
    const rows = conditions.map((condition, index) => {
      let expectedValue: Json | undefined
      if (!noValueOperators.has(condition.operator)) {
        expectedValue = numericFacts.has(condition.fact)
          ? Number(condition.expected)
          : condition.operator === 'IN'
            ? condition.expected.split(',').map((value) => value.trim()).filter(Boolean)
            : condition.expected.trim()
      }
      return {
        rule_set_id: rule.id,
        sequence: index + 1,
        fact_key: condition.fact,
        operator: condition.operator,
        expected_value: expectedValue,
      }
    })
    const { error: conditionError } = await supabase.from('eligibility_conditions').insert(rows)
    if (conditionError) { await supabase.from('eligibility_rule_sets').delete().eq('id', rule.id); toast.error(conditionError.message); return }
    toast.success('قاعده تشخیص ثبت شد.'); setOpen(false); await onSaved()
  }
  if (!open) return <Button variant="outline" className="mt-4 w-full border-zinc-700 gap-2" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />افزودن قاعده</Button>
  return (
    <div className="mt-4 space-y-3 rounded-xl border border-zinc-800 p-4">
      <Field label="عنوان قاعده"><Input value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
      <Field label="نتیجه"><Select value={outcome} onValueChange={setOutcome}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ELIGIBLE">مشمول</SelectItem><SelectItem value="NOT_ELIGIBLE">غیرمشمول</SelectItem><SelectItem value="REVIEW">نیازمند بررسی</SelectItem></SelectContent></Select></Field>
      <div className="space-y-3">
        {conditions.map((condition, index) => {
          const operatorOptions = allowedOperators(condition.fact)
          return (
            <div key={index} className="rounded-lg border border-zinc-800 p-3">
              <p className="mb-3 text-xs text-zinc-500">شرط {index + 1} (همهٔ شرط‌ها باید برقرار باشند)</p>
              <div className="space-y-3">
                <Field label="بر اساس"><Select value={condition.fact} onValueChange={(fact) => updateCondition(index, { fact, operator: allowedOperators(fact)[0]?.[0] ?? 'EQ', expected: '' })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FACTS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></Field>
                <Field label="شرط"><Select value={condition.operator} onValueChange={(operator) => updateCondition(index, { operator, expected: '' })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{operatorOptions.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></Field>
                {!noValueOperators.has(condition.operator) && <Field label={condition.operator === 'IN' ? 'مقادیر (با ویرگول جدا کنید)' : 'مقدار'}><Input value={condition.expected} onChange={(event) => updateCondition(index, { expected: event.target.value })} /></Field>}
                {conditions.length > 1 && <Button variant="ghost" className="text-red-400" onClick={() => setConditions((current) => current.filter((_, position) => position !== index))}>حذف این شرط</Button>}
              </div>
            </div>
          )
        })}
      </div>
      <Button variant="outline" className="w-full border-zinc-700" onClick={() => setConditions((current) => [...current, { fact: 'ENTITY_TYPE', operator: 'EQ', expected: '' }])}>افزودن شرط دیگر</Button>
      <Field label="توضیح ساده برای کاربر"><Input value={explanation} onChange={(event) => setExplanation(event.target.value)} /></Field>
      <SaveButton onClick={save} />
    </div>
  )
}

function WorkflowStepForm({ version, nextSequence, onSaved }: { version: Version; nextSequence: number; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [code, setCode] = useState('')
  const [actor, setActor] = useState('USER')
  const [fieldLabel, setFieldLabel] = useState('')
  const [fieldKey, setFieldKey] = useState('')
  const [fieldType, setFieldType] = useState('text')
  const save = async () => {
    let { data: template, error } = await supabase.from('workflow_templates').select('*').eq('obligation_version_id', version.id).maybeSingle()
    if (error) { toast.error(error.message); return }
    if (!template) {
      const created = await supabase.from('workflow_templates').insert({ obligation_version_id: version.id, title: 'فرایند ' + version.version_number }).select().single()
      if (created.error) { toast.error(created.error.message); return }
      template = created.data
    }
    const fields: Json[] = fieldLabel.trim() ? [{ key: fieldKey.trim(), label: fieldLabel.trim(), type: fieldType, required: true }] : []
    const result = await supabase.from('workflow_steps').insert({ workflow_template_id: template.id, sequence: nextSequence, code: code.trim().toUpperCase(), title: title.trim(), actor, form_schema: { fields } })
    if (result.error) toast.error(result.error.message)
    else { toast.success('مرحله ثبت شد.'); setOpen(false); await onSaved() }
  }
  if (!open) return <Button variant="outline" className="mt-4 w-full border-zinc-700 gap-2" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />افزودن مرحله</Button>
  return <div className="mt-4 space-y-3 rounded-xl border border-zinc-800 p-4"><Field label="عنوان مرحله"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field><Field label="کد انگلیسی"><Input value={code} onChange={(e) => setCode(e.target.value)} dir="ltr" /></Field><Field label="مسئول انجام"><Select value={actor} onValueChange={setActor}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="USER">کاربر شرکت</SelectItem><SelectItem value="PLATFORM_ADMIN">مدیر پلتفرم</SelectItem><SelectItem value="AUTHORITY">مرجع قانونی / ثبت توسط مدیر</SelectItem></SelectContent></Select></Field><div className="rounded-lg border border-zinc-800 p-3"><p className="mb-3 text-xs text-zinc-500">یک فیلد ضروری برای این مرحله (اختیاری)</p><div className="grid gap-3 sm:grid-cols-2"><Field label="عنوان فیلد"><Input value={fieldLabel} onChange={(e) => setFieldLabel(e.target.value)} /></Field><Field label="کلید انگلیسی"><Input value={fieldKey} onChange={(e) => setFieldKey(e.target.value)} dir="ltr" /></Field><Field label="نوع فیلد"><Select value={fieldType} onValueChange={setFieldType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="text">متن</SelectItem><SelectItem value="number">عدد</SelectItem><SelectItem value="date">تاریخ</SelectItem><SelectItem value="checkbox">تأیید / بله‌خیر</SelectItem></SelectContent></Select></Field></div></div><SaveButton onClick={save} /></div>
}

function Editor({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mb-6 rounded-2xl border border-zinc-800 bg-[#141615] p-5"><h3 className="mb-4 font-bold">{title}</h3><div className="grid gap-4 md:grid-cols-3">{children}</div></section>
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div> }
function SaveButton({ onClick, disabled = false }: { onClick: () => Promise<void>; disabled?: boolean }) { return <div className="flex items-end"><Button disabled={disabled} onClick={() => void onClick()} className="w-full bg-emerald-700 hover:bg-emerald-600">ذخیره</Button></div> }
function Metric({ label, value }: { label: string; value: string | number }) { return <div className="rounded-lg bg-zinc-900/60 p-3"><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 font-bold">{value}</p></div> }
function DefinitionRow({ title, meta }: { title: string; meta: string }) { return <div className="rounded-lg border border-zinc-800 p-3"><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs text-zinc-500">{meta}</p></div> }
function versionStatusLabel(status: string) { return ({ DRAFT: 'پیش‌نویس', REVIEW: 'در بازبینی', TESTING: 'در آزمایش', PUBLISHED: 'منتشرشده', RETIRED: 'منسوخ' } as Record<string, string>)[status] ?? status }
function penaltyType(value: Json) { if (!value || Array.isArray(value) || typeof value !== 'object') return 'نامشخص'; return String(value['type'] ?? 'NONE') }
function actorLabel(actor: string) { return ({ USER: 'کاربر شرکت', PLATFORM_ADMIN: 'مدیر پلتفرم', AUTHORITY: 'مرجع قانونی / مدیر' } as Record<string, string>)[actor] ?? actor }
function allowedOperators(fact: string) {
  const allowed = booleanFacts.has(fact)
    ? new Set(['IS_TRUE', 'IS_FALSE', 'IS_NULL', 'NOT_NULL'])
    : numericFacts.has(fact)
      ? new Set(['EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE', 'IS_NULL', 'NOT_NULL'])
      : arrayFacts.has(fact)
        ? new Set(['CONTAINS', 'IS_NULL', 'NOT_NULL'])
        : new Set(['EQ', 'NEQ', 'IN', 'IS_NULL', 'NOT_NULL'])
  return OPERATORS.filter(([value]) => allowed.has(value))
}
