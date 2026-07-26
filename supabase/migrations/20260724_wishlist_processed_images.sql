-- Persisted Wishlist image presentation cache.
--
-- Derived images do not participate in the collaborative domain version. The
-- cache is valid only while the original image_url is unchanged.

begin;

alter table public.wishlist_items
  add column if not exists processed_image_url text,
  add column if not exists image_mode text;

alter table public.wishlist_items
  drop constraint if exists wishlist_items_image_mode_check;

alter table public.wishlist_items
  add constraint wishlist_items_image_mode_check
  check (image_mode is null or image_mode in ('product-cutout', 'portrait-cutout', 'photo-cover'));

alter table public.wishlist_items
  drop constraint if exists wishlist_items_processed_image_consistency_check;

alter table public.wishlist_items
  add constraint wishlist_items_processed_image_consistency_check
  check (
    (image_mode is null and processed_image_url is null)
    or (image_mode = 'photo-cover' and processed_image_url is null)
    or (image_mode in ('product-cutout', 'portrait-cutout') and processed_image_url is not null)
  );

-- Read contract: expose the persisted visual cache without exposing any new
-- private lifecycle information.
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
  processed_image_url text,
  image_mode text,
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
  if v_actor is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if v_couple_id is null then raise exception 'couple_membership_required' using errcode = '42501'; end if;

  return query
  select
    wi.id::bigint,
    wi.title,
    wi.description,
    wi.link,
    wi.image_url,
    wi.processed_image_url,
    wi.image_mode,
    wi.gift_date,
    wi.owner,
    wi.is_shared,
    case when wi.is_shared then false else wi.status in ('reserved','purchased','preparing_surprise') end,
    case when not wi.is_shared and wr.partner_id = v_actor and wr.active then v_actor else null end,
    wi.price,
    wi.priority::text,
    wi.status in ('gifted','archived'),
    case when wi.status in ('gifted','archived') then wi.fulfilled_by else null end,
    case when wi.status in ('gifted','archived') then wi.fulfilled_at else null end,
    case when not wi.is_shared and wi.owner = v_actor and wi.status in ('purchased','preparing_surprise')
      then 'reserved'::public.wishlist_status else wi.status end,
    wi.archived_at,
    wi.version,
    wi.status = 'visible' and (wi.owner = v_actor or wi.is_shared),
    wi.status = 'visible' and wi.owner = v_actor,
    wi.status = 'visible' and wi.owner = v_actor,
    wi.status = 'visible' and not wi.is_shared and wi.owner <> v_actor,
    wi.status = 'visible' and wi.is_shared,
    case when wi.is_shared then 'shared' else 'gift' end::text
  from public.wishlist_items wi
  left join public.wishlist_reservations wr on wr.wish_id = wi.id and wr.active
  where wi.couple_id = v_couple_id
    and wi.deleted_at is null
    and ((p_shared and wi.is_shared) or (not p_shared and not wi.is_shared and wi.owner = p_owner_id))
    and (p_include_archived or wi.status not in ('gifted','archived'))
  order by wi.id desc;
end;
$$;

revoke all on function public.get_wishlist_items_v3(integer, boolean, boolean)
  from public, anon;
grant execute on function public.get_wishlist_items_v3(integer, boolean, boolean)
  to authenticated;

-- Derived cache command. It deliberately does not increment version or write a
-- domain history event. The source URL guard prevents a slow processing result
-- from attaching to a wish whose original photo has already changed.
create or replace function public.set_wishlist_processed_image_v3(
  p_wish_id bigint,
  p_source_image_url text,
  p_processed_image_url text,
  p_image_mode text
)
returns void
language plpgsql
security definer
set search_path = public, app_private, pg_catalog
as $$
declare
  v_actor integer := app_private.current_app_user_id();
  v_couple_id bigint := app_private.current_couple_id();
  v_source text := nullif(btrim(p_source_image_url), '');
  v_processed text := nullif(btrim(p_processed_image_url), '');
  v_mode text := nullif(btrim(p_image_mode), '');
begin
  if v_actor is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if v_couple_id is null then raise exception 'couple_membership_required' using errcode = '42501'; end if;
  if v_source is null then raise exception 'processed_image_source_required' using errcode = '22023'; end if;
  if v_mode not in ('product-cutout', 'portrait-cutout', 'photo-cover') then
    raise exception 'invalid_processed_image_mode' using errcode = '22023';
  end if;

  if v_mode = 'photo-cover' then
    if v_processed is not null then
      raise exception 'photo_cover_must_not_have_processed_url' using errcode = '22023';
    end if;
  else
    if v_processed is null
      or char_length(v_processed) > 2048
      or v_processed !~ '^https://[a-z0-9-]+[.]supabase[.]co/storage/v1/object/public/wishlist-photos/'
    then
      raise exception 'invalid_processed_image_url' using errcode = '22023';
    end if;
  end if;

  update public.wishlist_items wi
  set processed_image_url = v_processed,
      image_mode = v_mode
  where wi.id = p_wish_id
    and wi.couple_id = v_couple_id
    and wi.deleted_at is null
    and wi.image_url is not distinct from v_source;

  if not found then
    if exists (
      select 1
      from public.wishlist_items wi
      where wi.id = p_wish_id
        and wi.couple_id = v_couple_id
        and wi.deleted_at is null
    ) then
      raise exception 'processed_image_source_changed' using errcode = '40001';
    end if;
    raise exception 'wish_not_found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.set_wishlist_processed_image_v3(bigint, text, text, text)
  from public, anon;
grant execute on function public.set_wishlist_processed_image_v3(bigint, text, text, text)
  to authenticated;

-- Collaborative edits invalidate the derived cache only when image_url changes.
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
  v_image_url text := nullif(btrim(p_image_url), '');
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

revoke all on function public.update_wishlist_item_collaborative_v3(
  bigint, bigint, text, text, text, text, numeric, text
) from public, anon;
grant execute on function public.update_wishlist_item_collaborative_v3(
  bigint, bigint, text, text, text, text, numeric, text
) to authenticated;

-- Legacy owner-only update receives the same invalidation semantics.
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
  v_image_url text := nullif(btrim(p_image_url), '');
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

revoke all on function public.update_wishlist_item_v3(
  bigint, text, text, text, text, numeric, text
) from public, anon;
grant execute on function public.update_wishlist_item_v3(
  bigint, text, text, text, text, numeric, text
) to authenticated;

commit;
