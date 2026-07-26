-- Wishlist Storage cleanup rollback-only integration suite.
-- Run after 20260723_wishlist_storage_cleanup.sql.

begin;

create temporary table cleanup_test_results (
  test_name text primary key
) on commit drop;

create temporary table cleanup_test_user on commit drop as
select u.id as app_user_id, u.email, au.id as auth_user_id
from public.users u
join auth.users au on lower(au.email) = lower(u.email)
where u.email is not null
order by u.id
limit 1;

create temporary table cleanup_test_state (
  label text primary key,
  value bigint not null
) on commit drop;

grant select, insert on pg_temp.cleanup_test_results to authenticated;
grant select on pg_temp.cleanup_test_user to authenticated;
grant select, insert on pg_temp.cleanup_test_state to authenticated;

create or replace function pg_temp.cleanup_assert(p_name text, p_condition boolean)
returns void
language plpgsql
as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'cleanup_test_failed:%', p_name;
  end if;
  insert into pg_temp.cleanup_test_results(test_name) values (p_name);
end;
$$;

create or replace function pg_temp.cleanup_expect_error(
  p_name text,
  p_expected text,
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
    raise exception 'cleanup_test_expected_error_not_raised:%', p_name;
  end if;
  if position(lower(p_expected) in lower(v_error)) = 0 then
    raise exception 'cleanup_test_wrong_error:% expected:% actual:%',
      p_name, p_expected, v_error;
  end if;

  insert into pg_temp.cleanup_test_results(test_name) values (p_name);
end;
$$;

create or replace function pg_temp.cleanup_set_actor()
returns void
language plpgsql
as $$
declare
  v_email text;
  v_auth_id uuid;
begin
  select email, auth_user_id into v_email, v_auth_id
  from pg_temp.cleanup_test_user;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', v_auth_id,
      'email', v_email,
      'role', 'authenticated'
    )::text,
    true
  );
end;
$$;

select pg_temp.cleanup_assert(
  'authenticated_user_available',
  (select count(*) = 1 from pg_temp.cleanup_test_user)
);

insert into public.wishlist_storage_cleanup_runs (
  requested_by,
  status,
  started_at
)
select app_user_id, 'running', now() - interval '31 minutes'
from pg_temp.cleanup_test_user;

select pg_temp.cleanup_set_actor();
set local role authenticated;

insert into pg_temp.cleanup_test_state(label, value)
select 'claimed_run', public.claim_wishlist_storage_cleanup();

select pg_temp.cleanup_assert(
  'authenticated_claim_succeeds',
  (select value > 0 from pg_temp.cleanup_test_state where label = 'claimed_run')
);

select pg_temp.cleanup_assert(
  'second_claim_is_throttled',
  public.claim_wishlist_storage_cleanup() is null
);

select pg_temp.cleanup_expect_error(
  'candidate_rpc_hidden_from_authenticated',
  'permission denied',
  $$select * from public.get_wishlist_storage_cleanup_candidates(now(), 10)$$
);

reset role;

select pg_temp.cleanup_assert(
  'stale_run_recovered',
  exists (
    select 1
    from public.wishlist_storage_cleanup_runs
    where status = 'failed'
      and error_summary = 'stale_run_recovered'
  )
);

select pg_temp.cleanup_assert(
  'all_candidates_are_old_and_unreferenced',
  not exists (
    select 1
    from public.get_wishlist_storage_cleanup_candidates(now() - interval '24 hours', 1000) c
    where c.created_at >= now() - interval '24 hours'
       or (
         c.bucket_id = 'wishlist-memories'
         and exists (
           select 1 from public.wishlist_gift_completions g
           where g.reaction_photo = c.object_name
              or g.reaction_video = c.object_name
         )
       )
       or (
         c.bucket_id = 'wishlist-photos'
         and exists (
           select 1 from public.wishlist_items w
           where w.image_url is not null
             and position(
               '/storage/v1/object/public/wishlist-photos/' || c.object_name
               in w.image_url
             ) > 0
         )
       )
  )
);

select public.finish_wishlist_storage_cleanup(
  (select value from pg_temp.cleanup_test_state where label = 'claimed_run'),
  'dry_run',
  0,
  0,
  0,
  null
);

select pg_temp.cleanup_assert(
  'finish_records_terminal_status',
  exists (
    select 1
    from public.wishlist_storage_cleanup_runs
    where id = (select value from pg_temp.cleanup_test_state where label = 'claimed_run')
      and status = 'dry_run'
      and finished_at is not null
  )
);

select count(*) as passed_tests,
       array_agg(test_name order by test_name) as tests
from pg_temp.cleanup_test_results;

rollback;
