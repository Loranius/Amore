-- Couple-scoped Wishlist commands.
-- Explicit membership checks happen before lifecycle evaluation so outsiders
-- cannot infer whether a wish exists, is shared, reserved or completed.

begin;

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
  v_couple_id bigint := app_private.current_couple_id();
  v_new_version bigint;
begin
  if v_actor is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if v_couple_id is null then raise exception 'couple_membership_required' using errcode = '42501'; end if;

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
    and wi.couple_id = v_couple_id
    and wi.status = 'visible'
    and wi.deleted_at is null
    and (wi.owner = v_actor or wi.is_shared)
    and wi.version = p_expected_version
  returning wi.version into v_new_version;

  if not found then
    if exists (
      select 1 from public.wishlist_items wi
      where wi.id = p_wish_id
        and wi.couple_id = v_couple_id
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
    p_wish_id, v_actor, 'wish_updated', 'visible', 'visible',
    jsonb_build_object('version', v_new_version, 'shared', (
      select wi.is_shared from public.wishlist_items wi where wi.id = p_wish_id
    )), false
  );

  return v_new_version;
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
  v_couple_id bigint := app_private.current_couple_id();
begin
  if v_actor is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if v_couple_id is null then raise exception 'couple_membership_required' using errcode = '42501'; end if;
  if not app_private.user_in_couple(p_owner_id, v_couple_id) then
    raise exception 'wishlist_owner_outside_couple' using errcode = '42501';
  end if;

  update public.wishlist_items wi
  set owner = p_owner_id,
      is_shared = coalesce(p_is_shared, false),
      version = wi.version + 1,
      updated_at = now()
  where wi.id = p_wish_id
    and wi.couple_id = v_couple_id
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

create or replace function public.soft_delete_wishlist_item_v3(p_wish_id bigint)
returns void
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_actor integer := app_private.current_app_user_id();
  v_couple_id bigint := app_private.current_couple_id();
begin
  if v_actor is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if v_couple_id is null then raise exception 'couple_membership_required' using errcode = '42501'; end if;

  update public.wishlist_items wi
  set deleted_at = now(), updated_at = now()
  where wi.id = p_wish_id
    and wi.couple_id = v_couple_id
    and wi.owner = v_actor
    and wi.status = 'visible'
    and wi.deleted_at is null;

  if not found then raise exception 'wish_not_deletable' using errcode = '42501'; end if;

  insert into public.wishlist_history
    (wish_id, actor_id, event_type, from_status, to_status, is_private)
  values
    (p_wish_id, v_actor, 'wish_deleted', 'visible', 'visible', false);
end;
$$;

create or replace function public.reserve_wishlist_item(p_wish_id bigint)
returns void
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_actor integer := app_private.current_app_user_id();
  v_couple_id bigint := app_private.current_couple_id();
  v_wish public.wishlist_items%rowtype;
begin
  if v_actor is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if v_couple_id is null then raise exception 'couple_membership_required' using errcode = '42501'; end if;

  select * into v_wish
  from public.wishlist_items wi
  where wi.id = p_wish_id
    and wi.couple_id = v_couple_id
    and wi.deleted_at is null
  for update;

  if not found then raise exception 'wish_not_found' using errcode = 'P0002'; end if;
  if v_wish.is_shared then raise exception 'shared_wish_not_reservable' using errcode = '42501'; end if;
  if v_wish.owner = v_actor then raise exception 'cannot_reserve_own_wish' using errcode = '42501'; end if;
  if v_wish.status <> 'visible' then raise exception 'wish_not_reservable'; end if;

  insert into public.wishlist_reservations (wish_id, partner_id)
  values (p_wish_id, v_actor);

  update public.wishlist_items wi
  set status = 'reserved', reserved = true, reserved_by = v_actor,
      version = wi.version + 1, updated_at = now()
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
  v_couple_id bigint := app_private.current_couple_id();
  v_wish public.wishlist_items%rowtype;
begin
  if v_actor is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if v_couple_id is null then raise exception 'couple_membership_required' using errcode = '42501'; end if;

  select * into v_wish
  from public.wishlist_items wi
  where wi.id = p_wish_id
    and wi.couple_id = v_couple_id
    and wi.deleted_at is null
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
  v_couple_id bigint := app_private.current_couple_id();
begin
  if v_actor is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if v_couple_id is null then raise exception 'couple_membership_required' using errcode = '42501'; end if;

  update public.wishlist_items wi
  set status = 'purchased', version = wi.version + 1, updated_at = now()
  where wi.id = p_wish_id
    and wi.couple_id = v_couple_id
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
  v_couple_id bigint := app_private.current_couple_id();
begin
  if v_actor is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if v_couple_id is null then raise exception 'couple_membership_required' using errcode = '42501'; end if;

  update public.wishlist_items wi
  set status = 'preparing_surprise', version = wi.version + 1, updated_at = now()
  where wi.id = p_wish_id
    and wi.couple_id = v_couple_id
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
  v_couple_id bigint := app_private.current_couple_id();
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
  if v_couple_id is null then raise exception 'couple_membership_required' using errcode = '42501'; end if;

  select id, wish_id, completed_by
    into v_completion_id, v_existing_wish_id, v_existing_actor
  from public.wishlist_gift_completions
  where idempotency_key = p_idempotency_key;

  if found then
    if v_existing_wish_id <> p_wish_id or v_existing_actor <> v_actor then
      raise exception 'idempotency_key_conflict' using errcode = '23505';
    end if;
    if not exists (
      select 1 from public.wishlist_items wi
      where wi.id = v_existing_wish_id and wi.couple_id = v_couple_id
    ) then
      raise exception 'wish_not_found' using errcode = 'P0002';
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
  where wi.id = p_wish_id
    and wi.couple_id = v_couple_id
    and wi.deleted_at is null
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

revoke all on function public.update_wishlist_item_collaborative_v3(bigint,bigint,text,text,text,text,numeric,text) from public, anon;
revoke all on function public.move_wishlist_item_v3(bigint,integer,boolean) from public, anon;
revoke all on function public.soft_delete_wishlist_item_v3(bigint) from public, anon;
revoke all on function public.reserve_wishlist_item(bigint) from public, anon;
revoke all on function public.cancel_wishlist_reservation(bigint) from public, anon;
revoke all on function public.mark_wishlist_purchased(bigint) from public, anon;
revoke all on function public.mark_wishlist_preparing(bigint) from public, anon;
revoke all on function public.complete_wishlist_gift(bigint,uuid,text,text,text) from public, anon;

grant execute on function public.update_wishlist_item_collaborative_v3(bigint,bigint,text,text,text,text,numeric,text) to authenticated;
grant execute on function public.move_wishlist_item_v3(bigint,integer,boolean) to authenticated;
grant execute on function public.soft_delete_wishlist_item_v3(bigint) to authenticated;
grant execute on function public.reserve_wishlist_item(bigint) to authenticated;
grant execute on function public.cancel_wishlist_reservation(bigint) to authenticated;
grant execute on function public.mark_wishlist_purchased(bigint) to authenticated;
grant execute on function public.mark_wishlist_preparing(bigint) to authenticated;
grant execute on function public.complete_wishlist_gift(bigint,uuid,text,text,text) to authenticated;

commit;
