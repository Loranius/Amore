-- Wishlist Gift Memory Storage helpers.
--
-- Hosted Supabase owns storage.objects through supabase_storage_admin, so the
-- normal migration runner may not create or drop Storage policies. The seven
-- bucket-scoped policies are maintained in:
--   supabase/manual/20260723_storage_rls_policies.sql
-- and are applied through Dashboard → Storage → Policies.

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
-- to an archived Gift Memory.
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

-- Informative only: policy ownership is managed through the Storage Dashboard.
do $$
declare
  v_count integer;
begin
  select count(*) into v_count
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
    );

  if v_count <> 7 then
    raise notice 'Storage policy setup incomplete: found % of 7 expected policies. Apply supabase/manual/20260723_storage_rls_policies.sql through Dashboard.', v_count;
  end if;
end $$;

commit;
