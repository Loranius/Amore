-- Wishlist manual image presentation preferences.
--
-- Preferences are derived presentation state. Standalone changes and forced
-- reprocessing do not increment the collaborative domain version.

begin;

alter table public.wishlist_items
  add column if not exists image_preference text not null default 'auto',
  add column if not exists image_processing_revision bigint not null default 0;

alter table public.wishlist_items
  drop constraint if exists wishlist_items_image_preference_check;

alter table public.wishlist_items
  add constraint wishlist_items_image_preference_check
  check (image_preference in ('auto', 'product-cutout', 'portrait-cutout', 'photo-cover'));

alter table public.wishlist_items
  drop constraint if exists wishlist_items_image_processing_revision_check;

alter table public.wishlist_items
  add constraint wishlist_items_image_processing_revision_check
  check (image_processing_revision >= 0);

-- Updated read contract.
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
  image_preference text,
  image_processing_revision bigint,
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
    wi.image_preference,
    wi.image_processing_revision,
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

-- Standalone preference/reprocess command. It changes only presentation state.
create or replace function public.set_wishlist_image_preference_v3(
  p_wish_id bigint,
  p_source_image_url text,
  p_image_preference text,
  p_force_reprocess boolean default false
)
returns bigint
language plpgsql
security definer
set search_path = public, app_private, pg_catalog
as $$
declare
  v_actor integer := app_private.current_app_user_id();
  v_couple_id bigint := app_private.current_couple_id();
  v_source text := nullif(btrim(p_source_image_url), '');
  v_preference text := nullif(btrim(p_image_preference), '');
  v_existing_image_url text;
  v_existing_preference text;
  v_should_reset boolean;
  v_revision bigint;
begin
  if v_actor is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if v_couple_id is null then raise exception 'couple_membership_required' using errcode = '42501'; end if;
  if v_source is null then raise exception 'image_preference_source_required' using errcode = '22023'; end if;
  if v_preference not in ('auto', 'product-cutout', 'portrait-cutout', 'photo-cover') then
    raise exception 'invalid_image_preference' using errcode = '22023';
  end if;

  select wi.image_url, wi.image_preference
  into v_existing_image_url, v_existing_preference
  from public.wishlist_items wi
  where wi.id = p_wish_id
    and wi.couple_id = v_couple_id
    and wi.deleted_at is null
  for update;

  if not found then raise exception 'wish_not_found' using errcode = 'P0002'; end if;
  if v_existing_image_url is distinct from v_source then
    raise exception 'image_preference_source_changed' using errcode = '40001';
  end if;

  v_should_reset := v_existing_preference is distinct from v_preference
    or coalesce(p_force_reprocess, false);

  update public.wishlist_items wi
  set image_preference = v_preference,
      processed_image_url = case when v_should_reset then null else wi.processed_image_url end,
      image_mode = case when v_should_reset then null else wi.image_mode end,
      image_processing_revision = case
        when v_should_reset then wi.image_processing_revision + 1
        else wi.image_processing_revision
      end
  where wi.id = p_wish_id
  returning wi.image_processing_revision into v_revision;

  return v_revision;
end;
$$;

revoke all on function public.set_wishlist_image_preference_v3(bigint, text, text, boolean)
  from public, anon;
grant execute on function public.set_wishlist_image_preference_v3(bigint, text, text, boolean)
  to authenticated;

-- Persisted results must be compatible with the current manual preference.
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
  v_preference text;
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
  elsif v_processed is null
    or char_length(v_processed) > 2048
    or v_processed !~ '^https://[a-z0-9-]+[.]supabase[.]co/storage/v1/object/public/wishlist-photos/'
  then
    raise exception 'invalid_processed_image_url' using errcode = '22023';
  end if;

  select wi.image_preference into v_preference
  from public.wishlist_items wi
  where wi.id = p_wish_id
    and wi.couple_id = v_couple_id
    and wi.deleted_at is null
    and wi.image_url is not distinct from v_source;

  if not found then
    if exists (
      select 1 from public.wishlist_items wi
      where wi.id = p_wish_id
        and wi.couple_id = v_couple_id
        and wi.deleted_at is null
    ) then
      raise exception 'processed_image_source_changed' using errcode = '40001';
    end if;
    raise exception 'wish_not_found' using errcode = 'P0002';
  end if;

  if (v_preference = 'photo-cover' and v_mode <> 'photo-cover')
    or (v_preference = 'product-cutout' and v_mode not in ('product-cutout', 'photo-cover'))
    or (v_preference = 'portrait-cutout' and v_mode not in ('portrait-cutout', 'photo-cover'))
  then
    raise exception 'processed_image_mode_mismatch' using errcode = '22023';
  end if;

  update public.wishlist_items wi
  set processed_image_url = v_processed,
      image_mode = v_mode
  where wi.id = p_wish_id;
end;
$$;

revoke all on function public.set_wishlist_processed_image_v3(bigint, text, text, text)
  from public, anon;
grant execute on function public.set_wishlist_processed_image_v3(bigint, text, text, text)
  to authenticated;

-- Atomic create wrapper preserving the stable v3 idempotency contract.
create or replace function public.create_wishlist_item_idempotent_v4(
  p_request_id uuid,
  p_title text,
  p_owner_id integer,
  p_is_shared boolean default false,
  p_description text default null,
  p_link text default null,
  p_image_url text default null,
  p_price numeric default null,
  p_priority text default null,
  p_image_preference text default 'auto'
)
returns bigint
language plpgsql
security definer
set search_path = public, app_private, pg_catalog
as $$
declare
  v_actor integer := app_private.current_app_user_id();
  v_couple_id bigint := app_private.current_couple_id();
  v_id bigint;
  v_image_url text := nullif(btrim(p_image_url), '');
  v_preference text := case
    when nullif(btrim(p_image_url), '') is null then 'auto'
    else nullif(btrim(p_image_preference), '')
  end;
begin
  if v_actor is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if v_couple_id is null then raise exception 'couple_membership_required' using errcode = '42501'; end if;
  if v_preference not in ('auto', 'product-cutout', 'portrait-cutout', 'photo-cover') then
    raise exception 'invalid_image_preference' using errcode = '22023';
  end if;

  v_id := public.create_wishlist_item_idempotent_v3(
    p_request_id,
    p_title,
    p_owner_id,
    p_is_shared,
    p_description,
    p_link,
    v_image_url,
    p_price,
    p_priority
  );

  update public.wishlist_items wi
  set image_preference = v_preference
  where wi.id = v_id
    and wi.couple_id = v_couple_id
    and wi.created_by = v_actor
    and wi.image_preference in ('auto', v_preference);

  if not found then raise exception 'create_request_conflict' using errcode = '23505'; end if;
  return v_id;
end;
$$;

revoke all on function public.create_wishlist_item_idempotent_v4(
  uuid, text, integer, boolean, text, text, text, numeric, text, text
) from public, anon;
grant execute on function public.create_wishlist_item_idempotent_v4(
  uuid, text, integer, boolean, text, text, text, numeric, text, text
) to authenticated;

-- Atomic collaborative update wrapper. Domain fields increment version once;
-- preference changes clear only the derived cache.
create or replace function public.update_wishlist_item_collaborative_v4(
  p_wish_id bigint,
  p_expected_version bigint,
  p_title text,
  p_description text default null,
  p_link text default null,
  p_image_url text default null,
  p_price numeric default null,
  p_priority text default null,
  p_image_preference text default 'auto'
)
returns bigint
language plpgsql
security definer
set search_path = public, app_private, pg_catalog
as $$
declare
  v_couple_id bigint := app_private.current_couple_id();
  v_new_version bigint;
  v_preference text := case
    when nullif(btrim(p_image_url), '') is null then 'auto'
    else nullif(btrim(p_image_preference), '')
  end;
begin
  if v_couple_id is null then raise exception 'couple_membership_required' using errcode = '42501'; end if;
  if v_preference not in ('auto', 'product-cutout', 'portrait-cutout', 'photo-cover') then
    raise exception 'invalid_image_preference' using errcode = '22023';
  end if;

  v_new_version := public.update_wishlist_item_collaborative_v3(
    p_wish_id,
    p_expected_version,
    p_title,
    p_description,
    p_link,
    p_image_url,
    p_price,
    p_priority
  );

  update public.wishlist_items wi
  set processed_image_url = case
        when wi.image_preference is distinct from v_preference then null
        else wi.processed_image_url
      end,
      image_mode = case
        when wi.image_preference is distinct from v_preference then null
        else wi.image_mode
      end,
      image_processing_revision = case
        when wi.image_preference is distinct from v_preference then wi.image_processing_revision + 1
        else wi.image_processing_revision
      end,
      image_preference = v_preference
  where wi.id = p_wish_id
    and wi.couple_id = v_couple_id;

  if not found then raise exception 'wish_not_editable' using errcode = '42501'; end if;
  return v_new_version;
end;
$$;

revoke all on function public.update_wishlist_item_collaborative_v4(
  bigint, bigint, text, text, text, text, numeric, text, text
) from public, anon;
grant execute on function public.update_wishlist_item_collaborative_v4(
  bigint, bigint, text, text, text, text, numeric, text, text
) to authenticated;

commit;
