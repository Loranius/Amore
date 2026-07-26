// ============================================================
// MoveWishModal — перенести вже створене бажання (Моє / партнеру /
// Спільне). Сервер має підтвердити перенесення до закриття модалки:
// при повільній мережі або помилці користувач не втрачає контекст.
// ============================================================
import { useEffect, useRef } from 'react';
import { useCurrentUser } from '@/providers/AuthProvider';
import type { AppUser, WishlistItemRow } from '@/types';

interface MoveWishModalProps {
  item: WishlistItemRow;
  partner: AppUser | null;
  saving: boolean;
  onClose: () => void;
  onMove: (owner: number, isShared: boolean) => Promise<void>;
}

export function MoveWishModal({ item, partner, saving, onClose, onMove }: MoveWishModalProps) {
  const me = useCurrentUser();
  const submitLock = useRef(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, saving]);

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

  const options = allOptions.filter((opt) => opt.possible && !isCurrent(opt));

  const move = async (owner: number, isShared: boolean) => {
    if (saving || submitLock.current) return;
    submitLock.current = true;
    try {
      await onMove(owner, isShared);
      onClose();
    } catch {
      // useMutation показує помилку. Модалка лишається відкритою для retry.
      submitLock.current = false;
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <div
        className="modal-sheet wl-move-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-wish-title"
        aria-busy={saving}
      >
        <button
          type="button"
          className="gift-memory-close"
          aria-label="Закрити"
          disabled={saving}
          onClick={onClose}
        >
          ×
        </button>
        <h2 id="move-wish-title" className="modal-title wl-move-title">
          ↔️ Перенести «{item.title}»
        </h2>
        <p className="wl-move-sub">Куди перенести:</p>
        <div className="wl-move-options">
          {options.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className="wl-move-option"
              disabled={saving}
              onClick={() => void move(opt.owner, opt.isShared)}
            >
              <span className="wl-move-option-icon" aria-hidden="true">{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
        <p className="sr-only" role="status" aria-live="polite">
          {saving ? 'Переносимо бажання…' : ''}
        </p>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" disabled={saving} onClick={onClose}>
            Скасувати
          </button>
        </div>
      </div>
    </div>
  );
}
