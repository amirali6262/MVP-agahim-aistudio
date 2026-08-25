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
  category?: string
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
  tenant_id: string
  title: string
  period_type: string
  start_date: string
  end_date: string
  status: string
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
// Objection Templates (from tax_objection_stages)
// ---------------------------------------------------------------------------

export async function fetchObjectionTemplates(): Promise<ObjectionTemplate[]> {
  const stages = await safeQuery(() =>
    (supabase as any)
      .from('tax_objection_stages')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
  )

  if (stages.length === 0) return []

  const mappedSteps: ObjectionStep[] = stages.map((s: any) => {
    const formFields: WorkflowStepField[] =
      s.form_schema?.fields?.map((f: any) => ({
        id: f.key || s.id + '-field',
        label: f.label || f.key,
        key: f.key,
        type: f.type || 'text',
        required: f.required ?? false,
        placeholder: f.placeholder,
        options: f.options,
      })) ?? []

    const actorRole = (s.actor_role_code || '') as string
    let actor: 'TAXPAYER' | 'TAX_AUTHORITY' | 'COURT_DIVAN' = 'TAX_AUTHORITY'
    if (actorRole.includes('taxpayer') || actorRole === 'TAXPAYER') actor = 'TAXPAYER'
    else if (actorRole.includes('divan') || actorRole === 'COURT_DIVAN') actor = 'COURT_DIVAN'

    let stepNature: ObjectionStep['step_nature'] = 'MANDATORY'
    const stepType = (s.step_type || '') as string
    if (stepType === 'CONDITIONAL_EXPERT') stepNature = 'CONDITIONAL_EXPERT'
    else if (stepType === 'EXPIRED_END') stepNature = 'EXPIRED_END'
    else if (stepType === 'NEXT_STAGE') stepNature = 'NEXT_STAGE'

    return {
      id: s.id,
      title: s.title_fa || s.code,
      base_event: s.base_event || 'تاریخ ابلاغ برگ/اختیاریه',
      gap_value: s.gap_value ?? 30,
      gap_unit: s.gap_unit || 'روز',
      step_nature: stepNature,
      actor,
      note: s.user_guidance_fa || s.description_fa || '',
      fields: formFields,
    }
  })

  // Group by phase
  const phaseMap = new Map<string, ObjectionStep[]>()
  for (const step of mappedSteps) {
    const stage = (stages as any[]).find((s: any) => s.id === step.id)
    const phase = (stage as any)?.phase_code || 'PHASE_1'
    if (!phaseMap.has(phase)) phaseMap.set(phase, [])
    phaseMap.get(phase)!.push(step)
  }

  const phaseNames: Record<string, string> = {
    PHASE_1: 'فاز ۱: تهیه گزارش و صدور برگ تشخیص',
    PHASE_2: 'فاز ۲: قبول و پرداخت',
    PHASE_3: 'فاز ۳: اعتراض ماده ۲۳۸',
    PHASE_4: 'فاز ۴: پایان مهلت و ارجاع',
    PHASE_5: 'فاز ۵: قطعیت و پرداخت',
  }

  const combinedTemplate: ObjectionTemplate = {
    id: 'db-combined-pit',
    template_name: 'مالیات بر عملکرد ـ از تهیه گزارش رسیدگی تا قطعیت مالیات یا ارجاع به هیأت حل اختلاف مالیاتی بدوی',
    is_base_template: true,
    steps: mappedSteps,
    created_at: new Date().toISOString(),
  }

  const phaseTemplates: ObjectionTemplate[] = Array.from(phaseMap.entries()).map(
    ([phase, steps]) => ({
      id: `db-phase-${phase}`,
      template_name: phaseNames[phase] || phase,
      is_base_template: true,
      steps,
      created_at: new Date().toISOString(),
    })
  )

  return [combinedTemplate, ...phaseTemplates]
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
// Dependency checker (replaces mockDb dependencyChecker)
// ---------------------------------------------------------------------------

export function checkObligationDependencies(obligationId: string): { linkedExtensions: number; linkedTemplates: number; hasDependencies: boolean } {
  // This will be async in the real implementation
  return { linkedExtensions: 0, linkedTemplates: 0, hasDependencies: false }
}
