// ============================================================
// WishCard — Weighted Cloud bubble + shared details trigger host
// ============================================================
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import type { WishCardContext } from './wishCardPresentation';
import {
  normalizeWishlistCloudPriority,
  wishlistCloudPlacement,
  wishlistCloudPriorityPresentation,
} from './wishlistCloudLayout';
import { WishDetailsSheet } from './WishDetailsSheet';
import { WishlistProductVisual } from './WishlistProductVisual';
import type { WishlistItemV3 } from './wishlistRpc';
import './wishlistCloud.css';

export interface WishCardTriggerRenderProps {
  detailsOpen: boolean;
  openDetails: () => void;
}

export interface WishCardProps {
  item: WishlistItemV3;
  context?: WishCardContext;
  isOwn: boolean;
  canManageReservation: boolean;
  busy: boolean;
  onPhotoClick: (src: string) => void;
  onEdit: (item: WishlistItemV3) => void;
  onDelete: (id: number) => void;
  onReserve: (id: number, reserved: boolean) => void;
  onPurchased: (item: WishlistItemV3) => void;
  onFulfill: (item: WishlistItemV3) => void;
  onMove: (item: WishlistItemV3) => void;
  renderTrigger?: (props: WishCardTriggerRenderProps) => ReactNode;
}

export function WishCard({
  item,
  context,
  isOwn,
  canManageReservation,
  busy,
  onPhotoClick,
  onEdit,
  onDelete,
  onReserve,
  onPurchased,
  onFulfill,
  onMove,
  renderTrigger,
}: WishCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const priority = normalizeWishlistCloudPriority(item.priority);
  const priorityPresentation = wishlistCloudPriorityPresentation(item.priority);
  const placement = useMemo(
    () => wishlistCloudPlacement(item.id, item.id % 19),
    [item.id],
  );
  const openDetails = useCallback(() => setDetailsOpen(true), []);
  const closeDetails = useCallback(() => setDetailsOpen(false), []);

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

  const trigger = renderTrigger
    ? renderTrigger({ detailsOpen, openDetails })
    : (
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
            onClick={openDetails}
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
              <span className="wl-cloud-bubble-placeholder" aria-hidden="true">♡</span>
            )}
          </button>
        </article>
      );

  return (
    <>
      {trigger}
      <WishDetailsSheet
        open={detailsOpen}
        item={item}
        context={context}
        isOwn={isOwn}
        canManageReservation={canManageReservation}
        busy={busy}
        onClose={closeDetails}
        onPhotoClick={onPhotoClick}
        onEdit={onEdit}
        onDelete={onDelete}
        onReserve={onReserve}
        onPurchased={onPurchased}
        onFulfill={onFulfill}
        onMove={onMove}
      />
    </>
  );
}
