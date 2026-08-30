import { supabase, isSupabaseConfigured } from './supabase'

export type CompanyFieldType = 'TEXT' | 'LONG_TEXT' | 'SELECT' | 'MULTI_SELECT' | 'BOOLEAN' | 'NUMBER' | 'DATE' | 'NATIONAL_ID'
export type CompanyFieldSection = 'INITIAL' | 'COMPLEMENTARY' | 'BOTH'
export type CompanyWidth = 'FULL' | 'HALF'
export type CompanyStatus = 'DRAFT' | 'PUBLISHED'

export interface CompanyFieldDefinition {
  id: string
  key: string
  title: string
  field_type: CompanyFieldType
  help_text: string | null
  required: boolean
  section: CompanyFieldSection
  wizard_step_id: string | null
  sort_order: number
  width: CompanyWidth
  display_condition: Record<string, { operator: string; value: string }> | null
  ambiguous_titles: Record<string, string> | null
  is_active: boolean
  is_system: boolean
  is_deletable: boolean
  used_in_eligibility: boolean
  status: CompanyStatus
  selection_list_id: string | null
  condition_model: unknown | null
  created_at: string
  updated_at: string
}

export interface CompanyFieldOption {
  id: string
  field_id: string
  value: string
  label: string
  sort_order: number
  is_active: boolean
}

export interface CompanyWizardStep {
  id: string
  title: string
  description: string | null
  icon: string | null
  sort_order: number
  columns: 1 | 2
  display_condition: Record<string, { operator: string; value: string }> | null
  is_active: boolean
  status: CompanyStatus
  created_at: string
  updated_at: string
}

export interface CompanyFieldValue {
  id: string
  tenant_id: string
  field_id: string
  value: string
  recorded_by: string
  created_at: string
  updated_at: string
}

export interface CompanyInfoDesign {
  definitions: CompanyFieldDefinition[]
  options: CompanyFieldOption[]
  steps: CompanyWizardStep[]
  // Published central selection lists + their options, resolved for list-linked
  // SELECT/MULTI_SELECT fields at render/definition time.
  selectionLists: Array<{ id: string; key: string; title: string; source_type: string; is_dependent: boolean; parent_list_id: string | null }>
  selectionOptions: Array<{ id: string; list_id: string; key: string; label: string; parent_option_id: string | null; sort_order: number; is_active: boolean }>
}

function mapRow<T>(row: any, fallback: T): T {
  return (row ?? fallback) as T
}

// Admin designer: all statuses (drafts + published), plus options and steps.
export async function fetchCompanyInfoDesign(): Promise<CompanyInfoDesign> {
  const empty: CompanyInfoDesign = { definitions: [], options: [], steps: [], selectionLists: [], selectionOptions: [] }
  if (!isSupabaseConfigured) return empty
  const [defsRes, optsRes, stepsRes] = await Promise.all([
    (supabase as any).from('company_field_definitions').select('*').order('sort_order', { ascending: true }),
    (supabase as any).from('company_field_options').select('*').order('sort_order', { ascending: true }),
    (supabase as any).from('company_wizard_steps').select('*').order('sort_order', { ascending: true }),
  ])
  if (defsRes.error || optsRes.error || stepsRes.error) {
    throw new Error(defsRes.error?.message ?? optsRes.error?.message ?? stepsRes.error?.message ?? 'دریافت طراحی اطلاعات شرکت ناموفق بود.')
  }
  return {
    definitions: defsRes.data ?? [],
    options: optsRes.data ?? [],
    steps: stepsRes.data ?? [],
    selectionLists: [],
    selectionOptions: [],
  }
}

// Workspace: only the published, active definitions (all sections) + steps +
// the published selection lists those fields may be linked to.
export async function fetchPublishedCompanyFields(): Promise<CompanyInfoDesign> {
  const empty: CompanyInfoDesign = { definitions: [], options: [], steps: [], selectionLists: [], selectionOptions: [] }
  if (!isSupabaseConfigured) return empty
  const [defsRes, optsRes, stepsRes, listsRes, listOptsRes] = await Promise.all([
    (supabase as any).from('company_field_definitions').select('*').eq('status', 'PUBLISHED').eq('is_active', true).order('sort_order', { ascending: true }),
    (supabase as any).from('company_field_options').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
    (supabase as any).from('company_wizard_steps').select('*').eq('status', 'PUBLISHED').eq('is_active', true).order('sort_order', { ascending: true }),
    (supabase as any).from('selection_lists').select('*').eq('status', 'PUBLISHED').eq('is_active', true).order('title', { ascending: true }),
    (supabase as any).from('selection_list_options').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
  ])
  if (defsRes.error || optsRes.error || stepsRes.error || listsRes.error || listOptsRes.error) {
    throw new Error(defsRes.error?.message ?? optsRes.error?.message ?? stepsRes.error?.message ?? listsRes.error?.message ?? listOptsRes.error?.message ?? 'دریافت تعاریف ناموفق بود.')
  }
  return {
    // فکت‌های legacy در جدول جداگانه (eligibility_legacy_facts) نگهداری
    // می‌شوند و هرگز در فرم اطلاعات شرکت ظاهر نمی‌شوند.
    definitions: defsRes.data ?? [],
    options: optsRes.data ?? [],
    steps: stepsRes.data ?? [],
    selectionLists: (listsRes.data ?? []).map((l: any) => ({ id: l.id, key: l.key, title: l.title, source_type: l.source_type, is_dependent: l.is_dependent, parent_list_id: l.parent_list_id })),
    selectionOptions: listOptsRes.data ?? [],
  }
}

export async function saveCompanyFieldDefinition(def: Partial<CompanyFieldDefinition>): Promise<CompanyFieldDefinition | null> {
  if (!isSupabaseConfigured) return null
  const payload: any = {
    key: def.key,
    title: def.title,
    field_type: def.field_type,
    help_text: def.help_text ?? null,
    required: def.required ?? false,
    section: def.section ?? 'COMPLEMENTARY',
    wizard_step_id: def.wizard_step_id ?? null,
    sort_order: def.sort_order ?? 0,
    width: def.width ?? 'FULL',
    display_condition: def.display_condition ?? null,
    ambiguous_titles: def.ambiguous_titles ?? null,
    is_active: def.is_active ?? true,
    is_system: def.is_system ?? false,
    is_deletable: def.is_deletable ?? true,
    used_in_eligibility: def.used_in_eligibility ?? false,
    selection_list_id: def.selection_list_id ?? null,
    condition_model: def.condition_model ?? null,
  }
  const { data, error } = await (supabase as any)
    .from('company_field_definitions')
    .upsert({ ...payload, ...(def.id ? { id: def.id } : {}) })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function setCompanyFieldDefinitionActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await (supabase as any).from('company_field_definitions').update({ is_active: isActive, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteCompanyFieldDefinition(id: string): Promise<void> {
  const { error } = await (supabase as any).from('company_field_definitions').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function saveCompanyFieldOptions(fieldId: string, options: Array<{ id?: string; value: string; label: string; sort_order: number }>): Promise<void> {
  if (!isSupabaseConfigured) return
  // Replace the non-system options of the field atomically-ish (delete others, upsert these).
  const { error: delError } = await (supabase as any).from('company_field_options').delete().eq('field_id', fieldId).not('id', 'in', options.filter((o) => o.id).map((o) => o.id!))
  if (delError) throw new Error(delError.message)
  if (options.length > 0) {
    const { error } = await (supabase as any).from('company_field_options').upsert(options.map((o) => ({
      ...(o.id ? { id: o.id } : {}),
      field_id: fieldId,
      value: o.value,
      label: o.label,
      sort_order: o.sort_order,
    })))
    if (error) throw new Error(error.message)
  }
}

export async function saveCompanyWizardStep(step: Partial<CompanyWizardStep>): Promise<CompanyWizardStep | null> {
  if (!isSupabaseConfigured) return null
  const { data, error } = await (supabase as any)
    .from('company_wizard_steps')
    .upsert({
      ...(step.id ? { id: step.id } : {}),
      title: step.title,
      description: step.description ?? null,
      icon: step.icon ?? null,
      sort_order: step.sort_order ?? 0,
      columns: step.columns ?? 1,
      display_condition: step.display_condition ?? null,
      is_active: step.is_active ?? true,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteCompanyWizardStep(id: string): Promise<void> {
  const { error } = await (supabase as any).from('company_wizard_steps').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function setCompanyWizardStepActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await (supabase as any).from('company_wizard_steps').update({ is_active: isActive, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function publishCompanyInfoDesign(): Promise<number> {
  if (!isSupabaseConfigured) throw new Error('اتصال به پایگاه‌داده برقرار نیست.')
  const { data, error } = await (supabase as any).rpc('publish_company_info_design')
  if (error) throw new Error(error.message)
  return Number(data ?? 0)
}

// ── Company field values (workspace) ──
export async function fetchCompanyFieldValues(tenantId: string): Promise<CompanyFieldValue[]> {
  if (!isSupabaseConfigured) return []
  const { data, error } = await (supabase as any)
    .from('company_field_values')
    .select('*')
    .eq('tenant_id', tenantId)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function upsertCompanyFieldValues(tenantId: string, entries: Array<{ field_id: string; value: string }>): Promise<void> {
  if (!isSupabaseConfigured) return
  if (entries.length === 0) return
  const { error } = await (supabase as any)
    .from('company_field_values')
    .upsert(entries.map((entry) => ({ tenant_id: tenantId, field_id: entry.field_id, value: entry.value })), { onConflict: 'tenant_id,field_id' })
  if (error) throw new Error(error.message)
}