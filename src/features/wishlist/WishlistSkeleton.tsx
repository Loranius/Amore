import './wishlistHeroSkeleton.css';

interface WishlistGridSkeletonProps {
  cards?: number;
}

function SkeletonCard() {
  return (
    <div className="wl-skeleton-card" aria-hidden="true">
      <div className="wl-skeleton-media wl-skeleton-shimmer" />
      <div className="wl-skeleton-card-content">
        <div className="wl-skeleton-line wl-skeleton-line--title wl-skeleton-shimmer" />
        <div className="wl-skeleton-line wl-skeleton-line--medium wl-skeleton-shimmer" />
        <div className="wl-skeleton-line wl-skeleton-line--short wl-skeleton-shimmer" />
        <div className="wl-skeleton-action wl-skeleton-shimmer" />
      </div>
    </div>
  );
}

export function WishlistGridSkeleton({ cards = 3 }: WishlistGridSkeletonProps) {
  return (
    <div className="wishlist-grid wl-skeleton-grid" aria-hidden="true">
      {Array.from({ length: cards }, (_, index) => <SkeletonCard key={index} />)}
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
        Завантаження списку бажань…
      </p>
    </section>
  );
}
