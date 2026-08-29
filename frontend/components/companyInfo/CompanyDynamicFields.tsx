import type { CompanyFieldDefinition, CompanyFieldOption } from '../../lib/companyInfo'

export type CompanyFieldValues = Record<string, string>

interface Props {
  definitions: CompanyFieldDefinition[]
  options: CompanyFieldOption[]
  values: CompanyFieldValues
  onChange: (fieldId: string, value: string) => void
  columns?: 1 | 2
  readOnly?: boolean
  /** Evaluate display conditions using current values. Conditions reference fields by their stable key. */
}

export function fieldValueByKey(definitions: CompanyFieldDefinition[], values: CompanyFieldValues, key: string): string {
  const def = definitions.find((d) => d.key === key)
  if (!def) return ''
  return values[def.id] ?? ''
}

function conditionMatched(
  def: CompanyFieldDefinition,
  definitions: CompanyFieldDefinition[],
  values: CompanyFieldValues
): boolean {
  if (!def.display_condition) return true
  const [key, cond] = Object.entries(def.display_condition)[0] ?? []
  if (!key || !cond) return true
  const current = fieldValueByKey(definitions, values, key)
  const op = cond.operator ?? 'EQ'
  const expected = cond.value ?? ''
  switch (op) {
    case 'EQ': return current === expected
    case 'NEQ': return current !== expected
    case 'CONTAINS': return current === expected || current.split(',').map((s) => s.trim()).includes(expected)
    case 'ANSWERED': return Boolean(current.trim())
    case 'NOT_ANSWERED': return !current.trim()
    default: return true
  }
}

export default function CompanyDynamicFields({ definitions, options, values, onChange, columns = 1, readOnly = false }: Props) {
  const visible = definitions.filter((d) => conditionMatched(d, definitions, values))

  return (
    <div className={`grid gap-4 md:grid-cols-${columns === 2 ? 2 : 1}`}>
      {visible.map((def) => (
        <div key={def.id} className={def.width === 'HALF' && columns === 2 ? 'md:col-span-1' : ''}>
          <CompanyFieldInput
            def={def}
            options={options}
            value={values[def.id] ?? ''}
            onChange={(v) => onChange(def.id, v)}
            readOnly={readOnly}
          />
        </div>
      ))}
    </div>
  )
}

export function CompanyFieldInput({ def, options, value, onChange, readOnly }: {
  def: CompanyFieldDefinition
  options: CompanyFieldOption[]
  value: string
  onChange: (value: string) => void
  readOnly?: boolean
}) {
  const disabled = readOnly
  const fieldOptions = options.filter((o) => o.field_id === def.id).sort((a, b) => a.sort_order - b.sort_order)
  const label = (
    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
      {def.title} {def.required && <span className="text-red-500">*</span>}
    </span>
  )
  const hint = def.help_text ? <p className="text-[10px] leading-4 text-zinc-400">{def.help_text}</p> : null

  if (def.field_type === 'SELECT') {
    return (
      <div className="space-y-1.5">
        {label}
        <select
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          dir="rtl"
          className="w-full h-10 rounded-lg border border-zinc-300 bg-white px-3 text-xs text-zinc-800 invalid:text-zinc-400 focus:outline-none focus:ring-2 dark:border-zinc-700 dark:bg-[#1d1d20] dark:text-zinc-100 disabled:opacity-60"
        >
          <option value="">—</option>
          {fieldOptions.map((o) => <option key={o.id} value={o.value}>{o.label}</option>)}
        </select>
        {hint}
      </div>
    )
  }

  if (def.field_type === 'MULTI_SELECT') {
    const selected = value ? value.split(',').filter(Boolean) : []
    const toggle = (v: string) => {
      const next = selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]
      onChange(next.join(','))
    }
    return (
      <div className="space-y-1.5">
        {label}
        <div className="flex flex-wrap gap-1.5">
          {fieldOptions.map((o) => {
            const checked = selected.includes(o.value)
            return (
              <button key={o.id} type="button" disabled={readOnly} onClick={() => toggle(o.value)}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${checked ? 'border-transparent text-white shadow-sm' : 'border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300'} ${readOnly ? 'cursor-not-allowed opacity-70' : ''}`}
                style={checked ? { background: '#5B4DE6' } : undefined}>
                {o.label}
              </button>
            )
          })}
        </div>
        {hint}
      </div>
    )
  }

  if (def.field_type === 'BOOLEAN') {
    const boolValue = value === 'true'
    return (
      <div className="space-y-1.5">
        {label}
        <div className="flex gap-2">
          <button type="button" disabled={readOnly} onClick={() => onChange('true')}
            className={`rounded-lg border px-3 py-2 text-xs transition ${boolValue ? 'border-transparent text-white' : 'border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300'} ${readOnly ? 'cursor-not-allowed opacity-70' : ''}`}
            style={boolValue ? { background: '#5B4DE6' } : undefined}>بله</button>
          <button type="button" disabled={readOnly} onClick={() => onChange(boolValue ? '' : 'false')}
            className={`rounded-lg border px-3 py-2 text-xs transition ${boolValue ? 'border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300' : 'border-transparent text-white'} ${readOnly ? 'cursor-not-allowed opacity-70' : ''}`}
            style={!boolValue && value ? { background: '#E11D48' } : undefined}>خیر</button>
        </div>
        {hint}
      </div>
    )
  }

  if (def.field_type === 'NUMBER') {
    return (
      <div className="space-y-1.5">
        {label}
        <input type="number" disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full h-10 rounded-lg border border-zinc-300 bg-white px-3 text-xs text-zinc-800 focus:outline-none focus:ring-2 dark:border-zinc-700 dark:bg-[#1d1d20] dark:text-zinc-100 disabled:opacity-60" />
        {hint}
      </div>
    )
  }

  if (def.field_type === 'DATE') {
    return (
      <div className="space-y-1.5">
        {label}
        <input type="date" disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} dir="ltr"
          className="w-full h-10 rounded-lg border border-zinc-300 bg-white px-3 text-xs text-zinc-800 focus:outline-none focus:ring-2 dark:border-zinc-700 dark:bg-[#1d1d20] dark:text-zinc-100 disabled:opacity-60" />
        {hint}
      </div>
    )
  }

  // TEXT, LONG_TEXT, NATIONAL_ID
  const isLong = def.field_type === 'LONG_TEXT'
  const ltr = def.field_type === 'NATIONAL_ID' || def.field_type === 'TEXT'
  return (
    <div className="space-y-1.5">
      {label}
      {isLong ? (
        <textarea disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} rows={3}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-800 focus:outline-none focus:ring-2 dark:border-zinc-700 dark:bg-[#1d1d20] dark:text-zinc-100 disabled:opacity-60" />
      ) : (
        <input type="text" disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} dir="ltr"
          className="w-full h-10 rounded-lg border border-zinc-300 bg-white px-3 text-xs text-zinc-800 focus:outline-none focus:ring-2 dark:border-zinc-700 dark:bg-[#1d1d20] dark:text-zinc-100 disabled:opacity-60" />
      )}
      {hint}
    </div>
  )
}