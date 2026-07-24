import {
  resolveWishlistImage,
} from './wishlistImageCutout';
import type { WishlistImageDisplayMode } from './wishlistImageModes';
import {
  wishlistImageProcessingSteps,
  type WishlistImagePreference,
} from './wishlistImagePreference';
import {
  CURRENT_WISHLIST_IMAGE_PROCESSOR_VERSION,
  wishlistImageProcessingErrorCode,
  type WishlistImageProcessingStatus,
} from './wishlistImageProcessingState';
import { resolveWishlistPortrait } from './wishlistPortraitSegmentation';
import { persistWishlistProcessedVisual } from './wishlistProcessedImagePersistence';
import {
  updateWishlistProcessingState,
  type WishlistStoredVisual,
} from './wishlistProcessedImageRegistry';
import {
  beginWishlistImageProcessing,
  failWishlistImageProcessing,
} from './wishlistRpc';

export type WishlistImageProcessingRunResult =
  | { kind: 'ready'; visual: WishlistStoredVisual }
  | {
      kind: 'deferred';
      status: WishlistImageProcessingStatus;
      retryAfterMs: number | null;
    };

const pendingRuns = new Map<string, Promise<WishlistImageProcessingRunResult>>();

function processingSource(src: string, revision: number, processorVersion: number): string {
  const withoutFragment = src.split('#', 1)[0] ?? src;
  return `${withoutFragment}#amore-image-r${revision}-v${processorVersion}`;
}

async function processByPreference(
  src: string,
  preference: WishlistImagePreference,
  revision: number,
  processorVersion: number,
): Promise<WishlistStoredVisual> {
  const steps = wishlistImageProcessingSteps(preference);
  if (steps.length === 0) return { src, mode: 'photo-cover' };

  const candidate = processingSource(src, revision, processorVersion);
  for (const step of steps) {
    if (step === 'product') {
      const result = await resolveWishlistImage(candidate);
      if (result.mode === 'cutout') {
        return { src: result.src, mode: 'product-cutout' };
      }
      continue;
    }

    const result = await resolveWishlistPortrait(candidate);
    if (result.mode === 'portrait-cutout') return result;
  }

  return { src, mode: 'photo-cover' };
}

function runKey(input: {
  wishId: number;
  sourceUrl: string;
  preference: WishlistImagePreference;
  processingRevision: number;
  processorVersion: number;
}): string {
  return [
    input.wishId,
    input.processingRevision,
    input.processorVersion,
    input.preference,
    input.sourceUrl,
  ].join(':');
}

async function runPersistedProcessing(input: {
  wishId: number;
  sourceUrl: string;
  preference: WishlistImagePreference;
  processingRevision: number;
  processorVersion: number;
}): Promise<WishlistImageProcessingRunResult> {
  const decision = await beginWishlistImageProcessing({
    wishId: input.wishId,
    sourceImageUrl: input.sourceUrl,
    imagePreference: input.preference,
    processingRevision: input.processingRevision,
    processorVersion: input.processorVersion,
  });

  if (!decision.claim) {
    updateWishlistProcessingState(input.wishId, input.sourceUrl, {
      processingStatus: decision.status,
      processingTargetVersion: decision.status === 'processing'
        ? input.processorVersion
        : null,
      processingLeaseExpiresAt: null,
    });
    return {
      kind: 'deferred',
      status: decision.status,
      retryAfterMs: decision.retryAfterMs,
    };
  }

  updateWishlistProcessingState(input.wishId, input.sourceUrl, {
    processingStatus: 'processing',
    processingTargetVersion: input.processorVersion,
    processingErrorCode: null,
    processingLeaseExpiresAt: decision.claim.leaseExpiresAt,
  });

  try {
    const visual = await processByPreference(
      input.sourceUrl,
      input.preference,
      input.processingRevision,
      input.processorVersion,
    );

    await persistWishlistProcessedVisual({
      wishId: input.wishId,
      sourceUrl: input.sourceUrl,
      preference: input.preference,
      visual,
      processingRevision: input.processingRevision,
      processorVersion: input.processorVersion,
      sessionId: decision.claim.sessionId,
    });

    return { kind: 'ready', visual };
  } catch (error) {
    const errorCode = wishlistImageProcessingErrorCode(error);
    await failWishlistImageProcessing({
      wishId: input.wishId,
      sourceImageUrl: input.sourceUrl,
      imagePreference: input.preference,
      processingRevision: input.processingRevision,
      processorVersion: input.processorVersion,
      sessionId: decision.claim.sessionId,
      errorCode,
    }).catch(() => undefined);

    updateWishlistProcessingState(input.wishId, input.sourceUrl, {
      processingStatus: 'failed',
      processingTargetVersion: input.processorVersion,
      processingErrorCode: errorCode,
      processingLeaseExpiresAt: null,
    });
    throw error;
  }
}

export async function runWishlistImageProcessing(input: {
  wishId?: number | undefined;
  sourceUrl: string;
  preference: WishlistImagePreference;
  processingRevision: number;
  persistenceEnabled: boolean;
  processorVersion?: number | undefined;
}): Promise<WishlistImageProcessingRunResult> {
  const processorVersion = input.processorVersion
    ?? CURRENT_WISHLIST_IMAGE_PROCESSOR_VERSION;

  if (!input.persistenceEnabled || input.wishId == null) {
    const visual = await processByPreference(
      input.sourceUrl,
      input.preference,
      input.processingRevision,
      processorVersion,
    );
    return { kind: 'ready', visual };
  }

  const key = runKey({
    wishId: input.wishId,
    sourceUrl: input.sourceUrl,
    preference: input.preference,
    processingRevision: input.processingRevision,
    processorVersion,
  });
  const current = pendingRuns.get(key);
  if (current) return current;

  const task = runPersistedProcessing({
    wishId: input.wishId,
    sourceUrl: input.sourceUrl,
    preference: input.preference,
    processingRevision: input.processingRevision,
    processorVersion,
  }).finally(() => {
    pendingRuns.delete(key);
  });

  pendingRuns.set(key, task);
  return task;
}

export type { WishlistImageDisplayMode };
