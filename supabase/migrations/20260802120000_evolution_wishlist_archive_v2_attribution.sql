-- ADR-0004 colours a year's crystal from the wishes granted during it, split
-- three ways: wishes belonging to one partner that the other granted, wishes
-- belonging to the other that the first granted, and shared wishes. The v1
-- envelope cannot express that — it exposes neither who wanted the wish nor
-- who granted it — so the engine had no way to tell the three apart and every
-- annual crystal stayed white.
--
-- v2 adds exactly two columns: `owner` and `fulfilled_by`. Both are user ids
-- the partner already sees throughout the wishlist UI, so this widens the
-- pair-wide envelope by nothing either member does not already know. Titles,
-- descriptions, URLs, prices, media and private gift reactions remain outside
-- this contract, as in v1.
--
-- v1 is left in place: it is a published contract and something may still be
-- calling it.

begin;

create or replace function public.get_evolution_wishlist_archive_v2()
returns table (
  id bigint,
  priority text,
  fulfilled_at timestamptz,
  completed_at timestamptz,
  is_shared boolean,
  owner integer,
  fulfilled_by integer
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
    coalesce(wi.is_shared, false),
    wi.owner,
    -- The gift-completion record is the more reliable attribution: the
    -- three-step gift lifecycle writes it, while `fulfilled_by` may be null on
    -- rows fulfilled before that lifecycle existed.
    coalesce(completion.completed_by, wi.fulfilled_by)
  from public.wishlist_items wi
  left join lateral (
    select
      max(wgc.completed_at) as completed_at,
      (array_agg(wgc.completed_by order by wgc.completed_at desc))[1] as completed_by
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

revoke all on function public.get_evolution_wishlist_archive_v2() from public, anon;
grant execute on function public.get_evolution_wishlist_archive_v2() to authenticated;

comment on function public.get_evolution_wishlist_archive_v2() is
  'Pair-wide sanitized fulfilled-wishlist envelope for the Evolution Engine, with gift attribution (owner, fulfilled_by) for ADR-0004 crystal colour.';

commit;
