-- Migration: Add platform role types for user management
-- Date: 2026-08-24
-- Purpose: Extend the users.role CHECK constraint to support the full platform role hierarchy:
--   PLATFORM_ADMIN  → بالاترین سطح دسترسی
--   MANAGER         → مدیر عملیاتی
--   REGISTRAR       → ثبت‌کننده نسخه‌ها
--   REVIEWER        → بازبین تخصصی
--   APPROVER        → تأیید نهایی
--   BUSINESS_USER   → کاربر سازمانی (پیش‌فرض)

begin;

-- 1. Drop the existing CHECK constraint on public.users.role
alter table public.users
  drop constraint if exists users_role_check;

-- 2. Add the new CHECK constraint with all platform roles
alter table public.users
  add constraint users_role_check check (
    role in (
      'PLATFORM_ADMIN',
      'MANAGER',
      'REGISTRAR',
      'REVIEWER',
      'APPROVER',
      'BUSINESS_USER'
    )
  );

-- 3. Add a comment for documentation
comment on column public.users.role is
  'Platform role: PLATFORM_ADMIN (full access), MANAGER (operational), '
  'REGISTRAR (version authoring), REVIEWER (specialized review), '
  'APPROVER (final approval), BUSINESS_USER (end user).';

commit;
