import { useId, useState } from 'react';
import { ChevronDownIcon, LockIcon, PlusIcon } from '@/components/icons/UiIcon';
import type { WishlistViewMode } from './wishlistBoardView';

// ============================================================
// Навігація вішліста у світі — accordion під перемикачем власника.
// ------------------------------------------------------------
// ВАЖЛИВО: класи цього accordion навмисно НЕ використовують старі
// `.wl-world-nav-*` / `.wl-world-sheet`. У wishlistCrystalWorld.css ці
// legacy-класи досі мають fixed/absolute-рецепт колишньої нижньої панелі.
// Окремий namespace не дає старому CSS фізично витягнути accordion у кут.
// ============================================================

export type WishlistWorldTab = 'me' | 'partner' | 'shared';
export type WishlistVisibilityMode = 'visible' | 'secret';

export interface WishlistWorldNavProps {
  archiveOpen: boolean;
  onArchiveChange: (open: boolean) => void;
  archiveAvailable: boolean;
  view: WishlistViewMode;
  onViewChange: (view: WishlistViewMode) => void;
  onAdd: () => void;
  busy: boolean;
  visibility: WishlistVisibilityMode | null;
  onVisibilityChange: (visibility: WishlistVisibilityMode) => void;
  secretAvailable: boolean;
}

const VIEWS: readonly { value: WishlistViewMode; label: string }[] = [
  { value: 'bubbles', label: 'Кристали' },
  { value: 'feed', label: 'Список' },
  { value: 'polaroid', label: 'Полароїд' },
];

function FilterViewIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 6h3m4 0h9M4 12h9m4 0h3M4 18h5m4 0h7" />
      <circle cx="9" cy="6" r="1.7" />
      <circle cx="15" cy="12" r="1.7" />
      <circle cx="11" cy="18" r="1.7" />
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
  const panelId = useId();

  return (
    <>
      <div
        className="wl-top-filter-accordion"
        data-open={open ? 'true' : 'false'}
      >
        <button
          type="button"
          className="wl-top-filter-toggle"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? 'Згорнути фільтри вішліста' : 'Розгорнути фільтри вішліста'}
          onClick={() => setOpen((current) => !current)}
        >
          <span className="wl-top-filter-grip" aria-hidden="true" />
          <ChevronDownIcon size={21} />
        </button>

        {open && (
          <div
            id={panelId}
            className="wl-top-filter-sheet"
            role="region"
            aria-label="Фільтри та види вішліста"
          >
            <div className="wl-top-filter-heading">
              <span>
                <FilterViewIcon />
                <strong>Фільтри та види</strong>
              </span>
            </div>

            {visibility && secretAvailable && (
              <div
                className="wl-top-filter-group wl-top-filter-group--two"
                role="group"
                aria-label="Видимість бажань"
              >
                <button
                  type="button"
                  className="wl-top-filter-chip"
                  aria-pressed={visibility === 'visible'}
                  onClick={() => onVisibilityChange('visible')}
                >
                  Видимі
                </button>
                <button
                  type="button"
                  className="wl-top-filter-chip"
                  aria-pressed={visibility === 'secret'}
                  onClick={() => onVisibilityChange('secret')}
                >
                  <LockIcon size={15} /> Таємні
                </button>
              </div>
            )}

            <div
              className="wl-top-filter-group wl-top-filter-group--two"
              role="group"
              aria-label="Стан бажань"
            >
              <button
                type="button"
                className="wl-top-filter-chip"
                aria-pressed={!archiveOpen}
                onClick={() => onArchiveChange(false)}
              >
                Активні
              </button>
              <button
                type="button"
                className="wl-top-filter-chip"
                aria-pressed={archiveOpen}
                disabled={!archiveAvailable}
                onClick={() => onArchiveChange(true)}
              >
                Виконані
              </button>
            </div>

            <div
              className="wl-top-filter-group wl-top-filter-group--views"
              role="group"
              aria-label="Вигляд бажань"
            >
              {VIEWS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className="wl-top-filter-chip"
                  aria-pressed={item.value === view}
                  onClick={() => onViewChange(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        className="fab"
        aria-label="Додати бажання"
        disabled={busy}
        onClick={onAdd}
      >
        <PlusIcon size={26} />
      </button>
    </>
  );
}
