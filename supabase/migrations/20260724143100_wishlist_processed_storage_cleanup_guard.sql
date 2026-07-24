-- Prevent active processed Wishlist assets from being classified as orphans.

begin;

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
          where (
              w.image_url is not null
              and position(
                '/storage/v1/object/public/wishlist-photos/' || o.name
                in w.image_url
              ) > 0
            )
            or (
              w.processed_image_url is not null
              and position(
                '/storage/v1/object/public/wishlist-photos/' || o.name
                in w.processed_image_url
              ) > 0
            )
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

commit;
