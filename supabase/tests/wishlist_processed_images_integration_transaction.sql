-- Persisted Wishlist image cache rollback-only integration suite.

begin;

create temporary table processed_image_users on commit drop as
select row_number() over (order by id)::integer as slot, id, email
from public.users
where email is not null
order by id
limit 2;

create temporary table processed_image_state (
  wish_id bigint,
  original_version bigint
) on commit drop;

create or replace function pg_temp.pi_assert(p_name text, p_condition boolean)
returns void
language plpgsql
as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'processed_image_test_failed:%', p_name;
  end if;
end;
$$;

create or replace function pg_temp.pi_expect_error(
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
    raise exception 'processed_image_wrong_error:% expected:% actual:%',
      p_name, p_fragment, coalesce(v_error, '<none>');
  end if;
end;
$$;

create or replace function pg_temp.pi_set_actor(p_email text)
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

select pg_temp.pi_assert(
  'two_users_available',
  (select count(*) = 2 from pg_temp.processed_image_users)
);

select pg_temp.pi_set_actor((select email from pg_temp.processed_image_users where slot = 1));

insert into pg_temp.processed_image_state(wish_id)
select public.create_wishlist_item_idempotent_v3(
  gen_random_uuid(),
  'Processed image integration wish',
  (select id from pg_temp.processed_image_users where slot = 1),
  false,
  'Image cache test',
  null,
  'https://shop.example/original-a.jpg',
  1200,
  'high'
);

-- Function side effects become visible to the next statement, not to a lateral
-- read in the same statement snapshot.
update pg_temp.processed_image_state state
set original_version = listed.version
from public.get_wishlist_items_v3(
  (select id from pg_temp.processed_image_users where slot = 1),
  false,
  false
) listed
where listed.id = state.wish_id;

select pg_temp.pi_assert(
  'created_wish_is_readable',
  (select wish_id is not null and original_version = 1 from pg_temp.processed_image_state)
);

select public.set_wishlist_processed_image_v3(
  (select wish_id from pg_temp.processed_image_state),
  'https://shop.example/original-a.jpg',
  'https://demo.supabase.co/storage/v1/object/public/wishlist-photos/processed/wish-1.webp?v=1',
  'product-cutout'
);

select pg_temp.pi_assert(
  'cutout_is_returned_without_version_change',
  (
    select w.processed_image_url is not null
      and w.image_mode = 'product-cutout'
      and w.version = (select original_version from pg_temp.processed_image_state)
    from public.get_wishlist_items_v3(
      (select id from pg_temp.processed_image_users where slot = 1),
      false,
      false
    ) w
    where w.id = (select wish_id from pg_temp.processed_image_state)
  )
);

select pg_temp.pi_expect_error(
  'stale_source_is_rejected',
  'processed_image_source_changed',
  format(
    $sql$select public.set_wishlist_processed_image_v3(%s, %L, %L, %L)$sql$,
    (select wish_id from pg_temp.processed_image_state),
    'https://shop.example/stale.jpg',
    'https://demo.supabase.co/storage/v1/object/public/wishlist-photos/processed/stale.webp',
    'product-cutout'
  )
);

select pg_temp.pi_expect_error(
  'cutout_requires_storage_url',
  'invalid_processed_image_url',
  format(
    $sql$select public.set_wishlist_processed_image_v3(%s, %L, %L, %L)$sql$,
    (select wish_id from pg_temp.processed_image_state),
    'https://shop.example/original-a.jpg',
    'https://tracker.example/pixel.webp',
    'portrait-cutout'
  )
);

select public.update_wishlist_item_collaborative_v3(
  (select wish_id from pg_temp.processed_image_state),
  (select original_version from pg_temp.processed_image_state),
  'Processed image integration wish',
  'Image cache test',
  null,
  'https://shop.example/original-b.jpg',
  1200,
  'high'
);

select pg_temp.pi_assert(
  'changing_source_clears_cache',
  (
    select w.image_url = 'https://shop.example/original-b.jpg'
      and w.processed_image_url is null
      and w.image_mode is null
      and w.version = (select original_version + 1 from pg_temp.processed_image_state)
    from public.get_wishlist_items_v3(
      (select id from pg_temp.processed_image_users where slot = 1),
      false,
      false
    ) w
    where w.id = (select wish_id from pg_temp.processed_image_state)
  )
);

select pg_temp.pi_set_actor((select email from pg_temp.processed_image_users where slot = 2));

select public.set_wishlist_processed_image_v3(
  (select wish_id from pg_temp.processed_image_state),
  'https://shop.example/original-b.jpg',
  null,
  'photo-cover'
);

select pg_temp.pi_assert(
  'couple_partner_can_cache_safe_fallback',
  (
    select w.image_mode = 'photo-cover'
      and w.processed_image_url is null
      and w.version = (select original_version + 1 from pg_temp.processed_image_state)
    from public.get_wishlist_items_v3(
      (select id from pg_temp.processed_image_users where slot = 1),
      false,
      false
    ) w
    where w.id = (select wish_id from pg_temp.processed_image_state)
  )
);

rollback;
