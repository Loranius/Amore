import { useMemo, useRef, type ComponentProps, type CSSProperties } from 'react';
import { WishCard } from './WishCard';
import { wishlistCloudPriorityPresentation } from './wishlistCloudLayout';
import type { WishlistViewMode } from './wishlistBoardView';

type BaseWishCardProps = ComponentProps<typeof WishCard>;

interface WishlistViewCardProps extends BaseWishCardProps {
  viewMode: WishlistViewMode;
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function polaroidStyle(id: number): CSSProperties {
  const hash = stableHash(String(id));
  const rotate = hash % 2 === 0 ? -4 : 4;
  const translateX = ((hash >>> 4) % 9) - 4;
  const translateY = ((hash >>> 8) % 15) - 7;
  const tapeRotate = ((hash >>> 12) % 7) - 3;

  return {
    '--wl-polaroid-rotate': `${rotate}deg`,
    '--wl-polaroid-x': `${translateX}px`,
    '--wl-polaroid-y': `${translateY}px`,
    '--wl-polaroid-tape-rotate': `${tapeRotate}deg`,
  } as CSSProperties;
}

export function WishlistViewCard({ viewMode, ...wishCardProps }: WishlistViewCardProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { item, busy } = wishCardProps;
  const priorityPresentation = wishlistCloudPriorityPresentation(item.priority);
  const style = useMemo(
    () => viewMode === 'polaroid' ? polaroidStyle(item.id) : undefined,
    [item.id, viewMode],
  );

  if (viewMode === 'bubbles') return <WishCard {...wishCardProps} />;

  const openDetails = () => {
    if (busy) return;
    wrapperRef.current?.querySelector<HTMLButtonElement>('.wl-cloud-bubble')?.click();
  };

  return (
    <div
      ref={wrapperRef}
      className={`wl-view-card wl-view-card--${viewMode}`}
      style={style}
      data-wish-id={item.id}
    >
      <div className="wl-view-card-shell">
        <WishCard {...wishCardProps} />
      </div>

      <button
        type="button"
        className="wl-view-card-caption"
        disabled={busy}
        aria-label={`Відкрити мрію «${item.title}»`}
        onClick={openDetails}
      >
        <span className="wl-view-card-title">{item.title}</span>
        <span className="wl-view-card-meta">
          <span className="wl-view-card-priority">
            {priorityPresentation.icon} {priorityPresentation.label}
          </span>
          {item.price != null && (
            <span className="wl-view-card-price">{item.price.toLocaleString('uk-UA')} ₴</span>
          )}
        </span>
      </button>
    </div>
  );
}
