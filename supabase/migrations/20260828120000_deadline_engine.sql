-- ==========================================================================
-- Migration: Deadline engine — Iranian calendar-aware rule computation
-- Date: 2026-08-28
-- Purpose: Deterministic, auditable deadline computation for tax
--          litigation. Replaces the approximate business-days counter
--          with full calendar-day deadlines that roll the final day
--          forward to the next working day when it falls on a public
--          holiday (mirroring articles 444/445 of the Civil Procedure
--          Code and the valid guidance that backs articles 238/247).
--          Computation stays UTC-backed; display remains Solar Hijri.
-- No taxpayer, case, payment or amount is created.
-- ==========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Deadline rules (نسخه‌پذیر و قابل کنترل)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.deadline_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  title_fa text NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  base_year integer,
  effective_from date NOT NULL,
  effective_to date,
  duration_days integer NOT NULL,
  duration_unit text NOT NULL DEFAULT 'روز تقویمی',
  excludes_start_day boolean NOT NULL DEFAULT true,
  excludes_end_day boolean NOT NULL DEFAULT false,
  roll_holiday_end boolean NOT NULL DEFAULT true,
  weekdays_off integer[] NOT NULL DEFAULT ARRAY[6,0],
  calendar_for_display text NOT NULL DEFAULT 'iran_solar',
  anchor text,
  notes_fa text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deadline_rules_duration_positive CHECK (duration_days > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_deadline_rules_code_active
  ON public.deadline_rules(code) WHERE is_active = true;

COMMENT ON TABLE public.deadline_rules IS
  'قواعد مهلت قانونی نسخه‌پذیر؛ مبنای محاسبه خودکار پایان مهلت در تقویم رسمی ایران.';

INSERT INTO public.deadline_rules
  (code, title_fa, keywords, effective_from, duration_days, excludes_start_day, roll_holiday_end, weekdays_off, notes_fa, is_active)
VALUES
  ('OBJECTION_TO_ASSESSMENT', 'مهلت اعتراض به برگ تشخیص', ARRAY['اعتراض', 'ماده ۲۳۸', '۲۳۸', 'برگ تشخیص'], '2025-01-01', 30, true, true, ARRAY[6,0], 'ماده ۲۳۸ ق.م.م و مواد ۴۴۴/۴۴۵ آیین دادرسی مدنی؛ روز ابلاغ محاسبه نمی‌شود و اگر روز آخر تعطیل باشد به اولین روز کاری بعد منتقل می‌شود.', true),
  ('ARTICLE_238_REVIEW', 'مهلت رسیدگی مجدد ماده ۲۳۸', ARRAY['رسیدگی', '۲۳۸', '۴۵ روز', 'اداره'], '2025-01-01', 45, true, true, ARRAY[6,0], 'حداکثر ۴۵ روز از تاریخ ثبت اعتراض معتبر (نه تاریخ ارجاع داخلی).', true),
  ('APPEAL_TO_PRIMARY_DECISION', 'مهلت اعتراض به رأی هیأت بدوی', ARRAY['اعتراض', 'ماده ۲۴۷', '۲۴۷', 'هیأت بدوی'], '2025-01-01', 20, true, true, ARRAY[6,0], 'ماده ۲۴۷ ق.م.م؛ ۲۰ روز از تاریخ ابلاغ معتبر رأی بدوی.', true),
  ('PRIMARY_BOARD_SESSION_GAP', 'فاصله ابلاغ دعوت‌نامه تا جلسه هیأت بدوی', ARRAY['جلسه', 'هیأت', 'دعوت‌نامه', 'ماده ۲۴۶'], '2025-01-01', 10, true, true, ARRAY[6,0], 'ماده ۲۴۶ ق.م.م؛ روز ابلاغ و روز جلسه جزء مدت نیست؛ جلسه با فاصله کمتر فقط با درخواست کتبی مؤدی و موافقت مدیر دادرسی.', true),
  ('FINAL_TAX_PAYMENT', 'مهلت پرداخت مالیات قطعی', ARRAY['پرداخت', 'ماده ۲۱۰', '۲۱۰', 'برگ قطعی'], '2025-01-01', 10, true, true, ARRAY[6,0], 'ماده ۲۱۰ ق.م.م؛ از تاریخ ابلاغ برگ قطعی.', true)
ON CONFLICT (code) DO UPDATE SET
  title_fa = EXCLUDED.title_fa,
  keywords = EXCLUDED.keywords,
  effective_from = EXCLUDED.effective_from,
  duration_days = EXCLUDED.duration_days,
  excludes_start_day = EXCLUDED.excludes_start_day,
  roll_holiday_end = EXCLUDED.roll_holiday_end,
  weekdays_off = EXCLUDED.weekdays_off,
  notes_fa = EXCLUDED.notes_fa,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 2. Core function: compute deadline end date (calendar days + holiday roll)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION compute_deadline_end(
  p_start_date date,
  p_rule_id uuid
) RETURNS date AS $$
DECLARE
  v_rule public.deadline_rules%ROWTYPE;
  v_end date;
  v_days integer;
BEGIN
  SELECT * INTO v_rule FROM public.deadline_rules WHERE id = p_rule_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deadline rule % not found', p_rule_id;
  END IF;

  -- Calendar-day deadline: start is excluded, so the operative window is
  -- the N calendar days strictly after the anchor date (materials 444/445).
  v_days := v_rule.duration_days;
  IF v_rule.excludes_start_day THEN
    v_end := p_start_date + 1 + v_days;  -- روز شروع جزء مهلت نیست
  ELSE
    v_end := p_start_date + v_days;
  END IF;

  -- Holidays/non-working days INSIDE the window do not suspend the count
  -- (it is a calendar deadline). Only if the terminal day itself lands on
  -- a weekend or public holiday is it rolled forward to the next working
  -- day.
  IF v_rule.roll_holiday_end THEN
    WHILE EXTRACT(DOW FROM v_end) = ANY (v_rule.weekdays_off)
       OR EXISTS (SELECT 1 FROM public.iran_holidays WHERE holiday_date = v_end) LOOP
      v_end := v_end + 1;
    END LOOP;
  END IF;

  RETURN v_end;
END;
$$ LANGUAGE plpgsql STABLE;

-- ---------------------------------------------------------------------------
-- 3. Helper: apply deadline to a case and persist to tax_deadline_history
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION apply_case_deadline(
  p_tax_case_id uuid,
  p_rule_code text,
  p_start_date date
) RETURNS uuid AS $$
DECLARE
  v_rule public.deadline_rules%ROWTYPE;
  v_end date;
  v_original_end date;
  v_holidays text[] := '{}';
  v_hist_id uuid;
  v_reminders timestamptz[] := '{}';
  v_iter date;
  v_h text;
BEGIN
  SELECT * INTO v_rule FROM public.deadline_rules
    WHERE code = p_rule_code AND is_active = true
    ORDER BY effective_from DESC NULLS LAST
    LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active deadline rule % not found', p_rule_code;
  END IF;

  v_end := compute_deadline_end(p_start_date, v_rule.id);
  v_original_end := v_end;

  -- Collect holidays that fall within the operative span (for audit)
  FOR v_iter IN SELECT d FROM generate_series(p_start_date, (p_start_date + v_rule.duration_days + 5)::date) d LOOP
    SELECT title_fa INTO v_h FROM public.iran_holidays WHERE holiday_date = v_iter;
    IF v_h IS NOT NULL THEN
      v_holidays := array_append(v_holidays, v_iter::text || ':' || v_h);
    END IF;
  END LOOP;

  -- Reminder schedule: start, 15/10/7/5/3/2/1 days before, and expiration
  v_reminders := ARRAY[
    p_start_date::timestamptz,
    (p_start_date + v_rule.duration_days - 15)::timestamptz,
    (p_start_date + v_rule.duration_days - 10)::timestamptz,
    (p_start_date + v_rule.duration_days - 7)::timestamptz,
    (p_start_date + v_rule.duration_days - 5)::timestamptz,
    (p_start_date + v_rule.duration_days - 3)::timestamptz,
    (p_start_date + v_rule.duration_days - 2)::timestamptz,
    (p_start_date + v_rule.duration_days - 1)::timestamptz,
    v_original_end::timestamptz
  ];

  INSERT INTO public.tax_deadline_history (
    tax_case_id, deadline_type, step_code, start_date,
    original_end_date, adjusted_end_date,
    calendar_used, holidays_applied, status,
    extension_reason, is_within_deadline, reminder_dates
  ) VALUES (
    p_tax_case_id, v_rule.code, NULL, p_start_date::timestamptz,
    v_original_end::timestamptz, v_end::timestamptz,
    v_rule.calendar_for_display, v_holidays, 'active',
    NULL, true, v_reminders
  ) RETURNING id INTO v_hist_id;

  RETURN v_hist_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant usage to the authenticated role
GRANT EXECUTE ON FUNCTION public.compute_deadline_end(date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_case_deadline(uuid, text, date) TO authenticated;

COMMIT;