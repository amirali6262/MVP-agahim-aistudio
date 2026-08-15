begin;

create extension if not exists pg_cron with schema pg_catalog;

create function private.queue_notification_delivery()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  contact public.users;
begin
  select * into contact from public.users where id=new.user_id;
  if nullif(btrim(contact.email),'') is not null then
    insert into private.delivery_outbox(notification_id,channel)
    values(new.id,'EMAIL')
    on conflict(notification_id,channel) do nothing;
  end if;
  if nullif(btrim(contact.phone),'') is not null then
    insert into private.delivery_outbox(notification_id,channel)
    values(new.id,'SMS')
    on conflict(notification_id,channel) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.queue_notification_delivery()
  from public,anon,authenticated,service_role;

create trigger notifications_queue_delivery
after insert on public.notifications
for each row execute function private.queue_notification_delivery();

create function private.generate_deadline_notifications(requested_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  inserted_count integer;
begin
  if requested_now is null then
    raise exception 'scheduler time required' using errcode='22023';
  end if;

  insert into public.notifications(
    tenant_id,user_id,case_id,deadline_id,kind,title,body,action_url,deduplication_key
  )
  select
    cc.tenant_id,
    ut.user_id,
    cc.id,
    d.id,
    'DEADLINE',
    case reminder.days_before
      when -1 then 'مهلت قانونی گذشته است'
      when 0 then 'امروز آخرین مهلت قانونی است'
      else 'یادآوری مهلت قانونی'
    end,
    case reminder.days_before
      when -1 then 'مهلت این اقدام گذشته است. وضعیت را همین امروز بررسی کنید.'
      when 0 then 'امروز آخرین مهلت این اقدام است.'
      else reminder.days_before::text||' روز تا پایان مهلت این اقدام باقی مانده است.'
    end||' تاریخ مهلت: '||
      to_char(d.due_at at time zone 'Asia/Tehran','YYYY-MM-DD HH24:MI'),
    '/panel/dashboard',
    'deadline:'||d.id::text||':user:'||ut.user_id::text||':window:'||reminder.days_before::text
  from public.case_deadlines d
  join public.compliance_cases cc on cc.id=d.case_id
  join public.user_tenants ut on ut.tenant_id=cc.tenant_id
  cross join (values(30),(14),(7),(3),(1),(0),(-1)) reminder(days_before)
  where cc.status not in('COMPLETED','CANCELLED')
    and (d.due_at at time zone 'Asia/Tehran')::date
      = (requested_now at time zone 'Asia/Tehran')::date + reminder.days_before
  on conflict(deduplication_key) do nothing;

  get diagnostics inserted_count=row_count;
  return inserted_count;
end;
$$;
revoke all on function private.generate_deadline_notifications(timestamptz)
  from public,anon,authenticated,service_role;

create or replace function public.schedule_deadline_notifications(requested_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path=pg_catalog
as $$
begin
  if auth.uid() is null or not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode='42501';
  end if;
  return private.generate_deadline_notifications(requested_now);
end;
$$;
revoke all on function public.schedule_deadline_notifications(timestamptz)
  from public,anon,authenticated,service_role;
grant execute on function public.schedule_deadline_notifications(timestamptz)
  to authenticated;

select cron.unschedule(jobid)
from cron.job
where jobname='agahim-deadline-reminders';

select cron.schedule(
  'agahim-deadline-reminders',
  '15 3 * * *',
  'select private.generate_deadline_notifications(now())'
);

commit;
