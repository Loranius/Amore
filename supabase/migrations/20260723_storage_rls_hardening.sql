-- Replace the legacy authenticated ALL/true policy with explicit bucket policies.
-- Public product/app assets remain shared by the couple; Gift Memory objects are
-- private and governed by the Wishlist domain state.

begin;

-- Fail early if the Gift Memory migration was not deployed first.
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'wishlist-memories') then
    raise exception 'wishlist-memories bucket is missing';
  end if;

  if to_regprocedure('public.complete_wishlist_gift(bigint,uuid,text,text,text)') is null then
    raise exception 'Gift Memory RPC is missing';
  end if;
end $$;

-- A valid upload path is:
--   <uploader_app_user_id>/<wish_id>/<completion_uuid>/<photo|video>.<ext>
-- Upload is allowed only while that user owns the active reservation and the
-- wish is in preparing_surprise.
create or replace function public.wishlist_memory_upload_allowed(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, app_private
as $$
declare
  v_actor integer := app_private.current_app_user_id();
  v_parts text[];
  v_wish_id bigint;
begin
  if v_actor is null or p_name is null then
    return false;
  end if;

  v_parts := string_to_array(p_name, '/');
  if cardinality(v_parts) <> 4 then
    return false;
  end if;

  if v_parts[1] <> v_actor::text then
    return false;
  end if;

  if v_parts[3] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;

  if v_parts[4] !~* '^(photo|video)\.(jpg|jpeg|png|webp|avif|gif|mp4|webm|mov)$' then
    return false;
  end if;

  begin
    v_wish_id := v_parts[2]::bigint;
  exception when others then
    return false;
  end;

  return exists (
    select 1
    from public.wishlist_items wi
    join public.wishlist_reservations wr
      on wr.wish_id = wi.id
     and wr.active
     and wr.partner_id = v_actor
    where wi.id = v_wish_id
      and wi.status = 'preparing_surprise'
      and wi.deleted_at is null
  );
end;
$$;

-- The uploader may read their own path. The wish owner may read a path only
-- after complete_wishlist_gift stored that exact path in the completion row.
create or replace function public.wishlist_memory_read_allowed(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, app_private
as $$
declare
  v_actor integer := app_private.current_app_user_id();
  v_parts text[];
  v_wish_id bigint;
begin
  if v_actor is null or p_name is null then
    return false;
  end if;

  v_parts := string_to_array(p_name, '/');
  if cardinality(v_parts) <> 4 then
    return false;
  end if;

  begin
    v_wish_id := v_parts[2]::bigint;
  exception when others then
    return false;
  end;

  if v_parts[1] = v_actor::text then
    return true;
  end if;

  return exists (
    select 1
    from public.wishlist_items wi
    join public.wishlist_gift_completions wgc on wgc.wish_id = wi.id
    where wi.id = v_wish_id
      and wi.owner = v_actor
      and wi.deleted_at is null
      and (wgc.reaction_photo = p_name or wgc.reaction_video = p_name)
  );
end;
$$;

-- Cleanup is allowed only to the uploader and only before the path is committed
-- to an archived Gift Memory. This supports frontend rollback after RPC failure
-- without allowing completed memories to be removed from Storage.
create or replace function public.wishlist_memory_delete_allowed(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, app_private
as $$
declare
  v_actor integer := app_private.current_app_user_id();
  v_parts text[];
begin
  if v_actor is null or p_name is null then
    return false;
  end if;

  v_parts := string_to_array(p_name, '/');
  if cardinality(v_parts) <> 4 or v_parts[1] <> v_actor::text then
    return false;
  end if;

  return not exists (
    select 1
    from public.wishlist_gift_completions wgc
    where wgc.reaction_photo = p_name or wgc.reaction_video = p_name
  );
end;
$$;

revoke all on function public.wishlist_memory_upload_allowed(text) from public, anon;
revoke all on function public.wishlist_memory_read_allowed(text) from public, anon;
revoke all on function public.wishlist_memory_delete_allowed(text) from public, anon;
grant execute on function public.wishlist_memory_upload_allowed(text) to authenticated;
grant execute on function public.wishlist_memory_read_allowed(text) to authenticated;
grant execute on function public.wishlist_memory_delete_allowed(text) to authenticated;

alter table storage.objects enable row level security;

drop policy if exists auth_storage_full on storage.objects;
drop policy if exists storage_shared_assets_select on storage.objects;
drop policy if exists storage_shared_assets_insert on storage.objects;
drop policy if exists storage_shared_assets_update on storage.objects;
drop policy if exists storage_shared_assets_delete on storage.objects;
drop policy if exists wishlist_memories_select on storage.objects;
drop policy if exists wishlist_memories_insert on storage.objects;
drop policy if exists wishlist_memories_delete on storage.objects;

-- Existing public buckets are intentionally shared inside the authenticated
-- couple portal. Restrict access to this explicit allow-list instead of every
-- current and future bucket.
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

commit;
