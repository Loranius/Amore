// ============================================================
// WishCard — dream-board картка Wishlist v3
// ============================================================
import { useEffect, useRef, useState } from 'react';
import type { WishlistItemV3 } from './wishlistRpc';
import './wishlistV3.css';

const PRIORITY_LABELS: Record<string, string> = {
  dream: 'Dream',
  high: 'Високий',
  medium: 'Середній',
  low: 'Низький',
};

const PRIORITY_ICONS: Record<string, string> = {
  dream: '♥',
  high: '✦',
  medium: '◆',
  low: '○',
};

interface WishCardProps {
  item: WishlistItemV3;
  isOwn: boolean;
  canManageReservation: boolean;
  busy: boolean;
  onPhotoClick: (src: string) => void;
  onEdit: (item: WishlistItemV3) => void;
  onDelete: (id: number) => void;
  onReserve: (id: number, reserved: boolean) => void;
  onPurchased: (item: WishlistItemV3) => void;
  onPreparing: (item: WishlistItemV3) => void;
  onFulfill: (item: WishlistItemV3) => void;
  onMove: (item: WishlistItemV3) => void;
}

export function WishCard({
  item,
  isOwn,
  canManageReservation,
  busy,
  onPhotoClick,
  onEdit,
  onDelete,
  onReserve,
  onPurchased,
  onPreparing,
  onFulfill,
  onMove,
}: WishCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const canEdit = isOwn && item.status === 'visible';
  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    setImageFailed(false);
  }, [item.image_url]);

  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) closeMenu();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
        menuButtonRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (busy) closeMenu();
  }, [busy]);

  const runMenuAction = (action: () => void) => {
    closeMenu();
    action();
  };

  const hasVisibleImage = Boolean(item.image_url) && !imageFailed;

  const reservationControls = () => {
    if (canManageReservation && item.reserved) {
      if (item.status === 'reserved') {
        return (
          <div className="wl-card-v3-lifecycle">
            <div className="wl-card-v3-stage">
              <span aria-hidden="true">♡</span>
              Заброньовано тобою
            </div>
            <div className="wl-card-v3-reservation-actions">
              <button
                type="button"
                className="wl-card-v3-primary"
                disabled={busy}
                onClick={() => onPurchased(item)}
              >
                <span aria-hidden="true">✓</span>
                Подарунок куплено
              </button>
              <button
                type="button"
                className="wl-card-v3-secondary"
                disabled={busy}
                onClick={() => onReserve(item.id, false)}
              >
                Скасувати
              </button>
            </div>
          </div>
        );
      }

      if (item.status === 'purchased') {
        return (
          <div className="wl-card-v3-lifecycle">
            <div className="wl-card-v3-stage wl-card-v3-stage--purchased">
              <span aria-hidden="true">✓</span>
              Подарунок куплено
            </div>
            <button
              type="button"
              className="wl-card-v3-primary"
              disabled={busy}
              onClick={() => onPreparing(item)}
            >
              <span aria-hidden="true">✨</span>
              Готую сюрприз
            </button>
          </div>
        );
      }

      if (item.status === 'preparing_surprise') {
        return (
          <div className="wl-card-v3-lifecycle">
            <div className="wl-card-v3-stage wl-card-v3-stage--preparing">
              <span aria-hidden="true">✨</span>
              Сюрприз готується
            </div>
            <button
              type="button"
              className="wl-card-v3-primary wl-card-v3-primary--success"
              disabled={busy}
              onClick={() => onFulfill(item)}
            >
              <span aria-hidden="true">🎁</span>
              Подарунок вручено
            </button>
          </div>
        );
      }
    }

    if (isOwn) {
      return item.reserved ? (
        <div className="wl-card-v3-status wl-card-v3-status--owner">
          <span aria-hidden="true">✦</span>
          Хтось уже готує цю мрію
        </div>
      ) : (
        <span className="wl-card-v3-hint">Твоя мрія</span>
      );
    }

    if (item.reserved) {
      return (
        <div className="wl-card-v3-status">
          <span aria-hidden="true">♡</span>
          Цю мрію вже взяли на себе
        </div>
      );
    }

    return (
      <button
        type="button"
        className="wl-card-v3-primary"
        disabled={busy}
        onClick={() => onReserve(item.id, true)}
      >
        <span aria-hidden="true">🎁</span>
        Беру на себе
      </button>
    );
  };

  return (
    <article
      className={`wl-card wl-card-v3${item.reserved ? ' wl-card-v3--reserved' : ''}`}
      aria-busy={busy}
    >
      <div className="wl-card-v3-media">
        {hasVisibleImage ? (
          <button
            type="button"
            className="wl-card-v3-photo"
            onClick={() => onPhotoClick(item.image_url!)}
            aria-label={`Відкрити фото: ${item.title}`}
          >
            <img
              src={item.image_url!}
              loading="lazy"
              alt={item.title}
              onError={() => setImageFailed(true)}
            />
          </button>
        ) : (
          <div className="wl-card-v3-placeholder" aria-label="Бажання без фото">
            <span aria-hidden="true">♡</span>
            <small>Мрія без фото</small>
          </div>
        )}

        <div className="wl-card-v3-topline">
          {item.priority && (
            <span className={`wl-priority-v3 wl-priority-v3--${item.priority}`}>
              <span aria-hidden="true">{PRIORITY_ICONS[item.priority] ?? '•'}</span>
              {PRIORITY_LABELS[item.priority] ?? item.priority}
            </span>
          )}

          {canEdit && (
            <div className="wl-card-v3-menu-wrap" ref={menuRef}>
              <button
                ref={menuButtonRef}
                type="button"
                className="wl-card-v3-menu-button"
                aria-label="Дії з мрією"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                disabled={busy}
                onClick={() => setMenuOpen((open) => !open)}
              >
                ⋯
              </button>
              {menuOpen && (
                <div className="wl-card-v3-menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => runMenuAction(() => onEdit(item))}>
                    Редагувати
                  </button>
                  <button type="button" role="menuitem" onClick={() => runMenuAction(() => onMove(item))}>
                    Перенести
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="wl-card-v3-menu-danger"
                    onClick={() => runMenuAction(() => onDelete(item.id))}
                  >
                    Видалити
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="wl-card-v3-content">
        <div className="wl-card-v3-heading">
          {item.link ? (
            <a className="wl-card-v3-title" href={item.link} target="_blank" rel="noopener noreferrer">
              {item.title}
            </a>
          ) : (
            <h2 className="wl-card-v3-title">{item.title}</h2>
          )}
          {item.price != null && (
            <span className="wl-card-v3-price">{item.price.toLocaleString('uk-UA')} ₴</span>
          )}
        </div>

        {item.description && <p className="wl-card-v3-description">{item.description}</p>}

        <div className="wl-card-v3-footer">{reservationControls()}</div>
      </div>
    </article>
  );
}
