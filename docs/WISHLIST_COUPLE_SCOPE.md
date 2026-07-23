# Wishlist couple scope

Wishlist data is isolated by an explicit couple boundary.

## Identity

`public.users.auth_user_id` links an app user to `auth.users.id`.

`app_private.current_app_user_id()` resolves the caller in this order:

1. matching `auth.uid()`;
2. email fallback for older sessions and rollback-only tests.

The fallback is transitional. New authentication code should always create a real Supabase Auth session.

## Membership

- `public.couples` stores couple identities.
- `public.couple_members` links each app user to at most one couple.
- `public.wishlist_items.couple_id` is required for every wish.

A newly created app user has no Wishlist access until a trusted onboarding flow inserts a `couple_members` row.

## Write boundary

`wishlist_items_enforce_couple_scope` runs before every insert or update. It rejects:

- actors without couple membership;
- writes to another couple;
- owners outside the current couple.

The command RPCs also validate membership before evaluating lifecycle state, preventing outsiders from learning whether another couple's wish is visible, shared, reserved or completed.

## Read boundary

The following are filtered by `app_private.current_couple_id()`:

- active personal and shared wishes;
- statistics;
- Personal Gift Archive;
- Shared Archive;
- Gift Memory upload/read/delete helpers;
- Wishlist notification recipients.

Private Storage access still requires the exact committed completion path. Couple membership does not grant access to arbitrary sibling paths.

## Onboarding a future couple

A trusted server-side flow must:

1. create or locate both `public.users` rows;
2. populate `auth_user_id` from Supabase Auth;
3. create a `public.couples` row;
4. insert both users into `public.couple_members`.

Client code must never receive direct write privileges on `couples` or `couple_members`.
