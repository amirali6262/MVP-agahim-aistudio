-- ==========================================================================
-- Migration: Company fiscal years wired to obligation cases
-- Date: 2026-08-30
-- Purpose: Reuse the existing `tenant_fiscal_years` table and connect each
--          obligation case to exactly one fiscal year. The fiscal year is a
--          company-level, system field (never stored inside per-step form
--          responses). All steps of a case inherit the same fiscal year.
--          Dates are stored as zero-padded Jalali "YYYY/MM/DD" text, which
--          sorts chronologically, so string comparison is used for overlap
--          and range checks.
-- ==========================================================================

begin;

-- --------------------------------------------------------------------------
-- 0. Round out `tenant_fiscal_years` with the fields the management page needs.
-- --------------------------------------------------------------------------
alter table public.tenant_fiscal_years
  add column if not exists notes text,
  add column if not exists created_by uuid references auth.users(id) on delete restrict;

alter table public.tenant_fiscal_years alter column created_by set default auth.uid();

-- --------------------------------------------------------------------------
-- 1. Link a fiscal year to each obligation case (nullable for legacy rows).
-- --------------------------------------------------------------------------
alter table public.compliance_cases
  add column if not exists fiscal_year_id uuid
  references public.tenant_fiscal_years(id) on delete restrict;

create index if not exists compliance_cases_fiscal_year_idx
  on public.compliance_cases(fiscal_year_id);

-- --------------------------------------------------------------------------
-- 2. Server-side integrity guards on `tenant_fiscal_years`.
--    * reject inverted date ranges,
--    * reject overlapping periods within the same company,
--    * a period already used by a case can only be closed/edited, not
--      re-titled/re-dated,
--    * a period already used by a case cannot be deleted.
-- --------------------------------------------------------------------------
create or replace function private.fiscal_year_write_guard()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
declare
  used boolean;
  conflict_row public.tenant_fiscal_years;
begin
  used := exists (
    select 1 from public.compliance_cases c
    where c.fiscal_year_id = coalesce(new.id, old.id)
  );

  if tg_op in ('INSERT', 'UPDATE') then
    if coalesce(new.end_date, '') < coalesce(new.start_date, '') then
      raise exception 'پایان دوره مالی باید بعد از شروع آن باشد'
        using errcode = '22023';
    end if;

    select t.* into conflict_row
    from public.tenant_fiscal_years t
    where t.tenant_id = new.tenant_id
      and t.id <> new.id
      and t.start_date <= new.end_date
      and new.start_date <= t.end_date
    limit 1;
    if conflict_row.id is not null then
      raise exception 'دوره مالی با دوره دیگری هم‌پوشانی دارد'
        using errcode = 'P0001';
    end if;
  end if;

  if tg_op = 'UPDATE' and used then
    if new.title is distinct from old.title
       or new.start_date is distinct from old.start_date
       or new.end_date is distinct from old.end_date then
      raise exception 'دوره مالی استفاده‌شده در تعهدات فقط قابل بستن است'
        using errcode = '23514';
    end if;
  end if;

  if tg_op = 'DELETE' and used then
    raise exception 'دوره مالی استفاده‌شده در تعهدات قابل حذف نیست'
      using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.fiscal_year_write_guard()
  from public, anon, authenticated, service_role;

drop trigger if exists tenant_fiscal_years_write_guard on public.tenant_fiscal_years;
create trigger tenant_fiscal_years_write_guard
  before insert or update or delete on public.tenant_fiscal_years
  for each row execute function private.fiscal_year_write_guard();

-- --------------------------------------------------------------------------
-- 3. Assign (or change) the fiscal year of an obligation case.
--    Security-definer with explicit checks: membership, company match,
--    reject closed periods, and block any change once a step has progressed.
-- --------------------------------------------------------------------------
create or replace function public.set_case_fiscal_year(
  p_case_id uuid,
  p_fiscal_year_id uuid
)
returns public.compliance_cases
language plpgsql
set search_path = pg_catalog
as $$
declare
  uid uuid := auth.uid();
  selected_case public.compliance_cases;
  selected_year public.tenant_fiscal_years;
begin
  if uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into selected_case from public.compliance_cases where id = p_case_id for update;
  if selected_case.id is null then
    raise exception 'case not found' using errcode = '22023';
  end if;
  if not private.is_tenant_member(selected_case.tenant_id) then
    raise exception 'tenant membership required' using errcode = '42501';
  end if;

  if p_fiscal_year_id is null then
    raise exception 'fiscal year required' using errcode = '22023';
  end if;
  select * into selected_year from public.tenant_fiscal_years where id = p_fiscal_year_id;
  if selected_year.id is null then
    raise exception 'fiscal year not found' using errcode = '22023';
  end if;
  if selected_year.tenant_id <> selected_case.tenant_id then
    raise exception 'fiscal year does not belong to this company' using errcode = '42501';
  end if;
  if selected_year.status = 'CLOSED' then
    raise exception 'دوره مالی بسته‌شده قابل انتخاب نیست' using errcode = '22023';
  end if;

  -- A fiscal year cannot change once any step has been completed/submitted/approved
  -- or the case itself has reached a final status.
  if selected_case.status in ('COMPLETED', 'SUBMITTED', 'APPROVED', 'FINALIZED', 'CANCELLED')
     or exists (
       select 1 from public.case_tasks t
       where t.case_id = selected_case.id
         and t.status in ('COMPLETED', 'SUBMITTED', 'APPROVED', 'FINALIZED')
     ) then
    raise exception 'سال مالی این تعهد پس از پیشبرد مراحل قابل تغییر نیست'
      using errcode = '23514';
  end if;

  update public.compliance_cases
    set fiscal_year_id = p_fiscal_year_id,
        updated_at = now()
    where id = selected_case.id
  returning * into selected_case;
  return selected_case;
end;
$$;
revoke all on function public.set_case_fiscal_year(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.set_case_fiscal_year(uuid, uuid) to authenticated;

commit;