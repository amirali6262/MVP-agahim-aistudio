-- ==========================================================================
-- Integration test: مرکز قواعد مهلت و جریمه (Rule Center)
-- Run only against a development Supabase project (transaction + rollback),
-- after applying all migrations. Every fixture uses reserved test UUIDs and
-- is rolled back. Expected results are hard-coded from the project's own
-- verified date contract (lib/jalaliUtils.ts) and the documented examples —
-- never copied from engine output.
--   Block 1:  non-admin rejected from rule center RPCs
--   Block 2:  deadline rule create + test (10 days after base, exclude start)
--   Block 3:  same rule version used by two obligation versions + one action
--             step, with different inputs — independent results
--   Block 4:  missing base date → PENDING_INPUT (never "today")
--   Block 5:  fiscal-year dependent deadline — two different fiscal years
--   Block 6:  solar month arithmetic — short month / leap year policies
--   Block 7:  working-days count + holiday-end roll (calendar reference)
--   Block 8:  overlapping pauses not double-counted
--   Block 9:  penalty — fixed per-day, start after deadline, excludes first
--             and last day (documented example: 2 days → 200,000 ریال)
--   Block 10: penalty — percent with unknown base → PENDING_INPUT
--   Block 11: tiered penalty bracket vs whole
--   Block 12: published version immutable (direct write rejected)
--   Block 13: ACTIVE connection requires PUBLISHED version
--   Block 14: obligation publish blocked while rule connection not ready
--   Block 15: objection activation blocked with unpublished rule link
--   Block 16: action-step save rejects mapping to a deleted field/action
--   Block 17: RLS — company user cannot write rules, can read published
--   Block 18: new version keeps old version content untouched
-- ==========================================================================

\set ON_ERROR_STOP on
begin;

-- ── Fixtures: admin + regular user ────────────────────────────────────────
insert into auth.users (id, aud, role, email, phone, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous)
values
  ('a2000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'rc-admin@example.invalid', '+989820000001', '{}', '{}', now(), now(), false, false),
  ('a2000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'rc-user@example.invalid',  '+989820000002', '{}', '{}', now(), now(), false, false);

do $$ begin
  if (select count(*) from public.users where id in ('a2000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000002')) <> 2 then
    raise exception 'register trigger did not create profiles';
  end if;
end $$;

update public.users set role = 'PLATFORM_ADMIN'
where id = 'a2000000-0000-0000-0000-000000000001';

-- ── 1) Non-admin rejected ─────────────────────────────────────────────────
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
do $$
begin
  perform public.rule_center_save_rule(null, 'DEADLINE', 'RC_BAD', 'قاعدهٔ غیرمجاز', null, null, null, null, null, 'INTERNAL', null, null, '{}'::jsonb, '[]'::jsonb);
  raise exception 'FAIL: non-admin could save a rule';
exception when insufficient_privilege then null;
end $$;

-- ── 2) Admin creates a deadline rule + runs a test ───────────────────────
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
do $$
declare
  v_rule_id uuid;
  version_id uuid;
  test_id uuid;
  res jsonb;
begin
  v_rule_id := public.rule_center_save_rule(
    null, 'DEADLINE', 'RC_TEST_10DAYS', 'آزمون: ده روز پس از دریافت', 'قاعدهٔ آزمایشی برای آزمون‌های مرکز قواعد',
    null, null, null, null, 'INTERNAL', '2026-01-01', null,
    $j${
      "deadline": {
        "method": "INTERVAL_FROM_BASE",
        "interval": { "value": 10, "unit": "DAY", "direction": "AFTER", "base_input": "base_date" },
        "count": { "include_start": false, "calendar": "CALENDAR_DAYS", "month_calendar": "iran_solar", "missing_day_policy": "LAST_DAY" },
        "holiday_roll": { "enabled": false, "calendar_id": "iran_official" },
        "pauses": [], "extensions": []
      },
      "reminders": []
    }$j$::jsonb,
    $j$[ { "key": "base_date", "label": "تاریخ دریافت", "type": "DATE", "required": true } ]$j$::jsonb
  );
  if v_rule_id is null then raise exception 'FAIL: rule save null'; end if;

  select v.id into version_id from public.rule_center_versions v where v.rule_id = v_rule_id;
  if version_id is null then raise exception 'FAIL: version not created'; end if;

  -- نمونهٔ سند: دریافت در ۱۴۰۵/۰۲/۰۵ (2026-04-25)، روز شروع شمرده نشود → روز دهم ۱۴۰۵/۰۲/۱۵ (2026-05-05)
  test_id := public.rule_center_run_test(
    version_id, '۱۰ روز پس از دریافت',
    $j$ { "base_date": { "value": "2026-04-25", "type": "DATE" } }$j$::jsonb,
    $j$ { "status": "OK", "effective_deadline": "2026-05-05" }$j$::jsonb
  );
  if not exists (select 1 from public.rule_center_tests where id = test_id and status = 'PASS') then
    raise exception 'FAIL: documented 10-day example did not pass';
  end if;

  res := public.rule_center_calc_deadline(version_id, $j$ { "base_date": { "value": "2026-04-25", "type": "DATE" } }$j$::jsonb, 'PREVIEW');
  if (res ->> 'status') <> 'OK' or (res ->> 'effective_deadline') <> '2026-05-05' then
    raise exception 'FAIL: calc mismatch %', res;
  end if;
end $$;

-- ── 3a) Fixtures as superuser (obligation_*/objection_* tables have RLS
--         policies but no INSERT grants for authenticated; same convention
--         as eligibility_dynamic_facts.sql: fixtures run as postgres) ────
insert into public.obligation_families (id, code, title, domain) values
  ('b2000000-0000-0000-0000-000000000001', 'RC_FAM', 'خانوادهٔ آزمون', 'TAX');
insert into public.obligation_definitions (id, family_id, code, title) values
  ('b2000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000001', 'RC_OBL_A', 'تعهد الف'),
  ('b2000000-0000-0000-0000-000000000003', 'b2000000-0000-0000-0000-000000000001', 'RC_OBL_B', 'تعهد ب');
insert into public.obligation_versions (id, obligation_id, version_number, status) values
  ('b2000000-0000-0000-0000-000000000004', 'b2000000-0000-0000-0000-000000000002', 1, 'DRAFT'),
  ('b2000000-0000-0000-0000-000000000005', 'b2000000-0000-0000-0000-000000000003', 1, 'DRAFT');

insert into public.objection_templates (id, title, status, is_active) values
  ('b2000000-0000-0000-0000-000000000006', 'الگوی آزمون قواعد', 'DRAFT', false);
insert into public.objection_steps (id, template_id, sequence, code, step_ref, title, gap_value, gap_unit)
values ('b2000000-0000-0000-0000-000000000007', 'b2000000-0000-0000-0000-000000000006', 1, 'STEP_1', 'rc_step_a', 'اقدام آزمون', 0, 'روز');

-- ── 3) Same rule version in two obligations + one action ─────────────────
do $$
declare
  v_rule_id uuid;
  version_id uuid;
  o1 uuid; o2 uuid; ov1 uuid; ov2 uuid;
  step_id uuid; tpl_id uuid;
  conn1 uuid; conn2 uuid;
  res jsonb;
begin
  select id into v_rule_id from public.rule_center_rules where code = 'RC_TEST_10DAYS';
  select v.id into version_id from public.rule_center_versions v where v.rule_id = v_rule_id;

  -- اتصال‌های پیش‌نویس (فعال فقط پس از انتشار قاعده مجاز است)
  conn1 := public.rule_center_save_connection(version_id, 'OBLIGATION_VERSION', 'b2000000-0000-0000-0000-000000000004',
    $j$ { "base_date": { "source_type": "CASE_EVENT", "source_ref": "receipt_date" } }$j$::jsonb, 'UNCHECKED', null, false);
  conn2 := public.rule_center_save_connection(version_id, 'OBLIGATION_VERSION', 'b2000000-0000-0000-0000-000000000005',
    $j$ { "base_date": { "source_type": "CASE_EVENT", "source_ref": "receipt_date" } }$j$::jsonb, 'UNCHECKED', null, false);
  if conn1 is null or conn2 is null then raise exception 'FAIL: connections null'; end if;

  -- نتایج مستقل: ورودی‌های متفاوت در هر تعهد
  res := public.rule_center_calc_deadline(version_id, $j$ { "base_date": { "value": "2026-01-15", "type": "DATE" } }$j$::jsonb, 'PREVIEW');
  if (res ->> 'effective_deadline') <> '2026-01-25' then raise exception 'FAIL: oblig A independent result %', res; end if;
  res := public.rule_center_calc_deadline(version_id, $j$ { "base_date": { "value": "2026-06-01", "type": "DATE" } }$j$::jsonb, 'PREVIEW');
  if (res ->> 'effective_deadline') <> '2026-06-11' then raise exception 'FAIL: oblig B independent result %', res; end if;

  -- همان قاعده برای اقدام: بدون فرم محاسباتی جدا
  perform public.rule_center_save_connection(version_id, 'ACTION_STEP', 'b2000000-0000-0000-0000-000000000007',
    $j$ { "base_date": { "source_type": "ACTION_FIELD", "source_ref": "doc_date" } }$j$::jsonb, 'UNCHECKED', null, false);
  if not exists (select 1 from public.rule_center_connections
                 where target_type = 'ACTION_STEP' and target_id = 'b2000000-0000-0000-0000-000000000007') then
    raise exception 'FAIL: action step connection missing';
  end if;
end $$;

-- ── 4) Missing base → PENDING_INPUT ──────────────────────────────────────
do $$
declare
  version_id uuid;
  res jsonb;
begin
  select v.id into version_id from public.rule_center_versions v
  join public.rule_center_rules r on r.id = v.rule_id where r.code = 'RC_TEST_10DAYS';
  res := public.rule_center_calc_deadline(version_id, '{}'::jsonb, 'PREVIEW');
  if (res ->> 'status') <> 'PENDING_INPUT' then
    raise exception 'FAIL: missing base must be PENDING_INPUT, got %', res ->> 'status';
  end if;
end $$;

-- ── 5) Fiscal-year dependent: two different fiscal years ─────────────────
do $$
declare
  v_rule_id uuid;
  version_id uuid;
  res jsonb;
begin
  v_rule_id := public.rule_center_save_rule(
    null, 'DEADLINE', 'RC_TEST_FY', 'آزمون: دو ماه پس از پایان سال مالی',
    null, null, null, null, null, 'INTERNAL', null, null,
    $j${
      "deadline": {
        "method": "INTERVAL_FROM_BASE",
        "interval": { "value": 2, "unit": "MONTH", "direction": "AFTER", "base": "FISCAL_YEAR_END" },
        "count": { "include_start": false, "calendar": "CALENDAR_DAYS", "month_calendar": "iran_solar", "missing_day_policy": "LAST_DAY" },
        "holiday_roll": { "enabled": false }
      },
      "reminders": []
    }$j$::jsonb,
    '[]'::jsonb
  );
  select v.id into version_id from public.rule_center_versions v where v.rule_id = v_rule_id;

  -- شرکت الف: پایان سال مالی ۱۴۰۴/۰۶/۳۱ (2025-09-22) → +۲ ماه شمسی = ۱۴۰۴/۰۸/۳۰ (2025-11-21)
  res := public.rule_center_calc_deadline(version_id,
    $j$ { "fiscal_year_end": { "value": "2025-09-22", "type": "DATE" } }$j$::jsonb, 'PREVIEW');
  if (res ->> 'effective_deadline') <> '2025-11-21' then raise exception 'FAIL: fy A %', res; end if;

  -- شرکت ب: پایان سال مالی ۱۴۰۴/۱۲/۲۹ (2026-03-20) → +۲ ماه شمسی = ۱۴۰۵/۰۲/۲۹ (2026-05-19)
  res := public.rule_center_calc_deadline(version_id,
    $j$ { "fiscal_year_end": { "value": "2026-03-20", "type": "DATE" } }$j$::jsonb, 'PREVIEW');
  if (res ->> 'effective_deadline') <> '2026-05-19' then raise exception 'FAIL: fy B %', res; end if;
end $$;

-- ── 6) Solar month arithmetic: leap year + missing-day clamp ─────────────
do $$
begin
  -- ۱۴۰۳ کبیسه است: ۱۴۰۳/۱۱/۳۰ + ۱ ماه = ۱۴۰۳/۱۲/۳۰ (2025-03-20)
  if public.rule_center_jalali_add_months('2025-02-18'::date, 1, 'LAST_DAY') <> '2025-03-20'::date then
    raise exception 'FAIL: leap-year month add';
  end if;
  -- ۱۴۰۴ کبیسه نیست: ۱۴۰۴/۱۱/۳۰ + ۱ ماه → روز ۳۰ ناموجود → آخرین روز ماه = ۱۴۰۴/۱۲/۲۹ (2026-03-20)
  if public.rule_center_jalali_add_months('2026-02-19'::date, 1, 'LAST_DAY') <> '2026-03-20'::date then
    raise exception 'FAIL: missing-day clamp';
  end if;
end $$;

-- ── 7) Working days + holiday-end roll (calendar reference) ──────────────
insert into public.rule_center_working_calendars ("key", title_fa, weekdays_off, use_iran_holidays, is_active)
values ('rc_test_weekend', 'تقویم آزمون (پنجشنبه/جمعه)', ARRAY[5,6], true, true)
on conflict ("key") do nothing;

do $$
declare
  v_rule_id uuid;
  version_id uuid;
  res jsonb;
begin
  v_rule_id := public.rule_center_save_rule(
    null, 'DEADLINE', 'RC_TEST_WD', 'آزمون: ده روز کاری', null, null, null, null, null, 'INTERNAL', null, null,
    $j${
      "deadline": {
        "method": "INTERVAL_FROM_BASE",
        "interval": { "value": 10, "unit": "DAY", "direction": "AFTER", "base_input": "base_date" },
        "count": { "include_start": false, "calendar": "WORKING_DAYS", "month_calendar": "iran_solar" },
        "holiday_roll": { "enabled": false, "calendar_id": "rc_test_weekend" }
      },
      "reminders": []
    }$j$::jsonb,
    $j$[ { "key": "base_date", "label": "مبدأ", "type": "DATE", "required": true } ]$j$::jsonb
  );
  select v.id into version_id from public.rule_center_versions v where v.rule_id = v_rule_id;
  -- ۱۰ روز کاری از شنبه 2026-04-26 با تعطیلی پنجشنبه/جمعه → 2026-05-10
  res := public.rule_center_calc_deadline(version_id,
    $j$ { "base_date": { "value": "2026-04-26", "type": "DATE" } }$j$::jsonb, 'PREVIEW');
  if (res ->> 'effective_deadline') <> '2026-05-10' then raise exception 'FAIL: working days %', res; end if;

  -- اصلاح تعطیل‌بودن روز آخر: دوشنبه 2026-04-27 + ۴ روز تقویمی = جمعه 2026-05-01 → 2026-05-03
  v_rule_id := public.rule_center_save_rule(
    null, 'DEADLINE', 'RC_TEST_ROLL', 'آزمون: انتقال روز آخر تعطیل', null, null, null, null, null, 'INTERNAL', null, null,
    $j${
      "deadline": {
        "method": "INTERVAL_FROM_BASE",
        "interval": { "value": 4, "unit": "DAY", "direction": "AFTER", "base_input": "base_date" },
        "count": { "include_start": false, "calendar": "CALENDAR_DAYS", "month_calendar": "iran_solar" },
        "holiday_roll": { "enabled": true, "calendar_id": "rc_test_weekend" }
      },
      "reminders": []
    }$j$::jsonb,
    $j$[ { "key": "base_date", "label": "مبدأ", "type": "DATE", "required": true } ]$j$::jsonb
  );
  select v.id into version_id from public.rule_center_versions v where v.rule_id = v_rule_id;
  res := public.rule_center_calc_deadline(version_id,
    $j$ { "base_date": { "value": "2026-04-27", "type": "DATE" } }$j$::jsonb, 'PREVIEW');
  if (res ->> 'effective_deadline') <> '2026-05-03' then raise exception 'FAIL: holiday roll %', res; end if;
end $$;

-- ── 8) Overlapping pauses not double-counted ─────────────────────────────
do $$
declare
  v_rule_id uuid;
  version_id uuid;
  res jsonb;
begin
  v_rule_id := public.rule_center_save_rule(
    null, 'DEADLINE', 'RC_TEST_PAUSE', 'آزمون: توقف هم‌پوشان', null, null, null, null, null, 'INTERNAL', null, null,
    $j${
      "deadline": {
        "method": "INTERVAL_FROM_BASE",
        "interval": { "value": 10, "unit": "DAY", "direction": "AFTER", "base_input": "base_date" },
        "count": { "include_start": false, "calendar": "CALENDAR_DAYS", "month_calendar": "iran_solar" },
        "holiday_roll": { "enabled": false },
        "pauses": [
          { "start_input": "pause1_start", "end_input": "pause1_end" },
          { "start_input": "pause2_start", "end_input": "pause2_end" }
        ]
      },
      "reminders": []
    }$j$::jsonb,
    $j$[ { "key": "base_date", "label": "مبدأ", "type": "DATE", "required": true } ]$j$::jsonb
  );
  select v.id into version_id from public.rule_center_versions v where v.rule_id = v_rule_id;
  -- مبدأ 2026-04-25، دو بازهٔ توقف هم‌پوشان: 26 تا 28 و 27 تا 29 → فقط ۴ روز توقف
  res := public.rule_center_calc_deadline(version_id,
    $j$ {
      "base_date": { "value": "2026-04-25", "type": "DATE" },
      "pause1_start": { "value": "2026-04-26", "type": "DATE" },
      "pause1_end":   { "value": "2026-04-28", "type": "DATE" },
      "pause2_start": { "value": "2026-04-27", "type": "DATE" },
      "pause2_end":   { "value": "2026-04-29", "type": "DATE" }
    }$j$::jsonb, 'PREVIEW');
  -- موعد اولیه 2026-05-05 + ۴ روز توقف = 2026-05-09
  if (res ->> 'effective_deadline') <> '2026-05-09' then raise exception 'FAIL: overlapping pauses %', res; end if;
end $$;

-- ── 9) Penalty — documented per-day example ──────────────────────────────
do $$
declare
  v_rule_id uuid;
  version_id uuid;
  res jsonb;
begin
  v_rule_id := public.rule_center_save_rule(
    null, 'PENALTY', 'RC_TEST_PEN', 'آزمون: جریمهٔ روزانهٔ ۱۰۰ هزار ریال', null, null, null, null, null, 'INTERNAL', null, null,
    $j${
      "conditions": { "logic": "ALL", "clauses": [
        { "source": "AMOUNT", "field_key": "debt_amount", "field_label": "مبلغ بدهی", "operator": "GT", "value": { "value": "0" } }
      ] },
      "calculation": {
        "method": "PER_TIME_FIXED",
        "amount": 100000,
        "currency": "ریال",
        "start_input": "effective_deadline",
        "end_input": "payment_date",
        "include_first_day": false,
        "include_end_day": false,
        "accrual_calendar": "CALENDAR_DAYS",
        "limits": { "min": null, "max": null, "round_to": 1, "rounding": "NEAREST" }
      },
      "decided": { "status": "RULE_ATTACHED" }
    }$j$::jsonb,
    $j$[ { "key": "debt_amount", "label": "مبلغ بدهی", "type": "AMOUNT", "required": true } ]$j$::jsonb
  );
  select v.id into version_id from public.rule_center_versions v where v.rule_id = v_rule_id;

  -- نمونهٔ سند: موعد ۱۴۰۵/۰۲/۱۵ (2026-05-05)، انجام ۱۴۰۵/۰۲/۱۸ (2026-05-08) → روزهای ۱۶ و ۱۷ → ۲۰۰ هزار ریال
  res := public.rule_center_calc_penalty(version_id,
    $j$ {
      "debt_amount": { "value": "10000000", "type": "AMOUNT" },
      "effective_deadline": { "value": "2026-05-05", "type": "DATE" },
      "payment_date": { "value": "2026-05-08", "type": "DATE" }
    }$j$::jsonb, 'PREVIEW');
  if (res ->> 'status') <> 'OK' or (res ->> 'days')::int <> 2 or (res ->> 'estimated_amount')::numeric <> 200000 then
    raise exception 'FAIL: penalty example %', res;
  end if;
end $$;

-- ── 10) Percent penalty with unknown base → PENDING_INPUT ────────────────
do $$
declare
  v_rule_id uuid;
  version_id uuid;
  res jsonb;
begin
  v_rule_id := public.rule_center_save_rule(
    null, 'PENALTY', 'RC_TEST_PENPCT', 'آزمون: درصد با مبنای نامعلوم', null, null, null, null, null, 'INTERNAL', null, null,
    $j${
      "conditions": { "logic": "ALL", "clauses": [] },
      "calculation": {
        "method": "PERCENT",
        "rate_percent": 2.5,
        "currency": "ریال",
        "base_input": "debt_amount",
        "limits": { "round_to": 1, "rounding": "NEAREST" }
      },
      "decided": { "status": "RULE_ATTACHED" }
    }$j$::jsonb,
    $j$[ { "key": "debt_amount", "label": "مبلغ بدهی", "type": "AMOUNT", "required": true } ]$j$::jsonb
  );
  select v.id into version_id from public.rule_center_versions v where v.rule_id = v_rule_id;
  res := public.rule_center_calc_penalty(version_id, '{}'::jsonb, 'PREVIEW');
  if (res ->> 'status') <> 'PENDING_INPUT' then
    raise exception 'FAIL: unknown base must be PENDING_INPUT, got %', res ->> 'status';
  end if;
end $$;

-- ── 11) Tiered bracket vs whole ──────────────────────────────────────────
do $$
declare
  v_rule_id uuid;
  version_id uuid;
  res jsonb;
begin
  -- نرخ هر بخش (BRACKET): ۵٪ تا ۱٬۰۰۰٬۰۰۰، ۱۰٪ بالاتر → مبلغ ۲٬۰۰۰٬۰۰۰ → ۵۰٬۰۰۰ + ۱۰۰٬۰۰۰ = ۱۵۰٬۰۰۰
  v_rule_id := public.rule_center_save_rule(
    null, 'PENALTY', 'RC_TEST_TIER', 'آزمون: پلکانی', null, null, null, null, null, 'INTERNAL', null, null,
    $j${
      "conditions": { "logic": "ALL", "clauses": [] },
      "calculation": {
        "method": "TIERED",
        "tier_mode": "BRACKET",
        "tiers": [ { "up_to": 1000000, "rate_percent": 5 }, { "up_to": null, "rate_percent": 10 } ],
        "currency": "ریال",
        "base_input": "debt_amount",
        "limits": { "round_to": 1, "rounding": "NEAREST" }
      },
      "decided": { "status": "RULE_ATTACHED" }
    }$j$::jsonb,
    $j$[ { "key": "debt_amount", "label": "مبلغ بدهی", "type": "AMOUNT", "required": true } ]$j$::jsonb
  );
  select v.id into version_id from public.rule_center_versions v where v.rule_id = v_rule_id;
  res := public.rule_center_calc_penalty(version_id,
    $j$ { "debt_amount": { "value": "2000000", "type": "AMOUNT" } }$j$::jsonb, 'PREVIEW');
  if (res ->> 'estimated_amount')::numeric <> 150000 then raise exception 'FAIL: tiered bracket %', res; end if;

  -- نرخ یک پله بر کل مبلغ (WHOLE): مبلغ ۲٬۰۰۰٬۰۰۰ در پلهٔ دوم → ۱۰٪ کل = ۲۰۰٬۰۰۰
  update public.rule_center_versions
  set definition = jsonb_set(definition, '{calculation,tier_mode}', '"WHOLE"')
  where id = version_id and status = 'DRAFT';
  res := public.rule_center_calc_penalty(version_id,
    $j$ { "debt_amount": { "value": "2000000", "type": "AMOUNT" } }$j$::jsonb, 'PREVIEW');
  if (res ->> 'estimated_amount')::numeric <> 200000 then raise exception 'FAIL: tiered whole %', res; end if;
end $$;

-- ── 12) Published version immutable ───────────────────────────────────────
do $$
declare
  v_rule_id uuid;
  version_id uuid;
begin
  v_rule_id := public.rule_center_save_rule(
    null, 'DEADLINE', 'RC_TEST_LOCK', 'آزمون: قفل انتشار', null, null, null, null, null, 'INTERNAL', null, null,
    $j$ { "deadline": { "method": "FIXED_IN_PERIOD", "fixed_in_period": { "position": "END" }, "count": {}, "holiday_roll": { "enabled": false } }, "reminders": [] }$j$::jsonb,
    '[]'::jsonb
  );
  select v.id into version_id from public.rule_center_versions v where v.rule_id = v_rule_id;
  -- انتشار از مسیر رسمی
  perform public.rule_center_transition(version_id, 'IN_REVIEW');
  perform public.rule_center_transition(version_id, 'APPROVED');
  perform public.rule_center_transition(version_id, 'PUBLISHED');
  if not exists (select 1 from public.rule_center_versions where id = version_id and status = 'PUBLISHED' and published_at is not null) then
    raise exception 'FAIL: version not published';
  end if;
  -- بازنویسی مستقیم مسدود است
  begin
    update public.rule_center_versions
    set definition = '{"deadline":{}}'::jsonb
    where id = version_id;
    raise exception 'FAIL: published version was overwritten';
  exception when check_violation then null;
  end;
  -- برگشت به APPROVED مسدود است
  begin
    update public.rule_center_versions set status = 'APPROVED' where id = version_id;
    raise exception 'FAIL: published version status rolled back';
  exception when check_violation then null;
  end;
end $$;

-- ── 13) ACTIVE connection requires PUBLISHED version ─────────────────────
do $$
declare
  v_rule_id uuid;
  version_id uuid;
begin
  v_rule_id := public.rule_center_save_rule(
    null, 'DEADLINE', 'RC_TEST_CONN', 'آزمون: اتصال فعال', null, null, null, null, null, 'INTERNAL', null, null,
    $j$ { "deadline": { "method": "FIXED_IN_PERIOD", "fixed_in_period": { "position": "END" }, "count": {}, "holiday_roll": { "enabled": false } }, "reminders": [] }$j$::jsonb,
    '[]'::jsonb
  );
  select v.id into version_id from public.rule_center_versions v where v.rule_id = v_rule_id;
  begin
    perform public.rule_center_save_connection(version_id, 'OBLIGATION_VERSION', 'b2000000-0000-0000-0000-000000000004', '{}'::jsonb, 'UNCHECKED', null, true);
    raise exception 'FAIL: ACTIVE connection to unpublished version allowed';
  exception when check_violation then null;
  end;
end $$;

-- ── 14) Obligation publish blocked while rule connection not ready ───────
do $$
declare
  v_rule_id uuid;
  version_id uuid;
begin
  v_rule_id := public.rule_center_save_rule(
    null, 'DEADLINE', 'RC_TEST_GATE', 'آزمون: گیت انتشار تعهد', null, null, null, null, null, 'INTERNAL', null, null,
    $j$ { "deadline": { "method": "FIXED_IN_PERIOD", "fixed_in_period": { "position": "END" }, "count": {}, "holiday_roll": { "enabled": false } }, "reminders": [] }$j$::jsonb,
    '[]'::jsonb
  );
  select v.id into version_id from public.rule_center_versions v where v.rule_id = v_rule_id;
  perform public.rule_center_save_connection(version_id, 'OBLIGATION_VERSION', 'b2000000-0000-0000-0000-000000000005', '{}'::jsonb, 'UNCHECKED', null, false);
  begin
    update public.obligation_versions
    set status = 'PUBLISHED'
    where id = 'b2000000-0000-0000-0000-000000000005';
    raise exception 'FAIL: obligation published with unready rule connection';
  exception when check_violation then null;
  end;
end $$;

-- ── 15) Objection activation blocked with unpublished rule link ──────────
do $$
declare
  v_rule_id uuid;
  version_id uuid;
begin
  v_rule_id := public.rule_center_save_rule(
    null, 'DEADLINE', 'RC_TEST_ACT', 'آزمون: فعال‌سازی الگو', null, null, null, null, null, 'INTERNAL', null, null,
    $j$ { "deadline": { "method": "FIXED_IN_PERIOD", "fixed_in_period": { "position": "END" }, "count": {}, "holiday_roll": { "enabled": false } }, "reminders": [] }$j$::jsonb,
    '[]'::jsonb
  );
  select v.id into version_id from public.rule_center_versions v where v.rule_id = v_rule_id;
  update public.objection_steps
  set deadline_rule_version_id = version_id
  where id = 'b2000000-0000-0000-0000-000000000007';
  begin
    update public.objection_templates
    set status = 'ACTIVE', is_active = true
    where id = 'b2000000-0000-0000-0000-000000000006';
    raise exception 'FAIL: template activated with unpublished rule link';
  exception when check_violation then null;
  end;
end $$;

-- ── 16) Action-step save rejects mapping to deleted field/action ─────────
do $$
declare
  tid uuid;
  steps jsonb := $j$[
    { "id": "rcs1", "title": "اقدام الف", "step_ref": "rcs1", "actor": "TAXPAYER",
      "gap_value": 0, "gap_unit": "روز", "base_event": null, "step_nature": "MANDATORY",
      "fields": [ { "id": "rcf1", "key": "doc_date", "label": "تاریخ سند", "type": "date" } ],
      "transitions": [],
      "deadline_rule_version_id": null,
      "deadline_mapping": { "base_date": { "source_type": "ACTION_FIELD", "source_ref": "missing_field", "source_step_label": "اقدام الف" } } },
    { "id": "rcs2", "title": "اقدام ب", "step_ref": "rcs2", "actor": "TAXPAYER",
      "gap_value": 0, "gap_unit": "روز", "base_event": null, "step_nature": "MANDATORY",
      "fields": [], "transitions": [],
      "deadline_rule_version_id": null,
      "deadline_mapping": {} }
  ]$j$::jsonb;
begin
  begin
    perform public.objection_template_save(null, 'الگوی نگاشت', null, '[]'::jsonb, steps, '[]'::jsonb, '{}'::uuid[]);
    raise exception 'FAIL: mapping to deleted field accepted';
  exception when check_violation or invalid_text_representation then null;
  end;
end $$;

-- ── 17) RLS: company user cannot write rules, can read published ─────────
do $$
declare
  v_rule_id uuid;
  version_id uuid;
  cnt integer;
begin
  v_rule_id := public.rule_center_save_rule(
    null, 'DEADLINE', 'RC_TEST_RLS', 'آزمون: دسترسی', null, null, null, null, null, 'INTERNAL', null, null,
    $j$ { "deadline": { "method": "FIXED_IN_PERIOD", "fixed_in_period": { "position": "END" }, "count": {}, "holiday_roll": { "enabled": false } }, "reminders": [] }$j$::jsonb,
    '[]'::jsonb
  );
  select v.id into version_id from public.rule_center_versions v where v.rule_id = v_rule_id;
  perform public.rule_center_transition(version_id, 'IN_REVIEW');
  perform public.rule_center_transition(version_id, 'APPROVED');
  perform public.rule_center_transition(version_id, 'PUBLISHED');

  -- 17a) RLS 读测试：公司用户能读已发布规则
  reset role;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', 'a2000000-0000-0000-0000-000000000002', true);
  select set_config('request.jwt.claims', '{"sub":"a2000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

  -- خواندن قاعدهٔ منتشرشده مجاز است
  select count(*) into cnt from public.rule_center_rules where code = 'RC_TEST_RLS';
  if cnt <> 1 then raise exception 'FAIL: company user cannot read published rule'; end if;

  -- نوشتن مستقیم مسدود است
  begin
    insert into public.rule_center_rules (kind, code, title_fa)
    values ('DEADLINE', 'RC_HACK', 'قاعدهٔ غیرمجاز');
    raise exception 'FAIL: company user wrote a rule';
  exception when insufficient_privilege then null;
  end;

  -- RPC مدیریتی هم رد می‌شود
  begin
    perform public.rule_center_save_rule(null, 'DEADLINE', 'RC_HACK2', 'قاعدهٔ غیرمجاز', null, null, null, null, null, 'INTERNAL', null, null, '{}'::jsonb, '[]'::jsonb);
    raise exception 'FAIL: company user called admin RPC';
  exception when insufficient_privilege then null;
  end;

  -- 17b) 回到超级用户：后续块（18）以 postgres 运行
  reset role;
end $$;

-- ── 18) New version keeps old version untouched ──────────────────────────
do $$
declare
  v_rule_id uuid;
  v1 uuid;
  v2 uuid;
begin
  select id into v_rule_id from public.rule_center_rules where code = 'RC_TEST_10DAYS';
  select id into v1 from public.rule_center_versions where rule_id = v_rule_id order by version_number desc limit 1;
  v2 := public.rule_center_new_version(v_rule_id, '{"deadline":{"method":"FIXED_IN_PERIOD","fixed_in_period":{"position":"START"},"count":{},"holiday_roll":{"enabled":false}},"reminders":[]}'::jsonb, '[]'::jsonb);
  if v2 is null or v2 = v1 then raise exception 'FAIL: new version not created'; end if;
  if (select version_number from public.rule_center_versions where id = v2) <=
     (select version_number from public.rule_center_versions where id = v1) then
    raise exception 'FAIL: version numbering not monotonic';
  end if;
  -- نسخهٔ قبلی دست‌نخورده می‌ماند (مقایسهٔ ساختاری)
  if (select definition -> 'deadline' ->> 'method' from public.rule_center_versions where id = v1) <> 'INTERVAL_FROM_BASE'
     or (select definition -> 'deadline' -> 'interval' ->> 'value' from public.rule_center_versions where id = v1)::int <> 10
     or (select definition -> 'deadline' -> 'count' ->> 'calendar' from public.rule_center_versions where id = v1) <> 'CALENDAR_DAYS' then
    raise exception 'FAIL: old version definition changed';
  end if;
end $$;

rollback;
