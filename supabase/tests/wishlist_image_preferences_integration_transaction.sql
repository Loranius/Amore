-- Wishlist manual image preference rollback-only integration suite.

begin;

create temporary table image_preference_users on commit drop as
select row_number() over (order by id)::integer as slot, id, email
from public.users
where email is not null
order by id
limit 2;

create temporary table image_preference_state (
  wish_id bigint,
  original_version bigint,
  original_revision bigint
) on commit drop;

create or replace function pg_temp.ip_assert(p_name text, p_condition boolean)
returns void
language plpgsql
as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'image_preference_test_failed:%', p_name;
  end if;
end;
$$;

create or replace function pg_temp.ip_expect_error(
  p_name text,
  p_fragment text,
  p_sql text
)
returns void
language plpgsql
as $$
declare
  v_error text;
begin
  begin execute p_sql; exception when others then v_error := sqlerrm; end;
  if v_error is null or position(lower(p_fragment) in lower(v_error)) = 0 then
    raise exception 'image_preference_wrong_error:% expected:% actual:%',
      p_name, p_fragment, coalesce(v_error, '<none>');
  end if;
end;
$$;

create or replace function pg_temp.ip_set_actor(p_email text)
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('email', p_email, 'role', 'authenticated')::text,
    true
  );
end;
$$;

select pg_temp.ip_assert(
  'two_users_available',
  (select count(*) = 2 from pg_temp.image_preference_users)
);

select pg_temp.ip_set_actor((select email from pg_temp.image_preference_users where slot = 1));

insert into pg_temp.image_preference_state(wish_id)
select public.create_wishlist_item_idempotent_v4(
  gen_random_uuid(),
  'Manual image mode wish',
  (select id from pg_temp.image_preference_users where slot = 1),
  false,
  'Image preference test',
  null,
  'https://shop.example/manual-mode-a.jpg',
  1600,
  'high',
  'product-cutout'
);

update pg_temp.image_preference_state s
set original_version = w.version,
    original_revision = w.image_processing_revision
from public.get_wishlist_items_v3(
  (select id from pg_temp.image_preference_users where slot = 1),
  false,
  false
) w
where w.id = s.wish_id;

select pg_temp.ip_assert(
  'create_returns_manual_preference',
  (
    select w.image_preference = 'product-cutout'
      and w.image_processing_revision = 0
      and w.version = 1
    from public.get_wishlist_items_v3(
      (select id from pg_temp.image_preference_users where slot = 1),
      false,
      false
    ) w
    where w.id = (select wish_id from pg_temp.image_preference_state)
  )
);

select public.set_wishlist_processed_image_v3(
  (select wish_id from pg_temp.image_preference_state),
  'https://shop.example/manual-mode-a.jpg',
  'https://demo.supabase.co/storage/v1/object/public/wishlist-photos/processed/manual/product.webp',
  'product-cutout'
);

select public.set_wishlist_image_preference_v3(
  (select wish_id from pg_temp.image_preference_state),
  'https://shop.example/manual-mode-a.jpg',
  'portrait-cutout',
  false
);

select pg_temp.ip_assert(
  'standalone_preference_clears_cache_without_version_change',
  (
    select w.image_preference = 'portrait-cutout'
      and w.processed_image_url is null
      and w.image_mode is null
      and w.version = (select original_version from pg_temp.image_preference_state)
      and w.image_processing_revision = (select original_revision + 1 from pg_temp.image_preference_state)
    from public.get_wishlist_items_v3(
      (select id from pg_temp.image_preference_users where slot = 1),
      false,
      false
    ) w
    where w.id = (select wish_id from pg_temp.image_preference_state)
  )
);

select pg_temp.ip_expect_error(
  'mismatched_product_result_rejected',
  'processed_image_mode_mismatch',
  format(
    $sql$select public.set_wishlist_processed_image_v3(%s, %L, %L, %L)$sql$,
    (select wish_id from pg_temp.image_preference_state),
    'https://shop.example/manual-mode-a.jpg',
    'https://demo.supabase.co/storage/v1/object/public/wishlist-photos/processed/manual/wrong.webp',
    'product-cutout'
  )
);

select public.set_wishlist_processed_image_v3(
  (select wish_id from pg_temp.image_preference_state),
  'https://shop.example/manual-mode-a.jpg',
  null,
  'photo-cover'
);

select public.set_wishlist_image_preference_v3(
  (select wish_id from pg_temp.image_preference_state),
  'https://shop.example/manual-mode-a.jpg',
  'portrait-cutout',
  true
);

select pg_temp.ip_assert(
  'force_reprocess_increments_revision_only',
  (
    select w.image_mode is null
      and w.processed_image_url is null
      and w.version = (select original_version from pg_temp.image_preference_state)
      and w.image_processing_revision = (select original_revision + 2 from pg_temp.image_preference_state)
    from public.get_wishlist_items_v3(
      (select id from pg_temp.image_preference_users where slot = 1),
      false,
      false
    ) w
    where w.id = (select wish_id from pg_temp.image_preference_state)
  )
);

select public.update_wishlist_item_collaborative_v4(
  (select wish_id from pg_temp.image_preference_state),
  (select original_version from pg_temp.image_preference_state),
  'Manual image mode wish updated',
  'Image preference test',
  null,
  'https://shop.example/manual-mode-a.jpg',
  1600,
  'high',
  'photo-cover'
);

select pg_temp.ip_assert(
  'v4_update_is_atomic',
  (
    select w.title = 'Manual image mode wish updated'
      and w.image_preference = 'photo-cover'
      and w.version = (select original_version + 1 from pg_temp.image_preference_state)
      and w.image_processing_revision = (select original_revision + 3 from pg_temp.image_preference_state)
    from public.get_wishlist_items_v3(
      (select id from pg_temp.image_preference_users where slot = 1),
      false,
      false
    ) w
    where w.id = (select wish_id from pg_temp.image_preference_state)
  )
);

select pg_temp.ip_set_actor((select email from pg_temp.image_preference_users where slot = 2));

select public.set_wishlist_image_preference_v3(
  (select wish_id from pg_temp.image_preference_state),
  'https://shop.example/manual-mode-a.jpg',
  'auto',
  true
);

select pg_temp.ip_assert(
  'couple_partner_can_reprocess',
  (
    select w.image_preference = 'auto'
      and w.image_processing_revision = (select original_revision + 4 from pg_temp.image_preference_state)
      and w.version = (select original_version + 1 from pg_temp.image_preference_state)
    from public.get_wishlist_items_v3(
      (select id from pg_temp.image_preference_users where slot = 1),
      false,
      false
    ) w
    where w.id = (select wish_id from pg_temp.image_preference_state)
  )
);

rollback;
