-- Wishlist create idempotency.
--
-- Old clients keep using create_wishlist_item_v3. New clients use the explicit
-- idempotent RPC with a stable request UUID across retries.

begin;

alter table public.wishlist_items
  add column if not exists created_by integer references public.users(id) on delete restrict,
  add column if not exists create_request_id uuid;

-- Historical rows predate command IDs. Owner is the safest available creator
-- approximation and is used only for auditability, never authorization.
update public.wishlist_items
set created_by = owner
where created_by is null;

create unique index if not exists wishlist_items_creator_request_uidx
  on public.wishlist_items (created_by, create_request_id)
  where create_request_id is not null;

create index if not exists wishlist_items_created_by_idx
  on public.wishlist_items (created_by, id desc)
  where deleted_at is null;

create or replace function public.create_wishlist_item_idempotent_v3(
  p_request_id uuid,
  p_title text,
  p_owner_id integer,
  p_is_shared boolean default false,
  p_description text default null,
  p_link text default null,
  p_image_url text default null,
  p_price numeric default null,
  p_priority text default null
)
returns bigint
language plpgsql
security definer
set search_path = public, app_private, pg_catalog
as $$
declare
  v_actor integer := app_private.current_app_user_id();
  v_id bigint;
  v_existing public.wishlist_items%rowtype;
  v_title text := btrim(coalesce(p_title, ''));
  v_description text := nullif(btrim(p_description), '');
  v_link text := nullif(btrim(p_link), '');
  v_image_url text := nullif(btrim(p_image_url), '');
  v_shared boolean := coalesce(p_is_shared, false);
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_request_id is null then
    raise exception 'request_id_required' using errcode = '22023';
  end if;

  -- Serialize identical actor/request pairs before checking or inserting.
  perform pg_advisory_xact_lock(
    hashtextextended(v_actor::text || ':' || p_request_id::text, 0)
  );

  select * into v_existing
  from public.wishlist_items wi
  where wi.created_by = v_actor
    and wi.create_request_id = p_request_id;

  if found then
    -- A re-uploaded local photo may have a new Storage URL after a lost response,
    -- so image_url is intentionally excluded from conflict comparison.
    if v_existing.owner is distinct from p_owner_id
      or v_existing.is_shared is distinct from v_shared
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
    p_title,
    p_description,
    p_link,
    p_image_url,
    p_price,
    p_priority
  );

  if not exists (select 1 from public.users where id = p_owner_id) then
    raise exception 'owner_not_found' using errcode = 'P0002';
  end if;

  insert into public.wishlist_items (
    title,
    owner,
    is_shared,
    description,
    link,
    image_url,
    price,
    priority,
    status,
    reserved,
    reserved_by,
    fulfilled,
    created_by,
    create_request_id,
    updated_at
  ) values (
    v_title,
    p_owner_id,
    v_shared,
    v_description,
    v_link,
    v_image_url,
    p_price,
    p_priority,
    'visible',
    false,
    null,
    false,
    v_actor,
    p_request_id,
    now()
  ) returning id into v_id;

  insert into public.wishlist_history (
    wish_id,
    actor_id,
    event_type,
    from_status,
    to_status,
    metadata,
    is_private
  ) values (
    v_id,
    v_actor,
    'wish_created',
    null,
    'visible',
    jsonb_build_object('request_id', p_request_id),
    false
  );

  return v_id;
end;
$$;

revoke all on function public.create_wishlist_item_idempotent_v3(
  uuid, text, integer, boolean, text, text, text, numeric, text
) from public, anon;

grant execute on function public.create_wishlist_item_idempotent_v3(
  uuid, text, integer, boolean, text, text, text, numeric, text
) to authenticated;

comment on function public.create_wishlist_item_idempotent_v3(
  uuid, text, integer, boolean, text, text, text, numeric, text
) is 'Creates one Wishlist item per authenticated actor/request UUID and safely returns it on retry.';

commit;
