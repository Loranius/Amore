import type { WishlistImageDisplayMode } from './wishlistImageModes';

export type WishlistImagePreference =
  | 'auto'
  | 'product-cutout'
  | 'portrait-cutout'
  | 'photo-cover';

export type WishlistProcessingStep = 'product' | 'portrait';

export const DEFAULT_WISHLIST_IMAGE_PREFERENCE: WishlistImagePreference = 'auto';

export function normalizeWishlistImagePreference(value: unknown): WishlistImagePreference {
  return value === 'product-cutout'
    || value === 'portrait-cutout'
    || value === 'photo-cover'
    ? value
    : DEFAULT_WISHLIST_IMAGE_PREFERENCE;
}

export function wishlistImageProcessingSteps(
  preference: WishlistImagePreference,
): readonly WishlistProcessingStep[] {
  if (preference === 'product-cutout') return ['product'];
  if (preference === 'portrait-cutout') return ['portrait'];
  if (preference === 'photo-cover') return [];
  return ['product', 'portrait'];
}

export function wishlistResultMatchesPreference(
  preference: WishlistImagePreference,
  mode: WishlistImageDisplayMode,
): boolean {
  if (preference === 'auto') return true;
  if (preference === 'photo-cover') return mode === 'photo-cover';
  return mode === preference || mode === 'photo-cover';
}
