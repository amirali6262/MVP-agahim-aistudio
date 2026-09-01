begin;

-- The three required dates are Gregorian equivalents of Jalali fiscal-year ends.
do $$
begin
  if public.rule_center_calc_jalali_month_operator('2026-03-20', 4, 'END_OF_NTH_MONTH_AFTER_EVENT') <> '2026-07-22' then
    raise exception 'Jalali month-end case 1 failed';
  end if;
  if public.rule_center_calc_jalali_month_operator('2025-09-22', 4, 'END_OF_NTH_MONTH_AFTER_EVENT') <> '2025-12-21' then
    raise exception 'Jalali month-end case 2 failed';
  end if;
  if public.rule_center_calc_jalali_month_operator('2027-03-20', 4, 'END_OF_NTH_MONTH_AFTER_EVENT') <> '2027-07-23' then
    raise exception 'Jalali month-end case 3 failed';
  end if;
end $$;

rollback;
