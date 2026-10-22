-- Read-only administrative projection. All monthly reads share one statement snapshot.
-- Reuses existing reconciliation and historical statement calculations; no data writes.
create or replace function public.get_finance_informative_report(p_church_id uuid, p_unit uuid, p_options jsonb)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  first_month date; last_month date; current_month date;
  report jsonb; statement jsonb; version_id uuid; transfer_cents numeric;
  months jsonb := '[]'::jsonb; include_prebend boolean; include_transfer boolean;
begin
  if auth.uid() is null or not private.is_church_admin(p_church_id)
    or not private.can_access_finance_unit(p_church_id,p_unit,'finance.view') then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  if p_options is null or jsonb_typeof(p_options) <> 'object'
    or p_options->>'type' is distinct from 'INFORMATIVE'
    or coalesce(p_options->>'startMonth','') !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'
    or coalesce(p_options->>'endMonth','') !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'
    or jsonb_typeof(p_options->'includePrebend') is distinct from 'boolean'
    or jsonb_typeof(p_options->'includeTransfer') is distinct from 'boolean'
    or exists(select 1 from jsonb_object_keys(p_options) k where k not in ('type','startMonth','endMonth','includePrebend','includeTransfer')) then
    raise exception 'INVALID_INPUT' using errcode='22023';
  end if;
  first_month := ((p_options->>'startMonth')||'-01')::date;
  last_month := ((p_options->>'endMonth')||'-01')::date;
  if last_month < first_month or last_month >= first_month + interval '60 months' then
    raise exception 'INVALID_INPUT' using errcode='22023';
  end if;
  include_prebend := (p_options->>'includePrebend')::boolean;
  include_transfer := (p_options->>'includeTransfer')::boolean;
  current_month := first_month;
  while current_month <= last_month loop
    report := public.get_finance_report(p_church_id,p_unit,jsonb_build_object('type','SYNTHETIC','month',to_char(current_month,'YYYY-MM')));
    statement := null;
    if include_prebend or include_transfer then
      select id into version_id from public.report_delivery_versions
        where church_id=p_church_id and congregation_id=p_unit and month=current_month and deleted_at is null
        order by revision desc, id desc limit 1;
      if version_id is not null then
        statement := public.get_finance_statement(p_church_id,version_id);
        -- Only the configured percentage of eligible income, never fixed fees or deductions.
        select coalesce(sum((item->>'calculatedCents')::numeric),0) into transfer_cents
          from jsonb_array_elements(statement->'items') item
          where item->>'destination'='CATHEDRAL' and item->>'role'='DISTRIBUTION'
            and item->>'calculation'='ELIGIBLE_INCOME_PERCENT';
        statement := jsonb_build_object('revision',statement->'revision','stale',statement->'stale',
          'grossPrebendCents',case when include_prebend then statement->'grossPrebendCents' else 'null'::jsonb end,
          'transferCents',case when include_transfer then to_jsonb(transfer_cents) else 'null'::jsonb end);
      end if;
    end if;
    months := months || jsonb_build_array(jsonb_build_object('month',to_char(current_month,'YYYY-MM'),'summary',report->'summary','statement',statement));
    current_month := (current_month + interval '1 month')::date;
  end loop;
  return p_options || jsonb_build_object('generatedAt',statement_timestamp(),'months',months);
end;
$$;
revoke all on function public.get_finance_informative_report(uuid,uuid,jsonb) from public, anon;
grant execute on function public.get_finance_informative_report(uuid,uuid,jsonb) to authenticated;
