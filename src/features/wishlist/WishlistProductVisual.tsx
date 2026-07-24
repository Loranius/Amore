import { useEffect, useState } from 'react';
import {
  resolveWishlistImage,
  wishlistImageMode,
  type WishlistImageMode,
} from './wishlistImageCutout';
import {
  inferWishlistImageDisplayMode,
  isWishlistTransparentDisplayMode,
  type WishlistImageDisplayMode,
} from './wishlistImageModes';
import {
  DEFAULT_WISHLIST_IMAGE_PREFERENCE,
  wishlistImageProcessingSteps,
  wishlistResultMatchesPreference,
  type WishlistImagePreference,
} from './wishlistImagePreference';
import { resolveWishlistPortrait } from './wishlistPortraitSegmentation';
import { persistWishlistProcessedVisual } from './wishlistProcessedImagePersistence';
import {
  wishlistRegisteredImage,
  wishlistStoredVisual,
} from './wishlistProcessedImageRegistry';

interface WishlistProductVisualProps {
  src: string;
  alt: string;
  wishId?: number | undefined;
  className?: string | undefined;
  loading?: 'eager' | 'lazy' | undefined;
  processedSrc?: string | null | undefined;
  modeHint?: WishlistImageDisplayMode | null | undefined;
  preference?: WishlistImagePreference | undefined;
  processingRevision?: number | undefined;
  persistenceEnabled?: boolean | undefined;
  onProcessingChange?: ((processing: boolean) => void) | undefined;
  onPersisted?: ((visual: { src: string; mode: WishlistImageDisplayMode }) => void) | undefined;
  onPersistenceError?: (() => void) | undefined;
  onError?: (() => void) | undefined;
}

interface VisualState {
  src: string;
  mode: WishlistImageDisplayMode;
  processing: boolean;
}

function persistedVisual(input: {
  source: string;
  processedSrc?: string | null | undefined;
  modeHint?: WishlistImageDisplayMode | null | undefined;
  preference: WishlistImagePreference;
}): Omit<VisualState, 'processing'> | null {
  const { source, processedSrc, modeHint, preference } = input;
  if (!modeHint || !wishlistResultMatchesPreference(preference, modeHint)) return null;
  if (modeHint === 'photo-cover') return { src: source, mode: 'photo-cover' };
  if (!processedSrc) return null;
  return { src: processedSrc, mode: modeHint };
}

function processingSource(src: string, revision: number): string {
  if (revision <= 0) return src;
  const withoutFragment = src.split('#', 1)[0] ?? src;
  return `${withoutFragment}#amore-reprocess-${revision}`;
}

async function processByPreference(
  src: string,
  preference: WishlistImagePreference,
  revision: number,
): Promise<{ src: string; mode: WishlistImageDisplayMode }> {
  const steps = wishlistImageProcessingSteps(preference);
  if (steps.length === 0) return { src, mode: 'photo-cover' };

  const candidate = processingSource(src, revision);
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

function initialVisual(input: {
  src: string;
  wishId?: number | undefined;
  processedSrc?: string | null | undefined;
  modeHint?: WishlistImageDisplayMode | null | undefined;
  preference: WishlistImagePreference;
}): VisualState {
  const persisted = persistedVisual({
    source: input.src,
    processedSrc: input.processedSrc,
    modeHint: input.modeHint,
    preference: input.preference,
  });
  if (persisted) return { ...persisted, processing: false };

  const stored = wishlistStoredVisual(input.wishId, input.src);
  if (stored && wishlistResultMatchesPreference(input.preference, stored.mode)) {
    return { ...stored, processing: false };
  }

  if (input.preference === 'photo-cover') {
    return { src: input.src, mode: 'photo-cover', processing: false };
  }

  const processingMode: WishlistImageMode = wishlistImageMode(input.src);
  return {
    src: input.src,
    mode: inferWishlistImageDisplayMode(input.src, processingMode),
    processing: processingMode !== 'cutout',
  };
}

export function WishlistProductVisual({
  src,
  alt,
  wishId,
  className = '',
  loading = 'lazy',
  processedSrc,
  modeHint,
  preference,
  processingRevision,
  persistenceEnabled = true,
  onProcessingChange,
  onPersisted,
  onPersistenceError,
  onError,
}: WishlistProductVisualProps) {
  const registered = persistenceEnabled ? wishlistRegisteredImage(wishId, src) : null;
  const effectiveWishId = persistenceEnabled ? (wishId ?? registered?.wishId) : undefined;
  const effectiveProcessedSrc = processedSrc ?? registered?.processedSrc ?? null;
  const effectiveModeHint = modeHint ?? registered?.mode ?? null;
  const effectivePreference = preference
    ?? registered?.preference
    ?? DEFAULT_WISHLIST_IMAGE_PREFERENCE;
  const effectiveRevision = processingRevision ?? registered?.revision ?? 0;

  const initial = initialVisual({
    src,
    wishId: effectiveWishId,
    processedSrc: effectiveProcessedSrc,
    modeHint: effectiveModeHint,
    preference: effectivePreference,
  });
  const [displaySrc, setDisplaySrc] = useState(initial.src);
  const [mode, setMode] = useState<WishlistImageDisplayMode>(initial.mode);
  const [processing, setProcessing] = useState(initial.processing);

  useEffect(() => {
    let active = true;
    const direct = persistedVisual({
      source: src,
      processedSrc: effectiveProcessedSrc,
      modeHint: effectiveModeHint,
      preference: effectivePreference,
    });
    const stored = direct ? null : wishlistStoredVisual(effectiveWishId, src);

    if (direct || (stored && wishlistResultMatchesPreference(effectivePreference, stored.mode))) {
      const visual = direct ?? stored!;
      setDisplaySrc(visual.src);
      setMode(visual.mode);
      setProcessing(false);
      onProcessingChange?.(false);
      return () => {
        active = false;
      };
    }

    setDisplaySrc(src);
    setMode(effectivePreference === 'photo-cover'
      ? 'photo-cover'
      : inferWishlistImageDisplayMode(src, wishlistImageMode(src)));
    setProcessing(effectivePreference !== 'photo-cover');
    onProcessingChange?.(effectivePreference !== 'photo-cover');

    void (async () => {
      const visual = await processByPreference(src, effectivePreference, effectiveRevision);
      if (!active) return;

      setDisplaySrc(visual.src);
      setMode(visual.mode);

      try {
        if (persistenceEnabled) {
          await persistWishlistProcessedVisual({
            wishId: effectiveWishId,
            sourceUrl: src,
            visual,
            processingRevision: effectiveRevision,
            previousProcessedUrl: effectiveProcessedSrc,
          });
        }
        if (active) onPersisted?.(visual);
      } catch (error) {
        console.info('[Wishlist] processed image persistence skipped:', error);
        if (active) onPersistenceError?.();
      } finally {
        if (active) {
          setProcessing(false);
          onProcessingChange?.(false);
        }
      }
    })().catch((error) => {
      if (!active) return;
      console.info('[Wishlist] processed image cache skipped:', error);
      setDisplaySrc(src);
      setMode('photo-cover');
      setProcessing(false);
      onProcessingChange?.(false);
      onPersistenceError?.();
    });

    return () => {
      active = false;
    };
  }, [
    effectiveModeHint,
    effectivePreference,
    effectiveProcessedSrc,
    effectiveRevision,
    effectiveWishId,
    onPersisted,
    onPersistenceError,
    onProcessingChange,
    persistenceEnabled,
    src,
  ]);

  return (
    <span
      className={`wl-product-visual ${className}`.trim()}
      data-image-mode={mode}
      data-image-transparent={isWishlistTransparentDisplayMode(mode) ? 'true' : 'false'}
      data-processing={processing ? 'true' : 'false'}
    >
      <img
        src={displaySrc}
        alt={alt}
        loading={loading}
        decoding="async"
        onError={() => {
          if (displaySrc !== src) {
            setDisplaySrc(src);
            setMode('photo-cover');
            return;
          }
          onError?.();
        }}
      />
    </span>
  );
}
