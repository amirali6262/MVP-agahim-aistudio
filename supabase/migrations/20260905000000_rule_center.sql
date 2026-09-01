-- ==========================================================================
-- Migration: مرکز قواعد مهلت و جریمه (Rule Center)
-- Date: 2026-09-05
-- Purpose:
--   A shared, versioned center for recurrence / deadline / penalty rules.
--   Every usage site (obligation version, objection action step) connects to
--   a pinned rule version, never to a "latest" pointer. Rule versions have a
--   lifecycle (DRAFT → IN_REVIEW → APPROVED → PUBLISHED → STOPPED); published
--   versions are immutable. Computation goes through two reference RPCs
--   (deadline + penalty) with structured JSON in/out, three-valued condition
--   logic, Solar-Hijri month arithmetic, holiday/weekend handling driven by
--   the working-calendar reference (not hard-coded), decimal-safe money math
--   and a bounded, non-executable condition language (no eval / SQL).
--   Legacy simple deadline_rules / obligation_versions jsonb columns are left
--   untouched; this center adds an incremental path on top.
-- No legal rate, title or date is seeded as law: the only seed is a working
--   calendar reference row (configurable data, mirroring the weekend
--   convention already used by the existing engine) — no rule content.
-- ==========================================================================

begin;

-- ==========================================================================
-- 1. Working calendar reference (قابل ویرایش؛ تعطیلات از iran_holidays خوانده می‌شود)
-- ==========================================================================
create table if not exists public.rule_center_working_calendars (
  id uuid primary key default gen_random_uuid(),
  "key" text unique not null,
  title_fa text not null,
  description text,
  weekdays_off integer[] not null default '{}',
  use_iran_holidays boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- هم‌خانواده با قرارداد موتور فعلی (ARRAY[6,0] = شنبه/یکشنبه)؛ صرفاً دادهٔ مرجع قابل ویرایش، نه ادعای قانونی.
insert into public.rule_center_working_calendars ("key", title_fa, description, weekdays_off, use_iran_holidays)
values ('iran_official', 'تقویم کاری مرجع', 'روزهای غیرکاری پیش‌فرض از روی iran_holidays + آخر هفته خوانده می‌شوند؛ ادمین می‌تواند ویرایش کند.', ARRAY[6,0], true)
on conflict ("key") do nothing;

-- ==========================================================================
-- 2. هویت قاعده + نسخه‌ها (نسخه‌بندی، وضعیت و تعریف ساختاریافته)
-- ==========================================================================
create table if not exists public.rule_center_rules (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('RECURRENCE', 'DEADLINE', 'BOTH', 'PENALTY')),
  code text unique not null,
  title_fa text not null,
  summary text,
  domain text,
  authority text,
  legal_source text,
  legal_clause text,
  nature text not null default 'INTERNAL' check (nature in ('LEGAL', 'INTERNAL')),
  valid_from date,
  valid_to date,                       -- null = باز
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rule_center_rules_valid_range check (valid_to is null or valid_from is null or valid_to >= valid_from)
);

create table if not exists public.rule_center_versions (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.rule_center_rules(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'STOPPED')),
  definition jsonb not null default '{}'::jsonb,
  inputs jsonb not null default '[]'::jsonb,   -- [{key,label,type,unit,required,source}]
  summary text,
  technical_approved_by uuid,
  expert_approved_by uuid,
  technical_approved_at timestamptz,
  expert_approved_at timestamptz,
  published_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rule_center_versions_rule_number_key unique (rule_id, version_number)
);

create index if not exists rule_center_versions_rule_idx on public.rule_center_versions(rule_id, version_number);

-- ==========================================================================
-- 3. اتصال نسخه قاعده به محل استفاده (تعهد یا اقدام) + نگاشت ورودی‌ها
-- ==========================================================================
create table if not exists public.rule_center_connections (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.rule_center_versions(id) on delete cascade,
  target_type text not null check (target_type in ('OBLIGATION_VERSION', 'ACTION_STEP')),
  target_id uuid not null,
  -- برای ACTION_STEP: شناسهٔ پایدار اقدام (step_ref)؛ شناسهٔ uuid اقدام با هر ذخیره بازسازی می‌شود
  -- پس نمی‌تواند هویت پایدار اتصال باشد. target_id = الگو و target_ref = step_ref.
  target_ref text,
  mapping jsonb not null default '{}'::jsonb,  -- {input_key: {source_type, source_ref, ...}}
  status text not null default 'DRAFT' check (status in ('DRAFT', 'ACTIVE', 'HISTORY')),
  decided_status text not null default 'UNCHECKED'
    check (decided_status in ('UNCHECKED', 'NO_PENALTY', 'RULE_ATTACHED', 'NEEDS_REFERENCE')),
  decided_doc text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rule_center_connections_target_ref_required_for_step check (
    (target_type = 'ACTION_STEP' and target_ref is not null) or target_type <> 'ACTION_STEP'
  )
);

-- یکتایی اتصال فعال برای هر (نسخه قاعده، مقصد): جایگزینی فقط در تراکنش فعال‌سازی.
create unique index if not exists uq_rule_center_connections_active
  on public.rule_center_connections (version_id, target_type, target_id)
  where status = 'ACTIVE';

create index if not exists rule_center_connections_target_idx
  on public.rule_center_connections (target_type, target_id, status);

-- ==========================================================================
-- 4. نتیجهٔ محاسبه (ردپای ورودی/نسخه/تقویم/استثنا) + آزمون‌های نسخه قاعده
-- ==========================================================================
create table if not exists public.rule_center_results (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid references public.rule_center_connections(id) on delete set null,
  version_id uuid not null references public.rule_center_versions(id),
  tenant_id uuid,                        -- دامنهٔ شرکت (برای خواندن پروندهٔ واقعی)
  kind text not null check (kind in ('DEADLINE', 'PENALTY')),
  run_mode text not null default 'PREVIEW' check (run_mode in ('PREVIEW', 'REAL')),
  status text not null,
  inputs jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  engine_version text not null,
  run_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists rule_center_results_conn_idx on public.rule_center_results(connection_id, run_at desc);
create index if not exists rule_center_results_tenant_idx on public.rule_center_results(tenant_id, kind);

create table if not exists public.rule_center_tests (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.rule_center_versions(id) on delete cascade,
  title text not null,
  inputs jsonb not null default '{}'::jsonb,
  expected jsonb not null default '{}'::jsonb,   -- نتیجهٔ مورد انتظار ادمین (مستقل از موتور)
  actual jsonb,
  status text not null default 'PENDING' check (status in ('PENDING', 'PASS', 'FAIL')),
  run_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists rule_center_tests_version_idx on public.rule_center_tests(version_id);

-- ==========================================================================
-- 5. ستون‌های اتصال مهلت روی اقدام‌های الگوی فرایند (افزایشی؛ قدیمی‌ها null)
-- ==========================================================================
alter table public.objection_steps
  add column if not exists deadline_rule_version_id uuid,
  add column if not exists deadline_mapping jsonb not null default '{}'::jsonb;

-- ==========================================================================
-- 6. RLS و GRANT (قاعده مرکزی فقط ادمین پلتفرم می‌نویسد؛ شرکت فقط می‌خواند)
-- ==========================================================================
alter table public.rule_center_rules enable row level security;
alter table public.rule_center_versions enable row level security;
alter table public.rule_center_connections enable row level security;
alter table public.rule_center_results enable row level security;
alter table public.rule_center_tests enable row level security;
alter table public.rule_center_working_calendars enable row level security;

revoke all on table public.rule_center_rules, public.rule_center_versions,
  public.rule_center_connections, public.rule_center_results,
  public.rule_center_tests, public.rule_center_working_calendars
  from public, anon;

grant select on table public.rule_center_rules, public.rule_center_versions,
  public.rule_center_connections, public.rule_center_results,
  public.rule_center_tests, public.rule_center_working_calendars
  to authenticated;

-- خواندن برای همهٔ کاربران احرازشده (قواعد مرکزی عمومی‌اند)؛
-- نوشتن فقط از طریق RPCهای admin؛ جدول results برای کاربر شرکت در دامنهٔ خودش.
create policy rule_center_rules_read on public.rule_center_rules for select to authenticated using (true);
create policy rule_center_versions_read on public.rule_center_versions for select to authenticated using (true);
create policy rule_center_connections_read on public.rule_center_connections for select to authenticated using (true);
create policy rule_center_tests_read on public.rule_center_tests for select to authenticated using (true);
create policy rule_center_calendars_read on public.rule_center_working_calendars for select to authenticated using (true);
create policy rule_center_results_read_own_tenant on public.rule_center_results
  for select to authenticated
  using (private.is_platform_admin() or tenant_id is null
         or exists (select 1 from public.user_tenants ut
                    where ut.user_id = auth.uid() and ut.tenant_id = rule_center_results.tenant_id));

-- ==========================================================================
-- 7. توابع کمکی تقویم شمسی — پورت دقیق قرارداد تاریخ پروژه (lib/jalaliUtils.ts)
--    تبدیل‌ها روزمحور و منطقه‌زمان‌ناشناس هستند؛ روز هرگز جابه‌جا نمی‌شود.
-- ==========================================================================
create or replace function public.rule_center_jalali_leap(jy integer) returns boolean
language plpgsql immutable strict as $$
declare
  v_breaks integer[] := ARRAY[-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  v_jp integer := v_breaks[1];
  v_jump integer := 0;
  v_n integer;
  v_leap integer;
  i integer;
begin
  if jy < v_jp or jy >= v_breaks[array_length(v_breaks, 1)] then
    return false;
  end if;
  for i in 1..array_length(v_breaks, 1) loop
    v_jump := v_breaks[i] - v_jp;
    if jy < v_breaks[i] then exit; end if;
    v_jp := v_breaks[i];
  end loop;
  v_n := jy - v_jp;
  if v_jump - v_n < 6 then
    v_n := v_n - v_jump + (v_jump / 33) * 33;
  end if;
  v_leap := ((v_n + 1) % 33) - 1;
  if v_leap = -1 then v_leap := 33; end if;
  return (v_leap % 4) = 0;
end;
$$;

create or replace function public.rule_center_jalali_month_days(jy integer, jm integer) returns integer
language plpgsql immutable strict as $$
begin
  if jm between 1 and 6 then return 31; end if;
  if jm between 7 and 11 then return 30; end if;
  if jm = 12 then return case when public.rule_center_jalali_leap(jy) then 30 else 29 end; end if;
  return 30;
end;
$$;

-- میلادی → جلالی (پورت gregorianToJalali)
create or replace function public.rule_center_greg_to_jal(gy integer, gm integer, gd integer)
returns table (y integer, m integer, d integer)
language plpgsql immutable strict as $$
declare
  v_days integer;
  v_jy integer;
  v_gy2 integer;
begin
  v_gy2 := case when gm > 2 then gy + 1 else gy end;
  v_days := 355666 + 365 * gy
          + (v_gy2 + 3) / 4 - (v_gy2 + 99) / 100 + (v_gy2 + 399) / 400
          + gd
          + (case gm when 1 then 0 when 2 then 31 when 3 then 59 when 4 then 90 when 5 then 120
                     when 6 then 151 when 7 then 181 when 8 then 212 when 9 then 243 when 10 then 273
                     when 11 then 304 else 334 end);
  v_jy := -1595 + 33 * (v_days / 12053);
  v_days := v_days % 12053;
  v_jy := v_jy + 4 * (v_days / 1461);
  v_days := v_days % 1461;
  if v_days > 365 then
    v_jy := v_jy + (v_days - 1) / 365;
    v_days := (v_days - 1) % 365;
  end if;
  return query
    select case when v_days < 186 then v_jy else v_jy end as y,
           case when v_days < 186 then 1 + v_days / 31 else 7 + (v_days - 186) / 30 end as m,
           case when v_days < 186 then 1 + v_days % 31 else 1 + (v_days - 186) % 30 end as d;
end;
$$;

-- جلالی → میلادی (پورت jalaliToGregorian)
create or replace function public.rule_center_jalali_to_greg(jy integer, jm integer, jd integer) returns date
language plpgsql immutable strict as $$
declare
  v_adj integer := jy + 1595;
  v_days integer;
  v_gy integer;
  v_gm integer := 0;
  v_gd integer;
  v_feb integer;
  v_g_d_m integer[];
begin
  v_days := -355668 + 365 * v_adj + (v_adj / 33) * 8 + ((v_adj % 33) + 3) / 4 + jd
          + (case when jm < 7 then (jm - 1) * 31 else (jm - 7) * 30 + 186 end);
  v_gy := 400 * (v_days / 146097);
  v_days := v_days % 146097;
  if v_days > 36524 then
    v_days := v_days - 1;
    v_gy := v_gy + 100 * (v_days / 36524);
    v_days := v_days % 36524;
    if v_days >= 365 then v_days := v_days + 1; end if;
  end if;
  v_gy := v_gy + 4 * (v_days / 1461);
  v_days := v_days % 1461;
  if v_days > 365 then
    v_gy := v_gy + (v_days - 1) / 365;
    v_days := (v_days - 1) % 365;
  end if;
  v_feb := case when (v_gy % 4 = 0 and v_gy % 100 <> 0) or v_gy % 400 = 0 then 29 else 28 end;
  v_g_d_m := ARRAY[0, 31, v_feb, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  while v_gm < 13 and v_days >= v_g_d_m[v_gm + 1] loop
    v_days := v_days - v_g_d_m[v_gm + 1];
    v_gm := v_gm + 1;
  end loop;
  v_gd := v_days + 1;
  if v_gm = 0 then v_gm := 1; end if;
  return make_date(v_gy, v_gm, v_gd);
end;
$$;

-- افزودن ماه با تقویم شمسی؛ سیاست روز ناموجود: LAST_DAY | ERROR | FIRST_DAY_NEXT
create or replace function public.rule_center_jalali_add_months(
  p_date date,
  p_months integer,
  p_missing_policy text default 'LAST_DAY'
) returns date
language plpgsql immutable strict as $$
declare
  v_jy integer; v_jm integer; v_jd integer;
  v_total integer;
  v_ny integer; v_nm integer;
  v_max integer;
begin
  select t.y, t.m, t.d into v_jy, v_jm, v_jd
  from public.rule_center_greg_to_jal(
    extract(year from p_date)::int, extract(month from p_date)::int, extract(day from p_date)::int
  ) t;
  v_total := v_jy * 12 + (v_jm - 1) + p_months;
  v_ny := v_total / 12;
  v_nm := (v_total % 12) + 1;
  if v_nm < 1 then
    v_nm := v_nm + 12;
    v_ny := v_ny - 1;
  end if;
  v_max := public.rule_center_jalali_month_days(v_ny, v_nm);
  if v_jd > v_max then
    if p_missing_policy = 'LAST_DAY' then
      v_jd := v_max;
    elsif p_missing_policy = 'FIRST_DAY_NEXT' then
      v_jd := 1;
      v_nm := v_nm + 1;
      if v_nm > 12 then v_nm := 1; v_ny := v_ny + 1; end if;
    else
      raise exception 'روز % در ماه %/% وجود ندارد (سیاست ERROR)', v_jd, v_nm, v_ny;
    end if;
  end if;
  return public.rule_center_jalali_to_greg(v_ny, v_nm, v_jd);
end;
$$;

-- 8. اعتبارسنجی ساختاری تعریف قاعده (بدون اجرای کد؛ فقط قرارداد بسته)
-- ==========================================================================
create or replace function public.rule_center_validate_definition(
  p_kind text,
  p_definition jsonb,
  p_inputs jsonb
) returns void
language plpgsql as $$
declare
  v_allowed text[];
  v_rec record;
  v_key text;
begin
  if p_definition is null or jsonb_typeof(p_definition) <> 'object' then
    raise exception 'تعریف قاعده باید یک شیء ساختاریافته باشد' using errcode = '22023';
  end if;
  -- هیچ فرمول/کد/SQL آزاد در تعریف پذیرفته نمی‌شود.
  if p_definition ? 'formula' or p_definition ? 'sql' or p_definition ? 'code' or p_definition ? 'eval' then
    raise exception 'اجرای فرمول/کد آزاد در قاعده پشتیبانی نمی‌شود' using errcode = '22023';
  end if;
  if p_kind in ('RECURRENCE', 'DEADLINE', 'BOTH') then
    v_allowed := ARRAY['recurrence', 'deadline', 'reminders', 'nature'];
  elsif p_kind = 'PENALTY' then
    v_allowed := ARRAY['conditions', 'calculation', 'decided', 'nature'];
  else
    raise exception 'نوع قاعده نامعتبر است' using errcode = '22023';
  end if;
  -- محدودسازی عملگرها: هیچ کلید ناشناختهٔ سطح بالایی پذیرفته نمی‌شود.
  for v_key in select jsonb_object_keys(p_definition) loop
    if not (v_key = any (v_allowed)) then
      raise exception 'کلید ناشناخته در تعریف قاعده: %', v_key using errcode = '22023';
    end if;
  end loop;
  -- ورودی‌ها: آرایهٔ ساختاریافته با کلید یکتا و نوع مجاز.
  if p_inputs is null or jsonb_typeof(p_inputs) <> 'array' then
    raise exception 'ورودی‌های قاعده باید آرایه باشند' using errcode = '22023';
  end if;
  for v_rec in select * from jsonb_array_elements(p_inputs) as t(value) loop
    if btrim(coalesce(v_rec.value ->> 'key', '')) = '' or btrim(coalesce(v_rec.value ->> 'label', '')) = '' then
      raise exception 'هر ورودی باید کلید و برچسب فارسی داشته باشد' using errcode = '22023';
    end if;
    if not (coalesce(v_rec.value ->> 'type', '') in ('DATE', 'DATETIME', 'AMOUNT', 'NUMBER', 'TEXT', 'SELECT', 'BOOL', 'PERIOD_REF', 'FISCAL_YEAR_REF', 'CASE_EVENT', 'RULE_OUTPUT')) then
      raise exception 'نوع ورودی «%» پشتیبانی نمی‌شود', v_rec.value ->> 'type' using errcode = '22023';
    end if;
  end loop;
end;
$$;

-- ==========================================================================
-- 9. نسخهٔ منتشرشده/متوقف، تغییرناپذیر است (هیچ مسیر نوشتنی آن را بازنویسی نکند)
-- ==========================================================================
create or replace function public.rule_center_version_immutable()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
begin
  if old.status in ('APPROVED', 'PUBLISHED', 'STOPPED')
     and (new.definition is distinct from old.definition
          or new.inputs is distinct from old.inputs
          or new.rule_id is distinct from old.rule_id
          or new.version_number is distinct from old.version_number) then
    raise exception 'نسخهٔ منتشرشده/تأییدشدهٔ قاعده تغییرناپذیر است؛ تغییر فقط با نسخهٔ جدید' using errcode = '23514';
  end if;
  -- انتقال‌های مجاز: APPROVED→PUBLISHED و APPROVED/PUBLISHED→STOPPED (توقف استفادهٔ جدید).
  if old.status in ('APPROVED', 'PUBLISHED', 'STOPPED') and new.status <> old.status
     and not ((old.status = 'APPROVED' and new.status = 'PUBLISHED')
              or (old.status in ('APPROVED', 'PUBLISHED') and new.status = 'STOPPED')) then
    raise exception 'انتقال وضعیت نسخه از «%» به «%» مجاز نیست', old.status, new.status using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.rule_center_version_immutable() from public, anon, authenticated, service_role;
drop trigger if exists rule_center_version_immutable on public.rule_center_versions;
create trigger rule_center_version_immutable
  before update on public.rule_center_versions
  for each row execute function public.rule_center_version_immutable();

-- اتصال فعال فقط به نسخهٔ منتشرشده (برای استفادهٔ واقعی)؛ پیش‌نویس می‌تواند به پیش‌نویس وصل شود.
create or replace function public.rule_center_connection_guard()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_ok boolean;
begin
  if new.status = 'ACTIVE' then
    select true into v_ok from public.rule_center_versions v
    where v.id = new.version_id and v.status = 'PUBLISHED';
    if not coalesce(v_ok, false) then
      raise exception 'اتصال فعال فقط به نسخهٔ منتشرشدهٔ قاعده مجاز است' using errcode = '23514';
    end if;
  end if;
  -- مقصد باید معتبر و موجود باشد (ترکیب نوع + شناسه بدون کنترل وجود مجاز نیست).
  if new.target_type = 'OBLIGATION_VERSION' then
    if not exists (select 1 from public.obligation_versions where id = new.target_id) then
      raise exception 'نسخهٔ تعهد مقصد یافت نشد' using errcode = '23503';
    end if;
  elsif new.target_type = 'ACTION_STEP' then
    -- اقدام با شناسهٔ پایدار (step_ref) در همان الگو باید موجود باشد
    if not exists (select 1 from public.objection_steps s
                   where s.template_id = new.target_id and s.step_ref = new.target_ref) then
      raise exception 'اقدام مقصد (step_ref) در الگو یافت نشد' using errcode = '23503';
    end if;
  else
    raise exception 'نوع مقصد نامعتبر است' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function public.rule_center_connection_guard() from public, anon, authenticated, service_role;
drop trigger if exists rule_center_connection_guard on public.rule_center_connections;
create trigger rule_center_connection_guard
  before insert or update of version_id, status, target_type, target_id
  on public.rule_center_connections
  for each row execute function public.rule_center_connection_guard();

-- ==========================================================================
-- 10. بررسی آمادگی انتشار (قابل استفاده در UI و تریگر انتشار تعهد/فعال‌سازی الگو)
-- ==========================================================================
create or replace function public.rule_center_publish_check(p_connection_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_conn record;
  v_checks jsonb := '[]'::jsonb;
  v_ok boolean := true;
  v_missing text[] := '{}'::text[];
  v_rec record;
  v_in jsonb;
  v_tests_ok boolean;
begin
  select c.*, r.kind, r.legal_source, r.nature, v.version_number, v.status as vstatus
    into v_conn
  from public.rule_center_connections c
  join public.rule_center_versions v on v.id = c.version_id
  join public.rule_center_rules r on r.id = v.rule_id
  where c.id = p_connection_id;
  if not found then
    raise exception 'اتصال یافت نشد' using errcode = 'P0002';
  end if;

  -- ۱) نسخه منتشر شده باشد
  if v_conn.vstatus = 'PUBLISHED' then
    v_checks := v_checks || jsonb_build_object('key','version_status','ok',true,'label','نسخهٔ قاعده منتشر شده است');
  else
    v_ok := false;
    v_checks := v_checks || jsonb_build_object('key','version_status','ok',false,'label','نسخهٔ قاعده باید «منتشرشده» باشد (وضعیت فعلی: ' || v_conn.vstatus || ')');
  end if;

  -- ۲) ورودی‌های الزامی نگاشت معتبر داشته باشند
  for v_rec in select * from jsonb_array_elements(coalesce(v_conn.inputs, '[]'::jsonb)) as t(value) loop
    v_in := v_rec.value;
    if coalesce((v_in ->> 'required')::boolean, false) and not (v_conn.mapping ? (v_in ->> 'key')) then
      v_missing := array_append(v_missing, v_in ->> 'label');
    end if;
  end loop;
  if array_length(v_missing, 1) is null then
    v_checks := v_checks || jsonb_build_object('key','inputs_mapped','ok',true,'label','ورودی‌های الزامی اتصال معتبر دارند');
  else
    v_ok := false;
    v_checks := v_checks || jsonb_build_object('key','inputs_mapped','ok',false,'label','ورودی‌های الزامی بدون اتصال: ' || array_to_string(v_missing, '، '));
  end if;

  -- ۳) منبع قانونی (فقط برای قاعده با ماهیت LEGAL)
  if v_conn.nature = 'LEGAL' and coalesce(v_conn.legal_source, '') = '' then
    v_ok := false;
    v_checks := v_checks || jsonb_build_object('key','legal_source','ok',false,'label','منبع قانونی برای قاعدهٔ قانونی اجباری است');
  else
    v_checks := v_checks || jsonb_build_object('key','legal_source','ok',true,'label','منبع و ماهیت قاعده مشخص است');
  end if;

  -- ۴) دست‌کم یک آزمون موفق برای نسخه
  select exists (select 1 from public.rule_center_tests t where t.version_id = v_conn.version_id and t.status = 'PASS')
    into v_tests_ok;
  if v_tests_ok then
    v_checks := v_checks || jsonb_build_object('key','tests','ok',true,'label','آزمون موفق برای این نسخه ثبت شده است');
  else
    v_ok := false;
    v_checks := v_checks || jsonb_build_object('key','tests','ok',false,'label','دست‌کم یک آزمون موفق برای این نسخه لازم است');
  end if;

  -- ۵) وضعیت جریمهٔ تعهد مشخص باشد (فقط اتصال جریمه)
  if v_conn.kind = 'PENALTY' and v_conn.decided_status = 'UNCHECKED' then
    v_ok := false;
    v_checks := v_checks || jsonb_build_object('key','penalty_decided','ok',false,'label','وضعیت جریمه باید مشخص شود (بررسی‌شده، بدون جریمه یا نیازمند مرجع)');
  elsif v_conn.kind = 'PENALTY' then
    v_checks := v_checks || jsonb_build_object('key','penalty_decided','ok',true,'label','وضعیت جریمه مشخص است');
  else
    v_checks := v_checks || jsonb_build_object('key','penalty_decided','ok',true,'label','قاعدهٔ جریمه نیست');
  end if;

  return jsonb_build_object('ok', v_ok, 'checks', v_checks);
end;
$$;

-- تریگر انتشار تعهد: با وجود اتصال ناقص/نامعتبر، انتشار مسدود است.
-- (تعهدهای قدیمی بدون اتصال، محدود نمی‌شوند.)
create or replace function public.obligation_publish_rule_center_gate()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_conn record;
  v_check jsonb;
begin
  if new.status = 'PUBLISHED' and old.status is distinct from 'PUBLISHED' then
    for v_conn in
      select c.id from public.rule_center_connections c
      where c.target_type = 'OBLIGATION_VERSION' and c.target_id = new.id
    loop
      v_check := public.rule_center_publish_check(v_conn.id);
      if not (v_check ->> 'ok')::boolean then
        raise exception 'انتشار تعهد مسدود است: %',
          (select string_agg(ch ->> 'label', '؛ ') from jsonb_array_elements(v_check -> 'checks') ch where not (ch ->> 'ok')::boolean)
          using errcode = '23514';
      end if;
    end loop;
  end if;
  return new;
end;
$$;
revoke all on function public.obligation_publish_rule_center_gate() from public, anon, authenticated, service_role;
drop trigger if exists obligation_publish_rule_center_gate on public.obligation_versions;
create trigger obligation_publish_rule_center_gate
  before update of status on public.obligation_versions
  for each row execute function public.obligation_publish_rule_center_gate();

-- تریگر فعال‌سازی الگوی فرایند: اقدام‌های دارای اتصال مهلت باید نسخهٔ منتشرشده داشته باشند.
create or replace function public.objection_activate_rule_center_gate()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_bad text;
begin
  if new.status = 'ACTIVE' and old.status is distinct from 'ACTIVE' then
    select string_agg(s.title, '، ') into v_bad
    from public.objection_steps s
    where s.template_id = new.id
      and s.deadline_rule_version_id is not null
      and not exists (
        select 1 from public.rule_center_versions v
        where v.id = s.deadline_rule_version_id and v.status = 'PUBLISHED'
      );
    if v_bad is not null then
      raise exception 'اقدام‌های زیر به نسخهٔ منتشرنشدهٔ قاعدهٔ مهلت متصل‌اند: %', v_bad using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.objection_activate_rule_center_gate() from public, anon, authenticated, service_role;
drop trigger if exists objection_activate_rule_center_gate on public.objection_templates;
create trigger objection_activate_rule_center_gate
  before update of status on public.objection_templates
  for each row execute function public.objection_activate_rule_center_gate();

-- ==========================================================================
-- 11. موتور محاسبهٔ مهلت (مرجع مشترک برای پیش‌نمایش و اجرا)
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
      v_deadline := public.rule_center_jalali_add_months(v_base, v_interval_value, v_missing_policy);
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

-- ==========================================================================
-- 12. موتور محاسبهٔ جریمه (شرط سه‌حالته؛ ریاضی ده‌دهی؛ بدون eval)
-- ==========================================================================
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
    v_start := coalesce((p_inputs -> 'effective_deadline' ->> 'value')::date, (p_inputs -> 'deadline' ->> 'value')::date);
  else
    v_start := (p_inputs -> v_start_input ->> 'value')::date;
  end if;
  if v_start is null then
    return jsonb_build_object('status','PENDING_INPUT','engine_version',v_engine,'missing',ARRAY['موعد مؤثر (مبدأ جریمه)'],'steps',v_steps,'warnings',v_warnings,'mode',p_mode);
  end if;
  v_effective_deadline := v_start;

  if v_end_input = 'calc_date' then
    v_end := current_date;
  else
    v_end := (p_inputs -> v_end_input ->> 'value')::date;
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

-- ==========================================================================
-- 13. RPCهای مدیریتی (فقط ادمین پلتفرم؛ تراکنشی)
-- ==========================================================================

-- ذخیرهٔ اتمیک قاعده + اولین نسخه (یا نسخهٔ پیش‌نویس جدید برای قاعدهٔ موجود)
create or replace function public.rule_center_save_rule(
  p_rule_id uuid,
  p_kind text,
  p_code text,
  p_title_fa text,
  p_summary text,
  p_domain text,
  p_authority text,
  p_legal_source text,
  p_legal_clause text,
  p_nature text,
  p_valid_from date,
  p_valid_to date,
  p_definition jsonb,
  p_inputs jsonb,
  p_version_id uuid default null
) returns uuid
language plpgsql security definer set search_path = pg_catalog as $$
declare
  uid uuid := auth.uid();
  v_rule_id uuid := p_rule_id;
  v_version_id uuid := p_version_id;
  v_existing_version integer;
begin
  if uid is null or not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;
  if btrim(coalesce(p_title_fa, '')) = '' or btrim(coalesce(p_code, '')) = '' then
    raise exception 'عنوان و کلید فنی قاعده الزامی است' using errcode = '22023';
  end if;
  perform public.rule_center_validate_definition(p_kind, p_definition, p_inputs);

  if v_rule_id is null then
    insert into public.rule_center_rules (kind, code, title_fa, summary, domain, authority, legal_source, legal_clause, nature, valid_from, valid_to)
    values (p_kind, upper(p_code), btrim(p_title_fa), p_summary, p_domain, p_authority, p_legal_source, p_legal_clause, coalesce(p_nature, 'INTERNAL'), p_valid_from, p_valid_to)
    returning id into v_rule_id;
  else
    update public.rule_center_rules
    set title_fa = btrim(p_title_fa), summary = p_summary, domain = p_domain, authority = p_authority,
        legal_source = p_legal_source, legal_clause = p_legal_clause, nature = coalesce(p_nature, 'INTERNAL'),
        valid_from = p_valid_from, valid_to = p_valid_to, updated_at = now()
    where id = v_rule_id and kind = p_kind;
    if not found then
      raise exception 'قاعده یافت نشد یا نوع آن تغییر کرده است' using errcode = 'P0002';
    end if;
  end if;

  if v_version_id is null then
    select coalesce(max(version_number), 0) + 1 into v_existing_version
    from public.rule_center_versions where rule_id = v_rule_id;
    insert into public.rule_center_versions (rule_id, version_number, status, definition, inputs, summary, created_by)
    values (v_rule_id, v_existing_version, 'DRAFT', p_definition, p_inputs, p_summary, uid)
    returning id into v_version_id;
  else
    -- فقط پیش‌نویس قابل ویرایش است
    update public.rule_center_versions
    set definition = p_definition, inputs = p_inputs, summary = p_summary, updated_at = now()
    where id = v_version_id and rule_id = v_rule_id and status = 'DRAFT';
    if not found then
      raise exception 'نسخه یافت نشد یا دیگر پیش‌نویس نیست (نسخهٔ منتشرشده تغییرناپذیر است)' using errcode = '23514';
    end if;
  end if;

  return v_rule_id;
end;
$$;
revoke all on function public.rule_center_save_rule(uuid, text, text, text, text, text, text, text, text, text, date, date, jsonb, jsonb, uuid) from public, anon;
grant execute on function public.rule_center_save_rule(uuid, text, text, text, text, text, text, text, text, text, date, date, jsonb, jsonb, uuid) to authenticated;

-- نسخهٔ جدید از روی نسخهٔ منتشرشده (محتوا تغییرناپذیر می‌ماند)
create or replace function public.rule_center_new_version(
  p_rule_id uuid,
  p_definition jsonb,
  p_inputs jsonb
) returns uuid
language plpgsql security definer set search_path = pg_catalog as $$
declare
  uid uuid := auth.uid();
  v_next integer;
  v_id uuid;
begin
  if uid is null or not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;
  select coalesce(max(version_number), 0) + 1 into v_next
  from public.rule_center_versions where rule_id = p_rule_id;
  insert into public.rule_center_versions (rule_id, version_number, status, definition, inputs, created_by)
  values (p_rule_id, v_next, 'DRAFT', p_definition, p_inputs, uid)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.rule_center_new_version(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.rule_center_new_version(uuid, jsonb, jsonb) to authenticated;

-- تکثیر: قاعدهٔ مستقل جدید با وضعیت پیش‌نویس (تأیید/انتشار قبلی به ارث نمی‌رسد)
create or replace function public.rule_center_duplicate_rule(p_rule_id uuid) returns uuid
language plpgsql security definer set search_path = pg_catalog as $$
declare
  uid uuid := auth.uid();
  v_rule record;
  v_version record;
  v_new_rule uuid;
  v_new_version uuid;
begin
  if uid is null or not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;
  select * into v_rule from public.rule_center_rules where id = p_rule_id;
  if not found then raise exception 'rule not found' using errcode = 'P0002'; end if;
  select * into v_version from public.rule_center_versions v
  where v.rule_id = p_rule_id order by v.version_number desc limit 1;
  if not found then raise exception 'no version' using errcode = 'P0002'; end if;

  insert into public.rule_center_rules (kind, code, title_fa, summary, domain, authority, legal_source, legal_clause, nature, valid_from, valid_to)
  values (v_rule.kind, upper(v_rule.code) || '_COPY', v_rule.title_fa || ' (کپی)', v_rule.summary, v_rule.domain, v_rule.authority,
          v_rule.legal_source, v_rule.legal_clause, v_rule.nature, v_rule.valid_from, v_rule.valid_to)
  returning id into v_new_rule;

  insert into public.rule_center_versions (rule_id, version_number, status, definition, inputs, summary, created_by)
  values (v_new_rule, 1, 'DRAFT', v_version.definition, v_version.inputs, v_version.summary, uid)
  returning id into v_new_version;
  return v_new_rule;
end;
$$;
revoke all on function public.rule_center_duplicate_rule(uuid) from public, anon;
grant execute on function public.rule_center_duplicate_rule(uuid) to authenticated;

-- توقف استفادهٔ جدید (سابقهٔ پرونده‌ها حفظ می‌شود)
create or replace function public.rule_center_stop_usage(p_rule_id uuid) returns void
language plpgsql security definer set search_path = pg_catalog as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;
  update public.rule_center_versions
  set status = 'STOPPED'
  where rule_id = p_rule_id and status in ('PUBLISHED', 'APPROVED');
end;
$$;
revoke all on function public.rule_center_stop_usage(uuid) from public, anon;
grant execute on function public.rule_center_stop_usage(uuid) to authenticated;

-- حذف فقط برای قاعدهٔ پیش‌نویس بدون اتصال
create or replace function public.rule_center_delete_draft(p_rule_id uuid) returns void
language plpgsql security definer set search_path = pg_catalog as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.rule_center_versions v
    join public.rule_center_connections c on c.version_id = v.id
    where v.rule_id = p_rule_id
  ) then
    raise exception 'قاعده دارای اتصال است و حذف نمی‌شود' using errcode = '23503';
  end if;
  if exists (
    select 1 from public.rule_center_versions v
    where v.rule_id = p_rule_id and v.status <> 'DRAFT'
  ) then
    raise exception 'فقط قاعدهٔ کاملاً پیش‌نویس حذف می‌شود' using errcode = '23514';
  end if;
  delete from public.rule_center_rules where id = p_rule_id;
end;
$$;
revoke all on function public.rule_center_delete_draft(uuid) from public, anon;
grant execute on function public.rule_center_delete_draft(uuid) to authenticated;

-- انتقال وضعیت نسخه (پیش‌نویس → بازبینی → تأیید → انتشار) با ثبت تأییدها
create or replace function public.rule_center_transition(
  p_version_id uuid,
  p_to text,
  p_expert_note text default null
) returns void
language plpgsql security definer set search_path = pg_catalog as $$
declare
  uid uuid := auth.uid();
  v_rule_id uuid;
  v_checks jsonb;
  v_conn record;
begin
  if uid is null or not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;
  if p_to not in ('IN_REVIEW', 'APPROVED', 'PUBLISHED') then
    raise exception 'مقصد نامعتبر' using errcode = '22023';
  end if;
  select rule_id into v_rule_id from public.rule_center_versions where id = p_version_id;
  if not found then raise exception 'version not found' using errcode = 'P0002'; end if;

  if p_to = 'IN_REVIEW' then
    update public.rule_center_versions set status = 'IN_REVIEW', updated_at = now()
    where id = p_version_id and status = 'DRAFT';
  elsif p_to = 'APPROVED' then
    -- تأیید فنی (ادمین) و تخصصی (محتوا) جدا ثبت می‌شوند؛ برای پیش‌فرض، هر دو توسط ادمین جاری.
    update public.rule_center_versions
    set status = 'APPROVED', technical_approved_by = uid, technical_approved_at = now(),
        expert_approved_by = uid, expert_approved_at = now(), updated_at = now()
    where id = p_version_id and status = 'IN_REVIEW';
    if not found then
      raise exception 'فقط نسخهٔ «در بررسی» تأیید می‌شود' using errcode = '23514';
    end if;
  elsif p_to = 'PUBLISHED' then
    -- پیش از انتشار: همهٔ اتصال‌های فعال باید کنترل آمادگی را بگذرانند
    for v_conn in
      select c.id from public.rule_center_connections c
      where c.version_id = p_version_id and c.status = 'ACTIVE'
    loop
      v_checks := public.rule_center_publish_check(v_conn.id);
      if not (v_checks ->> 'ok')::boolean then
        raise exception 'انتشار قاعده مسدود است (اتصال ناقص): %',
          (select string_agg(ch ->> 'label', '؛ ') from jsonb_array_elements(v_checks -> 'checks') ch where not (ch ->> 'ok')::boolean)
          using errcode = '23514';
      end if;
    end loop;
    update public.rule_center_versions
    set status = 'PUBLISHED', published_at = now(), updated_at = now()
    where id = p_version_id and status = 'APPROVED';
    if not found then
      raise exception 'فقط نسخهٔ «تأییدشده» منتشر می‌شود' using errcode = '23514';
    end if;
  end if;
end;
$$;
revoke all on function public.rule_center_transition(uuid, text, text) from public, anon;
grant execute on function public.rule_center_transition(uuid, text, text) to authenticated;

-- ذخیرهٔ اتصال (تعویض اتصال فعال، قبلی را HISTORY می‌کند؛ یک تراکنش)
create or replace function public.rule_center_save_connection(
  p_version_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_mapping jsonb,
  p_decided_status text default 'UNCHECKED',
  p_decided_doc text default null,
  p_active boolean default true,
  p_target_ref text default null
) returns uuid
language plpgsql security definer set search_path = pg_catalog as $$
declare
  uid uuid := auth.uid();
  v_conn uuid;
  v_rule_kind text;
  v_required_keys text[] := '{}'::text[];
  v_ref text;
  v_rec record;
begin
  if uid is null or not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;
  if p_mapping is null or jsonb_typeof(p_mapping) <> 'object' then
    raise exception 'نگاشت ورودی‌ها باید شیء ساختاریافته باشد' using errcode = '22023';
  end if;
  select r.kind into v_rule_kind
  from public.rule_center_versions v join public.rule_center_rules r on r.id = v.rule_id
  where v.id = p_version_id;
  if not found then raise exception 'version not found' using errcode = 'P0002'; end if;

  -- نگاشت باید زیرمجموعهٔ ورودی‌های تعریف‌شده باشد
  if not (p_mapping = '{}'::jsonb) then
    for v_rec in select * from jsonb_array_elements(coalesce((select inputs from public.rule_center_versions where id = p_version_id), '[]'::jsonb)) as t(value) loop
      v_ref := v_rec.value ->> 'key';
      if coalesce((v_rec.value ->> 'required')::boolean, false)
         and v_ref is not null and v_ref <> '' and not (p_mapping ? v_ref) then
        raise exception 'ورودی الزامی «%» در نگاشت اتصال تعیین نشده است', v_ref using errcode = '23514';
      end if;
    end loop;
    if exists (
      select 1
      from jsonb_object_keys(p_mapping) k
      where not exists (
        select 1 from jsonb_array_elements(coalesce((select inputs from public.rule_center_versions where id = p_version_id), '[]'::jsonb)) t
        where t.value ->> 'key' = k
      )
    ) then
      raise exception 'نگاشت شامل کلید ورودی ناشناخته است' using errcode = '22023';
    end if;
  end if;

  if p_target_type = 'ACTION_STEP' and p_target_ref is null then
    raise exception 'برای اقدام، شناسهٔ پایدار اقدام (step_ref) الزامی است' using errcode = '22023';
  end if;
  if p_active then
    update public.rule_center_connections
    set status = 'HISTORY', updated_at = now()
    where target_type = p_target_type and target_id = p_target_id and status = 'ACTIVE'
      and version_id <> p_version_id
      and (p_target_type <> 'ACTION_STEP' or target_ref = p_target_ref);
    update public.rule_center_connections
    set version_id = p_version_id, mapping = p_mapping, target_ref = p_target_ref,
        decided_status = coalesce(p_decided_status, 'UNCHECKED'), decided_doc = p_decided_doc,
        decided_by = case when p_decided_status is not null then uid end,
        decided_at = case when p_decided_status is not null then now() end,
        status = 'ACTIVE', updated_at = now()
    where target_type = p_target_type and target_id = p_target_id and status = 'ACTIVE'
      and version_id = p_version_id
      and (p_target_type <> 'ACTION_STEP' or target_ref = p_target_ref)
    returning id into v_conn;
    if v_conn is null then
      insert into public.rule_center_connections (version_id, target_type, target_id, target_ref, mapping, status, decided_status, decided_doc, decided_by, decided_at)
      values (p_version_id, p_target_type, p_target_id, p_target_ref, p_mapping, 'ACTIVE', coalesce(p_decided_status, 'UNCHECKED'), p_decided_doc,
              case when p_decided_status is not null then uid end, case when p_decided_status is not null then now() end)
      returning id into v_conn;
    end if;
  else
    insert into public.rule_center_connections (version_id, target_type, target_id, target_ref, mapping, status, decided_status, decided_doc)
    values (p_version_id, p_target_type, p_target_id, p_target_ref, p_mapping, 'DRAFT', coalesce(p_decided_status, 'UNCHECKED'), p_decided_doc)
    returning id into v_conn;
  end if;
  return v_conn;
end;
$$;
revoke all on function public.rule_center_save_connection(uuid, text, uuid, jsonb, text, text, boolean, text) from public, anon;
grant execute on function public.rule_center_save_connection(uuid, text, uuid, jsonb, text, text, boolean, text) to authenticated;

-- ثبت «بدون جریمه» مستند (جدا از بررسی‌نشده)
create or replace function public.rule_center_decide_no_penalty(
  p_connection_id uuid,
  p_doc text
) returns void
language plpgsql security definer set search_path = pg_catalog as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;
  update public.rule_center_connections
  set decided_status = 'NO_PENALTY', decided_doc = p_doc, decided_by = uid, decided_at = now(), updated_at = now()
  where id = p_connection_id;
end;
$$;
revoke all on function public.rule_center_decide_no_penalty(uuid, text) from public, anon;
grant execute on function public.rule_center_decide_no_penalty(uuid, text) to authenticated;

-- اجرای آزمون نسخه قاعده (نتیجهٔ مورد انتظار ادمین با خروجی موتور مقایسه می‌شود)
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
    v_exp_date := (p_expected ->> 'effective_deadline')::date;
    v_act_date := (v_actual ->> 'effective_deadline')::date;
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

-- محل‌های استفادهٔ یک نسخه
create or replace function public.rule_center_usage(p_version_id uuid)
returns jsonb language sql stable security definer set search_path = pg_catalog as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'status', c.status, 'target_type', c.target_type, 'target_id', c.target_id,
    'mapping', c.mapping, 'decided_status', c.decided_status,
    'obligation_title', o.title,
    'step_title', s.title,
    'template_title', t.title
  )), '[]'::jsonb)
  from public.rule_center_connections c
  left join public.obligation_versions ov on ov.id = c.target_id and c.target_type = 'OBLIGATION_VERSION'
  left join public.obligation_definitions o on o.id = ov.obligation_id
  left join public.objection_steps s on s.template_id = c.target_id and s.step_ref = c.target_ref and c.target_type = 'ACTION_STEP'
  left join public.objection_templates t on t.id = s.template_id
  where c.version_id = p_version_id
$$;
revoke all on function public.rule_center_usage(uuid) from public, anon;
grant execute on function public.rule_center_usage(uuid) to authenticated;

-- نسخه‌های واجد شرایط بر اساس تاریخ ملاک (نه «آخرین نسخه» مبهم)
create or replace function public.rule_center_eligible_versions(p_kind text, p_asof date default current_date)
returns table (version_id uuid, rule_id uuid, code text, title_fa text, version_number integer, status text, valid_from date, valid_to date)
language sql stable security definer set search_path = pg_catalog as $$
  select v.id, r.id, r.code, r.title_fa, v.version_number, v.status, r.valid_from, r.valid_to
  from public.rule_center_versions v
  join public.rule_center_rules r on r.id = v.rule_id
  where r.kind = p_kind
    and v.status in ('PUBLISHED', 'STOPPED')
    and (r.valid_from is null or r.valid_from <= p_asof)
    and (r.valid_to is null or r.valid_to >= p_asof)
  order by r.title_fa, v.version_number desc
$$;
revoke all on function public.rule_center_eligible_versions(text, date) from public, anon;
grant execute on function public.rule_center_eligible_versions(text, date) to authenticated;

-- ==========================================================================
-- 14. گسترش objection_template_save: ذخیرهٔ اتصال مهلت اقدام + کنترل ارجاع فیلد/اقدام
--     (همان امضای قبلی؛ رفتار قبلی حفظ و فقط افزایشی)
-- ==========================================================================
create or replace function public.objection_template_save(
  p_template_id uuid,
  p_title text,
  p_description text,
  p_stages jsonb,
  p_steps jsonb,
  p_status_groups jsonb,
  p_obligation_ids uuid[]
)
returns uuid
language plpgsql security definer set search_path = pg_catalog
as $$
declare
  uid uuid := auth.uid();
  v_tid uuid;
  v_stage_map jsonb := '{}'::jsonb;
  v_step_map jsonb := '{}'::jsonb;
  v_seen text[];
  v_refs text[] := '{}'::text[];
  v_ref text;
  rec record;
  fld record;
  tr record;
  cl record;
  mp record;
  v_stage jsonb;
  v_step jsonb;
  v_group jsonb;
  v_seq int := 0;
  v_stage_id uuid;
  v_step_id uuid;
  v_target_step uuid;
  v_order int;
  v_map_key text;
  v_mapping_src text;
begin
  if uid is null
     or coalesce((auth.jwt()->>'is_anonymous')::boolean, false)
     or not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;

  if p_title is null or btrim(p_title) = '' then
    raise exception 'عنوان الگو اجباری است' using errcode = '22023';
  end if;
  if p_steps is null or jsonb_typeof(p_steps) <> 'array' or coalesce(jsonb_array_length(p_steps), 0) = 0 then
    raise exception 'حداقل یک اقدام در مسیر تعریف کنید' using errcode = '22023';
  end if;
  if p_stages is null or jsonb_typeof(p_stages) <> 'array' then p_stages := '[]'::jsonb; end if;
  if p_status_groups is null or jsonb_typeof(p_status_groups) <> 'array' then p_status_groups := '[]'::jsonb; end if;

  if p_template_id is null then
    insert into public.objection_templates (title, description, status, is_active)
    values (btrim(p_title), nullif(p_description, ''), 'DRAFT', false)
    returning id into v_tid;
  else
    if not exists (select 1 from public.objection_templates where id = p_template_id) then
      raise exception 'template not found' using errcode = 'P0002';
    end if;
    if exists (select 1 from public.objection_templates where id = p_template_id and has_been_activated) then
      raise exception 'این الگو قبلاً فعال شده و در حال استفاده است؛ محتوای آن بسته است و قابل بازنویسی نیست (نسخه‌بندی جدا ندارد)'
        using errcode = '23514';
    end if;
    update public.objection_templates
    set title = btrim(p_title),
        description = nullif(p_description, ''),
        updated_at = now()
    where id = p_template_id;
    v_tid := p_template_id;
  end if;

  -- پیش‌اعتبارسنجی کل بار
  for rec in select * from jsonb_array_elements(p_steps) as t(value) loop
    v_step := rec.value;
    if btrim(coalesce(v_step ->> 'title', '')) = '' then
      raise exception 'عنوان اقدام اجباری است' using errcode = '22023';
    end if;
    if v_step ->> 'responsible_role' is not null and not exists (
      select 1 from public.role_definitions r
      where r."key" = (v_step ->> 'responsible_role') and r."key" <> 'PLATFORM_ADMIN'
    ) then
      raise exception 'مسئول ثبت باید نقش قابل‌تخصیص فضای شرکت باشد (مدیر پلتفرم مجاز نیست)'
        using errcode = '23514';
    end if;
    if v_step ->> 'performer_key' is not null and not exists (
      select 1 from public.selection_list_options o
      join public.selection_lists l on l.id = o.list_id
      where l."key" = 'objection_step_actors'
        and o."key" = (v_step ->> 'performer_key')
        and o.is_active
    ) then
      raise exception 'مرجع انجام اقدام باید از فهرست «objection_step_actors» انتخاب شود'
        using errcode = '23514';
    end if;
    -- اتصال مهلت: نسخهٔ قاعده باید موجود باشد
    if v_step ->> 'deadline_rule_version_id' is not null
       and not exists (select 1 from public.rule_center_versions where id = (v_step ->> 'deadline_rule_version_id')::uuid) then
      raise exception 'نسخهٔ قاعدهٔ مهلت متصل به اقدام «%» یافت نشد', (v_step ->> 'title') using errcode = '23503';
    end if;
    -- نگاشت ورودی‌ها: ارجاع به فیلد باید در همان اقدام موجود باشد و ارجاع به اقدام دیگر باید در همین بار باشد
    for mp in select * from jsonb_each(coalesce(v_step -> 'deadline_mapping', '{}'::jsonb)) as t(key, value) loop
      v_map_key := mp.key;
      if (mp.value ->> 'source_type') = 'ACTION_FIELD' then
        v_mapping_src := mp.value ->> 'source_ref';
        if not exists (
          select 1 from jsonb_array_elements(coalesce(v_step -> 'fields', '[]'::jsonb)) t2
          where t2.value ->> 'key' = v_mapping_src
        ) then
          raise exception 'فیلد «%» مورد استفادهٔ نگاشت مهلت در اقدام «%» وجود ندارد (حذف فیلدِ مورد استفاده مجاز نیست)',
            v_mapping_src, (v_step ->> 'title') using errcode = '23514';
        end if;
      end if;
    end loop;
    v_seen := '{}'::text[];
    for fld in select * from jsonb_array_elements(coalesce(v_step -> 'fields', '[]'::jsonb)) as t(value) loop
      if (fld.value ->> 'key') is not null and (fld.value ->> 'key') <> '' then
        if (fld.value ->> 'key') = any (v_seen) then
          raise exception 'کلید فیلد «%» در اقدام «%» تکراری است', (fld.value ->> 'key'), (v_step ->> 'title')
            using errcode = '22023';
        end if;
        v_seen := array_append(v_seen, fld.value ->> 'key');
      end if;
    end loop;
    v_ref := coalesce(nullif(v_step ->> 'step_ref', ''), v_step ->> 'id');
    if v_ref is null or btrim(v_ref) = '' then
      raise exception 'شناسه پایدار اقدام اجباری است' using errcode = '22023';
    end if;
    if v_ref = any (v_refs) then
      raise exception 'شناسه اقدام «%» تکراری است', v_ref using errcode = '22023';
    end if;
    v_refs := array_append(v_refs, v_ref);
  end loop;

  -- پاس دوم: ارجاع نگاشت مهلت به اقدام دیگر باید به اقدامی در همین بار اشاره کند
  -- (حذف اقدامِ مورد استفادهٔ نگاشت مهلت مسدود است).
  for rec in select * from jsonb_array_elements(p_steps) as t(value) loop
    v_step := rec.value;
    for mp in select * from jsonb_each(coalesce(v_step -> 'deadline_mapping', '{}'::jsonb)) as t(key, value) loop
      if (mp.value ->> 'source_type') = 'OTHER_STEP_FIELD' then
        v_mapping_src := mp.value ->> 'source_step_ref';
        if v_mapping_src is not null and v_mapping_src <> '' and not (v_mapping_src = any (v_refs)) then
          raise exception 'اقدامِ «%» مورد استفادهٔ نگاشت مهلت حذف شده است؛ ابتدا اتصال را اصلاح کنید',
            mp.value ->> 'source_step_label' using errcode = '23514';
        end if;
      end if;
    end loop;
  end loop;

  for rec in select * from jsonb_array_elements(p_steps) as t(value) loop
    v_step := rec.value;
    for tr in select * from jsonb_array_elements(coalesce(v_step -> 'transitions', '[]'::jsonb)) as t(value) loop
      for cl in select * from jsonb_array_elements(coalesce(tr.value -> 'condition_expression' -> 'clauses', '[]'::jsonb)) as t(value) loop
        if (cl.value ->> 'source') = 'STEP_OUTPUT' then
          v_ref := split_part(coalesce(cl.value ->> 'field_key', ''), '.', 1);
          if v_ref <> '' and not (v_ref = any (v_refs)) then
            raise exception 'حذف اقدام مرجع شرط مجاز نیست؛ ابتدا شرط «%» را اصلاح کنید',
              coalesce(cl.value ->> 'field_label', cl.value ->> 'field_key')
              using errcode = '23514';
          end if;
        end if;
      end loop;
    end loop;
  end loop;

  for rec in select * from jsonb_array_elements(p_stages) as t(value) loop
    v_stage := rec.value;
    if btrim(coalesce(v_stage ->> 'title', '')) = '' then
      raise exception 'عنوان مرحله اجباری است' using errcode = '22023';
    end if;
  end loop;

  delete from public.objection_steps where template_id = v_tid;
  delete from public.objection_stages where template_id = v_tid;
  delete from public.objection_template_status_groups where template_id = v_tid;
  delete from public.objection_template_obligations where template_id = v_tid and link_status = 'DRAFT';

  v_order := 0;
  for rec in select * from jsonb_array_elements(p_stages) as t(value) loop
    v_stage := rec.value;
    insert into public.objection_stages (template_id, title, sort_order)
    values (v_tid, btrim(v_stage ->> 'title'), coalesce((v_stage ->> 'sort_order')::int, v_order))
    returning id into v_stage_id;
    v_order := v_order + 1;
    v_stage_map := v_stage_map || jsonb_build_object(v_stage ->> 'id', v_stage_id::text);
  end loop;

  for rec in select * from jsonb_array_elements(p_steps) as t(value) loop
    v_step := rec.value;
    v_seq := v_seq + 1;
    v_stage_id := null;
    if v_step ->> 'stage_id' is not null and v_stage_map ? (v_step ->> 'stage_id') then
      v_stage_id := (v_stage_map ->> (v_step ->> 'stage_id'))::uuid;
    end if;
    v_ref := coalesce(nullif(v_step ->> 'step_ref', ''), v_step ->> 'id');
    insert into public.objection_steps (
      template_id, sequence, code, step_ref, title, actor, performer_key, performer_label,
      responsible_role, responsible_role_label, gap_value, gap_unit, base_event,
      step_nature, legal_basis, form_schema, is_optional, stage_id,
      deadline_rule_version_id, deadline_mapping
    ) values (
      v_tid, v_seq, 'STEP_' || v_seq, v_ref, btrim(v_step ->> 'title'),
      coalesce(v_step ->> 'actor', 'TAXPAYER'),
      v_step ->> 'performer_key', v_step ->> 'performer_label',
      v_step ->> 'responsible_role', v_step ->> 'responsible_role_label',
      coalesce((v_step ->> 'gap_value')::int, 0),
      coalesce(v_step ->> 'gap_unit', 'روز'),
      v_step ->> 'base_event',
      coalesce(v_step ->> 'step_nature', 'MANDATORY'),
      v_step ->> 'legal_basis',
      jsonb_build_object('fields', coalesce(v_step -> 'fields', '[]'::jsonb)),
      coalesce((v_step ->> 'is_skippable')::boolean, (v_step ->> 'step_nature') = 'CONDITIONAL_EXPERT'),
      v_stage_id,
      (v_step ->> 'deadline_rule_version_id')::uuid,
      coalesce(v_step -> 'deadline_mapping', '{}'::jsonb)
    ) returning id into v_step_id;
    v_step_map := v_step_map || jsonb_build_object(v_step ->> 'id', v_step_id::text);

    for tr in select * from jsonb_array_elements(coalesce(v_step -> 'transitions', '[]'::jsonb)) as t(value) loop
      v_target_step := null;
      if tr.value ->> 'target_type' = 'STEP' and tr.value ->> 'target_step_id' is not null
         and v_step_map ? (tr.value ->> 'target_step_id') then
        v_target_step := (v_step_map ->> (tr.value ->> 'target_step_id'))::uuid;
      end if;
      insert into public.objection_step_transitions (
        step_id, title, trigger_type, timeout_days, timeout_desc, target_type,
        target_step_id, action_label, legal_reference, description, condition_expression
      ) values (
        v_step_id, coalesce(tr.value ->> 'title', 'ادامه'),
        coalesce(tr.value ->> 'trigger_type', 'USER_ACTION'),
        (tr.value ->> 'timeout_days')::int, tr.value ->> 'timeout_desc',
        coalesce(tr.value ->> 'target_type', 'STEP'), v_target_step,
        tr.value ->> 'action_label', tr.value ->> 'legal_reference',
        tr.value ->> 'description', tr.value -> 'condition_expression'
      );
    end loop;
  end loop;

  update public.objection_steps s
  set code = 'STEP_' || sub.rn
  from (select id, row_number() over (order by sequence, id) as rn
        from public.objection_steps where template_id = v_tid) sub
  where s.id = sub.id and s.template_id = v_tid;

  for rec in select * from jsonb_array_elements(p_status_groups) as t(value) loop
    v_group := rec.value;
    insert into public.objection_template_status_groups (template_id, code, title, options, sort_order)
    values (v_tid, v_group ->> 'code', v_group ->> 'title',
            coalesce(v_group -> 'options', '[]'::jsonb),
            coalesce((v_group ->> 'sort_order')::int, 0));
  end loop;

  if p_obligation_ids is not null and coalesce(array_length(p_obligation_ids, 1), 0) > 0 then
    insert into public.objection_template_obligations (template_id, obligation_id, link_status)
    select v_tid, oid, 'DRAFT' from unnest(p_obligation_ids) oid
    on conflict do nothing;
  end if;

  return v_tid;
end;
$$;
revoke all on function public.objection_template_save(uuid,text,text,jsonb,jsonb,jsonb,uuid[]) from public,anon,authenticated;
grant execute on function public.objection_template_save(uuid,text,text,jsonb,jsonb,jsonb,uuid[]) to authenticated;

commit;
