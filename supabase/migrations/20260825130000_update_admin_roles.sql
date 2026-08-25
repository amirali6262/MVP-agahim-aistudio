-- Migration: Update admin user roles
-- Date: 2026-08-25
-- Purpose: Set bahroz.mohaghegh@gmail.com as PLATFORM_ADMIN + MANAGER

-- Update the roles field for the admin user
UPDATE public.users 
SET roles = '["PLATFORM_ADMIN", "MANAGER"]'::jsonb
WHERE email = 'bahroz.mohaghegh@gmail.com';

-- Verify the update
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE email = 'bahroz.mohaghegh@gmail.com' 
    AND roles @> '"PLATFORM_ADMIN"'::jsonb
    AND roles @> '"MANAGER"'::jsonb
  ) THEN
    RAISE WARNING 'User bahroz.mohaghegh@gmail.com not found or roles not updated';
  END IF;
END $$;
