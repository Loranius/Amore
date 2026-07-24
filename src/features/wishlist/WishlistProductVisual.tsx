import { useEffect, useState, type KeyboardEvent } from 'react';
import {
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
  wishlistResultMatchesPreference,
  type WishlistImagePreference,
} from './wishlistImagePreference';
import {
  CURRENT_WISHLIST_IMAGE_PROCESSOR_VERSION,
  wishlistImageResultFresh,
  wishlistImageRetryDelayMs,
  type WishlistImageProcessingStatus,
} from './wishlistImageProcessingState';
import { runWishlistImageProcessing } from './wishlistImageProcessingRunner';
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
  onActivate?: (() => void) | undefined;
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

function fallbackVisual(src: string, preference: WishlistImagePreference): Omit<VisualState, 'processing'> {
  if (preference === 'photo-cover') return { src, mode: 'photo-cover' };
  const processingMode: WishlistImageMode = wishlistImageMode(src);
  return {
    src,
    mode: inferWishlistImageDisplayMode(src, processingMode),
  };
}

function initialVisual(input: {
  src: string;
  wishId?: number | undefined;
  processedSrc?: string | null | undefined;
  modeHint?: WishlistImageDisplayMode | null | undefined;
  preference: WishlistImagePreference;
  processingStatus: WishlistImageProcessingStatus;
  processorVersion: number;
  persistenceEnabled: boolean;
}): VisualState {
  const direct = persistedVisual({
    source: input.src,
    processedSrc: input.processedSrc,
    modeHint: input.modeHint,
    preference: input.preference,
  });
  const stored = direct ? null : wishlistStoredVisual(input.wishId, input.src);
  const usable = direct ?? (
    stored && wishlistResultMatchesPreference(input.preference, stored.mode)
      ? stored
      : null
  );

  if (usable) {
    const fresh = input.persistenceEnabled && wishlistImageResultFresh({
      status: input.processingStatus,
      processorVersion: input.processorVersion,
      preference: input.preference,
      mode: usable.mode,
      processedSrc: usable.mode === 'photo-cover' ? null : usable.src,
    });
    return { ...usable, processing: !fresh };
  }

  return {
    ...fallbackVisual(input.src, input.preference),
    processing: true,
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
  onActivate,
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
  const effectiveStatus = registered?.processingStatus
    ?? (effectiveModeHint ? 'ready' : 'pending');
  const effectiveProcessorVersion = registered?.processorVersion
    ?? (effectiveModeHint ? CURRENT_WISHLIST_IMAGE_PROCESSOR_VERSION : 0);

  const initial = initialVisual({
    src,
    wishId: effectiveWishId,
    processedSrc: effectiveProcessedSrc,
    modeHint: effectiveModeHint,
    preference: effectivePreference,
    processingStatus: effectiveStatus,
    processorVersion: effectiveProcessorVersion,
    persistenceEnabled,
  });
  const [displaySrc, setDisplaySrc] = useState(initial.src);
  const [mode, setMode] = useState<WishlistImageDisplayMode>(initial.mode);
  const [processing, setProcessing] = useState(initial.processing);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    let active = true;
    let retryTimer: number | null = null;
    const direct = persistedVisual({
      source: src,
      processedSrc: effectiveProcessedSrc,
      modeHint: effectiveModeHint,
      preference: effectivePreference,
    });
    const stored = direct ? null : wishlistStoredVisual(effectiveWishId, src);
    const usable = direct ?? (
      stored && wishlistResultMatchesPreference(effectivePreference, stored.mode)
        ? stored
        : null
    );
    const fresh = usable ? wishlistImageResultFresh({
      status: effectiveStatus,
      processorVersion: effectiveProcessorVersion,
      preference: effectivePreference,
      mode: usable.mode,
      processedSrc: usable.mode === 'photo-cover' ? null : usable.src,
    }) : false;

    if (usable) {
      setDisplaySrc(usable.src);
      setMode(usable.mode);
    } else {
      const fallback = fallbackVisual(src, effectivePreference);
      setDisplaySrc(fallback.src);
      setMode(fallback.mode);
    }

    if (persistenceEnabled && fresh) {
      setProcessing(false);
      onProcessingChange?.(false);
      return () => {
        active = false;
      };
    }

    setProcessing(true);
    onProcessingChange?.(true);

    void runWishlistImageProcessing({
      wishId: effectiveWishId,
      sourceUrl: src,
      preference: effectivePreference,
      processingRevision: effectiveRevision,
      persistenceEnabled,
      processorVersion: CURRENT_WISHLIST_IMAGE_PROCESSOR_VERSION,
    }).then((result) => {
      if (!active) return;

      if (result.kind === 'deferred') {
        setProcessing(false);
        onProcessingChange?.(false);
        const delay = wishlistImageRetryDelayMs(result.retryAfterMs);
        if (delay !== null) {
          retryTimer = window.setTimeout(() => {
            if (active) setRetryNonce((current) => current + 1);
          }, delay);
        }
        return;
      }

      setDisplaySrc(result.visual.src);
      setMode(result.visual.mode);
      setProcessing(false);
      onProcessingChange?.(false);
      onPersisted?.(result.visual);
    }).catch((error) => {
      if (!active) return;
      console.info('[Wishlist] image processing failed safely:', error);
      if (!usable) {
        setDisplaySrc(src);
        setMode('photo-cover');
      }
      setProcessing(false);
      onProcessingChange?.(false);
      onPersistenceError?.();
    });

    return () => {
      active = false;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
    };
  }, [
    effectiveModeHint,
    effectivePreference,
    effectiveProcessedSrc,
    effectiveProcessorVersion,
    effectiveRevision,
    effectiveStatus,
    effectiveWishId,
    onPersisted,
    onPersistenceError,
    onProcessingChange,
    persistenceEnabled,
    retryNonce,
    src,
  ]);

  const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (!onActivate || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    onActivate();
  };

  return (
    <span
      className={`wl-product-visual ${className}`.trim()}
      data-image-mode={mode}
      data-image-transparent={isWishlistTransparentDisplayMode(mode) ? 'true' : 'false'}
      data-processing={processing ? 'true' : 'false'}
      role={onActivate ? 'button' : undefined}
      tabIndex={onActivate ? 0 : undefined}
      aria-label={onActivate ? `Відкрити фото: ${alt}` : undefined}
      onClick={onActivate}
      onKeyDown={handleKeyDown}
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
