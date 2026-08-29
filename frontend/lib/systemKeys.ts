import { supabase } from './supabase'

// ── Types ───────────────────────────────────────────────────────────────────
export type KeyEntityType =
  | 'FIELD' | 'SELECTION_LIST' | 'SELECTION_OPTION' | 'OBLIGATION'
  | 'WORKFLOW_STEP' | 'OBJECTION_TEMPLATE' | 'OBJECTION_STEP' | 'FORM'
  | 'SHARED_ACTION' | 'OTHER'

export type KeyStatus = 'DRAFT' | 'PUBLISHED' | 'INACTIVE'

export interface SystemKeyRecord {
  id: string
  full_key: string
  title_fa: string
  entity_type: KeyEntityType
  module: string
  form_name: string | null
  form_id: string | null
  source_table: string | null
  source_record_id: string | null
  status: KeyStatus
  usage_count: number
  locked: boolean
  lock_reason: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export const ENTITY_SEGMENT: Record<KeyEntityType, string> = {
  FIELD: 'field',
  SELECTION_LIST: 'list',
  SELECTION_OPTION: 'option',
  OBLIGATION: 'obligation',
  WORKFLOW_STEP: 'step',
  OBJECTION_TEMPLATE: 'template',
  OBJECTION_STEP: 'step',
  FORM: 'form',
  SHARED_ACTION: 'action',
  OTHER: 'item',
}

export const ENTITY_MODULE: Record<KeyEntityType, string> = {
  FIELD: 'company_profile',
  SELECTION_LIST: 'selection',
  SELECTION_OPTION: 'selection',
  OBLIGATION: 'obligations',
  WORKFLOW_STEP: 'workflow',
  OBJECTION_TEMPLATE: 'objection',
  OBJECTION_STEP: 'objection',
  FORM: 'form',
  SHARED_ACTION: 'action',
  OTHER: 'general',
}

export const ENTITY_LABELS: Record<KeyEntityType, string> = {
  FIELD: 'فیلد',
  SELECTION_LIST: 'فهرست انتخابی',
  SELECTION_OPTION: 'گزینه فهرست',
  OBLIGATION: 'تعهد',
  WORKFLOW_STEP: 'گام فرایند',
  OBJECTION_TEMPLATE: 'الگوی اعتراض',
  OBJECTION_STEP: 'گام اعتراض',
  FORM: 'فرم',
  SHARED_ACTION: 'اقدام مشترک',
  OTHER: 'سایر',
}

export const STATUS_LABELS: Record<KeyStatus, string> = {
  DRAFT: 'پیش‌نویس',
  PUBLISHED: 'منتشرشده',
  INACTIVE: 'غیرفعال',
}

export const KEY_FORMAT_HINT =
  'این کلید برای اتصال فنی بخش‌های سامانه استفاده می‌شود. سیستم آن را پیشنهاد می‌دهد. پس از انتشار، امکان تغییر آن محدود می‌شود.'

// ── Persian → English transliteration (deterministic, offline) ───────────────
const FA_PAIRS: Array<[RegExp, string]> = [
  [/[آأا]/g, 'a'], [/[ب]/g, 'b'], [/[پ]/g, 'p'], [/[ت]/g, 't'], [/[ث]/g, 's'],
  [/[ج]/g, 'j'], [/[چ]/g, 'ch'], [/[ح]/g, 'h'], [/[خ]/g, 'kh'], [/[د]/g, 'd'],
  [/[ذ]/g, 'z'], [/[ر]/g, 'r'], [/[ز]/g, 'z'], [/[ژ]/g, 'zh'], [/[س]/g, 's'],
  [/[ش]/g, 'sh'], [/[ص]/g, 's'], [/[ض]/g, 'z'], [/[ط]/g, 't'], [/[ظ]/g, 'z'],
  [/[ع]/g, ''], [/[غ]/g, 'gh'], [/[ف]/g, 'f'], [/[ق]/g, 'gh'], [/[کك]/g, 'k'],
  [/[گ]/g, 'g'], [/[ل]/g, 'l'], [/[م]/g, 'm'], [/[ن]/g, 'n'], [/[و]/g, 'v'],
  [/[ه]/g, 'h'], [/[یي]/g, 'y'],
]

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const EN_DIGITS = '0123456789'

export function normalizeKeySegment(input: string): string {
  let s = (input ?? '')
    .replace(/[\u200c\u200f\u200d\u200b]/g, ' ')
    .replace(/[ًٌٍَُِّْ]/g, ' ')
    .normalize('NFKC')
  s = s.replace(/[۰-۹]/g, (c) => EN_DIGITS[FA_DIGITS.indexOf(c)])
  for (const [re, to] of FA_PAIRS) s = s.replace(re, to)
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function isValidKeyPattern(fullKey: string): boolean {
  return /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/.test(fullKey)
}

const ALTERNATIVE_SUFFIXES: Record<KeyEntityType, string[]> = {
  FIELD: ['_type', '_item', '_record'],
  SELECTION_LIST: ['_list', '_types', '_records'],
  SELECTION_OPTION: ['_value', '_label', '_entry'],
  OBLIGATION: ['_duty', '_obligation', '_task'],
  WORKFLOW_STEP: ['_step', '_stage', '_action'],
  OBJECTION_TEMPLATE: ['_template', '_model', '_pattern'],
  OBJECTION_STEP: ['_step', '_stage', '_action'],
  FORM: ['_form', '_sheet', '_document'],
  SHARED_ACTION: ['_action', '_operation', '_flow'],
  OTHER: ['_item', '_entry', '_definition'],
}

export interface KeySuggestionInput {
  title: string
  entityType: KeyEntityType
  module?: string
  parentKey?: string // e.g. the (raw) list key an option belongs to
  baseKey?: string // current stored raw key; used to keep it stable
}

export interface KeySuggestion {
  key: string
  namespaceReason: string
  alternatives: string[]
}

// Predictable, stable suggestion. Same inputs ⇒ same output.
export function suggestKey(input: KeySuggestionInput): KeySuggestion {
  const module = input.module ?? ENTITY_MODULE[input.entityType]
  const entity = ENTITY_SEGMENT[input.entityType]
  const base = (input.baseKey && normalizeKeySegment(input.baseKey))
    || (input.title && normalizeKeySegment(input.title))
    || 'item'

  // For options, keep the parent list slug as a sub-namespace: option.<list>.<name>
  const segments = [module, entity]
  if (input.entityType === 'SELECTION_OPTION' && input.parentKey) {
    const parentSlug = normalizeKeySegment(input.parentKey)
    if (parentSlug) segments.push(parentSlug)
  }
  segments.push(base || 'item')
  const key = segments.join('.')

  const relBase = input.title && normalizeKeySegment(input.title)
  const alternatives = (ALTERNATIVE_SUFFIXES[input.entityType] ?? [])
    .map((suffix) => {
      const alt = [...segments.slice(0, -1), `${base}${suffix}`].join('.')
      return alt
    })
    .filter((a, i, arr) => a !== key && arr.indexOf(a) === i)
    .slice(0, 3)

  const reason = `نام‌فضای «${module}.${entity}» بر اساس ماژول و نوع موجودیت است؛ بخش پایانی از عنوان فارسی استخراج شده است.`
  return { key, namespaceReason: reason, alternatives }
}

export function rawFromFullKey(fullKey: string): string {
  const parts = fullKey.split('.')
  return parts[parts.length - 1] ?? fullKey
}

// ── Registry data layer ──────────────────────────────────────────────────────
export async function fetchRegistryKeys(filters?: {
  q?: string
  module?: string
  entityType?: KeyEntityType | 'ALL'
  status?: KeyStatus | 'ALL'
}): Promise<SystemKeyRecord[]> {
  const limit = 1000
  let query = (supabase as any).from('system_key_registry').select('*').limit(limit)
  if (filters?.q) query = query.or(
    `full_key.ilike.%${filters.q}%,title_fa.ilike.%${filters.q}%`
  )
  if (filters?.module && filters.module !== 'ALL') query = query.eq('module', filters.module)
  if (filters?.entityType && filters.entityType !== 'ALL') query = query.eq('entity_type', filters.entityType)
  if (filters?.status && filters.status !== 'ALL') query = query.eq('status', filters.status)
  const { data, error } = await query.order('full_key', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as SystemKeyRecord[]
}

// Check whether a full_key already exists (case-insensitive). Returns the
// conflicting record (title/entity/form/status) so the UI can show it.
export async function checkRegistryKey(fullKey: string): Promise<SystemKeyRecord | null> {
  const { data, error } = await (supabase as any)
    .from('system_key_registry')
    .select('*')
    .ilike('full_key', fullKey)
    .limit(1)
  if (error) throw new Error(error.message)
  return (data?.[0] ?? null) as SystemKeyRecord | null
}

export interface RegistryUpsert {
  full_key: string
  title_fa: string
  entity_type: KeyEntityType
  module: string
  form_name?: string | null
  form_id?: string | null
  source_table?: string | null
  source_record_id?: string | null
  locked?: boolean
  lock_reason?: string | null
  status?: KeyStatus
}

// Insert a new draft registry row. Throws a typed error on duplicate (the DB
// UNIQUE constraint is the final guard).
export async function insertRegistryKey(input: RegistryUpsert): Promise<SystemKeyRecord> {
  const { data, error } = await (supabase as any)
    .from('system_key_registry')
    .insert({
      full_key: input.full_key,
      title_fa: input.title_fa,
      entity_type: input.entity_type,
      module: input.module,
      form_name: input.form_name ?? null,
      form_id: input.form_id ?? null,
      source_table: input.source_table ?? null,
      source_record_id: input.source_record_id ?? null,
      status: input.status ?? 'DRAFT',
      locked: input.locked ?? false,
      lock_reason: input.lock_reason ?? null,
    })
    .select('*')
    .single()
  if (error) {
    if (error.message?.toLowerCase().includes('duplicate') || error.code === '23505') {
      throw new Error('KEY_DUPLICATE')
    }
    throw new Error(error.message)
  }
  return data as SystemKeyRecord
}

export async function updateRegistryKey(
  id: string,
  patch: Partial<Pick<RegistryUpsert, 'title_fa' | 'form_name' | 'source_record_id' | 'locked' | 'lock_reason' | 'status'>>
): Promise<void> {
  const { error } = await (supabase as any).from('system_key_registry').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}

// Claim a suggestion transactionally via the DB RPC (returns existing id if taken).
export async function claimRegistryKey(input: RegistryUpsert): Promise<string> {
  const { data, error } = await (supabase as any).rpc('claim_system_key', {
    p_full_key: input.full_key,
    p_title_fa: input.title_fa,
    p_entity_type: input.entity_type,
    p_module: input.module,
    p_form_name: input.form_name ?? null,
    p_source_table: input.source_table ?? null,
    p_locked: input.locked ?? false,
  })
  if (error) {
    if (error.message?.toLowerCase().includes('forbidden')) throw new Error('PERMISSION_DENIED')
    throw new Error(error.message)
  }
  return (data as string) ?? ''
}

// After a source row is saved, keep its registry entry in sync (insert draft
// if missing, update title/source linkage/status). Never rewrites a locked or
// published full_key — those require a controlled migration.
export async function syncRegistryAfterSave(input: RegistryUpsert & { source_record_id: string }): Promise<string | null> {
  if (!isValidKeyPattern(input.full_key)) throw new Error('قالب کلید نامعتبر است.')
  const { data: existingList } = await (supabase as any)
    .from('system_key_registry')
    .select('id,full_key,locked,status,source_record_id,title_fa')
    .eq('source_table', input.source_table ?? '')
    .eq('source_record_id', input.source_record_id)
    .limit(1)
  const existing = existingList?.[0]
  if (existing) {
    // Key may have been changed before it was published; keep the registry in step.
    const patch: Record<string, unknown> = { title_fa: input.title_fa, form_name: input.form_name ?? null }
    if (!existing.locked && existing.status !== 'PUBLISHED') {
      patch.full_key = input.full_key
    }
    await (supabase as any).from('system_key_registry').update(patch).eq('id', existing.id)
    return existing.id
  }
  const rec = await insertRegistryKey({ ...input, status: 'DRAFT', locked: false })
  return rec.id
}

export const REGISTRY_MODULES = ['company_profile', 'selection', 'obligations', 'workflow', 'objection', 'form', 'action', 'general']
export const REGISTRY_ENTITIES: KeyEntityType[] = ['FIELD', 'SELECTION_LIST', 'SELECTION_OPTION', 'OBLIGATION', 'WORKFLOW_STEP', 'OBJECTION_TEMPLATE', 'OBJECTION_STEP', 'FORM', 'SHARED_ACTION', 'OTHER']