-- Migration: Support multiple roles per user
-- Date: 2026-08-25

-- Step 1: Add roles column as JSONB array
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS roles jsonb DEFAULT '["BUSINESS_USER"]'::jsonb;

-- Step 2: Migrate existing role data to roles array
UPDATE public.users 
SET roles = jsonb_build_array(role)
WHERE roles IS NULL OR roles = '[]'::jsonb;

-- Step 3: Add constraint to ensure roles array is not empty (drop first if exists)
ALTER TABLE public.users 
DROP CONSTRAINT IF EXISTS users_roles_check;

ALTER TABLE public.users 
ADD CONSTRAINT users_roles_check CHECK (jsonb_array_length(roles) > 0);

-- Step 4: Add constraint to ensure all roles in array are valid (drop first if exists)
ALTER TABLE public.users 
DROP CONSTRAINT IF EXISTS users_roles_valid_check;

ALTER TABLE public.users 
ADD CONSTRAINT users_roles_valid_check CHECK (
  roles <@ '["PLATFORM_ADMIN","MANAGER","REGISTRAR","REVIEWER","APPROVER","BUSINESS_USER"]'::jsonb
);

-- Step 5: Create index for faster role queries (drop first if exists)
DROP INDEX IF EXISTS idx_users_roles;
CREATE INDEX idx_users_roles ON public.users USING gin (roles);

-- Note: The old 'role' column is kept for backward compatibility
-- New code should use 'roles' array instead
