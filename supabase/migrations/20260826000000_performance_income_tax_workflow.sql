-- =============================================================================
-- Migration: Performance Income Tax Assessment Workflow
-- Version: 20260826000000
-- Description: Creates the complete schema for tax assessment, dispute, and
--              finalization workflow for "مالیات بر عملکرد"
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. ENUM TYPES
-- -----------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE tax_actor_type AS ENUM (
    'taxpayer',
    'taxpayer_authorized_representative',
    'tax_audit_unit',
    'tax_assessment_issuer',
    'tax_notification_unit',
    'tax_objection_unit',
    'article_238_responsible_officer',
    'tax_reexamination_expert',
    'tax_finalization_collection_unit',
    'first_instance_tax_dispute_board',
    'system_automation'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tax_document_type AS ENUM (
    'tax_audit_report',
    'performance_tax_assessment_notice',
    'assessment_service_record',
    'audit_report_detail_request',
    'audit_report_detail_response',
    'article_238_objection',
    'objection_evidence',
    'article_238_internal_referral',
    'reexamination_order',
    'reexamination_execution_report',
    'article_238_review_result',
    'taxpayer_acceptance',
    'taxpayer_partial_acceptance',
    'taxpayer_rejection_of_review_result',
    'first_instance_board_referral',
    'performance_tax_final_notice',
    'tax_payment_receipt',
    'payment_arrangement',
    'deadline_expiry_record',
    'notification_record'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tax_service_type AS ENUM (
    'actual',
    'legal',
    'pending_validation',
    'invalid'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tax_step_type AS ENUM (
    'mandatory',
    'conditional',
    'terminal',
    'transition',
    'optional'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tax_case_status AS ENUM (
    'audit_in_progress',
    'audit_report_completed',
    'assessment_issued',
    'assessment_service_pending',
    'assessment_served_actual',
    'assessment_served_legal',
    'assessment_service_invalid',
    'objection_window_open',
    'objection_registered',
    'article_238_review_in_progress',
    'reexamination_order_issued',
    'reexamination_report_completed',
    'article_238_result_issued',
    'awaiting_taxpayer_response',
    'settled_in_full',
    'settled_in_part',
    'no_settlement',
    'deemed_objector_due_to_legal_service',
    'final_due_to_acceptance',
    'final_due_to_payment',
    'final_due_to_no_timely_objection',
    'partially_final_partially_referred',
    'referred_to_first_instance_board',
    'final_notice_issued',
    'final_notice_served',
    'payment_due',
    'paid',
    'payment_arranged',
    'no_payment_required',
    'overpayment_detected',
    'payment_overdue_requires_collection_process'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tax_deadline_status AS ENUM (
    'pending',
    'active',
    'completed',
    'overdue',
    'extended',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tax_referral_reason AS ENUM (
    'article_238_no_adjustment_no_settlement',
    'article_238_adjustment_not_accepted',
    'article_238_partial_settlement',
    'article_238_no_taxpayer_response',
    'article_239_deemed_objection_after_legal_service'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tax_finalization_reason AS ENUM (
    'written_acceptance',
    'payment_at_assessment_basis',
    'approved_payment_arrangement',
    'full_article_238_settlement',
    'partial_article_238_settlement',
    'no_timely_objection_after_actual_service',
    'full_acceptance_of_taxpayer_objection',
    'assessment_upheld_and_accepted'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tax_result_type AS ENUM (
    'assessment_fully_rejected',
    'objection_fully_accepted',
    'assessment_adjusted',
    'assessment_upheld',
    'mixed_result',
    'procedural_incomplete'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tax_taxpayer_decision AS ENUM (
    'accepted_in_full',
    'accepted_in_part',
    'rejected_in_full',
    'no_response',
    'not_required_no_remaining_dispute'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tax_audit_action AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE',
    'STATUS_CHANGE',
    'FINANCIAL_CHANGE',
    'DEADLINE_SET',
    'DEADLINE_EXPIRED',
    'NOTIFICATION_SENT',
    'DOCUMENT_UPLOADED',
    'WORKFLOW_TRANSITION'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tax_legal_source_type AS ENUM (
    'law',
    'regulation',
    'directive',
    'circular',
    'judicial_precedent',
    'executive_instruction'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- 2. NEW TABLES
-- -----------------------------------------------------------------------------

-- 2.1 Tax Actors (اقدام‌کنندگان و نقش‌ها)
CREATE TABLE IF NOT EXISTS tax_actors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  title_fa text NOT NULL,
  actor_type tax_actor_type NOT NULL,
  organization text,
  description_fa text,
  min_count integer DEFAULT 1,
  max_count integer DEFAULT 1,
  requires_authorization boolean DEFAULT false,
  authorization_description_fa text,
  is_active boolean DEFAULT true,
  version integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2.2 Tax Document Types (انواع اسناد)
CREATE TABLE IF NOT EXISTS tax_document_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  title_fa text NOT NULL,
  document_type tax_document_type NOT NULL,
  category text,
  description_fa text,
  is_mandatory boolean DEFAULT false,
  is_versioned boolean DEFAULT false,
  retention_days integer,
  metadata_schema jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2.3 Tax Legal References (منابع قانونی)
CREATE TABLE IF NOT EXISTS tax_legal_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  title_fa text NOT NULL,
  source_type tax_legal_source_type NOT NULL,
  source_number text,
  approval_date date,
  effective_date date,
  article_or_section text,
  relevant_text_fa text,
  source_url text,
  is_active boolean DEFAULT true,
  superseded_by uuid REFERENCES tax_legal_references(id),
  superseding uuid REFERENCES tax_legal_references(id),
  last_verified_date date,
  notes_fa text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2.4 Tax Cases (پرونده‌های مالیاتی) - extends compliance_cases
CREATE TABLE IF NOT EXISTS tax_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compliance_case_id uuid REFERENCES compliance_cases(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  
  -- مشخصات پرونده
  case_number text,
  taxpayer_id uuid,
  taxpayer_type text,
  national_id text,
  taxpayer_name text,
  tax_office_general text,
  tax_office text,
  work_area text,
  fiscal_year integer NOT NULL,
  period_start date,
  period_end date,
  
  -- نوع اظهارنامه
  declaration_type text DEFAULT 'regular',
  declaration_number text,
  declaration_submitted_at date,
  
  -- وضعیت
  status tax_case_status NOT NULL DEFAULT 'audit_in_progress',
  current_step_code text,
  process_version text DEFAULT '1.0.0',
  
  -- اطلاعات مالی
  declared_taxable_income numeric(18,2) DEFAULT 0,
  declared_tax numeric(18,2) DEFAULT 0,
  assessed_taxable_income numeric(18,2) DEFAULT 0,
  assessed_tax numeric(18,2) DEFAULT 0,
  penalties_on_notice numeric(18,2) DEFAULT 0,
  exemptions numeric(18,2) DEFAULT 0,
  zero_rate numeric(18,2) DEFAULT 0,
  credits numeric(18,2) DEFAULT 0,
  previous_payments numeric(18,2) DEFAULT 0,
  advance_payments numeric(18,2) DEFAULT 0,
  withheld_tax numeric(18,2) DEFAULT 0,
  taxpayer_accepted_amount numeric(18,2) DEFAULT 0,
  taxpayer_contested_amount numeric(18,2) DEFAULT 0,
  adjusted_taxable_income numeric(18,2) DEFAULT 0,
  adjusted_tax numeric(18,2) DEFAULT 0,
  disputed_amount_resolved numeric(18,2) DEFAULT 0,
  remaining_disputed_amount numeric(18,2) DEFAULT 0,
  final_tax_amount numeric(18,2) DEFAULT 0,
  balance_due numeric(18,2) DEFAULT 0,
  overpayment_amount numeric(18,2) DEFAULT 0,
  overpayment_status text,
  currency text DEFAULT 'IRR',
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tax_cases_tenant ON tax_cases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tax_cases_status ON tax_cases(status);
CREATE INDEX IF NOT EXISTS idx_tax_cases_fiscal_year ON tax_cases(fiscal_year);

-- 2.5 Tax Financial Records (سوابق مالی با تاریخچه)
CREATE TABLE IF NOT EXISTS tax_financial_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_case_id uuid NOT NULL REFERENCES tax_cases(id),
  field_name text NOT NULL,
  previous_value numeric(18,2),
  new_value numeric(18,2) NOT NULL,
  change_reason text,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tax_financial_records_case ON tax_financial_records(tax_case_id);
CREATE INDEX IF NOT EXISTS idx_tax_financial_records_field ON tax_financial_records(field_name);

-- 2.6 Tax Service Records (سابقه ابلاغ)
CREATE TABLE IF NOT EXISTS tax_service_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_case_id uuid NOT NULL REFERENCES tax_cases(id),
  document_type tax_document_type NOT NULL,
  service_type tax_service_type NOT NULL,
  upload_date timestamptz,
  first_sms_date timestamptz,
  viewed_date timestamptz,
  effective_service_date timestamptz,
  service_method text,
  service_method_type text,
  recipient_name text,
  recipient_role text,
  destination_address text,
  service_document_url text,
  is_valid boolean DEFAULT true,
  validation_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tax_service_records_case ON tax_service_records(tax_case_id);

-- 2.7 Tax Objection Items (آیتم‌های اعتراض)
CREATE TABLE IF NOT EXISTS tax_objection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_case_id uuid NOT NULL REFERENCES tax_cases(id),
  item_code text NOT NULL,
  title_fa text NOT NULL,
  initial_amount numeric(18,2) DEFAULT 0,
  taxpayer_accepted_amount numeric(18,2) DEFAULT 0,
  taxpayer_contested_amount numeric(18,2) DEFAULT 0,
  objection_reason text,
  related_documents text[],
  examination_status text DEFAULT 'pending',
  organization_accepted_amount numeric(18,2) DEFAULT 0,
  remaining_disputed_amount numeric(18,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tax_objection_items_case ON tax_objection_items(tax_case_id);

-- 2.8 Tax Audit Log (لاگ حسابرسی)
CREATE TABLE IF NOT EXISTS tax_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_case_id uuid REFERENCES tax_cases(id),
  action tax_audit_action NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  old_values jsonb,
  new_values jsonb,
  performed_by uuid,
  performed_at timestamptz NOT NULL DEFAULT now(),
  ip_address inet,
  user_agent text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tax_audit_log_case ON tax_audit_log(tax_case_id);
CREATE INDEX IF NOT EXISTS idx_tax_audit_log_action ON tax_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_tax_audit_log_performed_at ON tax_audit_log(performed_at);

-- 2.9 Iran Holidays (تعطیلات رسمی ایران)
CREATE TABLE IF NOT EXISTS iran_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date date NOT NULL,
  title_fa text NOT NULL,
  is_recurring boolean DEFAULT false,
  category text DEFAULT 'official',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_iran_holidays_date ON iran_holidays(holiday_date);

-- 2.10 Tax Notifications (هشدارها و اعلان‌ها)
CREATE TABLE IF NOT EXISTS tax_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_case_id uuid NOT NULL REFERENCES tax_cases(id),
  notification_type text NOT NULL,
  priority text DEFAULT 'normal',
  title_fa text NOT NULL,
  body_fa text NOT NULL,
  actor_role_code text,
  deadline_reference text,
  due_at timestamptz,
  sent_at timestamptz,
  channel text DEFAULT 'in_app',
  is_read boolean DEFAULT false,
  is_actioned boolean DEFAULT false,
  actioned_at timestamptz,
  action_url text,
  recurring boolean DEFAULT false,
  escalation_level integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tax_notifications_case ON tax_notifications(tax_case_id);
CREATE INDEX IF NOT EXISTS idx_tax_notifications_type ON tax_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_tax_notifications_unread ON tax_notifications(is_read) WHERE NOT is_read;

-- 2.11 Tax Deadline History (تاریخچه مهلت‌ها)
CREATE TABLE IF NOT EXISTS tax_deadline_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_case_id uuid NOT NULL REFERENCES tax_cases(id),
  deadline_type text NOT NULL,
  step_code text,
  start_date timestamptz NOT NULL,
  original_end_date timestamptz NOT NULL,
  adjusted_end_date timestamptz NOT NULL,
  calendar_used text DEFAULT 'iran_solar',
  holidays_applied text[],
  status tax_deadline_status NOT NULL DEFAULT 'pending',
  time_remaining interval,
  extension_reason text,
  action_taken_at timestamptz,
  is_within_deadline boolean,
  reminder_dates timestamptz[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tax_deadline_history_case ON tax_deadline_history(tax_case_id);
CREATE INDEX IF NOT EXISTS idx_tax_deadline_history_status ON tax_deadline_history(status);

-- 2.12 Tax Transition History (تاریخچه انتقال مراحل)
CREATE TABLE IF NOT EXISTS tax_transition_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_case_id uuid NOT NULL REFERENCES tax_cases(id),
  transition_code text NOT NULL,
  from_step_code text NOT NULL,
  to_step_code text,
  trigger_type text NOT NULL,
  outcome_code text NOT NULL,
  response_data jsonb DEFAULT '{}'::jsonb,
  legal_basis_id uuid REFERENCES tax_legal_references(id),
  audit_message text,
  executed_by uuid,
  executed_at timestamptz NOT NULL DEFAULT now(),
  is_automatic boolean DEFAULT false,
  requires_human_confirmation boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tax_transition_history_case ON tax_transition_history(tax_case_id);

-- 2.13 Tax AI Decision Record (ثبت تصمیمات هوش مصنوعی)
CREATE TABLE IF NOT EXISTS tax_ai_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_case_id uuid NOT NULL REFERENCES tax_cases(id),
  current_step_code text,
  current_status text,
  last_valid_event text,
  current_actor text,
  next_action text,
  deadline_for_action timestamptz,
  time_remaining interval,
  risk_of_losing_objection_right boolean DEFAULT false,
  service_type text,
  can_file_238_objection boolean DEFAULT false,
  can_settle boolean DEFAULT false,
  needs_document boolean DEFAULT false,
  incomplete_documents text[],
  taxpayer_accepted_amount numeric(18,2),
  taxpayer_contested_amount numeric(18,2),
  predicted_outcome text,
  legal_basis_reference text,
  confidence_level text,
  outcome_reason text,
  legal_warning text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tax_ai_decisions_case ON tax_ai_decisions(tax_case_id);

-- -----------------------------------------------------------------------------
-- 3. EXTEND EXISTING TABLES
-- -----------------------------------------------------------------------------

-- 3.1 Extend workflow_steps with tax-specific fields
DO $$ BEGIN
  ALTER TABLE workflow_steps ADD COLUMN phase_code text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE workflow_steps ADD COLUMN actor_role_code text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE workflow_steps ADD COLUMN responsible_organization text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE workflow_steps ADD COLUMN action_type text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE workflow_steps ADD COLUMN is_system_generated boolean DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE workflow_steps ADD COLUMN is_user_action_required boolean DEFAULT true;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE workflow_steps ADD COLUMN preconditions jsonb DEFAULT '[]'::jsonb;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE workflow_steps ADD COLUMN input_document_types text[];
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE workflow_steps ADD COLUMN output_document_types text[];
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE workflow_steps ADD COLUMN validation_schema jsonb DEFAULT '{}'::jsonb;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE workflow_steps ADD COLUMN completion_conditions jsonb DEFAULT '[]'::jsonb;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE workflow_steps ADD COLUMN failure_conditions jsonb DEFAULT '[]'::jsonb;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE workflow_steps ADD COLUMN next_step_rules jsonb DEFAULT '[]'::jsonb;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE workflow_steps ADD COLUMN legal_basis_ids uuid[];
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE workflow_steps ADD COLUMN user_guidance_fa text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE workflow_steps ADD COLUMN admin_guidance_fa text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE workflow_steps ADD COLUMN ai_guidance_fa text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE workflow_steps ADD COLUMN active_from timestamptz;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE workflow_steps ADD COLUMN active_to timestamptz;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE workflow_steps ADD COLUMN step_version integer DEFAULT 1;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE workflow_steps ADD COLUMN step_status text DEFAULT 'active';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 3.2 Extend workflow_transitions with tax-specific fields
DO $$ BEGIN
  ALTER TABLE workflow_transitions ADD COLUMN condition_expression text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE workflow_transitions ADD COLUMN condition_json jsonb DEFAULT '{}'::jsonb;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE workflow_transitions ADD COLUMN audit_message_template text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE workflow_transitions ADD COLUMN is_active boolean DEFAULT true;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- The reference workflow stores deterministic rule keys in
-- condition_expression. Event codes remain supported for integrations.
ALTER TABLE workflow_transitions DROP CONSTRAINT workflow_transitions_event_check;
ALTER TABLE workflow_transitions ADD CONSTRAINT workflow_transitions_event_check CHECK (
  trigger_type <> 'SYSTEM_EVENT'
  OR nullif(btrim(event_code), '') IS NOT NULL
  OR nullif(btrim(condition_expression), '') IS NOT NULL
);

-- 3.3 Extend case_deadlines
DO $$ BEGIN
  ALTER TABLE case_deadlines ADD COLUMN tax_case_id uuid REFERENCES tax_cases(id);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE case_deadlines ADD COLUMN status tax_deadline_status DEFAULT 'pending';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 3.4 Extend case_events
DO $$ BEGIN
  ALTER TABLE case_events ADD COLUMN tax_case_id uuid REFERENCES tax_cases(id);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 3.5 Extend notifications
DO $$ BEGIN
  ALTER TABLE notifications ADD COLUMN tax_case_id uuid REFERENCES tax_cases(id);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE notifications ADD COLUMN actor_role_code text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Trusted migrations may own reference definitions without impersonating an
-- application user. Existing client RLS policies still require created_by to
-- equal auth.uid() for interactive inserts.
ALTER TABLE obligation_families ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE obligations ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE obligation_versions ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE workflow_templates ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE eligibility_rule_sets ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE obligation_versions DROP CONSTRAINT obligation_versions_publication_check;
ALTER TABLE obligation_versions ADD CONSTRAINT obligation_versions_publication_check CHECK (
  (status = 'PUBLISHED' AND published_at IS NOT NULL AND effective_from IS NOT NULL
    AND (published_by IS NOT NULL OR created_by IS NULL))
  OR (status <> 'PUBLISHED' AND published_by IS NULL AND published_at IS NULL)
);

-- -----------------------------------------------------------------------------
-- 4. HELPER FUNCTIONS
-- -----------------------------------------------------------------------------

-- 4.1 Function to calculate business days (Iran calendar)
CREATE OR REPLACE FUNCTION calculate_business_days(
  start_date date,
  days_to_add integer
) RETURNS date AS $$
DECLARE
  result_date date := start_date;
  days_added integer := 0;
BEGIN
  WHILE days_added < days_to_add LOOP
    result_date := result_date + 1;
    IF EXTRACT(DOW FROM result_date) NOT IN (5, 6) THEN
      IF NOT EXISTS (
        SELECT 1 FROM iran_holidays 
        WHERE holiday_date = result_date 
        AND is_recurring = true
      ) AND NOT EXISTS (
        SELECT 1 FROM iran_holidays 
        WHERE holiday_date = result_date 
        AND is_recurring = false
      ) THEN
        days_added := days_added + 1;
      END IF;
    END IF;
  END LOOP;
  RETURN result_date;
END;
$$ LANGUAGE plpgsql;

-- 4.2 Function to get effective service date
CREATE OR REPLACE FUNCTION get_effective_service_date(
  upload_date timestamptz,
  viewed_date timestamptz
) RETURNS timestamptz AS $$
BEGIN
  IF viewed_date IS NOT NULL AND 
     viewed_date <= upload_date + INTERVAL '10 days' THEN
    RETURN viewed_date;
  END IF;
  
  IF upload_date IS NOT NULL THEN
    RETURN upload_date + INTERVAL '11 days';
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 4.3 Function to record audit log
CREATE OR REPLACE FUNCTION record_tax_audit(
  p_tax_case_id uuid,
  p_action tax_audit_action,
  p_table_name text,
  p_record_id uuid,
  p_old_values jsonb,
  p_new_values jsonb,
  p_performed_by uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO tax_audit_log (
    tax_case_id, action, table_name, record_id,
    old_values, new_values, performed_by, metadata
  ) VALUES (
    p_tax_case_id, p_action, p_table_name, p_record_id,
    p_old_values, p_new_values, p_performed_by, p_metadata
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4.4 Function to create tax notification
CREATE OR REPLACE FUNCTION create_tax_notification(
  p_tax_case_id uuid,
  p_notification_type text,
  p_priority text,
  p_title_fa text,
  p_body_fa text,
  p_actor_role_code text DEFAULT NULL,
  p_due_at timestamptz DEFAULT NULL,
  p_action_url text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_notification_id uuid;
BEGIN
  INSERT INTO tax_notifications (
    tax_case_id, notification_type, priority,
    title_fa, body_fa, actor_role_code,
    due_at, action_url
  ) VALUES (
    p_tax_case_id, p_notification_type, p_priority,
    p_title_fa, p_body_fa, p_actor_role_code,
    p_due_at, p_action_url
  ) RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- 5. SEED DATA: ACTORS
-- -----------------------------------------------------------------------------

INSERT INTO tax_actors (code, title_fa, actor_type, organization, description_fa, min_count, max_count) VALUES
  ('taxpayer', 'مؤدی', 'taxpayer', NULL, 'شخص حقیقی یا حقوقی مشمول مالیات', 1, 1),
  ('taxpayer_authorized_representative', 'نماینده یا وکیل تام‌الاختیار مؤدی', 'taxpayer_authorized_representative', NULL, 'وکیل یا نماینده رسمی مؤدی با اختیارات قانونی', 0, 3),
  ('tax_audit_unit', 'واحد حسابرسی یا رسیدگی مالیاتی', 'tax_audit_unit', 'سازمان امور مالیاتی', 'انجام حسابرسی، تهیه گزارش رسیدگی و ثبت مبانی تشخیص', 1, 5),
  ('tax_assessment_issuer', 'مقام صادرکننده برگ تشخیص', 'tax_assessment_issuer', 'سازمان امور مالیاتی', 'کنترل گزارش و صدور برگ تشخیص', 1, 1),
  ('tax_notification_unit', 'واحد ابلاغ', 'tax_notification_unit', 'سازمان امور مالیاتی', 'ابلاغ اوراق و ثبت نوع، روش و تاریخ ابلاغ', 1, 1),
  ('tax_objection_unit', 'حوزه کاری اعتراضات و شکایات', 'tax_objection_unit', 'سازمان امور مالیاتی', 'دریافت اعتراض و ارسال پرونده برای رسیدگی مجدد', 1, 1),
  ('article_238_responsible_officer', 'مسئول یا مسئولان مربوط موضوع ماده ۲۳۸', 'article_238_responsible_officer', 'سازمان امور مالیاتی', 'رسیدگی به دلایل و مدارک، تعدیل یا عدم تعدیل، رفع اختلاف یا ارجاع مابه‌الاختلاف', 1, 3),
  ('tax_reexamination_expert', 'کارشناس مجری قرار', 'tax_reexamination_expert', 'سازمان امور مالیاتی', 'اجرای قرار بررسی یا کارشناسی و تهیه گزارش اجرای قرار', 1, 1),
  ('tax_finalization_collection_unit', 'واحد قطعیت و وصول', 'tax_finalization_collection_unit', 'سازمان امور مالیاتی', 'محاسبه مانده، صدور برگ قطعی، ثبت پرداخت یا ترتیب پرداخت', 1, 1),
  ('first_instance_tax_dispute_board', 'هیأت حل اختلاف مالیاتی بدوی', 'first_instance_tax_dispute_board', 'مرجع دادرسی', 'مرجع اول رسیدگی به اختلافات مالیاتی (نقطه خروج فرایند در این نسخه)', 3, 3),
  ('system_automation', 'موتور خودکار پلتفرم', 'system_automation', 'پلتفرم آگاهیم', 'محاسبه مهلت، ایجاد هشدار، کنترل پایان مهلت، اجرای انتقال خودکار و ثبت audit log', 1, 1)
ON CONFLICT (code) DO UPDATE SET
  title_fa = EXCLUDED.title_fa,
  actor_type = EXCLUDED.actor_type,
  organization = EXCLUDED.organization,
  description_fa = EXCLUDED.description_fa,
  updated_at = now();

COMMIT;
