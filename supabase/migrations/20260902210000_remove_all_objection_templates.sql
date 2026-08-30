-- ==========================================================================
-- Migration: remove ALL objection templates (empty the objection template data)
-- Date: 2026-09-02
-- Purpose: Per product decision, the platform must start with NO objection
--          templates. Both the seeded legal stage catalog (tax_objection_stages
--          + tax_stage_transitions) and any custom templates
--          (objection_templates + objection_steps + objection_step_transitions)
--          are deleted. The tables themselves stay (admins can create new
--          templates from the objection page).
-- ==========================================================================

begin;

-- Child rows first (FK order): transitions/steps depend on templates.
delete from public.objection_step_transitions;
delete from public.objection_steps;
delete from public.objection_templates;
delete from public.tax_stage_transitions;
delete from public.tax_objection_stages;

-- Central key-registry entries for the deleted stages would dangle; remove
-- the objection-step keys registered against tax_objection_stages.
delete from public.system_key_registry
where source_table = 'tax_objection_stages';

commit;
