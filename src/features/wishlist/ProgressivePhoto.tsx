import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import './progressivePhoto.css';

type ProgressivePhotoState = 'loading' | 'ready' | 'error';

interface ProgressivePhotoProps {
  src: string;
  alt: string;
  ariaLabel: string;
  buttonClassName: string;
  imageClassName?: string;
  revealDelayMs?: number;
  fallback: ReactNode;
  onOpen: (src: string) => void;
}

const MAX_REVEAL_DELAY_MS = 280;

export function normalizeRevealDelay(delayMs: number | undefined): number {
  if (!Number.isFinite(delayMs)) return 0;
  return Math.max(0, Math.min(MAX_REVEAL_DELAY_MS, Math.round(delayMs ?? 0)));
}

export function ProgressivePhoto({
  src,
  alt,
  ariaLabel,
  buttonClassName,
  imageClassName,
  revealDelayMs,
  fallback,
  onOpen,
}: ProgressivePhotoProps) {
  const [state, setState] = useState<ProgressivePhotoState>('loading');
  const imageRef = useRef<HTMLImageElement>(null);
  const generationRef = useRef(0);
  const delay = normalizeRevealDelay(revealDelayMs);

  const revealDecodedImage = useCallback(async (image: HTMLImageElement, generation: number) => {
    try {
      await image.decode();
    } catch {
      // Some browsers reject decode() even after a successful load. A complete
      // image with real dimensions is still safe to reveal atomically.
      if (!image.complete || image.naturalWidth === 0) return;
    }

    if (generationRef.current !== generation || image.naturalWidth === 0) return;

    window.requestAnimationFrame(() => {
      if (generationRef.current === generation) setState('ready');
    });
  }, []);

  useEffect(() => {
    generationRef.current += 1;
    const generation = generationRef.current;
    setState('loading');

    const image = imageRef.current;
    if (!image?.complete) return;

    if (image.naturalWidth === 0) {
      setState('error');
      return;
    }

    void revealDecodedImage(image, generation);
  }, [revealDecodedImage, src]);

  const wrapperStyle = {
    '--wl-image-reveal-delay': `${delay}ms`,
  } as CSSProperties;

  return (
    <button
      type="button"
      className={buttonClassName}
      aria-label={ariaLabel}
      aria-disabled={state !== 'ready'}
      onClick={() => {
        if (state === 'ready') onOpen(src);
      }}
    >
      <span
        className={`wl-progressive-photo wl-progressive-photo--${state}`}
        style={wrapperStyle}
        aria-busy={state === 'loading'}
      >
        {state === 'error' ? (
          <span className="wl-progressive-photo-fallback">{fallback}</span>
        ) : (
          <img
            ref={imageRef}
            key={src}
            src={src}
            alt={alt}
            className={imageClassName}
            loading="lazy"
            decoding="async"
            onLoad={(event) => {
              const generation = generationRef.current;
              void revealDecodedImage(event.currentTarget, generation);
            }}
            onError={() => setState('error')}
          />
        )}
      </span>
    </button>
  );
}
