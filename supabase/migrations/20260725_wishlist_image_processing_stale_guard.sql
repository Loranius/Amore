-- Stale image-processing workers are normal after a user changes an image,
-- its display preference, or the processing revision. Older clients retried
-- the previous serialization errors without a terminal condition, which could
-- create an unbounded request loop against Postgres.
create or replace function public.begin_wishlist_image_processing_v5(
  p_wish_id bigint,
  p_source_image_url text,
  p_image_preference text,
  p_processing_revision bigint,
  p_processor_version integer
)
returns table(
  session_id uuid,
  lease_expires_at timestamptz,
  should_process boolean,
  retry_after_ms integer,
  processing_status text
)
language plpgsql
security definer
set search_path to 'public', 'app_private', 'pg_catalog'
as $function$
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

  -- Return a terminal no-op decision instead of an error. This keeps outdated
  -- tabs backward compatible and prevents their retry handlers from hammering
  -- the database. A fresh render receives the current source/preference/revision.
  if v_wish.image_url is distinct from v_source
     or v_wish.image_preference is distinct from v_preference
     or v_wish.image_processing_revision is distinct from p_processing_revision
  then
    return query select
      null::uuid,
      null::timestamptz,
      false,
      null::integer,
      coalesce(v_wish.image_processing_status, 'idle')::text;
    return;
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
$function$;
