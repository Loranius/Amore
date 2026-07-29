-- ============================================================
-- Shared piggy-bank balance + dedicated plan cover storage.
-- ------------------------------------------------------------
-- Old savings-goal tables remain untouched for history and legacy crystal
-- compatibility. The active UI moves to one shared balance.
-- ============================================================

create table if not exists public.piggy_bank_balance (
  id smallint primary key default 1 check (id = 1),
  balance numeric(14, 2) not null default 0 check (balance >= 0),
  updated_by integer references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.piggy_bank_balance enable row level security;

drop policy if exists piggy_bank_balance_select on public.piggy_bank_balance;
create policy piggy_bank_balance_select
  on public.piggy_bank_balance
  for select
  to authenticated
  using (true);

revoke insert, update, delete on public.piggy_bank_balance from anon, authenticated;
grant select on public.piggy_bank_balance to authenticated;

create or replace function public.finance_get_piggy_bank_v1()
returns table (
  balance numeric,
  updated_by integer,
  updated_by_name text,
  updated_at timestamptz
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
    coalesce(p.balance, 0::numeric),
    p.updated_by,
    u.name,
    p.updated_at
  from (select 1 as id) seed
  left join public.piggy_bank_balance p on p.id = seed.id
  left join public.users u on u.id = p.updated_by;
end;
$$;

create or replace function public.finance_set_piggy_bank_balance_v1(
  p_balance numeric,
  p_expected_updated_at timestamptz default null
)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id integer;
  v_current_updated_at timestamptz;
begin
  if p_balance is null or p_balance < 0 or p_balance > 999999999999.99 then
    raise exception 'finance_piggy_bank_balance_invalid' using errcode = 'P0001';
  end if;

  v_user_id := public.finance_current_user_id_v1();

  select updated_at
    into v_current_updated_at
  from public.piggy_bank_balance
  where id = 1
  for update;

  if found
     and p_expected_updated_at is not null
     and v_current_updated_at is distinct from p_expected_updated_at then
    raise exception 'finance_stale' using errcode = 'P0001';
  end if;

  insert into public.piggy_bank_balance (id, balance, updated_by, updated_at)
  values (1, round(p_balance, 2), v_user_id, now())
  on conflict (id) do update
    set balance = excluded.balance,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at;

  return round(p_balance, 2);
end;
$$;

revoke all on function public.finance_get_piggy_bank_v1() from public;
revoke all on function public.finance_set_piggy_bank_balance_v1(numeric, timestamptz) from public;
grant execute on function public.finance_get_piggy_bank_v1() to authenticated;
grant execute on function public.finance_set_piggy_bank_balance_v1(numeric, timestamptz) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'plan-covers',
  'plan-covers',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists plan_covers_select on storage.objects;
create policy plan_covers_select
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'plan-covers');

drop policy if exists plan_covers_insert on storage.objects;
create policy plan_covers_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'plan-covers'
    and name is not null
    and char_length(name) between 1 and 512
  );

drop policy if exists plan_covers_update on storage.objects;
create policy plan_covers_update
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'plan-covers')
  with check (
    bucket_id = 'plan-covers'
    and name is not null
    and char_length(name) between 1 and 512
  );

drop policy if exists plan_covers_delete on storage.objects;
create policy plan_covers_delete
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'plan-covers');
