begin;

-- When there is only one admin user, the submitter must be able to claim,
-- approve, and reject their own review requests.
-- We remove the submitter = reviewer guard from all three review RPCs.

-- ── start_obligation_review ──────────────────────────────────────────────
create or replace function public.start_obligation_review(
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

  update public.obligation_review_requests
  set status = 'IN_REVIEW', reviewer_id = uid
  where id = selected_request.id
  returning * into selected_request;
  return selected_request;
end;
$start$;

-- ── approve_obligation_review ─────────────────────────────────────────────
create or replace function public.approve_obligation_review(
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

-- ── reject_obligation_review ──────────────────────────────────────────────
create or replace function public.reject_obligation_review(
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

commit;
