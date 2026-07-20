// ============================================================
// MoveWishModal — перенести вже створене бажання (Моє / партнеру /
// Спільне). Той самий трипозиційний вибір, що й при створенні
// (WishFormModal), але для існуючого запису — окрема дія в WishCard,
// доступна на БУДЬ-ЯКІЙ картці (не лише «своїй»), інакше випадковий
// перенос у чужу зону — пастка без шляху назад.
// Оформлення — під стиль Pink Portal: градієнтний аркуш, великі
// виразні кнопки-варіанти замість непомітних текстових пілюль.
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
    { key: 'me', label: 'Мені', icon: '📥', owner: me.id, isShared: false, possible: true },
    {
      key: 'partner',
      label: `Для ${partner?.name ?? 'партнера'}`,
      icon: '👤',
      owner: partner?.id ?? me.id,
      isShared: false,
      possible: !!partner,
    },
    { key: 'shared', label: 'Спільне', icon: '🎁', owner: item.owner, isShared: true, possible: true },
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
      <div className="modal-sheet wl-move-sheet" role="dialog" aria-modal="true">
        <h2 className="modal-title wl-move-title">↔️ Перенести «{item.title}»</h2>
        <p className="wl-move-sub">Куди перенести:</p>
        <div className="wl-move-options">
          {options.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className="wl-move-option"
              onClick={() => {
                onMove(opt.owner, opt.isShared);
                onClose();
              }}
            >
              <span className="wl-move-option-icon">{opt.icon}</span>
              {opt.label}
            </button>
          ))}
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
