-- Evolution Engine needs one shared relationship history regardless of which
-- partner opens the portal. Existing archive RPCs intentionally expose full
-- personal gift details only to their owner, so they must not be reused for a
-- pair-wide artifact.
--
-- This function returns only the minimum event envelope required by Evolution:
-- stable row identity, priority, completion timestamps and shared scope.
-- Titles, descriptions, URLs, prices, media and gift reactions are never
-- exposed through this contract.

begin;

create or replace function public.get_evolution_wishlist_archive_v1()
returns table (
  id bigint,
  priority text,
  fulfilled_at timestamptz,
  completed_at timestamptz,
  is_shared boolean
)
language plpgsql
stable
security definer
set search_path = public, app_private, pg_catalog
as $$
declare
  v_actor integer := app_private.current_app_user_id();
  v_couple_id bigint := app_private.current_couple_id();
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if v_couple_id is null then
    raise exception 'couple_membership_required' using errcode = '42501';
  end if;

  return query
  select
    wi.id::bigint,
    wi.priority::text,
    wi.fulfilled_at,
    completion.completed_at,
    coalesce(wi.is_shared, false)
  from public.wishlist_items wi
  left join lateral (
    select max(wgc.completed_at) as completed_at
    from public.wishlist_gift_completions wgc
    where wgc.wish_id = wi.id
  ) completion on true
  where wi.couple_id = v_couple_id
    and wi.fulfilled
    and wi.deleted_at is null
    and (not coalesce(wi.is_shared, false) or wi.status = 'archived')
  order by
    coalesce(completion.completed_at, wi.fulfilled_at) asc nulls last,
    wi.id asc;
end;
$$;

revoke all on function public.get_evolution_wishlist_archive_v1() from public, anon;
grant execute on function public.get_evolution_wishlist_archive_v1() to authenticated;

comment on function public.get_evolution_wishlist_archive_v1() is
  'Returns a pair-wide sanitized fulfilled-wishlist event envelope for the deterministic Evolution Engine.';

commit;
