begin;

do $seed$
declare
  admin_id uuid;
  family_id uuid;
  sample_obligation_id uuid;
  version_id uuid;
  template_id uuid;
  rule_id uuid;
  prepare_step uuid;
  submit_step uuid;
  payment_step uuid;
  wait_step uuid;
  assessment_step uuid;
  expert_step uuid;
  dispute_step uuid;
begin
  select id into admin_id from public.users where role = 'PLATFORM_ADMIN' order by created_at limit 1;
  if admin_id is null then
    raise notice 'Corporate tax sample skipped: create a PLATFORM_ADMIN and rerun this migration.';
    return;
  end if;

  insert into public.obligation_families(code, domain, title, description, created_by)
  values('DIRECT_TAX', 'TAX', 'مالیات‌های مستقیم', 'تعهدات موضوع قانون مالیات‌های مستقیم', admin_id)
  on conflict(code) do update set title = excluded.title
  returning id into family_id;

  insert into public.obligations(family_id, code, title, summary, authority_name, official_action_url, created_by)
  values(family_id, 'CORPORATE_INCOME_TAX', 'مالیات بر عملکرد اشخاص حقوقی',
    'تهیه، ارسال و پیگیری اظهارنامه مالیات عملکرد اشخاص حقوقی',
    'سازمان امور مالیاتی کشور', 'https://my.tax.gov.ir', admin_id)
  on conflict(code) do update set title = excluded.title
  returning id into sample_obligation_id;

  select id into version_id from public.obligation_versions
    where obligation_id = sample_obligation_id and version_number = 1;
  if version_id is null then
    insert into public.obligation_versions(obligation_id, version_number, status, legal_reference,
      source_url, audience_summary, effective_from, recurrence_rule, deadline_rule, penalty_rule, created_by)
    values(sample_obligation_id, 1, 'DRAFT',
      'نمونه اولیه؛ تمام مواد و مهلت‌ها پیش از انتشار باید توسط کارشناس حقوقی تأیید شوند.',
      'https://tax.gov.ir', 'اشخاص حقوقی پس از احراز قواعد مشمولیت نسخه', current_date,
      '{"frequency":"YEARLY"}', '{"base":"FISCAL_YEAR_END","gap_months":4}',
      '{"type":"PERCENTAGE","rate_percent":30,"verification_status":"REQUIRES_LEGAL_REVIEW"}', admin_id)
    returning id into version_id;
  end if;

  insert into public.eligibility_rule_sets(obligation_version_id, priority, title, outcome, explanation, created_by)
  values(version_id, 1, 'مشمولیت اشخاص حقوقی فعال', 'ELIGIBLE',
    'شخصیت حقوقی دارای پرونده مالیاتی فعال؛ این قاعده پیش از انتشار نیازمند تأیید حقوقی است.', admin_id)
  on conflict(obligation_version_id, priority) do update set title = excluded.title
  returning id into rule_id;
  insert into public.eligibility_conditions(rule_set_id, sequence, fact_key, operator, expected_value)
  values(rule_id, 1, 'ENTITY_TYPE', 'EQ', '"حقوقی"'::jsonb)
  on conflict(rule_set_id, sequence) do update set expected_value = excluded.expected_value;

  insert into public.eligibility_rule_sets(obligation_version_id, priority, title, outcome, explanation, created_by)
  values(version_id, 2, 'معافیت یا نرخ صفر با الزام تسلیم اظهارنامه', 'REVIEW',
    'وجود معافیت لزوماً تکلیف تسلیم را حذف نمی‌کند و باید توسط کارشناس بررسی شود.', admin_id)
  on conflict(obligation_version_id, priority) do update set title = excluded.title;

  insert into public.workflow_templates(obligation_version_id, title, created_by)
  values(version_id, 'چرخه اظهارنامه عملکرد و رویداد معلق برگ تشخیص', admin_id)
  on conflict(obligation_version_id) do update set title = excluded.title
  returning id into template_id;

  insert into public.workflow_steps(workflow_template_id, sequence, code, title, actor, instructions, form_schema)
  values(template_id, 1, 'PREPARE_BOOKS', 'آماده‌سازی دفاتر و صورت‌های مالی', 'USER',
    'کنترل دفاتر، صورت‌های مالی و انطباق اسناد.', '{"fields":[{"key":"approved","label":"تأیید آماده‌سازی","type":"checkbox","required":true}]}'::jsonb)
  on conflict(workflow_template_id, code) do update set title = excluded.title returning id into prepare_step;
  insert into public.workflow_steps(workflow_template_id, sequence, code, title, actor, instructions, form_schema)
  values(template_id, 2, 'SUBMIT_RETURN', 'ارسال اظهارنامه و دریافت کد رهگیری', 'USER',
    'ثبت اظهارنامه در درگاه رسمی.', '{"fields":[{"key":"tracking_number","label":"کد رهگیری","type":"text","required":true}]}'::jsonb)
  on conflict(workflow_template_id, code) do update set title = excluded.title returning id into submit_step;
  insert into public.workflow_steps(workflow_template_id, sequence, code, title, actor, instructions, form_schema)
  values(template_id, 3, 'PAY_DECLARED_TAX', 'پرداخت یا تقسیط مالیات ابرازی', 'USER',
    'ثبت پرداخت مالیات ابرازی.', '{"fields":[{"key":"payment_reference","label":"شناسه پرداخت","type":"text","required":true}]}'::jsonb)
  on conflict(workflow_template_id, code) do update set title = excluded.title returning id into payment_step;
  insert into public.workflow_steps(workflow_template_id, sequence, code, title, actor, instructions, form_schema)
  values(template_id, 4, 'AWAIT_ASSESSMENT', 'انتظار برای رویداد صدور برگ تشخیص', 'AUTHORITY',
    'این مرحله با رویداد صدور برگ تشخیص یا انقضای مهلت قانونی تعیین تکلیف می‌شود.', '{"fields":[]}'::jsonb)
  on conflict(workflow_template_id, code) do update set title = excluded.title returning id into wait_step;
  insert into public.workflow_steps(workflow_template_id, sequence, code, title, actor, instructions, form_schema)
  values(template_id, 5, 'ASSESSMENT_DECISION', 'تعیین مسیر پس از ابلاغ برگ تشخیص', 'USER',
    'انتخاب تمکین، توافق، کارشناسی یا اعتراض.', '{"fields":[{"key":"notice_number","label":"شماره برگ تشخیص","type":"text","required":true}]}'::jsonb)
  on conflict(workflow_template_id, code) do update set title = excluded.title returning id into assessment_step;
  insert into public.workflow_steps(workflow_template_id, sequence, code, title, actor, instructions, form_schema)
  values(template_id, 6, 'EXPERT_REVIEW', 'رسیدگی کارشناسی تکمیلی', 'AUTHORITY',
    'زیرفرایند کارشناسی می‌تواند به نقطه تصمیم بازگردد یا تجدید شود.', '{"fields":[]}'::jsonb)
  on conflict(workflow_template_id, code) do update set title = excluded.title returning id into expert_step;
  insert into public.workflow_steps(workflow_template_id, sequence, code, title, actor, instructions, form_schema)
  values(template_id, 7, 'OPEN_DISPUTE', 'ارجاع پرونده به مرکز رسیدگی و اعتراض', 'AUTHORITY',
    'ایجاد پرونده اعتراض بر اساس الگوی پایه و override نوع مالیات.', '{"fields":[]}'::jsonb)
  on conflict(workflow_template_id, code) do update set title = excluded.title returning id into dispute_step;

  insert into public.workflow_transitions(workflow_template_id, from_step_id, to_step_id, code, title, trigger_type, event_code, outcome_code, priority)
  values
    (template_id, prepare_step, submit_step, 'PREPARED', 'آماده‌سازی تکمیل شد', 'USER_ACTION', null, 'PREPARED', 10),
    (template_id, submit_step, payment_step, 'RETURN_SUBMITTED', 'اظهارنامه ارسال شد', 'USER_ACTION', null, 'SUBMITTED', 10),
    (template_id, payment_step, wait_step, 'DECLARED_TAX_HANDLED', 'پرداخت تعیین تکلیف شد', 'USER_ACTION', null, 'PAID_OR_SCHEDULED', 10),
    (template_id, wait_step, assessment_step, 'ASSESSMENT_ISSUED', 'برگ تشخیص صادر شد', 'SYSTEM_EVENT', 'ASSESSMENT_ISSUED', 'ASSESSMENT_ISSUED', 10),
    (template_id, assessment_step, expert_step, 'REQUEST_EXPERT', 'ارجاع به کارشناسی', 'USER_ACTION', null, 'EXPERT_REVIEW', 20),
    (template_id, assessment_step, dispute_step, 'DISAGREE', 'عدم توافق و ارجاع به اعتراض', 'USER_ACTION', null, 'DISPUTE_OPENED', 30),
    (template_id, expert_step, assessment_step, 'EXPERT_REPORT_RETURN', 'بازگشت گزارش کارشناسی به نقطه تصمیم', 'USER_ACTION', null, 'EXPERT_RETURNED', 10),
    (template_id, expert_step, expert_step, 'REPEAT_EXPERT', 'تجدید قرار کارشناسی', 'USER_ACTION', null, 'EXPERT_REPEATED', 20)
  on conflict(workflow_template_id, code) do update set title = excluded.title;
  insert into public.workflow_transitions(workflow_template_id, from_step_id, code, title, trigger_type,
    timeout_interval, terminal_status, outcome_code, legal_reference, priority)
  values
    (template_id, wait_step, 'NO_ASSESSMENT_TIMEOUT', 'عدم صدور برگ تشخیص در مهلت قانونی', 'TIMEOUT',
      interval '365 days', 'COMPLETED', 'SELF_DECLARATION_FINALIZED', 'نیازمند تأیید حقوقی و محاسبه مهلت معتبر', 100),
    (template_id, assessment_step, 'ACCEPT_ASSESSMENT', 'تمکین و خاتمه پرونده', 'USER_ACTION',
      null, 'COMPLETED', 'SETTLED', 'نیازمند تأیید حقوقی', 10)
  on conflict(workflow_template_id, code) do update set title = excluded.title;
end;
$seed$;

commit;
