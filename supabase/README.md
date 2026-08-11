# Supabase setup

Apply the migration before connecting the frontend to a real Supabase project.

## Apply the migration

### SQL Editor

Open **SQL Editor** in the Supabase dashboard, paste the complete contents of:

`supabase/migrations/20260811000000_secure_auth_tenant_foundation.sql`

Then run it once.

### Supabase CLI

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
```

## Frontend environment

Create a local `.env` file and keep it out of Git:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_ENABLE_MOCK_AUTH=false
```

Only the Project URL and Publishable Key belong in the frontend. Never put a Supabase Secret Key or `service_role` key in frontend code, Vite variables, commits, or pull requests.

## Authentication behavior

A database trigger creates `public.users` after a user is created in `auth.users`. Email and phone changes are synchronized by a second trigger. The frontend does not create or update public profiles directly.

With Confirm Email enabled, signup may return no session. The user must confirm the email and then sign in.

## First platform administrator

After the intended administrator has registered, promote that account only from a trusted SQL Editor or a protected backend:

```sql
update public.users
set role = 'PLATFORM_ADMIN'
where email = 'admin@example.com';
```

Never expose an endpoint that lets ordinary authenticated users change `public.users.role`.

## Ownership constraints

Tenant creation uses the atomic `create_tenant_with_owner` RPC. A tenant cannot be left without an owner, and an owner cannot remove or downgrade their own membership. The current foundation does not implement ownership transfer. Because `tenants.created_by` uses `ON DELETE RESTRICT`, a creator account cannot be deleted while its tenant still exists.
