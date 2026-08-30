import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  FileText,
  GitBranch,
  Layers,
  Link2,
  ListChecks,
  Pencil,
  Plus,
  Rocket,
  Save,
  Search,
  Settings2,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '../../../lib/shadcn/button'
import type {
  ObjectionTemplate,
  ObjectionStep,
  ObjectionStage,
  ObjectionStatusGroup,
  ObjectionStatusGroupOption,
  StepTransition,
  ConditionExpression,
  ConditionClause,
  WorkflowStepField,
} from '../../../lib/supabase'
import {
  createObjectionTemplate,
  updateObjectionTemplate,
  updateBaseObjectionTemplate,
  activateObjectionTemplate,
  fetchDesignerObligations,
  fetchActiveObjectionLinks,
  fetchRoleLabels,
  type ObjectionTemplateWrite,
  type StudioObligationOption,
  type ActiveObjectionLink,
} from '../../../lib/supabaseDb'

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const WIZARD_STEPS = [
  { key: 'specs', icon: FileText, title: 'مشخصات الگو' },
  { key: 'stages', icon: Layers, title: 'مراحل و مسیر' },
  { key: 'action', icon: Settings2, title: 'تنظیمات اقدام' },
  { key: 'routes', icon: GitBranch, title: 'شروط و مسیرها' },
  { key: 'links', icon: Link2, title: 'تعهدات متصل' },
  { key: 'review', icon: CheckCircle2, title: 'بررسی و ثبت' },
] as const

const NATURE_OPTIONS: { value: string; label: string }[] = [
  { value: 'MANDATORY', label: 'الزامی' },
  { value: 'OPTIONAL', label: 'اختیاری' },
  { value: 'DEADLINE', label: 'مهلت قانونی' },
  { value: 'CONDITIONAL_EXPERT', label: 'مشروط (قرار کارشناسی)' },
  { value: 'AGREEMENT_END', label: 'پایان: توافق' },
  { value: 'SETTLEMENT_END', label: 'پایان: تمکین' },
  { value: 'EXPIRED_END', label: 'پایان: انقضای مهلت' },
  { value: 'FINAL_NOTICE_ISSUANCE', label: 'صدور برگه قطعی' },
  { value: 'NEXT_STAGE', label: 'انتقال به مرحله بعد' },
]

const TRIGGER_OPTIONS: { value: string; label: string }[] = [
  { value: 'USER_ACTION', label: 'اقدام کاربر' },
  { value: 'TIMEOUT_AUTO', label: 'انقضای مهلت (خودکار)' },
]

const TERMINAL_TARGETS: { value: string; label: string }[] = [
  { value: 'TERMINAL_AGREED', label: 'پایان: توافق' },
  { value: 'TERMINAL_SETTLED', label: 'پایان: تمکین و پرداخت' },
  { value: 'TERMINAL_EXPIRED', label: 'پایان: انقضای مهلت' },
  { value: 'TERMINAL_FINAL', label: 'پایان: صدور برگ قطعی' },
]

const SOURCE_OPTIONS: { value: ConditionClause['source']; label: string }[] = [
  { value: 'FACT', label: 'اطلاعات شرکت (فکت)' },
  { value: 'CASE_DATA', label: 'داده پرونده' },
  { value: 'STEP_OUTPUT', label: 'خروجی اقدام قبلی' },
]

const OPERATOR_OPTIONS: { value: string; label: string }[] = [
  { value: 'eq', label: 'برابر است با' },
  { value: 'neq', label: 'برابر نیست با' },
  { value: 'gt', label: 'بزرگ‌تر از' },
  { value: 'lt', label: 'کوچک‌تر از' },
  { value: 'gte', label: 'بزرگ‌تر یا مساوی' },
  { value: 'lte', label: 'کوچک‌تر یا مساوی' },
  { value: 'contains', label: 'شامل' },
  { value: 'in', label: 'یکی از' },
  { value: 'is_true', label: 'بله / درست' },
  { value: 'is_false', label: 'خیر / نادرست' },
]

const KNOWN_ACTOR_VALUES = [
  'مودی مالیاتی',
  'سازمان امور مالیاتی',
  'هیأت حل اختلاف بدوی',
  'هیأت حل اختلاف عالی',
  'دیوان عدالت اداری',
  'کارشناس رسمی دادگستری',
  'واحد ابلاغ',
  'موتور خودکار',
]

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function newStep(): ObjectionStep {
  return {
    id: newId('step'),
    title: 'اقدام جدید',
    base_event: 'تاریخ وقوع رویداد',
    gap_value: 0,
    gap_unit: 'روز',
    step_nature: 'MANDATORY',
    actor: '',
    fields: [],
    transitions: [],
  }
}

function newStage(): ObjectionStage {
  return { id: newId('stage'), template_id: '', title: 'مرحله جدید', sort_order: 0 }
}

function newCondition(): ConditionExpression {
  return { version: 1, logic: 'AND', clauses: [] }
}

function newClause(): ConditionClause {
  return { id: newId('c'), source: 'FACT', field_key: '', operator: 'eq', value: '' }
}

const EMPTY_EXPRESSION: ConditionExpression = { version: 1, logic: 'AND', clauses: [] }

function expressionHasClauses(expr: ConditionExpression | null | undefined): boolean {
  return !!expr && Array.isArray(expr.clauses) && expr.clauses.length > 0
}

function conditionSummary(expr: ConditionExpression | null | undefined): string {
  if (!expressionHasClauses(expr)) return ''
  const parts = (expr!.clauses as ConditionClause[]).map((c) => {
    const op = OPERATOR_OPTIONS.find((o) => o.value === c.operator)?.label ?? c.operator
    const field = c.field_label || c.field_key || '؟'
    const val = Array.isArray(c.value) ? c.value.join('، ') : String(c.value ?? '')
    return `${field} ${op} ${val}`
  })
  return parts.join(expr!.logic === 'AND' ? ' و ' : ' یا ')
}

// ---------------------------------------------------------------------------
// Small local UI atoms
// ---------------------------------------------------------------------------

function SectionCard({ title, icon: Icon, onEdit, children }: {
  title: string
  icon?: typeof FileText
  onEdit?: () => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-[#1d1a18] p-5">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-sm font-bold text-zinc-100">
          {Icon && <Icon className="h-4 w-4 text-amber-400" />}
          {title}
        </h4>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 px-2.5 py-1 text-[11px] font-semibold text-zinc-300 transition hover:border-amber-500/60 hover:text-amber-300"
          >
            <Pencil className="h-3 w-3" />
            ویرایش
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <label className="mb-1.5 block text-xs font-semibold text-zinc-400">
      {children}
      {hint && <span className="mr-1 text-[10px] font-normal text-zinc-600">{hint}</span>}
    </label>
  )
}

const inputCls =
  'w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-amber-500'

// ---------------------------------------------------------------------------
// Condition builder modal (سه سؤال: چه اتفاقی افتاد؟ چه شرطی برقرار باشد؟ سپس چه کاری؟)
// ---------------------------------------------------------------------------

function ConditionBuilderModal({
  expression,
  availableFields,
  onClose,
  onSave,
}: {
  expression: ConditionExpression | null
  availableFields: { key: string; label: string; source: ConditionClause['source'] }[]
  onClose: () => void
  onSave: (expr: ConditionExpression) => void
}) {
  const [logic, setLogic] = useState<'AND' | 'OR'>(expression?.logic ?? 'AND')
  const [clauses, setClauses] = useState<ConditionClause[]>(
    expressionHasClauses(expression) ? [...(expression!.clauses as ConditionClause[])] : [newClause()]
  )

  const updateClause = (id: string, patch: Partial<ConditionClause>) => {
    setClauses((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  const fieldSourceFor = (fieldKey: string): ConditionClause['source'] => {
    const field = availableFields.find((f) => f.key === fieldKey || f.label === fieldKey)
    return field?.source ?? 'FACT'
  }

  const valueControl = (clause: ConditionClause) => {
    if (clause.operator === 'is_true' || clause.operator === 'is_false') return null
    return (
      <div className="flex flex-col gap-1.5">
        <FieldLabel>مقدار شرط</FieldLabel>
        <input
          className={inputCls}
          dir="rtl"
          placeholder="مثلاً: حقوقی"
          value={Array.isArray(clause.value) ? clause.value.join('، ') : String(clause.value ?? '')}
          onChange={(e) => updateClause(clause.id, { value: e.target.value })}
        />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-700 bg-[#1d1a18] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-bold text-zinc-100">
            <GitBranch className="h-4 w-4 text-amber-400" />
            تعریف شرط مسیر
          </h3>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 rounded-xl border border-blue-900/50 bg-blue-950/20 p-3 text-xs leading-6 text-blue-100">
          <b>نکته:</b> شرط به‌صورت ساختاریافته ذخیره می‌شود؛ موتور اجرای شروط هنوز ساخته نشده است، بنابراین
          الگوی دارای شرط فقط به‌صورت <b>پیش‌نویس</b> ذخیره می‌شود و قابل فعال‌سازی نیست.
        </div>

        <div className="mb-4 flex items-center gap-2 text-xs">
          <span className="text-zinc-400">ترکیب شروط:</span>
          {(['AND', 'OR'] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLogic(l)}
              className={`rounded-lg px-3 py-1.5 font-semibold transition ${
                logic === l ? 'bg-amber-600 text-white' : 'border border-zinc-700 text-zinc-300 hover:border-amber-500/60'
              }`}
            >
              {l === 'AND' ? 'همه (و)' : 'هر یک (یا)'}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {clauses.map((clause, index) => (
            <div key={clause.id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[11px] font-bold text-zinc-500">شرط {index + 1}</span>
                {clauses.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setClauses((prev) => prev.filter((c) => c.id !== clause.id))}
                    className="text-zinc-600 transition hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="grid gap-3">
                <div>
                  <FieldLabel>۱. چه اتفاقی افتاد؟ (منبع)</FieldLabel>
                  <select
                    className={inputCls}
                    value={clause.source}
                    onChange={(e) => updateClause(clause.id, { source: e.target.value as ConditionClause['source'] })}
                  >
                    {SOURCE_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <FieldLabel>۲. چه شرطی برقرار باشد؟ (فیلد + عملگر + مقدار)</FieldLabel>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <input
                      className={inputCls}
                      dir="rtl"
                      placeholder="فیلد (مثلاً: نوع شخصیت)"
                      list="wizard-field-list"
                      value={clause.field_label || clause.field_key}
                      onChange={(e) => {
                        const label = e.target.value
                        const match = availableFields.find((f) => f.label === label || f.key === label)
                        updateClause(clause.id, {
                          field_label: label,
                          field_key: match?.key ?? label,
                          source: match?.source ?? fieldSourceFor(label),
                        })
                      }}
                    />
                    <datalist id="wizard-field-list">
                      {availableFields.map((f) => (
                        <option key={f.key + f.label} value={f.label}>{f.key}</option>
                      ))}
                    </datalist>
                    <select
                      className={inputCls}
                      value={clause.operator}
                      onChange={(e) => updateClause(clause.id, { operator: e.target.value })}
                    >
                      {OPERATOR_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    {valueControl(clause)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => setClauses((prev) => [...prev, newClause()])}
            className="border-zinc-700 text-zinc-300"
          >
            <Plus className="h-4 w-4" />
            افزودن شرط دیگر
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>انصراف</Button>
            <Button
              onClick={() => onSave({ version: 1, logic, clauses: clauses.filter((c) => c.field_key || c.field_label) })}
              className="bg-amber-600 hover:bg-amber-500"
            >
              ذخیره شرط
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Action fields editor (فرم/فیلدهای اختصاصی اقدام)
// ---------------------------------------------------------------------------

function ActionFieldsEditor({ fields, onChange }: {
  fields: WorkflowStepField[]
  onChange: (fields: WorkflowStepField[]) => void
}) {
  const update = (id: string, patch: Partial<WorkflowStepField>) => {
    onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }

  return (
    <div className="space-y-2">
      {fields.length === 0 && (
        <p className="rounded-lg border border-dashed border-zinc-700 p-3 text-xs text-zinc-500">
          هنوز فیلدی تعریف نشده است. با «افزودن فیلد» فرم اختصاصی این اقدام را بسازید.
        </p>
      )}
      {fields.map((field) => (
        <div key={field.id} className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 sm:flex-row sm:items-center">
          <input
            className={`${inputCls} sm:w-52`}
            dir="rtl"
            value={field.label}
            onChange={(e) => update(field.id, { label: e.target.value })}
            placeholder="عنوان فارسی فیلد"
          />
          <input
            className={`${inputCls} font-mono text-xs sm:w-44`}
            dir="ltr"
            value={field.key}
            onChange={(e) => update(field.id, { key: e.target.value })}
            placeholder="field_key"
          />
          <select
            className={`${inputCls} sm:w-40`}
            value={field.type}
            onChange={(e) => update(field.id, { type: e.target.value as WorkflowStepField['type'] })}
          >
            {['text', 'number', 'date', 'select', 'multiselect', 'boolean'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={field.required === true}
              onChange={(e) => update(field.id, { required: e.target.checked })}
              className="accent-amber-500"
            />
            الزامی
          </label>
          <button
            type="button"
            onClick={() => onChange(fields.filter((f) => f.id !== field.id))}
            className="mr-auto text-zinc-600 transition hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <Button
        variant="outline"
        onClick={() =>
          onChange([
            ...fields,
            {
              id: newId('f'),
              label: 'فیلد ورودی',
              key: `field_${fields.length + 1}`,
              type: 'text',
              required: false,
            },
          ])
        }
        className="border-zinc-700 text-zinc-300"
      >
        <Plus className="h-4 w-4" />
        افزودن فیلد
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Status groups editor (تعریف-محور، اختیاری)
// ---------------------------------------------------------------------------

function StatusGroupsEditor({
  groups,
  onChange,
}: {
  groups: ObjectionStatusGroup[]
  onChange: (groups: ObjectionStatusGroup[]) => void
}) {
  const updateGroup = (id: string, patch: Partial<ObjectionStatusGroup>) => {
    onChange(groups.map((g) => (g.id === id ? { ...g, ...patch } : g)))
  }
  const updateOption = (groupId: string, optionId: string, patch: Partial<ObjectionStatusGroupOption>) => {
    onChange(
      groups.map((g) =>
        g.id === groupId
          ? { ...g, options: g.options.map((o) => (o.id === optionId ? { ...o, ...patch } : o)) }
          : g
      )
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs leading-6 text-zinc-500">
        گروه‌های وضعیت فقط برای همین الگو تعریف می‌شوند (اختیاری). هر گروه و گزینه شناسه پایدار دارد؛ تغییر
        عنوان، ارجاع‌ها را خراب نمی‌کند. وضعیت واقعی پرونده در اینجا ذخیره نمی‌شود.
      </p>
      {groups.length === 0 && (
        <p className="rounded-lg border border-dashed border-zinc-700 p-3 text-xs text-zinc-500">
          گروه وضعیتی تعریف نشده است.
        </p>
      )}
      {groups.map((group) => (
        <div key={group.id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              className={`${inputCls} sm:w-72`}
              dir="rtl"
              value={group.title}
              onChange={(e) => updateGroup(group.id, { title: e.target.value })}
              placeholder="عنوان گروه وضعیت"
            />
            <input
              className={`${inputCls} font-mono text-xs sm:w-40`}
              dir="ltr"
              value={group.code}
              onChange={(e) => updateGroup(group.id, { code: e.target.value })}
              placeholder="code (ثابت)"
            />
            <button
              type="button"
              onClick={() => onChange(groups.filter((g) => g.id !== group.id))}
              className="mr-auto text-zinc-600 transition hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-2">
            {group.options.map((option) => (
              <div key={option.id} className="flex items-center gap-2">
                <input
                  className={`${inputCls} flex-1`}
                  dir="rtl"
                  value={option.title}
                  onChange={(e) => updateOption(group.id, option.id, { title: e.target.value })}
                  placeholder="عنوان گزینه وضعیت"
                />
                <label className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                  <input
                    type="checkbox"
                    checked={option.is_terminal === true}
                    onChange={(e) => updateOption(group.id, option.id, { is_terminal: e.target.checked })}
                    className="accent-amber-500"
                  />
                  پایانی
                </label>
                <button
                  type="button"
                  onClick={() =>
                    updateGroup(group.id, { options: group.options.filter((o) => o.id !== option.id) })
                  }
                  className="text-zinc-600 transition hover:text-red-400"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button
              variant="outline"
              onClick={() =>
                updateGroup(group.id, {
                  options: [...group.options, { id: newId('opt'), title: 'گزینه جدید', is_terminal: false }],
                })
              }
              className="border-zinc-700 text-zinc-300"
            >
              <Plus className="h-4 w-4" />
              افزودن گزینه
            </Button>
          </div>
        </div>
      ))}
      <Button
        variant="outline"
        onClick={() =>
          onChange([...groups, { id: newId('sg'), code: `status_${groups.length + 1}`, title: 'گروه وضعیت', options: [], sort_order: groups.length }])
        }
        className="border-zinc-700 text-zinc-300"
      >
        <Plus className="h-4 w-4" />
        افزودن گروه وضعیت
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Wizard main component
// ---------------------------------------------------------------------------

interface WizardDraft {
  templateName: string
  description: string
  stages: ObjectionStage[]
  steps: ObjectionStep[]
  statusGroups: ObjectionStatusGroup[]
  obligationIds: string[]
}

export default function ObjectionTemplateWizard({
  mode,
  initial,
  isBaseTemplate,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit'
  initial: ObjectionTemplate | null
  isBaseTemplate: boolean
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [stepIndex, setStepIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [activating, setActivating] = useState(false)
  const [persistedId, setPersistedId] = useState<string | null>(initial?.id ?? null)
  const [dirty, setDirty] = useState(false)
  const [conditionEditor, setConditionEditor] = useState<{ stepId: string; transitionId: string } | null>(null)
  const [activeActionId, setActiveActionId] = useState<string | null>(null)
  const [confirmReplace, setConfirmReplace] = useState<ActiveObjectionLink[] | null>(null)

  const [draft, setDraft] = useState<WizardDraft>(() => ({
    templateName: initial?.template_name ?? '',
    description: initial?.description ?? '',
    stages: initial?.stages ?? [],
    steps: (initial?.steps ?? []).map((s) => ({
      ...s,
      transitions: s.transitions ?? [],
      fields: s.fields ?? [],
    })),
    statusGroups: initial?.status_groups ?? [],
    obligationIds:
      (initial?.links ?? [])
        .filter((l) => l.link_status === 'DRAFT' || l.link_status === 'ACTIVE')
        .map((l) => l.obligation_id),
  }))

  const [obligations, setObligations] = useState<StudioObligationOption[]>([])
  const [activeLinks, setActiveLinks] = useState<ActiveObjectionLink[]>([])
  const [roleLabels, setRoleLabels] = useState<string[]>([])
  const [obligationSearch, setObligationSearch] = useState('')

  const dirtyRef = useRef(false)

  const patch = useCallback((p: Partial<WizardDraft>) => {
    setDraft((prev) => ({ ...prev, ...p }))
    dirtyRef.current = true
    setDirty(true)
  }, [])

  useEffect(() => {
    void (async () => {
      const [obs, links, roles] = await Promise.all([
        fetchDesignerObligations(),
        fetchActiveObjectionLinks(),
        fetchRoleLabels(),
      ])
      setObligations(obs)
      setActiveLinks(links)
      setRoleLabels(roles.map((r) => r.persian_label).filter(Boolean))
    })()
  }, [])

  const unsupportedConditions = useMemo(() => {
    return draft.steps.some((step) =>
      (step.transitions ?? []).some((t) => expressionHasClauses(t.condition_expression))
    )
  }, [draft.steps])

  const stepsByStage = useMemo(() => {
    const groups: { stage: ObjectionStage | null; steps: ObjectionStep[] }[] = []
    for (const stage of draft.stages) {
      groups.push({ stage, steps: draft.steps.filter((s) => s.stage_id === stage.id) })
    }
    const ungrouped = draft.steps.filter((s) => !s.stage_id || !draft.stages.some((st) => st.id === s.stage_id))
    if (ungrouped.length > 0) groups.push({ stage: null, steps: ungrouped })
    return groups
  }, [draft.stages, draft.steps])

  const selectedAction = useMemo(
    () => draft.steps.find((s) => s.id === activeActionId) ?? null,
    [draft.steps, activeActionId]
  )

  const availableConditionFields = useMemo(() => {
    const fields: { key: string; label: string; source: ConditionClause['source'] }[] = []
    for (const step of draft.steps) {
      for (const f of step.fields ?? []) {
        fields.push({ key: f.key || f.label, label: f.label, source: 'STEP_OUTPUT' })
      }
    }
    fields.push({ key: 'entity_type', label: 'نوع شخصیت شرکت', source: 'FACT' })
    fields.push({ key: 'legal_form', label: 'قالب ثبتی', source: 'FACT' })
    fields.push({ key: 'activity_codes', label: 'کد فعالیت', source: 'FACT' })
    return fields
  }, [draft.steps])

  const handleSaveDraft = async (): Promise<string | null> => {
    if (!draft.templateName.trim()) {
      toast.error('عنوان الگو را وارد کنید.')
      setStepIndex(0)
      return null
    }
    if (draft.steps.length === 0) {
      toast.error('حداقل یک اقدام در مسیر تعریف کنید.')
      setStepIndex(1)
      return null
    }
    setSaving(true)
    try {
      const payload: ObjectionTemplateWrite = {
        template_name: draft.templateName.trim(),
        description: draft.description.trim() || undefined,
        steps: draft.steps,
        stages: isBaseTemplate ? undefined : draft.stages,
        statusGroups: isBaseTemplate ? undefined : draft.statusGroups,
        obligationIds: isBaseTemplate ? undefined : draft.obligationIds,
      }
      let id: string
      if (isBaseTemplate && persistedId?.startsWith('db-')) {
        await updateBaseObjectionTemplate(persistedId, payload)
        id = persistedId
      } else if (persistedId && !persistedId.startsWith('db-')) {
        await updateObjectionTemplate(persistedId, payload)
        id = persistedId
      } else {
        const data = await createObjectionTemplate(payload)
        id = data.id
      }
      setPersistedId(id)
      dirtyRef.current = false
      setDirty(false)
      toast.success('پیش‌نویس الگو ذخیره شد.')
      return id
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ذخیره الگو انجام نشد.')
      return null
    } finally {
      setSaving(false)
    }
  }

  const handleActivate = async (replace = false) => {
    if (unsupportedConditions) {
      toast.error('الگوی دارای شروط پشتیبانی‌نشده قابل فعال‌سازی نیست؛ ابتدا شروط را حذف کنید.')
      setStepIndex(3)
      return
    }
    setActivating(true)
    try {
      const savedId = await handleSaveDraft()
      if (!savedId) return
      if (savedId.startsWith('db-')) {
        toast.error('الگوهای قانونی پایه از مسیر فعال‌سازی جدا هستند.')
        return
      }
      const res = await activateObjectionTemplate(savedId, draft.obligationIds, replace)
      if (!res.ok) {
        const msg = res.message ?? ''
        if (!replace && (msg.includes('اتصال فعال') || msg.includes('23505'))) {
          const conflicting = activeLinks.filter((l) => draft.obligationIds.includes(l.obligation_id))
          setConfirmReplace(conflicting.length > 0 ? conflicting : [{ obligation_id: '', template_id: '', template_title: '' }])
        } else {
          toast.error(msg)
        }
        return
      }
      toast.success('الگو با موفقیت فعال شد.')
      await onSaved()
      onClose()
    } finally {
      setActivating(false)
    }
  }

  const handleSaveDraftBtn = () => { void handleSaveDraft() }

  const handleClose = () => {
    if (dirtyRef.current && !window.confirm('تغییرات ذخیره‌نشده دارید. خارج می‌شوید؟')) return
    onClose()
  }

  const updateStep = (id: string, stepPatch: Partial<ObjectionStep>) => {
    patch({ steps: draft.steps.map((s) => (s.id === id ? { ...s, ...stepPatch } : s)) })
  }

  const moveStep = (id: string, dir: -1 | 1) => {
    const index = draft.steps.findIndex((s) => s.id === id)
    const target = index + dir
    if (index === -1 || target < 0 || target >= draft.steps.length) return
    const next = [...draft.steps]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    patch({ steps: next })
  }

  const duplicateStep = (id: string) => {
    const source = draft.steps.find((s) => s.id === id)
    if (!source) return
    const copy: ObjectionStep = {
      ...source,
      id: newId('step'),
      title: `${source.title} (کپی)`,
      fields: (source.fields ?? []).map((f) => ({ ...f, id: newId('f') })),
      transitions: (source.transitions ?? []).map((t) => ({ ...t, id: newId('tr') })),
    }
    const index = draft.steps.findIndex((s) => s.id === id)
    const next = [...draft.steps]
    next.splice(index + 1, 0, copy)
    patch({ steps: next })
  }

  const updateTransition = (stepId: string, transitionId: string, patchData: Partial<StepTransition>) => {
    updateStep(stepId, {
      transitions: (draft.steps.find((s) => s.id === stepId)?.transitions ?? []).map((t) =>
        t.id === transitionId ? { ...t, ...patchData } : t
      ),
    })
  }

  const addTransition = (stepId: string) => {
    const step = draft.steps.find((s) => s.id === stepId)
    if (!step) return
    updateStep(stepId, {
      transitions: [
        ...(step.transitions ?? []),
        {
          id: newId('tr'),
          title: 'ادامه',
          trigger_type: 'USER_ACTION',
          target_type: 'STEP',
          action_label: 'ادامه مسیر',
        } as StepTransition,
      ],
    })
  }

  const removeTransition = (stepId: string, transitionId: string) => {
    updateStep(stepId, {
      transitions: (draft.steps.find((s) => s.id === stepId)?.transitions ?? []).filter((t) => t.id !== transitionId),
    })
  }

  const actorOptions = useMemo(() => {
    const set = new Set<string>(KNOWN_ACTOR_VALUES)
    for (const step of draft.steps) if (step.actor) set.add(step.actor)
    for (const role of roleLabels) set.add(role)
    return Array.from(set)
  }, [draft.steps, roleLabels])

  const validationErrors = useMemo(() => {
    const errors: string[] = []
    if (!draft.templateName.trim()) errors.push('عنوان الگو خالی است')
    if (draft.steps.length === 0) errors.push('هیچ اقدامی تعریف نشده است')
    const unnamed = draft.steps.filter((s) => !s.title.trim())
    if (unnamed.length > 0) errors.push(`${unnamed.length} اقدام بدون عنوان دارد`)
    const noTarget = draft.steps.flatMap((s) =>
      (s.transitions ?? [])
        .filter((t) => t.target_type === 'STEP' && !t.target_step_id)
        .map(() => `اقدام «${s.title}» انتقالی بدون مقصد دارد`)
    )
    errors.push(...noTarget)
    if (unsupportedConditions) errors.push('الگو دارای شرط است — فقط پیش‌نویس می‌ماند و قابل فعال‌سازی نیست')
    return errors
  }, [draft, unsupportedConditions])

  const canActivate = validationErrors.length === 0

  const activeLinksByObligation = useMemo(() => {
    const map = new Map<string, ActiveObjectionLink>()
    for (const link of activeLinks) map.set(link.obligation_id, link)
    return map
  }, [activeLinks])

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------
  const step = WIZARD_STEPS[stepIndex]

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden" style={{ background: '#181614' }}>
      {/* Header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-800 px-6" style={{ background: '#211d1a' }}>
        <div className="flex items-center gap-3">
          <button type="button" onClick={handleClose} className="text-zinc-400 transition hover:text-zinc-100" aria-label="بازگشت">
            <ArrowRight className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-base font-bold text-zinc-100">
              {mode === 'edit' ? 'ویرایش الگوی فرایند' : 'افزودن الگوی فرایند جدید'}
            </h2>
            <p className="text-xs text-zinc-500">
              {isBaseTemplate ? 'الگوی قانونی پایه (فقط مراحل و اقدام‌ها)' : 'تعریف عمومی الگو — مرحله، اقدام، شرط و تعهدات'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isBaseTemplate && (
            <Button
              onClick={handleSaveDraftBtn}
              disabled={saving}
              variant="outline"
              className="border-zinc-700 text-zinc-300"
            >
              <Save className="h-4 w-4" />
              ذخیره پیش‌نویس
            </Button>
          )}
          {!isBaseTemplate && (
            <Button
              onClick={() => void handleActivate(false)}
              disabled={saving || activating || !canActivate}
              className="bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40"
              title={canActivate ? 'فعال‌سازی الگو' : validationErrors.join(' | ')}
            >
              <Rocket className="h-4 w-4" />
              فعال‌سازی
            </Button>
          )}
        </div>
      </div>

      {/* Stepper */}
      <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-zinc-800 bg-[#1d1a18] px-4 py-3">
        {WIZARD_STEPS.map((s, i) => {
          const isActive = i === stepIndex
          const isDone = i < stepIndex
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setStepIndex(i)}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                isActive
                  ? 'border border-amber-500/50 bg-amber-500/10 text-amber-300'
                  : isDone
                    ? 'border border-zinc-700/60 text-zinc-300 hover:border-zinc-600'
                    : 'border border-transparent text-zinc-600 hover:text-zinc-400'
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-amber-500 text-zinc-950' : isDone ? 'bg-emerald-600/80 text-white' : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {isDone ? '✓' : i + 1}
              </span>
              <s.icon className="h-3.5 w-3.5" />
              {s.title}
            </button>
          )
        })}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-5xl space-y-5">
          {/* ── STEP 1: مشخصات الگو ── */}
          {stepIndex === 0 && (
            <>
              <SectionCard title="مشخصات الگو" icon={FileText}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <FieldLabel>عنوان الگو *</FieldLabel>
                    <input
                      className={inputCls}
                      dir="rtl"
                      value={draft.templateName}
                      onChange={(e) => patch({ templateName: e.target.value })}
                      placeholder="مثلاً: فرایند اعتراض و رسیدگی"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <FieldLabel>توضیح الگو</FieldLabel>
                    <textarea
                      className={`${inputCls} min-h-24 resize-y`}
                      dir="rtl"
                      value={draft.description}
                      onChange={(e) => patch({ description: e.target.value })}
                      placeholder="هدف و کاربرد این الگو را بنویسید"
                    />
                  </div>
                </div>
                <p className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-xs leading-6 text-zinc-500">
                  نام مرحله‌ها، اقدام‌ها، نتیجه‌ها و فیلدها را شما تعیین می‌کنید — فرم به یک موضوع خاص (مالیات، بیمه
                  و…) محدود نیست. تنظیمات تخصصی (کلید انگلیسی، شرط‌ها) در بخش‌های بعدی قرار دارند.
                </p>
              </SectionCard>
            </>
          )}

          {/* ── STEP 2: مراحل و مسیر اصلی ── */}
          {stepIndex === 1 && (
            <>
              {!isBaseTemplate && (
                <SectionCard title="مراحل (گروه اقدام‌ها)" icon={Layers}>
                  <div className="space-y-2">
                    {draft.stages.map((stage, index) => (
                      <div key={stage.id} className="flex items-center gap-2">
                        <input
                          className={`${inputCls} flex-1`}
                          dir="rtl"
                          value={stage.title}
                          onChange={(e) =>
                            patch({ stages: draft.stages.map((s) => (s.id === stage.id ? { ...s, title: e.target.value } : s)) })
                          }
                          placeholder="عنوان مرحله"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const next = [...draft.stages]
                            const [item] = next.splice(index, 1)
                            next.splice(index - 1, 0, item)
                            patch({ stages: next })
                          }}
                          disabled={index === 0}
                          className="rounded-lg border border-zinc-800 p-2 text-zinc-500 transition hover:text-zinc-300 disabled:opacity-30"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const next = [...draft.stages]
                            const [item] = next.splice(index, 1)
                            next.splice(index + 1, 0, item)
                            patch({ stages: next })
                          }}
                          disabled={index === draft.stages.length - 1}
                          className="rounded-lg border border-zinc-800 p-2 text-zinc-500 transition hover:text-zinc-300 disabled:opacity-30"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => patch({ stages: draft.stages.filter((s) => s.id !== stage.id) })}
                          className="rounded-lg border border-zinc-800 p-2 text-zinc-500 transition hover:text-red-400"
                          title="حذف مرحله (اقدام‌هایش باقی می‌مانند)"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      onClick={() => patch({ stages: [...draft.stages, newStage()] })}
                      className="border-zinc-700 text-zinc-300"
                    >
                      <Plus className="h-4 w-4" />
                      افزودن مرحله
                    </Button>
                  </div>
                </SectionCard>
              )}

              <SectionCard title="اقدام‌های مسیر" icon={ListChecks}>
                {stepsByStage.map((group) => (
                  <div key={group.stage?.id ?? 'ungrouped'} className="mb-4">
                    <h5 className="mb-2 flex items-center gap-2 text-xs font-bold text-zinc-400">
                      {group.stage ? (
                        <>
                          <Layers className="h-3.5 w-3.5 text-amber-400" />
                          {group.stage.title}
                        </>
                      ) : (
                        <>
                          <Layers className="h-3.5 w-3.5 text-zinc-600" />
                          بدون مرحله
                        </>
                      )}
                      <span className="text-[10px] font-normal text-zinc-600">({group.steps.length} اقدام)</span>
                    </h5>
                    <div className="space-y-2">
                      {group.steps.map((step, index) => (
                        <div
                          key={step.id}
                          className={`flex flex-col gap-2 rounded-xl border p-3 transition sm:flex-row sm:items-center ${
                            activeActionId === step.id
                              ? 'border-amber-500/50 bg-amber-500/5'
                              : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => { setActiveActionId(step.id); setStepIndex(2) }}
                            className="flex flex-1 items-center gap-2 text-right"
                          >
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-bold text-zinc-400">
                              {index + 1}
                            </span>
                            <span className="flex-1 truncate text-sm font-semibold text-zinc-100">{step.title || 'اقدام بدون عنوان'}</span>
                            <span className="hidden text-[11px] text-zinc-500 sm:block">{step.actor || 'مسئول نامشخص'}</span>
                          </button>
                          <div className="flex items-center gap-1.5">
                            <button type="button" onClick={() => duplicateStep(step.id)} className="rounded-lg border border-zinc-800 p-1.5 text-zinc-500 transition hover:text-zinc-300" title="تکثیر">
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => moveStep(step.id, -1)} disabled={index === 0} className="rounded-lg border border-zinc-800 p-1.5 text-zinc-500 transition hover:text-zinc-300 disabled:opacity-30">
                              <ChevronUp className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => moveStep(step.id, 1)} disabled={index === group.steps.length - 1} className="rounded-lg border border-zinc-800 p-1.5 text-zinc-500 transition hover:text-zinc-300 disabled:opacity-30">
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => patch({ steps: draft.steps.filter((s) => s.id !== step.id) })} className="rounded-lg border border-zinc-800 p-1.5 text-zinc-500 transition hover:text-red-400" title="حذف اقدام">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  onClick={() => patch({ steps: [...draft.steps, newStep()] })}
                  className="border-zinc-700 text-zinc-300"
                >
                  <Plus className="h-4 w-4" />
                  افزودن اقدام
                </Button>
              </SectionCard>
            </>
          )}

          {/* ── STEP 3: تنظیمات اقدام ── */}
          {stepIndex === 2 && (
            <>
              {!selectedAction ? (
                <div className="rounded-2xl border border-dashed border-zinc-700 p-10 text-center text-sm text-zinc-500">
                  از فهرست «مراحل و مسیر» یک اقدام را انتخاب کنید یا اقدام جدید بسازید.
                </div>
              ) : (
                <>
                  <SectionCard title={`تنظیمات اقدام: ${selectedAction.title}`} icon={Settings2}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <FieldLabel>عنوان اقدام *</FieldLabel>
                        <input
                          className={inputCls}
                          dir="rtl"
                          value={selectedAction.title}
                          onChange={(e) => updateStep(selectedAction.id, { title: e.target.value })}
                        />
                      </div>
                      <div>
                        <FieldLabel>مسئول / مرجع اقدام</FieldLabel>
                        <input
                          className={inputCls}
                          dir="rtl"
                          list="wizard-actor-list"
                          value={selectedAction.actor ?? ''}
                          onChange={(e) => updateStep(selectedAction.id, { actor: e.target.value })}
                          placeholder="از نقش‌ها یا مراجع تعریف‌شده"
                        />
                        <datalist id="wizard-actor-list">
                          {actorOptions.map((a) => (
                            <option key={a} value={a} />
                          ))}
                        </datalist>
                      </div>
                      <div>
                        <FieldLabel>ماهیت اقدام</FieldLabel>
                        <select
                          className={inputCls}
                          value={selectedAction.step_nature ?? 'MANDATORY'}
                          onChange={(e) => updateStep(selectedAction.id, { step_nature: e.target.value })}
                        >
                          {NATURE_OPTIONS.map((n) => (
                            <option key={n.value} value={n.value}>{n.label}</option>
                          ))}
                          {!NATURE_OPTIONS.some((n) => n.value === selectedAction.step_nature) && (
                            <option value={selectedAction.step_nature}>{selectedAction.step_nature}</option>
                          )}
                        </select>
                      </div>
                      <div className="flex items-end pb-1">
                        <label className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                          <input
                            type="checkbox"
                            checked={selectedAction.is_skippable === true}
                            onChange={(e) => updateStep(selectedAction.id, { is_skippable: e.target.checked })}
                            className="accent-amber-500"
                          />
                          اقدام اختیاری
                        </label>
                      </div>
                      {!isBaseTemplate && (
                        <div>
                          <FieldLabel>مرحله (گروه)</FieldLabel>
                          <select
                            className={inputCls}
                            value={selectedAction.stage_id ?? ''}
                            onChange={(e) => updateStep(selectedAction.id, { stage_id: e.target.value || null })}
                          >
                            <option value="">بدون مرحله</option>
                            {draft.stages.map((s) => (
                              <option key={s.id} value={s.id}>{s.title}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </SectionCard>

                  <SectionCard title="مهلت و مبدأ محاسبه" icon={Clock}>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="sm:col-span-3">
                        <FieldLabel>رویداد آغاز (مبدأ محاسبه مهلت)</FieldLabel>
                        <input
                          className={inputCls}
                          dir="rtl"
                          value={selectedAction.base_event ?? ''}
                          onChange={(e) => updateStep(selectedAction.id, { base_event: e.target.value })}
                          placeholder="مثلاً: ابلاغ مستند، تاریخ وقوع رویداد"
                        />
                      </div>
                      <div>
                        <FieldLabel>مهلت (مقدار)</FieldLabel>
                        <input
                          type="number"
                          min={0}
                          className={inputCls}
                          value={selectedAction.gap_value ?? 0}
                          onChange={(e) => updateStep(selectedAction.id, { gap_value: Number(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <FieldLabel>واحد</FieldLabel>
                        <select
                          className={inputCls}
                          value={selectedAction.gap_unit ?? 'روز'}
                          onChange={(e) => updateStep(selectedAction.id, { gap_unit: e.target.value })}
                        >
                          {['روز', 'ماه', 'سال', 'ساعت'].map((u) => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <FieldLabel>مبنای حقوقی</FieldLabel>
                        <input
                          className={inputCls}
                          dir="rtl"
                          value={selectedAction.legal_basis ?? ''}
                          onChange={(e) => updateStep(selectedAction.id, { legal_basis: e.target.value })}
                        />
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard title="فرم / فیلدهای اختصاصی اقدام" icon={FileText}>
                    <ActionFieldsEditor
                      fields={selectedAction.fields ?? []}
                      onChange={(fields) => updateStep(selectedAction.id, { fields })}
                    />
                  </SectionCard>
                </>
              )}
            </>
          )}

          {/* ── STEP 4: شروط و مسیرها ── */}
          {stepIndex === 3 && (
            <>
              {isBaseTemplate ? (
                <div className="rounded-2xl border border-zinc-800 bg-[#1d1a18] p-6 text-sm leading-7 text-zinc-400">
                  الگوهای قانونی پایه از مسیرهای تعریف‌شده در پایگاه‌داده استفاده می‌کنند (tax_stage_transitions).
                  تعریف شرط ساختاریافته برای این الگوها در دسترس نیست.
                </div>
              ) : (
                <>
                  <SectionCard title="مسیر هر اقدام (شاخه، بازگشت و شرط)" icon={GitBranch}>
                    <div className="mb-4 flex flex-wrap gap-1.5">
                      {draft.steps.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setActiveActionId(s.id)}
                          className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${
                            activeActionId === s.id
                              ? 'bg-amber-600 text-white'
                              : 'border border-zinc-700 text-zinc-300 hover:border-amber-500/60'
                          }`}
                        >
                          {s.title || 'بدون عنوان'}
                        </button>
                      ))}
                    </div>

                    {selectedAction ? (
                      <div className="space-y-2">
                        {selectedAction.transitions?.length === 0 && (
                          <p className="rounded-lg border border-dashed border-zinc-700 p-3 text-xs text-zinc-500">
                            انتقالی برای «{selectedAction.title}» تعریف نشده است.
                          </p>
                        )}
                        {(selectedAction.transitions ?? []).map((transition) => (
                          <div key={transition.id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                            <div className="mb-3 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <GitBranch className="h-4 w-4 text-sky-400" />
                                <span className="text-xs font-bold text-zinc-300">
                                  پس از «{selectedAction.title}»
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeTransition(selectedAction.id, transition.id)}
                                className="text-zinc-600 transition hover:text-red-400"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div>
                                <FieldLabel>سپس چه کاری انجام شود؟ (مقصد)</FieldLabel>
                                <select
                                  className={inputCls}
                                  value={transition.target_type === 'STEP' ? (transition.target_step_id ?? '') : transition.target_type}
                                  onChange={(e) => {
                                    const val = e.target.value
                                    if (TERMINAL_TARGETS.some((t) => t.value === val)) {
                                      updateTransition(selectedAction.id, transition.id, { target_type: val as StepTransition['target_type'], target_step_id: undefined })
                                    } else {
                                      updateTransition(selectedAction.id, transition.id, { target_type: 'STEP', target_step_id: val })
                                    }
                                  }}
                                >
                                  <option value="">— انتخاب مقصد —</option>
                                  {draft.steps
                                    .filter((s) => s.id !== selectedAction.id)
                                    .map((s) => (
                                      <option key={s.id} value={s.id}>{s.title || 'بدون عنوان'}</option>
                                    ))}
                                  {TERMINAL_TARGETS.map((t) => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <FieldLabel>چه رویدادی؟ (محرک)</FieldLabel>
                                <select
                                  className={inputCls}
                                  value={transition.trigger_type ?? 'USER_ACTION'}
                                  onChange={(e) => updateTransition(selectedAction.id, transition.id, { trigger_type: e.target.value as StepTransition['trigger_type'] })}
                                >
                                  {TRIGGER_OPTIONS.map((t) => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                  ))}
                                </select>
                              </div>
                              {transition.trigger_type === 'TIMEOUT_AUTO' && (
                                <div>
                                  <FieldLabel>مهلت (روز)</FieldLabel>
                                  <input
                                    type="number"
                                    min={0}
                                    className={inputCls}
                                    value={transition.timeout_days ?? 0}
                                    onChange={(e) => updateTransition(selectedAction.id, transition.id, { timeout_days: Number(e.target.value) || 0 })}
                                  />
                                </div>
                              )}
                            </div>
                            <div className="mt-3">
                              <FieldLabel>شرط — چه شرطی برقرار باشد؟</FieldLabel>
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <div className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-300">
                                  {expressionHasClauses(transition.condition_expression)
                                    ? conditionSummary(transition.condition_expression)
                                    : 'بدون شرط — همیشه اجرا می‌شود'}
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    onClick={() => setConditionEditor({ stepId: selectedAction.id, transitionId: transition.id })}
                                    className="border-zinc-700 text-zinc-300"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                    {expressionHasClauses(transition.condition_expression) ? 'ویرایش شرط' : 'افزودن شرط'}
                                  </Button>
                                  {expressionHasClauses(transition.condition_expression) && (
                                    <Button
                                      variant="outline"
                                      onClick={() => updateTransition(selectedAction.id, transition.id, { condition_expression: null })}
                                      className="border-zinc-700 text-red-400 hover:text-red-300"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                      حذف شرط
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          onClick={() => addTransition(selectedAction.id)}
                          className="border-zinc-700 text-zinc-300"
                        >
                          <Plus className="h-4 w-4" />
                          افزودن انتقال برای این اقدام
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-500">ابتدا یک اقدام را از فهرست بالا انتخاب کنید.</p>
                    )}
                  </SectionCard>

                  <SectionCard title="گروه‌های وضعیت (اختیاری، فقط همین الگو)" icon={ListChecks}>
                    <StatusGroupsEditor
                      groups={draft.statusGroups}
                      onChange={(groups) => patch({ statusGroups: groups })}
                    />
                  </SectionCard>
                </>
              )}
            </>
          )}

          {/* ── STEP 5: تعهدات متصل ── */}
          {stepIndex === 4 && (
            <>
              {isBaseTemplate ? (
                <div className="rounded-2xl border border-zinc-800 bg-[#1d1a18] p-6 text-sm leading-7 text-zinc-400">
                  اتصال تعهدها برای الگوهای سفارشی انجام می‌شود.
                </div>
              ) : (
                <SectionCard title="تعهدات متصل به این الگو" icon={Link2}>
                  <p className="mb-3 text-xs leading-6 text-zinc-500">
                    فقط انتخاب از تعهدات موجود استودیوی طراحی؛ اطلاعات خود تعهد تغییر نمی‌کند. هر تعهد فقط یک
                    فرایند فعال دارد — اگر تعهدی به الگوی دیگر متصل است، هنگام فعال‌سازی تأیید جداگانه گرفته
                    می‌شود.
                  </p>
                  <div className="relative mb-3">
                    <Search className="absolute right-3 top-3 h-4 w-4 text-zinc-500" />
                    <input
                      className={`${inputCls} pr-9`}
                      dir="rtl"
                      value={obligationSearch}
                      onChange={(e) => setObligationSearch(e.target.value)}
                      placeholder="جست‌وجوی عنوان یا کد تعهد..."
                    />
                  </div>
                  <div className="mb-3 text-xs text-zinc-400">
                    {draft.obligationIds.length} تعهد انتخاب شده
                  </div>
                  <div className="max-h-96 space-y-1.5 overflow-y-auto">
                    {obligations.length === 0 && (
                      <p className="rounded-lg border border-dashed border-zinc-700 p-4 text-center text-xs text-zinc-500">
                        تعهدی در استودیوی طراحی یافت نشد (obligation_definitions).
                      </p>
                    )}
                    {obligations
                      .filter((o) => {
                        const q = obligationSearch.trim().toLowerCase()
                        if (!q) return true
                        return `${o.title} ${o.code} ${o.family_title ?? ''}`.toLowerCase().includes(q)
                      })
                      .map((ob) => {
                        const checked = draft.obligationIds.includes(ob.id)
                        const current = activeLinksByObligation.get(ob.id)
                        return (
                          <label
                            key={ob.id}
                            className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                              checked ? 'border-amber-500/50 bg-amber-500/5' : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const ids = e.target.checked
                                  ? [...draft.obligationIds, ob.id]
                                  : draft.obligationIds.filter((i) => i !== ob.id)
                                patch({ obligationIds: ids })
                              }}
                              className="accent-amber-500"
                            />
                            <div className="flex-1">
                              <div className="text-sm font-semibold text-zinc-100">{ob.title}</div>
                              <div className="text-[11px] text-zinc-500">
                                {ob.family_title ? `${ob.family_title} · ` : ''}
                                <span className="font-mono" dir="ltr">{ob.code}</span>
                              </div>
                            </div>
                            {current && current.template_id !== persistedId && (
                              <span className="rounded-full border border-zinc-700 bg-zinc-800/70 px-2 py-0.5 text-[10px] text-zinc-400">
                                فرایند فعلی: {current.template_title || 'الگوی دیگر'}
                              </span>
                            )}
                            {current && current.template_id === persistedId && (
                              <span className="rounded-full border border-emerald-700/60 bg-emerald-950/40 px-2 py-0.5 text-[10px] text-emerald-300">
                                این الگو
                              </span>
                            )}
                          </label>
                        )
                      })}
                  </div>
                </SectionCard>
              )}
            </>
          )}

          {/* ── STEP 6: بررسی و ثبت نهایی ── */}
          {stepIndex === 5 && (
            <>
              {validationErrors.length > 0 && (
                <div className="rounded-2xl border border-red-900/60 bg-red-950/20 p-4">
                  <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-red-300">
                    <AlertTriangle className="h-4 w-4" />
                    خطاهای مانع ثبت
                  </h4>
                  <ul className="list-inside list-disc space-y-1 text-xs text-red-200">
                    {validationErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <SectionCard title="مشخصات" icon={FileText} onEdit={() => setStepIndex(0)}>
                <p className="text-sm font-semibold text-zinc-100">{draft.templateName || '—'}</p>
                <p className="mt-1 text-xs text-zinc-500">{draft.description || 'بدون توضیح'}</p>
                {!isBaseTemplate && (
                  <span
                    className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      unsupportedConditions
                        ? 'border border-amber-700/60 bg-amber-950/40 text-amber-300'
                        : 'border border-emerald-700/60 bg-emerald-950/40 text-emerald-300'
                    }`}
                  >
                    {unsupportedConditions ? 'فقط پیش‌نویس — دارای شرط' : (persistedId ? 'پیش‌نویس ذخیره‌شده' : 'پیش‌نویس (ذخیره‌نشده)')}
                  </span>
                )}
              </SectionCard>

              <SectionCard title={`مراحل و اقدام‌ها (${draft.steps.length} اقدام)`} icon={Layers} onEdit={() => setStepIndex(1)}>
                <div className="space-y-3">
                  {stepsByStage.map((group) => (
                    <div key={group.stage?.id ?? 'ungrouped'}>
                      <div className="mb-1 text-xs font-bold text-zinc-400">
                        {group.stage ? group.stage.title : 'بدون مرحله'}
                      </div>
                      <div className="space-y-1">
                        {group.steps.map((step, i) => (
                          <div key={step.id} className="flex items-center gap-2 text-xs text-zinc-300">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-bold text-zinc-500">
                              {i + 1}
                            </span>
                            <span className="flex-1 truncate">{step.title}</span>
                            <span className="text-[10px] text-zinc-500">
                              {step.actor ? `${step.actor} · ` : ''}
                              {step.gap_value > 0 ? `${step.gap_value} ${step.gap_unit}` : 'بدون مهلت'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>

              {!isBaseTemplate && (
                <>
                  <SectionCard title="شروط و مسیرها" icon={GitBranch} onEdit={() => setStepIndex(3)}>
                    <div className="space-y-1 text-xs text-zinc-300">
                      {draft.steps.flatMap((s) =>
                        (s.transitions ?? [])
                          .filter((t) => expressionHasClauses(t.condition_expression))
                          .map((t) => (
                            <p key={`${s.id}-${t.id}`}>
                              <b className="text-zinc-400">{s.title}</b> ← {conditionSummary(t.condition_expression)}
                            </p>
                          ))
                      )}
                      {!draft.steps.some((s) => (s.transitions ?? []).some((t) => expressionHasClauses(t.condition_expression))) && (
                        <p className="text-zinc-500">شرطی تعریف نشده است.</p>
                      )}
                      <p className="mt-2 text-[11px] text-zinc-500">
                        {draft.statusGroups.length} گروه وضعیت تعریف شده
                        {unsupportedConditions && ' — الگو به دلیل شرط، فقط پیش‌نویس می‌ماند'}
                      </p>
                    </div>
                  </SectionCard>

                  <SectionCard title="تعهدات متصل" icon={Link2} onEdit={() => setStepIndex(4)}>
                    <p className="text-xs text-zinc-300">
                      {draft.obligationIds.length === 0
                        ? 'تعهدی انتخاب نشده است.'
                        : `${draft.obligationIds.length} تعهد: ${draft.obligationIds
                            .map((id) => obligations.find((o) => o.id === id)?.title ?? '؟')
                            .join('، ')}`}
                    </p>
                    {draft.obligationIds.some((id) => activeLinksByObligation.has(id)) && (
                      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-300">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        برخی تعهدهای انتخاب‌شده اتصال فعال به الگوی دیگری دارند؛ هنگام فعال‌سازی تأیید جایگزینی گرفته می‌شود.
                      </p>
                    )}
                  </SectionCard>

                  <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-[#1d1a18] p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs leading-6 text-zinc-400">
                      <p className="font-bold text-zinc-200">ثبت نهایی</p>
                      <p>
                        «ذخیره پیش‌نویس» فقط تعریف را ذخیره می‌کند. «فعال‌سازی» اتصال‌ها را در یک تراکنش اعمال و
                        الگو را فعال می‌کند (با تأیید جایگزینی در صورت تعارض).
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={handleSaveDraftBtn}
                        disabled={saving}
                        className="border-zinc-700 text-zinc-300"
                      >
                        <Save className="h-4 w-4" />
                        ذخیره پیش‌نویس
                      </Button>
                      <Button
                        onClick={() => void handleActivate(false)}
                        disabled={saving || activating || !canActivate}
                        className="bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40"
                      >
                        <Rocket className="h-4 w-4" />
                        فعال‌سازی الگو
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {isBaseTemplate && (
                <div className="flex justify-end rounded-2xl border border-zinc-800 bg-[#1d1a18] p-5">
                  <Button
                    onClick={handleSaveDraftBtn}
                    disabled={saving}
                    className="bg-amber-600 text-white hover:bg-amber-500"
                  >
                    <Save className="h-4 w-4" />
                    ذخیره الگوی پایه
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Footer nav */}
      <div className="flex h-16 shrink-0 items-center justify-between border-t border-zinc-800 bg-[#211d1a] px-6">
        <Button
          variant="outline"
          onClick={() => (stepIndex === 0 ? handleClose() : setStepIndex(stepIndex - 1))}
          className="border-zinc-700 text-zinc-300"
        >
          <ArrowRight className="h-4 w-4" />
          {stepIndex === 0 ? 'خروج' : 'قبلی'}
        </Button>
        <span className="text-xs text-zinc-500">
          گام {stepIndex + 1} از {WIZARD_STEPS.length} — {step.title}
        </span>
        {stepIndex < WIZARD_STEPS.length - 1 ? (
          <Button onClick={() => setStepIndex(stepIndex + 1)} className="bg-amber-600 text-white hover:bg-amber-500">
            ادامه
            <ArrowLeft className="h-4 w-4" />
          </Button>
        ) : (
          <div className="w-24" />
        )}
      </div>

      {/* Condition builder modal */}
      {conditionEditor && (
        <ConditionBuilderModal
          expression={
            draft.steps
              .find((s) => s.id === conditionEditor.stepId)
              ?.transitions?.find((t) => t.id === conditionEditor.transitionId)?.condition_expression ?? null
          }
          availableFields={availableConditionFields}
          onClose={() => setConditionEditor(null)}
          onSave={(expr) => {
            updateTransition(conditionEditor.stepId, conditionEditor.transitionId, {
              condition_expression: expressionHasClauses(expr) ? expr : null,
            })
            setConditionEditor(null)
            toast.success('شرط ذخیره شد. الگو تا حذف شرط‌ها فقط پیش‌نویس می‌ماند.')
          }}
        />
      )}

      {/* Replace-conflict confirm */}
      {confirmReplace && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-amber-700/60 bg-[#1d1a18] p-6 shadow-2xl">
            <h3 className="mb-2 flex items-center gap-2 text-base font-bold text-amber-300">
              <AlertTriangle className="h-5 w-5" />
              جایگزینی فرایند فعال تعهدها
            </h3>
            <p className="mb-4 text-sm leading-7 text-zinc-300">
              یک یا چند تعهد انتخاب‌شده، اتصال فعال به الگوی دیگری دارند. با جایگزینی، اتصال قبلی به
              «تاریخچه» منتقل می‌شود (دادهٔ خود تعهد تغییر نمی‌کند). ادامه می‌دهید؟
            </p>
            <div className="mb-4 space-y-1 text-xs text-zinc-400">
              {confirmReplace
                .filter((l) => l.obligation_id)
                .map((l) => (
                  <p key={l.obligation_id}>
                    • {obligations.find((o) => o.id === l.obligation_id)?.title ?? 'تعهد'} ← {l.template_title || 'الگوی دیگر'}
                  </p>
                ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmReplace(null)} className="border-zinc-700 text-zinc-300">
                انصراف
              </Button>
              <Button
                onClick={() => {
                  setConfirmReplace(null)
                  void handleActivate(true)
                }}
                className="bg-amber-600 text-white hover:bg-amber-500"
              >
                بله، جایگزین کن
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
