-- ==========================================================================
-- Integration test: تاریخ‌های خالی نباید خطای «invalid input syntax for type date» بدهند
-- فقط روی Supabase توسعه اجرا شود (transaction + rollback). الگوی امن:
--   nullif(trim(coalesce(value, '')), '')::date
-- اصلاح اصلی در سمت رابط (payload) است؛ این آزمون دفاع تکمیلی سمت دیتابیس را می‌سنجد.
-- ==========================================================================
begin;

-- ادمین پلتفرم (مطابق الگوی آزمون‌های موجود مرکز قواعد)
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

-- 1) الگوی امن: رشتهٔ خالی / فاصله / null → null بدون خطا
do $$
begin
  if nullif(trim(''), '')::date is not null then raise exception 'FAIL: empty-string guard'; end if;
  if nullif(trim('   '), '')::date is not null then raise exception 'FAIL: whitespace guard'; end if;
  if nullif(trim(coalesce(null, '')), '')::date is not null then raise exception 'FAIL: null guard'; end if;
end $$;

-- 2) موتور مهلت: تاریخ‌های اختیاری خالی/فضا/null نباید خطای دیتابیس بدهند
do $$
declare
  v_rule_id uuid;
  v_version_id uuid;
  v_test_id uuid;
  res jsonb;
begin
  v_rule_id := public.rule_center_save_rule(
    null, 'DEADLINE', 'RC_EMPTY_DATE', 'آزمون: تاریخ خالی', 'قاعدهٔ آزمایشی برای آزمون تاریخ‌های خالی',
    null, null, null, null, 'INTERNAL', '2026-01-01', null,
    $j${
      "deadline": {
        "method": "INTERVAL_FROM_BASE",
        "interval": { "value": 10, "unit": "DAY", "direction": "AFTER", "base": "PERIOD_END" },
        "count": { "include_start": false, "calendar": "CALENDAR_DAYS", "month_calendar": "iran_solar", "missing_day_policy": "LAST_DAY" },
        "holiday_roll": { "enabled": false, "calendar_id": "iran_official" },
        "pauses": [], "extensions": []
      },
      "reminders": []
    }$j$::jsonb,
    $j$[ { "key": "base_date", "label": "تاریخ دریافت", "type": "DATE", "required": true } ]$j$::jsonb
  );
  if v_rule_id is null then raise exception 'FAIL: rule save null'; end if;

  select v.id into v_version_id from public.rule_center_versions v where v.rule_id = v_rule_id;
  if v_version_id is null then raise exception 'FAIL: version not created'; end if;

  -- همهٔ تاریخ‌های اختیاری خالی ("") و فاصله → بدون خطا؛ مبدأ نامشخص → PENDING_INPUT
  res := public.rule_center_calc_deadline(v_version_id,
    $j$ { "base_date": { "value": "2026-04-25", "type": "DATE" },
          "period_start": { "value": "" }, "period_end": { "value": "  " },
          "fiscal_year_start": { "value": "" }, "fiscal_year_end": { "value": "" } }$j$::jsonb,
    'PREVIEW');
  if (res ->> 'status') is null then raise exception 'FAIL: empty optional dates crashed: %', res; end if;
  if (res ->> 'status') <> 'PENDING_INPUT' then raise exception 'FAIL: empty optional dates expected PENDING_INPUT: %', res; end if;

  -- مقدار null صریح → بدون خطا
  res := public.rule_center_calc_deadline(v_version_id,
    $j$ { "period_end": { "value": null, "type": "DATE" }, "fiscal_year_end": { "value": null } }$j$::jsonb,
    'PREVIEW');
  if (res ->> 'status') is null then raise exception 'FAIL: null values crashed: %', res; end if;

  -- ورودی الزامی خالی → بدون خطا (PENDING_INPUT؛ مسدودسازی ارسال درخواست در سمت رابط انجام می‌شود)
  res := public.rule_center_calc_deadline(v_version_id,
    $j$ { "base_date": { "value": "" } }$j$::jsonb, 'PREVIEW');
  if (res ->> 'status') <> 'PENDING_INPUT' then raise exception 'FAIL: missing required input: %', res; end if;

  -- 3) تاریخ معتبر → ذخیره و بازخوانی صحیح (پایان دوره 2026-04-25 + ۱۰ روز = 2026-05-05)
  res := public.rule_center_calc_deadline(v_version_id,
    $j$ { "period_end": { "value": "2026-04-25", "type": "DATE" } }$j$::jsonb, 'PREVIEW');
  if (res ->> 'effective_deadline') <> '2026-05-05' then raise exception 'FAIL: valid date calc: %', res; end if;

  -- 4) باگ اصلی: موعد مورد انتظار خالی "" در run_test → بدون خطا؛ مقایسه فقط بر اساس وضعیت
  v_test_id := public.rule_center_run_test(
    v_version_id, 'تاریخ مورد انتظار خالی',
    $j$ { "period_end": { "value": "2026-04-25", "type": "DATE" } }$j$::jsonb,
    $j$ { "status": "OK", "effective_deadline": "" }$j$::jsonb
  );
  if not exists (select 1 from public.rule_center_tests where id = v_test_id and status = 'PASS') then
    raise exception 'FAIL: empty expected deadline run_test row';
  end if;

  -- 5) تاریخ اختیاری خالی در run_test → بدون خطا؛ تاریخ معتبر همان‌گونه ذخیره شود
  v_test_id := public.rule_center_run_test(
    v_version_id, 'تاریخ اختیاری خالی',
    $j$ { "period_end": { "value": "2026-04-25", "type": "DATE" }, "period_start": { "value": "" } }$j$::jsonb,
    $j$ { "status": "OK", "effective_deadline": "2026-05-05" }$j$::jsonb
  );
  if not exists (select 1 from public.rule_center_tests where id = v_test_id and status = 'PASS') then
    raise exception 'FAIL: optional empty date run_test';
  end if;
  if not exists (
    select 1 from public.rule_center_tests
    where id = v_test_id and (inputs -> 'period_end' ->> 'value') = '2026-04-25'
  ) then
    raise exception 'FAIL: valid date not persisted';
  end if;
end $$;

rollback;
