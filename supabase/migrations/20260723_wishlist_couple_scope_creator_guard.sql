-- Ensure legacy create RPCs receive the same creator audit identity as the
-- idempotent create command.

begin;

create or replace function app_private.enforce_wishlist_couple_scope()
returns trigger
language plpgsql
security definer
set search_path = public, app_private, pg_catalog
as $$
declare
  v_actor integer := app_private.current_app_user_id();
  v_couple_id bigint;
begin
  if v_actor is null then
    return new;
  end if;

  v_couple_id := app_private.current_couple_id();
  if v_couple_id is null then
    raise exception 'couple_membership_required' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    new.couple_id := coalesce(new.couple_id, v_couple_id);
    new.created_by := coalesce(new.created_by, v_actor);
  elsif old.couple_id is distinct from v_couple_id then
    raise exception 'wishlist_couple_forbidden' using errcode = '42501';
  end if;

  if new.couple_id is distinct from v_couple_id then
    raise exception 'wishlist_couple_forbidden' using errcode = '42501';
  end if;

  if not app_private.user_in_couple(new.owner, v_couple_id) then
    raise exception 'wishlist_owner_outside_couple' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function app_private.enforce_wishlist_couple_scope()
  from public, anon, authenticated;

commit;
