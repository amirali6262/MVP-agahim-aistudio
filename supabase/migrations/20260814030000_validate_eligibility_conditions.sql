begin;

create function private.validate_eligibility_condition_definition(
  requested_fact_key text,
  requested_operator text,
  requested_expected_value jsonb
)
returns void
language plpgsql
immutable
set search_path=pg_catalog
as $$
declare
  numeric_fact boolean:=requested_fact_key in('EMPLOYEE_COUNT','ANNUAL_REVENUE','BRANCH_COUNT');
  boolean_fact boolean:=requested_fact_key in('HAS_ACTIVE_CONTRACTS','PAYS_SALARIES');
  array_fact boolean:=requested_fact_key in('ACTIVITY_CODES','CONTRACT_TYPES');
  text_fact boolean:=requested_fact_key in(
    'ENTITY_TYPE','LEGAL_FORM','PRIMARY_ACTIVITY','TAX_REGISTRATION_STATUS','VAT_REGISTRATION_STATUS'
  );
begin
  if not(numeric_fact or boolean_fact or array_fact or text_fact) then
    raise exception 'unsupported eligibility fact' using errcode='22023';
  end if;

  if requested_operator in('IS_NULL','NOT_NULL') then
    if requested_expected_value is not null then
      raise exception 'null-check operators do not accept an expected value' using errcode='22023';
    end if;
    return;
  end if;

  if boolean_fact then
    if requested_operator not in('IS_TRUE','IS_FALSE') or requested_expected_value is not null then
      raise exception 'boolean facts require IS_TRUE or IS_FALSE without a value' using errcode='22023';
    end if;
  elsif numeric_fact then
    if requested_operator not in('EQ','NEQ','GT','GTE','LT','LTE')
       or jsonb_typeof(requested_expected_value)<>'number' then
      raise exception 'numeric facts require a numeric comparison value' using errcode='22023';
    end if;
  elsif array_fact then
    if requested_operator<>'CONTAINS'
       or jsonb_typeof(requested_expected_value) not in('string','array') then
      raise exception 'array facts require CONTAINS with text or an array' using errcode='22023';
    end if;
  elsif text_fact then
    if requested_operator in('EQ','NEQ') and jsonb_typeof(requested_expected_value)='string' then
      return;
    elsif requested_operator='IN' and jsonb_typeof(requested_expected_value)='array' then
      return;
    else
      raise exception 'text facts require EQ/NEQ text or IN array' using errcode='22023';
    end if;
  end if;
end;
$$;
revoke all on function private.validate_eligibility_condition_definition(text,text,jsonb)
  from public,anon,authenticated,service_role;

create function public.validate_eligibility_condition()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog
as $$
begin
  perform private.validate_eligibility_condition_definition(
    new.fact_key,new.operator,new.expected_value
  );
  return new;
end;
$$;
revoke all on function public.validate_eligibility_condition()
  from public,anon,authenticated,service_role;

do $$
declare existing_condition record;
begin
  for existing_condition in
    select fact_key,operator,expected_value from public.eligibility_conditions
  loop
    perform private.validate_eligibility_condition_definition(
      existing_condition.fact_key,
      existing_condition.operator,
      existing_condition.expected_value
    );
  end loop;
end;
$$;

create trigger eligibility_conditions_validate_definition
before insert or update of fact_key,operator,expected_value
on public.eligibility_conditions
for each row execute function public.validate_eligibility_condition();

commit;
