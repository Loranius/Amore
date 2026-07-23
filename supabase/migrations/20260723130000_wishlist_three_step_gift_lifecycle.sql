-- Simplify the personal gift lifecycle to:
-- visible -> reserved -> purchased -> archived.
--
-- preparing_surprise remains accepted only so older in-flight gifts can still
-- be completed safely. The new client no longer creates that state.

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
set search_path to 'public', 'app_private'
as $function$
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
    if v_wish.status not in ('purchased', 'preparing_surprise') then
      raise exception 'wish_not_completable';
    end if;
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
      (p_wish_id, v_actor, 'gift_completed', v_wish.status, 'gifted', jsonb_build_object('completion_id', v_completion_id), false),
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
$function$;

comment on function public.complete_wishlist_gift(bigint, uuid, text, text, text)
is 'Completes shared wishes from visible and personal gifts directly from purchased; accepts preparing_surprise for legacy compatibility.';
