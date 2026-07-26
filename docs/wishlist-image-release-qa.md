# Wishlist image pipeline — release QA

## Automated gates

- TypeScript passes.
- Unit tests pass, including serial image processing.
- Production bundle builds with `BASE_PATH=/Amore/`.
- `verify:pages-build` confirms the PWA manifest, icons, service worker and asset base paths.
- GitHub Pages deployment smoke test returns the app shell, manifest and service worker.

## Android / PWA matrix

Test in Android Chrome and installed PWA mode:

1. Open Wishlist with several unprocessed wishes. Only one heavy image job should run at a time.
2. Send the app to the background during processing, then return. Processing should resume after the tab becomes visible.
3. Disable the network before processing. No fallback should be persisted merely because the device is offline.
4. Restore the network. Pending processing should resume automatically.
5. Confirm that tapping a bubble does not leave it stuck in the desktop hover zoom state.
6. Confirm `Автоматично`, `Товар без фону`, `Людина без фону` and `Оригінальне фото`.
7. Confirm manual reprocess keeps the previous usable cutout visible until the replacement is committed.
8. Confirm a failed transient attempt does not loop forever and can still be retried manually.

## Image examples

- product on white, black and grey backgrounds;
- portrait/full-body clothing photo on a complex background;
- several people in one photo;
- object touching an image edge;
- dark or low-resolution photo;
- remote shop CDN image;
- uploaded local PNG/WebP/HEIC;
- broken or removed remote image.

## Storage and consistency

- The same wish looks identical on both partner devices after refresh.
- Changing the original image invalidates the previous derived result.
- Active `processed_image_url` files are never returned as cleanup candidates.
- A failed upload removes only the newly uploaded uncommitted file.
- No processing session UUID appears in the role-safe Wishlist read contract.
