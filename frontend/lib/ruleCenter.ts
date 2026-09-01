import { supabase, isSupabaseConfigured } from './supabase'

// ---------------------------------------------------------------------------
// مرکز قواعد مهلت و جریمه — سرویس سمت کلاینت
// ---------------------------------------------------------------------------

export type RuleKind = 'RECURRENCE' | 'DEADLINE' | 'BOTH' | 'PENALTY'
export type RuleVersionStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'STOPPED'
export type ConnectionStatus = 'DRAFT' | 'ACTIVE' | 'HISTORY'
export type DecidedStatus = 'UNCHECKED' | 'NO_PENALTY' | 'RULE_ATTACHED' | 'NEEDS_REFERENCE'

export interface RuleCenterRule {
  id: string
  kind: RuleKind
  code: string
  title_fa: string
  summary?: string | null
  domain?: string | null
  authority?: string | null
  legal_source?: string | null
  legal_clause?: string | null
  nature: 'LEGAL' | 'INTERNAL'
  valid_from?: string | null
  valid_to?: string | null
  created_at?: string
}

export interface RuleCenterVersion {
  id: string
  rule_id: string
  version_number: number
  status: RuleVersionStatus
  definition: Record<string, any>
  inputs: RuleInput[]
  summary?: string | null
  technical_approved_at?: string | null
  expert_approved_at?: string | null
  published_at?: string | null
  created_at?: string
}

export interface RuleInput {
  key: string
  label: string
  type: 'DATE' | 'DATETIME' | 'AMOUNT' | 'NUMBER' | 'TEXT' | 'SELECT' | 'BOOL' | 'PERIOD_REF' | 'FISCAL_YEAR_REF' | 'CASE_EVENT' | 'RULE_OUTPUT'
  unit?: string
  required?: boolean
}

export interface RuleCenterConnection {
  id: string
  version_id: string
  target_type: 'OBLIGATION_VERSION' | 'ACTION_STEP'
  target_id: string
  /** برای ACTION_STEP: شناسهٔ پایدار اقدام (step_ref) */
  target_ref?: string | null
  mapping: Record<string, { source_type: string; source_ref?: string; source_step_ref?: string; source_step_label?: string }>
  status: ConnectionStatus
  decided_status: DecidedStatus
  decided_doc?: string | null
  created_at?: string
  obligation_title?: string | null
  step_title?: string | null
  template_title?: string | null
}

export interface RuleCenterTestRow {
  id: string
  version_id: string
  title: string
  inputs: Record<string, any>
  expected: Record<string, any>
  actual?: Record<string, any> | null
  status: 'PENDING' | 'PASS' | 'FAIL'
  created_at?: string
  run_at?: string | null
}

export interface CalcResult {
  status: string
  engine_version?: string
  mode?: string
  effective_deadline?: string | null
  initial_deadline?: string | null
  estimated_amount?: number | null
  currency?: string | null
  days?: number | null
  steps?: Array<Record<string, any>>
  reminders?: Array<Record<string, any>>
  warnings?: Array<string>
  missing?: string[]
  error?: string | null
  [key: string]: any
}

export const RULE_KIND_LABELS: Record<RuleKind, string> = {
  RECURRENCE: 'تناوب',
  DEADLINE: 'مهلت',
  BOTH: 'تناوب همراه مهلت',
  PENALTY: 'جریمه',
}

export const RULE_STATUS_LABELS: Record<RuleVersionStatus, string> = {
  DRAFT: 'پیش‌نویس',
  IN_REVIEW: 'در بررسی',
  APPROVED: 'تأییدشده',
  PUBLISHED: 'منتشرشده',
  STOPPED: 'متوقف برای استفاده جدید',
}

export const DECIDED_LABELS: Record<DecidedStatus, string> = {
  UNCHECKED: 'بررسی نشده',
  NO_PENALTY: 'بدون جریمه (مستند)',
  RULE_ATTACHED: 'قاعده متصل و آماده',
  NEEDS_REFERENCE: 'نیازمند تصمیم مرجع',
}

function rpcError(error: any, fallback: string): Error {
  if (error && typeof error.message === 'string') {
    // RPC error messages like «ERROR: ...» get their PostgreSQL detail stripped;
    // Supabase keeps message but details may hold the Persian text.
    const msg = (error.message as string)
    if (msg.includes('ERROR:') && (error as any).details) return new Error((error as any).details)
    return new Error(msg)
  }
  return new Error(fallback)
}

// ---------------------------------------------------------------------------
// قواعد و نسخه‌ها
// ---------------------------------------------------------------------------

export async function fetchRuleCenterRules(): Promise<Array<RuleCenterRule & { latest_version?: RuleCenterVersion | null }>> {
  if (!isSupabaseConfigured) return []
  try {
    const { data, error } = await (supabase as any)
      .from('rule_center_rules')
      .select('*, rule_center_versions(*)')
      .order('created_at', { ascending: false })
    if (error) return []
    return (data ?? []).map((row: any) => {
      const versions: RuleCenterVersion[] = (row.rule_center_versions ?? [])
        .map(normalizeVersion)
        .sort((a: RuleCenterVersion, b: RuleCenterVersion) => b.version_number - a.version_number)
      const { rule_center_versions, ...rule } = row
      return { ...rule, latest_version: versions[0] ?? null }
    })
  } catch {
    return []
  }
}

export async function fetchRuleCenterRule(ruleId: string): Promise<(RuleCenterRule & { versions: RuleCenterVersion[] }) | null> {
  if (!isSupabaseConfigured) return null
  const { data, error } = await (supabase as any)
    .from('rule_center_rules')
    .select('*, rule_center_versions(*)')
    .eq('id', ruleId)
    .single()
  if (error || !data) return null
  const versions: RuleCenterVersion[] = (data.rule_center_versions ?? [])
    .map(normalizeVersion)
    .sort((a: RuleCenterVersion, b: RuleCenterVersion) => b.version_number - a.version_number)
  const { rule_center_versions, ...rule } = data
  return { ...rule, versions }
}

function normalizeVersion(row: any): RuleCenterVersion {
  return {
    id: row.id,
    rule_id: row.rule_id,
    version_number: row.version_number,
    status: row.status,
    definition: row.definition ?? {},
    inputs: Array.isArray(row.inputs) ? row.inputs : [],
    summary: row.summary,
    technical_approved_at: row.technical_approved_at,
    expert_approved_at: row.expert_approved_at,
    published_at: row.published_at,
    created_at: row.created_at,
  }
}

export async function fetchRuleVersion(versionId: string): Promise<RuleCenterVersion | null> {
  if (!isSupabaseConfigured) return null
  const { data, error } = await (supabase as any)
    .from('rule_center_versions')
    .select('*')
    .eq('id', versionId)
    .single()
  if (error || !data) return null
  return normalizeVersion(data)
}

export async function saveRule(args: {
  ruleId?: string | null
  kind: RuleKind
  code: string
  titleFa: string
  summary?: string | null
  domain?: string | null
  authority?: string | null
  legalSource?: string | null
  legalClause?: string | null
  nature: 'LEGAL' | 'INTERNAL'
  validFrom?: string | null
  validTo?: string | null
  definition: Record<string, any>
  inputs: RuleInput[]
  versionId?: string | null
}): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('اتصال به پایگاه‌داده برقرار نیست.')
  const { data, error } = await (supabase as any).rpc('rule_center_save_rule', {
    p_rule_id: args.ruleId ?? null,
    p_kind: args.kind,
    p_code: args.code,
    p_title_fa: args.titleFa,
    p_summary: args.summary ?? null,
    p_domain: args.domain ?? null,
    p_authority: args.authority ?? null,
    p_legal_source: args.legalSource ?? null,
    p_legal_clause: args.legalClause ?? null,
    p_nature: args.nature,
    p_valid_from: args.validFrom ?? null,
    p_valid_to: args.validTo ?? null,
    p_definition: args.definition,
    p_inputs: args.inputs,
    p_version_id: args.versionId ?? null,
  })
  if (error) throw rpcError(error, 'ذخیره قاعده انجام نشد.')
  return data as string
}

export async function transitionRuleVersion(versionId: string, to: 'IN_REVIEW' | 'APPROVED' | 'PUBLISHED'): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('اتصال به پایگاه‌داده برقرار نیست.')
  const { error } = await (supabase as any).rpc('rule_center_transition', { p_version_id: versionId, p_to: to, p_expert_note: null })
  if (error) throw rpcError(error, 'انتقال وضعیت نسخه انجام نشد.')
}

export async function createNewRuleVersion(ruleId: string, definition: Record<string, any>, inputs: RuleInput[]): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('اتصال به پایگاه‌داده برقرار نیست.')
  const { data, error } = await (supabase as any).rpc('rule_center_new_version', {
    p_rule_id: ruleId,
    p_definition: definition,
    p_inputs: inputs,
  })
  if (error) throw rpcError(error, 'ایجاد نسخه جدید انجام نشد.')
  return data as string
}

export async function duplicateRule(ruleId: string): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('اتصال به پایگاه‌داده برقرار نیست.')
  const { data, error } = await (supabase as any).rpc('rule_center_duplicate_rule', { p_rule_id: ruleId })
  if (error) throw rpcError(error, 'تکثیر قاعده انجام نشد.')
  return data as string
}

export async function stopRuleUsage(ruleId: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('اتصال به پایگاه‌داده برقرار نیست.')
  const { error } = await (supabase as any).rpc('rule_center_stop_usage', { p_rule_id: ruleId })
  if (error) throw rpcError(error, 'توقف استفاده انجام نشد.')
}

export async function deleteDraftRule(ruleId: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('اتصال به پایگاه‌داده برقرار نیست.')
  const { error } = await (supabase as any).rpc('rule_center_delete_draft', { p_rule_id: ruleId })
  if (error) throw rpcError(error, 'حذف قاعده انجام نشد.')
}

// ---------------------------------------------------------------------------
// اتصال‌ها، محاسبه و آزمون
// ---------------------------------------------------------------------------

export async function fetchRuleUsage(versionId: string): Promise<RuleCenterConnection[]> {
  if (!isSupabaseConfigured) return []
  const { data, error } = await (supabase as any).rpc('rule_center_usage', { p_version_id: versionId })
  if (error) return []
  return (data ?? []) as RuleCenterConnection[]
}

export async function fetchEligibleVersions(kind: RuleKind, asOf?: string): Promise<Array<{ version_id: string; rule_id: string; code: string; title_fa: string; version_number: number; status: string; valid_from?: string | null; valid_to?: string | null }>> {
  if (!isSupabaseConfigured) return []
  const { data, error } = await (supabase as any).rpc('rule_center_eligible_versions', { p_kind: kind, p_asof: asOf ?? null })
  if (error) return []
  return (data ?? []) as any[]
}

export async function saveRuleConnection(args: {
  versionId: string
  targetType: 'OBLIGATION_VERSION' | 'ACTION_STEP'
  targetId: string
  /** برای ACTION_STEP: شناسهٔ پایدار اقدام (step_ref) — target_id = الگو */
  targetRef?: string | null
  mapping: Record<string, any>
  decidedStatus?: DecidedStatus
  decidedDoc?: string | null
  active?: boolean
}): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('اتصال به پایگاه‌داده برقرار نیست.')
  const { data, error } = await (supabase as any).rpc('rule_center_save_connection', {
    p_version_id: args.versionId,
    p_target_type: args.targetType,
    p_target_id: args.targetId,
    p_target_ref: args.targetRef ?? null,
    p_mapping: args.mapping,
    p_decided_status: args.decidedStatus ?? 'UNCHECKED',
    p_decided_doc: args.decidedDoc ?? null,
    p_active: args.active ?? true,
  })
  if (error) throw rpcError(error, 'ذخیره اتصال انجام نشد.')
  return data as string
}

/**
 * پس از ذخیرهٔ الگو (ایجاد یا ویرایش)، اتصال‌های مهلت اقدام‌ها را در جدول
 * rule_center_connections همگام می‌کند تا «محل‌های استفاده» دقیق باشد.
 * اتصال فعال فقط به نسخهٔ منتشرشده نوشته می‌شود؛ بقیه به‌صورت پیش‌نویس (DRAFT).
 */
export async function syncActionStepConnections(
  templateId: string,
  steps: Array<{ step_ref?: string | null; id: string; deadline_rule_version_id?: string | null; deadline_mapping?: Record<string, any> | null }>
): Promise<void> {
  if (!isSupabaseConfigured || !templateId) return
  try {
    const rules = await fetchRuleCenterRules()
    const statusMap: Record<string, string> = {}
    for (const r of rules) for (const v of (r as any).versions ?? []) statusMap[v.id] = v.status
    for (const s of steps) {
      if (!s.deadline_rule_version_id) continue
      const status = statusMap[s.deadline_rule_version_id]
      if (!status) continue
      await saveRuleConnection({
        versionId: s.deadline_rule_version_id,
        targetType: 'ACTION_STEP',
        targetId: templateId,
        targetRef: s.step_ref || s.id,
        mapping: s.deadline_mapping ?? {},
        active: status === 'PUBLISHED',
      })
    }
  } catch {
    // همگام‌سازی اتصال‌ها ثانویه است؛ خطای آن نباید ذخیرهٔ الگو را بشکند.
  }
}

export async function decideNoPenalty(connectionId: string, doc: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('اتصال به پایگاه‌داده برقرار نیست.')
  const { error } = await (supabase as any).rpc('rule_center_decide_no_penalty', { p_connection_id: connectionId, p_doc: doc })
  if (error) throw rpcError(error, 'ثبت «بدون جریمه» انجام نشد.')
}

export async function calcDeadline(versionId: string, inputs: Record<string, any>, mode: 'PREVIEW' | 'REAL' = 'PREVIEW', connectionId?: string | null, tenantId?: string | null): Promise<CalcResult> {
  if (!isSupabaseConfigured) throw new Error('اتصال به پایگاه‌داده برقرار نیست.')
  const { data, error } = await (supabase as any).rpc('rule_center_calc_deadline', {
    p_version_id: versionId,
    p_inputs: inputs,
    p_mode: mode,
    p_connection_id: connectionId ?? null,
    p_tenant_id: tenantId ?? null,
  })
  if (error) throw rpcError(error, 'محاسبه مهلت انجام نشد.')
  return data as CalcResult
}

export async function calcPenalty(versionId: string, inputs: Record<string, any>, mode: 'PREVIEW' | 'REAL' = 'PREVIEW', connectionId?: string | null, tenantId?: string | null): Promise<CalcResult> {
  if (!isSupabaseConfigured) throw new Error('اتصال به پایگاه‌داده برقرار نیست.')
  const { data, error } = await (supabase as any).rpc('rule_center_calc_penalty', {
    p_version_id: versionId,
    p_inputs: inputs,
    p_mode: mode,
    p_connection_id: connectionId ?? null,
    p_tenant_id: tenantId ?? null,
  })
  if (error) throw rpcError(error, 'محاسبه جریمه انجام نشد.')
  return data as CalcResult
}

export async function runRuleTest(versionId: string, title: string, inputs: Record<string, any>, expected: Record<string, any>): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('اتصال به پایگاه‌داده برقرار نیست.')
  const { data, error } = await (supabase as any).rpc('rule_center_run_test', {
    p_version_id: versionId,
    p_title: title,
    p_inputs: inputs,
    p_expected: expected,
  })
  if (error) throw rpcError(error, 'اجرای آزمون انجام نشد.')
  return data as string
}

export async function fetchRuleTests(versionId: string): Promise<RuleCenterTestRow[]> {
  if (!isSupabaseConfigured) return []
  const { data, error } = await (supabase as any)
    .from('rule_center_tests')
    .select('*')
    .eq('version_id', versionId)
    .order('created_at', { ascending: false })
  if (error) return []
  return (data ?? []) as RuleCenterTestRow[]
}

export async function rulePublishCheck(connectionId: string): Promise<{ ok: boolean; checks: Array<{ key: string; ok: boolean; label: string }> }> {
  if (!isSupabaseConfigured) return { ok: true, checks: [] }
  const { data, error } = await (supabase as any).rpc('rule_center_publish_check', { p_connection_id: connectionId })
  if (error) return { ok: true, checks: [] }
  return data as any
}

export async function fetchConnectionsForTarget(targetType: 'OBLIGATION_VERSION' | 'ACTION_STEP', targetId: string): Promise<RuleCenterConnection[]> {
  if (!isSupabaseConfigured || !targetId) return []
  try {
    const { data, error } = await (supabase as any)
      .from('rule_center_connections')
      .select('*')
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .order('created_at', { ascending: false })
    if (error) return []
    return (data ?? []) as RuleCenterConnection[]
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// تعریف‌های پیش‌فرض برای ویزارد
// ---------------------------------------------------------------------------

export function emptyDeadlineDefinition(): Record<string, any> {
  return {
    deadline: {
      method: 'INTERVAL_FROM_BASE',
      interval: { value: 10, unit: 'DAY', direction: 'AFTER', base_input: '' },
      count: { include_start: false, calendar: 'CALENDAR_DAYS', month_calendar: 'iran_solar', missing_day_policy: 'LAST_DAY', timezone: 'Asia/Tehran' },
      holiday_roll: { enabled: true, calendar_id: 'iran_official' },
      pauses: [],
      extensions: [],
      no_deadline: false,
    },
    reminders: [],
  }
}

export function emptyRecurrenceDefinition(): Record<string, any> {
  return {
    recurrence: {
      schedule_mode: 'ONE_TIME',
      frequency_unit: null,
      frequency_interval: null,
      period_basis: null,
      period_source_key: null,
      instance_generation_timing: 'MANUAL',
      event_config: null,
    },
    deadline: {
      method: 'INTERVAL_FROM_BASE',
      interval: { value: 10, unit: 'DAY', direction: 'AFTER', base_input: '' },
      count: { include_start: false, calendar: 'CALENDAR_DAYS', month_calendar: 'iran_solar', missing_day_policy: 'LAST_DAY', timezone: 'Asia/Tehran' },
      holiday_roll: { enabled: true, calendar_id: 'iran_official' },
      pauses: [],
      extensions: [],
      no_deadline: false,
    },
    reminders: [],
  }
}

export function emptyPenaltyDefinition(): Record<string, any> {
  return {
    conditions: { logic: 'ALL', clauses: [] },
    calculation: {
      method: 'FIXED',
      amount: 0,
      rate_percent: 0,
      per_unit: 'DAY',
      currency: 'ریال',
      base_input: '',
      start_input: 'effective_deadline',
      end_input: 'payment_date',
      include_first_day: false,
      include_end_day: false,
      accrual_calendar: 'CALENDAR_DAYS',
      working_calendar: 'iran_official',
      tier_mode: 'BRACKET',
      tiers: [],
      components: [],
      limits: { min: null, max: null, round_to: 1, rounding: 'NEAREST', order: 'LIMITS_THEN_ADJUST' },
      compound: false,
      combination: 'SUM',
    },
    decided: { status: 'RULE_ATTACHED' },
  }
}

/** کلید فنی پیشنهادی از عنوان فارسی */
export function suggestRuleCode(kind: RuleKind, title: string): string {
  const base = title
    .replace(/[^آ-یa-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase()
    .slice(0, 48)
  const kindPart = kind === 'PENALTY' ? 'PEN' : kind === 'DEADLINE' ? 'DL' : kind === 'BOTH' ? 'RDL' : 'REC'
  return `${kindPart}_${base || 'RULE'}`
}
