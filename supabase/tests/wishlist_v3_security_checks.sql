-- Wishlist v3 post-migration verification.
-- Read-only: safe to run in Supabase SQL Editor after the hardening migration.

-- 1. All public RPCs required by the frontend must exist.
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'get_wishlist_items_v3',
    'get_wishlist_stats_v3',
    'get_fulfilled_wishlist_items_v3',
    'create_wishlist_item_v3',
    'update_wishlist_item_v3',
    'move_wishlist_item_v3',
    'soft_delete_wishlist_item_v3',
    'reserve_wishlist_item',
    'cancel_wishlist_reservation',
    'mark_wishlist_preparing',
    'complete_wishlist_gift'
  )
order by p.proname;

-- Expected: 11 rows, all security_definer = true.

-- 2. No broad or writable RLS policies may remain on wishlist_items.
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'wishlist_items'
order by policyname;

-- Expected after this migration: zero rows.
-- Access is RPC-only, so table policies are intentionally unnecessary.

-- 3. Browser roles must have no direct table privileges.
select
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'wishlist_items'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;

-- Expected: zero rows.

-- 4. Authenticated must be able to execute every public Wishlist RPC.
select
  p.proname as function_name,
  has_function_privilege(
    'authenticated',
    p.oid,
    'EXECUTE'
  ) as authenticated_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'get_wishlist_items_v3',
    'get_wishlist_stats_v3',
    'get_fulfilled_wishlist_items_v3',
    'create_wishlist_item_v3',
    'update_wishlist_item_v3',
    'move_wishlist_item_v3',
    'soft_delete_wishlist_item_v3',
    'reserve_wishlist_item',
    'cancel_wishlist_reservation',
    'mark_wishlist_preparing',
    'complete_wishlist_gift'
  )
order by p.proname;

-- Expected: authenticated_can_execute = true for every row.
