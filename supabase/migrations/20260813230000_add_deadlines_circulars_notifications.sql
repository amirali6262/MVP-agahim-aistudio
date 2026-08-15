begin;

create table public.legal_circulars (
  id uuid primary key default extensions.gen_random_uuid(),
  obligation_version_id uuid not null references public.obligation_versions(id) on delete restrict,
  title text not null constraint legal_circulars_title_check check (btrim(title)<>''),
  circular_number text,
  source_url text not null constraint legal_circulars_source_url_check check (source_url~'^https://'),
  issued_on date not null,
  effective_on date,
  summary text not null constraint legal_circulars_summary_check check (btrim(summary)<>''),
  status text not null default 'DRAFT' constraint legal_circulars_status_check check(status in('DRAFT','PUBLISHED')),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  published_by uuid references auth.users(id) on delete restrict,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legal_circulars_publication_check check(
    (status='PUBLISHED' and published_by is not null and published_at is not null)
    or (status<>'PUBLISHED' and published_by is null and published_at is null)
  )
);

create table public.case_deadlines (
  id uuid primary key default extensions.gen_random_uuid(),
  case_id uuid not null references public.compliance_cases(id) on delete cascade,
  workflow_step_id uuid references public.workflow_steps(id) on delete restrict,
  deadline_type text not null constraint case_deadlines_type_check check(deadline_type in('ORIGINAL','EXTENSION')),
  due_at timestamptz not null,
  source_circular_id uuid references public.legal_circulars(id) on delete restrict,
  reason text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint case_deadlines_extension_source_check check(deadline_type='ORIGINAL' or source_circular_id is not null),
  constraint case_deadlines_case_type_due_key unique(case_id,deadline_type,due_at)
);

create table public.notifications (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid references public.compliance_cases(id) on delete cascade,
  deadline_id uuid references public.case_deadlines(id) on delete cascade,
  circular_id uuid references public.legal_circulars(id) on delete cascade,
  kind text not null constraint notifications_kind_check check(kind in('DEADLINE','CIRCULAR','TASK','SYSTEM')),
  title text not null constraint notifications_title_check check(btrim(title)<>''),
  body text not null constraint notifications_body_check check(btrim(body)<>''),
  action_url text constraint notifications_action_url_check check(action_url is null or action_url~'^/'),
  deduplication_key text not null unique,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table private.delivery_outbox (
  id uuid primary key default extensions.gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  channel text not null constraint delivery_outbox_channel_check check(channel in('EMAIL','SMS')),
  status text not null default 'PENDING' constraint delivery_outbox_status_check check(status in('PENDING','PROCESSING','SENT','FAILED','CANCELLED')),
  attempt_count integer not null default 0 constraint delivery_outbox_attempt_check check(attempt_count>=0),
  next_attempt_at timestamptz not null default now(),
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_outbox_notification_channel_key unique(notification_id,channel)
);

create index legal_circulars_obligation_idx on public.legal_circulars(obligation_version_id,issued_on desc);
create index legal_circulars_created_by_idx on public.legal_circulars(created_by);
create index legal_circulars_published_by_idx on public.legal_circulars(published_by) where published_by is not null;
create index case_deadlines_case_due_idx on public.case_deadlines(case_id,due_at);
create index case_deadlines_step_idx on public.case_deadlines(workflow_step_id) where workflow_step_id is not null;
create index case_deadlines_circular_idx on public.case_deadlines(source_circular_id) where source_circular_id is not null;
create index case_deadlines_created_by_idx on public.case_deadlines(created_by);
create index notifications_user_unread_idx on public.notifications(user_id,created_at desc) where read_at is null;
create index notifications_tenant_idx on public.notifications(tenant_id,created_at desc);
create index notifications_case_idx on public.notifications(case_id) where case_id is not null;
create index notifications_deadline_idx on public.notifications(deadline_id) where deadline_id is not null;
create index notifications_circular_idx on public.notifications(circular_id) where circular_id is not null;
create index delivery_outbox_pending_idx on private.delivery_outbox(next_attempt_at) where status in('PENDING','FAILED');

create trigger legal_circulars_set_updated_at before update on public.legal_circulars for each row execute function public.set_updated_at();
create trigger delivery_outbox_set_updated_at before update on private.delivery_outbox for each row execute function public.set_updated_at();

create function public.protect_published_circular()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 if old.status='PUBLISHED' then raise exception 'published circulars are immutable' using errcode='23514'; end if;
 if tg_op='DELETE' then return old; end if; return new;
end;$$;
revoke all on function public.protect_published_circular() from public,anon,authenticated,service_role;
create trigger legal_circulars_protect_published before update or delete on public.legal_circulars for each row execute function public.protect_published_circular();

alter table public.legal_circulars enable row level security;
alter table public.case_deadlines enable row level security;
alter table public.notifications enable row level security;
revoke all on table public.legal_circulars,public.case_deadlines,public.notifications from public,anon,authenticated;
revoke all on table private.delivery_outbox from public,anon,authenticated;
grant select,insert,delete on public.legal_circulars to authenticated;
grant update(title,circular_number,source_url,issued_on,effective_on,summary,status,published_by,published_at) on public.legal_circulars to authenticated;
grant select on public.case_deadlines to authenticated;
grant select on public.notifications to authenticated;
grant update(read_at) on public.notifications to authenticated;

create policy legal_circulars_read on public.legal_circulars for select to authenticated using(status='PUBLISHED' or (select private.is_platform_admin()));
create policy legal_circulars_admin_insert on public.legal_circulars for insert to authenticated with check((select private.is_platform_admin()) and created_by=(select auth.uid()) and status='DRAFT');
create policy legal_circulars_admin_update on public.legal_circulars for update to authenticated using((select private.is_platform_admin())) with check((select private.is_platform_admin()) and (status<>'PUBLISHED' or(published_by=(select auth.uid()) and published_at is not null)));
create policy legal_circulars_admin_delete on public.legal_circulars for delete to authenticated using((select private.is_platform_admin()));
create policy case_deadlines_member_read on public.case_deadlines for select to authenticated using(exists(select 1 from public.compliance_cases c where c.id=case_id and private.is_tenant_member(c.tenant_id)));
create policy notifications_own_read on public.notifications for select to authenticated using(user_id=(select auth.uid()) and private.is_tenant_member(tenant_id));
create policy notifications_own_update on public.notifications for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create function public.publish_circular_and_notify(requested_circular_id uuid,requested_action_url text default '/panel/dashboard')
returns integer language plpgsql security definer set search_path=pg_catalog as $$
declare uid uuid:=auth.uid(); c public.legal_circulars; inserted_count integer;
begin
 if uid is null or not private.is_platform_admin() then raise exception 'platform admin required' using errcode='42501'; end if;
 if requested_action_url is null or requested_action_url!~'^/' then raise exception 'internal action URL required' using errcode='22023'; end if;
 select * into c from public.legal_circulars where id=requested_circular_id for update;
 if c.id is null or c.status<>'DRAFT' then raise exception 'draft circular required' using errcode='22023'; end if;
 update public.legal_circulars set status='PUBLISHED',published_by=uid,published_at=now() where id=c.id returning * into c;
 insert into public.notifications(tenant_id,user_id,circular_id,kind,title,body,action_url,deduplication_key)
 select distinct ea.tenant_id,ut.user_id,c.id,'CIRCULAR',c.title,c.summary,requested_action_url,
   'circular:'||c.id::text||':user:'||ut.user_id::text
 from public.eligibility_assessments ea
 join public.user_tenants ut on ut.tenant_id=ea.tenant_id
 where ea.obligation_version_id=c.obligation_version_id and ea.outcome='ELIGIBLE'
 on conflict(deduplication_key) do nothing;
 get diagnostics inserted_count=row_count;
 return inserted_count;
end;$$;
revoke all on function public.publish_circular_and_notify(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.publish_circular_and_notify(uuid,text) to authenticated;

create function public.set_case_deadline(
  requested_case_id uuid,
  requested_workflow_step_id uuid,
  requested_deadline_type text,
  requested_due_at timestamptz,
  requested_source_circular_id uuid default null,
  requested_reason text default null
)
returns public.case_deadlines language plpgsql security definer set search_path=pg_catalog as $$
declare uid uuid:=auth.uid(); saved public.case_deadlines;
begin
 if uid is null or not private.is_platform_admin() then raise exception 'platform admin required' using errcode='42501'; end if;
 if requested_deadline_type not in('ORIGINAL','EXTENSION') or requested_due_at is null then raise exception 'valid deadline type and due date required' using errcode='22023'; end if;
 if not exists(select 1 from public.compliance_cases where id=requested_case_id) then raise exception 'case not found' using errcode='P0002'; end if;
 if requested_workflow_step_id is not null and not exists(
   select 1 from public.compliance_cases cc join public.workflow_steps ws on ws.workflow_template_id=cc.workflow_template_id
   where cc.id=requested_case_id and ws.id=requested_workflow_step_id
 ) then raise exception 'workflow step does not belong to case' using errcode='22023'; end if;
 if requested_deadline_type='EXTENSION' and not exists(
   select 1 from public.legal_circulars where id=requested_source_circular_id and status='PUBLISHED'
 ) then raise exception 'published source circular required for extension' using errcode='22023'; end if;
 insert into public.case_deadlines(case_id,workflow_step_id,deadline_type,due_at,source_circular_id,reason,created_by)
 values(requested_case_id,requested_workflow_step_id,requested_deadline_type,requested_due_at,requested_source_circular_id,requested_reason,uid)
 returning * into saved;
 return saved;
end;$$;
revoke all on function public.set_case_deadline(uuid,uuid,text,timestamptz,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.set_case_deadline(uuid,uuid,text,timestamptz,uuid,text) to authenticated;

create function public.schedule_deadline_notifications(requested_now timestamptz default now())
returns integer language plpgsql security definer set search_path=pg_catalog as $$
declare uid uuid:=auth.uid(); inserted_count integer;
begin
 if uid is null or not private.is_platform_admin() then raise exception 'platform admin required' using errcode='42501'; end if;
 insert into public.notifications(tenant_id,user_id,case_id,deadline_id,kind,title,body,action_url,deduplication_key)
 select cc.tenant_id,ut.user_id,cc.id,d.id,'DEADLINE','یادآوری مهلت قانونی',
   'مهلت این اقدام تا '||to_char(d.due_at at time zone 'Asia/Tehran','YYYY-MM-DD HH24:MI')||' است.',
   '/panel/dashboard','deadline:'||d.id::text||':user:'||ut.user_id::text||':7d'
 from public.case_deadlines d join public.compliance_cases cc on cc.id=d.case_id
 join public.user_tenants ut on ut.tenant_id=cc.tenant_id
 where d.due_at>requested_now and d.due_at<=requested_now+interval '7 days' and cc.status not in('COMPLETED','CANCELLED')
 on conflict(deduplication_key) do nothing;
 get diagnostics inserted_count=row_count; return inserted_count;
end;$$;
revoke all on function public.schedule_deadline_notifications(timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.schedule_deadline_notifications(timestamptz) to authenticated;

commit;
