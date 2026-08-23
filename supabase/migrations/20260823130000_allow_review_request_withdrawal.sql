begin;

alter table public.obligation_review_requests
  drop constraint obligation_review_requests_status_check;

alter table public.obligation_review_requests
  add constraint obligation_review_requests_status_check
  check (status in ('REQUESTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN'));

alter table public.obligation_review_requests
  drop constraint obligation_review_requests_decision_check;

alter table public.obligation_review_requests
  add constraint obligation_review_requests_decision_check check (
    (status in ('REQUESTED', 'IN_REVIEW') and reviewed_at is null and decision_note is null)
    or
    (status in ('APPROVED', 'REJECTED') and reviewer_id is not null and reviewed_at is not null and btrim(coalesce(decision_note, '')) <> '')
    or
    (status = 'WITHDRAWN' and reviewer_id is null and reviewed_at is not null and btrim(coalesce(decision_note, '')) <> '')
  );

create function public.withdraw_obligation_review(
  requested_review_id uuid,
  requested_note text default 'درخواست توسط ثبت‌کننده برای اصلاح به پیش‌نویس بازگردانده شد.'
)
returns public.obligation_review_requests
language plpgsql
security definer
set search_path = pg_catalog
as $withdraw$
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
    raise exception 'withdrawal note is required' using errcode = '22023';
  end if;

  select * into selected_request
  from public.obligation_review_requests
  where id = requested_review_id
  for update;
  if selected_request.id is null then
    raise exception 'review request not found' using errcode = 'P0002';
  end if;
  if selected_request.submitted_by is distinct from uid then
    raise exception 'only the submitter can withdraw this request' using errcode = '42501';
  end if;
  if selected_request.status <> 'REQUESTED' then
    raise exception 'only queued review requests can be withdrawn' using errcode = '22023';
  end if;

  select * into selected_version
  from public.obligation_versions
  where id = selected_request.obligation_version_id
  for update;
  if selected_version.status <> 'REVIEW' then
    raise exception 'version must be in review before withdrawal' using errcode = '22023';
  end if;

  update public.obligation_review_requests
  set status = 'WITHDRAWN', reviewed_at = now(), decision_note = note
  where id = selected_request.id
  returning * into selected_request;

  update public.obligation_versions
  set status = 'DRAFT'
  where id = selected_version.id;

  return selected_request;
end;
$withdraw$;

revoke all on function public.withdraw_obligation_review(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.withdraw_obligation_review(uuid, text) to authenticated;

commit;
