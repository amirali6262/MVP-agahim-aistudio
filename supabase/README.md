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
VITE_ENABLE_MOCK_DATA=false
```

Only the Project URL and Publishable Key belong in the frontend. Never put a Supabase Secret Key, database password, access token, or `service_role` key in frontend code, Vite variables, commits, or pull requests.

Mock authentication is opt-in: set `VITE_ENABLE_MOCK_AUTH=true` only for an
intentional local demo. Keep it disabled in deployed environments because demo
sessions are client-side placeholders and do not represent authenticated
Supabase users.

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

The administrator must first exist in **Authentication → Users**. Inserting an
email only into `public.users` does not create login credentials, and the
database password is never a valid panel password. The panel uses the password
stored by Supabase Auth for that user. If it is unknown, use the password-reset
action on `/admin/login`; ensure the deployed `/admin/login?recovery=1` URL is
allowed in Supabase Authentication redirect URLs.

Business users have the same recovery flow on `/login`. Add both
`/login?recovery=1` and `/admin/login?recovery=1` (with each deployed origin)
to the Authentication redirect allow-list.

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

### Case events, penalty estimates, and summary RPCs

The Security Advisor may also list `public.record_case_event`, `public.estimate_case_penalty`, and `public.get_tenant_compliance_summary` because they are authenticated `SECURITY DEFINER` RPCs. Direct table writes are revoked, so these functions are the deliberately narrow write/read boundary. They reject missing or anonymous sessions, bind access to tenant membership or platform-admin status, validate event types and numeric penalty-rule inputs, and use a fixed `pg_catalog` search path. Cross-tenant access and role separation are covered by rollback-only integration tests.

Penalty values are estimates based on the published rule snapshot, the latest recorded deadline, and operator-entered base/waiver/payment amounts. They are not a final authority assessment and should be labelled as estimates in the UI and reports.

### Dynamic workflow forms

`public.complete_case_task` is intentionally exposed as an authenticated `SECURITY DEFINER` RPC because clients cannot write case tasks or cases directly. It locks the active task and case, enforces the step actor (`USER` versus `PLATFORM_ADMIN`/`AUTHORITY`), validates every response against the bounded published form schema, rejects unknown or missing fields, and atomically follows the explicitly selected `workflow_transitions` edge. Anonymous users, cross-tenant callers, timeout edges, and system-event edges are rejected from the interactive RPC. System events use the platform-admin-only `record_case_system_event` RPC, while timeout edges are evaluated by the scheduled private processor. Every accepted edge is appended to `case_transition_history`, including backward/self-referencing loops and terminal outcomes. The form vocabulary is deliberately limited to text, number, date, checkbox, and select; file upload is not enabled until a separately secured Storage design is added.

### Admin obligation authoring

`public.create_obligation_draft` and `public.publish_obligation_version` are intentional authenticated `SECURITY DEFINER` RPCs restricted internally to `PLATFORM_ADMIN`. Draft creation validates identifiers, HTTPS URLs and rule objects, then creates the obligation and its first version atomically. Publication requires an official source, legal reference, effective date, at least one explainable eligibility rule and at least one validated workflow step; it validates the penalty formula and then locks the published definition. Ordinary and anonymous users are rejected. Legal content is never seeded or published automatically.

### Deadline scheduler and delivery outbox

The `pg_cron` job `agahim-deadline-reminders` runs daily at 03:15 UTC and calls the private reminder generator. It creates idempotent reminders 30, 14, 7, 3 and 1 days before a deadline, on the due date, and one day overdue. The authenticated `public.schedule_deadline_notifications` RPC is only a manual platform-admin wrapper around the same private function.

New notifications enqueue EMAIL only when the user has an email and SMS only when the user has a phone. The private outbox does not send anything by itself. A reviewed provider worker, retry policy, consent rules, sender identity and an approved paid-service decision are still required before external email or SMS delivery is enabled.
