import { useMemo, useState } from 'react'
import { Plus, Trash2, FlaskConical, CornerDownLeft } from 'lucide-react'
import { Button } from '../../lib/shadcn/button'
import { Input } from '../../lib/shadcn/input'
import { Label } from '../../lib/shadcn/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../lib/shadcn/select'
import {
  OPERATORS_BY_TYPE, OPERATOR_LABEL, noValueOperator, booleanOperator, evaluateRule,
  emptyRow, emptyGroup, type ConditionRuleModel, type ConditionRow, type ConditionGroup,
  type ConditionFieldDescriptor, type ConditionOperator, type EvaluationResult,
} from '../../lib/conditionSchema'
import type { SlimSelectionList, SlimSelectionOption } from '../companyInfo/CompanyDynamicFields'

const BRAND = '#5B4DE6'

interface Props {
  model: ConditionRuleModel
  onChange: (model: ConditionRuleModel) => void
  fields: ConditionFieldDescriptor[]
  /** For SELECT/MULTI_SELECT fields, published lists + options by list key. */
  selectionLists?: SlimSelectionList[]
  selectionOptions?: SlimSelectionOption[]
  sourceKey: string
  /** values used for the run-a-test box (editable, never persisted). */
  testValues?: Record<string, string>
  onTestValuesChange?: (values: Record<string, string>) => void
}

export default function ConditionBuilder({
  model, onChange, fields, selectionLists = [], selectionOptions = [], sourceKey, testValues = {}, onTestValuesChange,
}: Props) {
  const [showTest, setShowTest] = useState(false)
  const fieldsByKey = useMemo(() => {
    const m: Record<string, ConditionFieldDescriptor> = {}
    fields.forEach((f) => { m[f.key] = f })
    return m
  }, [fields])

  const updateRow = (groupId: string, rowId: string, patch: Partial<ConditionRow>) => {
    onChange({
      ...model,
      groups: model.groups.map((g) => g.id === groupId
        ? { ...g, rows: g.rows.map((r) => r.id === rowId ? { ...r, ...patch } : r) }
        : g),
    })
  }

  const updateGroup = (groupId: string, patch: Partial<ConditionGroup>) => {
    onChange({ ...model, groups: model.groups.map((g) => g.id === groupId ? { ...g, ...patch } : g) })
  }

  const addRow = (groupId: string) => {
    onChange({
      ...model,
      groups: model.groups.map((g) => g.id === groupId
        ? { ...g, rows: [...g.rows, emptyRow(sourceKey, 'AND')] }
        : g),
    })
  }

  const removeRow = (groupId: string, rowId: string) => {
    onChange({
      ...model,
      groups: model.groups.map((g) => g.id === groupId ? { ...g, rows: g.rows.filter((r) => r.id !== rowId) } : g).filter((g) => g.rows.length > 0),
    })
  }

  const addGroup = () => {
    onChange({ ...model, groups: [...model.groups, emptyGroup(sourceKey)] })
  }

  const removeGroup = (groupId: string) => {
    onChange({ ...model, groups: model.groups.filter((g) => g.id !== groupId) })
  }

  const result = evaluateRule(model, (key) => testValues[key] ?? '')

  const setTest = (key: string, v: string) => {
    if (onTestValuesChange) onTestValuesChange({ ...testValues, [key]: v })
  }

  const summary = useMemo(() => model.groups.map((g) => g.rows.map((r) => fieldsByKey[r.fieldKey]?.title ?? r.fieldKey).filter(Boolean).join(' و ')).filter(Boolean).join(' یا '), [model.groups, fieldsByKey])

  return (
    <div className="space-y-3">
      {model.groups.length === 0 ? (
        <p className="py-2 text-center text-xs text-zinc-400">هیچ شرطی تعریف نشده است.</p>
      ) : model.groups.map((group, gi) => (
        <div key={group.id} className="space-y-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
          {model.groups.length > 1 && (
            <div className="mb-2 flex items-center gap-2 text-[11px] text-zinc-400">
              <span>ارتباط با گروه بعد</span>
              <Select value={group.join} onValueChange={(v) => updateGroup(group.id, { join: v as 'AND' | 'OR' })}>
                <SelectTrigger className="h-8 w-16 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="AND" className="text-xs">و</SelectItem><SelectItem value="OR" className="text-xs">یا</SelectItem></SelectContent>
              </Select>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => removeGroup(group.id)} title="حذف گروه"><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          )}
          {group.rows.map((row, ri) => (
            <div key={row.id} className="flex flex-wrap items-center gap-2">
              {"0123456789"[0] && ri > 0 && (
                <div className="flex items-center gap-1">
                  <Select value={row.join} onValueChange={(v) => updateRow(group.id, row.id, { join: v as 'AND' | 'OR' })}>
                    <SelectTrigger className="h-9 w-14 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="AND" className="text-xs">و</SelectItem><SelectItem value="OR" className="text-xs">یا</SelectItem></SelectContent>
                  </Select>
                </div>
              )}
              {/* field */}
              <Select value={row.fieldKey} onValueChange={(v) => {
                const f = fieldsByKey[v]
                updateRow(group.id, row.id, { fieldKey: v, fieldType: f?.type ?? 'TEXT', operator: OPERATORS_BY_TYPE[f?.type ?? 'TEXT'][0] ?? 'EQ', optionKeys: [], textValue: '', numberValue: undefined, numberValue2: undefined, dateValue: '' })
              }}>
                <SelectTrigger className="h-9 w-44 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {groupedFields(fields).map((sec) => (
                    <div key={sec.section}>
                      <p className="px-2 pb-1 pt-2 text-[10px] font-bold text-zinc-400">{sec.section}</p>
                      {sec.items.map((f) => <SelectItem key={f.key} value={f.key} className="text-xs">{f.title}</SelectItem>)}
                    </div>
                  ))}
                </SelectContent>
              </Select>
              {/* operator */}
              <Select value={row.operator} onValueChange={(v) => updateRow(group.id, row.id, { operator: v as ConditionOperator })}>
                <SelectTrigger className="h-9 w-36 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{(OPERATORS_BY_TYPE[row.fieldType] ?? []) .map((op) => <SelectItem key={op} value={op} className="text-xs">{OPERATOR_LABEL[op]}</SelectItem>)}</SelectContent>
              </Select>
              {/* value */}
              <RowValueInput row={row} onChange={(patch) => updateRow(group.id, row.id, patch)} selectionLists={selectionLists} selectionOptions={selectionOptions} />
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-zinc-400 hover:text-red-500" onClick={() => removeRow(group.id, row.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1">
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => addRow(group.id)}><Plus className="h-3.5 w-3.5" />افزودن شرط</Button>
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={addGroup}><Plus className="h-3.5 w-3.5" />افزودن گروه</Button>
        <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setShowTest((v) => !v)}><FlaskConical className="h-3.5 w-3.5" />آزمایش شرط</Button>
      </div>

      {summary && <p className="rounded-lg bg-zinc-50 px-3 py-2 text-[11px] leading-5 text-zinc-500 dark:bg-zinc-800/40 dark:text-zinc-400">خلاصه: {summary}</p>}

      {showTest && (
        <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 dark:border-indigo-900/60 dark:bg-indigo-950/10">
          <div className="flex items-center gap-2"><CornerDownLeft className="h-3.5 w-3.5 text-indigo-400" /><p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-300">مقادیر آزمایشی (فقط برای آزمایش؛ ذخیره نمیشود)</p></div>
          <div className="grid gap-2 sm:grid-cols-2">
            {usedFieldKeys(model).map((key) => {
              const f = fieldsByKey[key]
              const list = linkedListFor(f?.key ?? '', selectionLists, selectionOptions)
              return (
                <div key={key} className="space-y-1">
                  <Label className="text-[11px] text-zinc-600 dark:text-zinc-300">{f?.title ?? key}</Label>
                  {list ? (
                    <select value={testValues[key] ?? ''} onChange={(e) => setTest(key, e.target.value)}
                      className="h-9 w-full rounded-lg border border-zinc-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-[#1d1d20] dark:text-zinc-100">
                      <option value="">—</option>
                      {list.options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                    </select>
                  ) : (
                    <Input value={testValues[key] ?? ''} onChange={(e) => setTest(key, e.target.value)}
                      dir="rtl" className="h-9 text-xs"
                      type={f?.type === 'NUMBER' ? 'number' : f?.type === 'DATE' ? 'date' : 'text'} />
                  )}
                </div>
              )
            })}
            {usedFieldKeys(model).length === 0 && <p className="text-xs text-zinc-400">ابتدا شرطی تعریف کنید.</p>}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-zinc-700 dark:text-zinc-200">نتیجه: </span>
            <ResultBadge result={result.final} />
            {result.rows.filter((r) => r.missing).length > 0 && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400">
                {result.rows.filter((r) => r.missing).length.toLocaleString('fa-IR')} فیلد اطلاعات کافی ندارد
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function RowValueInput({ row, onChange, selectionLists, selectionOptions }: {
  row: ConditionRow
  onChange: (patch: Partial<ConditionRow>) => void
  selectionLists: SlimSelectionList[]
  selectionOptions: SlimSelectionOption[]
}) {
  if (noValueOperator(row.operator)) return <span className="h-9 w-6" />

  if (booleanOperator(row.operator)) {
    return (
      <Select value={row.operator} onValueChange={() => {}}>
        <SelectTrigger className="h-9 w-24 text-xs text-zinc-400" disabled><SelectValue /></SelectTrigger>
      </Select>
    )
  }

  const list = linkedListFor(row.fieldKey, selectionLists, selectionOptions)

  if (list) {
    return (
      <select
        value={row.optionKeys.join(',')}
        onChange={(e) => onChange({ optionKeys: e.target.value ? e.target.value.split(',') : [] })}
        className="h-9 w-52 rounded-lg border border-zinc-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-[#1d1d20] dark:text-zinc-100"
      >
        <option value="">—</option>
        {list.options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>
    )
  }

  const isBetween = (row.operator as string) === 'BETWEEN'

  if (row.fieldType === 'NUMBER' || (row.operator as string) === 'BETWEEN') {
    return (
      <div className="flex items-center gap-1">
        <Input type="number" value={row.numberValue ?? ''} onChange={(e) => onChange({ numberValue: Number(e.target.value) })} className="h-9 w-24 text-xs" dir="ltr" />
        {isBetween && <><span className="text-zinc-400">تا</span><Input type="number" value={row.numberValue2 ?? ''} onChange={(e) => onChange({ numberValue2: Number(e.target.value) })} className="h-9 w-24 text-xs" dir="ltr" /></>}
      </div>
    )
  }

  if (row.fieldType === 'DATE' && (row.operator as string) === 'BETWEEN') {
    return (
      <div className="flex items-center gap-1">
        <Input type="date" value={row.dateValue ?? ''} onChange={(e) => onChange({ dateValue: e.target.value })} className="h-9 w-32 text-xs" dir="ltr" />
        <span className="text-zinc-400">تا</span>
        <Input type="date" value={(row as any).dateValue2 ?? ''} onChange={(e) => onChange({ ...(row as any), dateValue2: e.target.value } as Partial<ConditionRow>)} className="h-9 w-32 text-xs" dir="ltr" />
      </div>
    )
  }

  if (row.fieldType === 'DATE') {
    return <Input type="date" value={row.dateValue ?? ''} onChange={(e) => onChange({ dateValue: e.target.value })} className="h-9 w-36 text-xs" dir="ltr" />
  }

  return <Input value={row.textValue ?? ''} onChange={(e) => onChange({ textValue: e.target.value })} className="h-9 w-52 text-xs" placeholder="مقدار..." />
}

function linkedListFor(fieldKey: string, lists: SlimSelectionList[], opts: SlimSelectionOption[]): { options: Array<{ key: string; label: string }> } | null {
  // Our current company-field renderer links lists at the field-definition
  // level; for the standalone condition builder we expose all published lists
  // as selectable sources. Field-specific mapping is applied by callers that
  // provide lists keyed appropriately.
  if (lists.length === 0) return null
  // Prefer a list whose key matches the field key; else the first published list.
  const list = lists.find((l) => l.key === fieldKey) ?? lists[0]
  return { options: opts.filter((o) => o.list_id === list?.id).map((o) => ({ key: o.key, label: o.label })) }
}

function groupedFields(fields: ConditionFieldDescriptor[]) {
  const order = ['INITIAL', 'COMPLEMENTARY', 'SYSTEM']
  const groups: Record<string, string> = { INITIAL: 'اطلاعات اولیه', COMPLEMENTARY: 'مراحل تکمیلی', SYSTEM: 'اطلاعات سیستمی' }
  const bySec: Record<string, ConditionFieldDescriptor[]> = {}
  fields.forEach((f) => { (bySec[f.section] = bySec[f.section] ?? []).push(f) })
  return order.filter((s) => bySec[s]).map((s) => ({ section: groups[s], items: bySec[s] }))
}

function usedFieldKeys(model: ConditionRuleModel): string[] {
  const keys: string[] = []
  model.groups.forEach((g) => g.rows.forEach((r) => { if (r.fieldKey && !keys.includes(r.fieldKey)) keys.push(r.fieldKey) }))
  return keys
}

function ResultBadge({ result }: { result: EvaluationResult }) {
  const map = {
    TRUE: { label: 'برقرار است', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' },
    FALSE: { label: 'برقرار نیست', cls: 'bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-300' },
    INSUFFICIENT: { label: 'اطلاعات کافی نیست', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300' },
  }[result]
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${map.cls}`}>{map.label}</span>
}