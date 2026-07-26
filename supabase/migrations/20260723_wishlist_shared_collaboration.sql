-- Collaborative shared Wishlist contract.
--
-- Personal wishes keep the private gift lifecycle. Shared wishes are jointly
-- editable and complete directly from visible -> archived without reservation.

begin;

alter table public.wishlist_items
  add column if not exists version bigint not null default 1;

update public.wishlist_items
set version = 1
where version is null or version < 1;

-- Safe read contract with server-computed capabilities.
drop function if exists public.get_wishlist_items_v3(integer, boolean, boolean);

create function public.get_wishlist_items_v3(
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
  archived_at timestamptz,
  version bigint,
  can_edit boolean,
  can_delete boolean,
  can_move boolean,
  can_reserve boolean,
  can_complete boolean,
  completion_mode text
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
    case
      when wi.is_shared then false
      else wi.status in ('reserved', 'purchased', 'preparing_surprise')
    end as reserved,
    case
      when not wi.is_shared and wr.partner_id = v_actor and wr.active then v_actor
      else null
    end as reserved_by,
    wi.price,
    wi.priority::text,
    wi.status in ('gifted', 'archived') as fulfilled,
    case when wi.status in ('gifted', 'archived') then wi.fulfilled_by else null end,
    case when wi.status in ('gifted', 'archived') then wi.fulfilled_at else null end,
    case
      when not wi.is_shared
        and wi.owner = v_actor
        and wi.status in ('purchased', 'preparing_surprise')
        then 'reserved'::public.wishlist_status
      else wi.status
    end as status,
    wi.archived_at,
    wi.version,
    wi.status = 'visible' and (wi.owner = v_actor or wi.is_shared) as can_edit,
    wi.status = 'visible' and wi.owner = v_actor as can_delete,
    wi.status = 'visible' and wi.owner = v_actor as can_move,
    wi.status = 'visible' and not wi.is_shared and wi.owner <> v_actor as can_reserve,
    wi.status = 'visible' and wi.is_shared as can_complete,
    case when wi.is_shared then 'shared' else 'gift' end::text as completion_mode
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

revoke all on function public.get_wishlist_items_v3(integer, boolean, boolean)
  from public, anon;
grant execute on function public.get_wishlist_items_v3(integer, boolean, boolean)
  to authenticated;

-- Optimistic-concurrency update used by the collaborative client.
create or replace function public.update_wishlist_item_collaborative_v3(
  p_wish_id bigint,
  p_expected_version bigint,
  p_title text,
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
  v_new_version bigint;
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  perform app_private.validate_wishlist_payload(
    p_title,
    p_description,
    p_link,
    p_image_url,
    p_price,
    p_priority
  );

  update public.wishlist_items wi
  set title = btrim(p_title),
      description = nullif(btrim(p_description), ''),
      link = nullif(btrim(p_link), ''),
      image_url = nullif(btrim(p_image_url), ''),
      price = p_price,
      priority = p_priority,
      version = wi.version + 1,
      updated_at = now()
  where wi.id = p_wish_id
    and wi.status = 'visible'
    and wi.deleted_at is null
    and (wi.owner = v_actor or wi.is_shared)
    and wi.version = p_expected_version
  returning wi.version into v_new_version;

  if not found then
    if exists (
      select 1 from public.wishlist_items wi
      where wi.id = p_wish_id
        and wi.status = 'visible'
        and wi.deleted_at is null
        and (wi.owner = v_actor or wi.is_shared)
    ) then
      raise exception 'wish_version_conflict' using errcode = '40001';
    end if;
    raise exception 'wish_not_editable' using errcode = '42501';
  end if;

  insert into public.wishlist_history (
    wish_id, actor_id, event_type, from_status, to_status, metadata, is_private
  ) values (
    p_wish_id,
    v_actor,
    'wish_updated',
    'visible',
    'visible',
    jsonb_build_object('version', v_new_version, 'shared', (
      select is_shared from public.wishlist_items where id = p_wish_id
    )),
    false
  );

  return v_new_version;
end;
$$;

revoke all on function public.update_wishlist_item_collaborative_v3(
  bigint, bigint, text, text, text, text, numeric, text
) from public, anon;
grant execute on function public.update_wishlist_item_collaborative_v3(
  bigint, bigint, text, text, text, text, numeric, text
) to authenticated;

-- Keep legacy owner-only update available, but make it participate in versioning.
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

  update public.wishlist_items wi
  set title = btrim(p_title),
      description = nullif(btrim(p_description), ''),
      link = nullif(btrim(p_link), ''),
      image_url = nullif(btrim(p_image_url), ''),
      price = p_price,
      priority = p_priority,
      version = wi.version + 1,
      updated_at = now()
  where wi.id = p_wish_id
    and wi.owner = v_actor
    and wi.status = 'visible'
    and wi.deleted_at is null;

  if not found then
    raise exception 'wish_not_editable' using errcode = '42501';
  end if;

  insert into public.wishlist_history
    (wish_id, actor_id, event_type, from_status, to_status, is_private)
  values
    (p_wish_id, v_actor, 'wish_updated', 'visible', 'visible', false);
end;
$$;

-- Moving remains an owner action and increments the concurrency version.
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

  update public.wishlist_items wi
  set owner = p_owner_id,
      is_shared = coalesce(p_is_shared, false),
      version = wi.version + 1,
      updated_at = now()
  where wi.id = p_wish_id
    and wi.owner = v_actor
    and wi.status = 'visible'
    and wi.deleted_at is null;

  if not found then raise exception 'wish_not_movable' using errcode = '42501'; end if;

  insert into public.wishlist_history
    (wish_id, actor_id, event_type, from_status, to_status, metadata, is_private)
  values
    (p_wish_id, v_actor, 'wish_moved', 'visible', 'visible',
     jsonb_build_object('new_owner_id', p_owner_id, 'is_shared', coalesce(p_is_shared, false)), false);
end;
$$;

-- Shared wishes never enter the private reservation lifecycle.
create or replace function public.reserve_wishlist_item(p_wish_id bigint)
returns void
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_actor integer := app_private.current_app_user_id();
  v_wish public.wishlist_items%rowtype;
begin
  if v_actor is null then raise exception 'not_authenticated' using errcode = '28000'; end if;

  select * into v_wish
  from public.wishlist_items
  where id = p_wish_id and deleted_at is null
  for update;

  if not found then raise exception 'wish_not_found' using errcode = 'P0002'; end if;
  if v_wish.is_shared then
    raise exception 'shared_wish_not_reservable' using errcode = '42501';
  end if;
  if v_wish.owner = v_actor then
    raise exception 'cannot_reserve_own_wish' using errcode = '42501';
  end if;
  if v_wish.status <> 'visible' then
    raise exception 'wish_not_reservable';
  end if;

  insert into public.wishlist_reservations (wish_id, partner_id)
  values (p_wish_id, v_actor);

  update public.wishlist_items wi
  set status = 'reserved',
      reserved = true,
      reserved_by = v_actor,
      version = wi.version + 1,
      updated_at = now()
  where wi.id = p_wish_id;

  insert into public.wishlist_history
    (wish_id, actor_id, event_type, from_status, to_status, is_private)
  values
    (p_wish_id, v_actor, 'wish_reserved', 'visible', 'reserved', true);
end;
$$;

create or replace function public.cancel_wishlist_reservation(p_wish_id bigint)
returns void
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_actor integer := app_private.current_app_user_id();
  v_wish public.wishlist_items%rowtype;
begin
  if v_actor is null then raise exception 'not_authenticated' using errcode = '28000'; end if;

  select * into v_wish
  from public.wishlist_items
  where id = p_wish_id and deleted_at is null
  for update;

  if not found then raise exception 'wish_not_found' using errcode = 'P0002'; end if;
  if v_wish.status <> 'reserved' then raise exception 'wish_not_reserved'; end if;

  update public.wishlist_reservations
  set active = false, cancelled_at = now(), updated_at = now()
  where wish_id = p_wish_id and partner_id = v_actor and active;

  if not found then raise exception 'reservation_not_owned' using errcode = '42501'; end if;

  update public.wishlist_items wi
  set status = 'visible', reserved = false, reserved_by = null,
      version = wi.version + 1, updated_at = now()
  where wi.id = p_wish_id;

  insert into public.wishlist_history
    (wish_id, actor_id, event_type, from_status, to_status, is_private)
  values
    (p_wish_id, v_actor, 'reservation_cancelled', 'reserved', 'visible', true);
end;
$$;

create or replace function public.mark_wishlist_purchased(p_wish_id bigint)
returns void
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_actor integer := app_private.current_app_user_id();
begin
  if v_actor is null then raise exception 'not_authenticated' using errcode = '28000'; end if;

  update public.wishlist_items wi
  set status = 'purchased', version = wi.version + 1, updated_at = now()
  where wi.id = p_wish_id
    and not wi.is_shared
    and wi.status = 'reserved'
    and wi.deleted_at is null
    and exists (
      select 1 from public.wishlist_reservations wr
      where wr.wish_id = wi.id and wr.partner_id = v_actor and wr.active
    );

  if not found then raise exception 'wish_not_purchasable' using errcode = '42501'; end if;

  insert into public.wishlist_history
    (wish_id, actor_id, event_type, from_status, to_status, is_private)
  values
    (p_wish_id, v_actor, 'gift_purchased', 'reserved', 'purchased', true);
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
  if v_actor is null then raise exception 'not_authenticated' using errcode = '28000'; end if;

  update public.wishlist_items wi
  set status = 'preparing_surprise', version = wi.version + 1, updated_at = now()
  where wi.id = p_wish_id
    and not wi.is_shared
    and wi.status = 'purchased'
    and wi.deleted_at is null
    and exists (
      select 1 from public.wishlist_reservations wr
      where wr.wish_id = wi.id and wr.partner_id = v_actor and wr.active
    );

  if not found then raise exception 'wish_not_preparable' using errcode = '42501'; end if;

  insert into public.wishlist_history
    (wish_id, actor_id, event_type, from_status, to_status, is_private)
  values
    (p_wish_id, v_actor, 'preparing_surprise_started', 'purchased', 'preparing_surprise', true);
end;
$$;

-- Shared uploads are allowed while the collaborative wish is visible. Personal
-- uploads keep requiring the private preparing_surprise reservation state.
create or replace function public.wishlist_memory_upload_allowed(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, app_private
as $$
declare
  v_actor integer := app_private.current_app_user_id();
  v_parts text[];
  v_wish_id bigint;
begin
  if v_actor is null or p_name is null then return false; end if;

  v_parts := string_to_array(p_name, '/');
  if cardinality(v_parts) <> 4 or v_parts[1] <> v_actor::text then return false; end if;
  if v_parts[3] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then return false; end if;
  if not (
    app_private.wishlist_memory_filename_allowed(v_parts[4], 'photo')
    or app_private.wishlist_memory_filename_allowed(v_parts[4], 'video')
  ) then return false; end if;

  begin
    v_wish_id := v_parts[2]::bigint;
  exception when others then
    return false;
  end;

  return exists (
    select 1
    from public.wishlist_items wi
    where wi.id = v_wish_id
      and wi.deleted_at is null
      and (
        (wi.is_shared and wi.status = 'visible')
        or (
          not wi.is_shared
          and wi.status = 'preparing_surprise'
          and exists (
            select 1 from public.wishlist_reservations wr
            where wr.wish_id = wi.id
              and wr.active
              and wr.partner_id = v_actor
          )
        )
      )
  );
end;
$$;

-- Unified completion RPC: personal gifts require reservation ownership;
-- shared wishes complete directly and jointly from visible.
create or replace function public.complete_wishlist_gift(
  p_wish_id bigint,
  p_idempotency_key uuid,
  p_reaction_photo text default null,
  p_reaction_video text default null,
  p_comment text default null
)
returns bigint
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_actor integer := app_private.current_app_user_id();
  v_completion_id bigint;
  v_existing_wish_id bigint;
  v_existing_actor integer;
  v_wish public.wishlist_items%rowtype;
  v_prefix text;
  v_photo text := nullif(btrim(p_reaction_photo), '');
  v_video text := nullif(btrim(p_reaction_video), '');
  v_comment text := nullif(btrim(p_comment), '');
begin
  if v_actor is null then raise exception 'not_authenticated' using errcode = '28000'; end if;

  select id, wish_id, completed_by
    into v_completion_id, v_existing_wish_id, v_existing_actor
  from public.wishlist_gift_completions
  where idempotency_key = p_idempotency_key;

  if found then
    if v_existing_wish_id <> p_wish_id or v_existing_actor <> v_actor then
      raise exception 'idempotency_key_conflict' using errcode = '23505';
    end if;
    return v_completion_id;
  end if;

  if v_comment is not null and char_length(v_comment) > 1000 then raise exception 'memory_comment_too_long'; end if;
  if v_photo is not null and char_length(v_photo) > 500 then raise exception 'invalid_reaction_photo_path'; end if;
  if v_video is not null and char_length(v_video) > 500 then raise exception 'invalid_reaction_video_path'; end if;

  v_prefix := v_actor::text || '/' || p_wish_id::text || '/' || p_idempotency_key::text || '/';
  if v_photo is not null and (
    left(v_photo, char_length(v_prefix)) <> v_prefix
    or not app_private.wishlist_memory_filename_allowed(substr(v_photo, char_length(v_prefix) + 1), 'photo')
  ) then raise exception 'invalid_reaction_photo_path' using errcode = '22023'; end if;
  if v_video is not null and (
    left(v_video, char_length(v_prefix)) <> v_prefix
    or not app_private.wishlist_memory_filename_allowed(substr(v_video, char_length(v_prefix) + 1), 'video')
  ) then raise exception 'invalid_reaction_video_path' using errcode = '22023'; end if;

  select * into v_wish
  from public.wishlist_items wi
  where wi.id = p_wish_id and wi.deleted_at is null
  for update;

  if not found then raise exception 'wish_not_found' using errcode = 'P0002'; end if;

  if v_wish.is_shared then
    if v_wish.status <> 'visible' then raise exception 'shared_wish_not_completable'; end if;
  else
    if v_wish.status <> 'preparing_surprise' then raise exception 'wish_not_completable'; end if;
    if not exists (
      select 1 from public.wishlist_reservations wr
      where wr.wish_id = p_wish_id and wr.partner_id = v_actor and wr.active
    ) then raise exception 'reservation_not_owned' using errcode = '42501'; end if;
  end if;

  insert into public.wishlist_gift_completions (
    wish_id, completed_by, reaction_photo, reaction_video, comment, idempotency_key
  ) values (
    p_wish_id, v_actor, v_photo, v_video, v_comment, p_idempotency_key
  ) returning id into v_completion_id;

  update public.wishlist_reservations
  set active = false, cancelled_at = now(), updated_at = now()
  where wish_id = p_wish_id and active;

  update public.wishlist_items wi
  set status = 'archived', fulfilled = true, fulfilled_by = v_actor,
      fulfilled_at = now(), archived_at = now(), reserved = false,
      reserved_by = null, version = wi.version + 1, updated_at = now()
  where wi.id = p_wish_id;

  if v_wish.is_shared then
    insert into public.wishlist_history (
      wish_id, actor_id, event_type, from_status, to_status, metadata, is_private
    ) values
      (p_wish_id, v_actor, 'shared_wish_completed', 'visible', 'gifted', jsonb_build_object('completion_id', v_completion_id), false),
      (p_wish_id, v_actor, 'wish_archived', 'gifted', 'archived', jsonb_build_object('completion_id', v_completion_id), false),
      (p_wish_id, v_actor, 'gift_memory_created', 'archived', 'archived', jsonb_build_object(
        'completion_id', v_completion_id,
        'has_photo', v_photo is not null,
        'has_video', v_video is not null,
        'has_comment', v_comment is not null,
        'shared', true
      ), false);
  else
    insert into public.wishlist_history (
      wish_id, actor_id, event_type, from_status, to_status, metadata, is_private
    ) values
      (p_wish_id, v_actor, 'gift_completed', 'preparing_surprise', 'gifted', jsonb_build_object('completion_id', v_completion_id), false),
      (p_wish_id, v_actor, 'wish_archived', 'gifted', 'archived', jsonb_build_object('completion_id', v_completion_id), false),
      (p_wish_id, v_actor, 'gift_memory_created', 'archived', 'archived', jsonb_build_object(
        'completion_id', v_completion_id,
        'has_photo', v_photo is not null,
        'has_video', v_video is not null,
        'has_comment', v_comment is not null,
        'shared', false
      ), false);
  end if;

  return v_completion_id;
end;
$$;

revoke all on function public.update_wishlist_item_collaborative_v3(
  bigint, bigint, text, text, text, text, numeric, text
) from public, anon;
grant execute on function public.update_wishlist_item_collaborative_v3(
  bigint, bigint, text, text, text, text, numeric, text
) to authenticated;

revoke all on function public.reserve_wishlist_item(bigint) from public, anon;
revoke all on function public.complete_wishlist_gift(bigint, uuid, text, text, text) from public, anon;
revoke all on function public.wishlist_memory_upload_allowed(text) from public, anon;

grant execute on function public.reserve_wishlist_item(bigint) to authenticated;
grant execute on function public.complete_wishlist_gift(bigint, uuid, text, text, text) to authenticated;
grant execute on function public.wishlist_memory_upload_allowed(text) to authenticated;

commit;
