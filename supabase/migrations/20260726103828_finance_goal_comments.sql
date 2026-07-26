create table if not exists public.savings_goal_comments (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.savings_goals(id) on delete cascade,
  body text not null,
  author_id integer not null references public.users(id),
  created_at timestamptz not null default now(),
  constraint savings_goal_comments_body_length
    check (char_length(btrim(body)) between 1 and 500)
);

create index if not exists savings_goal_comments_goal_created_idx
  on public.savings_goal_comments(goal_id, created_at asc, id asc);

alter table public.savings_goal_comments enable row level security;

drop policy if exists finance_goal_comments_read_authenticated
  on public.savings_goal_comments;

create policy finance_goal_comments_read_authenticated
on public.savings_goal_comments
for select
to authenticated
using (true);

revoke insert, update, delete on public.savings_goal_comments from anon, authenticated;
grant select on public.savings_goal_comments to authenticated;

create or replace function public.finance_get_savings_goal_comments_v1(
  p_goal_id uuid
)
returns table (
  id uuid,
  goal_id uuid,
  body text,
  author_id integer,
  author_name text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.finance_current_user_id_v1();

  if not exists (
    select 1
    from public.savings_goals as g
    where g.id = p_goal_id
      and g.status = 'confirmed'
  ) then
    raise exception 'finance_goal_not_confirmed' using errcode = 'P0001';
  end if;

  return query
  select recent.id,
         recent.goal_id,
         recent.body,
         recent.author_id,
         recent.author_name,
         recent.created_at
  from (
    select c.id,
           c.goal_id,
           c.body,
           c.author_id,
           u.name as author_name,
           c.created_at
    from public.savings_goal_comments as c
    join public.users as u on u.id = c.author_id
    where c.goal_id = p_goal_id
    order by c.created_at desc, c.id desc
    limit 200
  ) as recent
  order by recent.created_at asc, recent.id asc;
end;
$$;

create or replace function public.finance_add_savings_goal_comment_v1(
  p_goal_id uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_author_id integer := public.finance_current_user_id_v1();
  v_body text := btrim(coalesce(p_body, ''));
  v_comment_id uuid;
begin
  if v_body = '' then
    raise exception 'finance_goal_comment_required' using errcode = '22023';
  end if;

  if char_length(v_body) > 500 then
    raise exception 'finance_goal_comment_too_long' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.savings_goals as g
    where g.id = p_goal_id
      and g.status = 'confirmed'
  ) then
    raise exception 'finance_goal_not_confirmed' using errcode = 'P0001';
  end if;

  insert into public.savings_goal_comments (
    goal_id,
    body,
    author_id
  )
  values (
    p_goal_id,
    v_body,
    v_author_id
  )
  returning id into v_comment_id;

  return v_comment_id;
end;
$$;

create or replace function public.finance_delete_savings_goal_comment_v1(
  p_comment_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id integer := public.finance_current_user_id_v1();
  v_author_id integer;
  v_deleted_id uuid;
begin
  select c.author_id
    into v_author_id
  from public.savings_goal_comments as c
  where c.id = p_comment_id
  for update;

  if not found then
    raise exception 'finance_stale_goal_comment' using errcode = 'P0001';
  end if;

  if v_author_id <> v_user_id then
    raise exception 'finance_goal_comment_delete_not_allowed' using errcode = '42501';
  end if;

  delete from public.savings_goal_comments
   where id = p_comment_id
  returning id into v_deleted_id;

  return v_deleted_id;
end;
$$;

revoke all on function public.finance_get_savings_goal_comments_v1(uuid) from public, anon;
revoke all on function public.finance_add_savings_goal_comment_v1(uuid, text) from public, anon;
revoke all on function public.finance_delete_savings_goal_comment_v1(uuid) from public, anon;

grant execute on function public.finance_get_savings_goal_comments_v1(uuid) to authenticated;
grant execute on function public.finance_add_savings_goal_comment_v1(uuid, text) to authenticated;
grant execute on function public.finance_delete_savings_goal_comment_v1(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'savings_goal_comments'
  ) then
    alter publication supabase_realtime add table public.savings_goal_comments;
  end if;
end;
$$;
