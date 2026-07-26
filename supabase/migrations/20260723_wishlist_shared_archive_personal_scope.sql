-- Keep personal Gift Archive and Shared Archive mutually exclusive.

begin;

create or replace function public.get_fulfilled_wishlist_items_v3(p_owner_id integer)
returns table (
  id bigint,
  title text,
  description text,
  link text,
  image_url text,
  price numeric,
  priority text,
  fulfilled_at timestamptz,
  fulfilled_by integer,
  completion_id bigint,
  completed_at timestamptz,
  reaction_photo_path text,
  reaction_video_path text,
  memory_comment text
)
language plpgsql
stable
security definer
set search_path = public, app_private
as $$
declare
  v_actor integer := app_private.current_app_user_id();
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_owner_id is distinct from v_actor then
    raise exception 'archive_not_allowed' using errcode = '42501';
  end if;

  return query
  select
    wi.id::bigint,
    wi.title,
    wi.description,
    wi.link,
    wi.image_url,
    wi.price,
    wi.priority::text,
    wi.fulfilled_at,
    wi.fulfilled_by,
    wgc.id::bigint as completion_id,
    wgc.completed_at,
    wgc.reaction_photo as reaction_photo_path,
    wgc.reaction_video as reaction_video_path,
    wgc.comment as memory_comment
  from public.wishlist_items wi
  left join public.wishlist_gift_completions wgc
    on wgc.wish_id = wi.id
  where wi.owner = p_owner_id
    and not wi.is_shared
    and wi.fulfilled
    and wi.deleted_at is null
  order by coalesce(wgc.completed_at, wi.fulfilled_at) desc nulls last, wi.id desc;
end;
$$;

revoke all on function public.get_fulfilled_wishlist_items_v3(integer)
  from public, anon;
grant execute on function public.get_fulfilled_wishlist_items_v3(integer)
  to authenticated;

commit;
