begin;

create table public.case_events (
  id uuid primary key default extensions.gen_random_uuid(),
  case_id uuid not null references public.compliance_cases(id) on delete cascade,
  event_type text not null constraint case_events_type_check check(event_type in(
    'ASSESSMENT','OBJECTION_SUBMITTED','HEARING','DECISION','PAYMENT_PLAN',
    'PAYMENT','SETTLEMENT_REQUEST','SETTLED','CLOSED','NOTE'
  )),
  occurred_at timestamptz not null,
  title text not null constraint case_events_title_check check(btrim(title)<>''),
  description text,
  reference_number text,
  amount numeric(20,0) constraint case_events_amount_check check(amount is null or amount>=0),
  metadata jsonb not null default '{}'::jsonb constraint case_events_metadata_check check(jsonb_typeof(metadata)='object'),
  recorded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.penalty_estimates (
  id uuid primary key default extensions.gen_random_uuid(),
  case_id uuid not null references public.compliance_cases(id) on delete cascade,
  obligation_version_id uuid not null references public.obligation_versions(id) on delete restrict,
  deadline_id uuid references public.case_deadlines(id) on delete restrict,
  base_amount numeric(20,0) not null constraint penalty_estimates_base_check check(base_amount>=0),
  days_late integer not null constraint penalty_estimates_days_check check(days_late>=0),
  gross_amount numeric(20,0) not null constraint penalty_estimates_gross_check check(gross_amount>=0),
  waived_amount numeric(20,0) not null default 0 constraint penalty_estimates_waived_check check(waived_amount>=0),
  paid_amount numeric(20,0) not null default 0 constraint penalty_estimates_paid_check check(paid_amount>=0),
  estimated_amount numeric(20,0) not null constraint penalty_estimates_net_check check(estimated_amount>=0),
  calculation_rule jsonb not null constraint penalty_estimates_rule_check check(jsonb_typeof(calculation_rule)='object'),
  calculated_as_of date not null,
  calculated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint penalty_estimates_case_asof_key unique(case_id,calculated_as_of)
);

create index case_events_case_timeline_idx on public.case_events(case_id,occurred_at desc);
create index case_events_recorded_by_idx on public.case_events(recorded_by);
create index penalty_estimates_obligation_version_idx on public.penalty_estimates(obligation_version_id);
create index penalty_estimates_deadline_idx on public.penalty_estimates(deadline_id) where deadline_id is not null;
create index penalty_estimates_calculated_by_idx on public.penalty_estimates(calculated_by);

alter table public.case_events enable row level security;
alter table public.penalty_estimates enable row level security;
revoke all on table public.case_events,public.penalty_estimates from public,anon,authenticated;
grant select on table public.case_events,public.penalty_estimates to authenticated;

create policy case_events_member_read on public.case_events for select to authenticated
using(exists(select 1 from public.compliance_cases c where c.id=case_id and private.is_tenant_member(c.tenant_id)));
create policy penalty_estimates_member_read on public.penalty_estimates for select to authenticated
using(exists(select 1 from public.compliance_cases c where c.id=case_id and private.is_tenant_member(c.tenant_id)));

create function public.record_case_event(
 requested_case_id uuid,requested_event_type text,requested_occurred_at timestamptz,
 requested_title text,requested_description text default null,requested_reference_number text default null,
 requested_amount numeric default null,requested_metadata jsonb default '{}'::jsonb
)
returns public.case_events language plpgsql security definer set search_path=pg_catalog as $$
declare uid uuid:=auth.uid();tenant_id uuid;saved public.case_events;admin_event boolean;
begin
 if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'authentication required'using errcode='42501';end if;
 select c.tenant_id into tenant_id from public.compliance_cases c where c.id=requested_case_id;
 if tenant_id is null then raise exception 'case not found'using errcode='P0002';end if;
 admin_event:=requested_event_type in('ASSESSMENT','HEARING','DECISION','PAYMENT_PLAN','SETTLED','CLOSED');
 if admin_event then
   if not private.is_platform_admin() then raise exception 'platform admin required for this event'using errcode='42501';end if;
 else
   if not private.has_tenant_role(tenant_id,array['OWNER','ADMIN']) and not private.is_platform_admin() then raise exception 'tenant manager required'using errcode='42501';end if;
 end if;
 if requested_occurred_at is null or requested_occurred_at>now()+interval '5 minutes' or requested_title is null or btrim(requested_title)='' then raise exception 'valid event date and title required'using errcode='22023';end if;
 if requested_amount is not null and requested_amount<0 then raise exception 'amount cannot be negative'using errcode='22023';end if;
 if requested_metadata is null or jsonb_typeof(requested_metadata)<>'object' then raise exception 'metadata must be an object'using errcode='22023';end if;
 insert into public.case_events(case_id,event_type,occurred_at,title,description,reference_number,amount,metadata,recorded_by)
 values(requested_case_id,requested_event_type,requested_occurred_at,btrim(requested_title),requested_description,requested_reference_number,requested_amount,requested_metadata,uid)
 returning * into saved;return saved;
end;$$;
revoke all on function public.record_case_event(uuid,text,timestamptz,text,text,text,numeric,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.record_case_event(uuid,text,timestamptz,text,text,text,numeric,jsonb) to authenticated;

create function public.estimate_case_penalty(
 requested_case_id uuid,requested_base_amount numeric,requested_as_of date default current_date,
 requested_waived_amount numeric default 0,requested_paid_amount numeric default 0
)
returns public.penalty_estimates language plpgsql security definer set search_path=pg_catalog as $$
declare uid uuid:=auth.uid();c public.compliance_cases;d public.case_deadlines;rule jsonb;rule_type text;rate numeric;fixed_amount numeric;cap_amount numeric;late_days integer;gross numeric;net numeric;saved public.penalty_estimates;
begin
 if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'authentication required'using errcode='42501';end if;
 select * into c from public.compliance_cases where id=requested_case_id;
 if c.id is null or not private.is_tenant_member(c.tenant_id) then raise exception 'tenant membership required'using errcode='42501';end if;
 if requested_base_amount is null or requested_base_amount<0 or requested_as_of is null or requested_waived_amount<0 or requested_paid_amount<0 then raise exception 'non-negative amounts and calculation date required'using errcode='22023';end if;
 select * into d from public.case_deadlines where case_id=c.id order by due_at desc limit 1;
 select penalty_rule into rule from public.obligation_versions where id=c.obligation_version_id;
 rule_type:=coalesce(rule->>'type','NONE');rate:=coalesce((rule->>'rate_percent')::numeric,0);fixed_amount:=coalesce((rule->>'amount')::numeric,0);cap_amount:=(rule->>'cap_amount')::numeric;
 late_days:=case when d.id is null then 0 else greatest(requested_as_of-d.due_at::date,0) end;
 gross:=case rule_type when'FIXED'then fixed_amount when'PERCENTAGE'then requested_base_amount*rate/100 when'DAILY_PERCENTAGE'then requested_base_amount*rate/100*late_days else 0 end;
 if cap_amount is not null then gross:=least(gross,cap_amount);end if;gross:=round(greatest(gross,0));net:=greatest(gross-requested_waived_amount-requested_paid_amount,0);
 insert into public.penalty_estimates(case_id,obligation_version_id,deadline_id,base_amount,days_late,gross_amount,waived_amount,paid_amount,estimated_amount,calculation_rule,calculated_as_of,calculated_by)
 values(c.id,c.obligation_version_id,d.id,requested_base_amount,late_days,gross,requested_waived_amount,requested_paid_amount,net,rule,requested_as_of,uid)
 on conflict(case_id,calculated_as_of)do update set deadline_id=excluded.deadline_id,base_amount=excluded.base_amount,days_late=excluded.days_late,gross_amount=excluded.gross_amount,waived_amount=excluded.waived_amount,paid_amount=excluded.paid_amount,estimated_amount=excluded.estimated_amount,calculation_rule=excluded.calculation_rule,calculated_by=excluded.calculated_by,created_at=now()
 returning * into saved;return saved;
end;$$;
revoke all on function public.estimate_case_penalty(uuid,numeric,date,numeric,numeric) from public,anon,authenticated,service_role;
grant execute on function public.estimate_case_penalty(uuid,numeric,date,numeric,numeric) to authenticated;

create function public.get_tenant_compliance_summary(requested_tenant_id uuid)
returns table(total_cases bigint,open_cases bigint,overdue_cases bigint,completed_cases bigint,unread_notifications bigint,total_estimated_penalties numeric)
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if auth.uid() is null or not private.is_tenant_member(requested_tenant_id) then raise exception 'tenant membership required'using errcode='42501';end if;
 return query select
  count(distinct c.id),count(distinct c.id)filter(where c.status in('OPEN','IN_PROGRESS','BLOCKED')),
  count(distinct c.id)filter(where c.status not in('COMPLETED','CANCELLED')and exists(select 1 from public.case_deadlines d where d.case_id=c.id and d.due_at<now())),
  count(distinct c.id)filter(where c.status='COMPLETED'),
  (select count(*)from public.notifications n where n.tenant_id=requested_tenant_id and n.user_id=auth.uid()and n.read_at is null),
  coalesce((select sum(pe.estimated_amount)from public.penalty_estimates pe join public.compliance_cases pc on pc.id=pe.case_id where pc.tenant_id=requested_tenant_id and pe.calculated_as_of=(select max(pe2.calculated_as_of)from public.penalty_estimates pe2 where pe2.case_id=pe.case_id)),0)
 from public.compliance_cases c where c.tenant_id=requested_tenant_id;
end;$$;
revoke all on function public.get_tenant_compliance_summary(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_tenant_compliance_summary(uuid) to authenticated;

commit;
