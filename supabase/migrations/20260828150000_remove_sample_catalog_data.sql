-- ==========================================================================
-- Migration: Remove sample/test catalog data
-- Date: 2026-08-28
-- Purpose: Remove the "sample" obligation catalog seeded by
--         20260818173000_seed_corporate_tax_studio_sample.sql.
--         That migration created a DRAFT placeholder catalog (CORPORATE_INCOME_TAX
--         + DIRECT_TAX family + workflow template/steps/transitions + eligibility
--         rules) explicitly marked "نمونه اولیه" / "نیازمند تأیید حقوقی".
--         It is sample/test data, not referenced by any real case: the frontend
--         reads `obligations`, and no code references these sample codes.
--
--         Per project rule 15, physical deletion of legal records is forbidden,
--         so the sample records are DEACTIVATED. RLS filters `is_active OR admin`,
--         therefore the sample disappears from the public catalog while nothing
--         is destroyed. Both columns/constraints have been verified against the
--         existing schema (obligations.is_active, obligation_families.is_active,
--         obligation_versions.status enum does NOT include "ARCHIVED", so version
--         status is left untouched). The migration is idempotent.
-- ==========================================================================

BEGIN;

-- 1) Deactivate the sample obligation itself (hides it from the public catalog).
UPDATE public.obligations o
SET is_active = false, updated_at = now()
WHERE o.code = 'CORPORATE_INCOME_TAX'
  AND o.is_active = true;

-- 2) Deactivate the sample obligation family, only if it no longer backs any
--    active obligation (safe even if other real obligations were added under it).
UPDATE public.obligation_families f
SET is_active = false, updated_at = now()
WHERE f.code = 'DIRECT_TAX'
  AND f.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.obligations o
    WHERE o.family_id = f.id AND o.is_active = true
  );

COMMIT;