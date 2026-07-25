-- Wishlist archive: allow the signed-in owner to record gifts received before the portal existed.
-- Manual archive entries are personal, attributed to the other member of the current couple,
-- and deliberately do not require a priority.

begin;

create or replace function public.create_manual_wishlist_archive_gift_v1(
  p_request_id uuid,
  p_title text,
  p_gifted_on date,
  p_description text default null,
  p_link text default null,
  p_image_url text default null,
  p_price numeric default null
)
returns bigint
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_actor integer := app_private.current_app_user_id();
  v_couple_id bigint := app_private.current_couple_id();
  v_partner integer;
  v_wish_id bigint;
  v_existing_owner integer;
  v_existing_couple bigint;
  v_existing_status public.wishlist_status;
  v_existing_fulfilled boolean;
  v_gifted_at timestamptz;
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if v_couple_id is null then
    raise exception 'couple_membership_required' using errcode = '42501';
  end if;

  if p_request_id is null then
    raise exception 'request_id_required' using errcode = '22023';
  end if;

  select wi.id, wi.owner, wi.couple_id, wi.status, coalesce(wi.fulfilled, false)
    into v_wish_id, v_existing_owner, v_existing_couple, v_existing_status, v_existing_fulfilled
  from public.wishlist_items wi
  where wi.created_by = v_actor
    and wi.create_request_id = p_request_id;

  if found then
    if v_existing_owner <> v_actor
      or v_existing_couple <> v_couple_id
      or v_existing_status <> 'archived'
      or not v_existing_fulfilled
    then
      raise exception 'idempotency_key_conflict' using errcode = '23505';
    end if;

    return v_wish_id;
  end if;

  perform app_private.validate_wishlist_payload(
    p_title,
    p_description,
    p_link,
    p_image_url,
    p_price,
    null
  );

  if p_gifted_on is null then
    raise exception 'gifted_date_required' using errcode = '22023';
  end if;

  if p_gifted_on > (now() at time zone 'Europe/Kyiv')::date then
    raise exception 'gifted_date_in_future' using errcode = '22023';
  end if;

  select cm.user_id
    into v_partner
  from public.couple_members cm
  where cm.couple_id = v_couple_id
    and cm.user_id <> v_actor
  order by cm.joined_at, cm.user_id
  limit 1;

  if v_partner is null then
    raise exception 'partner_not_found' using errcode = 'P0002';
  end if;

  -- Noon in Kyiv keeps the selected calendar day stable across client time zones.
  v_gifted_at := timezone('Europe/Kyiv', p_gifted_on::timestamp + time '12:00');

  insert into public.wishlist_items (
    title,
    description,
    link,
    image_url,
    owner,
    created_by,
    create_request_id,
    couple_id,
    is_shared,
    gift_date,
    price,
    priority,
    status,
    reserved,
    reserved_by,
    fulfilled,
    fulfilled_by,
    fulfilled_at,
    archived_at,
    created_at,
    updated_at
  ) values (
    btrim(p_title),
    nullif(btrim(p_description), ''),
    nullif(btrim(p_link), ''),
    nullif(btrim(p_image_url), ''),
    v_actor,
    v_actor,
    p_request_id,
    v_couple_id,
    false,
    p_gifted_on,
    p_price,
    null,
    'archived',
    false,
    null,
    true,
    v_partner,
    v_gifted_at,
    v_gifted_at,
    now(),
    now()
  )
  returning id into v_wish_id;

  insert into public.wishlist_gift_completions (
    wish_id,
    completed_by,
    completed_at,
    idempotency_key
  ) values (
    v_wish_id,
    v_partner,
    v_gifted_at,
    p_request_id
  );

  insert into public.wishlist_history (
    wish_id,
    actor_id,
    event_type,
    from_status,
    to_status,
    metadata,
    is_private,
    created_at
  ) values (
    v_wish_id,
    v_actor,
    'manual_archive_gift_added',
    null,
    'archived',
    jsonb_build_object(
      'manual', true,
      'gifted_by', v_partner,
      'gifted_on', p_gifted_on
    ),
    true,
    now()
  );

  return v_wish_id;
end;
$$;

revoke all on function public.create_manual_wishlist_archive_gift_v1(
  uuid, text, date, text, text, text, numeric
) from public, anon;

grant execute on function public.create_manual_wishlist_archive_gift_v1(
  uuid, text, date, text, text, text, numeric
) to authenticated;

comment on function public.create_manual_wishlist_archive_gift_v1(
  uuid, text, date, text, text, text, numeric
) is 'Creates an idempotent personal archive entry for a historical gift received from the current partner.';

commit;
