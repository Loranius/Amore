import { useState } from 'react';
import { LockIcon, PlusIcon } from '@/components/icons/UiIcon';
import type { WishlistViewMode } from './wishlistBoardView';

// ============================================================
// Навігація вішліста у світі — уся службова частина в одному аркуші.
// ------------------------------------------------------------
// Власник сформулював результат так: у закритому стані вішліст — це чиста
// 3D-сцена, кристали бажань і нижня навігація. Заголовок, лічильники,
// вкладки, «Виконані» й фільтр ваги більше не стоять поверх кристалів
// постійно — вони живуть тут і з'являються на вимогу.
//
// **Свайпу між вкладками тут більше немає, і не через смак.** Він слухав
// `pointerdown` на вікні й виключав лише навігацію та аркуші, тож тягнення
// кулі бажання проходило повз фільтр: проводиш пальцем по бажанню зліва
// направо — і замість того, щоб штовхнути кулю, портал відкриває сусідню
// вкладку. Двох власників одного горизонтального жесту на одному екрані бути
// не може, а куля — це те, з чим справді граються.
//
// Вкладки перемикаються кнопками вгорі; §48 і так вимагав, щоб жодна дія не
// існувала лише через жест, тож нічого не втрачено.
// ============================================================

export type WishlistWorldTab = 'me' | 'partner' | 'shared';
export type WishlistVisibilityMode = 'visible' | 'secret';

export interface WishlistWorldNavProps {
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
  visibility: WishlistVisibilityMode | null;
  onVisibilityChange: (visibility: WishlistVisibilityMode) => void;
  secretAvailable: boolean;
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
  archiveOpen,
  onArchiveChange,
  archiveAvailable,
  view,
  onViewChange,
  onAdd,
  busy,
  visibility,
  onVisibilityChange,
  secretAvailable,
}: WishlistWorldNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="wl-world-nav">
      <button
        type="button"
        className="wl-world-nav-toggle"
        aria-expanded={open}
        aria-label="Налаштування вішліста"
        onClick={() => setOpen((current) => !current)}
      >
        <LayersIcon />
      </button>

      {/* Додавання винесене з аркуша на коло, як у «Спогадах» (прохання
          власника). В аркуші лишились фільтри й вигляд — те, заради чого
          його відкривають; другої кнопки «додати» там більше немає, бо два
          однакові входи на одному екрані — це не вибір, а сумнів. */}
      <button
        type="button"
        className="fab"
        aria-label="Додати бажання"
        disabled={busy}
        onClick={onAdd}
      >
        <PlusIcon size={26} />
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

            {visibility && secretAvailable && (
              <div
                className="wl-world-group wl-world-visibility"
                role="group"
                aria-label="Видимість бажань"
              >
                <button
                  type="button"
                  className="wl-world-chip"
                  aria-pressed={visibility === 'visible'}
                  onClick={() => onVisibilityChange('visible')}
                >
                  Видимі
                </button>
                <button
                  type="button"
                  className="wl-world-chip"
                  aria-pressed={visibility === 'secret'}
                  onClick={() => onVisibilityChange('secret')}
                >
                  <LockIcon size={15} /> Таємні
                </button>
              </div>
            )}

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

          </div>
        </>
      )}
    </div>
  );
}
