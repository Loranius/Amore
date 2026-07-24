import type { WishlistImageMode as CutoutProcessingMode } from './wishlistImageCutout';

/**
 * Presentation modes used by the Wishlist UI.
 *
 * `product-cutout` is already produced by the lightweight uniform-background
 * remover. `portrait-cutout` is the contract prepared for the segmentation
 * stage. `photo-cover` is the safe fallback for ordinary photography.
 */
export type WishlistImageDisplayMode =
  | 'product-cutout'
  | 'portrait-cutout'
  | 'photo-cover';

const PORTRAIT_CUTOUT_MARKERS = [
  'wish-portrait-cutout-',
  'portrait-cutout',
  'image_mode=portrait-cutout',
  'image-mode=portrait-cutout',
];

function hasPortraitCutoutMarker(src: string): boolean {
  const normalized = src.toLowerCase();
  return PORTRAIT_CUTOUT_MARKERS.some((marker) => normalized.includes(marker));
}

export function inferWishlistImageDisplayMode(
  src: string,
  processingMode: CutoutProcessingMode,
  hint?: WishlistImageDisplayMode,
): WishlistImageDisplayMode {
  if (hint) return hint;
  if (hasPortraitCutoutMarker(src)) return 'portrait-cutout';
  return processingMode === 'cutout' ? 'product-cutout' : 'photo-cover';
}

export function isWishlistTransparentDisplayMode(
  mode: WishlistImageDisplayMode,
): boolean {
  return mode === 'product-cutout' || mode === 'portrait-cutout';
}
