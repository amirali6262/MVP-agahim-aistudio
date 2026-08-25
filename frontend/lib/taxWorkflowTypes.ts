import type { Database } from './database.types'

// Extended Database type with tax workflow tables
export type TaxDatabase = Database & {
  public: Database['public'] & {
    Tables: Database['public']['Tables'] & {
      tax_actors: {
        Row: {
          id: string
          code: string
          title_fa: string
          actor_type: string
          organization: string | null
          description_fa: string | null
          min_count: number
          max_count: number
          requires_authorization: boolean
          authorization_description_fa: string | null
          is_active: boolean
          version: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          title_fa: string
          actor_type: string
          organization?: string | null
          description_fa?: string | null
          min_count?: number
          max_count?: number
          requires_authorization?: boolean
          authorization_description_fa?: string | null
          is_active?: boolean
          version?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          title_fa?: string
          actor_type?: string
          organization?: string | null
          description_fa?: string | null
          min_count?: number
          max_count?: number
          requires_authorization?: boolean
          authorization_description_fa?: string | null
          is_active?: boolean
          version?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      tax_document_types: {
        Row: {
          id: string
          code: string
          title_fa: string
          document_type: string
          category: string | null
          description_fa: string | null
          is_mandatory: boolean
          is_versioned: boolean
          retention_days: number | null
          metadata_schema: Record<string, unknown>
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          title_fa: string
          document_type: string
          category?: string | null
          description_fa?: string | null
          is_mandatory?: boolean
          is_versioned?: boolean
          retention_days?: number | null
          metadata_schema?: Record<string, unknown>
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          title_fa?: string
          document_type?: string
          category?: string | null
          description_fa?: string | null
          is_mandatory?: boolean
          is_versioned?: boolean
          retention_days?: number | null
          metadata_schema?: Record<string, unknown>
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      tax_legal_references: {
        Row: {
          id: string
          code: string
          title_fa: string
          source_type: string
          source_number: string | null
          approval_date: string | null
          effective_date: string | null
          article_or_section: string | null
          relevant_text_fa: string | null
          source_url: string | null
          is_active: boolean
          superseded_by: string | null
          superseding: string | null
          last_verified_date: string | null
          notes_fa: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          title_fa: string
          source_type: string
          source_number?: string | null
          approval_date?: string | null
          effective_date?: string | null
          article_or_section?: string | null
          relevant_text_fa?: string | null
          source_url?: string | null
          is_active?: boolean
          superseded_by?: string | null
          superseding?: string | null
          last_verified_date?: string | null
          notes_fa?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          title_fa?: string
          source_type?: string
          source_number?: string | null
          approval_date?: string | null
          effective_date?: string | null
          article_or_section?: string | null
          relevant_text_fa?: string | null
          source_url?: string | null
          is_active?: boolean
          superseded_by?: string | null
          superseding?: string | null
          last_verified_date?: string | null
          notes_fa?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      tax_cases: {
        Row: {
          id: string
          compliance_case_id: string | null
          tenant_id: string
          case_number: string | null
          taxpayer_id: string | null
          taxpayer_type: string | null
          national_id: string | null
          taxpayer_name: string | null
          tax_office_general: string | null
          tax_office: string | null
          work_area: string | null
          fiscal_year: number
          period_start: string | null
          period_end: string | null
          declaration_type: string
          declaration_number: string | null
          declaration_submitted_at: string | null
          status: string
          current_step_code: string | null
          process_version: string
          declared_taxable_income: number
          declared_tax: number
          assessed_taxable_income: number
          assessed_tax: number
          penalties_on_notice: number
          exemptions: number
          zero_rate: number
          credits: number
          previous_payments: number
          advance_payments: number
          withheld_tax: number
          taxpayer_accepted_amount: number
          taxpayer_contested_amount: number
          adjusted_taxable_income: number
          adjusted_tax: number
          disputed_amount_resolved: number
          remaining_disputed_amount: number
          final_tax_amount: number
          balance_due: number
          overpayment_amount: number
          overpayment_status: string | null
          currency: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          compliance_case_id?: string | null
          tenant_id: string
          case_number?: string | null
          taxpayer_id?: string | null
          taxpayer_type?: string | null
          national_id?: string | null
          taxpayer_name?: string | null
          tax_office_general?: string | null
          tax_office?: string | null
          work_area?: string | null
          fiscal_year: number
          period_start?: string | null
          period_end?: string | null
          declaration_type?: string
          declaration_number?: string | null
          declaration_submitted_at?: string | null
          status?: string
          current_step_code?: string | null
          process_version?: string
          declared_taxable_income?: number
          declared_tax?: number
          assessed_taxable_income?: number
          assessed_tax?: number
          penalties_on_notice?: number
          exemptions?: number
          zero_rate?: number
          credits?: number
          previous_payments?: number
          advance_payments?: number
          withheld_tax?: number
          taxpayer_accepted_amount?: number
          taxpayer_contested_amount?: number
          adjusted_taxable_income?: number
          adjusted_tax?: number
          disputed_amount_resolved?: number
          remaining_disputed_amount?: number
          final_tax_amount?: number
          balance_due?: number
          overpayment_amount?: number
          overpayment_status?: string | null
          currency?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          compliance_case_id?: string | null
          tenant_id?: string
          case_number?: string | null
          taxpayer_id?: string | null
          taxpayer_type?: string | null
          national_id?: string | null
          taxpayer_name?: string | null
          tax_office_general?: string | null
          tax_office?: string | null
          work_area?: string | null
          fiscal_year?: number
          period_start?: string | null
          period_end?: string | null
          declaration_type?: string
          declaration_number?: string | null
          declaration_submitted_at?: string | null
          status?: string
          current_step_code?: string | null
          process_version?: string
          declared_taxable_income?: number
          declared_tax?: number
          assessed_taxable_income?: number
          assessed_tax?: number
          penalties_on_notice?: number
          exemptions?: number
          zero_rate?: number
          credits?: number
          previous_payments?: number
          advance_payments?: number
          withheld_tax?: number
          taxpayer_accepted_amount?: number
          taxpayer_contested_amount?: number
          adjusted_taxable_income?: number
          adjusted_tax?: number
          disputed_amount_resolved?: number
          remaining_disputed_amount?: number
          final_tax_amount?: number
          balance_due?: number
          overpayment_amount?: number
          overpayment_status?: string | null
          currency?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tax_cases_compliance_case_id_fkey'
            columns: ['compliance_case_id']
            isOneToOne: false
            referencedRelation: 'compliance_cases'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tax_cases_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          }
        ]
      }
      tax_financial_records: {
        Row: {
          id: string
          tax_case_id: string
          field_name: string
          previous_value: number | null
          new_value: number
          change_reason: string | null
          changed_by: string | null
          changed_at: string
          version: number
          metadata: Record<string, unknown>
          created_at: string
        }
        Insert: {
          id?: string
          tax_case_id: string
          field_name: string
          previous_value?: number | null
          new_value: number
          change_reason?: string | null
          changed_by?: string | null
          changed_at?: string
          version?: number
          metadata?: Record<string, unknown>
          created_at?: string
        }
        Update: {
          id?: string
          tax_case_id?: string
          field_name?: string
          previous_value?: number | null
          new_value?: number
          change_reason?: string | null
          changed_by?: string | null
          changed_at?: string
          version?: number
          metadata?: Record<string, unknown>
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tax_financial_records_tax_case_id_fkey'
            columns: ['tax_case_id']
            isOneToOne: false
            referencedRelation: 'tax_cases'
            referencedColumns: ['id']
          }
        ]
      }
      tax_service_records: {
        Row: {
          id: string
          tax_case_id: string
          document_type: string
          service_type: string
          upload_date: string | null
          first_sms_date: string | null
          viewed_date: string | null
          effective_service_date: string | null
          service_method: string | null
          service_method_type: string | null
          recipient_name: string | null
          recipient_role: string | null
          destination_address: string | null
          service_document_url: string | null
          is_valid: boolean
          validation_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tax_case_id: string
          document_type: string
          service_type: string
          upload_date?: string | null
          first_sms_date?: string | null
          viewed_date?: string | null
          effective_service_date?: string | null
          service_method?: string | null
          service_method_type?: string | null
          recipient_name?: string | null
          recipient_role?: string | null
          destination_address?: string | null
          service_document_url?: string | null
          is_valid?: boolean
          validation_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tax_case_id?: string
          document_type?: string
          service_type?: string
          upload_date?: string | null
          first_sms_date?: string | null
          viewed_date?: string | null
          effective_service_date?: string | null
          service_method?: string | null
          service_method_type?: string | null
          recipient_name?: string | null
          recipient_role?: string | null
          destination_address?: string | null
          service_document_url?: string | null
          is_valid?: boolean
          validation_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tax_service_records_tax_case_id_fkey'
            columns: ['tax_case_id']
            isOneToOne: false
            referencedRelation: 'tax_cases'
            referencedColumns: ['id']
          }
        ]
      }
      tax_objection_items: {
        Row: {
          id: string
          tax_case_id: string
          item_code: string
          title_fa: string
          initial_amount: number
          taxpayer_accepted_amount: number
          taxpayer_contested_amount: number
          objection_reason: string | null
          related_documents: string[] | null
          examination_status: string
          organization_accepted_amount: number
          remaining_disputed_amount: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tax_case_id: string
          item_code: string
          title_fa: string
          initial_amount?: number
          taxpayer_accepted_amount?: number
          taxpayer_contested_amount?: number
          objection_reason?: string | null
          related_documents?: string[] | null
          examination_status?: string
          organization_accepted_amount?: number
          remaining_disputed_amount?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tax_case_id?: string
          item_code?: string
          title_fa?: string
          initial_amount?: number
          taxpayer_accepted_amount?: number
          taxpayer_contested_amount?: number
          objection_reason?: string | null
          related_documents?: string[] | null
          examination_status?: string
          organization_accepted_amount?: number
          remaining_disputed_amount?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tax_objection_items_tax_case_id_fkey'
            columns: ['tax_case_id']
            isOneToOne: false
            referencedRelation: 'tax_cases'
            referencedColumns: ['id']
          }
        ]
      }
      tax_audit_log: {
        Row: {
          id: string
          tax_case_id: string | null
          action: string
          table_name: string
          record_id: string | null
          old_values: Record<string, unknown> | null
          new_values: Record<string, unknown> | null
          performed_by: string | null
          performed_at: string
          ip_address: string | null
          user_agent: string | null
          metadata: Record<string, unknown>
          created_at: string
        }
        Insert: {
          id?: string
          tax_case_id?: string | null
          action: string
          table_name: string
          record_id?: string | null
          old_values?: Record<string, unknown> | null
          new_values?: Record<string, unknown> | null
          performed_by?: string | null
          performed_at?: string
          ip_address?: string | null
          user_agent?: string | null
          metadata?: Record<string, unknown>
          created_at?: string
        }
        Update: {
          id?: string
          tax_case_id?: string | null
          action?: string
          table_name?: string
          record_id?: string | null
          old_values?: Record<string, unknown> | null
          new_values?: Record<string, unknown> | null
          performed_by?: string | null
          performed_at?: string
          ip_address?: string | null
          user_agent?: string | null
          metadata?: Record<string, unknown>
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tax_audit_log_tax_case_id_fkey'
            columns: ['tax_case_id']
            isOneToOne: false
            referencedRelation: 'tax_cases'
            referencedColumns: ['id']
          }
        ]
      }
      iran_holidays: {
        Row: {
          id: string
          holiday_date: string
          title_fa: string
          is_recurring: boolean
          category: string
          created_at: string
        }
        Insert: {
          id?: string
          holiday_date: string
          title_fa: string
          is_recurring?: boolean
          category?: string
          created_at?: string
        }
        Update: {
          id?: string
          holiday_date?: string
          title_fa?: string
          is_recurring?: boolean
          category?: string
          created_at?: string
        }
        Relationships: []
      }
      tax_notifications: {
        Row: {
          id: string
          tax_case_id: string
          notification_type: string
          priority: string
          title_fa: string
          body_fa: string
          actor_role_code: string | null
          deadline_reference: string | null
          due_at: string | null
          sent_at: string | null
          channel: string
          is_read: boolean
          is_actioned: boolean
          actioned_at: string | null
          action_url: string | null
          recurring: boolean
          escalation_level: number
          metadata: Record<string, unknown>
          created_at: string
        }
        Insert: {
          id?: string
          tax_case_id: string
          notification_type: string
          priority?: string
          title_fa: string
          body_fa: string
          actor_role_code?: string | null
          deadline_reference?: string | null
          due_at?: string | null
          sent_at?: string | null
          channel?: string
          is_read?: boolean
          is_actioned?: boolean
          actioned_at?: string | null
          action_url?: string | null
          recurring?: boolean
          escalation_level?: number
          metadata?: Record<string, unknown>
          created_at?: string
        }
        Update: {
          id?: string
          tax_case_id?: string
          notification_type?: string
          priority?: string
          title_fa?: string
          body_fa?: string
          actor_role_code?: string | null
          deadline_reference?: string | null
          due_at?: string | null
          sent_at?: string | null
          channel?: string
          is_read?: boolean
          is_actioned?: boolean
          actioned_at?: string | null
          action_url?: string | null
          recurring?: boolean
          escalation_level?: number
          metadata?: Record<string, unknown>
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tax_notifications_tax_case_id_fkey'
            columns: ['tax_case_id']
            isOneToOne: false
            referencedRelation: 'tax_cases'
            referencedColumns: ['id']
          }
        ]
      }
      tax_deadline_history: {
        Row: {
          id: string
          tax_case_id: string
          deadline_type: string
          step_code: string | null
          start_date: string
          original_end_date: string
          adjusted_end_date: string
          calendar_used: string
          holidays_applied: string[] | null
          status: string
          time_remaining: string | null
          extension_reason: string | null
          action_taken_at: string | null
          is_within_deadline: boolean | null
          reminder_dates: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tax_case_id: string
          deadline_type: string
          step_code?: string | null
          start_date: string
          original_end_date: string
          adjusted_end_date: string
          calendar_used?: string
          holidays_applied?: string[] | null
          status?: string
          time_remaining?: string | null
          extension_reason?: string | null
          action_taken_at?: string | null
          is_within_deadline?: boolean | null
          reminder_dates?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tax_case_id?: string
          deadline_type?: string
          step_code?: string | null
          start_date?: string
          original_end_date?: string
          adjusted_end_date?: string
          calendar_used?: string
          holidays_applied?: string[] | null
          status?: string
          time_remaining?: string | null
          extension_reason?: string | null
          action_taken_at?: string | null
          is_within_deadline?: boolean | null
          reminder_dates?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tax_deadline_history_tax_case_id_fkey'
            columns: ['tax_case_id']
            isOneToOne: false
            referencedRelation: 'tax_cases'
            referencedColumns: ['id']
          }
        ]
      }
      tax_transition_history: {
        Row: {
          id: string
          tax_case_id: string
          transition_code: string
          from_step_code: string
          to_step_code: string | null
          trigger_type: string
          outcome_code: string
          response_data: Record<string, unknown>
          legal_basis_id: string | null
          audit_message: string | null
          executed_by: string | null
          executed_at: string
          is_automatic: boolean
          requires_human_confirmation: boolean
          created_at: string
        }
        Insert: {
          id?: string
          tax_case_id: string
          transition_code: string
          from_step_code: string
          to_step_code?: string | null
          trigger_type: string
          outcome_code: string
          response_data?: Record<string, unknown>
          legal_basis_id?: string | null
          audit_message?: string | null
          executed_by?: string | null
          executed_at?: string
          is_automatic?: boolean
          requires_human_confirmation?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          tax_case_id?: string
          transition_code?: string
          from_step_code?: string
          to_step_code?: string | null
          trigger_type?: string
          outcome_code?: string
          response_data?: Record<string, unknown>
          legal_basis_id?: string | null
          audit_message?: string | null
          executed_by?: string | null
          executed_at?: string
          is_automatic?: boolean
          requires_human_confirmation?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tax_transition_history_tax_case_id_fkey'
            columns: ['tax_case_id']
            isOneToOne: false
            referencedRelation: 'tax_cases'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tax_transition_history_legal_basis_id_fkey'
            columns: ['legal_basis_id']
            isOneToOne: false
            referencedRelation: 'tax_legal_references'
            referencedColumns: ['id']
          }
        ]
      }
      tax_ai_decisions: {
        Row: {
          id: string
          tax_case_id: string
          current_step_code: string | null
          current_status: string | null
          last_valid_event: string | null
          current_actor: string | null
          next_action: string | null
          deadline_for_action: string | null
          time_remaining: string | null
          risk_of_losing_objection_right: boolean
          service_type: string | null
          can_file_238_objection: boolean
          can_settle: boolean
          needs_document: boolean
          incomplete_documents: string[] | null
          taxpayer_accepted_amount: number | null
          taxpayer_contested_amount: number | null
          predicted_outcome: string | null
          legal_basis_reference: string | null
          confidence_level: string | null
          outcome_reason: string | null
          legal_warning: string | null
          generated_at: string
          created_at: string
        }
        Insert: {
          id?: string
          tax_case_id: string
          current_step_code?: string | null
          current_status?: string | null
          last_valid_event?: string | null
          current_actor?: string | null
          next_action?: string | null
          deadline_for_action?: string | null
          time_remaining?: string | null
          risk_of_losing_objection_right?: boolean
          service_type?: string | null
          can_file_238_objection?: boolean
          can_settle?: boolean
          needs_document?: boolean
          incomplete_documents?: string[] | null
          taxpayer_accepted_amount?: number | null
          taxpayer_contested_amount?: number | null
          predicted_outcome?: string | null
          legal_basis_reference?: string | null
          confidence_level?: string | null
          outcome_reason?: string | null
          legal_warning?: string | null
          generated_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          tax_case_id?: string
          current_step_code?: string | null
          current_status?: string | null
          last_valid_event?: string | null
          current_actor?: string | null
          next_action?: string | null
          deadline_for_action?: string | null
          time_remaining?: string | null
          risk_of_losing_objection_right?: boolean
          service_type?: string | null
          can_file_238_objection?: boolean
          can_settle?: boolean
          needs_document?: boolean
          incomplete_documents?: string[] | null
          taxpayer_accepted_amount?: number | null
          taxpayer_contested_amount?: number | null
          predicted_outcome?: string | null
          legal_basis_reference?: string | null
          confidence_level?: string | null
          outcome_reason?: string | null
          legal_warning?: string | null
          generated_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tax_ai_decisions_tax_case_id_fkey'
            columns: ['tax_case_id']
            isOneToOne: false
            referencedRelation: 'tax_cases'
            referencedColumns: ['id']
          }
        ]
      }
    }
  }
}

// Helper types for tax workflow
export type TaxActor = TaxDatabase['public']['Tables']['tax_actors']['Row']
export type TaxDocumentType = TaxDatabase['public']['Tables']['tax_document_types']['Row']
export type TaxLegalReference = TaxDatabase['public']['Tables']['tax_legal_references']['Row']
export type TaxCase = TaxDatabase['public']['Tables']['tax_cases']['Row']
export type TaxFinancialRecord = TaxDatabase['public']['Tables']['tax_financial_records']['Row']
export type TaxServiceRecord = TaxDatabase['public']['Tables']['tax_service_records']['Row']
export type TaxObjectionItem = TaxDatabase['public']['Tables']['tax_objection_items']['Row']
export type TaxAuditLog = TaxDatabase['public']['Tables']['tax_audit_log']['Row']
export type IranHoliday = TaxDatabase['public']['Tables']['iran_holidays']['Row']
export type TaxNotification = TaxDatabase['public']['Tables']['tax_notifications']['Row']
export type TaxDeadlineHistory = TaxDatabase['public']['Tables']['tax_deadline_history']['Row']
export type TaxTransitionHistory = TaxDatabase['public']['Tables']['tax_transition_history']['Row']
export type TaxAiDecision = TaxDatabase['public']['Tables']['tax_ai_decisions']['Row']

// Tax case status enum
export type TaxCaseStatus = 
  | 'audit_in_progress'
  | 'audit_report_completed'
  | 'assessment_issued'
  | 'assessment_service_pending'
  | 'assessment_served_actual'
  | 'assessment_served_legal'
  | 'assessment_service_invalid'
  | 'objection_window_open'
  | 'objection_registered'
  | 'article_238_review_in_progress'
  | 'reexamination_order_issued'
  | 'reexamination_report_completed'
  | 'article_238_result_issued'
  | 'awaiting_taxpayer_response'
  | 'settled_in_full'
  | 'settled_in_part'
  | 'no_settlement'
  | 'deemed_objector_due_to_legal_service'
  | 'final_due_to_acceptance'
  | 'final_due_to_payment'
  | 'final_due_to_no_timely_objection'
  | 'partially_final_partially_referred'
  | 'referred_to_first_instance_board'
  | 'final_notice_issued'
  | 'final_notice_served'
  | 'payment_due'
  | 'paid'
  | 'payment_arranged'
  | 'no_payment_required'
  | 'overpayment_detected'
  | 'payment_overdue_requires_collection_process'

// Tax service type enum
export type TaxServiceType = 'actual' | 'legal' | 'pending_validation' | 'invalid'

// Tax step type enum
export type TaxStepType = 'mandatory' | 'conditional' | 'terminal' | 'transition' | 'optional'

// Tax deadline status enum
export type TaxDeadlineStatus = 'pending' | 'active' | 'completed' | 'overdue' | 'extended' | 'cancelled'

// Tax result type enum
export type TaxResultType = 
  | 'assessment_fully_rejected'
  | 'objection_fully_accepted'
  | 'assessment_adjusted'
  | 'assessment_upheld'
  | 'mixed_result'
  | 'procedural_incomplete'

// Tax taxpayer decision enum
export type TaxTaxpayerDecision = 
  | 'accepted_in_full'
  | 'accepted_in_part'
  | 'rejected_in_full'
  | 'no_response'
  | 'not_required_no_remaining_dispute'
