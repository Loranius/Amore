-- Wishlist v3: secure create/update/move/soft-delete actions.
-- Run manually in Supabase SQL Editor after the foundation + safe-read migrations.

begin;

create or replace function public.create_wishlist_item_v3(
  p_title text,
  p_owner_id integer,
  p_is_shared boolean default false,
  p_description text default null,
  p_link text default null,
  p_image_url text default null,
  p_price numeric default null,
  p_priority text default null
)
returns bigint
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_actor integer := app_private.current_app_user_id();
  v_id bigint;
begin
  if v_actor is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if nullif(btrim(p_title), '') is null then raise exception 'title_required'; end if;
  if p_price is not null and p_price < 0 then raise exception 'invalid_price'; end if;
  if p_priority is not null and p_priority not in ('dream', 'high', 'medium', 'low') then
    raise exception 'invalid_priority';
  end if;
  if not exists (select 1 from public.users where id = p_owner_id) then
    raise exception 'owner_not_found' using errcode = 'P0002';
  end if;

  insert into public.wishlist_items (
    title, owner, is_shared, description, link, image_url, price, priority,
    status, reserved, reserved_by, fulfilled, updated_at
  ) values (
    btrim(p_title), p_owner_id, coalesce(p_is_shared, false), nullif(btrim(p_description), ''),
    nullif(btrim(p_link), ''), nullif(btrim(p_image_url), ''), p_price, p_priority,
    'visible', false, null, false, now()
  ) returning id into v_id;

  insert into public.wishlist_history
    (wish_id, actor_id, event_type, from_status, to_status, is_private)
  values
    (v_id, v_actor, 'wish_created', null, 'visible', false);

  return v_id;
end;
$$;

create or replace function public.update_wishlist_item_v3(
  p_wish_id bigint,
  p_title text,
  p_description text default null,
  p_link text default null,
  p_image_url text default null,
  p_price numeric default null,
  p_priority text default null
)
returns void
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_actor integer := app_private.current_app_user_id();
begin
  if v_actor is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if nullif(btrim(p_title), '') is null then raise exception 'title_required'; end if;
  if p_price is not null and p_price < 0 then raise exception 'invalid_price'; end if;
  if p_priority is not null and p_priority not in ('dream', 'high', 'medium', 'low') then
    raise exception 'invalid_priority';
  end if;

  update public.wishlist_items
  set title = btrim(p_title),
      description = nullif(btrim(p_description), ''),
      link = nullif(btrim(p_link), ''),
      image_url = nullif(btrim(p_image_url), ''),
      price = p_price,
      priority = p_priority,
      updated_at = now()
  where id = p_wish_id
    and owner = v_actor
    and status = 'visible'
    and deleted_at is null;

  if not found then raise exception 'wish_not_editable' using errcode = '42501'; end if;

  insert into public.wishlist_history
    (wish_id, actor_id, event_type, from_status, to_status, is_private)
  values
    (p_wish_id, v_actor, 'wish_updated', 'visible', 'visible', false);
end;
$$;

create or replace function public.move_wishlist_item_v3(
  p_wish_id bigint,
  p_owner_id integer,
  p_is_shared boolean
)
returns void
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_actor integer := app_private.current_app_user_id();
begin
  if v_actor is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from public.users where id = p_owner_id) then
    raise exception 'owner_not_found' using errcode = 'P0002';
  end if;

  update public.wishlist_items
  set owner = p_owner_id,
      is_shared = coalesce(p_is_shared, false),
      updated_at = now()
  where id = p_wish_id
    and owner = v_actor
    and status = 'visible'
    and deleted_at is null;

  if not found then raise exception 'wish_not_movable' using errcode = '42501'; end if;

  insert into public.wishlist_history
    (wish_id, actor_id, event_type, from_status, to_status, metadata, is_private)
  values
    (p_wish_id, v_actor, 'wish_moved', 'visible', 'visible',
     jsonb_build_object('new_owner_id', p_owner_id, 'is_shared', coalesce(p_is_shared, false)), false);
end;
$$;

create or replace function public.soft_delete_wishlist_item_v3(p_wish_id bigint)
returns void
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_actor integer := app_private.current_app_user_id();
begin
  if v_actor is null then raise exception 'not_authenticated' using errcode = '28000'; end if;

  update public.wishlist_items
  set deleted_at = now(), updated_at = now()
  where id = p_wish_id
    and owner = v_actor
    and status = 'visible'
    and deleted_at is null;

  if not found then raise exception 'wish_not_deletable' using errcode = '42501'; end if;

  insert into public.wishlist_history
    (wish_id, actor_id, event_type, from_status, to_status, is_private)
  values
    (p_wish_id, v_actor, 'wish_deleted', 'visible', 'visible', false);
end;
$$;

revoke all on function public.create_wishlist_item_v3(text, integer, boolean, text, text, text, numeric, text) from public, anon;
revoke all on function public.update_wishlist_item_v3(bigint, text, text, text, text, numeric, text) from public, anon;
revoke all on function public.move_wishlist_item_v3(bigint, integer, boolean) from public, anon;
revoke all on function public.soft_delete_wishlist_item_v3(bigint) from public, anon;

grant execute on function public.create_wishlist_item_v3(text, integer, boolean, text, text, text, numeric, text) to authenticated;
grant execute on function public.update_wishlist_item_v3(bigint, text, text, text, text, numeric, text) to authenticated;
grant execute on function public.move_wishlist_item_v3(bigint, integer, boolean) to authenticated;
grant execute on function public.soft_delete_wishlist_item_v3(bigint) to authenticated;

commit;
