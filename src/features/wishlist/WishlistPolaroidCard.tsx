import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  normalizeWishlistCloudPriority,
  wishlistCloudPriorityPresentation,
} from './wishlistCloudLayout';
import { wishlistPolaroidLayout } from './wishlistPolaroidLayout';
import { WishlistProductVisual } from './WishlistProductVisual';
import type { WishlistItemV3 } from './wishlistRpc';
import './wishlistPolaroidView.css';
import { HeartIcon } from '@/components/icons/NavIcon';

interface WishlistPolaroidCardProps {
  item: WishlistItemV3;
  index: number;
  seed: number;
  busy: boolean;
  detailsOpen: boolean;
  onOpen: () => void;
}

export function WishlistPolaroidCard({
  item,
  index,
  seed,
  busy,
  detailsOpen,
  onOpen,
}: WishlistPolaroidCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const priorityKey = normalizeWishlistCloudPriority(item.priority);
  const priority = wishlistCloudPriorityPresentation(item.priority);
  const placement = useMemo(
    () => wishlistPolaroidLayout(seed, item.id, index),
    [index, item.id, seed],
  );
  const style = {
    '--wl-polaroid-rotate': `${placement.rotate}deg`,
    '--wl-polaroid-x': `${placement.x}px`,
    '--wl-polaroid-y': `${placement.y}px`,
    '--wl-polaroid-tape-rotate': `${placement.tapeRotate}deg`,
  } as CSSProperties;
  const imageAvailable = Boolean(item.image_url) && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [item.image_url]);

  return (
    <article
      className="wl-polaroid-card"
      data-priority={priorityKey}
      style={style}
      aria-busy={busy}
    >
      <button
        type="button"
        className="wl-polaroid-card__trigger"
        aria-label={`Відкрити мрію «${item.title}». ${priority.label}`}
        aria-haspopup="dialog"
        aria-expanded={detailsOpen}
        aria-busy={busy}
        disabled={busy}
        onClick={onOpen}
      >
        <span className="wl-polaroid-card__media" aria-hidden={!imageAvailable}>
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
            <span className="wl-polaroid-card__placeholder" aria-hidden="true"><HeartIcon size={34} /></span>
          )}
        </span>

        <span className="wl-polaroid-card__caption">
          <strong className="wl-polaroid-card__title">{item.title}</strong>
          <span className="wl-polaroid-card__priority">
            <priority.Icon size={12} />
            {priority.label}
          </span>
        </span>
      </button>
    </article>
  );
}
