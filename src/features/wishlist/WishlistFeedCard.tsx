import { useEffect, useState } from 'react';
import {
  normalizeWishlistCloudPriority,
  wishlistCloudPriorityPresentation,
} from './wishlistCloudLayout';
import { WishlistProductVisual } from './WishlistProductVisual';
import type { WishlistItemV3 } from './wishlistRpc';
import './wishlistFeedView.css';
import { HeartIcon } from '@/components/icons/NavIcon';

interface WishlistFeedCardProps {
  item: WishlistItemV3;
  busy: boolean;
  detailsOpen: boolean;
  onOpen: () => void;
}

export function formatWishlistFeedPrice(price: number | null): string {
  return price == null ? 'Ціну не вказано' : `${price.toLocaleString('uk-UA')} ₴`;
}

export function wishlistFeedDescription(description: string | null): string {
  return description?.trim() || 'Опис не додано';
}

export function WishlistFeedCard({
  item,
  busy,
  detailsOpen,
  onOpen,
}: WishlistFeedCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const priorityKey = normalizeWishlistCloudPriority(item.priority);
  const priority = wishlistCloudPriorityPresentation(item.priority);
  const imageAvailable = Boolean(item.image_url) && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [item.image_url]);

  return (
    <article className="wl-feed-card" data-priority={priorityKey} aria-busy={busy}>
      <button
        type="button"
        className="wl-feed-card__trigger"
        aria-label={`Відкрити мрію «${item.title}». ${priority.label}`}
        aria-haspopup="dialog"
        aria-expanded={detailsOpen}
        aria-busy={busy}
        disabled={busy}
        onClick={onOpen}
      >
        <span className="wl-feed-card__media" aria-hidden={!imageAvailable}>
          {imageAvailable ? (
            <WishlistProductVisual
              src={item.image_url ?? ''}
              alt=""
              wishId={item.id}
              processedSrc={item.processed_image_url}
              modeHint={item.image_mode}
              preference={item.image_preference}
              processingRevision={item.image_processing_revision}
              onError={() => setImageFailed(true)}
            />
          ) : (
            <span className="wl-feed-card__placeholder" aria-hidden="true"><HeartIcon size={30} /></span>
          )}
        </span>

        <span className="wl-feed-card__content">
          <span className="wl-feed-card__copy">
            <span className="wl-feed-card__title">{item.title}</span>
            <span className="wl-feed-card__description">
              {wishlistFeedDescription(item.description)}
            </span>
          </span>

          <span className="wl-feed-card__meta">
            <span className="wl-feed-card__priority">
              <priority.Icon size={12} />
              {priority.label}
            </span>
            <span className="wl-feed-card__price">{formatWishlistFeedPrice(item.price)}</span>
          </span>
        </span>

        <span className="wl-feed-card__arrow" aria-hidden="true">›</span>
      </button>
    </article>
  );
}
