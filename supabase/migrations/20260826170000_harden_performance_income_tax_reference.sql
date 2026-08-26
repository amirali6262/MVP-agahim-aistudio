alter type public.tax_case_status add value if not exists 'article_238_review_overdue';
alter type public.tax_case_status add value if not exists 'no_settlement_due_to_no_response';

begin;

-- Published definitions stay immutable for application sessions. A trusted
-- migration (auth.uid() is null) may only enrich the installed reference graph.
create or replace function public.protect_published_workflow_definition()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare version_id uuid;
begin
  if tg_table_name='workflow_templates' then
    version_id := case when tg_op='DELETE' then old.obligation_version_id else new.obligation_version_id end;
  else
    select obligation_version_id into version_id from public.workflow_templates
    where id=case when tg_op='DELETE' then old.workflow_template_id else new.workflow_template_id end;
  end if;
  if auth.uid() is not null and exists(select 1 from public.obligation_versions where id=version_id and status='PUBLISHED') then
    raise exception 'workflow of a published obligation version is immutable' using errcode='23514';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end; $$;

-- Production reference metadata omitted from the first schema pass.
alter table public.tax_legal_references add column if not exists valid_from date;
alter table public.tax_legal_references add column if not exists valid_to date;
alter table public.tax_legal_references add column if not exists invalidated_by uuid references public.tax_legal_references(id);
alter table public.tax_legal_references add column if not exists validity_status text not null default 'ACTIVE';
alter table public.tax_legal_references add column if not exists legal_notes_fa text;
alter table public.tax_legal_references add column if not exists version integer not null default 1;
alter table public.tax_legal_references add constraint tax_legal_references_validity_check
  check (validity_status in ('ACTIVE','SUPERSEDED','REPEALED','INVALIDATED')) not valid;
alter table public.tax_legal_references add constraint tax_legal_references_period_check
  check (valid_to is null or (valid_from is not null and valid_to >= valid_from)) not valid;

alter table public.workflow_steps add column if not exists description_fa text;
alter table public.workflow_steps add column if not exists step_type text not null default 'mandatory';
alter table public.workflow_steps add column if not exists deadline_rule_id uuid;
alter table public.workflow_steps add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.workflow_steps add constraint workflow_steps_tax_step_type_check
  check (step_type in ('mandatory','conditional','terminal','transition','optional')) not valid;

alter table public.workflow_transitions add column if not exists is_automatic boolean not null default false;
alter table public.workflow_transitions add column if not exists requires_human_confirmation boolean not null default true;
alter table public.workflow_transitions add column if not exists legal_basis_id uuid references public.tax_legal_references(id);
alter table public.tax_cases add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.tax_cases add constraint tax_cases_currency_check check (currency='IRR') not valid;
alter table public.tax_cases add constraint tax_cases_nonnegative_amounts_check check (
  declared_taxable_income>=0 and declared_tax>=0 and assessed_taxable_income>=0 and assessed_tax>=0
  and penalties_on_notice>=0 and credits>=0 and previous_payments>=0 and advance_payments>=0
  and withheld_tax>=0 and taxpayer_accepted_amount>=0 and taxpayer_contested_amount>=0
  and adjusted_tax>=0 and disputed_amount_resolved>=0 and remaining_disputed_amount>=0
  and final_tax_amount>=0 and balance_due>=0 and overpayment_amount>=0
) not valid;
alter table public.tax_cases add constraint tax_cases_decision_amounts_check check (
  taxpayer_accepted_amount + taxpayer_contested_amount in (assessed_tax,adjusted_tax,final_tax_amount)
  or taxpayer_accepted_amount + taxpayer_contested_amount = 0
) not valid;

create table public.tax_deadline_rules (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  title_fa text not null,
  anchor_event text not null,
  calendar_days integer not null check (calendar_days >= 0),
  exclude_anchor_day boolean not null default true,
  roll_if_holiday boolean not null default true,
  timezone text not null default 'Asia/Tehran' check (timezone = 'Asia/Tehran'),
  reminder_offsets integer[] not null default '{}',
  legal_basis_id uuid references public.tax_legal_references(id),
  valid_from date not null,
  valid_to date,
  version integer not null default 1 check (version > 0),
  is_active boolean not null default true,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tax_deadline_rules_period_check check (valid_to is null or valid_to >= valid_from)
);

alter table public.workflow_steps
  add constraint workflow_steps_deadline_rule_fk foreign key (deadline_rule_id)
  references public.tax_deadline_rules(id) on delete restrict;

create table public.tax_notification_templates (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  title_fa text not null,
  body_fa text not null,
  actor_role_code text not null,
  priority text not null default 'normal' check (priority in ('low','normal','high','critical')),
  action_url text,
  deadline_rule_id uuid references public.tax_deadline_rules(id),
  offset_days integer,
  escalation_level integer not null default 0,
  is_active boolean not null default true,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.tax_deadline_rules
  (id,code,title_fa,anchor_event,calendar_days,reminder_offsets,legal_basis_id,valid_from,version,metadata)
values
  ('a1000001-0000-0000-0000-000000000001','PIT_ASSESSMENT_OBJECTION_30D','مهلت اعتراض یا قبول برگ تشخیص','valid_assessment_service',30,array[15,7,3,1,0],(select id from public.tax_legal_references where code='ART_238'),'2021-12-12',1,
   '{"service_day_counted":false,"legal_service_silence_finalizes":false,"calendar":"IRAN_OFFICIAL"}'),
  ('a1000001-0000-0000-0000-000000000002','PIT_ARTICLE_238_REVIEW_45D','مهلت رسیدگی مجدد موضوع ماده ۲۳۸','valid_objection_registered',45,array[20,10,5,2,0],(select id from public.tax_legal_references where code='ART_238'),'2021-12-12',1,
   '{"overdue_status":"article_238_review_overdue","auto_referral":false}'),
  ('a1000001-0000-0000-0000-000000000003','PIT_FINAL_TAX_PAYMENT_10D','مهلت پرداخت مالیات قطعی','valid_final_notice_service',10,array[7,3,1,0],(select id from public.tax_legal_references where code='ART_210'),'2021-12-12',1,
   '{"nonpayment_status":"payment_overdue_requires_collection_process","finalization_independent_of_payment":true}'),
  ('a1000001-0000-0000-0000-000000000004','PIT_ELECTRONIC_LEGAL_SERVICE_11D','قاعده ابلاغ قانونی الکترونیکی','assessment_notice_uploaded',11,array[]::integer[],(select id from public.tax_legal_references where code='DIR_ELECTRONIC_SERVICE'),'2022-03-21',1,
   '{"actual_when_viewed_by_day":10,"legal_on_day":11,"roll_if_holiday":true}')
on conflict (code) do update set
  title_fa=excluded.title_fa, anchor_event=excluded.anchor_event,
  calendar_days=excluded.calendar_days, reminder_offsets=excluded.reminder_offsets,
  legal_basis_id=excluded.legal_basis_id, metadata=excluded.metadata, updated_at=now();

alter table public.workflow_steps disable trigger user;
update public.workflow_steps set deadline_rule_id='a1000001-0000-0000-0000-000000000001'
where workflow_template_id='d0000001-0000-0000-0000-000000000001' and code in ('PIT-003','PIT-005','PIT-020','PIT-030');
update public.workflow_steps set deadline_rule_id='a1000001-0000-0000-0000-000000000002'
where workflow_template_id='d0000001-0000-0000-0000-000000000001' and code in ('PIT-022','PIT-023','PIT-024','PIT-025','PIT-026','PIT-027');
update public.workflow_steps set deadline_rule_id='a1000001-0000-0000-0000-000000000003'
where workflow_template_id='d0000001-0000-0000-0000-000000000001' and code='PIT-051';
alter table public.workflow_steps enable trigger user;

-- These mutually exclusive branches are fired by the deterministic deadline
-- evaluator after it has inspected service type and remaining dispute.
alter table public.workflow_transitions disable trigger user;
update public.workflow_transitions set
  trigger_type='TIMEOUT', timeout_interval=interval '30 days',
  is_automatic=true, requires_human_confirmation=false
where workflow_template_id='d0000001-0000-0000-0000-000000000001' and code='T008';
update public.workflow_transitions set
  trigger_type='SYSTEM_EVENT', event_code='ARTICLE_238_RESPONSE_WINDOW_EXPIRED',
  is_automatic=true, requires_human_confirmation=false
where workflow_template_id='d0000001-0000-0000-0000-000000000001' and code='T024';
update public.workflow_transitions set
  trigger_type='SYSTEM_EVENT', event_code='ACTUAL_SERVICE_OBJECTION_WINDOW_EXPIRED',
  is_automatic=true, requires_human_confirmation=false
where workflow_template_id='d0000001-0000-0000-0000-000000000001' and code='T025';
update public.workflow_transitions set
  trigger_type='SYSTEM_EVENT', event_code='LEGAL_SERVICE_DEEMED_OBJECTION',
  is_automatic=true, requires_human_confirmation=false
where workflow_template_id='d0000001-0000-0000-0000-000000000001' and code='T026';
update public.workflow_transitions set event_code='FINAL_NOTICE_ZERO_BALANCE',is_automatic=true,requires_human_confirmation=false
where workflow_template_id='d0000001-0000-0000-0000-000000000001' and code='T030';
update public.workflow_transitions set event_code='FINAL_NOTICE_OVERPAYMENT',is_automatic=true,requires_human_confirmation=false
where workflow_template_id='d0000001-0000-0000-0000-000000000001' and code='T031';
update public.workflow_transitions set event_code='ACTUAL_SERVICE_FINALIZATION_RECORDED',is_automatic=true,requires_human_confirmation=false
where workflow_template_id='d0000001-0000-0000-0000-000000000001' and code='T032';
update public.workflow_transitions set event_code='DEEMED_OBJECTION_REFERRAL_READY',is_automatic=true,requires_human_confirmation=false
where workflow_template_id='d0000001-0000-0000-0000-000000000001' and code='T033';
alter table public.workflow_transitions enable trigger user;

insert into public.tax_notification_templates
  (id,code,title_fa,body_fa,actor_role_code,priority,action_url,deadline_rule_id,offset_days,escalation_level)
values
 ('a2000001-0000-0000-0000-000000000001','PIT_ASSESSMENT_SERVED','ابلاغ برگ تشخیص','برگ تشخیص ابلاغ شد. نوع و تاریخ ابلاغ، اقدام لازم و آخرین مهلت را در پرونده بررسی کنید.','taxpayer','critical','/panel/dashboard','a1000001-0000-0000-0000-000000000001',30,0),
 ('a2000001-0000-0000-0000-000000000002','PIT_OBJECTION_7D','۷ روز تا پایان مهلت اعتراض','برای حفظ حق اعتراض، اعتراض و مدارک را حداکثر تا تاریخ درج‌شده در پرونده ثبت کنید.','taxpayer','high','/panel/dashboard','a1000001-0000-0000-0000-000000000001',7,1),
 ('a2000001-0000-0000-0000-000000000003','PIT_OBJECTION_LAST_DAY','آخرین روز مهلت اعتراض','امروز آخرین روز اقدام است. عدم اقدام پس از ابلاغ واقعی می‌تواند موجب قطعیت شود.','taxpayer','critical','/panel/dashboard','a1000001-0000-0000-0000-000000000001',0,2),
 ('a2000001-0000-0000-0000-000000000004','PIT_238_REVIEW_OVERDUE','تخطی از مهلت رسیدگی ماده ۲۳۸','مهلت رسیدگی سپری شده و نتیجه‌ای ثبت نشده است؛ انتقال حقوقی خودکار انجام نمی‌شود و پیگیری مدیریتی لازم است.','article_238_responsible_officer','critical','/admin/objections/templates','a1000001-0000-0000-0000-000000000002',0,2),
 ('a2000001-0000-0000-0000-000000000005','PIT_FINAL_PAYMENT_DUE','شروع مهلت پرداخت مالیات قطعی','برگ قطعی ابلاغ شد. در صورت وجود مانده، پرداخت یا ترتیب پرداخت را تا مهلت درج‌شده انجام دهید.','taxpayer','high','/panel/dashboard','a1000001-0000-0000-0000-000000000003',10,0)
on conflict (code) do update set title_fa=excluded.title_fa, body_fa=excluded.body_fa,
  priority=excluded.priority, deadline_rule_id=excluded.deadline_rule_id,
  offset_days=excluded.offset_days, updated_at=now();

create or replace function public.tax_is_holiday(requested_date date)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select extract(dow from requested_date)=5
    or exists(select 1 from public.iran_holidays where holiday_date=requested_date);
$$;

create or replace function public.calculate_tax_deadline(requested_anchor timestamptz, requested_rule_code text)
returns timestamptz language plpgsql stable security definer set search_path=pg_catalog as $$
declare selected_rule public.tax_deadline_rules; local_date date; local_time time; result_date date;
begin
  select * into selected_rule from public.tax_deadline_rules
  where code=requested_rule_code and is_active
    and (valid_to is null or valid_to >= (requested_anchor at time zone 'Asia/Tehran')::date)
    and valid_from <= (requested_anchor at time zone 'Asia/Tehran')::date
  order by version desc limit 1;
  if selected_rule.id is null then raise exception 'active deadline rule not found' using errcode='22023'; end if;
  local_date := (requested_anchor at time zone selected_rule.timezone)::date;
  local_time := (requested_anchor at time zone selected_rule.timezone)::time;
  result_date := local_date + selected_rule.calendar_days;
  if selected_rule.roll_if_holiday then
    while public.tax_is_holiday(result_date) loop result_date := result_date + 1; end loop;
  end if;
  return (result_date + local_time) at time zone selected_rule.timezone;
end; $$;

create or replace function public.get_effective_service_date(upload_date timestamptz, viewed_date timestamptz)
returns timestamptz language plpgsql stable security definer set search_path=pg_catalog as $$
declare tenth_day_end timestamptz; legal_date date; local_time time;
begin
  if upload_date is null then return null; end if;
  tenth_day_end := ((((upload_date at time zone 'Asia/Tehran')::date + 10) + time '23:59:59.999999') at time zone 'Asia/Tehran');
  if viewed_date is not null and viewed_date between upload_date and tenth_day_end then return viewed_date; end if;
  legal_date := (upload_date at time zone 'Asia/Tehran')::date + 11;
  while public.tax_is_holiday(legal_date) loop legal_date := legal_date + 1; end loop;
  local_time := (upload_date at time zone 'Asia/Tehran')::time;
  return (legal_date + local_time) at time zone 'Asia/Tehran';
end; $$;

create or replace function public.validate_tax_service_record()
returns trigger language plpgsql set search_path=pg_catalog as $$
declare issue_at timestamptz;
begin
  if new.service_type in ('actual','legal') and (not new.is_valid or new.effective_service_date is null) then
    raise exception 'valid actual/legal service requires an effective date' using errcode='23514';
  end if;
  select min(occurred_at) into issue_at from public.case_events
    where tax_case_id=new.tax_case_id and event_type='ASSESSMENT';
  if issue_at is not null and new.effective_service_date < issue_at then
    raise exception 'service cannot precede assessment issue' using errcode='23514';
  end if;
  return new;
end; $$;
create trigger tax_service_records_validate before insert or update on public.tax_service_records
for each row execute function public.validate_tax_service_record();

create or replace function public.audit_tax_case_change()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  if new.status is distinct from old.status then
    insert into public.tax_audit_log(tax_case_id,action,table_name,record_id,old_values,new_values,performed_by)
    values(new.id,'STATUS_CHANGE','tax_cases',new.id,jsonb_build_object('status',old.status),jsonb_build_object('status',new.status),auth.uid());
  end if;
  if row(new.declared_tax,new.assessed_tax,new.taxpayer_accepted_amount,new.taxpayer_contested_amount,new.adjusted_tax,new.final_tax_amount,new.balance_due,new.overpayment_amount)
     is distinct from row(old.declared_tax,old.assessed_tax,old.taxpayer_accepted_amount,old.taxpayer_contested_amount,old.adjusted_tax,old.final_tax_amount,old.balance_due,old.overpayment_amount) then
    insert into public.tax_audit_log(tax_case_id,action,table_name,record_id,old_values,new_values,performed_by)
    values(new.id,'FINANCIAL_CHANGE','tax_cases',new.id,to_jsonb(old),to_jsonb(new),auth.uid());
  end if;
  return new;
end; $$;
create trigger tax_cases_audit before update on public.tax_cases for each row execute function public.audit_tax_case_change();

alter table public.tax_objection_items add constraint tax_objection_items_amounts_check check (
  initial_amount >= 0 and taxpayer_accepted_amount >= 0 and taxpayer_contested_amount >= 0
  and taxpayer_accepted_amount + taxpayer_contested_amount = initial_amount
  and organization_accepted_amount >= 0 and remaining_disputed_amount >= 0
) not valid;
create unique index tax_cases_active_assessment_unique on public.tax_cases((metadata->>'assessment_notice_id'))
  where status not in ('referred_to_first_instance_board','paid','no_payment_required')
    and nullif(metadata->>'assessment_notice_id','') is not null;

-- Fail closed: reference data is readable, tenant data is tenant-isolated, and
-- all writes go through reviewed RPCs or trusted migrations.
alter table public.tax_actors enable row level security;
alter table public.tax_document_types enable row level security;
alter table public.tax_legal_references enable row level security;
alter table public.tax_deadline_rules enable row level security;
alter table public.tax_notification_templates enable row level security;
alter table public.tax_cases enable row level security;
alter table public.tax_financial_records enable row level security;
alter table public.tax_service_records enable row level security;
alter table public.tax_objection_items enable row level security;
alter table public.tax_audit_log enable row level security;
alter table public.tax_notifications enable row level security;
alter table public.tax_deadline_history enable row level security;
alter table public.tax_transition_history enable row level security;
alter table public.tax_ai_decisions enable row level security;

revoke all on table public.tax_actors,public.tax_document_types,public.tax_legal_references,
  public.tax_deadline_rules,public.tax_notification_templates,public.tax_cases,
  public.tax_financial_records,public.tax_service_records,public.tax_objection_items,
  public.tax_audit_log,public.tax_notifications,public.tax_deadline_history,
  public.tax_transition_history,public.tax_ai_decisions from public,anon,authenticated;
grant select on table public.tax_actors,public.tax_document_types,public.tax_legal_references,
  public.tax_deadline_rules,public.tax_notification_templates to authenticated;
grant select on table public.tax_cases,public.tax_financial_records,public.tax_service_records,
  public.tax_objection_items,public.tax_audit_log,public.tax_notifications,
  public.tax_deadline_history,public.tax_transition_history,public.tax_ai_decisions to authenticated;

create policy tax_reference_actors_read on public.tax_actors for select to authenticated using (is_active);
create policy tax_reference_documents_read on public.tax_document_types for select to authenticated using (is_active);
create policy tax_reference_legal_read on public.tax_legal_references for select to authenticated using (is_active);
create policy tax_reference_deadlines_read on public.tax_deadline_rules for select to authenticated using (is_active);
create policy tax_reference_notifications_read on public.tax_notification_templates for select to authenticated using (is_active);
create policy tax_cases_member_read on public.tax_cases for select to authenticated using (private.is_tenant_member(tenant_id));
create policy tax_financial_member_read on public.tax_financial_records for select to authenticated using
  (exists(select 1 from public.tax_cases c where c.id=tax_case_id and private.is_tenant_member(c.tenant_id)));
create policy tax_service_member_read on public.tax_service_records for select to authenticated using
  (exists(select 1 from public.tax_cases c where c.id=tax_case_id and private.is_tenant_member(c.tenant_id)));
create policy tax_objection_member_read on public.tax_objection_items for select to authenticated using
  (exists(select 1 from public.tax_cases c where c.id=tax_case_id and private.is_tenant_member(c.tenant_id)));
create policy tax_audit_member_read on public.tax_audit_log for select to authenticated using
  (exists(select 1 from public.tax_cases c where c.id=tax_case_id and private.is_tenant_member(c.tenant_id)));
create policy tax_notification_member_read on public.tax_notifications for select to authenticated using
  (exists(select 1 from public.tax_cases c where c.id=tax_case_id and private.is_tenant_member(c.tenant_id)));
create policy tax_deadline_member_read on public.tax_deadline_history for select to authenticated using
  (exists(select 1 from public.tax_cases c where c.id=tax_case_id and private.is_tenant_member(c.tenant_id)));
create policy tax_transition_member_read on public.tax_transition_history for select to authenticated using
  (exists(select 1 from public.tax_cases c where c.id=tax_case_id and private.is_tenant_member(c.tenant_id)));
create policy tax_ai_member_read on public.tax_ai_decisions for select to authenticated using
  (exists(select 1 from public.tax_cases c where c.id=tax_case_id and private.is_tenant_member(c.tenant_id)));

revoke all on function public.tax_is_holiday(date), public.calculate_tax_deadline(timestamptz,text),
  public.get_effective_service_date(timestamptz,timestamptz), public.validate_tax_service_record(),
  public.audit_tax_case_change(), public.record_tax_audit(uuid,tax_audit_action,text,uuid,jsonb,jsonb,uuid,jsonb),
  public.create_tax_notification(uuid,text,text,text,text,text,timestamptz,text)
  from public,anon,authenticated,service_role;
grant execute on function public.tax_is_holiday(date), public.calculate_tax_deadline(timestamptz,text),
  public.get_effective_service_date(timestamptz,timestamptz) to authenticated;

commit;
