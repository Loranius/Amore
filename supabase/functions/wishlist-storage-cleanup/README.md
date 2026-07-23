# wishlist-storage-cleanup

JWT-protected maintenance function for Wishlist Storage.

## Safety contract

- accepts no bucket names or object paths from the client;
- cleanup candidates come only from the service-role-only SQL RPC;
- objects must be older than 24 hours;
- objects referenced by `wishlist_items` or `wishlist_gift_completions` are never returned;
- deletion uses the official Supabase Storage API;
- authenticated clients may request a run, but SQL throttles successful runs to once per 12 hours;
- stalled runs are recoverable after 30 minutes;
- every terminal run is recorded in `wishlist_storage_cleanup_runs`.

Deploy with `verify_jwt = true`.
