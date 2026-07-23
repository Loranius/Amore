-- Storage RLS rollback-only integration suite.
-- Exercises policy predicates as the real authenticated Postgres role and rolls
-- back every temporary wish/object/completion.
--
-- Hosted Supabase protects direct SQL DELETE on storage.objects with
-- storage.protect_delete(); actual deletes must go through the Storage API.
-- Therefore DELETE policy behavior is verified through the exact policy/helper
-- predicates rather than issuing a forbidden direct table delete.

begin;

create temporary table storage_test_results (
  test_name text primary key
) on commit drop;

create temporary table storage_test_users on commit drop as
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

create temporary table storage_test_state (
  wish_id bigint,
  idempotency_key uuid,
  memory_path text,
  shared_path text
) on commit drop;

grant select, insert on pg_temp.storage_test_results to authenticated;
grant select on pg_temp.storage_test_users to authenticated;
grant select on pg_temp.storage_test_state to authenticated;

create or replace function pg_temp.assert_true(
  p_test_name text,
  p_condition boolean
)
returns void
language plpgsql
as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'storage_test_failed:%', p_test_name;
  end if;

  insert into pg_temp.storage_test_results(test_name) values (p_test_name);
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
    raise exception 'storage_test_expected_error_not_raised:%', p_test_name;
  end if;

  if position(lower(p_expected_fragment) in lower(v_error)) = 0 then
    raise exception 'storage_test_wrong_error:% expected:% actual:%',
      p_test_name,
      p_expected_fragment,
      v_error;
  end if;

  insert into pg_temp.storage_test_results(test_name) values (p_test_name);
end;
$$;

create or replace function pg_temp.set_actor(
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

select pg_temp.assert_true(
  'two_auth_users_available',
  (select count(*) = 2 from pg_temp.storage_test_users)
);

select pg_temp.assert_true(
  'blanket_policy_removed',
  not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'auth_storage_full'
  )
);

select pg_temp.assert_true(
  'seven_explicit_policies_present',
  (
    select count(*) = 7
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in (
        'storage_shared_assets_select',
        'storage_shared_assets_insert',
        'storage_shared_assets_update',
        'storage_shared_assets_delete',
        'wishlist_memories_select',
        'wishlist_memories_insert',
        'wishlist_memories_delete'
      )
  )
);

select pg_temp.assert_true(
  'shared_delete_policy_is_bucket_scoped',
  exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_shared_assets_delete'
      and cmd = 'DELETE'
      and qual ilike '%family_photos%'
      and qual ilike '%wishlist-photos%'
      and qual not ilike '%wishlist-memories%'
  )
);

-- Owner creates a wish; partner takes it through preparing_surprise.
select pg_temp.set_actor(
  (select email from pg_temp.storage_test_users where slot = 1),
  (select auth_user_id from pg_temp.storage_test_users where slot = 1)
);

insert into pg_temp.storage_test_state(wish_id, idempotency_key)
select
  public.create_wishlist_item_v3(
    'Storage RLS integration wish',
    (select app_user_id from pg_temp.storage_test_users where slot = 1),
    false,
    null,
    null,
    null,
    null,
    'medium'
  ),
  gen_random_uuid();

select pg_temp.set_actor(
  (select email from pg_temp.storage_test_users where slot = 2),
  (select auth_user_id from pg_temp.storage_test_users where slot = 2)
);

select public.reserve_wishlist_item((select wish_id from pg_temp.storage_test_state));
select public.mark_wishlist_purchased((select wish_id from pg_temp.storage_test_state));
select public.mark_wishlist_preparing((select wish_id from pg_temp.storage_test_state));

update pg_temp.storage_test_state
set memory_path = format(
      '%s/%s/%s/photo.webp',
      (select app_user_id from pg_temp.storage_test_users where slot = 2),
      wish_id,
      idempotency_key
    ),
    shared_path = format('rls-test-%s.webp', idempotency_key);

-- Test the actual RLS policies as authenticated, not as postgres.
set local role authenticated;

select pg_temp.expect_error(
  'reject_foreign_memory_prefix',
  'row-level security',
  format(
    $sql$
      insert into storage.objects(bucket_id, name, owner_id, metadata)
      values ('wishlist-memories', '%s', auth.uid()::text, '{}'::jsonb)
    $sql$,
    format(
      '999999/%s/%s/photo.webp',
      (select wish_id from pg_temp.storage_test_state),
      (select idempotency_key from pg_temp.storage_test_state)
    )
  )
);

insert into storage.objects(bucket_id, name, owner_id, metadata)
select
  'wishlist-memories',
  memory_path,
  auth.uid()::text,
  '{}'::jsonb
from pg_temp.storage_test_state;

select pg_temp.assert_true(
  'uploader_can_read_uncommitted_memory',
  exists (
    select 1
    from storage.objects
    where bucket_id = 'wishlist-memories'
      and name = (select memory_path from pg_temp.storage_test_state)
  )
);

select pg_temp.assert_true(
  'uploader_cleanup_allowed_before_completion',
  public.wishlist_memory_delete_allowed(
    (select memory_path from pg_temp.storage_test_state)
  )
);

insert into storage.objects(bucket_id, name, owner_id, metadata)
select
  'wishlist-photos',
  shared_path,
  auth.uid()::text,
  '{}'::jsonb
from pg_temp.storage_test_state;

select pg_temp.assert_true(
  'shared_bucket_insert_select_works',
  exists (
    select 1
    from storage.objects
    where bucket_id = 'wishlist-photos'
      and name = (select shared_path from pg_temp.storage_test_state)
  )
);

reset role;

-- Before completion the wish owner cannot read the uploader's private object.
select pg_temp.set_actor(
  (select email from pg_temp.storage_test_users where slot = 1),
  (select auth_user_id from pg_temp.storage_test_users where slot = 1)
);

set local role authenticated;
select pg_temp.assert_true(
  'owner_cannot_read_uncommitted_memory',
  not exists (
    select 1
    from storage.objects
    where bucket_id = 'wishlist-memories'
      and name = (select memory_path from pg_temp.storage_test_state)
  )
);
reset role;

-- Completion commits the exact path into the domain record.
select pg_temp.set_actor(
  (select email from pg_temp.storage_test_users where slot = 2),
  (select auth_user_id from pg_temp.storage_test_users where slot = 2)
);

select public.complete_wishlist_gift(
  (select wish_id from pg_temp.storage_test_state),
  (select idempotency_key from pg_temp.storage_test_state),
  (select memory_path from pg_temp.storage_test_state),
  null,
  'Storage RLS rollback test'
);

-- The wish owner can now create a signed URL because SELECT is allowed.
select pg_temp.set_actor(
  (select email from pg_temp.storage_test_users where slot = 1),
  (select auth_user_id from pg_temp.storage_test_users where slot = 1)
);

set local role authenticated;
select pg_temp.assert_true(
  'owner_can_read_committed_memory',
  exists (
    select 1
    from storage.objects
    where bucket_id = 'wishlist-memories'
      and name = (select memory_path from pg_temp.storage_test_state)
  )
);
reset role;

-- After completion even the uploader no longer passes the DELETE predicate.
select pg_temp.set_actor(
  (select email from pg_temp.storage_test_users where slot = 2),
  (select auth_user_id from pg_temp.storage_test_users where slot = 2)
);

set local role authenticated;
select pg_temp.assert_true(
  'committed_memory_cleanup_is_denied',
  not public.wishlist_memory_delete_allowed(
    (select memory_path from pg_temp.storage_test_state)
  )
);
reset role;

select
  count(*) as passed_tests,
  array_agg(test_name order by test_name) as tests
from pg_temp.storage_test_results;

rollback;
