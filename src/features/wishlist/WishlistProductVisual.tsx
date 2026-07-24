import { useEffect, useState } from 'react';
import {
  resolveWishlistImage,
  wishlistImageMode,
  type WishlistImageMode,
} from './wishlistImageCutout';

interface WishlistProductVisualProps {
  src: string;
  alt: string;
  className?: string;
  loading?: 'eager' | 'lazy';
  onError?: () => void;
}

export function WishlistProductVisual({
  src,
  alt,
  className = '',
  loading = 'lazy',
  onError,
}: WishlistProductVisualProps) {
  const initialMode = wishlistImageMode(src);
  const [displaySrc, setDisplaySrc] = useState(src);
  const [mode, setMode] = useState<WishlistImageMode>(initialMode);
  const [processing, setProcessing] = useState(initialMode !== 'cutout');

  useEffect(() => {
    let active = true;
    const nextInitialMode = wishlistImageMode(src);
    setDisplaySrc(src);
    setMode(nextInitialMode);
    setProcessing(nextInitialMode !== 'cutout');

    void resolveWishlistImage(src).then((result) => {
      if (!active) return;
      setDisplaySrc(result.src);
      setMode(result.mode);
      setProcessing(false);
    });

    return () => {
      active = false;
    };
  }, [src]);

  return (
    <span
      className={`wl-product-visual ${className}`.trim()}
      data-image-mode={mode}
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
