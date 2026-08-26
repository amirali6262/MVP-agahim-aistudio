-- ==========================================================================
-- Migration: Add remaining tables needed to replace mockDb with Supabase
-- Date: 2026-08-26
-- Purpose: Ensure all tables exist for complete mockDb removal
-- ==========================================================================

BEGIN;

-- 1. Obligations catalog (if not exists from prior migration)
CREATE TABLE IF NOT EXISTS obligation_families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  title text NOT NULL,
  domain text DEFAULT 'مالیات',
  is_active boolean DEFAULT true,
  created_by text DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS obligation_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid REFERENCES obligation_families(id) ON DELETE CASCADE,
  code text UNIQUE NOT NULL,
  title text NOT NULL,
  summary text,
  authority_name text,
  official_action_url text,
  legal_reference text,
  source_url text,
  is_active boolean DEFAULT true,
  created_by text DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Obligation versions
CREATE TABLE IF NOT EXISTS obligation_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obligation_id uuid REFERENCES obligation_definitions(id) ON DELETE CASCADE,
  version_number integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'DRAFT',
  legal_reference text,
  source_url text,
  audience_summary text,
  effective_from date,
  effective_to date,
  recurrence_rule jsonb DEFAULT '{}',
  deadline_rule jsonb DEFAULT '{}',
  penalty_rule jsonb DEFAULT '{}',
  published_at timestamptz,
  published_by text,
  created_by text DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Workflow templates and steps
CREATE TABLE IF NOT EXISTS workflow_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obligation_version_id uuid REFERENCES obligation_versions(id) ON DELETE CASCADE,
  title text NOT NULL,
  created_by text DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workflow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_template_id uuid REFERENCES workflow_templates(id) ON DELETE CASCADE,
  sequence integer NOT NULL DEFAULT 1,
  code text NOT NULL,
  title text NOT NULL,
  actor text DEFAULT 'USER',
  instructions text,
  form_schema jsonb DEFAULT '{"fields":[]}',
  is_optional boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Eligibility rule sets and conditions
CREATE TABLE IF NOT EXISTS eligibility_rule_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obligation_version_id uuid REFERENCES obligation_versions(id) ON DELETE CASCADE,
  priority integer NOT NULL DEFAULT 1,
  title text NOT NULL,
  outcome text NOT NULL,
  explanation text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS eligibility_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_set_id uuid REFERENCES eligibility_rule_sets(id) ON DELETE CASCADE,
  sequence integer NOT NULL DEFAULT 1,
  fact_key text NOT NULL,
  operator text NOT NULL,
  expected_value jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Circulars
CREATE TABLE IF NOT EXISTS obligation_circulars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obligation_version_id uuid REFERENCES obligation_versions(id) ON DELETE CASCADE,
  title text NOT NULL,
  circular_number text,
  source_url text,
  issued_on date,
  summary text,
  status text DEFAULT 'DRAFT',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Deadline extensions
CREATE TABLE IF NOT EXISTS deadline_extensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  obligation_id uuid,
  extension_type text NOT NULL,
  reason text NOT NULL,
  requested_date date,
  approved_date date,
  status text DEFAULT 'PENDING',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 7. Commercial book periods
CREATE TABLE IF NOT EXISTS commercial_book_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  fiscal_year text,
  period_type text,
  status text DEFAULT 'ACTIVE',
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 8. Fulfillments
CREATE TABLE IF NOT EXISTS fulfillments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  obligation_id uuid,
  obligation_version_id uuid,
  status text NOT NULL DEFAULT 'PENDING',
  fulfillment_date date,
  notes text,
  stage_data jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 9. Objection templates (independent from workflow_templates)
CREATE TABLE IF NOT EXISTS objection_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  tax_type text,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS objection_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES objection_templates(id) ON DELETE CASCADE,
  sequence integer NOT NULL DEFAULT 1,
  code text NOT NULL,
  title text NOT NULL,
  actor text DEFAULT 'TAXPAYER',
  gap_value integer DEFAULT 0,
  gap_unit text DEFAULT 'روز',
  base_event text,
  step_nature text DEFAULT 'MANDATORY',
  legal_basis text,
  form_schema jsonb DEFAULT '{"fields":[]}',
  is_optional boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 10. Objection step transitions
CREATE TABLE IF NOT EXISTS objection_step_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id uuid REFERENCES objection_steps(id) ON DELETE CASCADE,
  title text NOT NULL,
  trigger_type text DEFAULT 'USER_ACTION',
  timeout_days integer,
  timeout_desc text,
  target_type text DEFAULT 'STEP',
  target_step_id uuid,
  action_label text,
  legal_reference text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure tenant_id exists on deadline_extensions (created earlier without it by 20260825160000)
ALTER TABLE deadline_extensions ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;

-- Enable RLS on new tables
ALTER TABLE obligation_families ENABLE ROW LEVEL SECURITY;
ALTER TABLE obligation_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE obligation_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE eligibility_rule_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE eligibility_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE obligation_circulars ENABLE ROW LEVEL SECURITY;
ALTER TABLE deadline_extensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_book_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE fulfillments ENABLE ROW LEVEL SECURITY;
ALTER TABLE objection_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE objection_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE objection_step_transitions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: authenticated users can read all, platform admin can write
DO $$ BEGIN
  -- obligation_families
  CREATE POLICY "af_read" ON obligation_families FOR SELECT TO authenticated USING (true);
  CREATE POLICY "af_write" ON obligation_families FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND (role = 'PLATFORM_ADMIN' OR roles @> '"PLATFORM_ADMIN"'))
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  -- obligation_definitions
  CREATE POLICY "od_read" ON obligation_definitions FOR SELECT TO authenticated USING (true);
  CREATE POLICY "od_write" ON obligation_definitions FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND (role = 'PLATFORM_ADMIN' OR roles @> '"PLATFORM_ADMIN"'))
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  -- obligation_versions
  CREATE POLICY "ov_read" ON obligation_versions FOR SELECT TO authenticated USING (true);
  CREATE POLICY "ov_write" ON obligation_versions FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND (role = 'PLATFORM_ADMIN' OR roles @> '"PLATFORM_ADMIN"'))
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  -- workflow_templates
  CREATE POLICY "wt_read" ON workflow_templates FOR SELECT TO authenticated USING (true);
  CREATE POLICY "wt_write" ON workflow_templates FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND (role = 'PLATFORM_ADMIN' OR roles @> '"PLATFORM_ADMIN"'))
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  -- workflow_steps
  CREATE POLICY "ws_read" ON workflow_steps FOR SELECT TO authenticated USING (true);
  CREATE POLICY "ws_write" ON workflow_steps FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND (role = 'PLATFORM_ADMIN' OR roles @> '"PLATFORM_ADMIN"'))
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "ers_read" ON eligibility_rule_sets FOR SELECT TO authenticated USING (true);
  CREATE POLICY "ers_write" ON eligibility_rule_sets FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND (role = 'PLATFORM_ADMIN' OR roles @> '"PLATFORM_ADMIN"'))
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "ec_read" ON eligibility_conditions FOR SELECT TO authenticated USING (true);
  CREATE POLICY "ec_write" ON eligibility_conditions FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND (role = 'PLATFORM_ADMIN' OR roles @> '"PLATFORM_ADMIN"'))
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "oc_read" ON obligation_circulars FOR SELECT TO authenticated USING (true);
  CREATE POLICY "oc_write" ON obligation_circulars FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND (role = 'PLATFORM_ADMIN' OR roles @> '"PLATFORM_ADMIN"'))
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "de_read" ON deadline_extensions FOR SELECT TO authenticated USING (private.is_tenant_member(tenant_id));
  CREATE POLICY "de_write" ON deadline_extensions FOR ALL TO authenticated USING (
    private.has_tenant_role(tenant_id, array['OWNER', 'ADMIN'])
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "cbp_read" ON commercial_book_periods FOR SELECT TO authenticated USING (private.is_tenant_member(tenant_id));
  CREATE POLICY "cbp_write" ON commercial_book_periods FOR ALL TO authenticated USING (
    private.has_tenant_role(tenant_id, array['OWNER', 'ADMIN'])
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "ful_read" ON fulfillments FOR SELECT TO authenticated USING (private.is_tenant_member(tenant_id));
  CREATE POLICY "ful_write" ON fulfillments FOR ALL TO authenticated USING (
    private.has_tenant_role(tenant_id, array['OWNER', 'ADMIN'])
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "objt_read" ON objection_templates FOR SELECT TO authenticated USING (true);
  CREATE POLICY "objt_write" ON objection_templates FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND (role = 'PLATFORM_ADMIN' OR roles @> '"PLATFORM_ADMIN"'))
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "objs_read" ON objection_steps FOR SELECT TO authenticated USING (true);
  CREATE POLICY "objs_write" ON objection_steps FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND (role = 'PLATFORM_ADMIN' OR roles @> '"PLATFORM_ADMIN"'))
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "objst_read" ON objection_step_transitions FOR SELECT TO authenticated USING (true);
  CREATE POLICY "objst_write" ON objection_step_transitions FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND (role = 'PLATFORM_ADMIN' OR roles @> '"PLATFORM_ADMIN"'))
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
