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
import { resolveWishlistPortrait } from './wishlistPortraitSegmentation';
import { persistWishlistProcessedVisual } from './wishlistProcessedImagePersistence';
import { wishlistStoredVisual } from './wishlistProcessedImageRegistry';

interface WishlistProductVisualProps {
  src: string;
  alt: string;
  className?: string;
  loading?: 'eager' | 'lazy';
  modeHint?: WishlistImageDisplayMode;
  onError?: () => void;
}

function initialVisual(
  src: string,
  modeHint: WishlistImageDisplayMode | undefined,
): { src: string; mode: WishlistImageDisplayMode; processing: boolean } {
  if (modeHint) return { src, mode: modeHint, processing: false };

  const stored = wishlistStoredVisual(src);
  if (stored) return { ...stored, processing: false };

  const processingMode = wishlistImageMode(src);
  return {
    src,
    mode: inferWishlistImageDisplayMode(src, processingMode),
    processing: processingMode !== 'cutout',
  };
}

export function WishlistProductVisual({
  src,
  alt,
  className = '',
  loading = 'lazy',
  modeHint,
  onError,
}: WishlistProductVisualProps) {
  const initial = initialVisual(src, modeHint);
  const [displaySrc, setDisplaySrc] = useState(initial.src);
  const [mode, setMode] = useState<WishlistImageDisplayMode>(initial.mode);
  const [processing, setProcessing] = useState(initial.processing);

  useEffect(() => {
    let active = true;
    const nextProcessingMode: WishlistImageMode = wishlistImageMode(src);
    const stored = modeHint === undefined ? wishlistStoredVisual(src) : null;

    if (modeHint !== undefined) {
      setDisplaySrc(src);
      setMode(modeHint);
      setProcessing(false);
      return () => {
        active = false;
      };
    }

    if (stored) {
      setDisplaySrc(stored.src);
      setMode(stored.mode);
      setProcessing(false);
      return () => {
        active = false;
      };
    }

    setDisplaySrc(src);
    setMode(inferWishlistImageDisplayMode(src, nextProcessingMode));
    setProcessing(nextProcessingMode !== 'cutout');

    void (async () => {
      try {
        const productResult = await resolveWishlistImage(src);
        if (!active) return;

        if (productResult.mode === 'cutout') {
          const visual = { src: productResult.src, mode: 'product-cutout' as const };
          setDisplaySrc(visual.src);
          setMode(visual.mode);
          setProcessing(false);
          void persistWishlistProcessedVisual(src, visual);
          return;
        }

        const portraitResult = await resolveWishlistPortrait(src);
        if (!active) return;
        setDisplaySrc(portraitResult.src);
        setMode(portraitResult.mode);
        setProcessing(false);
        void persistWishlistProcessedVisual(src, portraitResult);
      } catch (error) {
        if (!active) return;
        console.info('[Wishlist] processed image cache skipped:', error);
        setDisplaySrc(src);
        setMode('photo-cover');
        setProcessing(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [modeHint, src]);

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
