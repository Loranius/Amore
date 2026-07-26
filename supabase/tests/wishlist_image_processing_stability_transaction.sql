-- Rollback-only integration suite for Wishlist image processing stabilization.

begin;

create temporary table image_processing_users on commit drop as
select row_number() over (order by id)::integer as slot, id, email
from public.users
where email is not null
order by id
limit 2;

create temporary table image_processing_state (
  wish_id bigint,
  original_version bigint,
  original_revision bigint,
  first_session uuid,
  retry_session uuid,
  upgrade_session uuid,
  recovered_session uuid
) on commit drop;

create temporary table image_processing_decision (
  session_id uuid,
  lease_expires_at timestamptz,
  should_process boolean,
  retry_after_ms integer,
  processing_status text
) on commit drop;

create or replace function pg_temp.ip5_assert(p_name text, p_condition boolean)
returns void
language plpgsql
as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'image_processing_stability_test_failed:%', p_name;
  end if;
end;
$$;

create or replace function pg_temp.ip5_expect_error(
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
    raise exception 'image_processing_stability_wrong_error:% expected:% actual:%',
      p_name, p_fragment, coalesce(v_error, '<none>');
  end if;
end;
$$;

create or replace function pg_temp.ip5_set_actor(p_email text)
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

select pg_temp.ip5_assert(
  'two_users_available',
  (select count(*) = 2 from pg_temp.image_processing_users)
);

select pg_temp.ip5_set_actor((select email from pg_temp.image_processing_users where slot = 1));

insert into pg_temp.image_processing_state(wish_id)
select public.create_wishlist_item_idempotent_v4(
  gen_random_uuid(),
  'Image processing stability wish',
  (select id from pg_temp.image_processing_users where slot = 1),
  false,
  'Lease integration test',
  null,
  'https://shop.example/stability-a.jpg',
  1700,
  'high',
  'product-cutout'
);

update pg_temp.image_processing_state s
set original_version = w.version,
    original_revision = w.image_processing_revision
from public.get_wishlist_items_v3(
  (select id from pg_temp.image_processing_users where slot = 1),
  false,
  false
) w
where w.id = s.wish_id;

select pg_temp.ip5_assert(
  'new_image_starts_pending',
  (
    select w.image_processing_status = 'pending'
      and w.image_processor_version = 0
      and w.image_processing_attempts = 0
      and w.version = 1
    from public.get_wishlist_items_v3(
      (select id from pg_temp.image_processing_users where slot = 1),
      false,
      false
    ) w
    where w.id = (select wish_id from pg_temp.image_processing_state)
  )
);

insert into pg_temp.image_processing_decision
select * from public.begin_wishlist_image_processing_v5(
  (select wish_id from pg_temp.image_processing_state),
  'https://shop.example/stability-a.jpg',
  'product-cutout',
  (select original_revision from pg_temp.image_processing_state),
  1
);

update pg_temp.image_processing_state
set first_session = (select session_id from pg_temp.image_processing_decision);

select pg_temp.ip5_assert(
  'first_claim_is_owned',
  (select should_process and session_id is not null from pg_temp.image_processing_decision)
);

select pg_temp.ip5_assert(
  'claim_does_not_change_domain_version',
  (
    select w.image_processing_status = 'processing'
      and w.image_processing_attempts = 1
      and w.image_processing_target_version = 1
      and w.version = (select original_version from pg_temp.image_processing_state)
    from public.get_wishlist_items_v3(
      (select id from pg_temp.image_processing_users where slot = 1),
      false,
      false
    ) w
    where w.id = (select wish_id from pg_temp.image_processing_state)
  )
);

select pg_temp.ip5_set_actor((select email from pg_temp.image_processing_users where slot = 2));
truncate pg_temp.image_processing_decision;
insert into pg_temp.image_processing_decision
select * from public.begin_wishlist_image_processing_v5(
  (select wish_id from pg_temp.image_processing_state),
  'https://shop.example/stability-a.jpg',
  'product-cutout',
  (select original_revision from pg_temp.image_processing_state),
  1
);

select pg_temp.ip5_assert(
  'fresh_lease_is_not_duplicated',
  (
    select not should_process
      and session_id is null
      and retry_after_ms > 0
      and processing_status = 'processing'
    from pg_temp.image_processing_decision
  )
);

select pg_temp.ip5_expect_error(
  'wrong_session_cannot_complete',
  'image_processing_lease_lost',
  format(
    $sql$select public.complete_wishlist_image_processing_v5(%s, %L, %L, %s, %s, %L::uuid, %L, %L)$sql$,
    (select wish_id from pg_temp.image_processing_state),
    'https://shop.example/stability-a.jpg',
    'product-cutout',
    (select original_revision from pg_temp.image_processing_state),
    1,
    gen_random_uuid(),
    'https://demo.supabase.co/storage/v1/object/public/wishlist-photos/processed/stability/wrong.webp',
    'product-cutout'
  )
);

select pg_temp.ip5_set_actor((select email from pg_temp.image_processing_users where slot = 1));
select public.fail_wishlist_image_processing_v5(
  (select wish_id from pg_temp.image_processing_state),
  'https://shop.example/stability-a.jpg',
  'product-cutout',
  (select original_revision from pg_temp.image_processing_state),
  1,
  (select first_session from pg_temp.image_processing_state),
  'portrait_segmentation_failed'
);

select pg_temp.ip5_assert(
  'failure_is_bounded_metadata_only',
  (
    select w.image_processing_status = 'failed'
      and w.image_processing_error_code = 'portrait_segmentation_failed'
      and w.image_processing_attempts = 1
      and w.version = (select original_version from pg_temp.image_processing_state)
    from public.get_wishlist_items_v3(
      (select id from pg_temp.image_processing_users where slot = 1),
      false,
      false
    ) w
    where w.id = (select wish_id from pg_temp.image_processing_state)
  )
);

select pg_temp.ip5_set_actor((select email from pg_temp.image_processing_users where slot = 2));
truncate pg_temp.image_processing_decision;
insert into pg_temp.image_processing_decision
select * from public.begin_wishlist_image_processing_v5(
  (select wish_id from pg_temp.image_processing_state),
  'https://shop.example/stability-a.jpg',
  'product-cutout',
  (select original_revision from pg_temp.image_processing_state),
  1
);
update pg_temp.image_processing_state
set retry_session = (select session_id from pg_temp.image_processing_decision);

select pg_temp.ip5_assert(
  'partner_can_retry_failed_processing',
  (select should_process and session_id is not null from pg_temp.image_processing_decision)
);

select pg_temp.ip5_assert(
  'first_completion_has_no_previous_asset',
  public.complete_wishlist_image_processing_v5(
    (select wish_id from pg_temp.image_processing_state),
    'https://shop.example/stability-a.jpg',
    'product-cutout',
    (select original_revision from pg_temp.image_processing_state),
    1,
    (select retry_session from pg_temp.image_processing_state),
    'https://demo.supabase.co/storage/v1/object/public/wishlist-photos/processed/stability/v1.webp',
    'product-cutout'
  ) is null
);

select pg_temp.ip5_assert(
  'completion_is_ready_without_version_change',
  (
    select w.image_processing_status = 'ready'
      and w.image_processor_version = 1
      and w.image_processing_target_version is null
      and w.processed_image_url like '%/v1.webp'
      and w.version = (select original_version from pg_temp.image_processing_state)
    from public.get_wishlist_items_v3(
      (select id from pg_temp.image_processing_users where slot = 1),
      false,
      false
    ) w
    where w.id = (select wish_id from pg_temp.image_processing_state)
  )
);

truncate pg_temp.image_processing_decision;
insert into pg_temp.image_processing_decision
select * from public.begin_wishlist_image_processing_v5(
  (select wish_id from pg_temp.image_processing_state),
  'https://shop.example/stability-a.jpg',
  'product-cutout',
  (select original_revision from pg_temp.image_processing_state),
  1
);
select pg_temp.ip5_assert(
  'fresh_result_does_not_reprocess',
  (select not should_process and processing_status = 'ready' from pg_temp.image_processing_decision)
);

truncate pg_temp.image_processing_decision;
insert into pg_temp.image_processing_decision
select * from public.begin_wishlist_image_processing_v5(
  (select wish_id from pg_temp.image_processing_state),
  'https://shop.example/stability-a.jpg',
  'product-cutout',
  (select original_revision from pg_temp.image_processing_state),
  2
);
update pg_temp.image_processing_state
set upgrade_session = (select session_id from pg_temp.image_processing_decision);

select pg_temp.ip5_assert(
  'processor_upgrade_preserves_old_result_during_work',
  (
    select w.image_processing_status = 'processing'
      and w.image_processor_version = 1
      and w.image_processing_target_version = 2
      and w.processed_image_url like '%/v1.webp'
    from public.get_wishlist_items_v3(
      (select id from pg_temp.image_processing_users where slot = 1),
      false,
      false
    ) w
    where w.id = (select wish_id from pg_temp.image_processing_state)
  )
);

update public.wishlist_items
set image_processing_lease_expires_at = clock_timestamp() - interval '1 second'
where id = (select wish_id from pg_temp.image_processing_state);

select pg_temp.ip5_set_actor((select email from pg_temp.image_processing_users where slot = 1));
truncate pg_temp.image_processing_decision;
insert into pg_temp.image_processing_decision
select * from public.begin_wishlist_image_processing_v5(
  (select wish_id from pg_temp.image_processing_state),
  'https://shop.example/stability-a.jpg',
  'product-cutout',
  (select original_revision from pg_temp.image_processing_state),
  2
);
update pg_temp.image_processing_state
set recovered_session = (select session_id from pg_temp.image_processing_decision);

select pg_temp.ip5_assert(
  'expired_lease_is_recovered',
  (
    select should_process
      and session_id is not null
      and session_id <> (select upgrade_session from pg_temp.image_processing_state)
    from pg_temp.image_processing_decision
  )
);

select pg_temp.ip5_expect_error(
  'stale_lease_cannot_commit',
  'image_processing_lease_lost',
  format(
    $sql$select public.complete_wishlist_image_processing_v5(%s, %L, %L, %s, %s, %L::uuid, %L, %L)$sql$,
    (select wish_id from pg_temp.image_processing_state),
    'https://shop.example/stability-a.jpg',
    'product-cutout',
    (select original_revision from pg_temp.image_processing_state),
    2,
    (select upgrade_session from pg_temp.image_processing_state),
    'https://demo.supabase.co/storage/v1/object/public/wishlist-photos/processed/stability/stale.webp',
    'product-cutout'
  )
);

select pg_temp.ip5_assert(
  'successful_upgrade_returns_previous_asset',
  public.complete_wishlist_image_processing_v5(
    (select wish_id from pg_temp.image_processing_state),
    'https://shop.example/stability-a.jpg',
    'product-cutout',
    (select original_revision from pg_temp.image_processing_state),
    2,
    (select recovered_session from pg_temp.image_processing_state),
    'https://demo.supabase.co/storage/v1/object/public/wishlist-photos/processed/stability/v2.webp',
    'product-cutout'
  ) = 'https://demo.supabase.co/storage/v1/object/public/wishlist-photos/processed/stability/v1.webp'
);

select public.set_wishlist_image_preference_v3(
  (select wish_id from pg_temp.image_processing_state),
  'https://shop.example/stability-a.jpg',
  'product-cutout',
  true
);

select pg_temp.ip5_assert(
  'manual_reprocess_resets_attempts_and_result',
  (
    select w.image_processing_status = 'pending'
      and w.image_processing_attempts = 0
      and w.image_processor_version = 0
      and w.processed_image_url is null
      and w.image_mode is null
      and w.image_processing_revision = (select original_revision + 1 from pg_temp.image_processing_state)
      and w.version = (select original_version from pg_temp.image_processing_state)
    from public.get_wishlist_items_v3(
      (select id from pg_temp.image_processing_users where slot = 1),
      false,
      false
    ) w
    where w.id = (select wish_id from pg_temp.image_processing_state)
  )
);

select public.update_wishlist_item_collaborative_v4(
  (select wish_id from pg_temp.image_processing_state),
  (select original_version from pg_temp.image_processing_state),
  'Image processing stability wish updated',
  'Lease integration test',
  null,
  'https://shop.example/stability-b.jpg',
  1700,
  'high',
  'product-cutout'
);

select pg_temp.ip5_assert(
  'source_change_creates_new_revision',
  (
    select w.image_url = 'https://shop.example/stability-b.jpg'
      and w.image_processing_status = 'pending'
      and w.image_processing_revision = (select original_revision + 2 from pg_temp.image_processing_state)
      and w.image_processing_attempts = 0
      and w.version = (select original_version + 1 from pg_temp.image_processing_state)
    from public.get_wishlist_items_v3(
      (select id from pg_temp.image_processing_users where slot = 1),
      false,
      false
    ) w
    where w.id = (select wish_id from pg_temp.image_processing_state)
  )
);

do $$
declare
  v_session uuid;
  v_should_process boolean;
  v_revision bigint := (select original_revision + 2 from pg_temp.image_processing_state);
  v_wish_id bigint := (select wish_id from pg_temp.image_processing_state);
begin
  for v_index in 1..3 loop
    select d.session_id, d.should_process
    into v_session, v_should_process
    from public.begin_wishlist_image_processing_v5(
      v_wish_id,
      'https://shop.example/stability-b.jpg',
      'product-cutout',
      v_revision,
      1
    ) d;

    if not coalesce(v_should_process, false) or v_session is null then
      raise exception 'image_processing_stability_test_failed:retry_claim_%', v_index;
    end if;

    perform public.fail_wishlist_image_processing_v5(
      v_wish_id,
      'https://shop.example/stability-b.jpg',
      'product-cutout',
      v_revision,
      1,
      v_session,
      'image_processing_failed'
    );
  end loop;

  select d.should_process
  into v_should_process
  from public.begin_wishlist_image_processing_v5(
    v_wish_id,
    'https://shop.example/stability-b.jpg',
    'product-cutout',
    v_revision,
    1
  ) d;

  if coalesce(v_should_process, true) then
    raise exception 'image_processing_stability_test_failed:max_attempts_not_bounded';
  end if;
end;
$$;

select pg_temp.ip5_assert(
  'cleanup_protects_processed_assets',
  position(
    'processed_image_url'
    in pg_get_functiondef(
      'public.get_wishlist_storage_cleanup_candidates(timestamptz,integer)'::regprocedure
    )
  ) > 0
);

rollback;
