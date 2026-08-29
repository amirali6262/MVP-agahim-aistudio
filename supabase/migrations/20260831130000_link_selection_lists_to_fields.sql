-- ==========================================================================
-- Migration: Connect selection lists to field definitions (Phase 2 + 3)
-- Date: 2026-08-31
-- Purpose: (Phase 2) A SELECT / MULTI_SELECT field may source its options from
--          the central selection-lists library instead of inline option rows.
--          (Phase 3) A field may carry a shared typed condition rule model
--          (stored as JSONB) produced by the common ConditionBuilder, enabling
--          the company-info wizard's conditional display/eligibility wiring.
-- ==========================================================================

begin;

alter table public.company_field_definitions
  add column if not exists selection_list_id uuid
    references public.selection_lists(id) on delete set null;

alter table public.company_field_definitions
  add column if not exists condition_model jsonb;

-- A SELECT/MULTI_SELECT field may be linked to a list; any other field type
-- must not carry a list reference (kept as a soft check, not enforced by fk).
create index company_field_definitions_selection_list_idx
  on public.company_field_definitions(selection_list_id)
  where selection_list_id is not null;

commit;