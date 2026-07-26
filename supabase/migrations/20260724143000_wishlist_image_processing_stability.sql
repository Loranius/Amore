-- Wishlist image processing stabilization.
--
-- Adds a recoverable lease-based state machine around the existing on-device
-- cutout pipeline. Derived image state never increments the collaborative wish
-- version and never exposes raw processing errors.

begin;

alter table public.wishlist_items
  add column if not exists image_processing_status text not null default 'idle',
  add column if not exists image_processor_version integer not null default 0,
  add column if not exists image_processing_target_version integer,
  add column if not exists image_processing_attempts integer not null default 0,
  add column if not exists image_processing_started_at timestamptz,
  add column if not exists image_processing_completed_at timestamptz,
  add column if not exists image_processing_error_code text,
  add column if not exists image_processing_session_id uuid,
  add column if not exists image_processing_lease_expires_at timestamptz;

-- Existing persisted visuals were produced by processor v1. Rows without a
-- result become pending, while wishes without an image stay idle.
update public.wishlist_items wi
set image_processing_status = case
      when wi.image_url is null then 'idle'
      when wi.image_mode is not null then 'ready'
      else 'pending'
    end,
    image_processor_version = case when wi.image_mode is not null then 1 else 0 end,
    image_processing_target_version = null,
    image_processing_attempts = 0,
    image_processing_started_at = null,
    image_processing_completed_at = case when wi.image_mode is not null then now() else null end,
    image_processing_error_code = null,
    image_processing_session_id = null,
    image_processing_lease_expires_at = null;

alter table public.wishlist_items
  drop constraint if exists wishlist_items_image_processing_status_check;
alter table public.wishlist_items
  add constraint wishlist_items_image_processing_status_check
  check (image_processing_status in ('idle', 'pending', 'processing', 'ready', 'failed'));

alter table public.wishlist_items
  drop constraint if exists wishlist_items_image_processor_version_check;
alter table public.wishlist_items
  add constraint wishlist_items_image_processor_version_check
  check (image_processor_version >= 0);

alter table public.wishlist_items
  drop constraint if exists wishlist_items_image_processing_target_version_check;
alter table public.wishlist_items
  add constraint wishlist_items_image_processing_target_version_check
  check (image_processing_target_version is null or image_processing_target_version > 0);

alter table public.wishlist_items
  drop constraint if exists wishlist_items_image_processing_attempts_check;
alter table public.wishlist_items
  add constraint wishlist_items_image_processing_attempts_check
  check (image_processing_attempts >= 0);

alter table public.wishlist_items
  drop constraint if exists wishlist_items_image_processing_error_code_check;
alter table public.wishlist_items
  add constraint wishlist_items_image_processing_error_code_check
  check (
    image_processing_error_code is null
    or image_processing_error_code ~ '^[a-z0-9_]{1,64}$'
  );

alter table public.wishlist_items
  drop constraint if exists wishlist_items_image_processing_lease_state_check;
alter table public.wishlist_items
  add constraint wishlist_items_image_processing_lease_state_check
  check (
    (
      image_processing_status = 'processing'
      and image_processing_session_id is not null
      and image_processing_lease_expires_at is not null
      and image_processing_started_at is not null
      and image_processing_target_version is not null
    )
    or
    (
      image_processing_status <> 'processing'
      and image_processing_session_id is null
      and image_processing_lease_expires_at is null
    )
  );

alter table public.wishlist_items
  drop constraint if exists wishlist_items_image_processing_ready_check;
alter table public.wishlist_items
  add constraint wishlist_items_image_processing_ready_check
  check (image_processing_status <> 'ready' or image_mode is not null);

alter table public.wishlist_items
  drop constraint if exists wishlist_items_image_processing_failed_check;
alter table public.wishlist_items
  add constraint wishlist_items_image_processing_failed_check
  check (image_processing_status <> 'failed' or image_processing_error_code is not null);

-- Updated role-safe read contract.
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
  image_processing_status text,
  image_processor_version integer,
  image_processing_target_version integer,
  image_processing_attempts integer,
  image_processing_started_at timestamptz,
  image_processing_completed_at timestamptz,
  image_processing_error_code text,
  image_processing_lease_expires_at timestamptz,
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
    wi.image_processing_status,
    wi.image_processor_version,
    wi.image_processing_target_version,
    wi.image_processing_attempts,
    wi.image_processing_started_at,
    wi.image_processing_completed_at,
    wi.image_processing_error_code,
    wi.image_processing_lease_expires_at,
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

-- Preference changes and explicit reprocessing create a new processing revision.
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
      end,
      image_processing_status = case when v_should_reset then 'pending' else wi.image_processing_status end,
      image_processor_version = case when v_should_reset then 0 else wi.image_processor_version end,
      image_processing_target_version = case when v_should_reset then null else wi.image_processing_target_version end,
      image_processing_attempts = case when v_should_reset then 0 else wi.image_processing_attempts end,
      image_processing_started_at = case when v_should_reset then null else wi.image_processing_started_at end,
      image_processing_completed_at = case when v_should_reset then null else wi.image_processing_completed_at end,
      image_processing_error_code = case when v_should_reset then null else wi.image_processing_error_code end,
      image_processing_session_id = case when v_should_reset then null else wi.image_processing_session_id end,
      image_processing_lease_expires_at = case when v_should_reset then null else wi.image_processing_lease_expires_at end
  where wi.id = p_wish_id
  returning wi.image_processing_revision into v_revision;

  return v_revision;
end;
$$;

revoke all on function public.set_wishlist_image_preference_v3(bigint, text, text, boolean)
  from public, anon;
grant execute on function public.set_wishlist_image_preference_v3(bigint, text, text, boolean)
  to authenticated;

-- Backward-compatible create wrapper: new image rows start pending, retries of an
-- already-created request preserve a ready result.
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
  set image_preference = v_preference,
      image_processing_status = case
        when v_image_url is null then 'idle'
        when wi.image_preference is distinct from v_preference
          or wi.image_processing_status = 'idle' then 'pending'
        else wi.image_processing_status
      end,
      image_processor_version = case
        when v_image_url is null
          or wi.image_preference is distinct from v_preference
          or wi.image_processing_status = 'idle' then 0
        else wi.image_processor_version
      end,
      image_processing_target_version = case
        when v_image_url is null
          or wi.image_preference is distinct from v_preference
          or wi.image_processing_status = 'idle' then null
        else wi.image_processing_target_version
      end,
      image_processing_attempts = case
        when v_image_url is null
          or wi.image_preference is distinct from v_preference
          or wi.image_processing_status = 'idle' then 0
        else wi.image_processing_attempts
      end,
      image_processing_started_at = case
        when v_image_url is null
          or wi.image_preference is distinct from v_preference
          or wi.image_processing_status = 'idle' then null
        else wi.image_processing_started_at
      end,
      image_processing_completed_at = case
        when v_image_url is null
          or wi.image_preference is distinct from v_preference
          or wi.image_processing_status = 'idle' then null
        else wi.image_processing_completed_at
      end,
      image_processing_error_code = case
        when v_image_url is null
          or wi.image_preference is distinct from v_preference
          or wi.image_processing_status = 'idle' then null
        else wi.image_processing_error_code
      end,
      image_processing_session_id = case
        when v_image_url is null
          or wi.image_preference is distinct from v_preference
          or wi.image_processing_status = 'idle' then null
        else wi.image_processing_session_id
      end,
      image_processing_lease_expires_at = case
        when v_image_url is null
          or wi.image_preference is distinct from v_preference
          or wi.image_processing_status = 'idle' then null
        else wi.image_processing_lease_expires_at
      end
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

-- Collaborative domain edits preserve processing state unless the source image
-- or presentation preference changed.
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
  v_image_url text := nullif(btrim(p_image_url), '');
  v_preference text := case
    when nullif(btrim(p_image_url), '') is null then 'auto'
    else nullif(btrim(p_image_preference), '')
  end;
  v_old_image_url text;
  v_old_preference text;
  v_source_changed boolean;
  v_preference_changed boolean;
begin
  if v_couple_id is null then raise exception 'couple_membership_required' using errcode = '42501'; end if;
  if v_preference not in ('auto', 'product-cutout', 'portrait-cutout', 'photo-cover') then
    raise exception 'invalid_image_preference' using errcode = '22023';
  end if;

  select wi.image_url, wi.image_preference
  into v_old_image_url, v_old_preference
  from public.wishlist_items wi
  where wi.id = p_wish_id
    and wi.couple_id = v_couple_id
    and wi.deleted_at is null;

  v_source_changed := v_old_image_url is distinct from v_image_url;
  v_preference_changed := v_old_preference is distinct from v_preference;

  v_new_version := public.update_wishlist_item_collaborative_v3(
    p_wish_id,
    p_expected_version,
    p_title,
    p_description,
    p_link,
    v_image_url,
    p_price,
    p_priority
  );

  update public.wishlist_items wi
  set processed_image_url = case
        when v_source_changed or v_preference_changed then null
        else wi.processed_image_url
      end,
      image_mode = case
        when v_source_changed or v_preference_changed then null
        else wi.image_mode
      end,
      image_processing_revision = case
        when v_source_changed or v_preference_changed then wi.image_processing_revision + 1
        else wi.image_processing_revision
      end,
      image_preference = v_preference,
      image_processing_status = case
        when v_image_url is null then 'idle'
        when v_source_changed or v_preference_changed then 'pending'
        else wi.image_processing_status
      end,
      image_processor_version = case
        when v_source_changed or v_preference_changed then 0
        else wi.image_processor_version
      end,
      image_processing_target_version = case
        when v_source_changed or v_preference_changed or v_image_url is null then null
        else wi.image_processing_target_version
      end,
      image_processing_attempts = case
        when v_source_changed or v_preference_changed or v_image_url is null then 0
        else wi.image_processing_attempts
      end,
      image_processing_started_at = case
        when v_source_changed or v_preference_changed or v_image_url is null then null
        else wi.image_processing_started_at
      end,
      image_processing_completed_at = case
        when v_source_changed or v_preference_changed or v_image_url is null then null
        else wi.image_processing_completed_at
      end,
      image_processing_error_code = case
        when v_source_changed or v_preference_changed or v_image_url is null then null
        else wi.image_processing_error_code
      end,
      image_processing_session_id = case
        when v_source_changed or v_preference_changed or v_image_url is null then null
        else wi.image_processing_session_id
      end,
      image_processing_lease_expires_at = case
        when v_source_changed or v_preference_changed or v_image_url is null then null
        else wi.image_processing_lease_expires_at
      end
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

-- Claim a two-minute processing lease. Fresh leases cannot be duplicated; a
-- stale lease can be reclaimed. Automatic retries stop after three failures for
-- the same revision and processor version.
create or replace function public.begin_wishlist_image_processing_v5(
  p_wish_id bigint,
  p_source_image_url text,
  p_image_preference text,
  p_processing_revision bigint,
  p_processor_version integer
)
returns table (
  session_id uuid,
  lease_expires_at timestamptz,
  should_process boolean,
  retry_after_ms integer,
  processing_status text
)
language plpgsql
security definer
set search_path = public, app_private, pg_catalog
as $$
declare
  v_actor integer := app_private.current_app_user_id();
  v_couple_id bigint := app_private.current_couple_id();
  v_source text := nullif(btrim(p_source_image_url), '');
  v_preference text := nullif(btrim(p_image_preference), '');
  v_wish public.wishlist_items%rowtype;
  v_now timestamptz := clock_timestamp();
  v_session uuid;
  v_lease timestamptz;
  v_retry_ms integer;
  v_attempts integer;
  v_result_compatible boolean;
begin
  if v_actor is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if v_couple_id is null then raise exception 'couple_membership_required' using errcode = '42501'; end if;
  if v_source is null then raise exception 'image_processing_source_required' using errcode = '22023'; end if;
  if v_preference not in ('auto', 'product-cutout', 'portrait-cutout', 'photo-cover') then
    raise exception 'invalid_image_preference' using errcode = '22023';
  end if;
  if p_processing_revision < 0 or p_processor_version <= 0 then
    raise exception 'invalid_image_processing_version' using errcode = '22023';
  end if;

  select * into v_wish
  from public.wishlist_items wi
  where wi.id = p_wish_id
    and wi.couple_id = v_couple_id
    and wi.deleted_at is null
  for update;

  if not found then raise exception 'wish_not_found' using errcode = 'P0002'; end if;
  if v_wish.image_url is distinct from v_source then
    raise exception 'image_processing_source_changed' using errcode = '40001';
  end if;
  if v_wish.image_preference is distinct from v_preference then
    raise exception 'image_processing_preference_changed' using errcode = '40001';
  end if;
  if v_wish.image_processing_revision is distinct from p_processing_revision then
    raise exception 'image_processing_revision_changed' using errcode = '40001';
  end if;

  v_result_compatible := v_wish.image_mode is not null
    and (
      v_preference = 'auto'
      or (v_preference = 'photo-cover' and v_wish.image_mode = 'photo-cover')
      or (v_preference = 'product-cutout' and v_wish.image_mode in ('product-cutout', 'photo-cover'))
      or (v_preference = 'portrait-cutout' and v_wish.image_mode in ('portrait-cutout', 'photo-cover'))
    )
    and (
      v_wish.image_mode = 'photo-cover'
      or v_wish.processed_image_url is not null
    );

  if v_wish.image_processing_status = 'ready'
    and v_wish.image_processor_version >= p_processor_version
    and v_result_compatible
  then
    return query select null::uuid, null::timestamptz, false, null::integer, 'ready'::text;
    return;
  end if;

  if v_wish.image_processing_status = 'processing'
    and v_wish.image_processing_lease_expires_at > v_now
  then
    v_retry_ms := greatest(
      ceil(extract(epoch from (v_wish.image_processing_lease_expires_at - v_now)) * 1000)::integer,
      750
    );
    return query select
      null::uuid,
      v_wish.image_processing_lease_expires_at,
      false,
      v_retry_ms,
      'processing'::text;
    return;
  end if;

  if v_wish.image_processing_status = 'failed'
    and v_wish.image_processing_target_version = p_processor_version
    and v_wish.image_processing_attempts >= 3
  then
    return query select null::uuid, null::timestamptz, false, null::integer, 'failed'::text;
    return;
  end if;

  v_session := gen_random_uuid();
  v_lease := v_now + interval '2 minutes';
  v_attempts := case
    when v_wish.image_processing_target_version is distinct from p_processor_version then 1
    else v_wish.image_processing_attempts + 1
  end;

  update public.wishlist_items wi
  set image_processing_status = 'processing',
      image_processing_target_version = p_processor_version,
      image_processing_attempts = v_attempts,
      image_processing_started_at = v_now,
      image_processing_completed_at = null,
      image_processing_error_code = null,
      image_processing_session_id = v_session,
      image_processing_lease_expires_at = v_lease
  where wi.id = p_wish_id;

  return query select v_session, v_lease, true, null::integer, 'processing'::text;
end;
$$;

revoke all on function public.begin_wishlist_image_processing_v5(bigint, text, text, bigint, integer)
  from public, anon;
grant execute on function public.begin_wishlist_image_processing_v5(bigint, text, text, bigint, integer)
  to authenticated;

-- Complete only the currently-owned lease. The previous processed URL is
-- returned so the client can remove it after the database commit. If the client
-- disappears, the existing orphan cleanup catches it after the grace period.
create or replace function public.complete_wishlist_image_processing_v5(
  p_wish_id bigint,
  p_source_image_url text,
  p_image_preference text,
  p_processing_revision bigint,
  p_processor_version integer,
  p_session_id uuid,
  p_processed_image_url text,
  p_image_mode text
)
returns text
language plpgsql
security definer
set search_path = public, app_private, pg_catalog
as $$
declare
  v_actor integer := app_private.current_app_user_id();
  v_couple_id bigint := app_private.current_couple_id();
  v_source text := nullif(btrim(p_source_image_url), '');
  v_preference text := nullif(btrim(p_image_preference), '');
  v_processed text := nullif(btrim(p_processed_image_url), '');
  v_mode text := nullif(btrim(p_image_mode), '');
  v_wish public.wishlist_items%rowtype;
  v_previous text;
begin
  if v_actor is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if v_couple_id is null then raise exception 'couple_membership_required' using errcode = '42501'; end if;
  if v_source is null or p_session_id is null then
    raise exception 'image_processing_session_required' using errcode = '22023';
  end if;
  if v_preference not in ('auto', 'product-cutout', 'portrait-cutout', 'photo-cover') then
    raise exception 'invalid_image_preference' using errcode = '22023';
  end if;
  if v_mode not in ('product-cutout', 'portrait-cutout', 'photo-cover') then
    raise exception 'invalid_processed_image_mode' using errcode = '22023';
  end if;
  if p_processing_revision < 0 or p_processor_version <= 0 then
    raise exception 'invalid_image_processing_version' using errcode = '22023';
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

  if (v_preference = 'photo-cover' and v_mode <> 'photo-cover')
    or (v_preference = 'product-cutout' and v_mode not in ('product-cutout', 'photo-cover'))
    or (v_preference = 'portrait-cutout' and v_mode not in ('portrait-cutout', 'photo-cover'))
  then
    raise exception 'processed_image_mode_mismatch' using errcode = '22023';
  end if;

  select * into v_wish
  from public.wishlist_items wi
  where wi.id = p_wish_id
    and wi.couple_id = v_couple_id
    and wi.deleted_at is null
  for update;

  if not found then raise exception 'wish_not_found' using errcode = 'P0002'; end if;
  if v_wish.image_url is distinct from v_source
    or v_wish.image_preference is distinct from v_preference
    or v_wish.image_processing_revision is distinct from p_processing_revision
  then
    raise exception 'image_processing_input_changed' using errcode = '40001';
  end if;
  if v_wish.image_processing_status <> 'processing'
    or v_wish.image_processing_session_id is distinct from p_session_id
    or v_wish.image_processing_target_version is distinct from p_processor_version
  then
    raise exception 'image_processing_lease_lost' using errcode = '40001';
  end if;

  v_previous := v_wish.processed_image_url;

  update public.wishlist_items wi
  set processed_image_url = v_processed,
      image_mode = v_mode,
      image_processing_status = 'ready',
      image_processor_version = p_processor_version,
      image_processing_target_version = null,
      image_processing_completed_at = clock_timestamp(),
      image_processing_error_code = null,
      image_processing_session_id = null,
      image_processing_lease_expires_at = null
  where wi.id = p_wish_id;

  return v_previous;
end;
$$;

revoke all on function public.complete_wishlist_image_processing_v5(
  bigint, text, text, bigint, integer, uuid, text, text
) from public, anon;
grant execute on function public.complete_wishlist_image_processing_v5(
  bigint, text, text, bigint, integer, uuid, text, text
) to authenticated;

-- Record only a bounded non-sensitive error code. A previous usable result is
-- preserved; automatic retries stop after the third failure for this target.
create or replace function public.fail_wishlist_image_processing_v5(
  p_wish_id bigint,
  p_source_image_url text,
  p_image_preference text,
  p_processing_revision bigint,
  p_processor_version integer,
  p_session_id uuid,
  p_error_code text
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
  v_preference text := nullif(btrim(p_image_preference), '');
  v_error text := nullif(btrim(p_error_code), '');
  v_wish public.wishlist_items%rowtype;
begin
  if v_actor is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if v_couple_id is null then raise exception 'couple_membership_required' using errcode = '42501'; end if;
  if v_source is null or p_session_id is null then
    raise exception 'image_processing_session_required' using errcode = '22023';
  end if;
  if v_preference not in ('auto', 'product-cutout', 'portrait-cutout', 'photo-cover') then
    raise exception 'invalid_image_preference' using errcode = '22023';
  end if;
  if p_processing_revision < 0 or p_processor_version <= 0 then
    raise exception 'invalid_image_processing_version' using errcode = '22023';
  end if;
  if v_error is null or v_error !~ '^[a-z0-9_]{1,64}$' then
    raise exception 'invalid_image_processing_error_code' using errcode = '22023';
  end if;

  select * into v_wish
  from public.wishlist_items wi
  where wi.id = p_wish_id
    and wi.couple_id = v_couple_id
    and wi.deleted_at is null
  for update;

  if not found then raise exception 'wish_not_found' using errcode = 'P0002'; end if;
  if v_wish.image_url is distinct from v_source
    or v_wish.image_preference is distinct from v_preference
    or v_wish.image_processing_revision is distinct from p_processing_revision
  then
    raise exception 'image_processing_input_changed' using errcode = '40001';
  end if;
  if v_wish.image_processing_status <> 'processing'
    or v_wish.image_processing_session_id is distinct from p_session_id
    or v_wish.image_processing_target_version is distinct from p_processor_version
  then
    raise exception 'image_processing_lease_lost' using errcode = '40001';
  end if;

  update public.wishlist_items wi
  set image_processing_status = 'failed',
      image_processing_completed_at = clock_timestamp(),
      image_processing_error_code = v_error,
      image_processing_session_id = null,
      image_processing_lease_expires_at = null
  where wi.id = p_wish_id;
end;
$$;

revoke all on function public.fail_wishlist_image_processing_v5(
  bigint, text, text, bigint, integer, uuid, text
) from public, anon;
grant execute on function public.fail_wishlist_image_processing_v5(
  bigint, text, text, bigint, integer, uuid, text
) to authenticated;

-- Compatibility for cached older clients that still persist without a lease.
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
      image_mode = v_mode,
      image_processing_status = 'ready',
      image_processor_version = greatest(wi.image_processor_version, 1),
      image_processing_target_version = null,
      image_processing_attempts = greatest(wi.image_processing_attempts, 1),
      image_processing_started_at = coalesce(wi.image_processing_started_at, clock_timestamp()),
      image_processing_completed_at = clock_timestamp(),
      image_processing_error_code = null,
      image_processing_session_id = null,
      image_processing_lease_expires_at = null
  where wi.id = p_wish_id;
end;
$$;

revoke all on function public.set_wishlist_processed_image_v3(bigint, text, text, text)
  from public, anon;
grant execute on function public.set_wishlist_processed_image_v3(bigint, text, text, text)
  to authenticated;

commit;
