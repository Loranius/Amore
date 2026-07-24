import type { CSSProperties } from 'react';
import './wishlistHeroSkeleton.css';
import './wishlistCloud.css';

interface WishlistGridSkeletonProps {
  cards?: number;
}

const CLOUD_SKELETON_SIZES = [174, 116, 78, 116, 78, 174, 78, 116];
const CLOUD_SKELETON_MARGINS = [
  '4px -4px 14px 6px',
  '18px 4px -2px -6px',
  '-4px 8px 20px 1px',
  '8px -8px 12px 4px',
  '22px 5px -5px -5px',
  '-10px 8px 18px 2px',
  '15px -3px 4px 4px',
  '-2px 6px 18px -4px',
];

export function WishlistGridSkeleton({ cards = 7 }: WishlistGridSkeletonProps) {
  const count = Math.max(1, Math.min(cards, CLOUD_SKELETON_SIZES.length));

  return (
    <div className="wl-cloud-skeleton" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="wl-cloud-skeleton-bubble"
          style={
            {
              '--wl-cloud-skeleton-size': `${CLOUD_SKELETON_SIZES[index] ?? 116}px`,
              '--wl-cloud-skeleton-margin': CLOUD_SKELETON_MARGINS[index] ?? '0',
              animationDelay: `${index * -0.14}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

export function WishlistPageSkeleton() {
  return (
    <section className="wishlist pink-page wl-page-skeleton" aria-busy="true">
      <div className="wl-skeleton-hero-card" aria-hidden="true">
        <div className="wl-skeleton-hero-copy">
          <div className="wl-skeleton-line wl-skeleton-line--eyebrow wl-skeleton-shimmer" />
          <div className="wl-skeleton-line wl-skeleton-line--hero wl-skeleton-shimmer" />
          <div className="wl-skeleton-line wl-skeleton-line--medium wl-skeleton-shimmer" />
          <div className="wl-skeleton-metrics">
            <div className="wl-skeleton-metric wl-skeleton-shimmer" />
            <div className="wl-skeleton-metric wl-skeleton-shimmer" />
          </div>
        </div>
        <div className="wl-skeleton-hero-actions">
          <div className="wl-skeleton-symbol wl-skeleton-shimmer" />
          <div className="wl-skeleton-cta wl-skeleton-shimmer" />
        </div>
      </div>
      <div className="wl-skeleton-tabs wl-skeleton-shimmer" aria-hidden="true" />
      <WishlistGridSkeleton />
      <p className="sr-only" role="status" aria-live="polite">
        Завантаження хмари бажань…
      </p>
    </section>
  );
}
