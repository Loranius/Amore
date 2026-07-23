-- Wishlist notifications rollback-only integration suite.
-- Run after 20260723_wishlist_notifications.sql.
-- Simulates two authenticated users and rolls back all wishes, history rows,
-- completions and notifications.

begin;

create temporary table notification_test_results (
  test_name text primary key
) on commit drop;

create temporary table notification_test_users on commit drop as
select
  row_number() over (order by u.id)::integer as slot,
  u.id as app_user_id,
  u.name,
  u.email,
  au.id as auth_user_id
from public.users u
join auth.users au on lower(au.email) = lower(u.email)
where u.email is not null
order by u.id
limit 2;

create temporary table notification_test_state (
  label text primary key,
  wish_id bigint not null,
  idempotency_key uuid
) on commit drop;

create or replace function pg_temp.nt_assert(
  p_test_name text,
  p_condition boolean
)
returns void
language plpgsql
as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'notification_test_failed:%', p_test_name;
  end if;

  insert into pg_temp.notification_test_results(test_name) values (p_test_name);
end;
$$;

create or replace function pg_temp.nt_expect_error(
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
    raise exception 'notification_test_expected_error_not_raised:%', p_test_name;
  end if;

  if position(lower(p_expected_fragment) in lower(v_error)) = 0 then
    raise exception 'notification_test_wrong_error:% expected:% actual:%',
      p_test_name,
      p_expected_fragment,
      v_error;
  end if;

  insert into pg_temp.notification_test_results(test_name) values (p_test_name);
end;
$$;

create or replace function pg_temp.nt_set_actor(p_slot integer)
returns void
language plpgsql
as $$
declare
  v_email text;
  v_auth_user_id uuid;
begin
  select email, auth_user_id
    into v_email, v_auth_user_id
  from pg_temp.notification_test_users
  where slot = p_slot;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', v_auth_user_id,
      'email', v_email,
      'role', 'authenticated'
    )::text,
    true
  );
end;
$$;

select pg_temp.nt_assert(
  'two_auth_users_available',
  (select count(*) = 2 from pg_temp.notification_test_users)
);

-- User 1 creates a personal wish. Only user 2 receives an event.
select pg_temp.nt_set_actor(1);

insert into pg_temp.notification_test_state(label, wish_id)
select
  'personal',
  public.create_wishlist_item_v3(
    'Notification personal wish',
    (select app_user_id from pg_temp.notification_test_users where slot = 1),
    false,
    null,
    null,
    null,
    null,
    'medium'
  );

select pg_temp.nt_assert(
  'actor_does_not_notify_self',
  public.get_app_notification_unread_count() = 0
);

select pg_temp.nt_set_actor(2);

select pg_temp.nt_assert(
  'partner_receives_new_wish',
  (
    select count(*) = 1
      and max(kind) = 'wishlist_new_wish'
      and max(href) = '/wishlist?tab=partner'
      and max(body) = 'Notification personal wish'
      and bool_and(read_at is null)
    from public.get_app_notifications(100)
    where entity_id = (select wish_id from pg_temp.notification_test_state where label = 'personal')
  )
);

select pg_temp.nt_assert(
  'new_wish_unread_counted',
  public.get_app_notification_unread_count() = 1
);

-- Direct table SELECT is also recipient-scoped by RLS.
set local role authenticated;
select pg_temp.nt_assert(
  'recipient_can_select_own_row',
  exists (
    select 1
    from public.app_notifications
    where entity_id = (select wish_id from pg_temp.notification_test_state where label = 'personal')
  )
);
reset role;

-- User 1 cannot read or mutate user 2's notification.
select pg_temp.nt_set_actor(1);
set local role authenticated;
select pg_temp.nt_assert(
  'cross_user_direct_select_hidden',
  not exists (
    select 1
    from public.app_notifications
    where entity_id = (select wish_id from pg_temp.notification_test_state where label = 'personal')
  )
);
reset role;

select pg_temp.nt_expect_error(
  'cross_user_mark_read_denied',
  'notification_not_found',
  format(
    'select public.mark_app_notification_read(%s)',
    (
      select id
      from public.app_notifications
      where recipient_id = (select app_user_id from pg_temp.notification_test_users where slot = 2)
        and entity_id = (select wish_id from pg_temp.notification_test_state where label = 'personal')
    )
  )
);

-- Recipient marks one event read.
select pg_temp.nt_set_actor(2);
select public.mark_app_notification_read(
  (
    select id
    from public.get_app_notifications(100)
    where entity_id = (select wish_id from pg_temp.notification_test_state where label = 'personal')
  )
);

select pg_temp.nt_assert(
  'mark_one_read_updates_count',
  public.get_app_notification_unread_count() = 0
);

-- Shared creation gets the shared deep link.
select pg_temp.nt_set_actor(1);
insert into pg_temp.notification_test_state(label, wish_id)
select
  'shared',
  public.create_wishlist_item_v3(
    'Notification shared wish',
    (select app_user_id from pg_temp.notification_test_users where slot = 1),
    true,
    null,
    null,
    null,
    null,
    'high'
  );

select pg_temp.nt_set_actor(2);
select pg_temp.nt_assert(
  'shared_wish_uses_shared_link',
  (
    select count(*) = 1
      and max(kind) = 'wishlist_shared_wish'
      and max(href) = '/wishlist?tab=shared'
    from public.get_app_notifications(100)
    where entity_id = (select wish_id from pg_temp.notification_test_state where label = 'shared')
  )
);

-- Moving an existing wish into Shared emits a separate deduplicated event.
select pg_temp.nt_set_actor(1);
insert into pg_temp.notification_test_state(label, wish_id)
select
  'moved',
  public.create_wishlist_item_v3(
    'Notification moved wish',
    (select app_user_id from pg_temp.notification_test_users where slot = 1),
    false,
    null,
    null,
    null,
    null,
    'low'
  );

select public.move_wishlist_item_v3(
  (select wish_id from pg_temp.notification_test_state where label = 'moved'),
  (select app_user_id from pg_temp.notification_test_users where slot = 1),
  true
);

select pg_temp.nt_set_actor(2);
select pg_temp.nt_assert(
  'move_to_shared_emits_second_event',
  (
    select count(*) = 2
      and count(*) filter (where kind = 'wishlist_new_wish') = 1
      and count(*) filter (where kind = 'wishlist_shared_wish') = 1
    from public.get_app_notifications(100)
    where entity_id = (select wish_id from pg_temp.notification_test_state where label = 'moved')
  )
);

-- Private lifecycle stages never notify the wish owner.
select pg_temp.nt_set_actor(1);
insert into pg_temp.notification_test_state(label, wish_id, idempotency_key)
select
  'completed_without_memory',
  public.create_wishlist_item_v3(
    'Notification completed gift',
    (select app_user_id from pg_temp.notification_test_users where slot = 1),
    false,
    null,
    null,
    null,
    null,
    'medium'
  ),
  gen_random_uuid();

select pg_temp.nt_set_actor(2);
select public.reserve_wishlist_item(
  (select wish_id from pg_temp.notification_test_state where label = 'completed_without_memory')
);
select public.mark_wishlist_purchased(
  (select wish_id from pg_temp.notification_test_state where label = 'completed_without_memory')
);
select public.mark_wishlist_preparing(
  (select wish_id from pg_temp.notification_test_state where label = 'completed_without_memory')
);

select pg_temp.nt_set_actor(1);
select pg_temp.nt_assert(
  'private_lifecycle_does_not_notify_owner',
  not exists (
    select 1
    from public.get_app_notifications(100)
    where entity_id = (select wish_id from pg_temp.notification_test_state where label = 'completed_without_memory')
  )
);

-- Completion without personal media/comment emits only the public gift event.
select pg_temp.nt_set_actor(2);
select public.complete_wishlist_gift(
  (select wish_id from pg_temp.notification_test_state where label = 'completed_without_memory'),
  (select idempotency_key from pg_temp.notification_test_state where label = 'completed_without_memory'),
  null,
  null,
  null
);

select pg_temp.nt_set_actor(1);
select pg_temp.nt_assert(
  'completion_without_memory_emits_one_event',
  (
    select count(*) = 1
      and max(kind) = 'wishlist_gift_completed'
      and max(href) = '/wishlist?tab=me&archive=1'
    from public.get_app_notifications(100)
    where entity_id = (select wish_id from pg_temp.notification_test_state where label = 'completed_without_memory')
  )
);

-- A completion with a comment creates both completion and Gift Memory events.
insert into pg_temp.notification_test_state(label, wish_id, idempotency_key)
select
  'completed_with_memory',
  public.create_wishlist_item_v3(
    'Notification memory gift',
    (select app_user_id from pg_temp.notification_test_users where slot = 1),
    false,
    null,
    null,
    null,
    null,
    'dream'
  ),
  gen_random_uuid();

select pg_temp.nt_set_actor(2);
select public.reserve_wishlist_item(
  (select wish_id from pg_temp.notification_test_state where label = 'completed_with_memory')
);
select public.mark_wishlist_purchased(
  (select wish_id from pg_temp.notification_test_state where label = 'completed_with_memory')
);
select public.mark_wishlist_preparing(
  (select wish_id from pg_temp.notification_test_state where label = 'completed_with_memory')
);
select public.complete_wishlist_gift(
  (select wish_id from pg_temp.notification_test_state where label = 'completed_with_memory'),
  (select idempotency_key from pg_temp.notification_test_state where label = 'completed_with_memory'),
  null,
  null,
  'Незабутній момент'
);

select pg_temp.nt_set_actor(1);
select pg_temp.nt_assert(
  'gift_memory_emits_two_public_events',
  (
    select count(*) = 2
      and count(*) filter (where kind = 'wishlist_gift_completed') = 1
      and count(*) filter (where kind = 'wishlist_gift_memory') = 1
    from public.get_app_notifications(100)
    where entity_id = (select wish_id from pg_temp.notification_test_state where label = 'completed_with_memory')
  )
);

-- Repeating an idempotent completion cannot duplicate notifications.
select pg_temp.nt_set_actor(2);
select public.complete_wishlist_gift(
  (select wish_id from pg_temp.notification_test_state where label = 'completed_with_memory'),
  (select idempotency_key from pg_temp.notification_test_state where label = 'completed_with_memory'),
  null,
  null,
  'Повторний виклик'
);

select pg_temp.nt_set_actor(1);
select pg_temp.nt_assert(
  'idempotent_completion_does_not_duplicate',
  (
    select count(*) = 2
    from public.get_app_notifications(100)
    where entity_id = (select wish_id from pg_temp.notification_test_state where label = 'completed_with_memory')
  )
);

select public.mark_all_app_notifications_read();
select pg_temp.nt_assert(
  'mark_all_read_clears_unread',
  public.get_app_notification_unread_count() = 0
);

select
  count(*) as passed_tests,
  array_agg(test_name order by test_name) as tests
from pg_temp.notification_test_results;

rollback;
