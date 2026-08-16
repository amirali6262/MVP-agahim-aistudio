-- Regression checks for publication and penalty write boundaries.
-- Run after all migrations with ON_ERROR_STOP enabled.

do $$
begin
  if has_column_privilege('authenticated', 'public.obligation_versions', 'status', 'UPDATE')
     or has_column_privilege('authenticated', 'public.obligation_versions', 'published_by', 'UPDATE')
     or has_column_privilege('authenticated', 'public.obligation_versions', 'published_at', 'UPDATE') then
    raise exception 'authenticated can bypass publish_obligation_version';
  end if;

  if has_column_privilege('authenticated', 'public.legal_circulars', 'status', 'UPDATE')
     or has_column_privilege('authenticated', 'public.legal_circulars', 'published_by', 'UPDATE')
     or has_column_privilege('authenticated', 'public.legal_circulars', 'published_at', 'UPDATE') then
    raise exception 'authenticated can bypass publish_circular_and_notify';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.publish_obligation_version(uuid)',
    'EXECUTE'
  ) then
    raise exception 'validated obligation publication RPC is unavailable';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.publish_circular_and_notify(uuid,text)',
    'EXECUTE'
  ) then
    raise exception 'validated circular publication RPC is unavailable';
  end if;

  if has_function_privilege(
    'anon',
    'public.estimate_case_penalty(uuid,numeric,date,numeric,numeric)',
    'EXECUTE'
  ) then
    raise exception 'anon can execute the penalty estimate RPC';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.estimate_case_penalty(uuid,numeric,date,numeric,numeric)',
    'EXECUTE'
  ) then
    raise exception 'authorized callers cannot execute the penalty estimate RPC';
  end if;
end;
$$;

select
  'publication_and_penalty_boundaries_ok' as security_regression_result;
