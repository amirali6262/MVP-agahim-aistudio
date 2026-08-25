import { createClient } from '@supabase/supabase-js'
import type { Database, Tables } from './database.types'

// ---------------------------------------------------------------------------
// Configuration
// Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to your .env file
// ---------------------------------------------------------------------------
const supabaseUrl = (import.meta.env['VITE_SUPABASE_URL'] as string | undefined) ?? ''
// Support both the current publishable-key name and Supabase's legacy anon-key name.
const supabasePublishableKey =
  (import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] as string | undefined) ||
  (import.meta.env['VITE_SUPABASE_ANON_KEY'] as string | undefined) || ''

export const isSupabaseConfigured = Boolean(
  supabaseUrl.trim() &&
  supabasePublishableKey.trim() &&
  !supabaseUrl.includes('placeholder') &&
  !supabasePublishableKey.includes('placeholder')
)

export const isMockAuthEnabled =
  import.meta.env['VITE_ENABLE_MOCK_AUTH'] === 'true'

export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabasePublishableKey || 'placeholder-publishable-key'
)

// ---------------------------------------------------------------------------
// Domain types (mirror your Supabase public schema)
// ---------------------------------------------------------------------------

export type UserRole = 'PLATFORM_ADMIN' | 'BUSINESS_USER' | 'REGISTRAR' | 'REVIEWER' | 'APPROVER' | 'MANAGER'

export type AppUser = Pick<Tables<'users'>, 'id' | 'email' | 'phone' | 'created_at'> & {
  role: UserRole
}

export type Tenant = Pick<
  Tables<'tenants'>,
  'id' | 'name' | 'national_id' | 'economic_code' | 'province' | 'created_at'
> & {
  entity_type: 'حقوقی' | 'حقیقی'
}

export type UserTenantRow = Pick<
  Tables<'user_tenants'>,
  'id' | 'user_id' | 'tenant_id' | 'created_at'
> & {
  role: 'OWNER' | 'ADMIN' | 'MEMBER'
}

export interface UserTenantWithTenant extends UserTenantRow {
  tenants: Tenant | null
}

export interface WorkflowStepField {
  id: string
  label: string
  key: string
  type: 'text' | 'number' | 'date' | 'file' | 'select' | 'checkbox'
  required?: boolean
  options?: string[]
  placeholder?: string
}

export interface WorkflowStep {
  id: string
  title: string
  order: number
  fields?: WorkflowStepField[]
  is_skippable?: boolean
  skip_reasons?: string[]
}

export type ObligationType =
  | 'TAX_CORPORATE'
  | 'TAX_INDIVIDUAL'
  | 'VAT'
  | 'PAYROLL_TAX'
  | 'TAX_DUTIES'
  | 'CLAIM_169'
  | 'INS_CONTRACT'
  | 'INS_AUDIT'

export interface PenaltyItem {
  id: string
  penalty_type: string
  rate_or_amount: number
  calc_unit: string
  calc_base: string
  cap_limit?: number | null
  legal_clause?: string
}

export type ObjectionStepNature =
  | 'MANDATORY'               // مرحله اصلی و الزامی
  | 'CONDITIONAL_EXPERT'      // مشروط: صدور و اجرای قرار کارشناسی
  | 'AGREEMENT_END'           // نقطه پایان: توافق (ماده ۲۳۸ یا هیأت)
  | 'SETTLEMENT_END'          // نقطه پایان: تمکین و پرداخت
  | 'EXPIRED_END'             // نقطه پایان: انقضای مهلت قانونی (صدور برگ قطعی)
  | 'FINAL_NOTICE_ISSUANCE'   // صدور برگه قطعی مالیاتی
  | 'NEXT_STAGE'              // ارجاع به مرحله بعد (هیأت/شورا/دیوان)

export type StepActor =
  | 'TAXPAYER'       // مودی مالیاتی
  | 'TAX_AUTHORITY'  // سازمان امور مالیاتی / هیأت‌های حل اختلاف
  | 'COURT_DIVAN'     // دیوان عدالت اداری

export type TransitionTriggerType = 'USER_ACTION' | 'TIMEOUT_AUTO'

export type TransitionTargetType =
  | 'STEP'
  | 'LOOP_PREVIOUS'
  | 'TERMINAL_AGREED'
  | 'TERMINAL_SETTLED'
  | 'TERMINAL_EXPIRED'
  | 'TERMINAL_FINAL'

export interface StepTransition {
  id: string
  title: string
  trigger_type: TransitionTriggerType
  timeout_days?: number
  timeout_desc?: string
  target_type: TransitionTargetType
  target_step_id?: string
  action_label?: string
  legal_reference?: string
  description?: string
}

export interface ObjectionStep {
  id: string
  title: string
  base_event: string
  gap_value: number
  gap_unit: string
  step_nature?: ObjectionStepNature
  actor?: StepActor
  note?: string
  legal_basis?: string
  fields?: WorkflowStepField[]
  is_skippable?: boolean
  skip_reasons?: string[]
  transitions?: StepTransition[]
}

export interface TaxTypeOverride {
  tax_type: 'TAX_CORPORATE' | 'VAT' | 'SALARY_TAX' | 'SEASONAL_REPORT' | 'INVOICE_SYSTEM'
  tax_type_title: string
  statutory_deadline_override?: number
  deadline_unit?: string
  legal_reference_override?: string
  special_tribunal_name?: string
  notes?: string
  is_custom_path_active?: boolean
}

export interface ObjectionTemplate {
  id: string
  template_name: string
  description?: string
  is_base_template?: boolean
  steps: ObjectionStep[]
  tax_type_overrides?: TaxTypeOverride[]
  created_at?: string
}

export interface DeadlineExtension {
  id: string
  obligation_id?: string
  obligation_title: string
  fiscal_year: string
  extension_type: 'تاریخ ثابت' | 'روزهای اضافه'
  value: string
  circular_description: string
  created_at?: string
}

export interface Obligation {
  id: string
  title: string
  obligation_type: string
  obligation_types?: string[]
  is_shared?: boolean
  shared_action_key?: string
  recurrence: string
  base_event: string
  time_gap_value: number | null
  time_gap_unit: string | null
  responsible_party: string
  is_active: boolean
  phase_group?: string | null
  sequence_order?: number | null
  penalties?: PenaltyItem[]
  objection_template_id?: string | null
  workflow_steps: WorkflowStep[]
  created_at: string
  updated_at: string
}

export interface TenantObligationFulfillment {
  id: string
  tenant_id: string
  obligation_id?: string
  shared_action_key?: string
  fiscal_year: string
  tracking_number: string
  fulfillment_date: string
  fulfilled_at: string
  notes?: string
}

export interface CommercialBookPeriod {
  id: string
  fiscal_year: string
  period_type: 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL' | 'ANNUAL_SEALING'
  title: string
  statutory_deadline: string // Jalali date, e.g., '1404/04/31'
  extended_deadline?: string | null // Jalali date e.g., '1405/05/31'
  circular_number?: string | null // شماره بخشنامه سازمان
  circular_date?: string | null // تاریخ بخشنامه سازمان
  attachment_url?: string | null // آدرس/دیتا ی تصویر یا PDF بخشنامه
  attachment_name?: string | null // نام فایل بخشنامه
  notes?: string | null
  is_active: boolean
  created_at: string
}

export type ChecklistImportance = 'HIGH' | 'CONDITIONAL' | 'SUPPLEMENTARY'

export interface ChecklistItem {
  id: string
  code: string
  title: string
  importance: ChecklistImportance
}

export interface ChecklistSection {
  id: string
  title: string
  items: ChecklistItem[]
}

export interface ChecklistTemplate {
  id: string
  title: string
  description?: string
  category: string
  fiscal_year?: string
  sections: ChecklistSection[]
  is_active: boolean
  created_at: string
}

export interface TenantChecklistProgress {
  id: string
  tenant_id: string
  template_id: string
  fiscal_year: string
  completed_items: Record<string, { completed: boolean; completed_at?: string; notes?: string }>
  updated_at: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true if the string looks like an email address */
export function isEmailIdentifier(value: string): boolean {
  return value.includes('@')
}

/** Normalises an Iranian mobile number to E.164 (+98XXXXXXXXX) */
export function normalizeIranPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('0') && digits.length === 11) return '+98' + digits.slice(1)
  if (digits.startsWith('98') && digits.length === 12) return '+' + digits
  if (digits.startsWith('9') && digits.length === 10) return '+98' + digits
  return '+' + digits
}
