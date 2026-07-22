// ============================================================
// WishCard — dream-board картка Wishlist v3
// ============================================================
import { useState } from 'react';
import type { WishlistItemRow } from '@/types';

const PRIORITY_LABELS: Record<string, string> = {
  dream: '❤️ Dream',
  high: '🔥 Високий',
  medium: '⭐ Середній',
  low: '○ Низький',
};

interface WishCardProps {
  item: WishlistItemRow;
  isOwn: boolean;
  canManageReservation: boolean;
  onPhotoClick: (src: string) => void;
  onEdit: (item: WishlistItemRow) => void;
  onDelete: (id: number) => void;
  onReserve: (id: number, reserved: boolean) => void;
  onFulfill: (item: WishlistItemRow) => void;
  onMove: (item: WishlistItemRow) => void;
}

export function WishCard({
  item,
  isOwn,
  canManageReservation,
  onPhotoClick,
  onEdit,
  onDelete,
  onReserve,
  onFulfill,
  onMove,
}: WishCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  const runMenuAction = (action: () => void) => {
    closeMenu();
    action();
  };

  return (
    <article className={`wl-card wl-card-v3${item.reserved ? ' wl-card-v3--reserved' : ''}`}>
      <div className="wl-card-v3-media">
        {item.image_url ? (
          <button
            type="button"
            className="wl-card-v3-photo-button"
            onClick={() => onPhotoClick(item.image_url!)}
            aria-label={`Відкрити фото: ${item.title}`}
          >
            <img src={item.image_url} loading="lazy" alt={item.title} />
          </button>
        ) : (
          <div className="wl-card-v3-placeholder" aria-hidden="true">♡</div>
        )}

        <div className="wl-card-v3-topline">
          {item.priority && (
            <span className={`wl-card-v3-priority wl-card-v3-priority--${item.priority}`}>
              {PRIORITY_LABELS[item.priority] ?? item.priority}
            </span>
          )}

          {isOwn && !item.reserved && (
            <div className="wl-card-v3-menu-wrap">
              <button
                type="button"
                className="wl-card-v3-menu-button"
                aria-label="Дії з мрією"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
              >
                ⋯
              </button>

              {menuOpen && (
                <div className="wl-card-v3-menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => runMenuAction(() => onEdit(item))}>
                    ✏️ Редагувати
                  </button>
                  <button type="button" role="menuitem" onClick={() => runMenuAction(() => onMove(item))}>
                    ↔️ Перенести
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="wl-card-v3-menu-danger"
                    onClick={() => runMenuAction(() => onDelete(item.id))}
                  >
                    🗑 Видалити
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {item.reserved && (
          <span className="wl-card-v3-reserved-badge" aria-label="Мрію вже взяли на себе">
            🎁
          </span>
        )}
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

        <div className="wl-card-v3-footer">
          {isOwn ? (
            item.reserved ? (
              <p className="wl-card-v3-status">Хтось уже готує цю мрію для тебе ❤️</p>
            ) : (
              <p className="wl-card-v3-hint">Мрія чекає на свій особливий момент</p>
            )
          ) : item.reserved ? (
            canManageReservation ? (
              <div className="wl-card-v3-actions wl-card-v3-actions--stacked">
                <button type="button" className="wl-card-v3-primary wl-card-v3-primary--success" onClick={() => onFulfill(item)}>
                  Подарунок уже вручено
                </button>
                <button type="button" className="wl-card-v3-link-action" onClick={() => onReserve(item.id, false)}>
                  Скасувати бронювання
                </button>
              </div>
            ) : (
              <p className="wl-card-v3-status">Цю мрію вже хтось узяв на себе ❤️</p>
            )
          ) : (
            <button type="button" className="wl-card-v3-primary" onClick={() => onReserve(item.id, true)}>
              🎁 Беру цю мрію на себе
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
