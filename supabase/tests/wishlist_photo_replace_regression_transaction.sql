-- Заміна фото в бажанні, у якого картинка вже дообробилась — rollback-only.
--
-- Регресія до 20260811090000_wishlist_photo_replace_fix.sql.
--
-- Симптом на живому порталі: «Не вдалося зберегти бажання» щоразу, коли до
-- бажання з готовою картинкою чіпляли нове фото. Причина була не в клієнті:
-- `update_wishlist_item_collaborative_v3` знімала `image_mode`, але лишала
-- `image_processing_status = 'ready'`, а CHECK
-- `wishlist_items_image_processing_ready_check` перевіряється по завершенню
-- КОЖНОГО оператора, а не транзакції — тож наступний оператор v4, який мав
-- поставити 'pending', до виконання не доходив.
--
-- Тому тут перевіряється саме v3 напряму (місце, де ламався інваріант), а не
-- лише v4: будь-який інший виклик v3 падав так само.

begin;

create temporary table photo_replace_users on commit drop as
select row_number() over (order by id)::integer as slot, id, email
from public.users
where email is not null
order by id
limit 1;

create temporary table photo_replace_state (
  wish_id bigint,
  version bigint
) on commit drop;

create or replace function pg_temp.pr_assert(p_name text, p_condition boolean)
returns void
language plpgsql
as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'photo_replace_test_failed:%', p_name;
  end if;
end;
$$;

create or replace function pg_temp.pr_expect_error(
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
    raise exception 'photo_replace_wrong_error:% expected:% actual:%',
      p_name, p_fragment, coalesce(v_error, '<none>');
  end if;
end;
$$;

create or replace function pg_temp.pr_set_actor(p_email text)
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

select pg_temp.pr_assert(
  'owner_available',
  (select count(*) = 1 from pg_temp.photo_replace_users)
);

select pg_temp.pr_set_actor((select email from pg_temp.photo_replace_users where slot = 1));

insert into pg_temp.photo_replace_state(wish_id)
select public.create_wishlist_item_idempotent_v4(
  gen_random_uuid(),
  'Подарунок із фото',
  (select id from pg_temp.photo_replace_users where slot = 1),
  false,
  null,
  null,
  'https://shop.example/gift-first.jpg',
  2400,
  'high',
  'product-cutout'
);

-- Обробка добігає кінця: саме цей стан і робив збереження неможливим.
select public.set_wishlist_processed_image_v3(
  (select wish_id from pg_temp.photo_replace_state),
  'https://shop.example/gift-first.jpg',
  'https://demo.supabase.co/storage/v1/object/public/wishlist-photos/processed/gift/product.webp',
  'product-cutout'
);

update pg_temp.photo_replace_state s
set version = w.version
from public.wishlist_items w
where w.id = s.wish_id;

select pg_temp.pr_assert(
  'setup_reaches_the_broken_state',
  (
    select w.image_processing_status = 'ready' and w.image_mode is not null
    from public.wishlist_items w
    where w.id = (select wish_id from pg_temp.photo_replace_state)
  )
);

-- ── Головна перевірка: v3 напряму більше не лишає рядок недійсним ──

select public.update_wishlist_item_collaborative_v3(
  (select wish_id from pg_temp.photo_replace_state),
  (select version from pg_temp.photo_replace_state),
  'Подарунок із фото',
  null,
  null,
  'https://shop.example/gift-second.jpg',
  2400,
  'high'
);

select pg_temp.pr_assert(
  'v3_resets_processing_together_with_the_mode',
  (
    select w.image_url = 'https://shop.example/gift-second.jpg'
      and w.image_mode is null
      and w.processed_image_url is null
      and w.image_processing_status = 'idle'
      and w.image_processing_session_id is null
      and w.image_processing_lease_expires_at is null
      and w.image_processing_error_code is null
      and w.version = (select version + 1 from pg_temp.photo_replace_state)
    from public.wishlist_items w
    where w.id = (select wish_id from pg_temp.photo_replace_state)
  )
);

-- ── Той самий шлях, яким ходить портал: v4 поверх v3 ──

select public.set_wishlist_processed_image_v3(
  (select wish_id from pg_temp.photo_replace_state),
  'https://shop.example/gift-second.jpg',
  'https://demo.supabase.co/storage/v1/object/public/wishlist-photos/processed/gift/second.webp',
  'product-cutout'
);

select pg_temp.pr_assert(
  'setup_reaches_the_broken_state_again',
  (
    select w.image_processing_status = 'ready' and w.image_mode is not null
    from public.wishlist_items w
    where w.id = (select wish_id from pg_temp.photo_replace_state)
  )
);

select public.update_wishlist_item_collaborative_v4(
  (select wish_id from pg_temp.photo_replace_state),
  (select version + 1 from pg_temp.photo_replace_state),
  'Подарунок із фото',
  null,
  null,
  'https://shop.example/gift-third.jpg',
  2400,
  'high',
  'auto'
);

select pg_temp.pr_assert(
  'v4_queues_the_new_photo_for_processing',
  (
    select w.image_url = 'https://shop.example/gift-third.jpg'
      and w.image_mode is null
      and w.processed_image_url is null
      and w.image_processing_status = 'pending'
      and w.image_preference = 'auto'
      and w.version = (select version + 2 from pg_temp.photo_replace_state)
    from public.wishlist_items w
    where w.id = (select wish_id from pg_temp.photo_replace_state)
  )
);

-- ── Порожнє вподобання: зрозуміла помилка, а не порушення NOT NULL ──
--
-- `v_preference not in (...)` на NULL дає NULL, а не true, тож перевірка не
-- спрацьовувала і база кидала `null value in column "image_preference"`.

select pg_temp.pr_expect_error(
  'empty_preference_is_named',
  'invalid_image_preference',
  format(
    $sql$select public.create_wishlist_item_idempotent_v4(
      gen_random_uuid(), 'Порожнє вподобання', %s, false,
      null, null, %L, null, 'medium', '')$sql$,
    (select id from pg_temp.photo_replace_users where slot = 1),
    'https://shop.example/gift-blank.jpg'
  )
);

select pg_temp.pr_expect_error(
  'empty_preference_is_named_on_update',
  'invalid_image_preference',
  format(
    $sql$select public.update_wishlist_item_collaborative_v4(
      %s, %s, 'Подарунок із фото', null, null, %L, 2400, 'high', '   ')$sql$,
    (select wish_id from pg_temp.photo_replace_state),
    (select version + 2 from pg_temp.photo_replace_state),
    'https://shop.example/gift-fourth.jpg'
  )
);

rollback;
