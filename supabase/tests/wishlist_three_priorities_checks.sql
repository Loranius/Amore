-- Wishlist priority post-migration verification.
-- Read-only: safe to run in Supabase SQL Editor.

-- 1. Legacy priority must be fully backfilled.
select priority, count(*)::int as count
from public.wishlist_items
group by priority
order by priority nulls first;

-- Expected: only null, high, medium and low. No `dream` row.

-- 2. The table constraint must enforce the same three-value contract.
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.wishlist_items'::regclass
  and conname = 'wishlist_items_priority_check';

-- Expected definition contains: high, medium, low; it does not contain dream.

-- 3. The RPC payload validator must reject removed or unknown priorities.
select pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'app_private'
  and p.proname = 'validate_wishlist_payload';

-- Expected validator whitelist: ('high', 'medium', 'low').
