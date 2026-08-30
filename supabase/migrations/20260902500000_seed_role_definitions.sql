-- ==========================================================================
-- Migration: Platform role definitions + permission matrix
-- Date: 2026-09-02
-- Purpose: Move role display metadata (Persian labels, descriptions, allowed
--          actions, restrictions) and the permission matrix from frontend code
--          into the real database, per the project rule that no data may come
--          from code — only from Supabase.
--          The role KEYS themselves are already enforced in public.users CHECK
--          constraints; this table adds the admin-facing metadata for them.
-- ==========================================================================

begin;

-- --------------------------------------------------------------------------
-- 1. role_definitions
-- --------------------------------------------------------------------------
create table if not exists public.role_definitions (
  key text primary key,
  label text not null check (btrim(label) <> ''),
  persian_label text not null check (btrim(persian_label) <> ''),
  description text not null default '',
  permissions jsonb not null default '[]'::jsonb,
  restrictions jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.role_definitions is
  'Admin-facing metadata for platform roles (labels, descriptions, allowed actions, restrictions). Role keys mirror the users.role CHECK constraint.';

-- --------------------------------------------------------------------------
-- 2. permission_matrix
-- --------------------------------------------------------------------------
create table if not exists public.permission_matrix (
  id bigint generated always as identity primary key,
  label text not null check (btrim(label) <> ''),
  role_checks jsonb not null check (jsonb_typeof(role_checks) = 'object'),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.permission_matrix is
  'Visual comparison matrix: each row is a capability, role_checks maps each role key to true/false.';

-- --------------------------------------------------------------------------
-- 3. Seeds (idempotent) — data previously hardcoded in AdminUserAccessPage.tsx
-- --------------------------------------------------------------------------
insert into public.role_definitions (key, label, persian_label, description, permissions, restrictions, sort_order)
values
  (
    'PLATFORM_ADMIN',
    'مدیر پلتفرم',
    'مدیر ارشد پلتفرم',
    'بالاترین سطح دسترسی. مدیریت کلیه ماژول‌ها، کاربران، نقش‌ها و تنظیمات سامانه.',
    '["مدیریت کلیه کاربران و نقش‌ها","تعریف و ویرایش تعهدات و قواعد","انتشار و بازنشانی نسخه‌ها","مشاهده گزارش‌ها و آمار کلی","مدیریت تنظیمات سامانه","تعریف ساختار سازمانی"]'::jsonb,
    '["ندارد — دسترسی کامل"]'::jsonb,
    1
  ),
  (
    'MANAGER',
    'مدیر',
    'مدیر عملیاتی',
    'مدیریت عملیاتی روزانه. نظارت بر فرایندها، تأیید اقدامات و هماهنگی تیم.',
    '["مشاهده کلیه ماژول‌ها و داده‌ها","تأیید درخواست‌های بازبینی","تخصیص وظایف به اعضای تیم","مشاهده گزارش‌های عملیاتی","بازبینی و تأیید نسخه‌ها"]'::jsonb,
    '["تغییر نقش کاربران","حذف کاربران","تغییر تنظیمات سامانه"]'::jsonb,
    2
  ),
  (
    'REGISTRAR',
    'ثبت‌کننده',
    'ثبت‌کننده نسخه‌ها',
    'تولید و ثبت نسخه‌های جدید تعهدات، قواعد و فرم‌ها. ایجاد پیش‌نویس برای بازبینی.',
    '["ایجاد پیش‌نویس نسخه جدید","ویرایش اطلاعات تعهدات","تعریف قواعد تشخیص مشمولیت","طراحی مراحل فرایند و فرم‌ها","ارسال نسخه به بازبینی","اصلاح نسخه پس از رد بازبین"]'::jsonb,
    '["انتشار نهایی نسخه","تأیید بازبینی","تغییر نقش کاربران"]'::jsonb,
    3
  ),
  (
    'REVIEWER',
    'بازبین',
    'بازبین تخصصی',
    'بررسی تخصصی نسخه‌های ثبت‌شده. تأیید یا رد با ذکر دلیل و ارسال برای اصلاح.',
    '["مشاهده نسخه‌های ارسال‌شده","شروع بازبینی تخصصی","تأیید یا رد نسخه با ذکر دلیل","مشاهده تاریخچه بازبینی‌ها","مشاهده گزارش‌های تخصصی"]'::jsonb,
    '["ویرایش نسخه‌ها","انتشار نهایی","تغییر نقش کاربران"]'::jsonb,
    4
  ),
  (
    'APPROVER',
    'تأییدکننده',
    'تأیید نهایی',
    'تأیید نهایی نسخه‌های بازبینی‌شده و اجازه انتشار. نظارت بر کیفیت خروجی.',
    '["مشاهده نسخه‌های تأیید بازبینی","تأیید نهایی برای انتشار","مشاهده وضعیت کلی فرایندها","مشاهده گزارش‌های کیفی"]'::jsonb,
    '["ویرایش نسخه‌ها","بازبینی تخصصی","تغییر نقش کاربران"]'::jsonb,
    5
  ),
  (
    'BUSINESS_USER',
    'کاربر',
    'کاربر سازمانی',
    'کاربر عادی سازمان. مشاهده اطلاعات و ارسال درخواست‌ها.',
    '["مشاهده اطلاعات شخصی","ارسال درخواست‌ها","پیگیری وضعیت درخواست‌ها"]'::jsonb,
    '["مدیریت کاربران","تغییر تنظیمات","بازبینی و تأیید"]'::jsonb,
    6
  )
on conflict (key) do update set
  label = excluded.label,
  persian_label = excluded.persian_label,
  description = excluded.description,
  permissions = excluded.permissions,
  restrictions = excluded.restrictions,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.permission_matrix (label, role_checks, sort_order)
values
  ('مشاهده داشبورد مدیریت', '{"PLATFORM_ADMIN":true,"MANAGER":true,"REGISTRAR":false,"REVIEWER":false,"APPROVER":false,"BUSINESS_USER":false}'::jsonb, 1),
  ('ایجاد و ویرایش نسخه تعهد', '{"PLATFORM_ADMIN":true,"MANAGER":false,"REGISTRAR":true,"REVIEWER":false,"APPROVER":false,"BUSINESS_USER":false}'::jsonb, 2),
  ('شروع بازبینی تخصصی', '{"PLATFORM_ADMIN":true,"MANAGER":true,"REGISTRAR":false,"REVIEWER":true,"APPROVER":false,"BUSINESS_USER":false}'::jsonb, 3),
  ('تأیید یا رد بازبینی', '{"PLATFORM_ADMIN":true,"MANAGER":true,"REGISTRAR":false,"REVIEWER":true,"APPROVER":false,"BUSINESS_USER":false}'::jsonb, 4),
  ('تأیید نهایی انتشار', '{"PLATFORM_ADMIN":true,"MANAGER":false,"REGISTRAR":false,"REVIEWER":false,"APPROVER":true,"BUSINESS_USER":false}'::jsonb, 5),
  ('انتشار نسخه نهایی', '{"PLATFORM_ADMIN":true,"MANAGER":false,"REGISTRAR":false,"REVIEWER":false,"APPROVER":true,"BUSINESS_USER":false}'::jsonb, 6),
  ('مدیریت کاربران پلتفرم', '{"PLATFORM_ADMIN":true,"MANAGER":false,"REGISTRAR":false,"REVIEWER":false,"APPROVER":false,"BUSINESS_USER":false}'::jsonb, 7),
  ('تغییر تنظیمات سامانه', '{"PLATFORM_ADMIN":true,"MANAGER":false,"REGISTRAR":false,"REVIEWER":false,"APPROVER":false,"BUSINESS_USER":false}'::jsonb, 8)
on conflict (id) do nothing;

-- --------------------------------------------------------------------------
-- 4. RLS — this is admin-facing metadata; only platform admins may read/write.
-- --------------------------------------------------------------------------
alter table public.role_definitions enable row level security;
alter table public.permission_matrix enable row level security;

drop policy if exists role_definitions_admin_all on public.role_definitions;
create policy role_definitions_admin_all on public.role_definitions
  for all
  to authenticated
  using (private.is_platform_admin())
  with check (private.is_platform_admin());

drop policy if exists permission_matrix_admin_all on public.permission_matrix;
create policy permission_matrix_admin_all on public.permission_matrix
  for all
  to authenticated
  using (private.is_platform_admin())
  with check (private.is_platform_admin());

grant select, insert, update, delete on public.role_definitions to authenticated;
grant select, insert, update, delete on public.permission_matrix to authenticated;

commit;
