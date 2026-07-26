-- Wishlist v3: add an explicit private purchase stage.
-- Keep this migration separate because a newly-added enum value must commit
-- before lifecycle functions can safely start using it.

alter type public.wishlist_status
  add value if not exists 'purchased' after 'reserved';
