-- Couple-scoped Wishlist reads, archives, Storage helpers and notifications.

begin;

-- Active Wishlist read contract ----------------------------------------------
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
    end,
    case
      when not wi.is_shared and wr.partner_id = v_actor and wr.active then v_actor
      else null
    end,
    wi.price,
    wi.priority::text,
    wi.status in ('gifted', 'archived'),
    case when wi.status in ('gifted', 'archived') then wi.fulfilled_by else null end,
    case when wi.status in ('gifted', 'archived') then wi.fulfilled_at else null end,
    case
      when not wi.is_shared
        and wi.owner = v_actor
        and wi.status in ('purchased', 'preparing_surprise')
        then 'reserved'::public.wishlist_status
      else wi.status
    end,
    wi.archived_at,
    wi.version,
    wi.status = 'visible' and (wi.owner = v_actor or wi.is_shared),
    wi.status = 'visible' and wi.owner = v_actor,
    wi.status = 'visible' and wi.owner = v_actor,
    wi.status = 'visible' and not wi.is_shared and wi.owner <> v_actor,
    wi.status = 'visible' and wi.is_shared,
    case when wi.is_shared then 'shared' else 'gift' end::text
  from public.wishlist_items wi
  left join public.wishlist_reservations wr
    on wr.wish_id = wi.id and wr.active
  where wi.couple_id = v_couple_id
    and wi.deleted_at is null
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

-- Couple statistics -----------------------------------------------------------
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
    count(*)::bigint,
    count(*) filter (where wi.status in ('gifted', 'archived'))::bigint,
    count(*) filter (
      where wi.status in ('gifted', 'archived')
        and wi.fulfilled_at >= date_trunc('year', now())
        and wi.fulfilled_at < date_trunc('year', now()) + interval '1 year'
    )::bigint,
    count(*) filter (
      where wi.status in ('gifted', 'archived')
        and wi.fulfilled_at >= date_trunc('month', now())
        and wi.fulfilled_at < date_trunc('month', now()) + interval '1 month'
    )::bigint
  from public.wishlist_items wi
  where wi.couple_id = v_couple_id
    and wi.deleted_at is null;
end;
$$;

revoke all on function public.get_wishlist_stats_v3() from public, anon;
grant execute on function public.get_wishlist_stats_v3() to authenticated;

-- Personal and Shared Archives ------------------------------------------------
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
  v_couple_id bigint := app_private.current_couple_id();
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if v_couple_id is null then
    raise exception 'couple_membership_required' using errcode = '42501';
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
    wgc.id::bigint,
    wgc.completed_at,
    wgc.reaction_photo,
    wgc.reaction_video,
    wgc.comment
  from public.wishlist_items wi
  left join public.wishlist_gift_completions wgc on wgc.wish_id = wi.id
  where wi.couple_id = v_couple_id
    and wi.owner = p_owner_id
    and not wi.is_shared
    and wi.fulfilled
    and wi.deleted_at is null
  order by coalesce(wgc.completed_at, wi.fulfilled_at) desc nulls last, wi.id desc;
end;
$$;

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
    wi.title,
    wi.description,
    wi.link,
    wi.image_url,
    wi.price,
    wi.priority::text,
    wi.fulfilled_at,
    wi.fulfilled_by,
    wgc.id::bigint,
    wgc.completed_at,
    wgc.reaction_photo,
    wgc.reaction_video,
    wgc.comment
  from public.wishlist_items wi
  left join public.wishlist_gift_completions wgc on wgc.wish_id = wi.id
  where wi.couple_id = v_couple_id
    and wi.is_shared
    and wi.fulfilled
    and wi.status = 'archived'
    and wi.deleted_at is null
  order by coalesce(wgc.completed_at, wi.fulfilled_at) desc nulls last, wi.id desc;
end;
$$;

revoke all on function public.get_fulfilled_wishlist_items_v3(integer)
  from public, anon;
revoke all on function public.get_shared_wishlist_archive_v3()
  from public, anon;
grant execute on function public.get_fulfilled_wishlist_items_v3(integer)
  to authenticated;
grant execute on function public.get_shared_wishlist_archive_v3()
  to authenticated;

-- Private Storage helpers -----------------------------------------------------
create or replace function public.wishlist_memory_upload_allowed(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, app_private
as $$
declare
  v_actor integer := app_private.current_app_user_id();
  v_couple_id bigint := app_private.current_couple_id();
  v_parts text[];
  v_wish_id bigint;
begin
  if v_actor is null or v_couple_id is null or p_name is null then return false; end if;

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
      and wi.couple_id = v_couple_id
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

create or replace function public.wishlist_memory_read_allowed(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, app_private
as $$
declare
  v_actor integer := app_private.current_app_user_id();
  v_couple_id bigint := app_private.current_couple_id();
  v_parts text[];
  v_wish_id bigint;
begin
  if v_actor is null or v_couple_id is null or p_name is null then return false; end if;

  v_parts := string_to_array(p_name, '/');
  if cardinality(v_parts) <> 4 then return false; end if;

  begin
    v_wish_id := v_parts[2]::bigint;
  exception when others then
    return false;
  end;

  return exists (
    select 1
    from public.wishlist_items wi
    left join public.wishlist_gift_completions wgc on wgc.wish_id = wi.id
    where wi.id = v_wish_id
      and wi.couple_id = v_couple_id
      and wi.deleted_at is null
      and (
        v_parts[1] = v_actor::text
        or (
          (wi.owner = v_actor or wi.is_shared)
          and (wgc.reaction_photo = p_name or wgc.reaction_video = p_name)
        )
      )
  );
end;
$$;

create or replace function public.wishlist_memory_delete_allowed(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, app_private
as $$
declare
  v_actor integer := app_private.current_app_user_id();
  v_couple_id bigint := app_private.current_couple_id();
  v_parts text[];
  v_wish_id bigint;
begin
  if v_actor is null or v_couple_id is null or p_name is null then return false; end if;

  v_parts := string_to_array(p_name, '/');
  if cardinality(v_parts) <> 4 or v_parts[1] <> v_actor::text then return false; end if;

  begin
    v_wish_id := v_parts[2]::bigint;
  exception when others then
    return false;
  end;

  return exists (
    select 1
    from public.wishlist_items wi
    where wi.id = v_wish_id
      and wi.couple_id = v_couple_id
      and wi.deleted_at is null
  ) and not exists (
    select 1
    from public.wishlist_gift_completions wgc
    where wgc.reaction_photo = p_name or wgc.reaction_video = p_name
  );
end;
$$;

revoke all on function public.wishlist_memory_upload_allowed(text) from public, anon;
revoke all on function public.wishlist_memory_read_allowed(text) from public, anon;
revoke all on function public.wishlist_memory_delete_allowed(text) from public, anon;
grant execute on function public.wishlist_memory_upload_allowed(text) to authenticated;
grant execute on function public.wishlist_memory_read_allowed(text) to authenticated;
grant execute on function public.wishlist_memory_delete_allowed(text) to authenticated;

-- Couple-scoped Wishlist inbox events ----------------------------------------
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
  v_couple_id bigint;
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

  select wi.title, wi.owner, wi.is_shared, wi.couple_id
    into v_title, v_owner, v_shared, v_couple_id
  from public.wishlist_items wi
  where wi.id = new.wish_id
    and wi.deleted_at is null;

  if not found then return new; end if;

  if new.event_type = 'wish_created' then
    for v_recipient in
      select cm.user_id
      from public.couple_members cm
      where cm.couple_id = v_couple_id
        and cm.user_id <> new.actor_id
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
        v_recipient, new.actor_id,
        case when v_shared then 'wishlist_shared_wish' else 'wishlist_new_wish' end,
        v_notification_title, v_title, v_href, new.wish_id,
        format('wishlist:%s:%s', new.event_type, new.id)
      );
    end loop;

  elsif new.event_type = 'wish_moved' then
    if not coalesce((new.metadata ->> 'is_shared')::boolean, false) then return new; end if;

    for v_recipient in
      select cm.user_id
      from public.couple_members cm
      where cm.couple_id = v_couple_id
        and cm.user_id <> new.actor_id
    loop
      perform app_private.enqueue_app_notification(
        v_recipient, new.actor_id, 'wishlist_shared_wish',
        'Бажання стало спільним', v_title, '/wishlist?tab=shared', new.wish_id,
        format('wishlist:%s:%s', new.event_type, new.id)
      );
    end loop;

  elsif new.event_type = 'shared_wish_completed' then
    for v_recipient in
      select cm.user_id
      from public.couple_members cm
      where cm.couple_id = v_couple_id
        and cm.user_id <> new.actor_id
    loop
      perform app_private.enqueue_app_notification(
        v_recipient, new.actor_id, 'wishlist_shared_completed',
        'Спільну мрію виконано ✨', v_title,
        '/wishlist?tab=shared&archive=1', new.wish_id,
        format('wishlist:%s:%s', new.event_type, new.id)
      );
    end loop;

  elsif new.event_type = 'gift_completed' then
    if app_private.user_in_couple(v_owner, v_couple_id) then
      perform app_private.enqueue_app_notification(
        v_owner, new.actor_id, 'wishlist_gift_completed',
        'Подарунок вручено 🎁', v_title,
        '/wishlist?tab=me&archive=1', new.wish_id,
        format('wishlist:%s:%s', new.event_type, new.id)
      );
    end if;

  elsif new.event_type = 'gift_memory_created' then
    if coalesce((new.metadata ->> 'shared')::boolean, false) then return new; end if;

    v_has_memory :=
      coalesce((new.metadata ->> 'has_photo')::boolean, false)
      or coalesce((new.metadata ->> 'has_video')::boolean, false)
      or coalesce((new.metadata ->> 'has_comment')::boolean, false);

    if v_has_memory and app_private.user_in_couple(v_owner, v_couple_id) then
      perform app_private.enqueue_app_notification(
        v_owner, new.actor_id, 'wishlist_gift_memory',
        'Новий спогад у Gift Archive', v_title,
        '/wishlist?tab=me&archive=1', new.wish_id,
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
