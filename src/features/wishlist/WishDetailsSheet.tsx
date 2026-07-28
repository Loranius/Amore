import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useUsersMap } from '@/features/_shared/useUsers';
import {
  wishCardStatusChip,
  type WishCardContext,
} from './wishCardPresentation';
import {
  resolveWishDetailsContext,
  wishlistProductHost,
} from './wishDetailsPresentation';
import {
  normalizeWishlistCloudPriority,
  wishlistCloudPriorityPresentation,
} from './wishlistCloudLayout';
import { WishlistProductVisual } from './WishlistProductVisual';
import type { WishlistItemV3 } from './wishlistRpc';
import './wishlistCloud.css';
import './wishlistCloudModalFix.css';
import { SparkIcon } from '@/components/icons/EventIcon';
import { BagIcon, CheckIcon, ExternalLinkIcon, GiftIcon, PencilIcon, TrashIcon } from '@/components/icons/UiIcon';
import { HeartIcon } from '@/components/icons/NavIcon';

export interface WishDetailsSheetProps {
  open: boolean;
  item: WishlistItemV3;
  context?: WishCardContext | undefined;
  isOwn: boolean;
  canManageReservation: boolean;
  busy: boolean;
  onClose: () => void;
  onPhotoClick: (src: string) => void;
  onEdit: (item: WishlistItemV3) => void;
  onDelete: (id: number) => void;
  onReserve: (id: number, reserved: boolean) => void;
  onPurchased: (item: WishlistItemV3) => void;
  onFulfill: (item: WishlistItemV3) => void;
  onMove: (item: WishlistItemV3) => void;
}

export function WishDetailsSheet({
  open,
  item,
  context,
  isOwn,
  canManageReservation,
  busy,
  onClose,
  onPhotoClick,
  onEdit,
  onDelete,
  onReserve,
  onPurchased,
  onFulfill,
  onMove,
}: WishDetailsSheetProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const usersMap = useUsersMap();
  const resolvedContext = resolveWishDetailsContext(item, isOwn, context);
  const creatorName = resolvedContext === 'shared' ? usersMap[item.owner] : null;
  const priority = normalizeWishlistCloudPriority(item.priority);
  const priorityPresentation = wishlistCloudPriorityPresentation(item.priority);
  const statusChip = wishCardStatusChip({
    context: resolvedContext,
    completionMode: item.completion_mode,
    status: item.status,
    reserved: item.reserved,
    canManageReservation,
  });
  const dialogTitleId = `wl-cloud-sheet-title-${item.id}`;
  const imageAvailable = Boolean(item.image_url) && !imageFailed;
  const imageVisualProps = {
    wishId: item.id,
    processedSrc: item.processed_image_url,
    modeHint: item.image_mode,
    preference: item.image_preference,
    processingRevision: item.image_processing_revision,
  } as const;

  useEffect(() => {
    setImageFailed(false);
  }, [item.image_url]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const previousOverscrollBehavior = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.body.classList.add('wl-cloud-sheet-open');

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscrollBehavior;
      document.body.classList.remove('wl-cloud-sheet-open');
    };
  }, [onClose, open]);

  const closeAndRun = (action: () => void) => {
    onClose();
    action();
  };

  const lifecycleControls = (): ReactNode => {
    if (item.completion_mode === 'shared') {
      return item.can_complete ? (
        <button
          type="button"
          className="wl-cloud-sheet-primary wl-cloud-sheet-primary--success"
          disabled={busy}
          onClick={() => closeAndRun(() => onFulfill(item))}
        >
          <SparkIcon size={15} />
          Виконати разом
        </button>
      ) : (
        <span className="wl-cloud-sheet-hint">Спільна мрія для вас обох</span>
      );
    }

    if (canManageReservation && item.reserved) {
      if (item.status === 'reserved') {
        return (
          <div className="wl-cloud-sheet-reservation-actions">
            <button
              type="button"
              className="wl-cloud-sheet-primary"
              disabled={busy}
              onClick={() => closeAndRun(() => onPurchased(item))}
            >
              <CheckIcon size={15} />
              Подарунок куплено
            </button>
            <button
              type="button"
              className="wl-cloud-sheet-secondary"
              disabled={busy}
              onClick={() => closeAndRun(() => onReserve(item.id, false))}
            >
              Скасувати
            </button>
          </div>
        );
      }

      if (item.status === 'purchased' || item.status === 'preparing_surprise') {
        return (
          <button
            type="button"
            className="wl-cloud-sheet-primary wl-cloud-sheet-primary--success"
            disabled={busy}
            onClick={() => closeAndRun(() => onFulfill(item))}
          >
            <GiftIcon size={15} />
            Подарунок вручено
          </button>
        );
      }
    }

    if (isOwn) {
      return (
        <span className="wl-cloud-sheet-hint">
          {item.reserved ? 'Цю мрію вже готуються здійснити' : 'Додано до твоєї хмари мрій'}
        </span>
      );
    }

    if (item.reserved) {
      return <span className="wl-cloud-sheet-hint">Цю мрію вже готуються здійснити</span>;
    }

    if (!item.can_reserve) {
      return <span className="wl-cloud-sheet-hint">Мрія партнера</span>;
    }

    return (
      <button
        type="button"
        className="wl-cloud-sheet-primary"
        disabled={busy}
        onClick={() => closeAndRun(() => onReserve(item.id, true))}
      >
        <GiftIcon size={15} />
        Здійснити бажання
      </button>
    );
  };

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="wl-cloud-sheet-overlay"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="wl-cloud-sheet"
        data-priority={priority}
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="wl-cloud-sheet-handle" aria-hidden="true" />
        <button
          type="button"
          className="wl-cloud-sheet-close"
          aria-label="Закрити деталі мрії"
          onClick={onClose}
          autoFocus
        >
          ×
        </button>

        <div className="wl-cloud-sheet-content">
          <div className="wl-cloud-sheet-top">
            <div className="wl-cloud-sheet-hero">
              {imageAvailable ? (
                <button
                  type="button"
                  className="wl-cloud-sheet-photo"
                  aria-label={`Відкрити фото: ${item.title}`}
                  onClick={() => closeAndRun(() => onPhotoClick(item.image_url ?? ''))}
                >
                  <WishlistProductVisual
                    src={item.image_url ?? ''}
                    alt={item.title}
                    className="wl-cloud-sheet-photo-visual"
                    loading="eager"
                    {...imageVisualProps}
                    onError={() => setImageFailed(true)}
                  />
                </button>
              ) : (
                <div className="wl-cloud-sheet-photo" aria-label="Мрія без фото">
                  <span className="wl-cloud-sheet-photo-placeholder" aria-hidden="true"><HeartIcon size={34} /></span>
                </div>
              )}
            </div>

            <div className="wl-cloud-sheet-summary">
              <div className="wl-cloud-sheet-meta">
                <span className="wl-cloud-sheet-priority">
                  <priorityPresentation.Icon size={13} />
                  {priorityPresentation.label}
                </span>
                {statusChip && (
                  <span className="wl-cloud-sheet-state" data-tone={statusChip.tone}>
                    <statusChip.Icon size={13} />
                    {statusChip.label}
                  </span>
                )}
              </div>

              {creatorName && (
                <p className="wl-cloud-sheet-attribution">Автор мрії — {creatorName}</p>
              )}

              <h2 id={dialogTitleId} className="wl-cloud-sheet-title">{item.title}</h2>

              {item.price != null && (
                <span className="wl-cloud-sheet-price">
                  {item.price.toLocaleString('uk-UA')} ₴
                </span>
              )}

              {item.description && (
                <p className="wl-cloud-sheet-description">{item.description}</p>
              )}
            </div>
          </div>

          {item.link && (
            <a
              className="wl-cloud-sheet-link"
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLinkIcon size={15} />
              <span>{wishlistProductHost(item.link)}</span>
              <span aria-hidden="true">›</span>
            </a>
          )}

          <div className="wl-cloud-sheet-lifecycle">{lifecycleControls()}</div>

          <div className="wl-cloud-sheet-actions">
            {item.can_edit && (
              <button
                type="button"
                className="wl-cloud-sheet-action"
                disabled={busy}
                onClick={() => closeAndRun(() => onEdit(item))}
              >
                <PencilIcon size={15} />
                Редагувати
              </button>
            )}

            {item.can_move && (
              <button
                type="button"
                className="wl-cloud-sheet-action"
                disabled={busy}
                onClick={() => closeAndRun(() => onMove(item))}
              >
                <span aria-hidden="true">↔</span>
                Перенести
              </button>
            )}

            {item.can_delete && (
              <button
                type="button"
                className="wl-cloud-sheet-action wl-cloud-sheet-action--danger"
                disabled={busy}
                onClick={() => closeAndRun(() => onDelete(item.id))}
              >
                <TrashIcon size={15} />
                Видалити
              </button>
            )}

            {item.link && (
              <a
                className="wl-cloud-sheet-action"
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
              >
                <BagIcon size={15} />
                Купити
              </a>
            )}
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}
