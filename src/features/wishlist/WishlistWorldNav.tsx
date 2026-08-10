import { useCallback, useEffect, useRef, useState } from 'react';
import type { WishlistViewMode } from './wishlistBoardView';

// ============================================================
// Навігація вішліста у світі — уся службова частина в одному аркуші.
// ------------------------------------------------------------
// Власник сформулював результат так: у закритому стані вішліст — це чиста
// 3D-сцена, кристали бажань і нижня навігація. Заголовок, лічильники,
// вкладки, «Виконані» й фільтр ваги більше не стоять поверх кристалів
// постійно — вони живуть тут і з'являються на вимогу.
//
// Свайп по вільній області — тільки скорочення, не єдиний шлях: усе, що він
// робить, є в аркуші кнопками (§48 — жодної дії лише через жест).
// ============================================================

export type WishlistWorldTab = 'me' | 'partner' | 'shared';

export interface WishlistWorldNavProps {
  tab: WishlistWorldTab;
  onTabChange: (tab: WishlistWorldTab) => void;
  /** Підписи вкладок: «Мої», ім'я партнера в родовому, «Спільні». */
  tabLabels: Readonly<Record<WishlistWorldTab, string>>;
  tabCounts: Readonly<Record<WishlistWorldTab, number | null>>;
  /** Виконані бажання замість активних. */
  archiveOpen: boolean;
  onArchiveChange: (open: boolean) => void;
  /** Чи має ця вкладка архів узагалі. */
  archiveAvailable: boolean;
  /** Як показувати бажання: кристалами, списком або полароїдами. */
  view: WishlistViewMode;
  onViewChange: (view: WishlistViewMode) => void;
  onAdd: () => void;
  busy: boolean;
}

/**
 * Вигляди дошки.
 *
 * «Бульбашки» стали «Кристалами»: у світі це вже не кульки, а тіла. Сортування
 * за вагою мрії власник просив прибрати — воно лишається в неcвітовому вигляді
 * сторінки, де є місце для повної панелі.
 */
const VIEWS: readonly { value: WishlistViewMode; label: string }[] = [
  { value: 'bubbles', label: 'Кристали' },
  { value: 'feed', label: 'Список' },
  { value: 'polaroid', label: 'Полароїд' },
];

const TAB_ORDER: readonly WishlistWorldTab[] = ['me', 'partner', 'shared'];

/** Скільки живе підпис після свайпу. */
const HINT_MS = 1400;

/**
 * Три пластини, а не гамбургер.
 *
 * Прохання власника, і воно доречне: гамбургер означає «меню сайту», а тут
 * шари — вкладки, стани й ваги, крізь які дивишся на ту саму дошку.
 */
function LayersIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3.5 3.6 7.6l8.4 4.1 8.4-4.1L12 3.5Z" />
      <path d="M3.6 12 12 16.1 20.4 12" />
      <path d="M3.6 16.4 12 20.5l8.4-4.1" />
    </svg>
  );
}

export function WishlistWorldNav({
  tab,
  onTabChange,
  tabLabels,
  tabCounts,
  archiveOpen,
  onArchiveChange,
  archiveAvailable,
  view,
  onViewChange,
  onAdd,
  busy,
}: WishlistWorldNavProps) {
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const hintTimer = useRef<number | null>(null);

  const showHint = useCallback((next: WishlistWorldTab) => {
    const count = tabCounts[next];
    const noun = count === null
      ? ''
      : ` · ${count} ${count === 1 ? 'бажання' : count < 5 ? 'бажання' : 'бажань'}`;
    setHint(`${tabLabels[next]}${noun}`);
    if (hintTimer.current !== null) window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setHint(null), HINT_MS);
  }, [tabCounts, tabLabels]);

  useEffect(() => () => {
    if (hintTimer.current !== null) window.clearTimeout(hintTimer.current);
  }, []);

  // Свайп по вільній області сцени. Слухається на вікні, а не на самій
  // сцені: полотно живе в іншому шарі DOM, і вішати на нього обробники
  // означало б тягти вішліст у шар світу.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let startX = 0;
    let startY = 0;
    let tracking = false;

    const onStart = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      // Тільки вільна область: над кнопками, аркушем і навігацією свайп
      // нічого не перемикає.
      if (target?.closest('.wl-world-nav, .bottom-nav, .modal-overlay, .wl-cloud-sheet-overlay')) return;
      tracking = true;
      startX = event.clientX;
      startY = event.clientY;
    };

    const onEnd = (event: PointerEvent) => {
      if (!tracking) return;
      tracking = false;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      // Горизонтальний і достатній: інакше це обертання кристала або скрол.
      if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      const index = TAB_ORDER.indexOf(tab);
      const next = TAB_ORDER[Math.min(TAB_ORDER.length - 1, Math.max(0, index + (dx < 0 ? 1 : -1)))];
      if (next === undefined || next === tab) return;
      onTabChange(next);
      showHint(next);
    };

    window.addEventListener('pointerdown', onStart, { passive: true });
    window.addEventListener('pointerup', onEnd, { passive: true });
    window.addEventListener('pointercancel', () => { tracking = false; }, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', onStart);
      window.removeEventListener('pointerup', onEnd);
    };
  }, [tab, onTabChange, showHint]);

  return (
    <div className="wl-world-nav">
      {hint !== null && (
        <p className="wl-world-hint" role="status" aria-live="polite">{hint}</p>
      )}

      <button
        type="button"
        className="wl-world-nav-toggle"
        aria-expanded={open}
        aria-label="Налаштування вішліста"
        onClick={() => setOpen((current) => !current)}
      >
        <LayersIcon />
      </button>

      {open && (
        <>
          <div
            className="wl-world-scrim"
            role="presentation"
            onClick={() => setOpen(false)}
          />
          <div
            className="wl-world-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Налаштування вішліста"
          >
            <div className="wl-world-sheet-handle" aria-hidden="true" />

            <div className="wl-world-group" role="group" aria-label="Стан бажань">
              <button
                type="button"
                className="wl-world-chip"
                aria-pressed={!archiveOpen}
                onClick={() => onArchiveChange(false)}
              >
                Активні
              </button>
              <button
                type="button"
                className="wl-world-chip"
                aria-pressed={archiveOpen}
                disabled={!archiveAvailable}
                onClick={() => onArchiveChange(true)}
              >
                Виконані
              </button>
            </div>

            <div className="wl-world-group" role="group" aria-label="Вигляд бажань">
              {VIEWS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className="wl-world-chip"
                  aria-pressed={item.value === view}
                  onClick={() => onViewChange(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="wl-world-add"
              disabled={busy}
              onClick={() => { setOpen(false); onAdd(); }}
            >
              + Додати бажання
            </button>
          </div>
        </>
      )}
    </div>
  );
}
