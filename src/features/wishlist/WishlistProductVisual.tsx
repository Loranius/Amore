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

interface WishlistProductVisualProps {
  src: string;
  alt: string;
  className?: string;
  loading?: 'eager' | 'lazy';
  modeHint?: WishlistImageDisplayMode;
  onError?: () => void;
}

export function WishlistProductVisual({
  src,
  alt,
  className = '',
  loading = 'lazy',
  modeHint,
  onError,
}: WishlistProductVisualProps) {
  const initialProcessingMode = wishlistImageMode(src);
  const initialDisplayMode = inferWishlistImageDisplayMode(
    src,
    initialProcessingMode,
    modeHint,
  );
  const [displaySrc, setDisplaySrc] = useState(src);
  const [mode, setMode] = useState<WishlistImageDisplayMode>(initialDisplayMode);
  const [processing, setProcessing] = useState(
    modeHint === undefined && initialProcessingMode !== 'cutout',
  );

  useEffect(() => {
    let active = true;
    const nextProcessingMode: WishlistImageMode = wishlistImageMode(src);
    setDisplaySrc(src);
    setMode(inferWishlistImageDisplayMode(src, nextProcessingMode, modeHint));

    if (modeHint !== undefined) {
      setProcessing(false);
      return () => {
        active = false;
      };
    }

    setProcessing(nextProcessingMode !== 'cutout');
    void resolveWishlistImage(src).then((result) => {
      if (!active) return;
      setDisplaySrc(result.src);
      setMode(inferWishlistImageDisplayMode(result.src, result.mode));
      setProcessing(false);
    });

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
        onError={onError}
      />
    </span>
  );
}
