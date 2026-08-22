-- Follow-up for the already applied secret-wishes migration: keep the RPC
-- result aligned with get_wishlist_items_v3 by returning `version` before the
-- capability booleans. Fresh databases receive the same corrected definition
-- in 20260822070000; this migration records the production hotfix explicitly.

begin;

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

commit;
