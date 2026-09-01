begin;

create or replace function public.rule_center_calc_jalali_month_operator(
  p_date date,
  p_months integer,
  p_operator text,
  p_missing_policy text default 'LAST_DAY'
) returns date
language plpgsql immutable strict
set search_path = pg_catalog
as $$
declare
  v_jy integer; v_jm integer; v_jd integer; v_total integer;
  v_ny integer; v_nm integer; v_max integer;
  v_result date;
begin
  if p_months < 0 then raise exception 'تعداد ماه نمی‌تواند منفی باشد' using errcode = '22023'; end if;
  select t.y, t.m, t.d into v_jy, v_jm, v_jd
    from public.rule_center_greg_to_jal(extract(year from p_date)::int, extract(month from p_date)::int, extract(day from p_date)::int) t;
  v_total := v_jy * 12 + v_jm - 1 + p_months;
  v_ny := v_total / 12; v_nm := (v_total % 12) + 1;
  v_max := public.rule_center_jalali_month_days(v_ny, v_nm);
  if p_operator = 'END_OF_NTH_MONTH_AFTER_EVENT' then
    v_result := public.rule_center_jalali_to_greg(v_ny, v_nm, v_max);
  elsif p_operator = 'START_OF_NTH_MONTH_AFTER_EVENT' then
    v_result := public.rule_center_jalali_to_greg(v_ny, v_nm, 1);
  elsif p_operator = 'SAME_DAY_AFTER_N_MONTHS' then
    v_result := public.rule_center_jalali_add_months(p_date, p_months, p_missing_policy);
  else
    raise exception 'عملگر ماه پشتیبانی نمی‌شود: %', p_operator using errcode = '22023';
  end if;
  return v_result;
end;
$$;

revoke all on function public.rule_center_calc_jalali_month_operator(date, integer, text, text) from public, anon;
grant execute on function public.rule_center_calc_jalali_month_operator(date, integer, text, text) to authenticated;

create or replace function public.rule_center_delete_test(p_test_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog as $$
begin
  if not private.is_platform_admin() then raise exception 'platform admin required' using errcode = '42501'; end if;
  delete from public.rule_center_tests where id = p_test_id;
end;
$$;
revoke all on function public.rule_center_delete_test(uuid) from public, anon;
grant execute on function public.rule_center_delete_test(uuid) to authenticated;

commit;
