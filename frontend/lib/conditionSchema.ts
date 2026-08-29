// ==========================================================================
// Shared typed condition model + 3-state evaluator.
// Used by the common condition builder across eligibility, status rules and
// objection-template selectors. Titles/labels are presentation-only; rules
// always reference stable field keys and option keys.
// ==========================================================================

export type ConditionFieldType =
  | 'TEXT' | 'LONG_TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'SELECT' | 'MULTI_SELECT' | 'NATIONAL_ID' | 'SYSTEM'

export type ConditionOperator =
  // text / national id
  | 'EQ' | 'NEQ' | 'CONTAINS' | 'STARTS_WITH' | 'HAS_VALUE' | 'HAS_NO_VALUE'
  // number
  | 'GT' | 'GTE' | 'LT' | 'LTE' | 'BETWEEN'
  // boolean
  | 'IS_TRUE' | 'IS_FALSE'
  // select
  | 'IS_ONE_OF' | 'NOT_ONE_OF'
  // multiselect
  | 'INCLUDES_ANY' | 'INCLUDES_ALL' | 'INCLUDES_NONE'

export type ConditionGroupJoin = 'AND' | 'OR'

export interface ConditionRow {
  id: string
  /** data source scope (eligibility / status / objection) — stable key */
  sourceKey: string
  fieldKey: string
  fieldType: ConditionFieldType
  operator: ConditionOperator
  /** stored option keys (stable) for SELECT/MULTI_SELECT; separate from label display */
  optionKeys: string[]
  textValue?: string
  numberValue?: number
  numberValue2?: number
  dateValue?: string
  dateValue2?: string
  /** optional path of option labels for display/ambiguity (تهران ← شمیرانات ← لواسان) */
  optionPath?: string[]
  join: ConditionGroupJoin // join with the NEXT row
}

export interface ConditionGroup {
  id: string
  join: ConditionGroupJoin // join with the next group ('AND'/'OR')
  rows: ConditionRow[]
}

export interface ConditionRuleModel {
  version: number // rule structure version
  groups: ConditionGroup[]
}

export interface ConditionFieldDescriptor {
  key: string
  title: string
  type: ConditionFieldType
  section: string // 'INITIAL' | 'COMPLEMENTARY' | 'SYSTEM'
  stepTitle?: string
}

export type EvaluationResult = 'TRUE' | 'FALSE' | 'INSUFFICIENT'

export interface RowEvaluation {
  fieldKey: string
  title: string
  operator: ConditionOperator
  result: EvaluationResult
  missing?: boolean
}

export interface RuleEvaluation {
  final: EvaluationResult
  errors: string[]
  rows: RowEvaluation[]
}

// ── Type → operator map ──
export const OPERATORS_BY_TYPE: Record<ConditionFieldType, ConditionOperator[]> = {
  TEXT: ['EQ', 'NEQ', 'CONTAINS', 'STARTS_WITH', 'HAS_VALUE', 'HAS_NO_VALUE'],
  LONG_TEXT: ['EQ', 'NEQ', 'CONTAINS', 'STARTS_WITH', 'HAS_VALUE', 'HAS_NO_VALUE'],
  NATIONAL_ID: ['EQ', 'NEQ', 'CONTAINS', 'STARTS_WITH', 'HAS_VALUE', 'HAS_NO_VALUE'],
  NUMBER: ['EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE', 'BETWEEN', 'HAS_VALUE', 'HAS_NO_VALUE'],
  DATE: ['EQ', 'GT', 'LT', 'BETWEEN', 'HAS_VALUE', 'HAS_NO_VALUE'],
  BOOLEAN: ['IS_TRUE', 'IS_FALSE'],
  SELECT: ['IS_ONE_OF', 'NOT_ONE_OF', 'HAS_VALUE', 'HAS_NO_VALUE'],
  MULTI_SELECT: ['INCLUDES_ANY', 'INCLUDES_ALL', 'INCLUDES_NONE', 'HAS_VALUE', 'HAS_NO_VALUE'],
  SYSTEM: ['EQ', 'NEQ', 'HAS_VALUE', 'HAS_NO_VALUE'],
}

export const OPERATOR_LABEL: Record<ConditionOperator, string> = {
  EQ: 'برابر است با',
  NEQ: 'برابر نیست با',
  CONTAINS: 'شامل میشود',
  STARTS_WITH: 'شروع میشود با',
  HAS_VALUE: 'مقدار دارد',
  HAS_NO_VALUE: 'مقدار ندارد',
  GT: 'بزرگتر است از',
  GTE: 'بزرگتر یا مساوی',
  LT: 'کوچکتر است از',
  LTE: 'کوچکتر یا مساوی',
  BETWEEN: 'بین',
  IS_TRUE: 'بله است',
  IS_FALSE: 'خیر است',
  IS_ONE_OF: 'یکی از',
  NOT_ONE_OF: 'یکی از آنها نیست',
  INCLUDES_ANY: 'شامل یکی از',
  INCLUDES_ALL: 'شامل همه',
  INCLUDES_NONE: 'شامل هیچکدام',
}

export function noValueOperator(op: ConditionOperator): boolean {
  return op === 'HAS_VALUE' || op === 'HAS_NO_VALUE'
}

export function booleanOperator(op: ConditionOperator): boolean {
  return op === 'IS_TRUE' || op === 'IS_FALSE'
}

// ── Value helper ──
export function operatorRequiresBetween(op: ConditionOperator): boolean {
  return op === 'BETWEEN'
}

// ── 3-state evaluator ──
export function evaluateOperator(
  operator: ConditionOperator,
  fieldType: ConditionFieldType,
  actual: string | undefined,
  row: ConditionRow
): EvaluationResult {
  const op: string = operator // widened so per-type switch narrowing stays unambiguous
  const raw = actual ?? ''
  const empty = raw.trim() === '' || raw === 'false'
  const isListField = fieldType === 'SELECT' || fieldType === 'MULTI_SELECT'
  const actualKeys = isListField ? raw.split(',').map((s) => s.trim()).filter(Boolean) : []

  switch (op) {
    case 'HAS_VALUE': return empty ? 'FALSE' : 'TRUE'
    case 'HAS_NO_VALUE': return empty ? 'TRUE' : 'FALSE'
    case 'IS_TRUE': return empty ? 'FALSE' : (raw === 'true' ? 'TRUE' : 'FALSE')
    case 'IS_FALSE': return empty ? 'FALSE' : (raw === 'false' ? 'TRUE' : 'FALSE')
    default:
      break
  }

  // For fields that are still unanswered (and the operator needs a value),
  // outcome is INSUFFICIENT, never loose FALSE.
  if (empty) return 'INSUFFICIENT'

  if (fieldType === 'SELECT' || fieldType === 'MULTI_SELECT') {
    const want = row.optionKeys
    if (want.length === 0) return 'INSUFFICIENT'
    const hasAny = want.some((k) => actualKeys.includes(k))
    const hasAll = want.every((k) => actualKeys.includes(k))
    switch (op) {
      case 'IS_ONE_OF': return hasAny ? 'TRUE' : 'FALSE'
      case 'NOT_ONE_OF': return hasAny ? 'FALSE' : 'TRUE'
      case 'INCLUDES_ANY': return hasAny ? 'TRUE' : 'FALSE'
      case 'INCLUDES_ALL': return hasAll ? 'TRUE' : 'FALSE'
      case 'INCLUDES_NONE': return hasAny ? 'FALSE' : 'TRUE'
      default: return 'INSUFFICIENT'
    }
  }

  switch (op) {
    case 'EQ': return actual === `${row.textValue ?? ''}` ? 'TRUE' : 'FALSE'
    case 'NEQ': return actual !== `${row.textValue ?? ''}` ? 'TRUE' : 'FALSE'
    case 'CONTAINS': return raw.includes(`${row.textValue ?? ''}`) ? 'TRUE' : 'FALSE'
    case 'STARTS_WITH': return raw.startsWith(`${row.textValue ?? ''}`) ? 'TRUE' : 'FALSE'
    default:
      break
  }

  // numeric / date
  if (fieldType === 'NUMBER') {
    const n = Number(raw)
    if (Number.isNaN(n)) return 'INSUFFICIENT'
    const a = Number(row.numberValue)
    switch (op) {
      case 'EQ': return n === a ? 'TRUE' : 'FALSE'
      case 'GT': return n > a ? 'TRUE' : 'FALSE'
      case 'GTE': return n >= a ? 'TRUE' : 'FALSE'
      case 'LT': return n < a ? 'TRUE' : 'FALSE'
      case 'LTE': return n <= a ? 'TRUE' : 'FALSE'
      case 'BETWEEN': {
        const b = Number(row.numberValue2)
        return (n >= a && n <= b) ? 'TRUE' : 'FALSE'
      }
      default: return 'INSUFFICIENT'
    }
  }

  if (fieldType === 'DATE') {
    switch (op) {
      case 'EQ': return raw === row.dateValue ? 'TRUE' : 'FALSE'
      case 'GT': return raw > (row.dateValue ?? '') ? 'TRUE' : 'FALSE'
      case 'LT': return raw < (row.dateValue ?? '') ? 'TRUE' : 'FALSE'
      case 'BETWEEN': return raw >= (row.dateValue ?? '') && raw <= (row.dateValue2 ?? '') ? 'TRUE' : 'FALSE'
      default: return 'INSUFFICIENT'
    }
  }

  return 'INSUFFICIENT'
}

interface FieldValues { [fieldKey: string]: string | undefined }

export function evaluateRule(model: ConditionRuleModel | null, getValue: (fieldKey: string) => string | undefined): RuleEvaluation {
  if (!model || model.groups.length === 0) {
    return { final: 'TRUE', errors: [], rows: [] }
  }

  const errors: string[] = []
  const allRows: RowEvaluation[] = []

  const evalGroup = (group: ConditionGroup): EvaluationResult => {
    let groupResult: EvaluationResult = 'TRUE'
    const partials: EvaluationResult[] = []
    group.rows.forEach((row, i) => {
      const actual = getValue(row.fieldKey)
      const result = evaluateOperator(row.operator, row.fieldType, actual, row)
      partials.push(result)
      allRows.push({ fieldKey: row.fieldKey, title: row.fieldKey, operator: row.operator, result, missing: !actual || actual.trim() === '' })
      if (i === 0) { groupResult = result }
      else {
        if (row.join === 'AND') groupResult = combineAnd(groupResult, result)
        else groupResult = combineOr(groupResult, result)
      }
    })
    return groupResult
  }

  let final: EvaluationResult = 'TRUE'
  model.groups.forEach((g, i) => {
    const r = evalGroup(g)
    if (i === 0) final = r
    else {
      if (g.join === 'AND') final = combineAnd(final, r)
      else final = combineOr(final, r)
    }
  })

  return { final, errors, rows: allRows }
}

function combineAnd(a: EvaluationResult, b: EvaluationResult): EvaluationResult {
  if (a === 'TRUE' && b === 'TRUE') return 'TRUE'
  if (a === 'FALSE' || b === 'FALSE') return 'FALSE'
  return 'INSUFFICIENT'
}
function combineOr(a: EvaluationResult, b: EvaluationResult): EvaluationResult {
  if (a === 'TRUE' || b === 'TRUE') return 'TRUE'
  if (a === 'FALSE' && b === 'FALSE') return 'FALSE'
  return 'INSUFFICIENT'
}

export function emptyRow(sourceKey: string, join: ConditionGroupJoin = 'AND'): ConditionRow {
  return {
    id: `cond-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sourceKey,
    fieldKey: '', fieldType: 'TEXT', operator: 'EQ',
    optionKeys: [], textValue: '', join,
  }
}

export function emptyGroup(sourceKey: string): ConditionGroup {
  return { id: `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, join: 'AND', rows: [emptyRow(sourceKey)] }
}

export const CONDITION_MODEL_VERSION = 1

export function ruleToJson(model: ConditionRuleModel): unknown {
  return model
}

export type ConditionValueMap = FieldValues