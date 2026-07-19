// ============================================================
// MoveWishModal — перенести вже створене бажання (Моє / партнеру /
// Спільне). Той самий трипозиційний вибір, що й при створенні
// (WishFormModal), але для існуючого запису — окрема дія в WishCard.
// ============================================================
import { useCurrentUser } from '@/providers/AuthProvider';
import type { AppUser, WishlistItemRow } from '@/types';

interface MoveWishModalProps {
  item: WishlistItemRow;
  partner: AppUser | null;
  onClose: () => void;
  onMove: (owner: number, isShared: boolean) => void;
}

export function MoveWishModal({ item, partner, onClose, onMove }: MoveWishModalProps) {
  const me = useCurrentUser();

  const allOptions = [
    { key: 'me', label: 'Мені', owner: me.id, isShared: false, possible: true },
    {
      key: 'partner',
      label: `Для ${partner?.name ?? 'партнера'}`,
      owner: partner?.id ?? me.id,
      isShared: false,
      possible: !!partner,
    },
    { key: 'shared', label: '🎁 Спільне', owner: item.owner, isShared: true, possible: true },
  ] as const;

  const isCurrent = (opt: (typeof allOptions)[number]) =>
    opt.isShared === item.is_shared && (opt.isShared || opt.owner === item.owner);

  // Лише реально ДОСТУПНІ пункти призначення — без поточної категорії
  // бажання (нема сенсу «переносити» туди, де воно вже є).
  const options = allOptions.filter((opt) => opt.possible && !isCurrent(opt));

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-sheet" role="dialog" aria-modal="true">
        <h2 className="modal-title">Перенести «{item.title}»</h2>
        <div className="form-field">
          <span>Куди перенести</span>
          <div className="wl-sub-tabs wl-sub-tabs--col">
            {options.map((opt) => (
              <button
                key={opt.key}
                type="button"
                className="wl-sub-btn"
                onClick={() => {
                  onMove(opt.owner, opt.isShared);
                  onClose();
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Скасувати
          </button>
        </div>
      </div>
    </div>
  );
}
