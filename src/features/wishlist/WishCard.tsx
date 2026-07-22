import { useState } from 'react';
import type { WishlistItemRow } from '@/types';
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
  const canEdit = isOwn && !item.reserved;

  const runMenuAction = (action: () => void) => {
    setMenuOpen(false);
    action();
  };

  return (
    <article className={`wl-card wl-card-v3${item.reserved ? ' wl-card-v3--reserved' : ''}`}>
      <div className="wl-card-v3-media">
        {item.image_url ? (
          <button
            type="button"
            className="wl-card-v3-photo"
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
            <span className={`wl-priority-v3 wl-priority-v3--${item.priority}`}>
              <span aria-hidden="true">{PRIORITY_ICONS[item.priority] ?? '•'}</span>
              {PRIORITY_LABELS[item.priority] ?? item.priority}
            </span>
          )}

          {canEdit && (
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

        <div className="wl-card-v3-footer">
          {isOwn ? (
            item.reserved ? (
              <div className="wl-card-v3-status wl-card-v3-status--owner">
                <span aria-hidden="true">✦</span>
                Хтось уже готує цю мрію
              </div>
            ) : (
              <span className="wl-card-v3-hint">Твоя мрія</span>
            )
          ) : item.reserved ? (
            canManageReservation ? (
              <div className="wl-card-v3-reservation-actions">
                <button type="button" className="wl-card-v3-primary wl-card-v3-primary--success" onClick={() => onFulfill(item)}>
                  Подарунок вручено
                </button>
                <button type="button" className="wl-card-v3-secondary" onClick={() => onReserve(item.id, false)}>
                  Скасувати
                </button>
              </div>
            ) : (
              <div className="wl-card-v3-status">
                <span aria-hidden="true">♡</span>
                Цю мрію вже взяли на себе
              </div>
            )
          ) : (
            <button type="button" className="wl-card-v3-primary" onClick={() => onReserve(item.id, true)}>
              <span aria-hidden="true">🎁</span>
              Беру на себе
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
