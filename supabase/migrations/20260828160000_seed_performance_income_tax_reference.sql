begin;

-- The schema migration defines the PIT engine, but the reference catalog must
-- also be installed for a fresh database. All identifiers are deterministic so
-- this migration is idempotent and can safely repair a partially seeded DB.
insert into public.obligation_families (id, code, domain, title, description, is_active, created_by)
values ('c0000001-0000-0000-0000-000000000001', 'DIRECT_TAX', 'TAX', 'مالیات‌های مستقیم', 'تکالیف قانون مالیات‌های مستقیم', true, null)
on conflict (code) do update set is_active=true, updated_at=now();

insert into public.obligations (id, family_id, code, title, summary, authority_name, is_active, created_by)
values ('c0000001-0000-0000-0000-000000000002', (select id from public.obligation_families where code='DIRECT_TAX'),
  'PERFORMANCE_INCOME_TAX', 'مالیات بر عملکرد', 'فرایند تشخیص، اعتراض، قطعیت و پرداخت مالیات بر عملکرد',
  'سازمان امور مالیاتی کشور', true, null)
on conflict (code) do update set is_active=true, updated_at=now();

insert into public.obligation_versions
  (id, obligation_id, version_number, status, legal_reference, audience_summary,
   effective_from, published_at, created_by)
values ('c0000001-0000-0000-0000-000000000003', (select id from public.obligations where code='PERFORMANCE_INCOME_TAX'), 1,
  'DRAFT', 'قانون مالیات‌های مستقیم', 'مودیان مشمول مالیات بر عملکرد', '2021-12-12', null, null)
on conflict (obligation_id, version_number) do nothing;

insert into public.workflow_templates (id, obligation_version_id, title, created_by)
select 'd0000001-0000-0000-0000-000000000001', v.id,
  'فرایند مرجع مالیات بر عملکرد', null
from public.obligation_versions v
join public.obligations o on o.id=v.obligation_id
where o.code='PERFORMANCE_INCOME_TAX'
  and v.version_number=1
  and v.status='DRAFT'
on conflict (obligation_version_id) do update set title=excluded.title, updated_at=now();

with required_steps(code, seq, title, actor_role, actor) as (values
  ('PIT-001',1,'تهیه گزارش رسیدگی','tax_audit_unit','AUTHORITY'),
  ('PIT-002',2,'صدور برگ تشخیص','tax_assessment_issuer','AUTHORITY'),
  ('PIT-003',3,'ابلاغ برگ تشخیص','tax_notification_unit','AUTHORITY'),
  ('PIT-004',4,'دریافت جزئیات گزارش مبنای تشخیص','taxpayer','USER'),
  ('PIT-005',5,'مهلت تصمیم مؤدی','taxpayer','USER'),
  ('PIT-010',10,'اعلام قبول کتبی','taxpayer','USER'),
  ('PIT-011',11,'پرداخت یا ترتیب پرداخت','taxpayer','USER'),
  ('PIT-012',12,'قطعیت ناشی از قبول یا رفع اختلاف','tax_finalization_collection_unit','AUTHORITY'),
  ('PIT-020',20,'ثبت اعتراض ماده ۲۳۸','taxpayer','USER'),
  ('PIT-021',21,'ارجاع داخلی اعتراض','tax_objection_unit','AUTHORITY'),
  ('PIT-022',22,'رسیدگی مجدد ماده ۲۳۸','article_238_responsible_officer','AUTHORITY'),
  ('PIT-023',23,'صدور قرار بررسی مجدد','article_238_responsible_officer','AUTHORITY'),
  ('PIT-024',24,'اجرای قرار کارشناسی','tax_reexamination_expert','AUTHORITY'),
  ('PIT-025',25,'رسیدگی نهایی ماده ۲۳۸','article_238_responsible_officer','AUTHORITY'),
  ('PIT-026',26,'اعلام نتیجه رسیدگی مجدد','tax_objection_unit','AUTHORITY'),
  ('PIT-027',27,'تصمیم مؤدی درباره نتیجه رسیدگی','taxpayer','USER'),
  ('PIT-030',30,'پایان مهلت اعتراض با ابلاغ واقعی','system_automation','AUTHORITY'),
  ('PIT-031',31,'پایان مهلت با ابلاغ قانونی','system_automation','AUTHORITY'),
  ('PIT-032',32,'ارجاع به هیأت حل اختلاف بدوی','tax_objection_unit','AUTHORITY'),
  ('PIT-040',40,'رسیدگی هیأت حل اختلاف بدوی','first_instance_tax_dispute_board','AUTHORITY'),
  ('PIT-050',50,'صدور برگ قطعی مالیات بر عملکرد','tax_finalization_collection_unit','AUTHORITY'),
  ('PIT-051',51,'پرداخت مالیات قطعی','taxpayer','USER')
)
insert into public.workflow_steps
  (id, workflow_template_id, sequence, code, title, actor, due_rule, form_schema,
   actor_role_code, input_document_types, output_document_types, user_guidance_fa)
select ('e0000001-0000-0000-0000-' || lpad(seq::text,12,'0'))::uuid,
  'd0000001-0000-0000-0000-000000000001', seq, code, title, actor, '{}'::jsonb,
  '{"fields":[]}'::jsonb, actor_role, '{}'::text[], '{}'::text[], title
from required_steps
where exists (
  select 1 from public.obligation_versions v
  join public.obligations o on o.id=v.obligation_id
  where o.code='PERFORMANCE_INCOME_TAX'
    and v.version_number=1
    and v.status='DRAFT'
)
on conflict (workflow_template_id, code) do update set
  sequence=excluded.sequence, title=excluded.title, actor=excluded.actor,
  actor_role_code=excluded.actor_role_code, input_document_types=excluded.input_document_types,
  output_document_types=excluded.output_document_types, user_guidance_fa=excluded.user_guidance_fa;

-- A compact connected reference graph. Detailed branching metadata is enriched
-- by the hardening migration; these edges guarantee no accidental dead ends.
with edges(code, from_seq, to_seq, outcome) as (values
  ('PIT_T001',1,2,'COMPLETED'), ('PIT_T002',2,3,'COMPLETED'),
  ('PIT_T003',3,4,'DETAILS_REQUESTED'), ('PIT_T004',4,5,'COMPLETED'),
  ('PIT_T005',5,10,'ACCEPTED'), ('PIT_T006',10,11,'PAYMENT_DUE'),
  ('PIT_T007',11,12,'PAID'), ('PIT_T008',12,50,'FINALIZED'),
  ('PIT_T020',5,20,'OBJECTION_FILED'), ('PIT_T021',20,21,'COMPLETED'),
  ('PIT_T022',21,22,'COMPLETED'), ('PIT_T023',22,23,'EXPERT_REVIEW'),
  ('PIT_T024',23,24,'COMPLETED'), ('PIT_T025',24,25,'COMPLETED'),
  ('PIT_T026',25,26,'COMPLETED'), ('PIT_T027',26,27,'COMPLETED'),
  ('PIT_T028',27,40,'NO_RESPONSE'), ('PIT_T030',5,30,'ACTUAL_SERVICE_EXPIRED'),
  ('PIT_T031',5,31,'LEGAL_SERVICE_EXPIRED'),
  ('PIT_T032',30,32,'LEGAL_SERVICE_DEEMED_OBJECTION'),
  ('PIT_T033',31,32,'LEGAL_SERVICE_DEEMED_OBJECTION'),
  ('PIT_T034',32,40,'REFERRED'), ('PIT_T040',40,50,'DECIDED'),
  ('PIT_T050',50,51,'FINAL_NOTICE_ISSUED')
)
insert into public.workflow_transitions
  (workflow_template_id, from_step_id, to_step_id, code, title, trigger_type,
   outcome_code, priority, condition_expression, is_active)
select 'd0000001-0000-0000-0000-000000000001',
  ('e0000001-0000-0000-0000-' || lpad(from_seq::text,12,'0'))::uuid,
  ('e0000001-0000-0000-0000-' || lpad(to_seq::text,12,'0'))::uuid,
  code, outcome, 'USER_ACTION', outcome, 100, outcome, true
from edges
where exists (
  select 1 from public.obligation_versions v
  join public.obligations o on o.id=v.obligation_id
  where o.code='PERFORMANCE_INCOME_TAX'
    and v.version_number=1
    and v.status='DRAFT'
)
on conflict (workflow_template_id, code) do update set
  from_step_id=excluded.from_step_id, to_step_id=excluded.to_step_id,
  outcome_code=excluded.outcome_code, condition_expression=excluded.condition_expression,
  is_active=true;

-- Publish only after the complete workflow definition has been created. A
-- previously published version is intentionally left untouched and therefore
-- remains immutable and idempotent.
update public.obligation_versions v
set status='PUBLISHED',
    published_at=coalesce(v.published_at, now()),
    updated_at=now()
from public.obligations o
where v.obligation_id=o.id
  and o.code='PERFORMANCE_INCOME_TAX'
  and v.version_number=1
  and v.status='DRAFT'
  and exists (
    select 1 from public.workflow_templates wt
    where wt.obligation_version_id=v.id
  )
  and exists (
    select 1 from public.workflow_steps ws
    join public.workflow_templates wt on wt.id=ws.workflow_template_id
    where wt.obligation_version_id=v.id
  );

commit;
