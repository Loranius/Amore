# Wishlist Redesign Regression Checklist

Use this checklist after every Wishlist UI, lifecycle, Storage or notification change.

## Devices and viewport

- [ ] 360 × 800 Android viewport: no horizontal page overflow.
- [ ] 390 × 844 mobile viewport: Hero, tabs, filters and cards fit without clipped text.
- [ ] Tablet: two-column card grid remains aligned.
- [ ] Desktop: three-column card grid and two-column archive remain stable.
- [ ] Safe-area inset does not cover sticky tabs, bottom sheets or modal actions.

## Initial loading

- [ ] Partner name never flashes as a generic fallback.
- [ ] Full page skeleton keeps stable geometry until the partner is known.
- [ ] Tab counters never flash an incorrect zero.
- [ ] Card photos stay hidden until decode completes, then reveal smoothly.
- [ ] Broken photo URL becomes the calm fallback and does not shimmer forever.

## Main navigation

- [ ] `Мої / <ім’я партнера> / Спільні` counts match active server rows.
- [ ] Sticky tabs remain usable while scrolling.
- [ ] Switching tabs uses cached data without showing another user’s previous cards.
- [ ] Partner tab closes archive mode because it has no partner-facing archive.

## Filters and sorting

- [ ] Personal filter/sort state survives tab switching.
- [ ] Partner filter/sort state survives tab switching.
- [ ] Shared filter/sort state survives tab switching.
- [ ] `Мої подарунки` includes only rows where `reserved_by` is the current user.
- [ ] Masked reservations never appear in `Мої подарунки`.
- [ ] Shared author filters use the exact wish owner.
- [ ] Priority ordering is Dream → high → medium → low.
- [ ] Price ordering puts wishes without a price last.
- [ ] Empty state distinguishes an empty list from a list hidden by filters.

## Card actions

- [ ] Desktop `⋯` opens the compact anchored menu.
- [ ] Mobile `⋯` opens a bottom sheet with a backdrop.
- [ ] Bottom sheet moves focus to the first action.
- [ ] Tab and Shift+Tab remain inside the open mobile sheet.
- [ ] Escape, close button and backdrop close the sheet and restore trigger focus.
- [ ] Body scrolling is restored after the sheet closes or the card unmounts.
- [ ] Edit/move/delete appear only when server capabilities allow them.
- [ ] All touch actions are at least 44 px high.

## Personal gift lifecycle

- [ ] Partner: `Здійснити бажання` moves visible → reserved.
- [ ] Partner: `Подарунок куплено` moves reserved → purchased.
- [ ] Partner: `Подарунок вручено` moves purchased → archived in one action.
- [ ] Personal final action does not open the shared-memory modal.
- [ ] Double click cannot create two completions.
- [ ] Retry after ambiguous timeout reuses the same idempotency key.
- [ ] Owner sees only `Це бажання вже здійснюють` during private stages.
- [ ] Owner never sees buyer identity, purchased state or preparation details.

## Shared wishes

- [ ] Both couple members can edit the same shared wish.
- [ ] Author attribution uses text from the existing user record; no avatar is required.
- [ ] A stale editor receives refreshed data and a friendly conflict message.
- [ ] Either member can complete a visible shared wish.
- [ ] Shared completion with no media works.
- [ ] Shared completion with photo/video/comment works and stays idempotent.

## Archive mode

- [ ] Entry card opens `Подаровані спогади` from the personal tab.
- [ ] Entry card opens `Наші здійснені мрії` from the shared tab.
- [ ] Hero and active board are hidden while archive mode is open.
- [ ] `До активних мрій` returns without losing the current main tab.
- [ ] `archive=1&wish=<id>` opens the correct scope and focuses the exact memory card.
- [ ] Personal and shared archives remain mutually exclusive.
- [ ] Signed private media loads for both allowed couple members only.

## Forms and modal behavior

- [ ] Mobile forms use the available viewport and respect safe areas.
- [ ] Modal content scrolls while actions remain reachable.
- [ ] Background page does not scroll behind an open modal.
- [ ] Backdrop and Escape do nothing while a save is pending.
- [ ] Slow save keeps all entered fields and selected files.
- [ ] Link preview and photo selection race still preserve the latest user choice.

## Accessibility and motion

- [ ] Keyboard focus is always visible.
- [ ] Dialogs have `aria-modal`, a labelled title and live saving status.
- [ ] Filters expose pressed state and sorting has a visible label.
- [ ] Loading/error states are announced without repeating continuously.
- [ ] `prefers-reduced-motion` disables shimmer, scale, sheet and card animations.

## Final gates

- [ ] TypeScript typecheck passes.
- [ ] Unit tests pass.
- [ ] Production build passes.
- [ ] Two-user rollback SQL regression passes.
- [ ] No test wishes, completions, history, notifications or Storage objects remain.
- [ ] PR head is exact, mergeable and behind `main` by zero commits.
