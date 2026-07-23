-- Wishlist Gift Memory path compatibility hotfix.
--
-- The retry-safe client uses deterministic names such as:
--   photo-deadbeef.webp
--   video-a1b2c3d4.mp4
-- Keep accepting the original photo.webp / video.mp4 names so already uploaded
-- objects and older clients remain compatible.

begin;

create or replace function app_private.wishlist_memory_filename_allowed(
  p_filename text,
  p_kind text
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select case p_kind
    when 'photo' then coalesce(
      p_filename ~* '^photo(-[0-9a-f]{8})?\.(jpg|jpeg|png|webp|avif|gif)$',
      false
    )
    when 'video' then coalesce(
      p_filename ~* '^video(-[0-9a-f]{8})?\.(mp4|webm|mov)$',
      false
    )
    else false
  end;
$$;

revoke all on function app_private.wishlist_memory_filename_allowed(text, text)
  from public, anon, authenticated;

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
  if v_actor is null or p_name is null then
    return false;
  end if;

  v_parts := string_to_array(p_name, '/');
  if cardinality(v_parts) <> 4 then
    return false;
  end if;

  if v_parts[1] <> v_actor::text then
    return false;
  end if;

  if v_parts[3] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;

  if not (
    app_private.wishlist_memory_filename_allowed(v_parts[4], 'photo')
    or app_private.wishlist_memory_filename_allowed(v_parts[4], 'video')
  ) then
    return false;
  end if;

  begin
    v_wish_id := v_parts[2]::bigint;
  exception when others then
    return false;
  end;

  return exists (
    select 1
    from public.wishlist_items wi
    join public.wishlist_reservations wr
      on wr.wish_id = wi.id
     and wr.active
     and wr.partner_id = v_actor
    where wi.id = v_wish_id
      and wi.status = 'preparing_surprise'
      and wi.deleted_at is null
  );
end;
$$;

revoke all on function public.wishlist_memory_upload_allowed(text)
  from public, anon;
grant execute on function public.wishlist_memory_upload_allowed(text)
  to authenticated;

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
  v_status public.wishlist_status;
  v_prefix text;
  v_photo text := nullif(btrim(p_reaction_photo), '');
  v_video text := nullif(btrim(p_reaction_video), '');
  v_comment text := nullif(btrim(p_comment), '');
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

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

  if v_comment is not null and char_length(v_comment) > 1000 then
    raise exception 'memory_comment_too_long';
  end if;

  if v_photo is not null and char_length(v_photo) > 500 then
    raise exception 'invalid_reaction_photo_path';
  end if;

  if v_video is not null and char_length(v_video) > 500 then
    raise exception 'invalid_reaction_video_path';
  end if;

  v_prefix := v_actor::text || '/' || p_wish_id::text || '/' || p_idempotency_key::text || '/';

  if v_photo is not null and (
    left(v_photo, char_length(v_prefix)) <> v_prefix
    or not app_private.wishlist_memory_filename_allowed(
      substr(v_photo, char_length(v_prefix) + 1),
      'photo'
    )
  ) then
    raise exception 'invalid_reaction_photo_path' using errcode = '22023';
  end if;

  if v_video is not null and (
    left(v_video, char_length(v_prefix)) <> v_prefix
    or not app_private.wishlist_memory_filename_allowed(
      substr(v_video, char_length(v_prefix) + 1),
      'video'
    )
  ) then
    raise exception 'invalid_reaction_video_path' using errcode = '22023';
  end if;

  select wi.status into v_status
  from public.wishlist_items wi
  where wi.id = p_wish_id and wi.deleted_at is null
  for update;

  if not found then
    raise exception 'wish_not_found' using errcode = 'P0002';
  end if;

  if v_status <> 'preparing_surprise' then
    raise exception 'wish_not_completable';
  end if;

  if not exists (
    select 1
    from public.wishlist_reservations wr
    where wr.wish_id = p_wish_id
      and wr.partner_id = v_actor
      and wr.active
  ) then
    raise exception 'reservation_not_owned' using errcode = '42501';
  end if;

  insert into public.wishlist_gift_completions (
    wish_id,
    completed_by,
    reaction_photo,
    reaction_video,
    comment,
    idempotency_key
  ) values (
    p_wish_id,
    v_actor,
    v_photo,
    v_video,
    v_comment,
    p_idempotency_key
  ) returning id into v_completion_id;

  update public.wishlist_reservations
  set active = false,
      cancelled_at = now(),
      updated_at = now()
  where wish_id = p_wish_id and active;

  update public.wishlist_items
  set status = 'archived',
      fulfilled = true,
      fulfilled_by = v_actor,
      fulfilled_at = now(),
      archived_at = now(),
      reserved = false,
      reserved_by = null,
      updated_at = now()
  where id = p_wish_id;

  insert into public.wishlist_history (
    wish_id,
    actor_id,
    event_type,
    from_status,
    to_status,
    metadata,
    is_private
  ) values
    (
      p_wish_id,
      v_actor,
      'gift_completed',
      'preparing_surprise',
      'gifted',
      jsonb_build_object('completion_id', v_completion_id),
      false
    ),
    (
      p_wish_id,
      v_actor,
      'wish_archived',
      'gifted',
      'archived',
      jsonb_build_object('completion_id', v_completion_id),
      false
    ),
    (
      p_wish_id,
      v_actor,
      'gift_memory_created',
      'archived',
      'archived',
      jsonb_build_object(
        'completion_id', v_completion_id,
        'has_photo', v_photo is not null,
        'has_video', v_video is not null,
        'has_comment', v_comment is not null
      ),
      false
    );

  return v_completion_id;
end;
$$;

revoke all on function public.complete_wishlist_gift(bigint, uuid, text, text, text)
  from public, anon;
grant execute on function public.complete_wishlist_gift(bigint, uuid, text, text, text)
  to authenticated;

comment on function app_private.wishlist_memory_filename_allowed(text, text) is
  'Accepts legacy Gift Memory names and retry-safe eight-hex fingerprint names.';

commit;
