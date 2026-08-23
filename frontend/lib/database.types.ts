export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      case_deadlines: {
        Row: {
          case_id: string
          created_at: string
          created_by: string
          deadline_type: string
          due_at: string
          id: string
          reason: string | null
          source_circular_id: string | null
          workflow_step_id: string | null
        }
        Insert: {
          case_id: string
          created_at?: string
          created_by: string
          deadline_type: string
          due_at: string
          id?: string
          reason?: string | null
          source_circular_id?: string | null
          workflow_step_id?: string | null
        }
        Update: {
          case_id?: string
          created_at?: string
          created_by?: string
          deadline_type?: string
          due_at?: string
          id?: string
          reason?: string | null
          source_circular_id?: string | null
          workflow_step_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_deadlines_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "compliance_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_deadlines_source_circular_id_fkey"
            columns: ["source_circular_id"]
            isOneToOne: false
            referencedRelation: "legal_circulars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_deadlines_workflow_step_id_fkey"
            columns: ["workflow_step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      case_events: {
        Row: {
          amount: number | null
          case_id: string
          created_at: string
          description: string | null
          event_type: string
          id: string
          metadata: Json
          occurred_at: string
          recorded_by: string
          reference_number: string | null
          title: string
        }
        Insert: {
          amount?: number | null
          case_id: string
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          metadata?: Json
          occurred_at: string
          recorded_by: string
          reference_number?: string | null
          title: string
        }
        Update: {
          amount?: number | null
          case_id?: string
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          recorded_by?: string
          reference_number?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "compliance_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_transition_history: {
        Row: {
          case_id: string
          executed_at: string
          executed_by: string | null
          from_step_id: string
          id: string
          outcome_code: string
          response_data: Json
          to_step_id: string | null
          transition_id: string
          trigger_type: string
        }
        Insert: {
          case_id: string
          executed_at?: string
          executed_by?: string | null
          from_step_id: string
          id?: string
          outcome_code: string
          response_data?: Json
          to_step_id?: string | null
          transition_id: string
          trigger_type: string
        }
        Update: {
          case_id?: string
          executed_at?: string
          executed_by?: string | null
          from_step_id?: string
          outcome_code?: string
          response_data?: Json
          to_step_id?: string | null
          transition_id?: string
          trigger_type?: string
        }
        Relationships: []
      }
      case_tasks: {
        Row: {
          case_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          due_at: string | null
          id: string
          response_data: Json
          status: string
          updated_at: string
          workflow_step_id: string
        }
        Insert: {
          case_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          response_data?: Json
          status?: string
          updated_at?: string
          workflow_step_id: string
        }
        Update: {
          case_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          response_data?: Json
          status?: string
          updated_at?: string
          workflow_step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_tasks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "compliance_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_tasks_workflow_step_id_fkey"
            columns: ["workflow_step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_cases: {
        Row: {
          assessment_id: string
          closed_at: string | null
          created_at: string
          current_step_id: string | null
          id: string
          obligation_version_id: string
          opened_at: string
          period_key: string
          status: string
          tenant_id: string
          updated_at: string
          workflow_template_id: string
        }
        Insert: {
          assessment_id: string
          closed_at?: string | null
          created_at?: string
          current_step_id?: string | null
          id?: string
          obligation_version_id: string
          opened_at?: string
          period_key: string
          status?: string
          tenant_id: string
          updated_at?: string
          workflow_template_id: string
        }
        Update: {
          assessment_id?: string
          closed_at?: string | null
          created_at?: string
          current_step_id?: string | null
          id?: string
          obligation_version_id?: string
          opened_at?: string
          period_key?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          workflow_template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_cases_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "eligibility_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_cases_current_step_id_fkey"
            columns: ["current_step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_cases_obligation_version_id_fkey"
            columns: ["obligation_version_id"]
            isOneToOne: false
            referencedRelation: "obligation_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_cases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_cases_workflow_template_id_fkey"
            columns: ["workflow_template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      eligibility_assessments: {
        Row: {
          evaluated_at: string
          evaluated_by: string
          explanation: string
          id: string
          matched_rule_set_id: string | null
          obligation_version_id: string
          outcome: string
          profile_version_id: string
          tenant_id: string
        }
        Insert: {
          evaluated_at?: string
          evaluated_by: string
          explanation: string
          id?: string
          matched_rule_set_id?: string | null
          obligation_version_id: string
          outcome: string
          profile_version_id: string
          tenant_id: string
        }
        Update: {
          evaluated_at?: string
          evaluated_by?: string
          explanation?: string
          id?: string
          matched_rule_set_id?: string | null
          obligation_version_id?: string
          outcome?: string
          profile_version_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eligibility_assessments_matched_rule_set_id_fkey"
            columns: ["matched_rule_set_id"]
            isOneToOne: false
            referencedRelation: "eligibility_rule_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eligibility_assessments_obligation_version_id_fkey"
            columns: ["obligation_version_id"]
            isOneToOne: false
            referencedRelation: "obligation_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eligibility_assessments_profile_version_id_fkey"
            columns: ["profile_version_id"]
            isOneToOne: false
            referencedRelation: "tenant_profile_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eligibility_assessments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      eligibility_conditions: {
        Row: {
          created_at: string
          expected_value: Json | null
          fact_key: string
          id: string
          operator: string
          rule_set_id: string
          sequence: number
        }
        Insert: {
          created_at?: string
          expected_value?: Json | null
          fact_key: string
          id?: string
          operator: string
          rule_set_id: string
          sequence: number
        }
        Update: {
          created_at?: string
          expected_value?: Json | null
          fact_key?: string
          id?: string
          operator?: string
          rule_set_id?: string
          sequence?: number
        }
        Relationships: [
          {
            foreignKeyName: "eligibility_conditions_rule_set_id_fkey"
            columns: ["rule_set_id"]
            isOneToOne: false
            referencedRelation: "eligibility_rule_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      eligibility_rule_sets: {
        Row: {
          created_at: string
          created_by: string
          explanation: string
          id: string
          obligation_version_id: string
          outcome: string
          priority: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          explanation: string
          id?: string
          obligation_version_id: string
          outcome: string
          priority: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          explanation?: string
          id?: string
          obligation_version_id?: string
          outcome?: string
          priority?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eligibility_rule_sets_obligation_version_id_fkey"
            columns: ["obligation_version_id"]
            isOneToOne: false
            referencedRelation: "obligation_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_circulars: {
        Row: {
          circular_number: string | null
          created_at: string
          created_by: string
          effective_on: string | null
          id: string
          issued_on: string
          obligation_version_id: string
          published_at: string | null
          published_by: string | null
          source_url: string
          status: string
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          circular_number?: string | null
          created_at?: string
          created_by?: string
          effective_on?: string | null
          id?: string
          issued_on: string
          obligation_version_id: string
          published_at?: string | null
          published_by?: string | null
          source_url: string
          status?: string
          summary: string
          title: string
          updated_at?: string
        }
        Update: {
          circular_number?: string | null
          created_at?: string
          created_by?: string
          effective_on?: string | null
          id?: string
          issued_on?: string
          obligation_version_id?: string
          published_at?: string | null
          published_by?: string | null
          source_url?: string
          status?: string
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_circulars_obligation_version_id_fkey"
            columns: ["obligation_version_id"]
            isOneToOne: false
            referencedRelation: "obligation_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string
          case_id: string | null
          circular_id: string | null
          created_at: string
          deadline_id: string | null
          deduplication_key: string
          id: string
          kind: string
          read_at: string | null
          tenant_id: string
          title: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          body: string
          case_id?: string | null
          circular_id?: string | null
          created_at?: string
          deadline_id?: string | null
          deduplication_key: string
          id?: string
          kind: string
          read_at?: string | null
          tenant_id: string
          title: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          body?: string
          case_id?: string | null
          circular_id?: string | null
          created_at?: string
          deadline_id?: string | null
          deduplication_key?: string
          id?: string
          kind?: string
          read_at?: string | null
          tenant_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "compliance_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_circular_id_fkey"
            columns: ["circular_id"]
            isOneToOne: false
            referencedRelation: "legal_circulars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_deadline_id_fkey"
            columns: ["deadline_id"]
            isOneToOne: false
            referencedRelation: "case_deadlines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      obligation_families: {
        Row: {
          code: string
          created_at: string
          created_by: string
          description: string | null
          domain: string
          id: string
          is_active: boolean
          title: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string
          description?: string | null
          domain: string
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          description?: string | null
          domain?: string
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      obligation_review_requests: {
        Row: {
          created_at: string
          decision_note: string | null
          id: string
          obligation_version_id: string
          reviewed_at: string | null
          reviewer_id: string | null
          status: string
          submitted_at: string
          submitted_by: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decision_note?: string | null
          id?: string
          obligation_version_id: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: string
          submitted_at?: string
          submitted_by: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decision_note?: string | null
          id?: string
          obligation_version_id?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obligation_review_requests_obligation_version_id_fkey"
            columns: ["obligation_version_id"]
            isOneToOne: false
            referencedRelation: "obligation_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      obligation_version_penalties: {
        Row: { amount: number | null; created_at: string; id: string; obligation_version_id: string; penalty_type: string; rate_percent: number | null; sequence: number; title: string; updated_at: string }
        Insert: { amount?: number | null; created_at?: string; id?: string; obligation_version_id: string; penalty_type: string; rate_percent?: number | null; sequence: number; title: string; updated_at?: string }
        Update: { amount?: number | null; id?: string; obligation_version_id?: string; penalty_type?: string; rate_percent?: number | null; sequence?: number; title?: string; updated_at?: string }
        Relationships: []
      }
      obligation_versions: {
        Row: {
          audience_summary: string | null
          created_at: string
          created_by: string
          deadline_rule: Json
          effective_from: string | null
          effective_to: string | null
          id: string
          legal_reference: string | null
          obligation_id: string
          penalty_rule: Json
          published_at: string | null
          published_by: string | null
          recurrence_rule: Json
          source_url: string | null
          status: string
          updated_at: string
          version_number: number
        }
        Insert: {
          audience_summary?: string | null
          created_at?: string
          created_by?: string
          deadline_rule?: Json
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          legal_reference?: string | null
          obligation_id: string
          penalty_rule?: Json
          published_at?: string | null
          published_by?: string | null
          recurrence_rule?: Json
          source_url?: string | null
          status?: string
          updated_at?: string
          version_number: number
        }
        Update: {
          audience_summary?: string | null
          created_at?: string
          created_by?: string
          deadline_rule?: Json
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          legal_reference?: string | null
          obligation_id?: string
          penalty_rule?: Json
          published_at?: string | null
          published_by?: string | null
          recurrence_rule?: Json
          source_url?: string | null
          status?: string
          updated_at?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "obligation_versions_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "obligations"
            referencedColumns: ["id"]
          },
        ]
      }
      obligations: {
        Row: {
          authority_name: string | null
          code: string
          created_at: string
          created_by: string
          family_id: string
          id: string
          is_active: boolean
          official_action_url: string | null
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          authority_name?: string | null
          code: string
          created_at?: string
          created_by?: string
          family_id: string
          id?: string
          is_active?: boolean
          official_action_url?: string | null
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          authority_name?: string | null
          code?: string
          created_at?: string
          created_by?: string
          family_id?: string
          id?: string
          is_active?: boolean
          official_action_url?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obligations_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "obligation_families"
            referencedColumns: ["id"]
          },
        ]
      }
      penalty_estimates: {
        Row: {
          base_amount: number
          calculated_as_of: string
          calculated_by: string
          calculation_rule: Json
          case_id: string
          created_at: string
          days_late: number
          deadline_id: string | null
          estimated_amount: number
          gross_amount: number
          id: string
          obligation_version_id: string
          paid_amount: number
          waived_amount: number
        }
        Insert: {
          base_amount: number
          calculated_as_of: string
          calculated_by: string
          calculation_rule: Json
          case_id: string
          created_at?: string
          days_late: number
          deadline_id?: string | null
          estimated_amount: number
          gross_amount: number
          id?: string
          obligation_version_id: string
          paid_amount?: number
          waived_amount?: number
        }
        Update: {
          base_amount?: number
          calculated_as_of?: string
          calculated_by?: string
          calculation_rule?: Json
          case_id?: string
          created_at?: string
          days_late?: number
          deadline_id?: string | null
          estimated_amount?: number
          gross_amount?: number
          id?: string
          obligation_version_id?: string
          paid_amount?: number
          waived_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "penalty_estimates_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "compliance_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "penalty_estimates_deadline_id_fkey"
            columns: ["deadline_id"]
            isOneToOne: false
            referencedRelation: "case_deadlines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "penalty_estimates_obligation_version_id_fkey"
            columns: ["obligation_version_id"]
            isOneToOne: false
            referencedRelation: "obligation_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_profile_versions: {
        Row: {
          activity_codes: string[]
          annual_revenue: number | null
          branch_count: number
          contract_types: string[]
          created_at: string
          created_by: string
          custom_attributes: Json
          employee_count: number
          has_active_contracts: boolean
          id: string
          legal_form: string | null
          pays_salaries: boolean
          primary_activity: string | null
          tax_registration_status: string
          tenant_id: string
          valid_from: string
          valid_to: string | null
          vat_registration_status: string
        }
        Insert: {
          activity_codes?: string[]
          annual_revenue?: number | null
          branch_count?: number
          contract_types?: string[]
          created_at?: string
          created_by: string
          custom_attributes?: Json
          employee_count?: number
          has_active_contracts?: boolean
          id?: string
          legal_form?: string | null
          pays_salaries?: boolean
          primary_activity?: string | null
          tax_registration_status?: string
          tenant_id: string
          valid_from: string
          valid_to?: string | null
          vat_registration_status?: string
        }
        Update: {
          activity_codes?: string[]
          annual_revenue?: number | null
          branch_count?: number
          contract_types?: string[]
          created_at?: string
          created_by?: string
          custom_attributes?: Json
          employee_count?: number
          has_active_contracts?: boolean
          id?: string
          legal_form?: string | null
          pays_salaries?: boolean
          primary_activity?: string | null
          tax_registration_status?: string
          tenant_id?: string
          valid_from?: string
          valid_to?: string | null
          vat_registration_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_profile_versions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          created_by: string
          economic_code: string | null
          entity_type: string
          id: string
          name: string
          national_id: string | null
          province: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          economic_code?: string | null
          entity_type: string
          id?: string
          name: string
          national_id?: string | null
          province?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          economic_code?: string | null
          entity_type?: string
          id?: string
          name?: string
          national_id?: string | null
          province?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_tenants: {
        Row: {
          created_at: string
          id: string
          role: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tenants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string | null
          id: string
          phone: string | null
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      workflow_steps: {
        Row: {
          actor: string
          code: string
          created_at: string
          due_rule: Json
          form_schema: Json
          id: string
          instructions: string | null
          is_optional: boolean
          sequence: number
          title: string
          workflow_template_id: string
        }
        Insert: {
          actor: string
          code: string
          created_at?: string
          due_rule?: Json
          form_schema?: Json
          id?: string
          instructions?: string | null
          is_optional?: boolean
          sequence: number
          title: string
          workflow_template_id: string
        }
        Update: {
          actor?: string
          code?: string
          created_at?: string
          due_rule?: Json
          form_schema?: Json
          id?: string
          instructions?: string | null
          is_optional?: boolean
          sequence?: number
          title?: string
          workflow_template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_steps_workflow_template_id_fkey"
            columns: ["workflow_template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_transitions: {
        Row: {
          code: string
          created_at: string
          description: string | null
          event_code: string | null
          from_step_id: string
          id: string
          legal_reference: string | null
          outcome_code: string
          priority: number
          terminal_status: string | null
          timeout_interval: string | null
          title: string
          to_step_id: string | null
          trigger_type: string
          workflow_template_id: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          event_code?: string | null
          from_step_id: string
          id?: string
          legal_reference?: string | null
          outcome_code: string
          priority?: number
          terminal_status?: string | null
          timeout_interval?: string | null
          title: string
          to_step_id?: string | null
          trigger_type: string
          workflow_template_id: string
        }
        Update: {
          code?: string
          description?: string | null
          event_code?: string | null
          from_step_id?: string
          legal_reference?: string | null
          outcome_code?: string
          priority?: number
          terminal_status?: string | null
          timeout_interval?: string | null
          title?: string
          to_step_id?: string | null
          trigger_type?: string
          workflow_template_id?: string
        }
        Relationships: []
      }
      workflow_templates: {
        Row: {
          created_at: string
          created_by: string
          id: string
          obligation_version_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          obligation_version_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          obligation_version_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_templates_obligation_version_id_fkey"
            columns: ["obligation_version_id"]
            isOneToOne: true
            referencedRelation: "obligation_versions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      complete_case_task: {
        Args: { requested_response?: Json; requested_task_id: string; requested_transition_id: string }
        Returns: {
          assessment_id: string
          closed_at: string | null
          created_at: string
          current_step_id: string | null
          id: string
          obligation_version_id: string
          opened_at: string
          period_key: string
          status: string
          tenant_id: string
          updated_at: string
          workflow_template_id: string
        }
        SetofOptions: {
          from: "*"
          to: "compliance_cases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_obligation_draft: {
        Args: {
          requested_authority_name?: string
          requested_code: string
          requested_deadline_rule?: Json
          requested_effective_from?: string
          requested_family_id: string
          requested_legal_reference?: string
          requested_official_action_url?: string
          requested_penalty_rule?: Json
          requested_recurrence_rule?: Json
          requested_source_url?: string
          requested_summary?: string
          requested_title: string
        }
        Returns: {
          audience_summary: string | null
          created_at: string
          created_by: string
          deadline_rule: Json
          effective_from: string | null
          effective_to: string | null
          id: string
          legal_reference: string | null
          obligation_id: string
          penalty_rule: Json
          published_at: string | null
          published_by: string | null
          recurrence_rule: Json
          source_url: string | null
          status: string
          updated_at: string
          version_number: number
        }
        SetofOptions: {
          from: "*"
          to: "obligation_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_tenant_with_owner: {
        Args: {
          p_economic_code?: string
          p_entity_type: string
          p_name: string
          p_national_id?: string
          p_province?: string
        }
        Returns: {
          created_at: string
          created_by: string
          economic_code: string | null
          entity_type: string
          id: string
          name: string
          national_id: string | null
          province: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tenants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      estimate_case_penalty: {
        Args: {
          requested_as_of?: string
          requested_base_amount: number
          requested_case_id: string
          requested_paid_amount?: number
          requested_waived_amount?: number
        }
        Returns: {
          base_amount: number
          calculated_as_of: string
          calculated_by: string
          calculation_rule: Json
          case_id: string
          created_at: string
          days_late: number
          deadline_id: string | null
          estimated_amount: number
          gross_amount: number
          id: string
          obligation_version_id: string
          paid_amount: number
          waived_amount: number
        }
        SetofOptions: {
          from: "*"
          to: "penalty_estimates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      evaluate_tenant_eligibility: {
        Args: { requested_tenant_id: string }
        Returns: {
          evaluated_at: string
          evaluated_by: string
          explanation: string
          id: string
          matched_rule_set_id: string | null
          obligation_version_id: string
          outcome: string
          profile_version_id: string
          tenant_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "eligibility_assessments"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_tenant_compliance_summary: {
        Args: { requested_tenant_id: string }
        Returns: {
          completed_cases: number
          open_cases: number
          overdue_cases: number
          total_cases: number
          total_estimated_penalties: number
          unread_notifications: number
        }[]
      }
      open_eligible_cases: {
        Args: { requested_period_key: string; requested_tenant_id: string }
        Returns: {
          assessment_id: string
          closed_at: string | null
          created_at: string
          current_step_id: string | null
          id: string
          obligation_version_id: string
          opened_at: string
          period_key: string
          status: string
          tenant_id: string
          updated_at: string
          workflow_template_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "compliance_cases"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      record_case_system_event: {
        Args: { requested_event_code: string; requested_payload?: Json; requested_task_id: string }
        Returns: {
          assessment_id: string
          closed_at: string | null
          created_at: string
          current_step_id: string | null
          id: string
          obligation_version_id: string
          opened_at: string
          period_key: string
          status: string
          tenant_id: string
          updated_at: string
          workflow_template_id: string
        }
      }
      approve_obligation_review: {
        Args: { requested_note: string; requested_review_id: string }
        Returns: {
          created_at: string
          decision_note: string | null
          id: string
          obligation_version_id: string
          reviewed_at: string | null
          reviewer_id: string | null
          status: string
          submitted_at: string
          submitted_by: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "obligation_review_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reject_obligation_review: {
        Args: { requested_note: string; requested_review_id: string }
        Returns: {
          created_at: string
          decision_note: string | null
          id: string
          obligation_version_id: string
          reviewed_at: string | null
          reviewer_id: string | null
          status: string
          submitted_at: string
          submitted_by: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "obligation_review_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_obligation_review: {
        Args: { requested_review_id: string }
        Returns: {
          created_at: string
          decision_note: string | null
          id: string
          obligation_version_id: string
          reviewed_at: string | null
          reviewer_id: string | null
          status: string
          submitted_at: string
          submitted_by: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "obligation_review_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_obligation_version_for_review: {
        Args: { requested_version_id: string }
        Returns: {
          created_at: string
          decision_note: string | null
          id: string
          obligation_version_id: string
          reviewed_at: string | null
          reviewer_id: string | null
          status: string
          submitted_at: string
          submitted_by: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "obligation_review_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      withdraw_obligation_review: {
        Args: { requested_note?: string; requested_review_id: string }
        Returns: {
          created_at: string
          decision_note: string | null
          id: string
          obligation_version_id: string
          reviewed_at: string | null
          reviewer_id: string | null
          status: string
          submitted_at: string
          submitted_by: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "obligation_review_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transition_obligation_version_status: {
        Args: { requested_status: string; requested_version_id: string }
        Returns: {
          audience_summary: string | null
          created_at: string
          created_by: string
          deadline_rule: Json
          effective_from: string | null
          effective_to: string | null
          id: string
          legal_reference: string | null
          obligation_id: string
          penalty_rule: Json
          published_at: string | null
          published_by: string | null
          recurrence_rule: Json
          source_url: string | null
          status: string
          updated_at: string
          version_number: number
        }
        SetofOptions: {
          from: "*"
          to: "obligation_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      publish_circular_and_notify: {
        Args: { requested_action_url?: string; requested_circular_id: string }
        Returns: number
      }
      publish_obligation_version: {
        Args: { requested_version_id: string }
        Returns: {
          audience_summary: string | null
          created_at: string
          created_by: string
          deadline_rule: Json
          effective_from: string | null
          effective_to: string | null
          id: string
          legal_reference: string | null
          obligation_id: string
          penalty_rule: Json
          published_at: string | null
          published_by: string | null
          recurrence_rule: Json
          source_url: string | null
          status: string
          updated_at: string
          version_number: number
        }
        SetofOptions: {
          from: "*"
          to: "obligation_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_case_event: {
        Args: {
          requested_amount?: number
          requested_case_id: string
          requested_description?: string
          requested_event_type: string
          requested_metadata?: Json
          requested_occurred_at: string
          requested_reference_number?: string
          requested_title: string
        }
        Returns: {
          amount: number | null
          case_id: string
          created_at: string
          description: string | null
          event_type: string
          id: string
          metadata: Json
          occurred_at: string
          recorded_by: string
          reference_number: string | null
          title: string
        }
        SetofOptions: {
          from: "*"
          to: "case_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_tenant_profile: {
        Args: {
          p_activity_codes?: string[]
          p_annual_revenue?: number
          p_branch_count?: number
          p_contract_types?: string[]
          p_custom_attributes?: Json
          p_employee_count?: number
          p_has_active_contracts?: boolean
          p_legal_form?: string
          p_pays_salaries?: boolean
          p_primary_activity?: string
          p_tax_registration_status?: string
          p_tenant_id: string
          p_valid_from: string
          p_vat_registration_status?: string
        }
        Returns: {
          activity_codes: string[]
          annual_revenue: number | null
          branch_count: number
          contract_types: string[]
          created_at: string
          created_by: string
          custom_attributes: Json
          employee_count: number
          has_active_contracts: boolean
          id: string
          legal_form: string | null
          pays_salaries: boolean
          primary_activity: string | null
          tax_registration_status: string
          tenant_id: string
          valid_from: string
          valid_to: string | null
          vat_registration_status: string
        }
        SetofOptions: {
          from: "*"
          to: "tenant_profile_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      schedule_deadline_notifications: {
        Args: { requested_now?: string }
        Returns: number
      }
      set_case_deadline: {
        Args: {
          requested_case_id: string
          requested_deadline_type: string
          requested_due_at: string
          requested_reason?: string
          requested_source_circular_id?: string
          requested_workflow_step_id: string
        }
        Returns: {
          case_id: string
          created_at: string
          created_by: string
          deadline_type: string
          due_at: string
          id: string
          reason: string | null
          source_circular_id: string | null
          workflow_step_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "case_deadlines"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
