create table if not exists public.savings_goal_contributions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.savings_goals(id) on delete cascade,
  amount numeric not null,
  note text,
  contributed_by integer not null references public.users(id),
  created_at timestamptz not null default now(),
  constraint savings_goal_contributions_amount_positive check (amount > 0 and amount = trunc(amount)),
  constraint savings_goal_contributions_note_length check (note is null or char_length(note) <= 240)
);

create index if not exists savings_goal_contributions_goal_created_idx
  on public.savings_goal_contributions(goal_id, created_at desc);

alter table public.savings_goal_contributions enable row level security;

drop policy if exists finance_contributions_read_authenticated
  on public.savings_goal_contributions;

create policy finance_contributions_read_authenticated
on public.savings_goal_contributions
for select
to authenticated
using (true);

revoke insert, update, delete on public.savings_goal_contributions from anon, authenticated;
grant select on public.savings_goal_contributions to authenticated;

create or replace function public.finance_current_user_id_v1()
returns integer
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id integer;
begin
  select u.id
    into v_user_id
  from public.users as u
  where u.auth_user_id = auth.uid()
  limit 1;

  if v_user_id is null then
    raise exception 'finance_user_not_linked' using errcode = 'P0001';
  end if;

  return v_user_id;
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
     and status = 'confirmed';

  if not found then
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

create or replace function public.finance_delete_savings_goal_contribution_v1(
  p_contribution_id uuid
)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id integer := public.finance_current_user_id_v1();
  v_goal_id uuid;
  v_amount numeric;
  v_contributed_by integer;
  v_saved numeric;
begin
  select c.goal_id, c.amount, c.contributed_by
    into v_goal_id, v_amount, v_contributed_by
  from public.savings_goal_contributions as c
  where c.id = p_contribution_id
  for update;

  if not found then
    raise exception 'finance_stale_contribution' using errcode = 'P0001';
  end if;

  if v_contributed_by <> v_user_id then
    raise exception 'finance_contribution_delete_not_allowed' using errcode = '42501';
  end if;

  update public.savings_goals
     set saved_amount = saved_amount - v_amount
   where id = v_goal_id
     and saved_amount >= v_amount
  returning saved_amount into v_saved;

  if not found then
    raise exception 'finance_contribution_balance_invalid' using errcode = 'P0001';
  end if;

  delete from public.savings_goal_contributions
   where id = p_contribution_id;

  return v_saved;
end;
$$;

-- Compatibility wrapper for already deployed clients: every old-style addition
-- now creates a proper history row as well.
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
  perform public.finance_add_savings_goal_contribution_v1(p_goal_id, p_amount, null);

  select saved_amount
    into v_saved
  from public.savings_goals
  where id = p_goal_id;

  return v_saved;
end;
$$;

revoke all on function public.finance_current_user_id_v1() from public, anon, authenticated;
revoke all on function public.finance_add_savings_goal_contribution_v1(uuid, numeric, text) from public, anon;
revoke all on function public.finance_delete_savings_goal_contribution_v1(uuid) from public, anon;
revoke all on function public.finance_add_savings_goal_funds_v1(uuid, numeric) from public, anon;

grant execute on function public.finance_add_savings_goal_contribution_v1(uuid, numeric, text) to authenticated;
grant execute on function public.finance_delete_savings_goal_contribution_v1(uuid) to authenticated;
grant execute on function public.finance_add_savings_goal_funds_v1(uuid, numeric) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'savings_goal_contributions'
  ) then
    alter publication supabase_realtime add table public.savings_goal_contributions;
  end if;
end;
$$;
