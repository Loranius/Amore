-- Wishlist create idempotency rollback-only integration suite.

begin;

create temporary table create_idempotency_results (
  test_name text primary key
) on commit drop;

create temporary table create_idempotency_users on commit drop as
select row_number() over (order by id)::integer as slot, id, email
from public.users
where email is not null
order by id
limit 2;

create temporary table create_idempotency_state (
  request_id uuid,
  first_wish_id bigint,
  second_actor_wish_id bigint
) on commit drop;

create or replace function pg_temp.ci_assert(p_name text, p_condition boolean)
returns void
language plpgsql
as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'create_idempotency_test_failed:%', p_name;
  end if;
  insert into pg_temp.create_idempotency_results(test_name) values (p_name);
end;
$$;

create or replace function pg_temp.ci_expect_error(
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
    raise exception 'create_idempotency_wrong_error:% expected:% actual:%',
      p_name,
      p_fragment,
      coalesce(v_error, '<none>');
  end if;

  insert into pg_temp.create_idempotency_results(test_name) values (p_name);
end;
$$;

create or replace function pg_temp.ci_set_actor(p_email text)
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

select pg_temp.ci_assert(
  'two_users_available',
  (select count(*) = 2 from pg_temp.create_idempotency_users)
);

insert into pg_temp.create_idempotency_state(request_id)
values (gen_random_uuid());

select pg_temp.ci_set_actor((select email from pg_temp.create_idempotency_users where slot = 1));

update pg_temp.create_idempotency_state
set first_wish_id = public.create_wishlist_item_idempotent_v3(
  request_id,
  'Idempotent create wish',
  (select id from pg_temp.create_idempotency_users where slot = 1),
  false,
  'same payload',
  'https://example.com/item',
  'https://example.com/storage/v1/object/public/wishlist-photos/first.webp',
  100,
  'high'
);

select pg_temp.ci_assert(
  'same_request_returns_same_wish',
  (
    select public.create_wishlist_item_idempotent_v3(
      request_id,
      'Idempotent create wish',
      (select id from pg_temp.create_idempotency_users where slot = 1),
      false,
      'same payload',
      'https://example.com/item',
      -- Different uploaded-photo URL is tolerated for network retries.
      'https://example.com/storage/v1/object/public/wishlist-photos/retry.webp',
      100,
      'high'
    ) = first_wish_id
    from pg_temp.create_idempotency_state
  )
);

select pg_temp.ci_assert(
  'only_one_row_created_for_request',
  (
    select count(*) = 1
    from public.wishlist_items wi
    join pg_temp.create_idempotency_state s
      on wi.create_request_id = s.request_id
    where wi.created_by = (select id from pg_temp.create_idempotency_users where slot = 1)
  )
);

select pg_temp.ci_expect_error(
  'changed_payload_conflicts',
  'create_request_conflict',
  format(
    $sql$select public.create_wishlist_item_idempotent_v3(
      %L::uuid,
      'Changed title',
      %s,
      false,
      'same payload',
      'https://example.com/item',
      null,
      100,
      'high'
    )$sql$,
    (select request_id from pg_temp.create_idempotency_state),
    (select id from pg_temp.create_idempotency_users where slot = 1)
  )
);

select pg_temp.ci_set_actor((select email from pg_temp.create_idempotency_users where slot = 2));

update pg_temp.create_idempotency_state
set second_actor_wish_id = public.create_wishlist_item_idempotent_v3(
  request_id,
  'Second actor request namespace',
  (select id from pg_temp.create_idempotency_users where slot = 2),
  false,
  null,
  null,
  null,
  null,
  'low'
);

select pg_temp.ci_assert(
  'request_ids_are_actor_scoped',
  (
    select second_actor_wish_id is not null
      and second_actor_wish_id <> first_wish_id
    from pg_temp.create_idempotency_state
  )
);

select pg_temp.ci_assert(
  'legacy_create_rpc_still_works',
  public.create_wishlist_item_v3(
    'Legacy create compatibility',
    (select id from pg_temp.create_idempotency_users where slot = 2),
    false,
    null,
    null,
    null,
    null,
    'medium'
  ) is not null
);

select pg_temp.ci_assert(
  'request_id_recorded_in_history',
  exists (
    select 1
    from public.wishlist_history wh
    join pg_temp.create_idempotency_state s on s.first_wish_id = wh.wish_id
    where wh.event_type = 'wish_created'
      and wh.metadata ->> 'request_id' = s.request_id::text
  )
);

select
  count(*) as passed_tests,
  array_agg(test_name order by test_name) as tests
from pg_temp.create_idempotency_results;

rollback;
