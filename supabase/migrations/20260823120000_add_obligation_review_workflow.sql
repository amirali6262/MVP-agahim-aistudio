begin;

create table public.obligation_review_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  obligation_version_id uuid not null references public.obligation_versions(id) on delete restrict,
  status text not null default 'REQUESTED'
    constraint obligation_review_requests_status_check check (status in ('REQUESTED', 'IN_REVIEW', 'APPROVED', 'REJECTED')),
  submitted_by uuid not null references auth.users(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  reviewer_id uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint obligation_review_requests_decision_check check (
    (status in ('REQUESTED', 'IN_REVIEW') and reviewed_at is null and decision_note is null)
    or
    (status in ('APPROVED', 'REJECTED') and reviewer_id is not null and reviewed_at is not null and btrim(coalesce(decision_note, '')) <> '')
  )
);

create unique index obligation_review_one_open_request_idx
  on public.obligation_review_requests(obligation_version_id)
  where status in ('REQUESTED', 'IN_REVIEW');
create index obligation_review_requests_queue_idx
  on public.obligation_review_requests(status, submitted_at desc);
create index obligation_review_requests_version_idx
  on public.obligation_review_requests(obligation_version_id, submitted_at desc);

create trigger obligation_review_requests_set_updated_at
  before update on public.obligation_review_requests
  for each row execute function public.set_updated_at();

alter table public.obligation_review_requests enable row level security;
revoke all on table public.obligation_review_requests from public, anon, authenticated;
grant select on table public.obligation_review_requests to authenticated;

create policy obligation_review_requests_admin_read
on public.obligation_review_requests for select to authenticated
using ((select private.is_platform_admin()));

create function public.submit_obligation_version_for_review(
  requested_version_id uuid
)
returns public.obligation_review_requests
language plpgsql
security definer
set search_path = pg_catalog
as $submit$
declare
  uid uuid := auth.uid();
  selected_version public.obligation_versions;
  saved_request public.obligation_review_requests;
begin
  if uid is null
     or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
     or not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;

  select * into selected_version
  from public.obligation_versions
  where id = requested_version_id
  for update;

  if selected_version.id is null then
    raise exception 'obligation version not found' using errcode = 'P0002';
  end if;
  if selected_version.status <> 'DRAFT' then
    raise exception 'only draft versions can be submitted for review' using errcode = '22023';
  end if;
  if selected_version.effective_from is null
     or selected_version.source_url is null
     or btrim(coalesce(selected_version.legal_reference, '')) = '' then
    raise exception 'complete legal source, official URL and effective date are required before review'
      using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.workflow_templates workflow
    join public.workflow_steps step on step.workflow_template_id = workflow.id
    where workflow.obligation_version_id = selected_version.id
  ) then
    raise exception 'at least one workflow step is required before review' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.eligibility_rule_sets
    where obligation_version_id = selected_version.id
  ) then
    raise exception 'at least one eligibility rule is required before review' using errcode = '22023';
  end if;

  insert into public.obligation_review_requests(obligation_version_id, submitted_by)
  values (selected_version.id, uid)
  returning * into saved_request;

  update public.obligation_versions
  set status = 'REVIEW'
  where id = selected_version.id;

  return saved_request;
end;
$submit$;

create function public.start_obligation_review(
  requested_review_id uuid
)
returns public.obligation_review_requests
language plpgsql
security definer
set search_path = pg_catalog
as $start$
declare
  uid uuid := auth.uid();
  selected_request public.obligation_review_requests;
begin
  if uid is null
     or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
     or not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;

  select * into selected_request
  from public.obligation_review_requests
  where id = requested_review_id
  for update;

  if selected_request.id is null then
    raise exception 'review request not found' using errcode = 'P0002';
  end if;
  if selected_request.status <> 'REQUESTED' then
    return selected_request;
  end if;
  if selected_request.submitted_by = uid then
    raise exception 'the submitter cannot claim their own review request' using errcode = '42501';
  end if;

  update public.obligation_review_requests
  set status = 'IN_REVIEW', reviewer_id = uid
  where id = selected_request.id
  returning * into selected_request;
  return selected_request;
end;
$start$;

create function public.approve_obligation_review(
  requested_review_id uuid,
  requested_note text
)
returns public.obligation_review_requests
language plpgsql
security definer
set search_path = pg_catalog
as $approve$
declare
  uid uuid := auth.uid();
  selected_request public.obligation_review_requests;
  selected_version public.obligation_versions;
  note text := btrim(coalesce(requested_note, ''));
begin
  if uid is null
     or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
     or not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;
  if note = '' then
    raise exception 'approval note is required' using errcode = '22023';
  end if;

  select * into selected_request
  from public.obligation_review_requests
  where id = requested_review_id
  for update;
  if selected_request.id is null then
    raise exception 'review request not found' using errcode = 'P0002';
  end if;
  if selected_request.status <> 'IN_REVIEW' then
    raise exception 'review request must be claimed before approval' using errcode = '22023';
  end if;
  if selected_request.reviewer_id is distinct from uid then
    raise exception 'only the assigned reviewer can approve this request' using errcode = '42501';
  end if;
  if selected_request.submitted_by = uid then
    raise exception 'the submitter cannot approve their own request' using errcode = '42501';
  end if;

  select * into selected_version
  from public.obligation_versions
  where id = selected_request.obligation_version_id
  for update;
  if selected_version.status <> 'REVIEW' then
    raise exception 'version must be in review before approval' using errcode = '22023';
  end if;

  update public.obligation_review_requests
  set status = 'APPROVED', reviewer_id = uid, reviewed_at = now(), decision_note = note
  where id = selected_request.id
  returning * into selected_request;

  update public.obligation_versions set status = 'TESTING' where id = selected_version.id;
  return selected_request;
end;
$approve$;

create function public.reject_obligation_review(
  requested_review_id uuid,
  requested_note text
)
returns public.obligation_review_requests
language plpgsql
security definer
set search_path = pg_catalog
as $reject$
declare
  uid uuid := auth.uid();
  selected_request public.obligation_review_requests;
  selected_version public.obligation_versions;
  note text := btrim(coalesce(requested_note, ''));
begin
  if uid is null
     or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
     or not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;
  if note = '' then
    raise exception 'rejection reason is required' using errcode = '22023';
  end if;

  select * into selected_request
  from public.obligation_review_requests
  where id = requested_review_id
  for update;
  if selected_request.id is null then
    raise exception 'review request not found' using errcode = 'P0002';
  end if;
  if selected_request.status <> 'IN_REVIEW' then
    raise exception 'review request must be claimed before rejection' using errcode = '22023';
  end if;
  if selected_request.reviewer_id is distinct from uid then
    raise exception 'only the assigned reviewer can reject this request' using errcode = '42501';
  end if;
  if selected_request.submitted_by = uid then
    raise exception 'the submitter cannot reject their own request' using errcode = '42501';
  end if;

  select * into selected_version
  from public.obligation_versions
  where id = selected_request.obligation_version_id
  for update;
  if selected_version.status <> 'REVIEW' then
    raise exception 'version must be in review before rejection' using errcode = '22023';
  end if;

  update public.obligation_review_requests
  set status = 'REJECTED', reviewer_id = uid, reviewed_at = now(), decision_note = note
  where id = selected_request.id
  returning * into selected_request;

  update public.obligation_versions set status = 'DRAFT' where id = selected_version.id;
  return selected_request;
end;
$reject$;

revoke all on function public.submit_obligation_version_for_review(uuid) from public, anon, authenticated, service_role;
revoke all on function public.start_obligation_review(uuid) from public, anon, authenticated, service_role;
revoke all on function public.approve_obligation_review(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.reject_obligation_review(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.submit_obligation_version_for_review(uuid) to authenticated;
grant execute on function public.start_obligation_review(uuid) to authenticated;
grant execute on function public.approve_obligation_review(uuid, text) to authenticated;
grant execute on function public.reject_obligation_review(uuid, text) to authenticated;

commit;
