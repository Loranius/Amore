import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  normalizeWishlistCloudPriority,
  wishlistCloudPlacement,
  wishlistCloudPriorityPresentation,
} from './wishlistCloudLayout';
import { WishlistProductVisual } from './WishlistProductVisual';
import type { WishlistItemV3 } from './wishlistRpc';
import './wishlistCloud.css';
import { HeartIcon } from '@/components/icons/NavIcon';

export interface WishlistBubbleCardProps {
  item: WishlistItemV3;
  /** Seed розкладки дошки: свіжий на кожне відкриття вигляду, сталий у межах сесії. */
  seed: number;
  busy: boolean;
  detailsOpen: boolean;
  onOpen: () => void;
}

export function WishlistBubbleCard({
  item,
  seed,
  busy,
  detailsOpen,
  onOpen,
}: WishlistBubbleCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const priority = normalizeWishlistCloudPriority(item.priority);
  const priorityPresentation = wishlistCloudPriorityPresentation(item.priority);
  const placement = useMemo(
    () => wishlistCloudPlacement(seed, item.id, item.id % 19),
    [seed, item.id],
  );

  const bubbleStyle = {
    '--wl-cloud-size': `${priorityPresentation.size}px`,
    '--wl-cloud-margin-top': `${placement.marginTop}px`,
    '--wl-cloud-margin-right': `${placement.marginRight}px`,
    '--wl-cloud-margin-bottom': `${placement.marginBottom}px`,
    '--wl-cloud-margin-left': `${placement.marginLeft}px`,
    '--wl-cloud-x': `${placement.translateX}px`,
    '--wl-cloud-y': `${placement.translateY}px`,
    '--wl-cloud-rotate': `${placement.rotate}deg`,
    '--wl-cloud-delay': `${placement.delay}s`,
    '--wl-cloud-duration': `${placement.duration}s`,
    '--wl-cloud-z': placement.zIndex,
    '--wl-cloud-drift-x': `${placement.driftX}px`,
    '--wl-cloud-drift-y': `${placement.driftY}px`,
  } as CSSProperties;

  useEffect(() => {
    setImageFailed(false);
  }, [item.image_url]);

  const imageAvailable = Boolean(item.image_url) && !imageFailed;
  const imageVisualProps = {
    wishId: item.id,
    processedSrc: item.processed_image_url,
    modeHint: item.image_mode,
    preference: item.image_preference,
    processingRevision: item.image_processing_revision,
  } as const;

  return (
    <article className="wl-cloud-item" style={bubbleStyle} aria-busy={busy}>
      <button
        type="button"
        className="wl-cloud-bubble"
        data-priority={priority}
        aria-label={`Відкрити мрію «${item.title}». ${priorityPresentation.label}`}
        aria-haspopup="dialog"
        aria-expanded={detailsOpen}
        aria-busy={busy}
        disabled={busy}
        onClick={onOpen}
      >
        {imageAvailable ? (
          <WishlistProductVisual
            src={item.image_url ?? ''}
            alt=""
            className="wl-cloud-bubble-media"
            {...imageVisualProps}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className="wl-cloud-bubble-placeholder" aria-hidden="true"><HeartIcon size={34} /></span>
        )}
      </button>
    </article>
  );
}
