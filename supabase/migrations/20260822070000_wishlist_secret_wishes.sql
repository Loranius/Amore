-- Secret Wishlist wishes.
--
-- Privacy is enforced in PostgreSQL, not by a browser-side filter:
--   * the legacy pair-visible read RPC never returns secret rows;
--   * the secret read RPC derives the creator from the authenticated session;
--   * secret rows must remain personal and owned by their creator;
--   * a trigger protects every existing SECURITY DEFINER mutation RPC, so a
--     partner cannot mutate a secret row even when they guess its numeric id;
--   * secret creation writes a private history event and emits no notification.

begin;

alter table public.wishlist_items
  add column if not exists is_secret boolean not null default false;

alter table public.wishlist_items
  drop constraint if exists wishlist_items_secret_owner_check;

alter table public.wishlist_items
  add constraint wishlist_items_secret_owner_check
  check (
    not is_secret
    or (
      created_by is not null
      and owner = created_by
      and not is_shared
    )
  );

create index if not exists wishlist_items_secret_creator_idx
  on public.wishlist_items (created_by, id desc)
  where is_secret and deleted_at is null;

-- SECURITY DEFINER RPCs bypass table RLS by design. This trigger is the
-- common mutation boundary for old and new RPC versions: once a row is
-- secret, only its authenticated creator may change it, and it cannot be
-- moved to another owner or to the shared list.
create or replace function app_private.guard_secret_wishlist_item()
returns trigger
language plpgsql
security definer
set search_path = public, app_private, pg_catalog
as $$
declare
  v_actor integer := app_private.current_app_user_id();
begin
  if old.is_secret then
    if v_actor is null or v_actor is distinct from old.created_by then
      raise exception 'secret_wish_not_found' using errcode = 'P0002';
    end if;

    if new.created_by is distinct from old.created_by
      or new.owner is distinct from old.owner
      or new.is_shared then
      raise exception 'secret_wish_not_movable' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function app_private.guard_secret_wishlist_item()
  from public, anon, authenticated;

drop trigger if exists guard_secret_wishlist_item on public.wishlist_items;
create trigger guard_secret_wishlist_item
before update on public.wishlist_items
for each row
execute function app_private.guard_secret_wishlist_item();

-- Existing clients continue to use this RPC and therefore remain strictly on
-- the pair-visible surface. Keeping the signature stable avoids a PostgREST
-- overload ambiguity during a rolling frontend deployment.
create or replace function public.get_wishlist_items_v3(
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
    and not wi.is_secret
    and ((p_shared and wi.is_shared) or (not p_shared and not wi.is_shared and wi.owner = p_owner_id))
    and (p_include_archived or wi.status not in ('gifted','archived'))
  order by wi.id desc;
end;
$$;

-- No owner id is accepted from the caller. The authenticated creator is the
-- only selector, which prevents a partner from changing a parameter to browse
-- somebody else's secret list.
create or replace function public.get_secret_wishlist_items_v1()
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
    false,
    false,
    null::integer,
    wi.price,
    wi.priority::text,
    false,
    null::integer,
    null::timestamptz,
    wi.status,
    null::timestamptz,
    wi.version,
    wi.status = 'visible',
    wi.status = 'visible',
    false,
    false,
    false,
    'gift'::text
  from public.wishlist_items wi
  where wi.couple_id = v_couple_id
    and wi.created_by = v_actor
    and wi.owner = v_actor
    and wi.is_secret
    and not wi.is_shared
    and wi.status = 'visible'
    and wi.deleted_at is null
  order by wi.id desc;
end;
$$;

revoke all on function public.get_secret_wishlist_items_v1()
  from public, anon;
grant execute on function public.get_secret_wishlist_items_v1()
  to authenticated;

-- v5 creates visible and secret wishes through one idempotent command. Secret
-- wishes are restricted to the actor's personal list before the row exists,
-- so neither notifications nor realtime-visible history can briefly leak it.
create or replace function public.create_wishlist_item_idempotent_v5(
  p_request_id uuid,
  p_title text,
  p_owner_id integer,
  p_is_shared boolean default false,
  p_is_secret boolean default false,
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
  v_existing public.wishlist_items%rowtype;
  v_title text := btrim(coalesce(p_title, ''));
  v_description text := nullif(btrim(p_description), '');
  v_link text := nullif(btrim(p_link), '');
  v_image_url text := nullif(btrim(p_image_url), '');
  v_shared boolean := coalesce(p_is_shared, false);
  v_secret boolean := coalesce(p_is_secret, false);
  v_preference text := case
    when nullif(btrim(p_image_url), '') is null then 'auto'
    else nullif(btrim(p_image_preference), '')
  end;
begin
  if v_actor is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if v_couple_id is null then raise exception 'couple_membership_required' using errcode = '42501'; end if;
  if p_request_id is null then raise exception 'request_id_required' using errcode = '22023'; end if;

  if not app_private.user_in_couple(p_owner_id, v_couple_id) then
    raise exception 'wishlist_owner_outside_couple' using errcode = '42501';
  end if;

  if v_secret and (v_shared or p_owner_id is distinct from v_actor) then
    raise exception 'secret_wish_must_be_personal' using errcode = '42501';
  end if;

  if v_preference is null
    or v_preference not in ('auto', 'product-cutout', 'portrait-cutout', 'photo-cover') then
    raise exception 'invalid_image_preference' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_actor::text || ':' || p_request_id::text, 0)
  );

  select * into v_existing
  from public.wishlist_items wi
  where wi.created_by = v_actor
    and wi.create_request_id = p_request_id;

  if found then
    -- Uploaded image URLs may legitimately change across a transport retry.
    if v_existing.couple_id is distinct from v_couple_id
      or v_existing.owner is distinct from p_owner_id
      or v_existing.is_shared is distinct from v_shared
      or v_existing.is_secret is distinct from v_secret
      or v_existing.title is distinct from v_title
      or v_existing.description is distinct from v_description
      or v_existing.link is distinct from v_link
      or v_existing.price is distinct from p_price
      or v_existing.priority::text is distinct from p_priority
    then
      raise exception 'create_request_conflict' using errcode = '23505';
    end if;

    return v_existing.id;
  end if;

  perform app_private.validate_wishlist_payload(
    p_title, p_description, p_link, p_image_url, p_price, p_priority
  );

  insert into public.wishlist_items (
    title,
    owner,
    is_shared,
    is_secret,
    description,
    link,
    image_url,
    image_preference,
    image_processing_status,
    price,
    priority,
    status,
    reserved,
    reserved_by,
    fulfilled,
    created_by,
    create_request_id,
    couple_id,
    updated_at
  ) values (
    v_title,
    p_owner_id,
    v_shared,
    v_secret,
    v_description,
    v_link,
    v_image_url,
    v_preference,
    case when v_image_url is null then 'idle' else 'pending' end,
    p_price,
    p_priority,
    'visible',
    false,
    null,
    false,
    v_actor,
    p_request_id,
    v_couple_id,
    now()
  )
  returning id into v_id;

  insert into public.wishlist_history (
    wish_id, actor_id, event_type, from_status, to_status, metadata, is_private
  ) values (
    v_id,
    v_actor,
    'wish_created',
    null,
    'visible',
    jsonb_build_object('request_id', p_request_id, 'is_secret', v_secret),
    v_secret
  );

  return v_id;
end;
$$;

revoke all on function public.create_wishlist_item_idempotent_v5(
  uuid, text, integer, boolean, boolean, text, text, text, numeric, text, text
) from public, anon;
grant execute on function public.create_wishlist_item_idempotent_v5(
  uuid, text, integer, boolean, boolean, text, text, text, numeric, text, text
) to authenticated;

-- Secret rows must not alter pair-wide progress, because even an aggregate
-- delta would disclose that a secret wish exists.
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
  if v_actor is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if v_couple_id is null then raise exception 'couple_membership_required' using errcode = '42501'; end if;

  return query
  select
    count(*)::bigint,
    count(*) filter (where wi.status in ('gifted','archived'))::bigint,
    count(*) filter (
      where wi.status in ('gifted','archived')
        and wi.fulfilled_at >= date_trunc('year', now())
        and wi.fulfilled_at < date_trunc('year', now()) + interval '1 year'
    )::bigint,
    count(*) filter (
      where wi.status in ('gifted','archived')
        and wi.fulfilled_at >= date_trunc('month', now())
        and wi.fulfilled_at < date_trunc('month', now()) + interval '1 month'
    )::bigint
  from public.wishlist_items wi
  where wi.couple_id = v_couple_id
    and wi.deleted_at is null
    and not wi.is_secret;
end;
$$;

comment on column public.wishlist_items.is_secret is
  'Only created_by may read this personal wish; pair-visible RPCs and statistics exclude it.';
comment on function public.get_secret_wishlist_items_v1() is
  'Returns active secret wishes created by the authenticated user only.';
comment on function public.create_wishlist_item_idempotent_v5(
  uuid, text, integer, boolean, boolean, text, text, text, numeric, text, text
) is 'Idempotently creates a visible or creator-only secret Wishlist wish.';

commit;
