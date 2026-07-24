// ============================================================
// WishCard — editorial dream-board card
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { useUsersMap } from '@/features/_shared/useUsers';
import { ProgressivePhoto } from './ProgressivePhoto';
import {
  wishCardStatusChip,
  type WishCardContext,
} from './wishCardPresentation';
import type { WishlistItemV3 } from './wishlistRpc';
import './wishlistV3.css';
import './wishlistCardRedesign.css';

const PRIORITY_LABELS: Record<string, string> = {
  high: 'Дуже хочу',
  medium: 'Хочу',
  low: 'Колись',
};

const PRIORITY_ICONS: Record<string, string> = {
  high: '✦',
  medium: '◆',
  low: '○',
};

interface WishCardProps {
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
}: WishCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const usersMap = useUsersMap();
  const menuRef = useRef<HTMLDivElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const hasMenuActions = item.can_edit || item.can_move || item.can_delete;
  const closeMenu = (restoreFocus = false) => {
    setMenuOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => menuButtonRef.current?.focus());
    }
  };
  const resolvedContext: WishCardContext = context
    ?? (item.completion_mode === 'shared' ? 'shared' : isOwn ? 'me' : 'partner');
  const creatorName = resolvedContext === 'shared' ? usersMap[item.owner] : null;
  const statusChip = wishCardStatusChip({
    context: resolvedContext,
    completionMode: item.completion_mode,
    status: item.status,
    reserved: item.reserved,
    canManageReservation,
  });
  const displayPriority = item.priority && String(item.priority) === 'dream'
    ? 'high'
    : item.priority;

  useEffect(() => {
    if (!menuOpen) return;

    const compactMenu = window.matchMedia('(max-width: 719px)').matches;
    if (compactMenu) document.body.classList.add('wl-card-menu-open');

    const focusTimer = window.requestAnimationFrame(() => {
      menuPanelRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    });

    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) closeMenu(true);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu(true);
        return;
      }

      if (event.key !== 'Tab' || !compactMenu || !menuPanelRef.current) return;
      const controls = Array.from(
        menuPanelRef.current.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
      );
      if (controls.length === 0) return;

      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusTimer);
      document.body.classList.remove('wl-card-menu-open');
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

  const lifecycleControls = () => {
    if (item.completion_mode === 'shared') {
      return item.can_complete ? (
        <button
          type="button"
          className="wl-card-v3-primary wl-card-v3-primary--success"
          disabled={busy}
          onClick={() => onFulfill(item)}
        >
          <span aria-hidden="true">✨</span>
          Виконати разом
        </button>
      ) : (
        <span className="wl-card-v3-hint">Спільна мрія</span>
      );
    }

    if (canManageReservation && item.reserved) {
      if (item.status === 'reserved') {
        return (
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
        );
      }

      if (item.status === 'purchased' || item.status === 'preparing_surprise') {
        return (
          <button
            type="button"
            className="wl-card-v3-primary wl-card-v3-primary--success"
            disabled={busy}
            onClick={() => onFulfill(item)}
          >
            <span aria-hidden="true">🎁</span>
            Подарунок вручено
          </button>
        );
      }
    }

    if (isOwn) {
      return (
        <span className="wl-card-v3-hint">
          {item.reserved ? 'Це бажання вже здійснюють' : 'Додано до твоїх мрій'}
        </span>
      );
    }

    if (item.reserved) {
      return <span className="wl-card-v3-hint">Це бажання вже здійснюють</span>;
    }

    if (!item.can_reserve) return <span className="wl-card-v3-hint">Бажання партнера</span>;

    return (
      <button
        type="button"
        className="wl-card-v3-primary"
        disabled={busy}
        onClick={() => onReserve(item.id, true)}
      >
        <span aria-hidden="true">🎁</span>
        Здійснити бажання
      </button>
    );
  };

  return (
    <article
      className={`wl-card wl-card-v3 wl-card-v3--${resolvedContext}${item.reserved ? ' wl-card-v3--reserved' : ''}`}
      aria-busy={busy}
    >
      <div className="wl-card-v3-media">
        {item.image_url ? (
          <ProgressivePhoto
            src={item.image_url}
            alt={item.title}
            ariaLabel={`Відкрити фото: ${item.title}`}
            buttonClassName="wl-card-v3-photo"
            revealDelayMs={(item.id % 8) * 35}
            onOpen={onPhotoClick}
            fallback={(
              <span className="wl-card-v3-placeholder" aria-label="Фото не вдалося завантажити">
                <span aria-hidden="true">♡</span>
                <small>Фото недоступне</small>
              </span>
            )}
          />
        ) : (
          <div className="wl-card-v3-placeholder" aria-label="Бажання без фото">
            <span aria-hidden="true">♡</span>
            <small>Мрія без фото</small>
          </div>
        )}

        <div className="wl-card-v3-media-shade" aria-hidden="true" />

        <div className="wl-card-v3-topline">
          {displayPriority && (
            <span className={`wl-priority-v3 wl-priority-v3--${displayPriority}`}>
              <span aria-hidden="true">{PRIORITY_ICONS[displayPriority] ?? '•'}</span>
              {PRIORITY_LABELS[displayPriority] ?? displayPriority}
            </span>
          )}

          {hasMenuActions && (
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
                <>
                  <button
                    type="button"
                    className="wl-card-v3-menu-backdrop"
                    aria-label="Закрити меню дій"
                    tabIndex={-1}
                    onClick={() => closeMenu(true)}
                  />
                  <div
                    ref={menuPanelRef}
                    className="wl-card-v3-menu"
                    role="menu"
                    aria-label={`Дії з мрією «${item.title}»`}
                  >
                    <div className="wl-card-v3-menu-mobile-head">
                      <span>Дії з мрією</span>
                      <strong>{item.title}</strong>
                      <button
                        type="button"
                        className="wl-card-v3-menu-close"
                        aria-label="Закрити"
                        onClick={() => closeMenu(true)}
                      >
                        ×
                      </button>
                    </div>
                    {item.can_edit && (
                      <button type="button" role="menuitem" onClick={() => runMenuAction(() => onEdit(item))}>
                        <span aria-hidden="true">✎</span>
                        Редагувати
                      </button>
                    )}
                    {item.can_move && (
                      <button type="button" role="menuitem" onClick={() => runMenuAction(() => onMove(item))}>
                        <span aria-hidden="true">↔</span>
                        Перенести
                      </button>
                    )}
                    {item.can_delete && (
                      <button
                        type="button"
                        role="menuitem"
                        className="wl-card-v3-menu-danger"
                        onClick={() => runMenuAction(() => onDelete(item.id))}
                      >
                        <span aria-hidden="true">⌫</span>
                        Видалити
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {statusChip && (
          <span className={`wl-card-v3-state-chip wl-card-v3-state-chip--${statusChip.tone}`}>
            <span aria-hidden="true">{statusChip.icon}</span>
            {statusChip.label}
          </span>
        )}
      </div>

      <div className="wl-card-v3-content">
        {creatorName && (
          <span className="wl-card-v3-attribution">Автор мрії — {creatorName}</span>
        )}

        <div className="wl-card-v3-heading">
          {item.link ? (
            <a className="wl-card-v3-title" href={item.link} target="_blank" rel="noopener noreferrer">
              {item.title}
              <span className="wl-card-v3-external" aria-hidden="true">↗</span>
            </a>
          ) : (
            <h2 className="wl-card-v3-title">{item.title}</h2>
          )}
          {item.price != null && (
            <span className="wl-card-v3-price">{item.price.toLocaleString('uk-UA')} ₴</span>
          )}
        </div>

        {item.description && <p className="wl-card-v3-description">{item.description}</p>}

        <div className="wl-card-v3-footer">{lifecycleControls()}</div>
      </div>
    </article>
  );
}
