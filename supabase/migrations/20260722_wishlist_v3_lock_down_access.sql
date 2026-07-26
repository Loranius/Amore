-- Wishlist v3: remove direct client access to wishlist_items.
-- Apply after:
--   1. 20260722_wishlist_v3_foundation.sql
--   2. 20260722_wishlist_v3_safe_reads.sql
--   3. 20260722_wishlist_v3_safe_mutations.sql

begin;

-- Refuse to lock the table before every mutation endpoint exists.
do $$
begin
  if to_regprocedure('public.create_wishlist_item_v3(text,integer,boolean,text,text,text,numeric,text)') is null
    or to_regprocedure('public.update_wishlist_item_v3(bigint,text,text,text,text,numeric,text)') is null
    or to_regprocedure('public.move_wishlist_item_v3(bigint,integer,boolean)') is null
    or to_regprocedure('public.soft_delete_wishlist_item_v3(bigint)') is null
    or to_regprocedure('public.get_wishlist_items_v3(integer,boolean,boolean)') is null then
    raise exception 'wishlist_v3_rpc_surface_incomplete';
  end if;
end $$;

-- Privacy-safe aggregate used by the progress banner. It exposes counts only,
-- never reservation ownership or private lifecycle details.
create or replace function public.get_wishlist_stats_v3()
returns table (
  total bigint,
  done bigint,
  done_this_year bigint,
  done_this_month bigint
)
language sql
stable
security definer
set search_path = public, app_private
as $$
  select
    count(*)::bigint as total,
    count(*) filter (where wi.status in ('gifted', 'archived'))::bigint as done,
    count(*) filter (
      where wi.status in ('gifted', 'archived')
        and wi.fulfilled_at >= date_trunc('year', now())
        and wi.fulfilled_at < date_trunc('year', now()) + interval '1 year'
    )::bigint as done_this_year,
    count(*) filter (
      where wi.status in ('gifted', 'archived')
        and wi.fulfilled_at >= date_trunc('month', now())
        and wi.fulfilled_at < date_trunc('month', now()) + interval '1 month'
    )::bigint as done_this_month
  from public.wishlist_items wi
  where wi.deleted_at is null
    and app_private.current_app_user_id() is not null;
$$;

revoke all on function public.get_wishlist_stats_v3() from public, anon;
grant execute on function public.get_wishlist_stats_v3() to authenticated;

-- The old catch-all policy allowed every authenticated client to read and
-- mutate every column directly, bypassing domain validation and privacy rules.
drop policy if exists auth_only on public.wishlist_items;
drop policy if exists wishlist_items_authenticated_read on public.wishlist_items;

alter table public.wishlist_items enable row level security;

-- No direct table access remains for browser roles. SECURITY DEFINER RPCs are
-- the only supported interface and keep ownership/status checks atomic.
revoke all privileges on table public.wishlist_items from public, anon, authenticated;
revoke all privileges on sequence public.wishlist_items_id_seq from public, anon, authenticated;

commit;
