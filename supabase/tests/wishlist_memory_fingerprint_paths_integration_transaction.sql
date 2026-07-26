-- Gift Memory fingerprint-path rollback-only integration suite.
-- Verifies the exact retry-safe filenames emitted by the current React client.
-- All temporary wishes, objects and completion rows are rolled back.

begin;

create temporary table fingerprint_path_test_results (
  test_name text primary key
) on commit drop;

create temporary table fingerprint_path_test_users on commit drop as
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

create temporary table fingerprint_path_test_state (
  wish_id bigint,
  idempotency_key uuid,
  legacy_photo_path text,
  photo_path text,
  video_path text
) on commit drop;

grant select, insert on pg_temp.fingerprint_path_test_results to authenticated;
grant select on pg_temp.fingerprint_path_test_users to authenticated;
grant select on pg_temp.fingerprint_path_test_state to authenticated;

create or replace function pg_temp.fp_assert(
  p_test_name text,
  p_condition boolean
)
returns void
language plpgsql
as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'fingerprint_path_test_failed:%', p_test_name;
  end if;
  insert into pg_temp.fingerprint_path_test_results(test_name) values (p_test_name);
end;
$$;

create or replace function pg_temp.fp_expect_error(
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
    raise exception 'fingerprint_path_expected_error_not_raised:%', p_test_name;
  end if;

  if position(lower(p_expected_fragment) in lower(v_error)) = 0 then
    raise exception 'fingerprint_path_wrong_error:% expected:% actual:%',
      p_test_name,
      p_expected_fragment,
      v_error;
  end if;

  insert into pg_temp.fingerprint_path_test_results(test_name) values (p_test_name);
end;
$$;

create or replace function pg_temp.fp_set_actor(
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

select pg_temp.fp_assert(
  'two_auth_users_available',
  (select count(*) = 2 from pg_temp.fingerprint_path_test_users)
);

-- User 1 creates the personal wish.
select pg_temp.fp_set_actor(
  (select email from pg_temp.fingerprint_path_test_users where slot = 1),
  (select auth_user_id from pg_temp.fingerprint_path_test_users where slot = 1)
);

insert into pg_temp.fingerprint_path_test_state(wish_id, idempotency_key)
select
  public.create_wishlist_item_v3(
    'Fingerprint Gift Memory path test',
    (select app_user_id from pg_temp.fingerprint_path_test_users where slot = 1),
    false,
    null,
    null,
    null,
    null,
    'medium'
  ),
  gen_random_uuid();

-- User 2 owns the private lifecycle.
select pg_temp.fp_set_actor(
  (select email from pg_temp.fingerprint_path_test_users where slot = 2),
  (select auth_user_id from pg_temp.fingerprint_path_test_users where slot = 2)
);

select public.reserve_wishlist_item((select wish_id from pg_temp.fingerprint_path_test_state));
select public.mark_wishlist_purchased((select wish_id from pg_temp.fingerprint_path_test_state));
select public.mark_wishlist_preparing((select wish_id from pg_temp.fingerprint_path_test_state));

update pg_temp.fingerprint_path_test_state
set legacy_photo_path = format(
      '%s/%s/%s/photo.webp',
      (select app_user_id from pg_temp.fingerprint_path_test_users where slot = 2),
      wish_id,
      idempotency_key
    ),
    photo_path = format(
      '%s/%s/%s/photo-deadbeef.webp',
      (select app_user_id from pg_temp.fingerprint_path_test_users where slot = 2),
      wish_id,
      idempotency_key
    ),
    video_path = format(
      '%s/%s/%s/video-a1b2c3d4.mp4',
      (select app_user_id from pg_temp.fingerprint_path_test_users where slot = 2),
      wish_id,
      idempotency_key
    );

select pg_temp.fp_assert(
  'legacy_photo_path_remains_allowed',
  public.wishlist_memory_upload_allowed(
    (select legacy_photo_path from pg_temp.fingerprint_path_test_state)
  )
);

select pg_temp.fp_assert(
  'fingerprinted_photo_path_allowed',
  public.wishlist_memory_upload_allowed(
    (select photo_path from pg_temp.fingerprint_path_test_state)
  )
);

select pg_temp.fp_assert(
  'fingerprinted_video_path_allowed',
  public.wishlist_memory_upload_allowed(
    (select video_path from pg_temp.fingerprint_path_test_state)
  )
);

select pg_temp.fp_assert(
  'malformed_fingerprint_rejected',
  not public.wishlist_memory_upload_allowed(
    replace(
      (select photo_path from pg_temp.fingerprint_path_test_state),
      'deadbeef',
      'deadbee'
    )
  )
);

-- Exercise the actual INSERT policies under the authenticated role.
set local role authenticated;

insert into storage.objects(bucket_id, name, owner_id, metadata)
select
  'wishlist-memories',
  photo_path,
  auth.uid()::text,
  '{}'::jsonb
from pg_temp.fingerprint_path_test_state;

insert into storage.objects(bucket_id, name, owner_id, metadata)
select
  'wishlist-memories',
  video_path,
  auth.uid()::text,
  '{}'::jsonb
from pg_temp.fingerprint_path_test_state;

select pg_temp.fp_expect_error(
  'storage_policy_rejects_bad_fingerprint',
  'row-level security',
  format(
    $sql$
      insert into storage.objects(bucket_id, name, owner_id, metadata)
      values ('wishlist-memories', %L, auth.uid()::text, '{}'::jsonb)
    $sql$,
    replace(
      (select photo_path from pg_temp.fingerprint_path_test_state),
      'deadbeef',
      'zzzzzzzz'
    )
  )
);

reset role;

select public.complete_wishlist_gift(
  (select wish_id from pg_temp.fingerprint_path_test_state),
  (select idempotency_key from pg_temp.fingerprint_path_test_state),
  (select photo_path from pg_temp.fingerprint_path_test_state),
  (select video_path from pg_temp.fingerprint_path_test_state),
  'Fingerprint path contract works'
);

select pg_temp.fp_assert(
  'completion_persists_fingerprinted_paths',
  exists (
    select 1
    from public.wishlist_gift_completions wgc
    join pg_temp.fingerprint_path_test_state s on s.wish_id = wgc.wish_id
    where wgc.reaction_photo = s.photo_path
      and wgc.reaction_video = s.video_path
      and wgc.comment = 'Fingerprint path contract works'
  )
);

-- Receiver can read both exact committed paths through Storage RLS.
select pg_temp.fp_set_actor(
  (select email from pg_temp.fingerprint_path_test_users where slot = 1),
  (select auth_user_id from pg_temp.fingerprint_path_test_users where slot = 1)
);

set local role authenticated;
select pg_temp.fp_assert(
  'receiver_reads_committed_fingerprinted_objects',
  (
    select count(*) = 2
    from storage.objects o
    join pg_temp.fingerprint_path_test_state s
      on o.name in (s.photo_path, s.video_path)
    where o.bucket_id = 'wishlist-memories'
  )
);
reset role;

select
  count(*) as passed_tests,
  array_agg(test_name order by test_name) as tests
from pg_temp.fingerprint_path_test_results;

rollback;
