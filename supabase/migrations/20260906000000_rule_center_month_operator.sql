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
      v_base := coalesce((p_inputs -> 'period_start' ->> 'value')::date, null);
    elsif (v_dl -> 'interval' ->> 'base') = 'PERIOD_END' then
      v_base := coalesce((p_inputs -> 'period_end' ->> 'value')::date, null);
    elsif (v_dl -> 'interval' ->> 'base') = 'FISCAL_YEAR_START' then
      v_base := coalesce((p_inputs -> 'fiscal_year_start' ->> 'value')::date, null);
    elsif (v_dl -> 'interval' ->> 'base') = 'FISCAL_YEAR_END' then
      v_base := coalesce((p_inputs -> 'fiscal_year_end' ->> 'value')::date, null);
    end if;
    if v_base is null then
      return jsonb_build_object('status','PENDING_INPUT','engine_version',v_engine,'missing',ARRAY['منبع مبدأ (تاریخ پرونده/سال مالی)'],'steps','[]'::jsonb,'warnings',v_warnings,'mode',p_mode);
    end if;
    v_base_key := v_dl -> 'interval' ->> 'base';
  elsif v_base_key <> '' then
    if p_inputs ? v_base_key then
      v_base := (p_inputs -> v_base_key ->> 'value')::date;
    end if;
    if v_base is null then
      return jsonb_build_object('status','PENDING_INPUT','engine_version',v_engine,'missing',ARRAY[v_base_key],'steps','[]'::jsonb,'warnings',v_warnings,'mode',p_mode);
    end if;
  end if;

  v_period_start := coalesce((p_inputs -> 'period_start' ->> 'value')::date, v_base);
  v_period_end := coalesce((p_inputs -> 'period_end' ->> 'value')::date, v_base);
  v_fy_start := coalesce((p_inputs -> 'fiscal_year_start' ->> 'value')::date, v_period_start);
  v_fy_end := coalesce((p_inputs -> 'fiscal_year_end' ->> 'value')::date, v_period_end);

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
      v_candidate := (p_inputs -> (v_rec.value ->> 'input_key') ->> 'value')::date;
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
      v_pause_start := (p_inputs -> (v_pause ->> 'start_input') ->> 'value')::date;
      v_pause_end := (p_inputs -> (v_pause ->> 'end_input') ->> 'value')::date;
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
