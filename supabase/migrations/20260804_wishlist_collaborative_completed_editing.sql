-- Both members of a couple may browse each other's completed personal wishes
-- and collaboratively correct the details of visible or completed wishes.
begin;

create or replace function public.get_fulfilled_wishlist_items_v3(p_owner_id integer)
returns table(
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
  if not exists (
    select 1
    from public.couple_members cm
    where cm.couple_id = v_couple_id
      and cm.user_id = p_owner_id
  ) then
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
  v_status public.wishlist_status;
  v_is_shared boolean;
  v_image_url text := nullif(btrim(p_image_url), '');
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if v_couple_id is null then
    raise exception 'couple_membership_required' using errcode = '42501';
  end if;

  perform app_private.validate_wishlist_payload(
    p_title, p_description, p_link, p_image_url, p_price, p_priority
  );

  update public.wishlist_items wi
  set title = btrim(p_title),
      description = nullif(btrim(p_description), ''),
      link = nullif(btrim(p_link), ''),
      processed_image_url = case
        when wi.image_url is distinct from v_image_url then null
        else wi.processed_image_url
      end,
      image_mode = case
        when wi.image_url is distinct from v_image_url then null
        else wi.image_mode
      end,
      image_url = v_image_url,
      price = p_price,
      priority = p_priority,
      version = wi.version + 1,
      updated_at = now()
  where wi.id = p_wish_id
    and wi.couple_id = v_couple_id
    and wi.status in ('visible', 'gifted', 'archived')
    and wi.deleted_at is null
    and wi.version = p_expected_version
  returning wi.version, wi.status, wi.is_shared
  into v_new_version, v_status, v_is_shared;

  if not found then
    if exists (
      select 1
      from public.wishlist_items wi
      where wi.id = p_wish_id
        and wi.couple_id = v_couple_id
        and wi.status in ('visible', 'gifted', 'archived')
        and wi.deleted_at is null
    ) then
      raise exception 'wish_version_conflict' using errcode = '40001';
    end if;
    raise exception 'wish_not_editable' using errcode = '42501';
  end if;

  insert into public.wishlist_history (
    wish_id,
    actor_id,
    event_type,
    from_status,
    to_status,
    metadata,
    is_private
  ) values (
    p_wish_id,
    v_actor,
    'wish_updated',
    v_status,
    v_status,
    jsonb_build_object(
      'version', v_new_version,
      'shared', v_is_shared,
      'collaborative', true,
      'completed', v_status in ('gifted', 'archived')
    ),
    false
  );

  return v_new_version;
end;
$$;

comment on function public.get_fulfilled_wishlist_items_v3(integer)
  is 'Returns completed personal wishes for either member of the current couple.';

comment on function public.update_wishlist_item_collaborative_v3(
  bigint, bigint, text, text, text, text, numeric, text
) is 'Collaboratively edits visible or completed wishes with optimistic version checks.';

commit;
