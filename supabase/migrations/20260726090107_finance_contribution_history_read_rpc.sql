create or replace function public.finance_get_savings_goal_contributions_v1(
  p_goal_id uuid
)
returns table (
  id uuid,
  goal_id uuid,
  amount numeric,
  note text,
  contributed_by integer,
  contributor_name text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.finance_current_user_id_v1();

  return query
  select
    c.id,
    c.goal_id,
    c.amount,
    c.note,
    c.contributed_by,
    u.name as contributor_name,
    c.created_at
  from public.savings_goal_contributions as c
  join public.users as u on u.id = c.contributed_by
  where c.goal_id = p_goal_id
  order by c.created_at desc, c.id desc;
end;
$$;

revoke all on function public.finance_get_savings_goal_contributions_v1(uuid) from public, anon;
grant execute on function public.finance_get_savings_goal_contributions_v1(uuid) to authenticated;
