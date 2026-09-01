begin;

-- ==========================================================================
-- دفاع تکمیلی: جلوگیری از خطای «invalid input syntax for type date» برای رشتهٔ خالی
-- الگوی امن: nullif(trim(coalesce(...)), '')::date — اصلاح اصلی payload در سمت رابط است.
-- ==========================================================================

create or replace function public.rule_center_calc_deadline(
  p_version_id uuid,
  p_inputs jsonb,
  p_mode text default 'PREVIEW',
  p_connection_id uuid default null,
  p_tenant_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_version record;
  v_def jsonb;
  v_dl jsonb;
  v_rec record;
  v_in jsonb;
  v_base date;
  v_base_key text;
  v_interval_value integer;
  v_interval_unit text;
  v_direction text;
  v_include_start boolean;
  v_count_calendar text;
  v_month_calendar text;
  v_missing_policy text;
  v_holiday_roll boolean;
  v_calendar record;
  v_deadline date;
  v_initial date;
  v_effective date;
  v_iter date;
  v_is_holiday boolean;
  v_workdays integer;
  v_step jsonb;
  v_steps jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_missing text[] := '{}'::text[];
  v_period_start date;
  v_period_end date;
  v_fy_start date;
  v_fy_end date;
  v_fixed_month integer;
  v_fixed_day integer;
  v_candidate date;
  v_best date;
  v_pause jsonb;
  v_paused_days integer := 0;
  v_pause_start date; v_pause_end date;
  v_ext record;
  v_ext_days integer := 0;
  v_reason text;
  v_reminder jsonb;
  v_reminders jsonb := '[]'::jsonb;
  v_tz text;
  v_multi jsonb;
  v_choose text;
  v_engine text := 'rule-center-1';
begin
  select v.*, r.kind, r.code into v_version
  from public.rule_center_versions v
  join public.rule_center_rules r on r.id = v.rule_id
  where v.id = p_version_id;
  if not found then
    raise exception 'نسخهٔ قاعده یافت نشد' using errcode = 'P0002';
  end if;
  if p_mode not in ('PREVIEW', 'REAL') then p_mode := 'PREVIEW'; end if;

  v_def := v_version.definition;
  v_dl := coalesce(v_def -> 'deadline', '{}'::jsonb);

  -- «بدون مهلت» صریح
  if coalesce((v_dl ->> 'no_deadline')::boolean, false) then
    return jsonb_build_object('status','OK','engine_version',v_engine,'steps',jsonb_build_array(jsonb_build_object('step','no_deadline','text','این اتصال مهلت ندارد')),'initial_deadline',null,'effective_deadline',null,'warnings',v_warnings,'mode',p_mode);
  end if;

  -- 1) ورودی‌های الزامی (بدون جایگزینی صفر/امروز)
  for v_rec in select * from jsonb_array_elements(coalesce(v_version.inputs, '[]'::jsonb)) as t(value) loop
    v_in := v_rec.value;
    if coalesce((v_in ->> 'required')::boolean, false) and not (p_inputs ? (v_in ->> 'key')) then
      v_missing := array_append(v_missing, v_in ->> 'label');
    end if;
  end loop;
  if array_length(v_missing, 1) is not null then
    return jsonb_build_object('status','PENDING_INPUT','engine_version',v_engine,'missing',v_missing,'steps',jsonb_build_array(jsonb_build_object('step','inputs','text','ورودی‌های لازم تعیین نشده‌اند')),'warnings',v_warnings,'mode',p_mode);
  end if;

  v_tz := coalesce(v_dl -> 'count' ->> 'timezone', 'Asia/Tehran');

  -- 2) مبدأ محاسبه (ساختاریافته)
  v_base_key := coalesce(v_dl -> 'interval' ->> 'base_input', '');
  v_base := null;
  if v_dl -> 'interval' ->> 'base' is not null then
    if (v_dl -> 'interval' ->> 'base') = 'PERIOD_START' then
      v_base := nullif(trim(coalesce((p_inputs -> 'period_start' ->> 'value'), '')), '')::date;
    elsif (v_dl -> 'interval' ->> 'base') = 'PERIOD_END' then
      v_base := nullif(trim(coalesce((p_inputs -> 'period_end' ->> 'value'), '')), '')::date;
    elsif (v_dl -> 'interval' ->> 'base') = 'FISCAL_YEAR_START' then
      v_base := nullif(trim(coalesce((p_inputs -> 'fiscal_year_start' ->> 'value'), '')), '')::date;
    elsif (v_dl -> 'interval' ->> 'base') = 'FISCAL_YEAR_END' then
      v_base := nullif(trim(coalesce((p_inputs -> 'fiscal_year_end' ->> 'value'), '')), '')::date;
    end if;
    if v_base is null then
      return jsonb_build_object('status','PENDING_INPUT','engine_version',v_engine,'missing',ARRAY['منبع مبدأ (تاریخ پرونده/سال مالی)'],'steps','[]'::jsonb,'warnings',v_warnings,'mode',p_mode);
    end if;
    v_base_key := v_dl -> 'interval' ->> 'base';
  elsif v_base_key <> '' then
    if p_inputs ? v_base_key then
      v_base := nullif(trim(coalesce(p_inputs -> v_base_key ->> 'value', '')), '')::date;
    end if;
    if v_base is null then
      return jsonb_build_object('status','PENDING_INPUT','engine_version',v_engine,'missing',ARRAY[v_base_key],'steps','[]'::jsonb,'warnings',v_warnings,'mode',p_mode);
    end if;
  end if;

  v_period_start := coalesce(nullif(trim(coalesce(p_inputs -> 'period_start' ->> 'value', '')), '')::date, v_base);
  v_period_end := coalesce(nullif(trim(coalesce(p_inputs -> 'period_end' ->> 'value', '')), '')::date, v_base);
  v_fy_start := coalesce(nullif(trim(coalesce(p_inputs -> 'fiscal_year_start' ->> 'value', '')), '')::date, v_period_start);
  v_fy_end := coalesce(nullif(trim(coalesce(p_inputs -> 'fiscal_year_end' ->> 'value', '')), '')::date, v_period_end);

  v_steps := v_steps || jsonb_build_object('step','base','text','مبدأ محاسبه: ' || coalesce(v_base::text, 'نامشخص'),'base_key',v_base_key);

  -- 3) روش تعیین موعد
  v_interval_value := coalesce((v_dl -> 'interval' ->> 'value')::int, 0);
  v_interval_unit := coalesce(v_dl -> 'interval' ->> 'unit', 'DAY');
  v_direction := coalesce(v_dl -> 'interval' ->> 'direction', 'AFTER');
  v_include_start := coalesce((v_dl -> 'count' ->> 'include_start')::boolean, false);
  v_count_calendar := coalesce(v_dl -> 'count' ->> 'calendar', 'CALENDAR_DAYS');
  v_month_calendar := coalesce(v_dl -> 'count' ->> 'month_calendar', 'iran_solar');
  v_missing_policy := coalesce(v_dl -> 'count' ->> 'missing_day_policy', 'LAST_DAY');
  v_holiday_roll := coalesce((v_dl -> 'holiday_roll' ->> 'enabled')::boolean, true);

  v_deadline := null;
  if (v_dl ->> 'method') = 'FIXED_DATE' then
    v_fixed_month := coalesce((v_dl -> 'fixed_date' ->> 'month')::int, 0);
    v_fixed_day := coalesce((v_dl -> 'fixed_date' ->> 'day')::int, 0);
    if v_fixed_month < 1 or v_fixed_month > 12 or v_fixed_day < 1 then
      return jsonb_build_object('status','NEEDS_REVIEW','engine_version',v_engine,'error','تاریخ ثابت نامعتبر است','steps',v_steps,'warnings',v_warnings,'mode',p_mode);
    end if;
    -- «تاریخ مشخص در هر دوره»: ماه/روز شمسی در سال دورهٔ پرونده (سیاست روز ناموجود)
    declare
      v_year integer;
      v_max_day integer;
    begin
      select t.y into v_year from public.rule_center_greg_to_jal(
        extract(year from v_period_start)::int, extract(month from v_period_start)::int, extract(day from v_period_start)::int) t;
      v_max_day := public.rule_center_jalali_month_days(v_year, v_fixed_month);
      v_deadline := public.rule_center_jalali_to_greg(
        v_year, v_fixed_month, least(v_fixed_day, v_max_day));
    end;
    v_steps := v_steps || jsonb_build_object('step','fixed_date','text','تاریخ ثابت در دوره: ماه ' || v_fixed_month || ' روز ' || v_fixed_day);
  elsif (v_dl ->> 'method') = 'FIXED_IN_PERIOD' then
    if (v_dl -> 'fixed_in_period' ->> 'position') = 'END' then
      v_deadline := v_period_end;
      v_steps := v_steps || jsonb_build_object('step','period_end','text','پایان دوره');
    elsif (v_dl -> 'fixed_in_period' ->> 'position') = 'START' then
      v_deadline := v_period_start;
      v_steps := v_steps || jsonb_build_object('step','period_start','text','شروع دوره');
    else
      v_deadline := v_period_start + coalesce((v_dl -> 'fixed_in_period' ->> 'n')::int, 1) - 1;
      v_steps := v_steps || jsonb_build_object('step','nth_day','text','روز ' || coalesce((v_dl -> 'fixed_in_period' ->> 'n')::int, 1) || ' دوره');
    end if;
  elsif (v_dl ->> 'method') = 'MULTIPLE_CHOOSE' then
    v_choose := coalesce(v_dl -> 'multiple' ->> 'choose', 'EARLIEST');
    v_best := null;
    v_step := jsonb_build_object('step','multiple','text','انتخاب از چند موعد (' || v_choose || ')');
    for v_rec in select * from jsonb_array_elements(coalesce(v_dl -> 'multiple' -> 'inputs', '[]'::jsonb)) as t(value) loop
      v_candidate := nullif(trim(coalesce(p_inputs -> (v_rec.value ->> 'input_key') ->> 'value', '')), '')::date;
      if v_candidate is not null then
        if v_best is null then v_best := v_candidate;
        elsif v_choose = 'EARLIEST' and v_candidate < v_best then v_best := v_candidate;
        elsif v_choose = 'LATEST' and v_candidate > v_best then v_best := v_candidate;
        end if;
      end if;
    end loop;
    if v_best is null then
      return jsonb_build_object('status','PENDING_INPUT','engine_version',v_engine,'missing',ARRAY['موعدهای انتخابی'],'steps',v_steps,'warnings',v_warnings,'mode',p_mode);
    end if;
    v_deadline := v_best;
    v_steps := v_steps || v_step;
  elsif (v_dl ->> 'method') = 'INTERVAL_FROM_BASE' and v_base is not null then
    -- شمارش روزها: روز شروع شمرده نشود → روز N برابر base + N (مطابق نمونهٔ سند)
    if v_interval_unit = 'DAY' or v_interval_unit = 'HOUR' then
      v_deadline := v_base + v_interval_value;
    elsif v_interval_unit = 'MONTH' then
      v_deadline := public.rule_center_calc_jalali_month_operator(v_base, v_interval_value,
        coalesce(v_dl -> 'interval' ->> 'month_application', 'SAME_DAY_AFTER_N_MONTHS'), v_missing_policy);
    elsif v_interval_unit = 'YEAR' then
      v_deadline := public.rule_center_jalali_add_months(v_base, v_interval_value * 12, v_missing_policy);
    end if;
    if v_direction = 'BEFORE' then
      v_deadline := v_base - (v_deadline - v_base);
    end if;
    v_steps := v_steps || jsonb_build_object('step','interval','text',
      'فاصله: ' || v_interval_value || ' ' || v_interval_unit || ' ' || (case when v_direction = 'BEFORE' then 'پیش از' else 'پس از' end) || ' مبدأ');
  else
    return jsonb_build_object('status','NEEDS_REVIEW','engine_version',v_engine,'error','روش تعیین موعد تعریف نشده است','steps',v_steps,'warnings',v_warnings,'mode',p_mode);
  end if;

  v_initial := v_deadline;
  v_steps := v_steps || jsonb_build_object('step','initial','text','موعد اولیه: ' || coalesce(v_initial::text,''));

  -- 4) روزهای کاری: شمارش فقط روزهای کاری میان بازه
  if v_count_calendar = 'WORKING_DAYS' then
    select * into v_calendar from public.rule_center_working_calendars
    where "key" = coalesce(v_dl -> 'holiday_roll' ->> 'calendar_id', 'iran_official') and is_active;
    if not found then
      v_calendar.id := null; v_calendar.weekdays_off := ARRAY[6,0]; v_calendar.use_iran_holidays := true;
    end if;
    v_workdays := 0;
    v_iter := v_base;
    -- جابه‌جایی به جلو تا رسیدن به N روز کاری
    while v_workdays < v_interval_value loop
      v_iter := v_iter + 1;
      v_is_holiday := extract(dow from v_iter)::int = any (v_calendar.weekdays_off);
      if v_calendar.use_iran_holidays and not v_is_holiday then
        v_is_holiday := exists (select 1 from public.iran_holidays where holiday_date = v_iter);
      end if;
      if not v_is_holiday then
        v_workdays := v_workdays + 1;
      end if;
    end loop;
    v_deadline := v_iter;
    v_steps := v_steps || jsonb_build_object('step','working_days','text','شمارش روز کاری: ' || v_workdays || ' روز کاری');
  end if;

  -- 5) اصلاح تعطیل‌بودن روز آخر (فقط طبق نسخهٔ تقویم و قاعده)
  if v_holiday_roll and v_count_calendar <> 'WORKING_DAYS' then
    select * into v_calendar from public.rule_center_working_calendars
    where "key" = coalesce(v_dl -> 'holiday_roll' ->> 'calendar_id', 'iran_official') and is_active;
    if not found then
      v_calendar.id := null; v_calendar.weekdays_off := ARRAY[6,0]; v_calendar.use_iran_holidays := true;
    end if;
    v_iter := v_deadline;
    while (extract(dow from v_iter)::int = any (v_calendar.weekdays_off))
       or (v_calendar.use_iran_holidays and exists (select 1 from public.iran_holidays where holiday_date = v_iter)) loop
      v_iter := v_iter + 1;
    end loop;
    if v_iter <> v_deadline then
      v_steps := v_steps || jsonb_build_object('step','holiday_roll','text','روز آخر تعطیل بود؛ به ' || v_iter || ' منتقل شد');
    end if;
    v_deadline := v_iter;
  end if;

  -- 6) توقف شمارش — بازه‌های هم‌پوشان ابتدا ادغام می‌شوند تا دوباره شمرده نشوند
  declare
    v_ints jsonb := '[]'::jsonb;
    v_p jsonb;
    v_last jsonb;
    v_li integer;
  begin
    for v_pause in select * from jsonb_array_elements(coalesce(v_dl -> 'pauses', '[]'::jsonb)) loop
      v_pause_start := nullif(trim(coalesce(p_inputs -> (v_pause ->> 'start_input') ->> 'value', '')), '')::date;
      v_pause_end := nullif(trim(coalesce(p_inputs -> (v_pause ->> 'end_input') ->> 'value', '')), '')::date;
      if v_pause_start is not null and v_pause_end is not null and v_pause_end >= v_pause_start then
        v_ints := v_ints || jsonb_build_array(jsonb_build_object('s', v_pause_start, 'e', v_pause_end));
      end if;
    end loop;
    -- ادغام بازه‌های مرتب‌شده (هم‌پوشان با هم ترکیب می‌شوند)
    declare
      v_sorted jsonb := '[]'::jsonb;
      v_cur jsonb;
    begin
      for v_p in select value from jsonb_array_elements(v_ints) order by (value ->> 's')::date loop
        if v_cur is null then
          v_cur := v_p;
        elsif (v_p ->> 's')::date <= (v_cur ->> 'e')::date then
          v_cur := jsonb_build_object('s', v_cur ->> 's', 'e', greatest((v_cur ->> 'e')::date, (v_p ->> 'e')::date));
        else
          v_sorted := v_sorted || jsonb_build_array(v_cur);
          v_cur := v_p;
        end if;
      end loop;
      if v_cur is not null then
        v_sorted := v_sorted || jsonb_build_array(v_cur);
      end if;
      for v_p in select value from jsonb_array_elements(v_sorted) loop
        -- فقط بخش در [مبدأ، موعد] شمرده می‌شود
        v_paused_days := v_paused_days + greatest(0, least((v_p ->> 'e')::date, v_deadline) - greatest((v_p ->> 's')::date, v_base) + 1);
      end loop;
    end;
  end;
  if v_paused_days > 0 then
    v_deadline := v_deadline + v_paused_days;
    v_steps := v_steps || jsonb_build_object('step','pauses','text','توقف شمارش (بازه‌های ادغام‌شده): ' || v_paused_days || ' روز');
  end if;

  -- 7) تمدیدها (دامنه‌دار؛ موعد اولیه، موعد اصلاح‌شده و دلیل جدا نگه داشته می‌شوند)
  --     ماه با تقویم شمسی جابه‌جا می‌شود (نه تبدیل به ۳۰ روز ثابت).
  v_reason := null;
  for v_ext in select * from jsonb_array_elements(coalesce(v_dl -> 'extensions', '[]'::jsonb)) loop
    if coalesce((v_ext ->> 'months')::int, 0) <> 0 then
      v_deadline := public.rule_center_jalali_add_months(v_deadline, coalesce((v_ext ->> 'months')::int, 0), v_missing_policy);
      v_reason := coalesce(v_reason, '') || 'تمدید ' || (v_ext ->> 'months') || ' ماه؛ ';
    end if;
    if coalesce((v_ext ->> 'days')::int, 0) <> 0 then
      v_deadline := v_deadline + coalesce((v_ext ->> 'days')::int, 0);
      v_reason := coalesce(v_reason, '') || 'تمدید ' || (v_ext ->> 'days') || ' روز؛ ';
    end if;
  end loop;
  if v_reason is not null then
    v_steps := v_steps || jsonb_build_object('step','extension','text',v_reason);
  end if;
  v_effective := v_deadline;

  -- 8) یادآوری‌ها (فقط برنامه‌ریزی؛ ارسال واقعی پشتیبانی نمی‌شود)
  for v_reminder in select * from jsonb_array_elements(coalesce(v_def -> 'reminders', '[]'::jsonb)) loop
    v_reminders := v_reminders || jsonb_build_object(
      'due_offset', coalesce((v_reminder ->> 'offset_before')::int, 0),
      'unit', coalesce(v_reminder ->> 'unit', 'DAY'),
      'role_key', v_reminder ->> 'role_key',
      'channel', coalesce(v_reminder ->> 'channel', 'IN_APP'),
      'channel_supported', false,
      'scheduled_date', v_effective - coalesce((v_reminder ->> 'offset_before')::int, 0)
    );
  end loop;

  -- ذخیرهٔ نتیجهٔ واقعی
  if p_mode = 'REAL' then
    insert into public.rule_center_results (connection_id, version_id, tenant_id, kind, run_mode, status, inputs, output, engine_version)
    values (p_connection_id, p_version_id, p_tenant_id, 'DEADLINE', 'REAL', 'OK',
            p_inputs,
            jsonb_build_object('initial_deadline', v_initial, 'effective_deadline', v_effective, 'steps', v_steps, 'reason', v_reason, 'timezone', v_tz),
            v_engine);
  end if;

  return jsonb_build_object(
    'status','OK','engine_version',v_engine,'mode',p_mode,
    'initial_deadline', v_initial,
    'effective_deadline', v_effective,
    'reason', v_reason,
    'timezone', v_tz,
    'steps', v_steps,
    'reminders', v_reminders,
    'warnings', v_warnings
  );
end;
$$;
revoke all on function public.rule_center_calc_deadline(uuid, jsonb, text, uuid, uuid) from public, anon;
grant execute on function public.rule_center_calc_deadline(uuid, jsonb, text, uuid, uuid) to authenticated;

create or replace function public.rule_center_calc_penalty(
  p_version_id uuid,
  p_inputs jsonb,
  p_mode text default 'PREVIEW',
  p_connection_id uuid default null,
  p_tenant_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_version record;
  v_def jsonb;
  v_calc jsonb;
  v_cond jsonb;
  v_clause jsonb;
  v_logic text;
  v_clause_result text;   -- TRUE | FALSE | UNKNOWN
  v_cond_result text;
  v_result boolean;
  v_unknown boolean := false;
  v_missing text[] := '{}'::text[];
  v_steps jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_engine text := 'rule-center-1';
  v_field_value jsonb;
  v_operator text;
  v_expected jsonb;
  v_base_amount numeric;
  v_base_key text;
  v_currency text;
  v_method text;
  v_rate numeric;
  v_fixed numeric;
  v_per_unit text;
  v_start date;
  v_end date;
  v_start_input text;
  v_end_input text;
  v_include_first boolean;
  v_accrual_calendar text;
  v_days integer := 0;
  v_gross numeric;
  v_min numeric;
  v_max numeric;
  v_round_to numeric;
  v_rounding text;
  v_final numeric;
  v_tier jsonb;
  v_tier_mode text;
  v_component jsonb;
  v_components jsonb := '[]'::jsonb;
  v_iter date;
  v_hol boolean;
  v_cal record;
  v_effective_deadline date;
  v_decided_status text;
begin
  select v.*, r.kind, r.code into v_version
  from public.rule_center_versions v
  join public.rule_center_rules r on r.id = v.rule_id
  where v.id = p_version_id;
  if not found then
    raise exception 'نسخهٔ قاعده یافت نشد' using errcode = 'P0002';
  end if;

  v_def := v_version.definition;
  v_calc := coalesce(v_def -> 'calculation', '{}'::jsonb);
  v_cond := coalesce(v_def -> 'conditions', jsonb_build_object('logic','ALL','clauses','[]'::jsonb));
  v_logic := coalesce(v_cond ->> 'logic', 'ALL');
  v_decided_status := coalesce(v_def -> 'decided' ->> 'status', 'UNCHECKED');

  if v_decided_status = 'NEEDS_REFERENCE' then
    return jsonb_build_object('status','NEEDS_REFERENCE','engine_version',v_engine,'steps',jsonb_build_array(jsonb_build_object('step','decided','text','مبلغ به تشخیص مرجع نیاز دارد؛ سامانه مبلغ نهایی نمی‌سازد')),'warnings',v_warnings,'mode',p_mode);
  end if;

  -- 1) ارزیابی شروط با منطق سه‌حالته
  v_cond_result := 'TRUE';
  for v_clause in select * from jsonb_array_elements(coalesce(v_cond -> 'clauses', '[]'::jsonb)) loop
    v_clause_result := 'TRUE';
    v_field_value := p_inputs -> (v_clause ->> 'field_key');
    v_operator := coalesce(v_clause ->> 'operator', 'EQ');
    v_expected := v_clause -> 'value';
    if v_field_value is null or v_field_value = 'null'::jsonb then
      v_clause_result := 'UNKNOWN';
      v_missing := array_append(v_missing, v_clause ->> 'field_label');
    else
      v_result := case v_operator
        when 'EQ' then v_field_value = v_expected
        when 'NE' then v_field_value <> v_expected
        when 'GT' then (v_field_value ->> 'value')::numeric > (v_expected ->> 'value')::numeric
        when 'GTE' then (v_field_value ->> 'value')::numeric >= (v_expected ->> 'value')::numeric
        when 'LT' then (v_field_value ->> 'value')::numeric < (v_expected ->> 'value')::numeric
        when 'LTE' then (v_field_value ->> 'value')::numeric <= (v_expected ->> 'value')::numeric
        when 'IN' then v_expected ? (v_field_value ->> 'value')
        when 'IS_SET' then true
        when 'IS_EMPTY' then false
        else false
      end;
      v_clause_result := case when v_result then 'TRUE' else 'FALSE' end;
    end if;
    v_steps := v_steps || jsonb_build_object('step','condition','clause',v_clause ->> 'field_label','operator',v_operator,'result',v_clause_result);
    if v_logic = 'ALL' then
      if v_clause_result = 'FALSE' then
        v_cond_result := 'FALSE';
        exit;
      elsif v_clause_result = 'UNKNOWN' and v_cond_result = 'TRUE' then
        v_cond_result := 'UNKNOWN';
      end if;
    else -- ANY
      if v_clause_result = 'TRUE' then
        v_cond_result := 'TRUE';
        exit;
      elsif v_clause_result = 'UNKNOWN' and v_cond_result = 'FALSE' then
        v_cond_result := 'UNKNOWN';
      end if;
    end if;
  end loop;

  if v_cond_result = 'FALSE' then
    return jsonb_build_object('status','NOT_APPLICABLE','engine_version',v_engine,'condition_result','FALSE','steps',v_steps,'warnings',v_warnings,'mode',p_mode);
  end if;
  if v_cond_result = 'UNKNOWN' then
    return jsonb_build_object('status','PENDING_INPUT','engine_version',v_engine,'condition_result','UNKNOWN','missing',v_missing,'steps',v_steps,'warnings',v_warnings,'mode',p_mode);
  end if;

  -- 2) مبلغ مبنا (ورودی مشخص؛ صفر با ناموجود فرق دارد)
  v_method := coalesce(v_calc ->> 'method', 'FIXED');
  v_currency := coalesce(v_calc ->> 'currency', 'ریال');
  v_base_key := coalesce(v_calc ->> 'base_input', '');
  v_base_amount := null;
  if v_base_key <> '' and p_inputs ? v_base_key then
    v_base_amount := (p_inputs -> v_base_key ->> 'value')::numeric;
  end if;
  v_steps := v_steps || jsonb_build_object('step','base','method',v_method,'base_amount',v_base_amount,'currency',v_currency,'text','مبلغ مبنا: ' || coalesce(v_base_amount::text, 'نامشخص'));

  v_fixed := coalesce((v_calc ->> 'amount')::numeric, 0);
  v_rate := coalesce((v_calc ->> 'rate_percent')::numeric, 0);
  v_per_unit := coalesce(v_calc ->> 'per_unit', 'DAY');

  if v_method in ('PERCENT', 'PER_TIME_PERCENT') and v_base_amount is null then
    return jsonb_build_object('status','PENDING_INPUT','engine_version',v_engine,'missing',ARRAY[v_base_key],'steps',v_steps,'warnings',v_warnings,'mode',p_mode);
  end if;

  -- 3) بازهٔ زمان‌محور
  v_start_input := coalesce(v_calc ->> 'start_input', 'effective_deadline');
  v_end_input := coalesce(v_calc ->> 'end_input', 'payment_date');
  v_include_first := coalesce((v_calc ->> 'include_first_day')::boolean, false);
  v_accrual_calendar := coalesce(v_calc ->> 'accrual_calendar', 'CALENDAR_DAYS');

  if v_start_input = 'effective_deadline' then
    v_start := coalesce(nullif(trim(coalesce(p_inputs -> 'effective_deadline' ->> 'value', '')), '')::date, nullif(trim(coalesce(p_inputs -> 'deadline' ->> 'value', '')), '')::date);
  else
    v_start := nullif(trim(coalesce(p_inputs -> v_start_input ->> 'value', '')), '')::date;
  end if;
  if v_start is null then
    return jsonb_build_object('status','PENDING_INPUT','engine_version',v_engine,'missing',ARRAY['موعد مؤثر (مبدأ جریمه)'],'steps',v_steps,'warnings',v_warnings,'mode',p_mode);
  end if;
  v_effective_deadline := v_start;

  if v_end_input = 'calc_date' then
    v_end := current_date;
  else
    v_end := nullif(trim(coalesce(p_inputs -> v_end_input ->> 'value', '')), '')::date;
  end if;

  if v_end is not null and v_end > v_start then
    if v_accrual_calendar = 'WORKING_DAYS' then
      select * into v_cal from public.rule_center_working_calendars
      where "key" = coalesce(v_calc ->> 'working_calendar', 'iran_official') and is_active;
      if not found then v_cal.weekdays_off := ARRAY[6,0]; v_cal.use_iran_holidays := true; end if;
      v_iter := v_start;
      while v_iter < v_end loop
        v_iter := v_iter + 1;
        v_hol := extract(dow from v_iter)::int = any (v_cal.weekdays_off);
        if v_cal.use_iran_holidays and not v_hol then
          v_hol := exists (select 1 from public.iran_holidays where holiday_date = v_iter);
        end if;
        if not v_hol then v_days := v_days + 1; end if;
      end loop;
    else
      -- بازهٔ دیرکرد: روز موعد و روز انجام کار به‌طور پیش‌فرض شمرده نمی‌شوند
      -- (نمونهٔ سند: موعد ۱۵ اردیبهشت و انجام ۱۸ اردیبهشت → روزهای ۱۶ و ۱۷).
      v_days := (v_end - v_start)::int - 1
              + case when v_include_first then 1 else 0 end
              + case when coalesce((v_calc ->> 'include_end_day')::boolean, false) then 1 else 0 end;
      v_days := greatest(0, v_days);
    end if;
    v_steps := v_steps || jsonb_build_object('step','period','start',v_start,'end',v_end,'days',v_days,'text','روزهای مشمول: ' || v_days);
  elsif v_end is not null and v_end <= v_start then
    v_days := 0;
    v_steps := v_steps || jsonb_build_object('step','period','start',v_start,'end',v_end,'days',0,'text','هنوز دیرکردی محاسبه نشده');
  end if;

  -- 4) محاسبهٔ اصلی
  if v_method = 'FIXED' then
    v_gross := v_fixed;
    v_steps := v_steps || jsonb_build_object('step','calc','text','مبلغ ثابت: ' || v_fixed);
  elsif v_method = 'PERCENT' then
    v_gross := round(v_base_amount * v_rate / 100, 0);
    v_steps := v_steps || jsonb_build_object('step','calc','text',v_rate || '٪ از ' || v_base_amount);
  elsif v_method = 'PER_TIME_FIXED' then
    v_gross := v_fixed * v_days;
    v_steps := v_steps || jsonb_build_object('step','calc','text',v_fixed || ' × ' || v_days || ' روز');
  elsif v_method = 'PER_TIME_PERCENT' then
    v_gross := round(v_base_amount * v_rate / 100, 0) * v_days;
    v_steps := v_steps || jsonb_build_object('step','calc','text','روزانه ' || v_rate || '٪ از ' || v_base_amount || ' × ' || v_days || ' روز');
  elsif v_method = 'PER_UNIT' then
    v_gross := v_fixed * coalesce((p_inputs -> 'unit_count' ->> 'value')::numeric, 0);
    v_steps := v_steps || jsonb_build_object('step','calc','text',v_fixed || ' به ازای هر واحد');
  elsif v_method = 'TIERED' then
    v_gross := 0;
    v_tier_mode := coalesce(v_calc ->> 'tier_mode', 'BRACKET');
    if v_tier_mode = 'WHOLE' then
      -- نرخ هر پله بر کل مبلغ: بزرگ‌ترین پله‌ای که مبلغ داخلش است
      for v_tier in select * from jsonb_array_elements(coalesce(v_calc -> 'tiers', '[]'::jsonb)) loop
        if v_base_amount <= coalesce((v_tier ->> 'up_to')::numeric, 1e18) then
          v_gross := round(v_base_amount * coalesce((v_tier ->> 'rate_percent')::numeric, 0) / 100, 0);
          exit;
        end if;
      end loop;
    else
      -- نرخ هر بخش (BRACKET): هر پله روی بخشِ داخل مرز خودش
      declare
        v_prev numeric := 0;
        v_t_up numeric;
      begin
        for v_tier in select * from jsonb_array_elements(coalesce(v_calc -> 'tiers', '[]'::jsonb)) loop
          v_t_up := coalesce((v_tier ->> 'up_to')::numeric, v_base_amount);
          if v_base_amount > v_prev then
            v_gross := v_gross + round((least(v_base_amount, v_t_up) - v_prev) * coalesce((v_tier ->> 'rate_percent')::numeric, 0) / 100, 0);
          end if;
          v_prev := greatest(v_prev, v_t_up);
          if v_base_amount <= v_t_up then exit; end if;
        end loop;
      end;
    end if;
    v_steps := v_steps || jsonb_build_object('step','calc','text','پلکانی (' || v_tier_mode || '): ' || v_gross);
  elsif v_method = 'COMBINED' then
    v_gross := 0;
    for v_component in select * from jsonb_array_elements(coalesce(v_calc -> 'components', '[]'::jsonb)) loop
      declare
        v_c_type text := coalesce(v_component ->> 'type', 'FIXED');
        v_c_val numeric := 0;
      begin
        if v_c_type = 'FIXED' then
          v_c_val := coalesce((v_component ->> 'amount')::numeric, 0);
        elsif v_c_type = 'PERCENT' and v_base_amount is not null then
          v_c_val := round(v_base_amount * coalesce((v_component ->> 'rate_percent')::numeric, 0) / 100, 0);
        elsif v_c_type in ('PER_TIME_FIXED', 'PER_TIME_PERCENT') then
          if v_c_type = 'PER_TIME_FIXED' then
            v_c_val := coalesce((v_component ->> 'amount')::numeric, 0) * v_days;
          else
            v_c_val := round(v_base_amount * coalesce((v_component ->> 'rate_percent')::numeric, 0) / 100, 0) * v_days;
          end if;
        end if;
        v_gross := v_gross + v_c_val;
      end;
    end loop;
    v_steps := v_steps || jsonb_build_object('step','calc','text','ترکیبی: ' || v_gross);
  elsif v_method = 'REFERENCE_DECIDED' then
    v_gross := (p_inputs -> 'decided_amount' ->> 'value')::numeric;
    v_steps := v_steps || jsonb_build_object('step','calc','text','مبلغ ثبت‌شده توسط مرجع: ' || v_gross);
  else
    return jsonb_build_object('status','UNSUPPORTED','engine_version',v_engine,'error','روش محاسبهٔ پشتیبانی‌نشده: ' || v_method,'steps',v_steps,'warnings',v_warnings,'mode',p_mode);
  end if;

  -- 5) حدود، گردکردن و ترتیب اعمال (ثبت‌شده در تعریف)
  v_min := (v_calc -> 'limits' ->> 'min')::numeric;
  v_max := (v_calc -> 'limits' ->> 'max')::numeric;
  v_round_to := coalesce((v_calc -> 'limits' ->> 'round_to')::numeric, 1);
  v_rounding := coalesce(v_calc -> 'limits' ->> 'rounding', 'NEAREST');
  v_final := v_gross;
  if v_round_to > 1 then
    if v_rounding = 'UP' then
      v_final := ceil(v_final / v_round_to) * v_round_to;
    elsif v_rounding = 'DOWN' then
      v_final := floor(v_final / v_round_to) * v_round_to;
    else
      v_final := round(v_final / v_round_to) * v_round_to;
    end if;
  end if;
  if v_min is not null and v_final < v_min then v_final := v_min; end if;
  if v_max is not null and v_final > v_max then v_final := v_max; end if;
  v_steps := v_steps || jsonb_build_object('step','limits','before',v_gross,'after',v_final,'min',v_min,'max',v_max,'rounding',v_rounding,'round_to',v_round_to);

  if p_mode = 'REAL' then
    insert into public.rule_center_results (connection_id, version_id, tenant_id, kind, run_mode, status, inputs, output, engine_version)
    values (p_connection_id, p_version_id, p_tenant_id, 'PENALTY', 'REAL',
            case when v_decided_status = 'NEEDS_REFERENCE' then 'NEEDS_REFERENCE' else 'OK' end,
            p_inputs,
            jsonb_build_object('estimated_amount', v_final, 'currency', v_currency, 'days', v_days, 'steps', v_steps, 'is_estimate', true),
            v_engine);
  end if;

  return jsonb_build_object(
    'status','OK','engine_version',v_engine,'mode',p_mode,
    'estimated_amount', v_final,
    'currency', v_currency,
    'days', v_days,
    'is_estimate', true,
    'steps', v_steps,
    'warnings', v_warnings
  );
end;
$$;
revoke all on function public.rule_center_calc_penalty(uuid, jsonb, text, uuid, uuid) from public, anon;
grant execute on function public.rule_center_calc_penalty(uuid, jsonb, text, uuid, uuid) to authenticated;

create or replace function public.rule_center_run_test(
  p_version_id uuid,
  p_title text,
  p_inputs jsonb,
  p_expected jsonb
) returns uuid
language plpgsql security definer set search_path = pg_catalog as $$
declare
  uid uuid := auth.uid();
  v_kind text;
  v_actual jsonb;
  v_pass boolean;
  v_test_id uuid;
  v_exp_date date;
  v_act_date date;
begin
  if uid is null or not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;
  select r.kind into v_kind
  from public.rule_center_versions v join public.rule_center_rules r on r.id = v.rule_id
  where v.id = p_version_id;
  if not found then raise exception 'version not found' using errcode = 'P0002'; end if;

  if v_kind = 'PENALTY' then
    v_actual := public.rule_center_calc_penalty(p_version_id, p_inputs, 'PREVIEW');
  else
    v_actual := public.rule_center_calc_deadline(p_version_id, p_inputs, 'PREVIEW');
  end if;

  if v_kind = 'PENALTY' then
    v_pass := (v_actual ->> 'status') = coalesce(p_expected ->> 'status', 'OK')
          and abs(coalesce((v_actual ->> 'estimated_amount')::numeric, -1) - coalesce((p_expected ->> 'estimated_amount')::numeric, -2)) < 0.5;
  else
    v_exp_date := nullif(trim(coalesce(p_expected ->> 'effective_deadline', '')), '')::date;
    v_act_date := nullif(trim(coalesce(v_actual ->> 'effective_deadline', '')), '')::date;
    v_pass := (v_actual ->> 'status') = coalesce(p_expected ->> 'status', 'OK')
          and (v_exp_date is null or v_act_date = v_exp_date);
  end if;

  insert into public.rule_center_tests (version_id, title, inputs, expected, actual, status, run_at)
  values (p_version_id, p_title, p_inputs, p_expected, v_actual, case when v_pass then 'PASS' else 'FAIL' end, now())
  returning id into v_test_id;
  return v_test_id;
end;
$$;
revoke all on function public.rule_center_run_test(uuid, text, jsonb, jsonb) from public, anon;
grant execute on function public.rule_center_run_test(uuid, text, jsonb, jsonb) to authenticated;

commit;
