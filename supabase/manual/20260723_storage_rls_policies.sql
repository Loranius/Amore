-- Manual Storage policy source of truth for hosted Supabase.
-- Apply through Dashboard → Storage → Policies → storage.objects.
--
-- Safe order:
--   1. create the seven explicit policies;
--   2. verify them;
--   3. remove auth_storage_full last.

-- Shared public app assets ----------------------------------------------------

create policy storage_shared_assets_select
on storage.objects
for select
to authenticated
using (
  bucket_id in (
    'family_photos',
    'map-photos',
    'media-posters',
    'photo-calendar',
    'wishlist-photos'
  )
);

create policy storage_shared_assets_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id in (
    'family_photos',
    'map-photos',
    'media-posters',
    'photo-calendar',
    'wishlist-photos'
  )
  and name is not null
  and char_length(name) between 1 and 512
);

create policy storage_shared_assets_update
on storage.objects
for update
to authenticated
using (
  bucket_id in (
    'family_photos',
    'map-photos',
    'media-posters',
    'photo-calendar',
    'wishlist-photos'
  )
)
with check (
  bucket_id in (
    'family_photos',
    'map-photos',
    'media-posters',
    'photo-calendar',
    'wishlist-photos'
  )
  and name is not null
  and char_length(name) between 1 and 512
);

create policy storage_shared_assets_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id in (
    'family_photos',
    'map-photos',
    'media-posters',
    'photo-calendar',
    'wishlist-photos'
  )
);

-- Private Wishlist Gift Memory ----------------------------------------------

create policy wishlist_memories_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'wishlist-memories'
  and public.wishlist_memory_read_allowed(name)
);

create policy wishlist_memories_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'wishlist-memories'
  and public.wishlist_memory_upload_allowed(name)
);

create policy wishlist_memories_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'wishlist-memories'
  and public.wishlist_memory_delete_allowed(name)
);

-- Remove the blanket policy only after all seven policies exist.
drop policy if exists auth_storage_full on storage.objects;
