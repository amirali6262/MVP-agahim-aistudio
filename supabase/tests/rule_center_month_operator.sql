begin;

-- ── ماه شمسی: پایان ماه N ام پس از رویداد (نمونه‌های اجباری سند) ──────────
-- ۱۴۰۴/۱۲/۲۹ = 2026-03-20 → ۱۴۰۵/۰۴/۳۱ = 2026-07-22
-- ۱۴۰۴/۰۶/۳۱ = 2025-09-22 → ۱۴۰۴/۱۰/۳۰ = 2026-01-20
-- ۱۴۰۵/۱۲/۲۹ = 2027-03-20 → ۱۴۰۶/۰۴/۳۱ = 2027-07-23
do $$
begin
  if public.rule_center_calc_jalali_month_operator('2026-03-20', 4, 'END_OF_NTH_MONTH_AFTER_EVENT') <> '2026-07-22' then
    raise exception 'Jalali month-end case 1 failed';
  end if;
  if public.rule_center_calc_jalali_month_operator('2025-09-22', 4, 'END_OF_NTH_MONTH_AFTER_EVENT') <> '2026-01-20' then
    raise exception 'Jalali month-end case 2 failed';
  end if;
  if public.rule_center_calc_jalali_month_operator('2027-03-20', 4, 'END_OF_NTH_MONTH_AFTER_EVENT') <> '2027-07-23' then
    raise exception 'Jalali month-end case 3 failed';
  end if;

  -- آغاز ماه N ام پس از رویداد: ۱۴۰۵/۰۴/۰۱ = 2026-06-22
  if public.rule_center_calc_jalali_month_operator('2026-03-20', 4, 'START_OF_NTH_MONTH_AFTER_EVENT') <> '2026-06-22' then
    raise exception 'Jalali month-start case failed';
  end if;

  -- تاریخ متناظر پس از N ماه (رفتار پیشین): ۱۴۰۴/۱۲/۲۹ + ۴ ماه = ۱۴۰۵/۰۴/۲۹ = 2026-07-20
  if public.rule_center_calc_jalali_month_operator('2026-03-20', 4, 'SAME_DAY_AFTER_N_MONTHS') <> '2026-07-20' then
    raise exception 'Jalali same-day case failed';
  end if;
  -- هم‌ارزی با تابع پیشین: رفتار قواعد قدیمی بدون تغییر
  if public.rule_center_calc_jalali_month_operator('2026-03-20', 4, 'SAME_DAY_AFTER_N_MONTHS')
     <> public.rule_center_jalali_add_months('2026-03-20'::date, 4, 'LAST_DAY') then
    raise exception 'SAME_DAY must equal legacy add_months';
  end if;
end $$;

rollback;
