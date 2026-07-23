-- Couple-scoped Wishlist rollback-only integration suite.
-- Creates a third app user without couple membership and verifies complete
-- isolation across RPC reads, commands, Storage RLS and notifications.

begin;

create temporary table couple_scope_results (
  test_name text primary key
) on commit drop;

create temporary table couple_scope_users on commit drop as
select
  row_number() over (order by u.id)::integer as slot,
  u.id as app_user_id,
  u.email,
  au.id as auth_user_id
from public.users u
join auth.users au on lower(au.email) = lower(u.email)
where u.email is not null
order by u.id
limit 2;

create temporary table couple_scope_state (
  outsider_id integer,
  outsider_email text,
  wish_id bigint,
  completion_key uuid,
  photo_path text
) on commit drop;

grant select, insert on pg_temp.couple_scope_results to authenticated;
grant select on pg_temp.couple_scope_users to authenticated;
grant select on pg_temp.couple_scope_state to authenticated;

create or replace function pg_temp.cs_assert(p_name text, p_condition boolean)
returns void
language plpgsql
as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'couple_scope_test_failed:%', p_name;
  end if;
  insert into pg_temp.couple_scope_results(test_name) values (p_name);
end;
$$;

create or replace function pg_temp.cs_expect_error(
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
    raise exception 'couple_scope_wrong_error:% expected:% actual:%',
      p_name,
      p_fragment,
      coalesce(v_error, '<none>');
  end if;

  insert into pg_temp.couple_scope_results(test_name) values (p_name);
end;
$$;

create or replace function pg_temp.cs_set_actor(
  p_email text,
  p_auth_user_id uuid default null
)
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    jsonb_strip_nulls(jsonb_build_object(
      'sub', p_auth_user_id,
      'email', p_email,
      'role', 'authenticated'
    ))::text,
    true
  );
end;
$$;

select pg_temp.cs_assert(
  'two_auth_users_available',
  (select count(*) = 2 from pg_temp.couple_scope_users)
);

insert into public.users(name, pin_hash, email)
values ('Rollback Outsider', 'rollback-only-hash', 'wishlist-outsider@example.invalid')
returning id, email;

insert into pg_temp.couple_scope_state(outsider_id, outsider_email)
select u.id, u.email
from public.users u
where u.email = 'wishlist-outsider@example.invalid';

select pg_temp.cs_assert(
  'existing_users_have_auth_uid_links',
  not exists (
    select 1
    from pg_temp.couple_scope_users u
    join public.users pu on pu.id = u.app_user_id
    where pu.auth_user_id is distinct from u.auth_user_id
  )
);

-- auth.uid() must win even when the email claim is wrong.
select pg_temp.cs_set_actor(
  'wishlist-outsider@example.invalid',
  (select u.auth_user_id from pg_temp.couple_scope_users u where u.slot = 1)
);

select pg_temp.cs_assert(
  'auth_uid_precedes_email_fallback',
  app_private.current_app_user_id()
    = (select u.app_user_id from pg_temp.couple_scope_users u where u.slot = 1)
);

select pg_temp.cs_assert(
  'two_real_users_share_one_couple',
  (
    select count(distinct cm.couple_id) = 1
    from public.couple_members cm
    join pg_temp.couple_scope_users u on u.app_user_id = cm.user_id
  )
);

select pg_temp.cs_assert(
  'outsider_has_no_couple_membership',
  not exists (
    select 1
    from public.couple_members cm
    where cm.user_id = (select s.outsider_id from pg_temp.couple_scope_state s)
  )
);

insert into pg_temp.couple_scope_state(wish_id, completion_key)
select
  public.create_wishlist_item_idempotent_v3(
    gen_random_uuid(),
    'Couple scoped shared wish',
    (select u.app_user_id from pg_temp.couple_scope_users u where u.slot = 1),
    true,
    'Only this couple may access it',
    null,
    null,
    700,
    'dream'
  ),
  gen_random_uuid();

select pg_temp.cs_assert(
  'new_wish_inherits_current_couple_and_creator',
  (
    select wi.couple_id = app_private.current_couple_id()
      and wi.created_by = (select u.app_user_id from pg_temp.couple_scope_users u where u.slot = 1)
    from public.wishlist_items wi
    where wi.id = (select s.wish_id from pg_temp.couple_scope_state s)
  )
);

select pg_temp.cs_assert(
  'outsider_never_receives_create_notification',
  not exists (
    select 1
    from public.app_notifications n
    where n.entity_id = (select s.wish_id from pg_temp.couple_scope_state s)
      and n.recipient_id = (select s.outsider_id from pg_temp.couple_scope_state s)
  )
);

select pg_temp.cs_expect_error(
  'cannot_create_wish_for_outsider',
  'wishlist_owner_outside_couple',
  format(
    $sql$select public.create_wishlist_item_idempotent_v3(
      gen_random_uuid(), 'Foreign owner', %s, false,
      null, null, null, null, 'low'
    )$sql$,
    (select s.outsider_id from pg_temp.couple_scope_state s)
  )
);

-- User 2 is a real couple member and keeps collaborative access.
select pg_temp.cs_set_actor(
  (select u.email from pg_temp.couple_scope_users u where u.slot = 2),
  (select u.auth_user_id from pg_temp.couple_scope_users u where u.slot = 2)
);

select pg_temp.cs_assert(
  'partner_sees_shared_wish',
  exists (
    select 1
    from public.get_wishlist_items_v3(null, true, false) w
    where w.id = (select s.wish_id from pg_temp.couple_scope_state s)
      and w.can_edit
      and w.can_complete
  )
);

select pg_temp.cs_assert(
  'partner_can_edit_shared_wish',
  public.update_wishlist_item_collaborative_v3(
    (select s.wish_id from pg_temp.couple_scope_state s),
    1,
    'Couple scoped shared wish',
    'Edited by partner',
    null,
    null,
    750,
    'high'
  ) = 2
);

update pg_temp.couple_scope_state as s
set photo_path = format(
  '%s/%s/%s/photo-deadbeef.webp',
  (select u.app_user_id from pg_temp.couple_scope_users u where u.slot = 2),
  s.wish_id,
  s.completion_key
);

set local role authenticated;
insert into storage.objects(bucket_id, name, owner_id, metadata)
select 'wishlist-memories', s.photo_path, auth.uid()::text, '{}'::jsonb
from pg_temp.couple_scope_state s;
reset role;

-- The outsider resolves as an app user through the transitional email fallback,
-- but has no couple and therefore no Wishlist authority.
select pg_temp.cs_set_actor(
  (select s.outsider_email from pg_temp.couple_scope_state s),
  null
);

select pg_temp.cs_assert(
  'outsider_identity_resolves_without_membership',
  app_private.current_app_user_id()
    = (select s.outsider_id from pg_temp.couple_scope_state s)
  and app_private.current_couple_id() is null
);

select pg_temp.cs_expect_error(
  'outsider_shared_list_denied',
  'couple_membership_required',
  'select * from public.get_wishlist_items_v3(null, true, false)'
);

select pg_temp.cs_expect_error(
  'outsider_stats_denied',
  'couple_membership_required',
  'select * from public.get_wishlist_stats_v3()'
);

select pg_temp.cs_expect_error(
  'outsider_shared_archive_denied',
  'couple_membership_required',
  'select * from public.get_shared_wishlist_archive_v3()'
);

select pg_temp.cs_expect_error(
  'outsider_edit_denied_before_state_evaluation',
  'couple_membership_required',
  format(
    $sql$select public.update_wishlist_item_collaborative_v3(
      %s, 2, 'Outsider edit', null, null, null, null, 'low'
    )$sql$,
    (select s.wish_id from pg_temp.couple_scope_state s)
  )
);

select pg_temp.cs_expect_error(
  'outsider_reserve_denied_before_state_evaluation',
  'couple_membership_required',
  format(
    'select public.reserve_wishlist_item(%s)',
    (select s.wish_id from pg_temp.couple_scope_state s)
  )
);

select pg_temp.cs_expect_error(
  'outsider_complete_denied_before_state_evaluation',
  'couple_membership_required',
  format(
    $sql$select public.complete_wishlist_gift(
      %s, gen_random_uuid(), null, null, null
    )$sql$,
    (select s.wish_id from pg_temp.couple_scope_state s)
  )
);

select pg_temp.cs_assert(
  'outsider_storage_helpers_all_deny',
  not public.wishlist_memory_upload_allowed(
    (select s.photo_path from pg_temp.couple_scope_state s)
  )
  and not public.wishlist_memory_read_allowed(
    (select s.photo_path from pg_temp.couple_scope_state s)
  )
  and not public.wishlist_memory_delete_allowed(
    (select s.photo_path from pg_temp.couple_scope_state s)
  )
);

set local role authenticated;
select pg_temp.cs_assert(
  'outsider_storage_select_returns_nothing',
  not exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'wishlist-memories'
      and o.name = (select s.photo_path from pg_temp.couple_scope_state s)
  )
);
reset role;

-- Partner completes; only the other member of the same couple is notified.
select pg_temp.cs_set_actor(
  (select u.email from pg_temp.couple_scope_users u where u.slot = 2),
  (select u.auth_user_id from pg_temp.couple_scope_users u where u.slot = 2)
);

select public.complete_wishlist_gift(
  s.wish_id,
  s.completion_key,
  s.photo_path,
  null,
  'Couple scoped completion'
)
from pg_temp.couple_scope_state s;

select pg_temp.cs_assert(
  'completion_notification_stays_inside_couple',
  (
    select count(*) = 1
      and bool_and(n.recipient_id = (select u.app_user_id from pg_temp.couple_scope_users u where u.slot = 1))
    from public.app_notifications n
    where n.entity_id = (select s.wish_id from pg_temp.couple_scope_state s)
      and n.kind = 'wishlist_shared_completed'
  )
  and not exists (
    select 1
    from public.app_notifications n
    where n.entity_id = (select s.wish_id from pg_temp.couple_scope_state s)
      and n.recipient_id = (select s.outsider_id from pg_temp.couple_scope_state s)
  )
);

select pg_temp.cs_set_actor(
  (select u.email from pg_temp.couple_scope_users u where u.slot = 1),
  (select u.auth_user_id from pg_temp.couple_scope_users u where u.slot = 1)
);

select pg_temp.cs_assert(
  'member_reads_completed_shared_archive_and_media',
  exists (
    select 1
    from public.get_shared_wishlist_archive_v3() a
    join pg_temp.couple_scope_state s on s.wish_id = a.id
    where a.reaction_photo_path = s.photo_path
  )
  and public.wishlist_memory_read_allowed(
    (select s.photo_path from pg_temp.couple_scope_state s)
  )
);

select pg_temp.cs_set_actor(
  (select s.outsider_email from pg_temp.couple_scope_state s),
  null
);

select pg_temp.cs_expect_error(
  'outsider_archive_remains_denied_after_completion',
  'couple_membership_required',
  'select * from public.get_shared_wishlist_archive_v3()'
);

select pg_temp.cs_assert(
  'outsider_media_remains_denied_after_completion',
  not public.wishlist_memory_read_allowed(
    (select s.photo_path from pg_temp.couple_scope_state s)
  )
);

select
  count(*) as passed_tests,
  array_agg(test_name order by test_name) as tests
from pg_temp.couple_scope_results;

rollback;
