/**
 * Unified Supabase data access layer.
 * Replaces all mockDb functions with real database queries.
 */
import { supabase, isSupabaseConfigured } from './supabase'
import type { ObjectionTemplate, ObjectionStep, Obligation, WorkflowStepField, DeadlineExtension } from './supabase'

// ---------------------------------------------------------------------------
// Types (match the mockDb interfaces exactly)
// ---------------------------------------------------------------------------

export interface TenantFiscalYear {
  id: string
  tenant_id: string
  title: string
  start_date: string
  end_date: string
  status: 'ACTIVE' | 'CLOSED' | 'DRAFT'
  created_at: string
}

export interface CorporateTaxFiling {
  id: string
  tenant_id: string
  fiscal_year: string
  status: string
  tracking_number?: string
  submission_date?: string
  taxable_income?: string
  tax_amount?: string
  notes?: string
  stage_data?: Record<string, Record<string, any>>
  created_at: string
}

export interface VatTaxFiling {
  id: string
  tenant_id: string
  fiscal_year_period: string
  period: string
  status: string
  tracking_number?: string
  submission_date?: string
  sales_amount?: string
  purchase_amount?: string
  vat_amount?: string
  vat_payable?: string
  notes?: string
  stage_data?: Record<string, Record<string, any>>
  created_at: string
}

export interface ChecklistTemplate {
  id: string
  title: string
  description?: string
  category: string
  fiscal_year?: string
  sections: any[]
  is_active: boolean
  created_at: string
}

export interface TenantChecklistProgress {
  id: string
  tenant_id: string
  checklist_template_id: string
  fiscal_year: string
  completed_items: Record<string, { completed: boolean; notes?: string }>
  status: string
  created_at: string
}

export interface CommercialBookPeriod {
  id: string
  tenant_id?: string
  fiscal_year: string
  period_type: 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL' | 'ANNUAL_SEALING'
  title: string
  statutory_deadline: string
  extended_deadline?: string | null
  circular_number?: string | null
  circular_date?: string | null
  attachment_url?: string | null
  attachment_name?: string | null
  notes?: string | null
  is_active: boolean
  created_at: string
}

// ---------------------------------------------------------------------------
// Helper: safe Supabase query wrapper
// ---------------------------------------------------------------------------

async function safeQuery<T>(queryFn: () => any): Promise<T[]> {
  if (!isSupabaseConfigured) return []
  try {
    const result = await Promise.resolve(queryFn())
    if (result?.error) {
      console.warn('[supabaseDb] Query error:', result.error.message || result.error)
      return []
    }
    return (result?.data ?? []) as T[]
  } catch (err) {
    console.warn('[supabaseDb] Query exception:', err)
    return []
  }
}

// ---------------------------------------------------------------------------
// User-defined objection templates
// ---------------------------------------------------------------------------

export async function fetchObjectionTemplates(): Promise<ObjectionTemplate[]> {
  if (!isSupabaseConfigured) return []
  const { data: templates, error } = await (supabase as any)
    .from('objection_templates')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)

  const templateIds = (templates ?? []).map((template: any) => template.id)
  let steps: any[] = []
  if (templateIds.length > 0) {
    const { data: stepRows, error: stepsError } = await (supabase as any)
      .from('objection_steps')
      .select('*')
      .in('template_id', templateIds)
      .order('sequence', { ascending: true })
    if (stepsError) throw new Error(stepsError.message)
    steps = stepRows ?? []
  }

  return (templates ?? []).map((template: any) => ({
    id: template.id,
    template_name: template.title,
    description: template.description,
    is_base_template: true,
    created_at: template.created_at,
    steps: steps
      .filter((step: any) => step.template_id === template.id)
      .map((step: any) => ({
        id: step.id,
        title: step.title,
        actor: step.actor,
        gap_value: step.gap_value,
        gap_unit: step.gap_unit,
        base_event: step.base_event,
        step_nature: step.step_nature,
        legal_basis: step.legal_basis,
        fields: step.form_schema?.fields ?? [],
      })),
  })) as ObjectionTemplate[]
}

// ---------------------------------------------------------------------------
// Obligations (from obligations table)
// ---------------------------------------------------------------------------

export async function fetchObligations(taxType?: string): Promise<Obligation[]> {
  let query = (supabase as any).from('obligations').select('*')
  if (taxType) query = query.eq('obligation_type', taxType)
  const data = await safeQuery(() => query.order('title'))
  return data as Obligation[]
}

export async function fetchObligationById(id: string): Promise<Obligation | null> {
  if (!isSupabaseConfigured) return null
  const { data, error } = await (supabase as any).from('obligations').select('*').eq('id', id).single()
  if (error || !data) return null
  return data as unknown as Obligation
}

// ---------------------------------------------------------------------------
// Tenant Fiscal Years
// ---------------------------------------------------------------------------

export async function fetchFiscalYears(tenantId: string): Promise<TenantFiscalYear[]> {
  return safeQuery(() =>
    (supabase as any)
      .from('tenant_fiscal_years')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('title', { ascending: false })
  )
}

export async function createFiscalYear(payload: Omit<TenantFiscalYear, 'id' | 'created_at'>): Promise<TenantFiscalYear | null> {
  if (!isSupabaseConfigured) return null
  const { data, error } = await (supabase as any)
    .from('tenant_fiscal_years')
    .insert(payload)
    .select()
    .single()
  if (error) { console.warn('[supabaseDb] createFiscalYear:', error.message); return null }
  return data
}

export async function updateFiscalYear(id: string, payload: Partial<TenantFiscalYear>): Promise<TenantFiscalYear | null> {
  if (!isSupabaseConfigured) return null
  const { data, error } = await (supabase as any)
    .from('tenant_fiscal_years')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) { console.warn('[supabaseDb] updateFiscalYear:', error.message); return null }
  return data
}

export async function deleteFiscalYear(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false
  const { error } = await (supabase as any).from('tenant_fiscal_years').delete().eq('id', id)
  return !error
}

export type FiscalYearStatus = 'CURRENT' | 'UPCOMING' | 'ENDED' | 'CLOSED' | 'DRAFT'

export function jalaaliToday(): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
    const get = (type: any) => parts.find((p) => p.type === type)?.value ?? ''
    return `${get('year')}/${get('month')}/${get('day')}`
  } catch {
    return ''
  }
}

// Dates are stored as zero-padded Jalali "YYYY/MM/DD" text, so string
// comparison matches chronological order without a date library.
export function describeFiscalYearState(year: Pick<TenantFiscalYear, 'start_date' | 'end_date' | 'status'>): { key: FiscalYearStatus; label: string } {
  if (year.status === 'CLOSED') return { key: 'CLOSED', label: 'بسته‌شده' }
  if (!year.start_date || !year.end_date) return { key: 'DRAFT', label: 'پیش‌نویس' }
  const today = jalaaliToday()
  if (today !== '') {
    if (today < year.start_date) return { key: 'UPCOMING', label: 'آینده' }
    if (today > year.end_date) return { key: 'ENDED', label: 'پایان‌یافته' }
  }
  return { key: 'CURRENT', label: 'جاری' }
}

export function fiscalYearOptionLabel(year: Pick<TenantFiscalYear, 'title' | 'start_date' | 'end_date' | 'status'>) {
  const state = describeFiscalYearState(year)
  return `${year.title} — از ${year.start_date} تا ${year.end_date} (${state.label})`
}

// Securely link a fiscal year to an obligation case (permission checked server-side).
export async function setCaseFiscalYear(caseId: string, fiscalYearId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: 'اتصال به پایگاه‌داده برقرار نیست.' }
  const { error } = await (supabase as any).rpc('set_case_fiscal_year', { p_case_id: caseId, p_fiscal_year_id: fiscalYearId })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Corporate Tax Filings
// ---------------------------------------------------------------------------

export async function fetchCorporateFilings(tenantId: string): Promise<CorporateTaxFiling[]> {
  return safeQuery(() =>
    (supabase as any)
      .from('corporate_tax_filings')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
  )
}

export async function createCorporateFiling(payload: Omit<CorporateTaxFiling, 'id' | 'created_at'>): Promise<CorporateTaxFiling | null> {
  if (!isSupabaseConfigured) return null
  const { data, error } = await (supabase as any)
    .from('corporate_tax_filings')
    .insert(payload)
    .select()
    .single()
  if (error) { console.warn('[supabaseDb] createCorporateFiling:', error.message); return null }
  return data
}

export async function updateCorporateFiling(id: string, payload: Partial<CorporateTaxFiling>): Promise<CorporateTaxFiling | null> {
  if (!isSupabaseConfigured) return null
  const { data, error } = await (supabase as any)
    .from('corporate_tax_filings')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) { console.warn('[supabaseDb] updateCorporateFiling:', error.message); return null }
  return data
}

// ---------------------------------------------------------------------------
// VAT Tax Filings
// ---------------------------------------------------------------------------

export async function fetchVatFilings(tenantId: string): Promise<VatTaxFiling[]> {
  return safeQuery(() =>
    (supabase as any)
      .from('vat_tax_filings')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
  )
}

export async function createVatFiling(payload: Omit<VatTaxFiling, 'id' | 'created_at'>): Promise<VatTaxFiling | null> {
  if (!isSupabaseConfigured) return null
  const { data, error } = await (supabase as any)
    .from('vat_tax_filings')
    .insert(payload)
    .select()
    .single()
  if (error) { console.warn('[supabaseDb] createVatFiling:', error.message); return null }
  return data
}

export async function updateVatFiling(id: string, payload: Partial<VatTaxFiling>): Promise<VatTaxFiling | null> {
  if (!isSupabaseConfigured) return null
  const { data, error } = await (supabase as any)
    .from('vat_tax_filings')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) { console.warn('[supabaseDb] updateVatFiling:', error.message); return null }
  return data
}

// ---------------------------------------------------------------------------
// Checklist Templates
// ---------------------------------------------------------------------------

export async function fetchChecklistTemplates(): Promise<ChecklistTemplate[]> {
  return safeQuery(() =>
    (supabase as any)
      .from('checklist_templates')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
  )
}

export async function createChecklistTemplate(payload: Omit<ChecklistTemplate, 'id' | 'created_at'>): Promise<ChecklistTemplate | null> {
  if (!isSupabaseConfigured) return null
  const { data, error } = await (supabase as any)
    .from('checklist_templates')
    .insert(payload)
    .select()
    .single()
  if (error) { console.warn('[supabaseDb] createChecklistTemplate:', error.message); return null }
  return data
}

export async function updateChecklistTemplate(id: string, payload: Partial<ChecklistTemplate>): Promise<ChecklistTemplate | null> {
  if (!isSupabaseConfigured) return null
  const { data, error } = await (supabase as any)
    .from('checklist_templates')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) { console.warn('[supabaseDb] updateChecklistTemplate:', error.message); return null }
  return data
}

export async function deleteChecklistTemplate(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false
  const { error } = await (supabase as any).from('checklist_templates').delete().eq('id', id)
  return !error
}

// ---------------------------------------------------------------------------
// Tenant Checklist Progress
// ---------------------------------------------------------------------------

export async function fetchChecklistProgress(tenantId: string, templateId: string, fiscalYear: string): Promise<TenantChecklistProgress | null> {
  if (!isSupabaseConfigured) return null
  const { data, error } = await (supabase as any)
    .from('tenant_checklist_progress')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('checklist_template_id', templateId)
    .eq('fiscal_year', fiscalYear)
    .single()
  if (error || !data) return null
  return data
}

export async function upsertChecklistProgress(payload: {
  tenant_id: string; checklist_template_id: string; fiscal_year: string;
  completed_items: Record<string, { completed: boolean; notes?: string }>; status: string;
}): Promise<TenantChecklistProgress | null> {
  if (!isSupabaseConfigured) return null
  const { data, error } = await (supabase as any)
    .from('tenant_checklist_progress')
    .upsert(payload, { onConflict: 'tenant_id,checklist_template_id,fiscal_year' })
    .select()
    .single()
  if (error) { console.warn('[supabaseDb] upsertChecklistProgress:', error.message); return null }
  return data
}

// ---------------------------------------------------------------------------
// Commercial Book Periods
// ---------------------------------------------------------------------------

export async function fetchCommercialBookPeriods(tenantId: string): Promise<CommercialBookPeriod[]> {
  return safeQuery(() =>
    (supabase as any)
      .from('commercial_book_periods')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
  )
}

export async function createCommercialBookPeriod(payload: Omit<CommercialBookPeriod, 'id' | 'created_at'>): Promise<CommercialBookPeriod | null> {
  if (!isSupabaseConfigured) return null
  const { data, error } = await (supabase as any)
    .from('commercial_book_periods')
    .insert(payload)
    .select()
    .single()
  if (error) { console.warn('[supabaseDb] createCommercialBookPeriod:', error.message); return null }
  return data
}

export async function updateCommercialBookPeriod(id: string, payload: Partial<CommercialBookPeriod>): Promise<CommercialBookPeriod | null> {
  if (!isSupabaseConfigured) return null
  const { data, error } = await (supabase as any)
    .from('commercial_book_periods')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) { console.warn('[supabaseDb] updateCommercialBookPeriod:', error.message); return null }
  return data
}

export async function deleteCommercialBookPeriod(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false
  const { error } = await (supabase as any).from('commercial_book_periods').delete().eq('id', id)
  return !error
}

// ---------------------------------------------------------------------------
// Deadline Extensions
// ---------------------------------------------------------------------------

export async function fetchDeadlineExtensions(): Promise<DeadlineExtension[]> {
  return safeQuery(() =>
    (supabase as any)
      .from('deadline_extensions')
      .select('*')
      .order('created_at', { ascending: false })
  )
}

export async function createDeadlineExtension(payload: Omit<DeadlineExtension, 'id' | 'created_at'>): Promise<DeadlineExtension | null> {
  if (!isSupabaseConfigured) return null
  const { data, error } = await (supabase as any)
    .from('deadline_extensions')
    .insert(payload)
    .select()
    .single()
  if (error) { console.warn('[supabaseDb] createDeadlineExtension:', error.message); return null }
  return data
}

// ---------------------------------------------------------------------------
// Tenant Obligation Fulfillments
// ---------------------------------------------------------------------------

export async function fetchFulfillments(tenantId: string): Promise<any[]> {
  return safeQuery(() =>
    (supabase as any)
      .from('tenant_obligation_fulfillments')
      .select('*')
      .eq('tenant_id', tenantId)
  )
}

export async function upsertFulfillment(payload: {
  tenant_id: string; obligation_id: string; status: string; completed_at?: string; notes?: string;
}): Promise<any | null> {
  if (!isSupabaseConfigured) return null
  const { data, error } = await (supabase as any)
    .from('tenant_obligation_fulfillments')
    .upsert(payload, { onConflict: 'tenant_id,obligation_id' })
    .select()
    .single()
  if (error) { console.warn('[supabaseDb] upsertFulfillment:', error.message); return null }
  return data
}

// ---------------------------------------------------------------------------
// Tenants (wrapping existing table)
// ---------------------------------------------------------------------------

export async function fetchTenants(): Promise<any[]> {
  return safeQuery(() =>
    supabase.from('tenants').select('*').order('name')
  )
}

export async function fetchUserTenants(userId: string): Promise<any[]> {
  return safeQuery(() =>
    (supabase as any)
      .from('user_tenants')
      .select('*, tenants(*)')
      .eq('user_id', userId)
  )
}

// ---------------------------------------------------------------------------
// Objection Templates CRUD
// ---------------------------------------------------------------------------

export async function fetchObjectionTemplateById(id: string): Promise<ObjectionTemplate | null> {
  const templates = await fetchObjectionTemplates()
  return templates.find((template) => template.id === id) ?? null
}

type ObjectionTemplateWrite = {
  template_name: string
  description?: string
  steps: ObjectionStep[]
}

function serializeObjectionSteps(templateId: string, steps: ObjectionStep[]) {
  return steps.map((step, index) => ({
    template_id: templateId,
    sequence: index + 1,
    code: `STEP_${index + 1}`,
    title: step.title,
    actor: step.actor ?? 'TAXPAYER',
    gap_value: step.gap_value ?? 0,
    gap_unit: step.gap_unit ?? 'روز',
    base_event: step.base_event ?? null,
    step_nature: step.step_nature ?? 'MANDATORY',
    legal_basis: step.legal_basis ?? null,
    form_schema: { fields: step.fields ?? [] },
    is_optional: step.step_nature === 'CONDITIONAL_EXPERT',
  }))
}

export async function createObjectionTemplate(payload: ObjectionTemplateWrite): Promise<any> {
  if (!isSupabaseConfigured) throw new Error('اتصال به پایگاه‌داده برقرار نیست.')
  const { data, error } = await (supabase as any).from('objection_templates').insert({
    title: payload.template_name,
    description: payload.description ?? null,
    is_active: true,
  }).select().single()
  if (error || !data) throw new Error(error?.message ?? 'ایجاد الگو انجام نشد.')

  const { error: stepsError } = await (supabase as any)
    .from('objection_steps')
    .insert(serializeObjectionSteps(data.id, payload.steps))
  if (stepsError) {
    await (supabase as any).from('objection_templates').delete().eq('id', data.id)
    throw new Error(stepsError.message)
  }
  return data
}

export async function updateObjectionTemplate(id: string, payload: ObjectionTemplateWrite): Promise<any> {
  if (!isSupabaseConfigured) throw new Error('اتصال به پایگاه‌داده برقرار نیست.')
  const { data, error } = await (supabase as any).from('objection_templates').update({
    title: payload.template_name,
    description: payload.description ?? null,
    updated_at: new Date().toISOString(),
  }).eq('id', id).select().single()
  if (error || !data) throw new Error(error?.message ?? 'ویرایش الگو انجام نشد.')

  const { error: deleteError } = await (supabase as any).from('objection_steps').delete().eq('template_id', id)
  if (deleteError) throw new Error(deleteError.message)
  const { error: stepsError } = await (supabase as any)
    .from('objection_steps')
    .insert(serializeObjectionSteps(id, payload.steps))
  if (stepsError) throw new Error(stepsError.message)
  return data
}

export async function deleteObjectionTemplate(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false
  const { error } = await (supabase as any).from('objection_templates').delete().eq('id', id)
  return !error
}

// ---------------------------------------------------------------------------
// Obligations CRUD
// ---------------------------------------------------------------------------

export async function createObligation(payload: any): Promise<any | null> {
  if (!isSupabaseConfigured) return null
  const { data, error } = await (supabase as any).from('obligations').insert(payload).select().single()
  if (error) { console.warn('[supabaseDb] createObligation:', error.message); return null }
  return data
}

export async function updateObligation(id: string, payload: any): Promise<any | null> {
  if (!isSupabaseConfigured) return null
  const { data, error } = await (supabase as any).from('obligations').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', id).select().single()
  if (error) { console.warn('[supabaseDb] updateObligation:', error.message); return null }
  return data
}

export async function deleteObligation(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false
  const { error } = await (supabase as any).from('obligations').delete().eq('id', id)
  return !error
}

// ---------------------------------------------------------------------------
// Deadline Extensions CRUD
// ---------------------------------------------------------------------------

export async function deleteDeadlineExtension(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false
  const { error } = await (supabase as any).from('deadline_extensions').delete().eq('id', id)
  return !error
}

// ---------------------------------------------------------------------------
// Tenants CRUD
// ---------------------------------------------------------------------------

export async function createTenant(payload: { name: string; entity_type: string; national_id?: string; economic_code?: string; province?: string; created_by: string }): Promise<any | null> {
  if (!isSupabaseConfigured) return null
  const { data, error } = await (supabase as any).from('tenants').insert(payload).select().single()
  if (error) { console.warn('[supabaseDb] createTenant:', error.message); return null }
  return data
}

// ---------------------------------------------------------------------------
// Studio DB: Obligation Families
// ---------------------------------------------------------------------------

export async function fetchObligationFamilies(): Promise<any[]> {
  return safeQuery(() => (supabase as any).from('obligation_families').select('*').order('title'))
}

export async function createObligationFamily(data: { code: string; title: string; domain: string; description?: string; is_active?: boolean }): Promise<any | null> {
  if (!isSupabaseConfigured) return null
  const { data: result, error } = await (supabase as any).from('obligation_families').insert({
    code: data.code, title: data.title, domain: data.domain,
    description: data.description ?? null, is_active: data.is_active ?? true,
  }).select().single()
  if (error) { console.warn('[supabaseDb] createObligationFamily:', error.message); return null }
  return result
}

export async function updateObligationFamily(id: string, data: any): Promise<any | null> {
  if (!isSupabaseConfigured) return null
  const { data: result, error } = await (supabase as any).from('obligation_families').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single()
  if (error) { console.warn('[supabaseDb] updateObligationFamily:', error.message); return null }
  return result
}

export async function deleteObligationFamily(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false
  const { error } = await (supabase as any).from('obligation_families').delete().eq('id', id)
  return !error
}

// ---------------------------------------------------------------------------
// Studio DB: Obligations (Studio version)
// ---------------------------------------------------------------------------

export async function fetchStudioObligations(): Promise<any[]> {
  return safeQuery(() => (supabase as any).from('obligations').select('*').order('title'))
}

export async function fetchObligationVersions(): Promise<any[]> {
  return safeQuery(() => (supabase as any).from('obligation_versions').select('*').order('created_at', { ascending: false }))
}

// ---------------------------------------------------------------------------
// Studio DB: Workflow Templates & Steps
// ---------------------------------------------------------------------------

export async function fetchWorkflowTemplate(versionId: string): Promise<any | null> {
  if (!isSupabaseConfigured) return null
  const { data, error } = await (supabase as any).from('workflow_templates').select('*').eq('obligation_version_id', versionId).single()
  if (error || !data) return null
  return data
}

export async function fetchWorkflowSteps(templateId: string): Promise<any[]> {
  return safeQuery(() =>
    (supabase as any).from('workflow_steps').select('*').eq('workflow_template_id', templateId).order('sequence')
  )
}

export async function createWorkflowStep(data: any): Promise<any | null> {
  if (!isSupabaseConfigured) return null
  const { data: result, error } = await (supabase as any).from('workflow_steps').insert(data).select().single()
  if (error) { console.warn('[supabaseDb] createWorkflowStep:', error.message); return null }
  return result
}

export async function updateWorkflowStep(id: string, data: any): Promise<any | null> {
  if (!isSupabaseConfigured) return null
  const { data: result, error } = await (supabase as any).from('workflow_steps').update(data).eq('id', id).select().single()
  if (error) { console.warn('[supabaseDb] updateWorkflowStep:', error.message); return null }
  return result
}

export async function deleteWorkflowStep(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false
  const { error } = await (supabase as any).from('workflow_steps').delete().eq('id', id)
  return !error
}

// ---------------------------------------------------------------------------
// Studio DB: Eligibility Rule Sets & Conditions
// ---------------------------------------------------------------------------

export async function fetchRuleSets(versionId: string): Promise<any[]> {
  return safeQuery(() =>
    (supabase as any).from('eligibility_rule_sets').select('*').eq('obligation_version_id', versionId).order('priority')
  )
}

export async function fetchConditions(ruleSetId: string): Promise<any[]> {
  return safeQuery(() =>
    (supabase as any).from('eligibility_conditions').select('*').eq('rule_set_id', ruleSetId).order('sequence')
  )
}

export async function createRuleSet(data: any): Promise<any | null> {
  if (!isSupabaseConfigured) return null
  const { data: result, error } = await (supabase as any).from('eligibility_rule_sets').insert(data).select().single()
  if (error) { console.warn('[supabaseDb] createRuleSet:', error.message); return null }
  return result
}

export async function updateRuleSet(id: string, data: any): Promise<any | null> {
  if (!isSupabaseConfigured) return null
  const { data: result, error } = await (supabase as any).from('eligibility_rule_sets').update(data).eq('id', id).select().single()
  if (error) { console.warn('[supabaseDb] updateRuleSet:', error.message); return null }
  return result
}

export async function deleteRuleSet(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false
  const { error } = await (supabase as any).from('eligibility_rule_sets').delete().eq('id', id)
  return !error
}

// ---------------------------------------------------------------------------
// Studio DB: Circulars
// ---------------------------------------------------------------------------

export async function fetchCirculars(): Promise<any[]> {
  return safeQuery(() => (supabase as any).from('circulars').select('*').order('created_at', { ascending: false }))
}

export async function createCircular(data: any): Promise<any | null> {
  if (!isSupabaseConfigured) return null
  const { data: result, error } = await (supabase as any).from('circulars').insert(data).select().single()
  if (error) { console.warn('[supabaseDb] createCircular:', error.message); return null }
  return result
}

// ---------------------------------------------------------------------------
// Studio DB: Version Operations
// ---------------------------------------------------------------------------

export async function publishVersion(versionId: string): Promise<any | null> {
  if (!isSupabaseConfigured) return null
  const { data, error } = await (supabase as any).from('obligation_versions').update({
    status: 'PUBLISHED', published_at: new Date().toISOString(),
  }).eq('id', versionId).select().single()
  if (error) { console.warn('[supabaseDb] publishVersion:', error.message); return null }
  return data
}

export async function transitionVersionStatus(versionId: string, status: string): Promise<any | null> {
  if (!isSupabaseConfigured) return null
  const { data, error } = await (supabase as any).from('obligation_versions').update({
    status, updated_at: new Date().toISOString(),
  }).eq('id', versionId).select().single()
  if (error) { console.warn('[supabaseDb] transitionVersionStatus:', error.message); return null }
  return data
}

export async function updateVersionPenalty(versionId: string, penaltyRule: any): Promise<boolean> {
  if (!isSupabaseConfigured) return false
  const { error } = await (supabase as any).from('obligation_versions').update({
    penalty_rule: penaltyRule, updated_at: new Date().toISOString(),
  }).eq('id', versionId)
  return !error
}

// ---------------------------------------------------------------------------
// Dependency checker (replaces mockDb dependencyChecker)
// ---------------------------------------------------------------------------

export async function checkObligationDependencies(obligationId: string): Promise<{ linkedExtensions: number; linkedTemplates: number; hasDependencies: boolean }> {
  if (!isSupabaseConfigured) return { linkedExtensions: 0, linkedTemplates: 0, hasDependencies: false }
  const [extResult, tplResult] = await Promise.all([
    (supabase as any).from('deadline_extensions').select('id', { count: 'exact', head: true }).eq('obligation_id', obligationId),
    (supabase as any).from('obligation_versions').select('id', { count: 'exact', head: true }).eq('obligation_id', obligationId),
  ])
  const linkedExtensions = extResult?.count ?? 0
  const linkedTemplates = tplResult?.count ?? 0
  return { linkedExtensions, linkedTemplates, hasDependencies: linkedExtensions > 0 || linkedTemplates > 0 }
}

// ---------------------------------------------------------------------------
// Studio DB Compatibility Adapter (replaces mockStudioDb)
// ---------------------------------------------------------------------------

export const studioDb = {
  // Read methods: compatibility stubs return no records; active pages fetch directly from Supabase.
  getFamilies: (): any[] => [],
  getObligations: (): any[] => [],
  getVersions: (): any[] => [],
  getWorkflowTemplate: (_versionId: string): any => null,
  getWorkflowSteps: (_templateId: string): any[] => [],
  getRuleSets: (_versionId: string): any[] => [],
  getConditions: (_ruleSetId: string): any[] => [],
  getCirculars: (): any[] => [],
  // Compatibility methods deliberately fail closed; no in-memory records are created.
  createDraft: (_params: any): { version: { id: string } } => { throw new Error('Supabase connection is required to create a draft.') },
  cloneObligation: (_sourceId: string, _newTitle: string, _newCode: string): never => { throw new Error('Supabase connection is required to clone an obligation.') },
  createFamily: (_data: any): never => { throw new Error('Supabase connection is required to create an obligation family.') },
  updateFamily: (_id: string, _data: any): never => { throw new Error('Supabase connection is required to update an obligation family.') },
  deleteFamily: (_id: string): { success: boolean; error?: string } => { throw new Error('Supabase connection is required to delete an obligation family.') },
  deleteObligation: (_id: string): never => { throw new Error('Supabase connection is required to delete an obligation.') },
  updateVersionPenalty: (_versionId: string, _penaltyRule: any): never => { throw new Error('Supabase connection is required to update a penalty rule.') },
  publishVersion: (_versionId: string): never => { throw new Error('Supabase connection is required to publish a version.') },
  transitionVersionStatus: (_versionId: string, _status: string): never => { throw new Error('Supabase connection is required to change version status.') },
  addRuleSet: (_data: any): never => { throw new Error('Supabase connection is required to create a rule set.') },
  updateRuleSet: (_id: string, _data: any): never => { throw new Error('Supabase connection is required to update a rule set.') },
  deleteRuleSet: (_id: string): never => { throw new Error('Supabase connection is required to delete a rule set.') },
  addWorkflowStep: (_data: any): never => { throw new Error('Supabase connection is required to create a workflow step.') },
  updateWorkflowStep: (_id: string, _data: any): never => { throw new Error('Supabase connection is required to update a workflow step.') },
  deleteWorkflowStep: (_id: string): never => { throw new Error('Supabase connection is required to delete a workflow step.') },
  addCircular: (_data: any): never => { throw new Error('Supabase connection is required to create a circular.') },
}

// ---------------------------------------------------------------------------
// Tenant Mock Compatibility (replaces mockTenantsDb)
// ---------------------------------------------------------------------------

export const tenantsDb = {
  getForUser: async (_userId: string): Promise<any[]> => {
    return fetchUserTenants(_userId)
  },
  insertTenant: async (params: any, createdBy: string): Promise<any> => {
    return createTenant({ ...params, created_by: createdBy })
  },
}

// ---------------------------------------------------------------------------
// Company Workspace Menu
// Admin defines a multi-level menu (GROUP folders + FORM leaves) in
// company_menu_drafts, then publishes a validated snapshot into
// company_menu that the company workspace reads dynamically.
// ---------------------------------------------------------------------------

export type MenuItemType = 'GROUP' | 'FORM'

export interface CompanyMenuDraft {
  id: string
  code: string
  title_fa: string
  item_type: MenuItemType
  parent_id: string | null
  form_obligation_id: string | null
  icon: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CompanyMenuDraftWrite {
  title_fa: string
  item_type: MenuItemType
  parent_id?: string | null
  form_obligation_id?: string | null
  icon?: string | null
  is_active?: boolean
}

export interface MenuPublishItem {
  code: string
  title_fa: string
  item_type: MenuItemType
  parent_code: string | null
  form_obligation_id: string | null
  icon: string | null
  sort_order: number
  is_active: boolean
}

export interface PublishedCompanyMenuItem {
  id: string
  code: string
  title_fa: string
  item_type: MenuItemType
  parent_code: string | null
  form_obligation_id: string | null
  icon: string | null
  sort_order: number
  is_active: boolean
  published_at: string
}

// Curated, limited list of menu icons (kept in sync with the picker UI).
export const COMPANY_MENU_ICONS = [
  { value: 'folder', label: 'پوشه' },
  { value: 'scale', label: 'ترازو' },
  { value: 'receipt', label: 'رسید' },
  { value: 'file', label: 'سند' },
  { value: 'shield', label: 'سپر' },
  { value: 'building', label: 'سازمان' },
  { value: 'briefcase', label: 'کیف کار' },
  { value: 'banknote', label: 'اسکناس' },
  { value: 'calendar', label: 'تقویم' },
  { value: 'layers', label: 'لایه‌ها' },
]

function generateMenuCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789'
  let suffix = ''
  for (let i = 0; i < 8; i++) suffix += chars[Math.floor(Math.random() * chars.length)]
  return `MENU_${suffix}`
}

export async function fetchMenuDrafts(): Promise<CompanyMenuDraft[]> {
  return safeQuery<CompanyMenuDraft>(() =>
    (supabase as any).from('company_menu_drafts').select('*').order('sort_order', { ascending: true })
  )
}

export async function createMenuDraft(payload: CompanyMenuDraftWrite): Promise<CompanyMenuDraft | null> {
  if (!isSupabaseConfigured) return null
  // Initial placement: a new item is appended as the last sibling of its parent.
  const siblings = await safeQuery<CompanyMenuDraft>(() =>
    (supabase as any)
      .from('company_menu_drafts')
      .select('sort_order')
      .eq('parent_id', payload.parent_id ?? null)
  )
  const sortOrder = siblings.reduce((m, s) => Math.max(m, s.sort_order ?? 0), 0) + 1
  const { data, error } = await (supabase as any)
    .from('company_menu_drafts')
    .insert({
      code: generateMenuCode(),
      title_fa: payload.title_fa,
      item_type: payload.item_type,
      parent_id: payload.parent_id ?? null,
      form_obligation_id: payload.form_obligation_id ?? null,
      icon: payload.icon ?? null,
      sort_order: sortOrder,
      is_active: payload.is_active ?? true,
    })
    .select()
    .single()
  if (error) { console.warn('[supabaseDb] createMenuDraft:', error.message); return null }
  return data
}

export async function updateMenuDraft(id: string, payload: Partial<CompanyMenuDraftWrite>): Promise<CompanyMenuDraft | null> {
  if (!isSupabaseConfigured) return null
  const { data, error } = await (supabase as any)
    .from('company_menu_drafts')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) { console.warn('[supabaseDb] updateMenuDraft:', error.message); return null }
  return data
}

export async function deleteMenuDraft(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false
  const { error } = await (supabase as any).from('company_menu_drafts').delete().eq('id', id)
  return !error
}

export async function reorderMenuDrafts(items: { id: string; parent_id: string | null; sort_order: number }[]): Promise<boolean> {
  if (!isSupabaseConfigured) return false
  for (const it of items) {
    const { error } = await (supabase as any)
      .from('company_menu_drafts')
      .update({ parent_id: it.parent_id, sort_order: it.sort_order, updated_at: new Date().toISOString() })
      .eq('id', it.id)
    if (error) {
      console.warn('[supabaseDb] reorderMenuDrafts:', error.message)
      return false
    }
  }
  return true
}

export interface SelectableObligation {
  id: string
  code: string
  title: string
  summary: string | null
  domain: string
  domain_title: string
  is_active: boolean
  version_number: number
  version_status: string
  published_at: string | null
  version_id: string
}

// Forms the menu can link to: active obligations with a PUBLISHED version.
export async function fetchSelectableObligations(): Promise<SelectableObligation[]> {
  return safeQuery<SelectableObligation>(async () => {
    const result = await (supabase as any)
      .from('obligations')
      .select('*, family:obligation_families(domain, title), versions:obligation_versions(status, version_number, published_at)')
      .eq('is_active', true)
      .eq('versions.status', 'PUBLISHED')
      .order('title')
    if (result?.error) return []
    return (result?.data ?? []).map((row: any) => ({
      id: row.id,
      code: row.code,
      title: row.title,
      summary: row.summary ?? null,
      domain: row.family?.domain ?? '',
      domain_title: row.family?.title ?? '—',
      is_active: row.is_active ?? true,
      version_number: row.versions?.[0]?.version_number ?? 1,
      version_status: row.versions?.[0]?.status ?? 'NONE',
      published_at: row.versions?.[0]?.published_at ?? null,
      version_id: row.versions?.[0]?.id ?? null,
    }))
  })
}

export interface ObligationFormPreview {
  id: string
  code: string
  title: string
  summary: string | null
  domain: string
  domain_title: string
  is_active: boolean
  version_number: number
  version_status: string
  version_id: string | null
  published_at: string | null
  effective_from: string | null
  effective_to: string | null
  legal_reference: string | null
  official_action_url: string | null
}

export async function fetchObligationFormPreview(obligationId: string): Promise<ObligationFormPreview | null> {
  if (!isSupabaseConfigured) return null
  const { data, error } = await (supabase as any)
    .from('obligations')
    .select('*, family:obligation_families(domain, title), versions:obligation_versions(id, status, version_number, published_at, effective_from, effective_to, legal_reference)')
    .eq('id', obligationId)
    .eq('versions.status', 'PUBLISHED')
    .order('version_number', { foreignTable: 'versions', ascending: false })
    .maybeSingle()
  if (error || !data) return null
  const version = data.versions?.[0]
  return {
    id: data.id,
    code: data.code,
    title: data.title,
    summary: data.summary ?? null,
    domain: data.family?.domain ?? '',
    domain_title: data.family?.title ?? '—',
    is_active: data.is_active ?? true,
    version_number: version?.version_number ?? 1,
    version_status: version?.status ?? 'NONE',
    version_id: version?.id ?? null,
    published_at: version?.published_at ?? null,
    effective_from: version?.effective_from ?? null,
    effective_to: version?.effective_to ?? null,
    legal_reference: version?.legal_reference ?? null,
    official_action_url: data.official_action_url ?? null,
  }
}

// ---------------------------------------------------------------------------
// Obligation workflow steps + scope (eligibility) for the company form page
// ---------------------------------------------------------------------------

export interface ObligationWorkflowField {
  key: string
  label: string
  type: string
  required: boolean
}

export interface ObligationWorkflowStep {
  id: string
  code: string
  title: string
  sequence: number
  is_optional: boolean
  actor: string
  instructions: string | null
  fields: ObligationWorkflowField[]
  field_count: number
  required_field_count: number
}

export type ObligationEligibilityState =
  | { outcome: 'ELIGIBLE'; explanation: string }
  | { outcome: 'NOT_ELIGIBLE'; explanation: string }
  | { outcome: 'REVIEW'; explanation: string }
  | { outcome: 'PROFILE_REQUIRED'; explanation: string }
  | { outcome: 'UNAVAILABLE'; explanation: string }

export async function fetchObligationWorkflowSteps(versionId: string): Promise<ObligationWorkflowStep[]> {
  if (!isSupabaseConfigured || !versionId) return []
  const { data: templates, error } = await (supabase as any)
    .from('workflow_templates')
    .select('id')
    .eq('obligation_version_id', versionId)
    .limit(1)
  if (error || !templates || templates.length === 0) return []
  const templateId = templates[0].id
  const { data: steps, error: stepsError } = await (supabase as any)
    .from('workflow_steps')
    .select('id, code, title, sequence, is_optional, actor, instructions, form_schema')
    .eq('workflow_template_id', templateId)
    .order('sequence', { ascending: true })
  if (stepsError) return []
  return (steps ?? []).map((step: any): ObligationWorkflowStep => {
    const rawFields = Array.isArray(step.form_schema?.fields) ? step.form_schema.fields : []
    const fields = rawFields
      .filter((item: any) => item && typeof item.key === 'string' && typeof item.label === 'string')
      .map((item: any): ObligationWorkflowField => ({
        key: item.key,
        label: item.label,
        type: String(item.type ?? 'text'),
        required: item.required === true,
      }))
    return {
      id: step.id,
      code: step.code ?? '',
      title: step.title,
      sequence: step.sequence,
      is_optional: step.is_optional === true,
      actor: step.actor ?? '',
      instructions: step.instructions ?? null,
      fields,
      field_count: fields.length,
      required_field_count: fields.filter((field: ObligationWorkflowField) => field.required).length,
    }
  })
}

export async function evaluateObligationEligibility(tenantId: string, versionId: string): Promise<ObligationEligibilityState> {
  if (!isSupabaseConfigured || !tenantId || !versionId) {
    return { outcome: 'UNAVAILABLE', explanation: 'ارزیابی مشمولیت در دسترس نیست.' }
  }
  const { data, error } = await (supabase as any).rpc('evaluate_tenant_eligibility', { requested_tenant_id: tenantId })
  if (error) {
    const message = error.message ?? ''
    if (/profile required/i.test(message) || message.includes('P0002')) {
      return {
        outcome: 'PROFILE_REQUIRED',
        explanation: 'برای تشخیص شمولیت، ابتدا مشخصات کسب‌وکار شرکت را در بخش «کسب‌وکار و مشمولیت» ثبت و تکمیل کنید.',
      }
    }
    return { outcome: 'UNAVAILABLE', explanation: message }
  }
  const row = (data ?? []).find((item: any) => item.obligation_version_id === versionId)
  if (!row) {
    return { outcome: 'REVIEW', explanation: 'ارزیابی شمولیت برای این نسخه انجام نشده است؛ لطفاً دوباره بررسی کنید.' }
  }
  const outcome = row.outcome
  const explanation = row.explanation ?? ''
  if (outcome === 'ELIGIBLE') return { outcome: 'ELIGIBLE', explanation }
  if (outcome === 'NOT_ELIGIBLE') return { outcome: 'NOT_ELIGIBLE', explanation }
  return { outcome: 'REVIEW', explanation }
}

// Publish the validated tree snapshot into the published menu table.
export async function publishCompanyMenu(items: MenuPublishItem[]): Promise<{ ok: boolean; message?: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: 'اتصال به پایگاه‌داده برقرار نیست.' }
  const { data, error } = await (supabase as any).rpc('replace_company_menu', { p_items: items })
  if (error) return { ok: false, message: error.message }
  return { ok: true, message: String(data ?? '') }
}

export async function fetchPublishedMenu(): Promise<PublishedCompanyMenuItem[]> {
  return safeQuery<PublishedCompanyMenuItem>(() =>
    (supabase as any).from('company_menu').select('*').order('sort_order', { ascending: true })
  )
}

export async function fetchMenuPublishStatus(): Promise<{ published_at: string | null; item_count: number }> {
  const rows = await safeQuery<PublishedCompanyMenuItem>(() =>
    (supabase as any).from('company_menu').select('published_at')
  )
  if (rows.length === 0) return { published_at: null, item_count: 0 }
  const latest = rows.reduce((a, b) => (a.published_at > b.published_at ? a : b))
  return { published_at: latest.published_at, item_count: rows.length }
}
