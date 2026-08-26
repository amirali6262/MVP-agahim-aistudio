-- Migration: Add remaining tables to remove mockDb dependency
-- This migration creates all tables needed by the frontend that currently only exist in mockDb.

BEGIN;

-- 1. Tenant Fiscal Years (سال‌های مالی شرکت)
CREATE TABLE IF NOT EXISTS tenant_fiscal_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  start_date text NOT NULL,
  end_date text NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('ACTIVE', 'CLOSED', 'DRAFT')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tenant_fiscal_years_tenant ON tenant_fiscal_years(tenant_id);

-- 2. Corporate Tax Filings (اظهارنامه مالیات بر عملکرد)
CREATE TABLE IF NOT EXISTS corporate_tax_filings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  fiscal_year text NOT NULL,
  status text NOT NULL DEFAULT 'ثبت‌نام اولیه',
  tracking_number text,
  submission_date text,
  taxable_income text,
  tax_amount text,
  notes text,
  stage_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_corporate_tax_filings_tenant ON corporate_tax_filings(tenant_id);

-- 3. VAT Tax Filings (اظهارنامه ارزش افزوده)
CREATE TABLE IF NOT EXISTS vat_tax_filings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period text NOT NULL,
  status text NOT NULL DEFAULT 'ثبت‌نام اولیه',
  tracking_number text,
  submission_date text,
  sales_amount text,
  purchase_amount text,
  vat_amount text,
  notes text,
  stage_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vat_tax_filings_tenant ON vat_tax_filings(tenant_id);

-- 4. Checklist Templates (قالب‌های چک‌لیست)
CREATE TABLE IF NOT EXISTS checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text DEFAULT 'GENERAL',
  sections jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Tenant Checklist Progress (پیشرفت چک‌لیست شرکت‌ها)
CREATE TABLE IF NOT EXISTS tenant_checklist_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  checklist_template_id uuid NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  fiscal_year text NOT NULL,
  completed_items jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'NOT_STARTED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, checklist_template_id, fiscal_year)
);

-- 6. Commercial Book Periods (دوره‌های دفاتر تجاری)
CREATE TABLE IF NOT EXISTS commercial_book_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  period_type text NOT NULL DEFAULT 'MONTHLY',
  start_date text NOT NULL,
  end_date text NOT NULL,
  status text DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED', 'DRAFT')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_commercial_book_periods_tenant ON commercial_book_periods(tenant_id);

-- 7. Tenant Obligation Fulfillments (وضعیت اجرای تعهدات شرکت)
CREATE TABLE IF NOT EXISTS tenant_obligation_fulfillments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  obligation_id uuid NOT NULL,
  status text DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'NOT_REQUIRED')),
  completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, obligation_id)
);

-- 8. Deadline Extensions (تمدید مهلت‌ها)
CREATE TABLE IF NOT EXISTS deadline_extensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obligation_id uuid NOT NULL,
  obligation_title text NOT NULL,
  fiscal_year text NOT NULL,
  extension_type text NOT NULL,
  old_deadline text NOT NULL,
  new_deadline text NOT NULL,
  reason text NOT NULL,
  status text DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  requested_by uuid REFERENCES auth.users(id),
  approved_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 9. RLS Policies for all new tables
ALTER TABLE tenant_fiscal_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE corporate_tax_filings ENABLE ROW LEVEL SECURITY;
ALTER TABLE vat_tax_filings ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_checklist_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_book_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_obligation_fulfillments ENABLE ROW LEVEL SECURITY;
ALTER TABLE deadline_extensions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated read for all
CREATE POLICY "Authenticated read tenant_fiscal_years" ON tenant_fiscal_years FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read corporate_tax_filings" ON corporate_tax_filings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read vat_tax_filings" ON vat_tax_filings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read checklist_templates" ON checklist_templates FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read tenant_checklist_progress" ON tenant_checklist_progress FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read commercial_book_periods" ON commercial_book_periods FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read tenant_obligation_fulfillments" ON tenant_obligation_fulfillments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read deadline_extensions" ON deadline_extensions FOR SELECT USING (auth.role() = 'authenticated');

-- Allow tenant owner/admin write
CREATE POLICY "Tenant owner write tenant_fiscal_years" ON tenant_fiscal_years FOR ALL USING (
  EXISTS (SELECT 1 FROM user_tenants ut WHERE ut.tenant_id = tenant_fiscal_years.tenant_id AND ut.user_id = auth.uid() AND ut.role IN ('OWNER', 'ADMIN'))
);
CREATE POLICY "Tenant owner write corporate_tax_filings" ON corporate_tax_filings FOR ALL USING (
  EXISTS (SELECT 1 FROM user_tenants ut WHERE ut.tenant_id = corporate_tax_filings.tenant_id AND ut.user_id = auth.uid() AND ut.role IN ('OWNER', 'ADMIN'))
);
CREATE POLICY "Tenant owner write vat_tax_filings" ON vat_tax_filings FOR ALL USING (
  EXISTS (SELECT 1 FROM user_tenants ut WHERE ut.tenant_id = vat_tax_filings.tenant_id AND ut.user_id = auth.uid() AND ut.role IN ('OWNER', 'ADMIN'))
);
CREATE POLICY "Authenticated write checklist_templates" ON checklist_templates FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Tenant owner write tenant_checklist_progress" ON tenant_checklist_progress FOR ALL USING (
  EXISTS (SELECT 1 FROM user_tenants ut WHERE ut.tenant_id = tenant_checklist_progress.tenant_id AND ut.user_id = auth.uid() AND ut.role IN ('OWNER', 'ADMIN'))
);
CREATE POLICY "Tenant owner write commercial_book_periods" ON commercial_book_periods FOR ALL USING (
  EXISTS (SELECT 1 FROM user_tenants ut WHERE ut.tenant_id = commercial_book_periods.tenant_id AND ut.user_id = auth.uid() AND ut.role IN ('OWNER', 'ADMIN'))
);
CREATE POLICY "Tenant owner write tenant_obligation_fulfillments" ON tenant_obligation_fulfillments FOR ALL USING (
  EXISTS (SELECT 1 FROM user_tenants ut WHERE ut.tenant_id = tenant_obligation_fulfillments.tenant_id AND ut.user_id = auth.uid() AND ut.role IN ('OWNER', 'ADMIN'))
);
CREATE POLICY "Authenticated write deadline_extensions" ON deadline_extensions FOR ALL USING (auth.role() = 'authenticated');

-- Platform admin write for all
CREATE POLICY "Platform admin all tenant_fiscal_years" ON tenant_fiscal_years FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'PLATFORM_ADMIN')
);
CREATE POLICY "Platform admin all corporate_tax_filings" ON corporate_tax_filings FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'PLATFORM_ADMIN')
);
CREATE POLICY "Platform admin all vat_tax_filings" ON vat_tax_filings FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'PLATFORM_ADMIN')
);
CREATE POLICY "Platform admin all checklist_templates" ON checklist_templates FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'PLATFORM_ADMIN')
);
CREATE POLICY "Platform admin all tenant_checklist_progress" ON tenant_checklist_progress FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'PLATFORM_ADMIN')
);
CREATE POLICY "Platform admin all commercial_book_periods" ON commercial_book_periods FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'PLATFORM_ADMIN')
);
CREATE POLICY "Platform admin all tenant_obligation_fulfillments" ON tenant_obligation_fulfillments FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'PLATFORM_ADMIN')
);
CREATE POLICY "Platform admin all deadline_extensions" ON deadline_extensions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'PLATFORM_ADMIN')
);

COMMIT;
