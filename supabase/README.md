# Supabase setup

Apply every migration before connecting the frontend to a real Supabase project.

## Apply migrations

Migration filenames are part of the database history. Do not rename them.

### Fresh project / SQL Editor

For a fresh Supabase project, run every file in `supabase/migrations` once, in ascending filename order:

1. `20260811023246_secure_auth_tenant_foundation.sql`
2. `20260811023451_harden_rls_helpers.sql`
3. `20260811032908_require_profiles_and_lock_defaults.sql`
4. `20260813111236_revoke_public_function_defaults.sql`
5. `20260813111325_revoke_global_public_function_default.sql`

Do not rerun these files on a project where the same migration versions already appear in migration history.

### Supabase CLI

```bash
npx supabase link --project-ref <project-ref>
npx supabase migration list
npx supabase db push
```

Confirm that local and remote migration versions match before and after `db push`.

## Frontend environment

Create a local `.env` file and keep it out of Git:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_ENABLE_MOCK_AUTH=false
```

Only the Project URL and Publishable Key belong in the frontend. Never put a Supabase Secret Key, database password, access token, or `service_role` key in frontend code, Vite variables, commits, or pull requests.

## Authentication behavior

A database trigger creates `public.users` after a user is created in `auth.users`. Email and phone changes are synchronized by a second trigger. The frontend does not create or update public profiles directly.

With Confirm Email enabled, signup may return no session. The user must confirm the email and then sign in. Anonymous Auth users and authenticated users without a matching `public.users` profile cannot create tenants.

## First platform administrator

After the intended administrator has registered, promote that account only from a trusted SQL Editor or a protected backend:

```sql
update public.users
set role = 'PLATFORM_ADMIN'
where email = 'admin@example.com';
```

Never expose an endpoint that lets ordinary authenticated users change `public.users.role`.

## Ownership constraints

Tenant creation uses the atomic `create_tenant_with_owner` RPC. It validates the caller and inputs, then creates the tenant and first `OWNER` membership in one transaction. A tenant cannot be left without an owner, and an owner cannot remove or downgrade their own membership. The current foundation does not implement ownership transfer. Because `tenants.created_by` uses `ON DELETE RESTRICT`, a creator account cannot be deleted while its tenant still exists.

## Development database integration test

Run `supabase/tests/rls_auth_tenant.sql` only against a development project after applying all migrations. The test covers:

- profile creation and contact synchronization triggers;
- rejection of role escalation through user metadata;
- owner, tenant-admin, member, outsider, and platform-admin RLS behavior;
- cross-tenant read and write isolation;
- atomic tenant/owner creation through the RPC;
- rejection of anonymous Auth and profileless callers;
- prevention of self-downgrade and ownerless tenants;
- `anon` and `authenticated` grants;
- locked default privileges for newly created public objects.

All fixtures use reserved test UUIDs and `.invalid` email addresses inside a transaction. The script rolls them back and reports leftover fixture counts, which must all be zero.

## Advisor notes

The Security Advisor intentionally reports `public.create_tenant_with_owner` as an authenticated `SECURITY DEFINER` function. This narrowly scoped public RPC is required because clients have no direct `INSERT` grant on `public.tenants`. It is intentionally retained because it:

- requires `auth.uid()`;
- rejects anonymous Auth users;
- requires a matching `public.users` profile;
- validates all inputs;
- fixes `search_path` to `pg_catalog`;
- is executable by `authenticated` only;
- creates the tenant and first owner atomically;
- has dedicated integration tests.

Internal membership helpers live in the unexposed `private` schema. The hardening migrations revoke automatic client access to future public tables, sequences, and functions; every future API object must be granted explicitly and protected with suitable RLS or function authorization.

Performance Advisor may report the new indexes as unused while the development database is empty. This is expected until representative data and traffic exist; reevaluate those notices before production.


### Tenant profile RPC and Auth warning

The Security Advisor also intentionally reports `public.save_tenant_profile` as an authenticated `SECURITY DEFINER` function. Direct writes to `public.tenant_profile_versions` are revoked; this RPC is the only write path and rejects anonymous users, users without a profile, non-members, and members below `OWNER` or `ADMIN`. It validates bounded inputs, serializes changes per tenant, and records effective-dated history atomically.

`Leaked Password Protection Disabled` is a project-plan limitation rather than a database-code defect. Keep the strong password policy enabled and turn leaked-password protection on when the Supabase plan supports it.
