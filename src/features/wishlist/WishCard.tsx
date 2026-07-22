// ============================================================
// WishCard — картка бажання
// ------------------------------------------------------------
// Власник не бачить, хто забронював мрію. Керувати бронюванням і
// завершувати подарунок може лише користувач, який створив бронювання.
// ============================================================
import type { WishlistItemRow, WishPriority } from '@/types';

const PRIORITY_LABELS: Record<WishPriority, string> = {
  high: '🔥 Високий',
  medium: '🟡 Середній',
  low: '🟢 Низький',
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
  return (
    <div className="wl-card">
      {item.image_url && (
        <div className="wl-card-img">
          <img
            src={item.image_url}
            loading="lazy"
            alt={item.title}
            onClick={() => onPhotoClick(item.image_url!)}
          />
        </div>
      )}

      <div className="wl-card-body">
        <div className="wl-card-header">
          {item.link ? (
            <a className="wl-card-title" href={item.link} target="_blank" rel="noopener noreferrer">
              {item.title}
            </a>
          ) : (
            <span className="wl-card-title">{item.title}</span>
          )}
          {item.price != null && (
            <span className="wl-card-price">{item.price.toLocaleString('uk-UA')} ₴</span>
          )}
        </div>

        {item.priority && (
          <div className="wl-card-meta">
            <span className="wl-card-priority">{PRIORITY_LABELS[item.priority]}</span>
          </div>
        )}

        {item.description && <p className="wl-card-comment">{item.description}</p>}

        {isOwn ? (
          item.reserved ? (
            <p className="wl-reserved-note">Хтось уже працює над твоєю мрією ❤️</p>
          ) : (
            <>
              <div className="wl-card-actions">
                <button type="button" className="btn-secondary" onClick={() => onEdit(item)}>
                  ✏️ Редагувати
                </button>
                <button type="button" className="btn-secondary" onClick={() => onDelete(item.id)}>
                  🗑 Видалити
                </button>
              </div>
              <div className="wl-card-actions">
                <button type="button" className="btn-secondary wl-move-btn" onClick={() => onMove(item)}>
                  ↔️ Перенести
                </button>
              </div>
            </>
          )
        ) : item.reserved ? (
          canManageReservation ? (
            <div className="wl-card-actions wl-reserved-row">
              <button type="button" className="wl-fulfill-btn" onClick={() => onFulfill(item)}>
                ✅ Вже купив(ла)
              </button>
              <button
                type="button"
                className="wl-cancel-reserve-btn"
                onClick={() => onReserve(item.id, false)}
              >
                Скасувати бронь
              </button>
            </div>
          ) : (
            <p className="wl-reserved-note">Цю мрію вже хтось узяв на себе ❤️</p>
          )
        ) : (
          <div className="wl-card-actions">
            <button
              type="button"
              className="wl-reserve-btn"
              onClick={() => onReserve(item.id, true)}
            >
              🎁 Беру на себе
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
