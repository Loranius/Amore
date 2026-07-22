-- Wishlist v3 rollback-only integration suite.
--
-- Run in Supabase SQL Editor against a database that contains two app users.
-- The script simulates both users by changing request.jwt.claims, exercises the
-- public RPC surface, reports passed assertions, and rolls the entire test back.
-- No test wishes, reservations, history, or completions remain after success.

begin;

create temporary table wishlist_test_results (
  test_name text primary key
) on commit drop;

create temporary table wishlist_test_users on commit drop as
select
  row_number() over (order by id)::integer as slot,
  id,
  email
from public.users
where email is not null
order by id
limit 2;

create temporary table wishlist_test_wishes (
  label text primary key,
  wish_id bigint not null
) on commit drop;

create temporary table wishlist_test_completions (
  label text primary key,
  idempotency_key uuid not null,
  completion_id bigint
) on commit drop;

create or replace function pg_temp.assert_true(
  p_test_name text,
  p_condition boolean
)
returns void
language plpgsql
as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'wishlist_test_failed:%', p_test_name;
  end if;

  insert into pg_temp.wishlist_test_results(test_name) values (p_test_name);
end;
$$;

create or replace function pg_temp.expect_error(
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
    raise exception 'wishlist_test_expected_error_not_raised:%', p_test_name;
  end if;

  if position(p_expected_fragment in v_error) = 0 then
    raise exception 'wishlist_test_wrong_error:% expected:% actual:%',
      p_test_name,
      p_expected_fragment,
      v_error;
  end if;

  insert into pg_temp.wishlist_test_results(test_name) values (p_test_name);
end;
$$;

create or replace function pg_temp.set_actor(p_email text)
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

select pg_temp.assert_true(
  'two_users_available',
  (select count(*) = 2 from pg_temp.wishlist_test_users)
);

-- Actor 1 creates a wish without a photo.
select pg_temp.set_actor((select email from pg_temp.wishlist_test_users where slot = 1));
insert into pg_temp.wishlist_test_wishes(label, wish_id)
select
  'privacy',
  public.create_wishlist_item_v3(
    'Integration privacy wish',
    (select id from pg_temp.wishlist_test_users where slot = 1),
    false,
    'rollback-only integration test',
    null,
    null,
    null,
    'medium'
  );

select pg_temp.assert_true(
  'create_without_photo',
  (
    select image_url is null and status = 'visible'
    from public.wishlist_items
    where id = (select wish_id from pg_temp.wishlist_test_wishes where label = 'privacy')
  )
);

select pg_temp.expect_error(
  'cannot_reserve_own_wish',
  'cannot_reserve_own_wish',
  format(
    'select public.reserve_wishlist_item(%s)',
    (select wish_id from pg_temp.wishlist_test_wishes where label = 'privacy')
  )
);

-- Actor 2 reserves it and cannot reserve it twice.
select pg_temp.set_actor((select email from pg_temp.wishlist_test_users where slot = 2));
select public.reserve_wishlist_item(
  (select wish_id from pg_temp.wishlist_test_wishes where label = 'privacy')
);

select pg_temp.expect_error(
  'duplicate_reservation_rejected',
  'wish_not_reservable',
  format(
    'select public.reserve_wishlist_item(%s)',
    (select wish_id from pg_temp.wishlist_test_wishes where label = 'privacy')
  )
);

select pg_temp.assert_true(
  'reserver_sees_own_reservation',
  (
    select reserved
      and reserved_by = (select id from pg_temp.wishlist_test_users where slot = 2)
      and status::text = 'reserved'
    from public.get_wishlist_items_v3(
      (select id from pg_temp.wishlist_test_users where slot = 1),
      false,
      false
    )
    where id = (select wish_id from pg_temp.wishlist_test_wishes where label = 'privacy')
  )
);

-- Owner sees only the generic reserved state and cannot mutate it.
select pg_temp.set_actor((select email from pg_temp.wishlist_test_users where slot = 1));
select pg_temp.assert_true(
  'owner_reservation_privacy',
  (
    select reserved and reserved_by is null and status::text = 'reserved'
    from public.get_wishlist_items_v3(
      (select id from pg_temp.wishlist_test_users where slot = 1),
      false,
      false
    )
    where id = (select wish_id from pg_temp.wishlist_test_wishes where label = 'privacy')
  )
);

select pg_temp.expect_error(
  'reserved_wish_not_editable',
  'wish_not_editable',
  format(
    $sql$select public.update_wishlist_item_v3(%s, 'Changed', null, null, null, null, 'low')$sql$,
    (select wish_id from pg_temp.wishlist_test_wishes where label = 'privacy')
  )
);

select pg_temp.expect_error(
  'reserved_wish_not_deletable',
  'wish_not_deletable',
  format(
    'select public.soft_delete_wishlist_item_v3(%s)',
    (select wish_id from pg_temp.wishlist_test_wishes where label = 'privacy')
  )
);

-- Actor 2 cancels, but still cannot edit another owner's now-visible wish.
select pg_temp.set_actor((select email from pg_temp.wishlist_test_users where slot = 2));
select public.cancel_wishlist_reservation(
  (select wish_id from pg_temp.wishlist_test_wishes where label = 'privacy')
);

select pg_temp.expect_error(
  'partner_cannot_edit_foreign_wish',
  'wish_not_editable',
  format(
    $sql$select public.update_wishlist_item_v3(%s, 'Hacked', null, null, null, null, 'low')$sql$,
    (select wish_id from pg_temp.wishlist_test_wishes where label = 'privacy')
  )
);

-- Owner soft-deletes; safe reads no longer return it.
select pg_temp.set_actor((select email from pg_temp.wishlist_test_users where slot = 1));
select public.soft_delete_wishlist_item_v3(
  (select wish_id from pg_temp.wishlist_test_wishes where label = 'privacy')
);

select pg_temp.assert_true(
  'soft_delete_hidden',
  not exists (
    select 1
    from public.get_wishlist_items_v3(
      (select id from pg_temp.wishlist_test_users where slot = 1),
      false,
      true
    )
    where id = (select wish_id from pg_temp.wishlist_test_wishes where label = 'privacy')
  )
);

-- Full gift lifecycle and archive contract.
insert into pg_temp.wishlist_test_wishes(label, wish_id)
select
  'lifecycle',
  public.create_wishlist_item_v3(
    'Integration lifecycle wish',
    (select id from pg_temp.wishlist_test_users where slot = 1),
    false,
    null,
    'https://example.com/product',
    null,
    100,
    'high'
  );

select pg_temp.set_actor((select email from pg_temp.wishlist_test_users where slot = 2));
select public.reserve_wishlist_item(
  (select wish_id from pg_temp.wishlist_test_wishes where label = 'lifecycle')
);
select public.mark_wishlist_preparing(
  (select wish_id from pg_temp.wishlist_test_wishes where label = 'lifecycle')
);

select pg_temp.assert_true(
  'reserver_sees_preparing_state',
  (
    select status::text = 'preparing_surprise'
      and reserved_by = (select id from pg_temp.wishlist_test_users where slot = 2)
    from public.get_wishlist_items_v3(
      (select id from pg_temp.wishlist_test_users where slot = 1),
      false,
      false
    )
    where id = (select wish_id from pg_temp.wishlist_test_wishes where label = 'lifecycle')
  )
);

select pg_temp.set_actor((select email from pg_temp.wishlist_test_users where slot = 1));
select pg_temp.assert_true(
  'owner_sees_preparing_as_reserved',
  (
    select status::text = 'reserved' and reserved_by is null
    from public.get_wishlist_items_v3(
      (select id from pg_temp.wishlist_test_users where slot = 1),
      false,
      false
    )
    where id = (select wish_id from pg_temp.wishlist_test_wishes where label = 'lifecycle')
  )
);

insert into pg_temp.wishlist_test_completions(label, idempotency_key)
values ('lifecycle', gen_random_uuid());

select pg_temp.set_actor((select email from pg_temp.wishlist_test_users where slot = 2));
update pg_temp.wishlist_test_completions
set completion_id = public.complete_wishlist_gift(
  (select wish_id from pg_temp.wishlist_test_wishes where label = 'lifecycle'),
  idempotency_key,
  null,
  null,
  'rollback-only test'
)
where label = 'lifecycle';

select pg_temp.assert_true(
  'completion_idempotent',
  public.complete_wishlist_gift(
    (select wish_id from pg_temp.wishlist_test_wishes where label = 'lifecycle'),
    (select idempotency_key from pg_temp.wishlist_test_completions where label = 'lifecycle'),
    null,
    null,
    'ignored duplicate'
  ) = (select completion_id from pg_temp.wishlist_test_completions where label = 'lifecycle')
);

select pg_temp.expect_error(
  'cross_user_archive_denied',
  'archive_not_allowed',
  format(
    'select * from public.get_fulfilled_wishlist_items_v3(%s)',
    (select id from pg_temp.wishlist_test_users where slot = 1)
  )
);

select pg_temp.set_actor((select email from pg_temp.wishlist_test_users where slot = 1));
select pg_temp.assert_true(
  'archive_contains_completed_once',
  (
    select count(*) = 1
      and max(fulfilled_by) = (select id from pg_temp.wishlist_test_users where slot = 2)
    from public.get_fulfilled_wishlist_items_v3(
      (select id from pg_temp.wishlist_test_users where slot = 1)
    )
    where id = (select wish_id from pg_temp.wishlist_test_wishes where label = 'lifecycle')
  )
);

select pg_temp.assert_true(
  'archived_excluded_from_active',
  not exists (
    select 1
    from public.get_wishlist_items_v3(
      (select id from pg_temp.wishlist_test_users where slot = 1),
      false,
      false
    )
    where id = (select wish_id from pg_temp.wishlist_test_wishes where label = 'lifecycle')
  )
);

select pg_temp.assert_true(
  'archived_available_when_requested',
  exists (
    select 1
    from public.get_wishlist_items_v3(
      (select id from pg_temp.wishlist_test_users where slot = 1),
      false,
      true
    )
    where id = (select wish_id from pg_temp.wishlist_test_wishes where label = 'lifecycle')
      and status::text = 'archived'
      and fulfilled = true
  )
);

select
  count(*) as passed_tests,
  array_agg(test_name order by test_name) as tests
from pg_temp.wishlist_test_results;

rollback;
