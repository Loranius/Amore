-- Wishlist v3: restore missing mutation RPCs and close direct table access.
-- Review in PR, then apply manually to Supabase production.

begin;

-- ---------------------------------------------------------------------------
-- Shared validation rules
-- ---------------------------------------------------------------------------
create or replace function app_private.validate_wishlist_payload(
  p_title text,
  p_description text,
  p_link text,
  p_image_url text,
  p_price numeric,
  p_priority text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(btrim(p_title), '') is null then
    raise exception 'title_required';
  end if;
  if char_length(btrim(p_title)) > 160 then
    raise exception 'title_too_long';
  end if;
  if p_description is not null and char_length(p_description) > 1000 then
    raise exception 'description_too_long';
  end if;
  if p_link is not null and char_length(p_link) > 2048 then
    raise exception 'link_too_long';
  end if;
  if p_image_url is not null and char_length(p_image_url) > 4096 then
    raise exception 'image_url_too_long';
  end if;
  if p_price is not null and p_price < 0 then
    raise exception 'invalid_price';
  end if;
  if p_priority is not null and p_priority not in ('dream', 'high', 'medium', 'low') then
    raise exception 'invalid_priority';
  end if;
end;
$$;

revoke all on function app_private.validate_wishlist_payload(text, text, text, text, numeric, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Create
-- The portal currently has two app users and intentionally supports creating
-- a wish for oneself or the partner. p_owner_id must still resolve to a real
-- app user; arbitrary external identities are impossible.
-- ---------------------------------------------------------------------------
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
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  perform app_private.validate_wishlist_payload(
    p_title, p_description, p_link, p_image_url, p_price, p_priority
  );

  if not exists (select 1 from public.users where id = p_owner_id) then
    raise exception 'owner_not_found' using errcode = 'P0002';
  end if;

  insert into public.wishlist_items (
    title,
    owner,
    is_shared,
    description,
    link,
    image_url,
    price,
    priority,
    status,
    reserved,
    reserved_by,
    fulfilled,
    updated_at
  ) values (
    btrim(p_title),
    p_owner_id,
    coalesce(p_is_shared, false),
    nullif(btrim(p_description), ''),
    nullif(btrim(p_link), ''),
    nullif(btrim(p_image_url), ''),
    p_price,
    p_priority,
    'visible',
    false,
    null,
    false,
    now()
  )
  returning id into v_id;

  insert into public.wishlist_history (
    wish_id, actor_id, event_type, from_status, to_status, metadata, is_private
  ) values (
    v_id,
    v_actor,
    'wish_created',
    null,
    'visible',
    jsonb_build_object(
      'owner_id', p_owner_id,
      'is_shared', coalesce(p_is_shared, false)
    ),
    false
  );

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Update: only the current owner and only before reservation.
-- ---------------------------------------------------------------------------
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
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  perform app_private.validate_wishlist_payload(
    p_title, p_description, p_link, p_image_url, p_price, p_priority
  );

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

  if not found then
    raise exception 'wish_not_editable' using errcode = '42501';
  end if;

  insert into public.wishlist_history (
    wish_id, actor_id, event_type, from_status, to_status, is_private
  ) values (
    p_wish_id, v_actor, 'wish_updated', 'visible', 'visible', false
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Move: only the current owner and only before reservation.
-- ---------------------------------------------------------------------------
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
  v_previous_owner integer;
  v_previous_shared boolean;
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not exists (select 1 from public.users where id = p_owner_id) then
    raise exception 'owner_not_found' using errcode = 'P0002';
  end if;

  select owner, is_shared
  into v_previous_owner, v_previous_shared
  from public.wishlist_items
  where id = p_wish_id
    and owner = v_actor
    and status = 'visible'
    and deleted_at is null
  for update;

  if not found then
    raise exception 'wish_not_movable' using errcode = '42501';
  end if;

  update public.wishlist_items
  set owner = p_owner_id,
      is_shared = coalesce(p_is_shared, false),
      updated_at = now()
  where id = p_wish_id;

  insert into public.wishlist_history (
    wish_id, actor_id, event_type, from_status, to_status, metadata, is_private
  ) values (
    p_wish_id,
    v_actor,
    'wish_moved',
    'visible',
    'visible',
    jsonb_build_object(
      'previous_owner_id', v_previous_owner,
      'new_owner_id', p_owner_id,
      'previous_is_shared', v_previous_shared,
      'is_shared', coalesce(p_is_shared, false)
    ),
    false
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Soft delete: only the current owner and only before reservation.
-- ---------------------------------------------------------------------------
create or replace function public.soft_delete_wishlist_item_v3(p_wish_id bigint)
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

  update public.wishlist_items
  set deleted_at = now(),
      updated_at = now()
  where id = p_wish_id
    and owner = v_actor
    and status = 'visible'
    and deleted_at is null;

  if not found then
    raise exception 'wish_not_deletable' using errcode = '42501';
  end if;

  insert into public.wishlist_history (
    wish_id, actor_id, event_type, from_status, to_status, is_private
  ) values (
    p_wish_id, v_actor, 'wish_deleted', 'visible', 'visible', false
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Privacy-safe statistics and archive reads.
-- These replace the last direct client SELECTs on wishlist_items.
-- ---------------------------------------------------------------------------
create or replace function public.get_wishlist_stats_v3()
returns table (
  total bigint,
  done bigint,
  done_this_year bigint,
  done_this_month bigint
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
    count(*)::bigint,
    count(*) filter (where wi.fulfilled)::bigint,
    count(*) filter (
      where wi.fulfilled
        and wi.fulfilled_at >= date_trunc('year', now())
    )::bigint,
    count(*) filter (
      where wi.fulfilled
        and wi.fulfilled_at >= date_trunc('month', now())
    )::bigint
  from public.wishlist_items wi
  where wi.deleted_at is null;
end;
$$;

create or replace function public.get_fulfilled_wishlist_items_v3(p_owner_id integer)
returns table (
  id bigint,
  title text,
  description text,
  link text,
  image_url text,
  price numeric,
  priority text,
  fulfilled_at timestamptz,
  fulfilled_by integer
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

  if not exists (select 1 from public.users where id = p_owner_id) then
    raise exception 'owner_not_found' using errcode = 'P0002';
  end if;

  return query
  select
    wi.id::bigint,
    wi.title,
    wi.description,
    wi.link,
    wi.image_url,
    wi.price,
    wi.priority::text,
    wi.fulfilled_at,
    wi.fulfilled_by
  from public.wishlist_items wi
  where wi.owner = p_owner_id
    and wi.fulfilled = true
    and wi.deleted_at is null
  order by wi.fulfilled_at desc nulls last, wi.id desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function permissions
-- ---------------------------------------------------------------------------
revoke all on function public.create_wishlist_item_v3(text, integer, boolean, text, text, text, numeric, text)
  from public, anon;
revoke all on function public.update_wishlist_item_v3(bigint, text, text, text, text, numeric, text)
  from public, anon;
revoke all on function public.move_wishlist_item_v3(bigint, integer, boolean)
  from public, anon;
revoke all on function public.soft_delete_wishlist_item_v3(bigint)
  from public, anon;
revoke all on function public.get_wishlist_stats_v3()
  from public, anon;
revoke all on function public.get_fulfilled_wishlist_items_v3(integer)
  from public, anon;

grant execute on function public.create_wishlist_item_v3(text, integer, boolean, text, text, text, numeric, text)
  to authenticated;
grant execute on function public.update_wishlist_item_v3(bigint, text, text, text, text, numeric, text)
  to authenticated;
grant execute on function public.move_wishlist_item_v3(bigint, integer, boolean)
  to authenticated;
grant execute on function public.soft_delete_wishlist_item_v3(bigint)
  to authenticated;
grant execute on function public.get_wishlist_stats_v3()
  to authenticated;
grant execute on function public.get_fulfilled_wishlist_items_v3(integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- RLS hardening
-- Remove the broad authenticated ALL policy. The browser no longer needs any
-- direct table privilege: every read and mutation now goes through a role-safe
-- SECURITY DEFINER RPC.
-- ---------------------------------------------------------------------------
alter table public.wishlist_items enable row level security;

drop policy if exists auth_only on public.wishlist_items;
drop policy if exists wishlist_items_authenticated_read on public.wishlist_items;

revoke all on table public.wishlist_items from anon, authenticated;

commit;
