-- Wishlist v3: split reservation, purchase and surprise preparation.
-- Apply after 20260723_wishlist_add_purchased_status.sql.

begin;

create or replace function public.mark_wishlist_purchased(p_wish_id bigint)
returns void
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_actor integer := app_private.current_app_user_id();
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  update public.wishlist_items wi
  set status = 'purchased',
      updated_at = now()
  where wi.id = p_wish_id
    and wi.status = 'reserved'
    and wi.deleted_at is null
    and exists (
      select 1
      from public.wishlist_reservations wr
      where wr.wish_id = wi.id
        and wr.partner_id = v_actor
        and wr.active
    );

  if not found then
    raise exception 'wish_not_purchasable' using errcode = '42501';
  end if;

  insert into public.wishlist_history (
    wish_id,
    actor_id,
    event_type,
    from_status,
    to_status,
    is_private
  ) values (
    p_wish_id,
    v_actor,
    'gift_purchased',
    'reserved',
    'purchased',
    true
  );
end;
$$;

create or replace function public.mark_wishlist_preparing(p_wish_id bigint)
returns void
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_actor integer := app_private.current_app_user_id();
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  update public.wishlist_items wi
  set status = 'preparing_surprise',
      updated_at = now()
  where wi.id = p_wish_id
    and wi.status = 'purchased'
    and wi.deleted_at is null
    and exists (
      select 1
      from public.wishlist_reservations wr
      where wr.wish_id = wi.id
        and wr.partner_id = v_actor
        and wr.active
    );

  if not found then
    raise exception 'wish_not_preparable' using errcode = '42501';
  end if;

  insert into public.wishlist_history (
    wish_id,
    actor_id,
    event_type,
    from_status,
    to_status,
    is_private
  ) values (
    p_wish_id,
    v_actor,
    'preparing_surprise_started',
    'purchased',
    'preparing_surprise',
    true
  );
end;
$$;

-- Safe read contract:
-- - the reservation owner sees the real private lifecycle;
-- - the wish owner sees purchased/preparing only as generic reserved;
-- - nobody else receives reserved_by.
create or replace function public.get_wishlist_items_v3(
  p_owner_id integer default null,
  p_shared boolean default false,
  p_include_archived boolean default false
)
returns table (
  id bigint,
  title text,
  description text,
  link text,
  image_url text,
  gift_date date,
  owner integer,
  is_shared boolean,
  reserved boolean,
  reserved_by integer,
  price numeric,
  priority text,
  fulfilled boolean,
  fulfilled_by integer,
  fulfilled_at timestamptz,
  status public.wishlist_status,
  archived_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, app_private
as $$
declare
  v_actor integer := app_private.current_app_user_id();
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  return query
  select
    wi.id::bigint,
    wi.title,
    wi.description,
    wi.link,
    wi.image_url,
    wi.gift_date,
    wi.owner,
    wi.is_shared,
    (wi.status in ('reserved', 'purchased', 'preparing_surprise')) as reserved,
    case
      when wr.partner_id = v_actor and wr.active then v_actor
      else null
    end as reserved_by,
    wi.price,
    wi.priority::text,
    (wi.status in ('gifted', 'archived')) as fulfilled,
    case
      when wi.status in ('gifted', 'archived') then wi.fulfilled_by
      else null
    end as fulfilled_by,
    case
      when wi.status in ('gifted', 'archived') then wi.fulfilled_at
      else null
    end as fulfilled_at,
    case
      when wi.owner = v_actor
        and wi.status in ('purchased', 'preparing_surprise')
        then 'reserved'::public.wishlist_status
      else wi.status
    end as status,
    wi.archived_at
  from public.wishlist_items wi
  left join public.wishlist_reservations wr
    on wr.wish_id = wi.id and wr.active
  where wi.deleted_at is null
    and (
      (p_shared and wi.is_shared)
      or
      (not p_shared and not wi.is_shared and wi.owner = p_owner_id)
    )
    and (p_include_archived or wi.status not in ('gifted', 'archived'))
  order by wi.id desc;
end;
$$;

revoke all on function public.mark_wishlist_purchased(bigint) from public, anon;
grant execute on function public.mark_wishlist_purchased(bigint) to authenticated;

commit;
