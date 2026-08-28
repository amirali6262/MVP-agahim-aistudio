\set ON_ERROR_STOP on
begin;

do $$
declare
  workflow_id uuid := 'd0000001-0000-0000-0000-000000000001';
  missing_codes text[];
  reference_count integer;
begin
  if not exists (
    select 1 from public.obligations o
    join public.obligation_versions v on v.obligation_id=o.id
    where o.code='PERFORMANCE_INCOME_TAX' and o.is_active and v.status in ('DRAFT','PUBLISHED')
  ) then raise exception 'published performance income tax obligation missing'; end if;

  select array_agg(required_code) into missing_codes
  from unnest(array['PIT_001','PIT_002','PIT_003','PIT_004','PIT_005','PIT_010','PIT_011','PIT_012',
    'PIT_020','PIT_021','PIT_022','PIT_023','PIT_024','PIT_025','PIT_026','PIT_027',
    'PIT_030','PIT_031','PIT_032','PIT_040','PIT_050','PIT_051']) required_code
  where not exists(select 1 from public.workflow_steps s where s.workflow_template_id=workflow_id and s.code=required_code);
  if missing_codes is not null then raise exception 'missing workflow steps: %',missing_codes; end if;

  if exists(select 1 from public.workflow_steps where workflow_template_id=workflow_id
    and (actor_role_code is null or input_document_types is null or output_document_types is null
      or form_schema is null or user_guidance_fa is null)) then
    raise exception 'workflow step metadata incomplete';
  end if;

  if exists(select 1 from public.workflow_transitions t where workflow_template_id=workflow_id
    and to_step_id is not null and not exists(select 1 from public.workflow_steps s where s.id=t.to_step_id)) then
    raise exception 'transition has missing destination';
  end if;

  if exists(select 1 from public.workflow_steps s where s.workflow_template_id=workflow_id
    and s.code not in ('PIT_040','PIT_051')
    and not exists(select 1 from public.workflow_transitions t where t.from_step_id=s.id and t.is_active)) then
    raise exception 'unexpected workflow dead end';
  end if;

  select count(*) into reference_count from public.tax_legal_references where is_active;
  if reference_count < 18 then raise exception 'legal references incomplete: %',reference_count; end if;
  if exists(select 1 from public.tax_legal_references where validity_status in ('SUPERSEDED','REPEALED','INVALIDATED') and is_active) then
    raise exception 'invalidated legal source cannot remain active';
  end if;
end $$;

do $$
declare anchor timestamptz := '2026-08-01 08:00:00+00'; calculated timestamptz;
begin
  calculated := public.calculate_tax_deadline(anchor,'PIT_ASSESSMENT_OBJECTION_30D');
  if calculated <= anchor or (calculated at time zone 'Asia/Tehran')::date < (anchor at time zone 'Asia/Tehran')::date + 30 then
    raise exception '30-day deadline calculation failed: %',calculated;
  end if;
  if public.get_effective_service_date('2026-08-01 08:00:00+00','2026-08-05 09:00:00+00') <> '2026-08-05 09:00:00+00' then
    raise exception 'viewed electronic notice must use actual viewed timestamp';
  end if;
  if public.get_effective_service_date('2026-08-01 08:00:00+00',null) <= '2026-08-11 08:00:00+00' then
    raise exception 'unviewed electronic notice must become legal no earlier than day eleven';
  end if;
end $$;

-- Idempotency: reference upserts must not multiply stable codes.
insert into public.tax_deadline_rules
  (id,code,title_fa,anchor_event,calendar_days,valid_from,version)
values ('a1000001-0000-0000-0000-000000000001','PIT_ASSESSMENT_OBJECTION_30D','مهلت اعتراض یا قبول برگ تشخیص','valid_assessment_service',30,'2021-12-12',1)
on conflict (code) do update set title_fa=excluded.title_fa;

do $$ begin
  if (select count(*) from public.tax_deadline_rules where code='PIT_ASSESSMENT_OBJECTION_30D') <> 1 then
    raise exception 'deadline reference upsert is not idempotent';
  end if;
  if exists(select 1 from public.workflow_transitions t
    join public.workflow_steps s on s.id=t.from_step_id
    where s.code='PIT_030'      and t.outcome_code='LEGAL_SERVICE_DEEMED_OBJECTION'
      and t.to_step_id <> 'e0000001-0000-0000-0000-000000000032') then
    raise exception 'legal service silence must refer, not finalize';
  end if;
  if not exists(select 1 from public.workflow_transitions
    where from_step_id='e0000001-0000-0000-0000-000000000032'
      and to_step_id='e0000001-0000-0000-0000-000000000040') then
    raise exception 'deemed objection branch must terminate at first-instance referral';
  end if;
  if exists(select 1 from public.workflow_transitions t
    join public.workflow_steps s on s.id=t.from_step_id
    where s.code='PIT_027' and t.outcome_code='NO_RESPONSE'
      and t.to_step_id <> 'e0000001-0000-0000-0000-000000000040') then
    raise exception 'taxpayer silence about review result must not mean acceptance';
  end if;
end $$;

rollback;
