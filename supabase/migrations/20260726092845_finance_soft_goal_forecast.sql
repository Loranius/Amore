alter table public.savings_goals
  add column if not exists desired_date date;

create or replace function public.finance_create_savings_goal_v2(
  p_name text,
  p_description text default null,
  p_target_amount numeric default null,
  p_url text default null,
  p_desired_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text := public.finance_current_user_name_v1();
  v_goal_id uuid;
  v_title text := btrim(coalesce(p_name, ''));
begin
  if v_title = '' then
    raise exception 'finance_goal_name_required' using errcode = '22023';
  end if;

  if p_target_amount is null or p_target_amount <= 0 then
    raise exception 'finance_goal_target_must_be_positive' using errcode = '22023';
  end if;

  if p_desired_date is not null and p_desired_date < current_date then
    raise exception 'finance_goal_desired_date_in_past' using errcode = '22023';
  end if;

  insert into public.savings_goals (
    name,
    description,
    target_amount,
    url,
    desired_date,
    status,
    proposed_by,
    saved_amount
  )
  values (
    v_title,
    nullif(btrim(coalesce(p_description, '')), ''),
    p_target_amount,
    nullif(btrim(coalesce(p_url, '')), ''),
    p_desired_date,
    'pending',
    v_name,
    0
  )
  returning id into v_goal_id;

  return v_goal_id;
end;
$$;

create or replace function public.finance_set_savings_goal_desired_date_v1(
  p_goal_id uuid,
  p_desired_date date
)
returns date
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_date date;
begin
  perform public.finance_current_user_id_v1();

  if p_desired_date is not null and p_desired_date < current_date then
    raise exception 'finance_goal_desired_date_in_past' using errcode = '22023';
  end if;

  update public.savings_goals
     set desired_date = p_desired_date
   where id = p_goal_id
     and status = 'confirmed'
  returning desired_date into v_date;

  if not found then
    raise exception 'finance_goal_not_confirmed' using errcode = 'P0001';
  end if;

  return v_date;
end;
$$;

create or replace function public.finance_get_savings_goal_forecasts_v1()
returns table (
  goal_id uuid,
  contribution_count bigint,
  monthly_pace numeric,
  forecast_date date,
  desired_date date,
  monthly_needed numeric,
  remaining_amount numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.finance_current_user_id_v1();

  return query
  with stats as (
    select
      g.id as goal_id,
      g.target_amount,
      coalesce(g.saved_amount, 0) as saved_amount,
      g.desired_date,
      count(c.id)::bigint as contribution_count,
      coalesce(sum(c.amount), 0)::numeric as tracked_amount,
      min(c.created_at) as first_at,
      max(c.created_at) as last_at
    from public.savings_goals as g
    left join public.savings_goal_contributions as c on c.goal_id = g.id
    where g.status = 'confirmed'
    group by g.id, g.target_amount, g.saved_amount, g.desired_date
  ), calculated as (
    select
      s.*,
      greatest(s.target_amount - s.saved_amount, 0)::numeric as remaining_amount,
      case
        when s.contribution_count >= 2
         and s.first_at is not null
         and s.last_at is not null
         and (s.last_at::date - s.first_at::date) >= 7
         and s.tracked_amount > 0
        then round(
          s.tracked_amount * 30.4375
          / greatest(
              30::numeric,
              extract(epoch from (now() - s.first_at)) / 86400 + 1
            ),
          2
        )
        else null
      end as monthly_pace
    from stats as s
  )
  select
    c.goal_id,
    c.contribution_count,
    c.monthly_pace,
    case
      when c.remaining_amount <= 0 then current_date
      when c.monthly_pace is not null and c.monthly_pace > 0
        then current_date + ceil((c.remaining_amount / c.monthly_pace) * 30.4375)::integer
      else null
    end as forecast_date,
    c.desired_date,
    case
      when c.desired_date is not null
       and c.desired_date > current_date
       and c.remaining_amount > 0
        then ceil(c.remaining_amount * 30.4375 / (c.desired_date - current_date))::numeric
      else null
    end as monthly_needed,
    c.remaining_amount
  from calculated as c
  order by c.goal_id;
end;
$$;

revoke all on function public.finance_create_savings_goal_v2(text, text, numeric, text, date) from public, anon;
revoke all on function public.finance_set_savings_goal_desired_date_v1(uuid, date) from public, anon;
revoke all on function public.finance_get_savings_goal_forecasts_v1() from public, anon;

grant execute on function public.finance_create_savings_goal_v2(text, text, numeric, text, date) to authenticated;
grant execute on function public.finance_set_savings_goal_desired_date_v1(uuid, date) to authenticated;
grant execute on function public.finance_get_savings_goal_forecasts_v1() to authenticated;
