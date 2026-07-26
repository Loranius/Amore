-- Phase 1: add guarded Finance RPCs without removing legacy direct writes yet.
-- This is backward-compatible with the currently deployed client and lets the
-- new client ship before the stricter table permissions are enabled.

create or replace function public.finance_current_user_name_v1()
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text;
begin
  select u.name
    into v_name
  from public.users as u
  where u.auth_user_id = auth.uid()
  limit 1;

  if v_name is null then
    raise exception 'finance_user_not_linked' using errcode = 'P0001';
  end if;

  return v_name;
end;
$$;

create or replace function public.finance_propose_free_limit_v1(p_value numeric)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text := public.finance_current_user_name_v1();
begin
  if p_value is null
     or p_value < 0
     or p_value > 20000
     or mod(p_value, 100) <> 0 then
    raise exception 'finance_invalid_free_limit' using errcode = '22023';
  end if;

  insert into public.free_limit (
    id,
    limit_value,
    proposal_value,
    proposed_by,
    updated_at
  )
  values (1, 0, p_value, v_name, now())
  on conflict (id) do update
    set proposal_value = excluded.proposal_value,
        proposed_by = excluded.proposed_by,
        updated_at = now();

  return p_value;
end;
$$;

create or replace function public.finance_confirm_free_limit_v1(
  p_expected_value numeric,
  p_expected_proposed_by text
)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text := public.finance_current_user_name_v1();
  v_limit numeric;
begin
  update public.free_limit
     set limit_value = proposal_value,
         proposal_value = null,
         proposed_by = null,
         updated_at = now()
   where id = 1
     and proposal_value = p_expected_value
     and proposed_by = p_expected_proposed_by
     and proposed_by <> v_name
  returning limit_value into v_limit;

  if not found then
    raise exception 'finance_stale_free_limit_proposal' using errcode = 'P0001';
  end if;

  return v_limit;
end;
$$;

create or replace function public.finance_reject_free_limit_v1(
  p_expected_value numeric,
  p_expected_proposed_by text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text := public.finance_current_user_name_v1();
begin
  update public.free_limit
     set proposal_value = null,
         proposed_by = null,
         updated_at = now()
   where id = 1
     and proposal_value = p_expected_value
     and proposed_by = p_expected_proposed_by
     and proposed_by <> v_name;

  if not found then
    raise exception 'finance_stale_free_limit_proposal' using errcode = 'P0001';
  end if;

  return true;
end;
$$;

create or replace function public.finance_create_savings_goal_v1(
  p_name text,
  p_description text default null,
  p_target_amount numeric default null,
  p_url text default null
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

  insert into public.savings_goals (
    name,
    description,
    target_amount,
    url,
    status,
    proposed_by,
    saved_amount
  )
  values (
    v_title,
    nullif(btrim(coalesce(p_description, '')), ''),
    p_target_amount,
    nullif(btrim(coalesce(p_url, '')), ''),
    'pending',
    v_name,
    0
  )
  returning id into v_goal_id;

  return v_goal_id;
end;
$$;

create or replace function public.finance_confirm_savings_goal_v1(p_goal_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text := public.finance_current_user_name_v1();
begin
  update public.savings_goals
     set status = 'confirmed'
   where id = p_goal_id
     and status = 'pending'
     and proposed_by is not null
     and proposed_by <> v_name;

  if not found then
    raise exception 'finance_stale_goal_proposal' using errcode = 'P0001';
  end if;

  return true;
end;
$$;

create or replace function public.finance_reject_savings_goal_v1(p_goal_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text := public.finance_current_user_name_v1();
begin
  delete from public.savings_goals
   where id = p_goal_id
     and status = 'pending'
     and proposed_by is not null
     and proposed_by <> v_name;

  if not found then
    raise exception 'finance_stale_goal_proposal' using errcode = 'P0001';
  end if;

  return true;
end;
$$;

create or replace function public.finance_delete_savings_goal_v1(p_goal_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text := public.finance_current_user_name_v1();
begin
  delete from public.savings_goals
   where id = p_goal_id
     and (
       status = 'confirmed'
       or (status = 'pending' and proposed_by = v_name)
     );

  if not found then
    raise exception 'finance_goal_delete_not_allowed' using errcode = 'P0001';
  end if;

  return true;
end;
$$;

create or replace function public.finance_add_savings_goal_funds_v1(
  p_goal_id uuid,
  p_amount numeric
)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_saved numeric;
begin
  perform public.finance_current_user_name_v1();

  if p_amount is null or p_amount <= 0 then
    raise exception 'finance_contribution_must_be_positive' using errcode = '22023';
  end if;

  update public.savings_goals
     set saved_amount = coalesce(saved_amount, 0) + p_amount
   where id = p_goal_id
     and status = 'confirmed'
  returning saved_amount into v_saved;

  if not found then
    raise exception 'finance_goal_not_confirmed' using errcode = 'P0001';
  end if;

  return v_saved;
end;
$$;

revoke all on function public.finance_current_user_name_v1() from public, anon, authenticated;
revoke all on function public.finance_propose_free_limit_v1(numeric) from public, anon;
revoke all on function public.finance_confirm_free_limit_v1(numeric, text) from public, anon;
revoke all on function public.finance_reject_free_limit_v1(numeric, text) from public, anon;
revoke all on function public.finance_create_savings_goal_v1(text, text, numeric, text) from public, anon;
revoke all on function public.finance_confirm_savings_goal_v1(uuid) from public, anon;
revoke all on function public.finance_reject_savings_goal_v1(uuid) from public, anon;
revoke all on function public.finance_delete_savings_goal_v1(uuid) from public, anon;
revoke all on function public.finance_add_savings_goal_funds_v1(uuid, numeric) from public, anon;

grant execute on function public.finance_propose_free_limit_v1(numeric) to authenticated;
grant execute on function public.finance_confirm_free_limit_v1(numeric, text) to authenticated;
grant execute on function public.finance_reject_free_limit_v1(numeric, text) to authenticated;
grant execute on function public.finance_create_savings_goal_v1(text, text, numeric, text) to authenticated;
grant execute on function public.finance_confirm_savings_goal_v1(uuid) to authenticated;
grant execute on function public.finance_reject_savings_goal_v1(uuid) to authenticated;
grant execute on function public.finance_delete_savings_goal_v1(uuid) to authenticated;
grant execute on function public.finance_add_savings_goal_funds_v1(uuid, numeric) to authenticated;
