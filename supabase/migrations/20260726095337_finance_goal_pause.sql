alter table public.savings_goals
  add column if not exists paused_at timestamptz;

create table if not exists public.savings_goal_pauses (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.savings_goals(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint savings_goal_pauses_valid_period
    check (ended_at is null or ended_at >= started_at)
);

create unique index if not exists savings_goal_pauses_one_open_idx
  on public.savings_goal_pauses(goal_id)
  where ended_at is null;

create index if not exists savings_goal_pauses_goal_started_idx
  on public.savings_goal_pauses(goal_id, started_at desc);

alter table public.savings_goal_pauses enable row level security;
revoke all on public.savings_goal_pauses from anon, authenticated;

create or replace function public.finance_pause_savings_goal_v1(p_goal_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
  v_existing_pause timestamptz;
  v_paused_at timestamptz := now();
begin
  perform public.finance_current_user_id_v1();

  select g.status, g.paused_at
    into v_status, v_existing_pause
  from public.savings_goals as g
  where g.id = p_goal_id
  for update;

  if not found or v_status <> 'confirmed' then
    raise exception 'finance_goal_not_confirmed' using errcode = 'P0001';
  end if;

  if v_existing_pause is not null then
    raise exception 'finance_goal_already_paused' using errcode = 'P0001';
  end if;

  insert into public.savings_goal_pauses (goal_id, started_at)
  values (p_goal_id, v_paused_at);

  update public.savings_goals
     set paused_at = v_paused_at
   where id = p_goal_id;

  return v_paused_at;
end;
$$;

create or replace function public.finance_resume_savings_goal_v1(p_goal_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
  v_paused_at timestamptz;
  v_resumed_at timestamptz := now();
begin
  perform public.finance_current_user_id_v1();

  select g.status, g.paused_at
    into v_status, v_paused_at
  from public.savings_goals as g
  where g.id = p_goal_id
  for update;

  if not found or v_status <> 'confirmed' then
    raise exception 'finance_goal_not_confirmed' using errcode = 'P0001';
  end if;

  if v_paused_at is null then
    raise exception 'finance_goal_not_paused' using errcode = 'P0001';
  end if;

  update public.savings_goal_pauses
     set ended_at = v_resumed_at
   where goal_id = p_goal_id
     and ended_at is null;

  if not found then
    raise exception 'finance_goal_pause_state_invalid' using errcode = 'P0001';
  end if;

  update public.savings_goals
     set paused_at = null
   where id = p_goal_id;

  return true;
end;
$$;

create or replace function public.finance_add_savings_goal_contribution_v1(
  p_goal_id uuid,
  p_amount numeric,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id integer := public.finance_current_user_id_v1();
  v_contribution_id uuid;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_status text;
  v_paused_at timestamptz;
begin
  if p_amount is null
     or p_amount <= 0
     or p_amount <> trunc(p_amount) then
    raise exception 'finance_contribution_must_be_positive_whole_amount' using errcode = '22023';
  end if;

  if v_note is not null and char_length(v_note) > 240 then
    raise exception 'finance_contribution_note_too_long' using errcode = '22023';
  end if;

  update public.savings_goals
     set saved_amount = coalesce(saved_amount, 0) + p_amount
   where id = p_goal_id
     and status = 'confirmed'
     and paused_at is null;

  if not found then
    select g.status, g.paused_at
      into v_status, v_paused_at
    from public.savings_goals as g
    where g.id = p_goal_id;

    if v_status = 'confirmed' and v_paused_at is not null then
      raise exception 'finance_goal_paused' using errcode = 'P0001';
    end if;

    raise exception 'finance_goal_not_confirmed' using errcode = 'P0001';
  end if;

  insert into public.savings_goal_contributions (
    goal_id,
    amount,
    note,
    contributed_by
  )
  values (
    p_goal_id,
    p_amount,
    v_note,
    v_user_id
  )
  returning id into v_contribution_id;

  return v_contribution_id;
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
  ), active_stats as (
    select
      s.*,
      coalesce((
        select sum(
          extract(epoch from (
            coalesce(p.ended_at, now()) - greatest(p.started_at, s.first_at)
          ))
        )
        from public.savings_goal_pauses as p
        where p.goal_id = s.goal_id
          and s.first_at is not null
          and coalesce(p.ended_at, now()) > s.first_at
          and p.started_at < now()
      ), 0)::numeric as paused_seconds
    from stats as s
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
              greatest(
                1::numeric,
                (
                  extract(epoch from (now() - s.first_at)) - s.paused_seconds
                ) / 86400 + 1
              )
            ),
          2
        )
        else null
      end as monthly_pace
    from active_stats as s
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

revoke all on function public.finance_pause_savings_goal_v1(uuid) from public, anon;
revoke all on function public.finance_resume_savings_goal_v1(uuid) from public, anon;
revoke all on function public.finance_add_savings_goal_contribution_v1(uuid, numeric, text) from public, anon;
revoke all on function public.finance_get_savings_goal_forecasts_v1() from public, anon;

grant execute on function public.finance_pause_savings_goal_v1(uuid) to authenticated;
grant execute on function public.finance_resume_savings_goal_v1(uuid) to authenticated;
grant execute on function public.finance_add_savings_goal_contribution_v1(uuid, numeric, text) to authenticated;
grant execute on function public.finance_get_savings_goal_forecasts_v1() to authenticated;