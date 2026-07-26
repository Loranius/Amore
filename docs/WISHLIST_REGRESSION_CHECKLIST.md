# Wishlist regression checklist

Run this checklist on a mobile viewport and with network throttling before a Wishlist release.

## Loading and session

- Open each tab on a slow connection: My wishes, Partner wishes, Shared.
- Force a failed list request and confirm that **Try again** reloads the active tab.
- Expire or sign out the Supabase session and confirm the portal returns to login.
- Confirm a PIN login is not accepted when the RLS session cannot be created.

## Wish form

- Double-tap Create/Save and confirm only one request is submitted.
- Enter an invalid product URL, image URL and negative price; no photo upload should start.
- Select two photos quickly while the first is still processing; the second preview must win.
- Start saving with a local photo; fields, picker, close, backdrop and Escape must remain locked.
- Simulate a confirmed RPC rejection; the newly uploaded unreferenced photo should be removed.
- Simulate timeout after upload; the photo must remain for reconciliation/24-hour cleanup.
- Retry after a failed save without losing typed form values.

## Card actions

- Double-tap Reserve, Cancel reservation, Purchased and Preparing; only one transition may run.
- While any card mutation is pending, all destructive/lifecycle actions are disabled.
- Open the overflow menu and close it with Escape and an outside click.
- Confirm focus returns to the overflow trigger after Escape.

## Move flow

- Start a move on a slow connection; modal remains visible until the RPC succeeds.
- Simulate a move failure; modal stays open and allows retry.
- Backdrop, close button and Escape are blocked while the move is pending.

## Gift Memory

- Select two photos quickly; the newest selection must win.
- Double-tap completion; only one submission may run.
- Simulate a timeout after completion RPC may have committed; uploaded media must not be deleted.
- Retry in the same open modal and confirm the same idempotency key is reused.
- Verify close, backdrop, Escape, file pickers and comment are locked while saving.

## Accessibility and mobile

- Operate form, overflow menu and dialogs with keyboard only.
- Confirm dialogs expose a label, modal semantics, busy state and live progress message.
- Verify disabled controls have a visible state and do not accept pointer input.
- Test 360 px, 390 px and 420 px widths with the software keyboard open.
- Confirm the last card and sticky dialog actions remain above the bottom safe area.
