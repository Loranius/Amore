-- Rollback-only integration suite for the simplified personal gift lifecycle.
-- Verifies visible -> reserved -> purchased -> archived and legacy completion
-- from preparing_surprise. No production rows remain after the final rollback.

begin;

create temporary table wishlist_three_step_results (
  test_name text primary key
) on commit drop;

create temporary table wishlist_three_step_users on commit drop as
select row_number() over (order by id)::integer as slot, id, email
from public.users
where email is not null
order by id
limit 2;

create or replace function pg_temp.assert_true(p_test_name text, p_condition boolean)
returns void
language plpgsql
as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'wishlist_three_step_failed:%', p_test_name;
  end if;
  insert into pg_temp.wishlist_three_step_results(test_name) values (p_test_name);
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

  if v_error is null or position(p_expected_fragment in v_error) = 0 then
    raise exception 'wishlist_three_step_wrong_error:% expected:% actual:%',
      p_test_name, p_expected_fragment, coalesce(v_error, '<none>');
  end if;

  insert into pg_temp.wishlist_three_step_results(test_name) values (p_test_name);
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
  (select count(*) = 2 from pg_temp.wishlist_three_step_users)
);

-- New three-step route.
select pg_temp.set_actor((select email from pg_temp.wishlist_three_step_users where slot = 1));
create temporary table wishlist_three_step_ids on commit drop as
select public.create_wishlist_item_v3(
  'Three-step gift test',
  (select id from pg_temp.wishlist_three_step_users where slot = 1),
  false,
  'rollback-only',
  null,
  null,
  null,
  'medium'
) as wish_id,
gen_random_uuid() as completion_key;

select pg_temp.set_actor((select email from pg_temp.wishlist_three_step_users where slot = 2));
select public.reserve_wishlist_item((select wish_id from pg_temp.wishlist_three_step_ids));

select pg_temp.expect_error(
  'reserved_cannot_complete',
  'wish_not_completable',
  format(
    'select public.complete_wishlist_gift(%s, %L::uuid, null, null, null)',
    (select wish_id from pg_temp.wishlist_three_step_ids),
    gen_random_uuid()::text
  )
);

select public.mark_wishlist_purchased((select wish_id from pg_temp.wishlist_three_step_ids));

select pg_temp.assert_true(
  'purchased_visible_to_reserver',
  (
    select status::text = 'purchased' and reserved_by =
      (select id from pg_temp.wishlist_three_step_users where slot = 2)
    from public.get_wishlist_items_v3(
      (select id from pg_temp.wishlist_three_step_users where slot = 1),
      false,
      false
    )
    where id = (select wish_id from pg_temp.wishlist_three_step_ids)
  )
);

create temporary table wishlist_three_step_completion on commit drop as
select public.complete_wishlist_gift(
  (select wish_id from pg_temp.wishlist_three_step_ids),
  (select completion_key from pg_temp.wishlist_three_step_ids),
  null,
  null,
  null
) as completion_id;

select pg_temp.assert_true(
  'purchased_completes_directly',
  (
    select wi.status::text = 'archived'
      and wi.fulfilled
      and wi.fulfilled_by = (select id from pg_temp.wishlist_three_step_users where slot = 2)
      and not wi.reserved
      and wi.reserved_by is null
    from public.wishlist_items wi
    where wi.id = (select wish_id from pg_temp.wishlist_three_step_ids)
  )
);

select pg_temp.assert_true(
  'quick_completion_is_idempotent',
  public.complete_wishlist_gift(
    (select wish_id from pg_temp.wishlist_three_step_ids),
    (select completion_key from pg_temp.wishlist_three_step_ids),
    null,
    null,
    null
  ) = (select completion_id from pg_temp.wishlist_three_step_completion)
);

select pg_temp.assert_true(
  'history_starts_from_purchased',
  exists (
    select 1
    from public.wishlist_history wh
    where wh.wish_id = (select wish_id from pg_temp.wishlist_three_step_ids)
      and wh.event_type = 'gift_completed'
      and wh.from_status::text = 'purchased'
      and wh.to_status::text = 'gifted'
  )
);

select pg_temp.assert_true(
  'completion_has_optional_empty_memory',
  exists (
    select 1
    from public.wishlist_gift_completions wgc
    where wgc.id = (select completion_id from pg_temp.wishlist_three_step_completion)
      and wgc.reaction_photo is null
      and wgc.reaction_video is null
      and wgc.comment is null
  )
);

-- Legacy route remains completable for an already in-flight old client.
select pg_temp.set_actor((select email from pg_temp.wishlist_three_step_users where slot = 1));
create temporary table wishlist_legacy_completion_ids on commit drop as
select public.create_wishlist_item_v3(
  'Legacy preparing gift test',
  (select id from pg_temp.wishlist_three_step_users where slot = 1),
  false,
  'rollback-only',
  null,
  null,
  null,
  'low'
) as wish_id,
gen_random_uuid() as completion_key;

select pg_temp.set_actor((select email from pg_temp.wishlist_three_step_users where slot = 2));
select public.reserve_wishlist_item((select wish_id from pg_temp.wishlist_legacy_completion_ids));
select public.mark_wishlist_purchased((select wish_id from pg_temp.wishlist_legacy_completion_ids));
select public.mark_wishlist_preparing((select wish_id from pg_temp.wishlist_legacy_completion_ids));
select public.complete_wishlist_gift(
  (select wish_id from pg_temp.wishlist_legacy_completion_ids),
  (select completion_key from pg_temp.wishlist_legacy_completion_ids),
  null,
  null,
  'legacy compatibility'
);

select pg_temp.assert_true(
  'legacy_preparing_still_completes',
  exists (
    select 1
    from public.wishlist_items wi
    where wi.id = (select wish_id from pg_temp.wishlist_legacy_completion_ids)
      and wi.status::text = 'archived'
  )
  and exists (
    select 1
    from public.wishlist_history wh
    where wh.wish_id = (select wish_id from pg_temp.wishlist_legacy_completion_ids)
      and wh.event_type = 'gift_completed'
      and wh.from_status::text = 'preparing_surprise'
  )
);

select test_name
from pg_temp.wishlist_three_step_results
order by test_name;

rollback;
