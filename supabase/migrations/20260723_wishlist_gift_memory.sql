-- Wishlist Gift Memory contract.
--
-- Keeps Wishlist independent from a future Memories module:
--   * completion media/comment live in wishlist_gift_completions;
--   * wishlist_history emits gift_memory_created as a domain event;
--   * a future Memories module may consume that event without Wishlist importing it.

begin;

-- Private media bucket. Files are accessed by short-lived signed URLs.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'wishlist-memories',
  'wishlist-memories',
  false,
  52428800,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create index if not exists wishlist_gift_completions_completed_by_idx
  on public.wishlist_gift_completions (completed_by, completed_at desc);

-- Completion is atomic and idempotent. Media fields store private bucket paths,
-- never public URLs. The required prefix binds every uploaded object to the
-- authenticated app user, wish and idempotency key.
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
    or v_photo !~ '/photo\.[a-z0-9]{2,5}$'
  ) then
    raise exception 'invalid_reaction_photo_path' using errcode = '22023';
  end if;

  if v_video is not null and (
    left(v_video, char_length(v_prefix)) <> v_prefix
    or v_video !~ '/video\.(mp4|webm|mov)$'
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

-- Return the received user's Gift Archive plus completion memory data.
-- Paths remain private; the client exchanges them for signed URLs.
drop function if exists public.get_fulfilled_wishlist_items_v3(integer);

create function public.get_fulfilled_wishlist_items_v3(p_owner_id integer)
returns table (
  id bigint,
  title text,
  description text,
  link text,
  image_url text,
  price numeric,
  priority text,
  fulfilled_at timestamptz,
  fulfilled_by integer,
  completion_id bigint,
  completed_at timestamptz,
  reaction_photo_path text,
  reaction_video_path text,
  memory_comment text
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

  if p_owner_id is distinct from v_actor then
    raise exception 'archive_not_allowed' using errcode = '42501';
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
    wi.fulfilled_by,
    wgc.id::bigint as completion_id,
    wgc.completed_at,
    wgc.reaction_photo as reaction_photo_path,
    wgc.reaction_video as reaction_video_path,
    wgc.comment as memory_comment
  from public.wishlist_items wi
  left join public.wishlist_gift_completions wgc
    on wgc.wish_id = wi.id
  where wi.owner = p_owner_id
    and wi.fulfilled = true
    and wi.deleted_at is null
  order by coalesce(wgc.completed_at, wi.fulfilled_at) desc nulls last, wi.id desc;
end;
$$;

revoke all on function public.get_fulfilled_wishlist_items_v3(integer)
  from public, anon;
grant execute on function public.get_fulfilled_wishlist_items_v3(integer)
  to authenticated;

commit;
