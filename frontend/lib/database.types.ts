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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
