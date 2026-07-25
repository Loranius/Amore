import {
  wishlistResultMatchesPreference,
  type WishlistImagePreference,
} from './wishlistImagePreference';
import type { WishlistImageDisplayMode } from './wishlistImageModes';

export const CURRENT_WISHLIST_IMAGE_PROCESSOR_VERSION = 1;
export const MAX_WISHLIST_IMAGE_AUTO_ATTEMPTS = 3;
export const DEFAULT_WISHLIST_IMAGE_LEASE_MS = 2 * 60 * 1000;

export type WishlistImageProcessingStatus =
  | 'idle'
  | 'pending'
  | 'processing'
  | 'ready'
  | 'failed';

export interface WishlistImageProcessingClaim {
  sessionId: string;
  leaseExpiresAt: string;
}

export interface WishlistImageProcessingDecision {
  status: WishlistImageProcessingStatus;
  claim: WishlistImageProcessingClaim | null;
  retryAfterMs: number | null;
}

const STALE_IMAGE_PROCESSING_MESSAGES = [
  'image_processing_source_changed',
  'image_processing_preference_changed',
  'image_processing_revision_changed',
  'image_processing_stale',
] as const;

function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error ?? '')).toLowerCase();
}

/**
 * A worker becomes stale when the user edits the image or its display preference
 * while an older tab/component is still mounted. Retrying the old generation can
 * never succeed and must be treated as a terminal no-op.
 */
export function isWishlistImageProcessingStaleError(error: unknown): boolean {
  const message = errorMessage(error);
  return STALE_IMAGE_PROCESSING_MESSAGES.some((code) => message.includes(code));
}

export function wishlistImageResultUsable(input: {
  preference: WishlistImagePreference;
  mode: WishlistImageDisplayMode | null | undefined;
  processedSrc: string | null | undefined;
}): boolean {
  const { preference, mode, processedSrc } = input;
  if (!mode || !wishlistResultMatchesPreference(preference, mode)) return false;
  return mode === 'photo-cover' || Boolean(processedSrc);
}

export function wishlistImageResultFresh(input: {
  status: WishlistImageProcessingStatus | null | undefined;
  processorVersion: number | null | undefined;
  preference: WishlistImagePreference;
  mode: WishlistImageDisplayMode | null | undefined;
  processedSrc: string | null | undefined;
}): boolean {
  return input.status === 'ready'
    && Number(input.processorVersion ?? 0) >= CURRENT_WISHLIST_IMAGE_PROCESSOR_VERSION
    && wishlistImageResultUsable(input);
}

export function wishlistImageRetryDelayMs(
  retryAfterMs: number | null | undefined,
): number | null {
  if (retryAfterMs == null || !Number.isFinite(retryAfterMs)) return null;
  return Math.min(Math.max(Math.ceil(retryAfterMs), 750), DEFAULT_WISHLIST_IMAGE_LEASE_MS);
}

export function wishlistImageProcessingErrorCode(error: unknown): string {
  const normalized = errorMessage(error);

  if (normalized.includes('image_load') || normalized.includes('image_decode')) {
    return 'image_load_failed';
  }
  if (normalized.includes('portrait') || normalized.includes('segment')) {
    return 'portrait_segmentation_failed';
  }
  if (normalized.includes('cutout') || normalized.includes('background')) {
    return 'product_cutout_failed';
  }
  if (normalized.includes('storage') || normalized.includes('upload')) {
    return 'storage_upload_failed';
  }
  if (normalized.includes('lease') || normalized.includes('session')) {
    return 'processing_lease_lost';
  }
  if (normalized.includes('processed_image') || normalized.includes('persist')) {
    return 'processed_image_persistence_failed';
  }
  return 'image_processing_failed';
}
