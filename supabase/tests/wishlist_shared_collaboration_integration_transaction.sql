-- Collaborative shared Wishlist rollback-only integration suite.

begin;

create temporary table shared_collaboration_results (
  test_name text primary key
) on commit drop;

create temporary table shared_collaboration_users on commit drop as
select row_number() over (order by id)::integer as slot, id, email
from public.users
where email is not null
order by id
limit 2;

create temporary table shared_collaboration_state (
  wish_id bigint,
  completion_key uuid,
  photo_path text
) on commit drop;

create or replace function pg_temp.sc_assert(p_name text, p_condition boolean)
returns void
language plpgsql
as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'shared_collaboration_test_failed:%', p_name;
  end if;
  insert into pg_temp.shared_collaboration_results(test_name) values (p_name);
end;
$$;

create or replace function pg_temp.sc_expect_error(
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
    raise exception 'shared_collaboration_wrong_error:% expected:% actual:%',
      p_name, p_fragment, coalesce(v_error, '<none>');
  end if;
  insert into pg_temp.shared_collaboration_results(test_name) values (p_name);
end;
$$;

create or replace function pg_temp.sc_set_actor(p_email text)
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

select pg_temp.sc_assert(
  'two_users_available',
  (select count(*) = 2 from pg_temp.shared_collaboration_users)
);

select pg_temp.sc_set_actor((select u.email from pg_temp.shared_collaboration_users u where u.slot = 1));

insert into pg_temp.shared_collaboration_state(wish_id, completion_key)
select
  public.create_wishlist_item_idempotent_v3(
    gen_random_uuid(),
    'Shared collaborative wish',
    (select u.id from pg_temp.shared_collaboration_users u where u.slot = 1),
    true,
    'Initial description',
    null,
    null,
    500,
    'dream'
  ),
  gen_random_uuid();

select pg_temp.sc_assert(
  'owner_receives_shared_capabilities',
  (
    select w.can_edit and w.can_complete and not w.can_reserve
      and w.can_delete and w.can_move
      and w.completion_mode = 'shared'
      and w.version = 1
    from public.get_wishlist_items_v3(null, true, false) w
    where w.id = (select s.wish_id from pg_temp.shared_collaboration_state s)
  )
);

select pg_temp.sc_set_actor((select u.email from pg_temp.shared_collaboration_users u where u.slot = 2));

select pg_temp.sc_assert(
  'partner_receives_shared_capabilities',
  (
    select w.can_edit and w.can_complete and not w.can_reserve
      and not w.can_delete and not w.can_move
      and w.completion_mode = 'shared'
    from public.get_wishlist_items_v3(null, true, false) w
    where w.id = (select s.wish_id from pg_temp.shared_collaboration_state s)
  )
);

select pg_temp.sc_expect_error(
  'shared_reservation_rejected',
  'shared_wish_not_reservable',
  format(
    'select public.reserve_wishlist_item(%s)',
    (select s.wish_id from pg_temp.shared_collaboration_state s)
  )
);

select pg_temp.sc_assert(
  'partner_can_edit_shared_wish',
  public.update_wishlist_item_collaborative_v3(
    (select s.wish_id from pg_temp.shared_collaboration_state s),
    1,
    'Shared collaborative wish',
    'Edited by partner',
    null,
    null,
    550,
    'high'
  ) = 2
);

select pg_temp.sc_set_actor((select u.email from pg_temp.shared_collaboration_users u where u.slot = 1));

select pg_temp.sc_expect_error(
  'stale_edit_rejected',
  'wish_version_conflict',
  format(
    $sql$select public.update_wishlist_item_collaborative_v3(
      %s, 1, 'Stale edit', null, null, null, null, 'low'
    )$sql$,
    (select s.wish_id from pg_temp.shared_collaboration_state s)
  )
);

select pg_temp.sc_assert(
  'owner_can_edit_latest_shared_version',
  public.update_wishlist_item_collaborative_v3(
    (select s.wish_id from pg_temp.shared_collaboration_state s),
    2,
    'Shared collaborative wish updated',
    'Edited by owner after refresh',
    null,
    null,
    600,
    'dream'
  ) = 3
);

select pg_temp.sc_set_actor((select u.email from pg_temp.shared_collaboration_users u where u.slot = 2));

update pg_temp.shared_collaboration_state as s
set photo_path = format(
  '%s/%s/%s/photo-deadbeef.webp',
  (select u.id from pg_temp.shared_collaboration_users u where u.slot = 2),
  s.wish_id,
  s.completion_key
);

select pg_temp.sc_assert(
  'shared_memory_upload_allowed_without_reservation',
  public.wishlist_memory_upload_allowed(
    (select s.photo_path from pg_temp.shared_collaboration_state s)
  )
);

select pg_temp.sc_assert(
  'partner_can_complete_shared_wish',
  (
    select public.complete_wishlist_gift(
      s.wish_id,
      s.completion_key,
      s.photo_path,
      null,
      'Здійснили разом'
    ) is not null
    from pg_temp.shared_collaboration_state s
  )
);

select pg_temp.sc_assert(
  'shared_completion_is_idempotent',
  (
    select public.complete_wishlist_gift(
      s.wish_id,
      s.completion_key,
      s.photo_path,
      null,
      'Ignored retry'
    ) = wgc.id
    from pg_temp.shared_collaboration_state s
    join public.wishlist_gift_completions wgc on wgc.wish_id = s.wish_id
  )
);

select pg_temp.sc_assert(
  'shared_wish_archived_with_actor',
  (
    select wi.status = 'archived'
      and wi.fulfilled
      and wi.fulfilled_by = (select u.id from pg_temp.shared_collaboration_users u where u.slot = 2)
      and wi.version = 4
    from public.wishlist_items wi
    where wi.id = (select s.wish_id from pg_temp.shared_collaboration_state s)
  )
);

select pg_temp.sc_assert(
  'shared_completion_event_created',
  exists (
    select 1
    from public.wishlist_history wh
    where wh.wish_id = (select s.wish_id from pg_temp.shared_collaboration_state s)
      and wh.event_type = 'shared_wish_completed'
      and not wh.is_private
  )
);

select pg_temp.sc_assert(
  'completed_shared_wish_removed_from_active_list',
  not exists (
    select 1
    from public.get_wishlist_items_v3(null, true, false) w
    where w.id = (select s.wish_id from pg_temp.shared_collaboration_state s)
  )
);

select
  count(*) as passed_tests,
  array_agg(test_name order by test_name) as tests
from pg_temp.shared_collaboration_results;

rollback;
