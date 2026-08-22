-- Secret Wishlist rollback-only integration suite.
-- Run after 20260822070000_wishlist_secret_wishes.sql.

begin;

create temporary table secret_wishlist_results (
  test_name text primary key
) on commit drop;

create temporary table secret_wishlist_users on commit drop as
select row_number() over (order by u.id)::integer as slot, u.id, u.email
from public.users u
where u.email is not null
order by u.id
limit 2;

create temporary table secret_wishlist_state (
  request_id uuid not null,
  wish_id bigint,
  stats_before bigint
) on commit drop;

insert into pg_temp.secret_wishlist_state(request_id)
values (gen_random_uuid());

create or replace function pg_temp.sw_assert(p_name text, p_condition boolean)
returns void
language plpgsql
as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'secret_wishlist_test_failed:%', p_name;
  end if;
  insert into pg_temp.secret_wishlist_results(test_name) values (p_name);
end;
$$;

create or replace function pg_temp.sw_expect_error(
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
  begin
    execute p_sql;
  exception when others then
    v_error := sqlerrm;
  end;

  if v_error is null or position(lower(p_fragment) in lower(v_error)) = 0 then
    raise exception 'secret_wishlist_wrong_error:% expected:% actual:%',
      p_name,
      p_fragment,
      coalesce(v_error, '<none>');
  end if;

  insert into pg_temp.secret_wishlist_results(test_name) values (p_name);
end;
$$;

create or replace function pg_temp.sw_set_actor(p_email text)
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

select pg_temp.sw_assert(
  'two_users_available',
  (select count(*) = 2 from pg_temp.secret_wishlist_users)
);

select pg_temp.sw_set_actor(
  (select u.email from pg_temp.secret_wishlist_users u where u.slot = 1)
);

update pg_temp.secret_wishlist_state
set stats_before = (select s.total from public.get_wishlist_stats_v3() s);

update pg_temp.secret_wishlist_state s
set wish_id = public.create_wishlist_item_idempotent_v5(
  s.request_id,
  'Rollback-only secret wish',
  (select u.id from pg_temp.secret_wishlist_users u where u.slot = 1),
  false,
  true,
  'Visible to creator only',
  null,
  null,
  120,
  'medium',
  'auto'
);

select pg_temp.sw_assert(
  'secret_shape_is_personal_and_creator_owned',
  exists (
    select 1
    from public.wishlist_items wi
    where wi.id = (select s.wish_id from pg_temp.secret_wishlist_state s)
      and wi.is_secret
      and not wi.is_shared
      and wi.owner = wi.created_by
      and wi.created_by = (
        select u.id from pg_temp.secret_wishlist_users u where u.slot = 1
      )
  )
);

select pg_temp.sw_assert(
  'creator_reads_secret_rpc',
  exists (
    select 1
    from public.get_secret_wishlist_items_v1() w
    where w.id = (select s.wish_id from pg_temp.secret_wishlist_state s)
      and w.title = 'Rollback-only secret wish'
      and w.can_edit
      and w.can_delete
      and not w.can_move
      and not w.can_reserve
      and not w.can_complete
  )
);

select pg_temp.sw_assert(
  'visible_rpc_excludes_secret_for_creator',
  not exists (
    select 1
    from public.get_wishlist_items_v3(
      (select u.id from pg_temp.secret_wishlist_users u where u.slot = 1),
      false,
      false
    ) w
    where w.id = (select s.wish_id from pg_temp.secret_wishlist_state s)
  )
);

select pg_temp.sw_assert(
  'secret_does_not_change_pair_stats',
  (
    select stats_before = (select stats.total from public.get_wishlist_stats_v3() stats)
    from pg_temp.secret_wishlist_state
  )
);

select pg_temp.sw_assert(
  'secret_history_is_private',
  exists (
    select 1
    from public.wishlist_history wh
    where wh.wish_id = (select s.wish_id from pg_temp.secret_wishlist_state s)
      and wh.event_type = 'wish_created'
      and wh.is_private
  )
);

select pg_temp.sw_assert(
  'secret_create_emits_no_in_app_notification',
  not exists (
    select 1
    from public.app_notifications n
    where n.entity_id = (select s.wish_id from pg_temp.secret_wishlist_state s)
  )
);

select pg_temp.sw_assert(
  'secret_create_is_idempotent',
  (
    select public.create_wishlist_item_idempotent_v5(
      s.request_id,
      'Rollback-only secret wish',
      (select u.id from pg_temp.secret_wishlist_users u where u.slot = 1),
      false,
      true,
      'Visible to creator only',
      null,
      'https://example.com/retry-image.webp',
      120,
      'medium',
      'auto'
    ) = s.wish_id
    from pg_temp.secret_wishlist_state s
  )
);

select pg_temp.sw_expect_error(
  'secret_cannot_target_partner',
  'secret_wish_must_be_personal',
  format(
    $sql$select public.create_wishlist_item_idempotent_v5(
      gen_random_uuid(), 'Invalid secret owner', %s, false, true,
      null, null, null, null, null, 'auto'
    )$sql$,
    (select u.id from pg_temp.secret_wishlist_users u where u.slot = 2)
  )
);

select pg_temp.sw_expect_error(
  'secret_cannot_be_shared',
  'secret_wish_must_be_personal',
  format(
    $sql$select public.create_wishlist_item_idempotent_v5(
      gen_random_uuid(), 'Invalid shared secret', %s, true, true,
      null, null, null, null, null, 'auto'
    )$sql$,
    (select u.id from pg_temp.secret_wishlist_users u where u.slot = 1)
  )
);

select pg_temp.sw_set_actor(
  (select u.email from pg_temp.secret_wishlist_users u where u.slot = 2)
);

select pg_temp.sw_assert(
  'partner_visible_rpc_excludes_secret',
  not exists (
    select 1
    from public.get_wishlist_items_v3(
      (select u.id from pg_temp.secret_wishlist_users u where u.slot = 1),
      false,
      false
    ) w
    where w.id = (select s.wish_id from pg_temp.secret_wishlist_state s)
  )
);

select pg_temp.sw_assert(
  'partner_secret_rpc_is_creator_scoped',
  not exists (
    select 1
    from public.get_secret_wishlist_items_v1() w
    where w.id = (select s.wish_id from pg_temp.secret_wishlist_state s)
  )
);

select pg_temp.sw_expect_error(
  'partner_cannot_edit_guessed_secret_id',
  'secret_wish_not_found',
  format(
    $sql$select public.update_wishlist_item_collaborative_v4(
      %s, 1, 'Leaked edit', null, null, null, null, 'low', 'auto'
    )$sql$,
    (select s.wish_id from pg_temp.secret_wishlist_state s)
  )
);

select pg_temp.sw_expect_error(
  'partner_cannot_reserve_guessed_secret_id',
  'secret_wish_not_found',
  format(
    'select public.reserve_wishlist_item(%s)',
    (select s.wish_id from pg_temp.secret_wishlist_state s)
  )
);

select pg_temp.sw_set_actor(
  (select u.email from pg_temp.secret_wishlist_users u where u.slot = 1)
);

select pg_temp.sw_assert(
  'creator_can_edit_secret',
  public.update_wishlist_item_collaborative_v4(
    (select s.wish_id from pg_temp.secret_wishlist_state s),
    1,
    'Edited secret wish',
    'Still creator-only',
    null,
    null,
    150,
    'high',
    'auto'
  ) = 2
);

select pg_temp.sw_assert(
  'creator_reads_updated_secret',
  exists (
    select 1
    from public.get_secret_wishlist_items_v1() w
    where w.id = (select s.wish_id from pg_temp.secret_wishlist_state s)
      and w.title = 'Edited secret wish'
      and w.version = 2
  )
);

select pg_temp.sw_expect_error(
  'secret_cannot_be_moved',
  'secret_wish_not_movable',
  format(
    'select public.move_wishlist_item_v3(%s, %s, false)',
    (select s.wish_id from pg_temp.secret_wishlist_state s),
    (select u.id from pg_temp.secret_wishlist_users u where u.slot = 2)
  )
);

select public.soft_delete_wishlist_item_v3(
  (select s.wish_id from pg_temp.secret_wishlist_state s)
);

select pg_temp.sw_assert(
  'creator_can_delete_secret',
  not exists (
    select 1
    from public.get_secret_wishlist_items_v1() w
    where w.id = (select s.wish_id from pg_temp.secret_wishlist_state s)
  )
);

select test_name
from pg_temp.secret_wishlist_results
order by test_name;

rollback;
