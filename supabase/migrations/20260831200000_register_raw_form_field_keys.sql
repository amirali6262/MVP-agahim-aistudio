-- =============================================================================
-- Migration: Register scoped raw form-field keys in the central key registry
-- Date: 2026-08-31
-- Purpose: Workflow and objection step fields keep a SHORT raw key (e.g.
--          `tracking_code`) inside their JSON form_schema. That raw value is
--          referenced by the eligibility engine and must never change. Here we
--          backfill a central registry row for every such key under a
--          namespaced full key (module.entity.scope.raw) WITHOUT touching the
--          stored raw value. New/edited step fields are kept in sync at save
--          time from the frontend via lib/systemKeys.registerRawScopedKey.
--          Idempotent; safe to apply on an existing production database.
-- =============================================================================

begin;

-- ── workflow_steps ──────────────────────────────────────────────────────────
do $$
declare
  r record;
  f record;
  v_raw  text;
  v_slug text;
  v_full text;
begin
  if to_regclass('public.workflow_steps') is null then
    return;
  end if;
  for r in
    select id, code, form_schema from public.workflow_steps
  loop
    if r.form_schema is null or jsonb_typeof(r.form_schema->'fields') <> 'array' then
      continue;
    end if;
    for f in
      select value from jsonb_array_elements(r.form_schema->'fields') value
    loop
      v_raw := lower(btrim(coalesce(f.value->>'key', '')));
      if v_raw = '' or v_raw !~ '^[a-z][a-z0-9_]*$' then
        continue;
      end if;
      v_slug := lower(btrim(coalesce(r.code, '')));
      v_slug := regexp_replace(v_slug, '[^a-z0-9_]', '_', 'g');
      -- Every full_key segment must start with a lowercase letter (enforced by
      -- system_key_registry_key_check). A UUID starts with a digit, so when the
      -- step has no usable code we disambiguate the scope with a letter prefix.
      if v_slug = '' or v_slug !~ '^[a-z][a-z0-9_]*$' then
        v_slug := 'uuid_' || replace(r.id::text, '-', '');
      end if;
      v_full := 'workflow.step.' || v_slug || '.' || v_raw;
      insert into public.system_key_registry
        (full_key, title_fa, entity_type, module, form_name, form_id, source_table, status)
      values
        (v_full, coalesce(f.value->>'label', ''), 'WORKFLOW_STEP', 'workflow',
         'workflow_steps', r.id, 'workflow_steps', 'DRAFT')
      on conflict ((lower(full_key))) do nothing;
    end loop;
  end loop;
end $$;

-- ── tax_objection_stages ────────────────────────────────────────────────────
do $$
declare
  r record;
  f record;
  v_raw  text;
  v_slug text;
  v_full text;
begin
  if to_regclass('public.tax_objection_stages') is null then
    return;
  end if;
  for r in
    select id, form_schema from public.tax_objection_stages
  loop
    if r.form_schema is null or jsonb_typeof(r.form_schema->'fields') <> 'array' then
      continue;
    end if;
    for f in
      select value from jsonb_array_elements(r.form_schema->'fields') value
    loop
      v_raw := lower(btrim(coalesce(f.value->>'key', '')));
      if v_raw = '' or v_raw !~ '^[a-z][a-z0-9_]*$' then
        continue;
      end if;
      -- Scope is disambiguated by the stage id. A UUID segment starts with a
      -- digit, which violates system_key_registry_key_check, so it is encoded
      -- under a letter-leading prefix (uuid_<hex>). Stored raw value is untouched.
      v_slug := 'uuid_' || replace(r.id::text, '-', '');
      v_full := 'objection.step.' || v_slug || '.' || v_raw;
      insert into public.system_key_registry
        (full_key, title_fa, entity_type, module, form_name, form_id, source_table, status)
      values
        (v_full, coalesce(f.value->>'label', ''), 'OBJECTION_STEP', 'objection',
         'tax_objection_stages', r.id, 'tax_objection_stages', 'DRAFT')
      on conflict ((lower(full_key))) do nothing;
    end loop;
  end loop;
end $$;

commit;