-- Wishlist Storage cleanup contract.
--
-- Cleanup is executed by the JWT-protected Edge Function through Storage API.
-- SQL only coordinates runs, exposes service-role-only candidates and logs results.

begin;

create table if not exists public.wishlist_storage_cleanup_runs (
  id bigint generated always as identity primary key,
  requested_by integer references public.users(id) on delete set null,
  status text not null check (status in ('running', 'succeeded', 'failed', 'dry_run')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  memories_deleted integer not null default 0 check (memories_deleted >= 0),
  photos_deleted integer not null default 0 check (photos_deleted >= 0),
  bytes_deleted bigint not null default 0 check (bytes_deleted >= 0),
  error_summary text
);

create index if not exists wishlist_storage_cleanup_runs_started_idx
  on public.wishlist_storage_cleanup_runs (started_at desc);

alter table public.wishlist_storage_cleanup_runs enable row level security;
revoke all privileges on table public.wishlist_storage_cleanup_runs
  from public, anon, authenticated;
revoke all privileges on sequence public.wishlist_storage_cleanup_runs_id_seq
  from public, anon, authenticated;

-- Authenticated clients may request cleanup, but this function throttles execution,
-- serializes concurrent claims and stores only the internal app-user id.
create or replace function public.claim_wishlist_storage_cleanup()
returns bigint
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_actor integer := app_private.current_app_user_id();
  v_run_id bigint;
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('wishlist_storage_cleanup', 0));

  update public.wishlist_storage_cleanup_runs
  set status = 'failed',
      finished_at = now(),
      error_summary = coalesce(error_summary, 'stale_run_recovered')
  where status = 'running'
    and started_at < now() - interval '30 minutes';

  if exists (
    select 1
    from public.wishlist_storage_cleanup_runs r
    where (r.status = 'running' and r.started_at >= now() - interval '30 minutes')
       or (r.status = 'succeeded' and r.finished_at >= now() - interval '12 hours')
  ) then
    return null;
  end if;

  insert into public.wishlist_storage_cleanup_runs (requested_by, status)
  values (v_actor, 'running')
  returning id into v_run_id;

  return v_run_id;
end;
$$;

revoke all on function public.claim_wishlist_storage_cleanup()
  from public, anon;
grant execute on function public.claim_wishlist_storage_cleanup()
  to authenticated;

-- Only service_role may inspect Storage objects. A referenced object is never a
-- candidate, including media referenced by archived or soft-deleted wishes.
create or replace function public.get_wishlist_storage_cleanup_candidates(
  p_cutoff timestamptz,
  p_limit integer default 500
)
returns table (
  bucket_id text,
  object_name text,
  size_bytes bigint,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, storage
as $$
  select
    o.bucket_id,
    o.name as object_name,
    coalesce(nullif(o.metadata ->> 'size', '')::bigint, 0) as size_bytes,
    o.created_at
  from storage.objects o
  where o.bucket_id in ('wishlist-memories', 'wishlist-photos')
    and o.created_at < p_cutoff
    and (
      (
        o.bucket_id = 'wishlist-memories'
        and not exists (
          select 1
          from public.wishlist_gift_completions c
          where c.reaction_photo = o.name
             or c.reaction_video = o.name
        )
      )
      or
      (
        o.bucket_id = 'wishlist-photos'
        and not exists (
          select 1
          from public.wishlist_items w
          where w.image_url is not null
            and position(
              '/storage/v1/object/public/wishlist-photos/' || o.name
              in w.image_url
            ) > 0
        )
      )
    )
  order by o.created_at asc, o.id asc
  limit least(greatest(coalesce(p_limit, 500), 1), 1000);
$$;

revoke all on function public.get_wishlist_storage_cleanup_candidates(timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.get_wishlist_storage_cleanup_candidates(timestamptz, integer)
  to service_role;

create or replace function public.finish_wishlist_storage_cleanup(
  p_run_id bigint,
  p_status text,
  p_memories_deleted integer,
  p_photos_deleted integer,
  p_bytes_deleted bigint,
  p_error_summary text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('succeeded', 'failed', 'dry_run') then
    raise exception 'invalid_cleanup_status' using errcode = '22023';
  end if;

  update public.wishlist_storage_cleanup_runs
  set status = p_status,
      finished_at = now(),
      memories_deleted = greatest(coalesce(p_memories_deleted, 0), 0),
      photos_deleted = greatest(coalesce(p_photos_deleted, 0), 0),
      bytes_deleted = greatest(coalesce(p_bytes_deleted, 0), 0),
      error_summary = nullif(left(coalesce(p_error_summary, ''), 500), '')
  where id = p_run_id
    and status = 'running';

  if not found then
    raise exception 'cleanup_run_not_found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.finish_wishlist_storage_cleanup(bigint, text, integer, integer, bigint, text)
  from public, anon, authenticated;
grant execute on function public.finish_wishlist_storage_cleanup(bigint, text, integer, integer, bigint, text)
  to service_role;

commit;
