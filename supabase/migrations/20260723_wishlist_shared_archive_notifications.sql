-- Shared Wishlist archive, exact Storage read access and inbox events.
--
-- Couple scoping is introduced in the next migration. This contract preserves
-- the current two-user application while ensuring media is readable only when
-- its exact path is committed to a completion record.

begin;

create or replace function public.get_shared_wishlist_archive_v3()
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
  where wi.is_shared
    and wi.fulfilled
    and wi.status = 'archived'
    and wi.deleted_at is null
  order by coalesce(wgc.completed_at, wi.fulfilled_at) desc nulls last, wi.id desc;
end;
$$;

revoke all on function public.get_shared_wishlist_archive_v3()
  from public, anon;
grant execute on function public.get_shared_wishlist_archive_v3()
  to authenticated;

-- Uploader can read their own pending path. Any authenticated participant may
-- read an exact committed path of a shared wish; personal memories remain
-- restricted to the receiver/owner and uploader.
create or replace function public.wishlist_memory_read_allowed(p_name text)
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

  begin
    v_wish_id := v_parts[2]::bigint;
  exception when others then
    return false;
  end;

  if v_parts[1] = v_actor::text then
    return true;
  end if;

  return exists (
    select 1
    from public.wishlist_items wi
    join public.wishlist_gift_completions wgc on wgc.wish_id = wi.id
    where wi.id = v_wish_id
      and wi.deleted_at is null
      and (wi.owner = v_actor or wi.is_shared)
      and (wgc.reaction_photo = p_name or wgc.reaction_video = p_name)
  );
end;
$$;

revoke all on function public.wishlist_memory_read_allowed(text)
  from public, anon;
grant execute on function public.wishlist_memory_read_allowed(text)
  to authenticated;

alter table public.app_notifications
  drop constraint if exists app_notifications_kind_check;

alter table public.app_notifications
  add constraint app_notifications_kind_check check (kind in (
    'wishlist_new_wish',
    'wishlist_shared_wish',
    'wishlist_gift_completed',
    'wishlist_gift_memory',
    'wishlist_shared_completed'
  ));

create or replace function app_private.emit_wishlist_notification()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_title text;
  v_owner integer;
  v_shared boolean;
  v_recipient integer;
  v_href text;
  v_notification_title text;
  v_has_memory boolean;
begin
  if coalesce(new.is_private, false) or new.actor_id is null then
    return new;
  end if;

  if new.event_type not in (
    'wish_created',
    'wish_moved',
    'gift_completed',
    'gift_memory_created',
    'shared_wish_completed'
  ) then
    return new;
  end if;

  select wi.title, wi.owner, wi.is_shared
    into v_title, v_owner, v_shared
  from public.wishlist_items wi
  where wi.id = new.wish_id
    and wi.deleted_at is null;

  if not found then
    return new;
  end if;

  if new.event_type = 'wish_created' then
    for v_recipient in
      select u.id from public.users u where u.id <> new.actor_id
    loop
      if v_shared then
        v_href := '/wishlist?tab=shared';
        v_notification_title := 'Нове спільне бажання';
      elsif v_owner = v_recipient then
        v_href := '/wishlist?tab=me';
        v_notification_title := 'Партнер додав бажання для тебе';
      else
        v_href := '/wishlist?tab=partner';
        v_notification_title := 'У партнера нове бажання';
      end if;

      perform app_private.enqueue_app_notification(
        v_recipient,
        new.actor_id,
        case when v_shared then 'wishlist_shared_wish' else 'wishlist_new_wish' end,
        v_notification_title,
        v_title,
        v_href,
        new.wish_id,
        format('wishlist:%s:%s', new.event_type, new.id)
      );
    end loop;

  elsif new.event_type = 'wish_moved' then
    if not coalesce((new.metadata ->> 'is_shared')::boolean, false) then
      return new;
    end if;

    for v_recipient in
      select u.id from public.users u where u.id <> new.actor_id
    loop
      perform app_private.enqueue_app_notification(
        v_recipient,
        new.actor_id,
        'wishlist_shared_wish',
        'Бажання стало спільним',
        v_title,
        '/wishlist?tab=shared',
        new.wish_id,
        format('wishlist:%s:%s', new.event_type, new.id)
      );
    end loop;

  elsif new.event_type = 'shared_wish_completed' then
    for v_recipient in
      select u.id from public.users u where u.id <> new.actor_id
    loop
      perform app_private.enqueue_app_notification(
        v_recipient,
        new.actor_id,
        'wishlist_shared_completed',
        'Спільну мрію виконано ✨',
        v_title,
        '/wishlist?tab=shared&archive=1',
        new.wish_id,
        format('wishlist:%s:%s', new.event_type, new.id)
      );
    end loop;

  elsif new.event_type = 'gift_completed' then
    perform app_private.enqueue_app_notification(
      v_owner,
      new.actor_id,
      'wishlist_gift_completed',
      'Подарунок вручено 🎁',
      v_title,
      '/wishlist?tab=me&archive=1',
      new.wish_id,
      format('wishlist:%s:%s', new.event_type, new.id)
    );

  elsif new.event_type = 'gift_memory_created' then
    -- Shared completion already emitted one focused inbox event. Avoid a second
    -- notification for the same action even when it contains media/comment.
    if coalesce((new.metadata ->> 'shared')::boolean, false) then
      return new;
    end if;

    v_has_memory :=
      coalesce((new.metadata ->> 'has_photo')::boolean, false)
      or coalesce((new.metadata ->> 'has_video')::boolean, false)
      or coalesce((new.metadata ->> 'has_comment')::boolean, false);

    if v_has_memory then
      perform app_private.enqueue_app_notification(
        v_owner,
        new.actor_id,
        'wishlist_gift_memory',
        'Новий спогад у Gift Archive',
        v_title,
        '/wishlist?tab=me&archive=1',
        new.wish_id,
        format('wishlist:%s:%s', new.event_type, new.id)
      );
    end if;
  end if;

  return new;
end;
$$;

revoke all on function app_private.emit_wishlist_notification()
  from public, anon, authenticated;

commit;
