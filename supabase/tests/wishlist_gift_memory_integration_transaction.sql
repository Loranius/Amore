-- Wishlist Gift Memory rollback-only integration suite.
-- Run after 20260723_wishlist_gift_memory.sql.
-- All writes are rolled back, including temporary gift completion records.

begin;

create temporary table gift_memory_test_results (
  test_name text primary key
) on commit drop;

create temporary table gift_memory_test_users on commit drop as
select
  row_number() over (order by id)::integer as slot,
  id,
  email
from public.users
where email is not null
order by id
limit 2;

create temporary table gift_memory_test_state (
  wish_id bigint,
  idempotency_key uuid,
  completion_id bigint,
  photo_path text,
  video_path text
) on commit drop;

create or replace function pg_temp.gm_assert(
  p_test_name text,
  p_condition boolean
)
returns void
language plpgsql
as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'gift_memory_test_failed:%', p_test_name;
  end if;
  insert into pg_temp.gift_memory_test_results(test_name) values (p_test_name);
end;
$$;

create or replace function pg_temp.gm_expect_error(
  p_test_name text,
  p_expected_fragment text,
  p_sql text
)
returns void
language plpgsql
as $$
declare
  v_error text;
begin
  begin
    execute p_sql;
  exception when others then
    v_error := sqlerrm;
  end;

  if v_error is null then
    raise exception 'gift_memory_expected_error_not_raised:%', p_test_name;
  end if;

  if position(p_expected_fragment in v_error) = 0 then
    raise exception 'gift_memory_wrong_error:% expected:% actual:%',
      p_test_name,
      p_expected_fragment,
      v_error;
  end if;

  insert into pg_temp.gift_memory_test_results(test_name) values (p_test_name);
end;
$$;

create or replace function pg_temp.gm_set_actor(p_email text)
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

select pg_temp.gm_assert(
  'two_users_available',
  (select count(*) = 2 from pg_temp.gift_memory_test_users)
);

-- User 1 owns the wish.
select pg_temp.gm_set_actor((select email from pg_temp.gift_memory_test_users where slot = 1));

insert into pg_temp.gift_memory_test_state(wish_id, idempotency_key)
select
  public.create_wishlist_item_v3(
    'Gift memory integration wish',
    (select id from pg_temp.gift_memory_test_users where slot = 1),
    false,
    null,
    null,
    null,
    250,
    'high'
  ),
  gen_random_uuid();

-- User 2 owns the private lifecycle and completion.
select pg_temp.gm_set_actor((select email from pg_temp.gift_memory_test_users where slot = 2));
select public.reserve_wishlist_item((select wish_id from pg_temp.gift_memory_test_state));
select public.mark_wishlist_purchased((select wish_id from pg_temp.gift_memory_test_state));
select public.mark_wishlist_preparing((select wish_id from pg_temp.gift_memory_test_state));

update pg_temp.gift_memory_test_state
set photo_path =
      (select id::text from pg_temp.gift_memory_test_users where slot = 2)
      || '/' || wish_id::text || '/' || idempotency_key::text || '/photo.webp',
    video_path =
      (select id::text from pg_temp.gift_memory_test_users where slot = 2)
      || '/' || wish_id::text || '/' || idempotency_key::text || '/video.mp4';

select pg_temp.gm_expect_error(
  'reject_foreign_media_path',
  'invalid_reaction_photo_path',
  format(
    $sql$select public.complete_wishlist_gift(%s, %L::uuid, %L, null, null)$sql$,
    (select wish_id from pg_temp.gift_memory_test_state),
    (select idempotency_key from pg_temp.gift_memory_test_state),
    '999/999/foreign/photo.jpg'
  )
);

update pg_temp.gift_memory_test_state
set completion_id = public.complete_wishlist_gift(
  wish_id,
  idempotency_key,
  photo_path,
  video_path,
  'Незабутня реакція ❤️'
);

select pg_temp.gm_assert(
  'completion_is_idempotent',
  (
    select public.complete_wishlist_gift(
      wish_id,
      idempotency_key,
      photo_path,
      video_path,
      'Цей повтор не повинен створити другий запис'
    ) = completion_id
    from pg_temp.gift_memory_test_state
  )
);

select pg_temp.gm_assert(
  'completion_persists_memory_fields',
  (
    select count(*) = 1
      and max(wgc.reaction_photo) = max(s.photo_path)
      and max(wgc.reaction_video) = max(s.video_path)
      and max(wgc.comment) = 'Незабутня реакція ❤️'
    from public.wishlist_gift_completions wgc
    join pg_temp.gift_memory_test_state s on s.wish_id = wgc.wish_id
  )
);

select pg_temp.gm_assert(
  'memory_domain_event_created',
  exists (
    select 1
    from public.wishlist_history wh
    join pg_temp.gift_memory_test_state s on s.wish_id = wh.wish_id
    where wh.event_type = 'gift_memory_created'
      and (wh.metadata ->> 'completion_id')::bigint = s.completion_id
      and (wh.metadata ->> 'has_photo')::boolean
      and (wh.metadata ->> 'has_video')::boolean
      and (wh.metadata ->> 'has_comment')::boolean
  )
);

-- The receiver can read the Gift Archive and all memory metadata.
select pg_temp.gm_set_actor((select email from pg_temp.gift_memory_test_users where slot = 1));
select pg_temp.gm_assert(
  'owner_archive_contains_memory',
  (
    select count(*) = 1
      and max(a.completion_id) = max(s.completion_id)
      and max(a.reaction_photo_path) = max(s.photo_path)
      and max(a.reaction_video_path) = max(s.video_path)
      and max(a.memory_comment) = 'Незабутня реакція ❤️'
    from public.get_fulfilled_wishlist_items_v3(
      (select id from pg_temp.gift_memory_test_users where slot = 1)
    ) a
    join pg_temp.gift_memory_test_state s on s.wish_id = a.id
  )
);

select pg_temp.gm_assert(
  'memory_bucket_is_private',
  exists (
    select 1
    from storage.buckets
    where id = 'wishlist-memories'
      and public = false
      and file_size_limit = 52428800
  )
);

select
  count(*) as passed_tests,
  array_agg(test_name order by test_name) as tests
from pg_temp.gift_memory_test_results;

rollback;
