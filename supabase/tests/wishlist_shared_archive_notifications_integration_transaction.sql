-- Shared Archive, Storage read and notification rollback-only suite.

begin;

create temporary table shared_archive_results (
  test_name text primary key
) on commit drop;

create temporary table shared_archive_users on commit drop as
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

create temporary table shared_archive_state (
  wish_id bigint,
  completion_key uuid,
  photo_path text
) on commit drop;

grant select, insert on pg_temp.shared_archive_results to authenticated;
grant select on pg_temp.shared_archive_users to authenticated;
grant select on pg_temp.shared_archive_state to authenticated;

create or replace function pg_temp.sa_assert(p_name text, p_condition boolean)
returns void
language plpgsql
as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'shared_archive_test_failed:%', p_name;
  end if;
  insert into pg_temp.shared_archive_results(test_name) values (p_name);
end;
$$;

create or replace function pg_temp.sa_set_actor(
  p_email text,
  p_auth_user_id uuid
)
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', p_auth_user_id,
      'email', p_email,
      'role', 'authenticated'
    )::text,
    true
  );
end;
$$;

select pg_temp.sa_assert(
  'two_auth_users_available',
  (select count(*) = 2 from pg_temp.shared_archive_users)
);

-- User 1 creates a shared wish.
select pg_temp.sa_set_actor(
  (select u.email from pg_temp.shared_archive_users u where u.slot = 1),
  (select u.auth_user_id from pg_temp.shared_archive_users u where u.slot = 1)
);

insert into pg_temp.shared_archive_state(wish_id, completion_key)
select
  public.create_wishlist_item_idempotent_v3(
    gen_random_uuid(),
    'Shared archive integration wish',
    (select u.app_user_id from pg_temp.shared_archive_users u where u.slot = 1),
    true,
    'Shared Archive contract',
    null,
    null,
    300,
    'dream'
  ),
  gen_random_uuid();

-- Ignore the create notification; this suite isolates completion behavior.
delete from public.app_notifications n
where n.entity_id = (select s.wish_id from pg_temp.shared_archive_state s);

-- User 2 uploads the exact shared-memory path before completion.
select pg_temp.sa_set_actor(
  (select u.email from pg_temp.shared_archive_users u where u.slot = 2),
  (select u.auth_user_id from pg_temp.shared_archive_users u where u.slot = 2)
);

update pg_temp.shared_archive_state as s
set photo_path = format(
  '%s/%s/%s/photo-deadbeef.webp',
  (select u.app_user_id from pg_temp.shared_archive_users u where u.slot = 2),
  s.wish_id,
  s.completion_key
);

set local role authenticated;

insert into storage.objects(bucket_id, name, owner_id, metadata)
select
  'wishlist-memories',
  s.photo_path,
  auth.uid()::text,
  '{}'::jsonb
from pg_temp.shared_archive_state s;

reset role;

select public.complete_wishlist_gift(
  s.wish_id,
  s.completion_key,
  s.photo_path,
  null,
  'Ми здійснили це разом'
)
from pg_temp.shared_archive_state s;

select pg_temp.sa_assert(
  'one_shared_completion_notification_created',
  (
    select count(*) = 1
    from public.app_notifications n
    where n.entity_id = (select s.wish_id from pg_temp.shared_archive_state s)
      and n.recipient_id = (select u.app_user_id from pg_temp.shared_archive_users u where u.slot = 1)
      and n.actor_id = (select u.app_user_id from pg_temp.shared_archive_users u where u.slot = 2)
      and n.kind = 'wishlist_shared_completed'
      and n.href = '/wishlist?tab=shared&archive=1'
  )
);

select pg_temp.sa_assert(
  'shared_memory_event_does_not_duplicate_notification',
  not exists (
    select 1
    from public.app_notifications n
    where n.entity_id = (select s.wish_id from pg_temp.shared_archive_state s)
      and n.kind = 'wishlist_gift_memory'
  )
);

select pg_temp.sa_assert(
  'actor_receives_no_self_notification',
  not exists (
    select 1
    from public.app_notifications n
    where n.entity_id = (select s.wish_id from pg_temp.shared_archive_state s)
      and n.recipient_id = (select u.app_user_id from pg_temp.shared_archive_users u where u.slot = 2)
  )
);

select pg_temp.sa_assert(
  'completer_reads_shared_archive',
  exists (
    select 1
    from public.get_shared_wishlist_archive_v3() a
    join pg_temp.shared_archive_state s on s.wish_id = a.id
    where a.reaction_photo_path = s.photo_path
      and a.memory_comment = 'Ми здійснили це разом'
  )
);

select pg_temp.sa_assert(
  'uploader_reads_committed_path',
  public.wishlist_memory_read_allowed(
    (select s.photo_path from pg_temp.shared_archive_state s)
  )
);

-- User 1 sees the same Shared Archive and exact committed private object.
select pg_temp.sa_set_actor(
  (select u.email from pg_temp.shared_archive_users u where u.slot = 1),
  (select u.auth_user_id from pg_temp.shared_archive_users u where u.slot = 1)
);

select pg_temp.sa_assert(
  'other_participant_reads_shared_archive',
  exists (
    select 1
    from public.get_shared_wishlist_archive_v3() a
    join pg_temp.shared_archive_state s on s.wish_id = a.id
    where a.fulfilled_by = (select u.app_user_id from pg_temp.shared_archive_users u where u.slot = 2)
      and a.reaction_photo_path = s.photo_path
  )
);

select pg_temp.sa_assert(
  'shared_wish_excluded_from_personal_archive',
  not exists (
    select 1
    from public.get_fulfilled_wishlist_items_v3(
      (select u.app_user_id from pg_temp.shared_archive_users u where u.slot = 1)
    ) a
    where a.id = (select s.wish_id from pg_temp.shared_archive_state s)
  )
);

select pg_temp.sa_assert(
  'other_participant_reads_exact_committed_path',
  public.wishlist_memory_read_allowed(
    (select s.photo_path from pg_temp.shared_archive_state s)
  )
);

select pg_temp.sa_assert(
  'uncommitted_sibling_path_denied',
  not public.wishlist_memory_read_allowed(
    replace(
      (select s.photo_path from pg_temp.shared_archive_state s),
      'deadbeef',
      'a1b2c3d4'
    )
  )
);

set local role authenticated;

select pg_temp.sa_assert(
  'storage_select_returns_exact_shared_object',
  (
    select count(*) = 1
    from storage.objects o
    join pg_temp.shared_archive_state s on s.photo_path = o.name
    where o.bucket_id = 'wishlist-memories'
  )
);

reset role;

select
  count(*) as passed_tests,
  array_agg(test_name order by test_name) as tests
from pg_temp.shared_archive_results;

rollback;
