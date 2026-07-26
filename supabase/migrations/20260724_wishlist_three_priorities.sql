begin;

-- `dream` is removed from the product model. Existing rows become the
-- strongest remaining priority so no active wish disappears from filters.
-- Suppress the legacy HTTP notification trigger during this one-time backfill.
alter table public.wishlist_items disable trigger notify_wishlist_items;

update public.wishlist_items
set priority = 'high'
where priority = 'dream';

alter table public.wishlist_items enable trigger notify_wishlist_items;

alter table public.wishlist_items
  drop constraint if exists wishlist_items_priority_check;

alter table public.wishlist_items
  add constraint wishlist_items_priority_check
  check (priority is null or priority in ('high', 'medium', 'low'));

create or replace function app_private.validate_wishlist_payload(
  p_title text,
  p_description text,
  p_link text,
  p_image_url text,
  p_price numeric,
  p_priority text
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if nullif(btrim(p_title), '') is null then
    raise exception 'title_required';
  end if;

  if char_length(btrim(p_title)) > 160 then
    raise exception 'title_too_long';
  end if;

  if p_description is not null and char_length(p_description) > 1000 then
    raise exception 'description_too_long';
  end if;

  if p_link is not null and char_length(p_link) > 2048 then
    raise exception 'link_too_long';
  end if;

  if p_image_url is not null and char_length(p_image_url) > 4096 then
    raise exception 'image_url_too_long';
  end if;

  if p_price is not null and p_price < 0 then
    raise exception 'invalid_price';
  end if;

  if p_priority is not null and p_priority not in ('high', 'medium', 'low') then
    raise exception 'invalid_priority';
  end if;
end;
$function$;

commit;
