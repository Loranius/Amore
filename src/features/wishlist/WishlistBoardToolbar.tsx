import { useId, useState } from 'react';
import type {
  WishlistBoardViewState,
  WishlistPriorityFilter,
  WishlistViewMode,
} from './wishlistBoardView';
import './wishlistBoardToolbar.css';
import './wishlistMobilePolish.css';
import { WISH_ALL_ICON, WISH_PRIORITY_ICON, WISH_VIEW_ICON, type WishIconComponent } from '@/components/icons/WishIcon';
import { CheckIcon } from '@/components/icons/UiIcon';

interface WishlistBoardToolbarProps {
  value: WishlistBoardViewState;
  counts: Record<WishlistPriorityFilter, number>;
  resultCount: number;
  onChange: (value: WishlistBoardViewState) => void;
}

const PRIORITY_FILTERS: Array<{
  value: WishlistPriorityFilter;
  label: string;
  Icon: WishIconComponent;
}> = [
  // «Усі» мало той самий ✦, що й «Жадане» — два сусідні чипи одного
  // ряду з однаковою позначкою.
  { value: 'all', label: 'Усі', Icon: WISH_ALL_ICON },
  { value: 'high', label: 'Жадане', Icon: WISH_PRIORITY_ICON.high },
  { value: 'medium', label: 'Бажане', Icon: WISH_PRIORITY_ICON.medium },
  { value: 'low', label: 'Приємне', Icon: WISH_PRIORITY_ICON.low },
];

const VIEW_MODES: Array<{
  value: WishlistViewMode;
  label: string;
  description: string;
  Icon: WishIconComponent;
}> = [
  { value: 'bubbles', label: 'Бульбашки', description: 'Жива хмара мрій', Icon: WISH_VIEW_ICON.bubbles },
  { value: 'grid', label: 'Список', description: 'Фото, назва й ціна', Icon: WISH_VIEW_ICON.grid },
];

const DEFAULT_PRIORITY_FILTER = PRIORITY_FILTERS[0]!;

export function WishlistBoardToolbar({
  value,
  counts,
  resultCount,
  onChange,
}: WishlistBoardToolbarProps) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const selected = PRIORITY_FILTERS.find((filter) => filter.value === value.priority)
    ?? DEFAULT_PRIORITY_FILTER;
  const selectedView = VIEW_MODES.find((mode) => mode.value === value.view) ?? VIEW_MODES[0]!;

  const selectPriority = (priority: WishlistPriorityFilter) => {
    onChange({ ...value, priority });
  };

  const selectView = (view: WishlistViewMode) => {
    onChange({ ...value, view });
  };

  return (
    <div className={`wl-board-toolbar${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="wl-board-toolbar-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Налаштування бажань. Вага: ${selected.label}. Вигляд: ${selectedView.label}. Показано: ${resultCount}`}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="wl-board-toolbar-summary">
          <span className="wl-board-toolbar-summary-icon" aria-hidden="true"><selected.Icon size={20} /></span>
          <span className="wl-board-toolbar-summary-copy">
            <small>Вага мрії</small>
            <strong>{selected.label}</strong>
          </span>
        </span>
        <span className="wl-board-toolbar-meta" role="status" aria-live="polite">
          <span>{selectedView.label}</span>
          <strong>{resultCount}</strong>
        </span>
        <svg className="wl-board-toolbar-chevron" viewBox="0 0 20 20" aria-hidden="true" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
          <path d="m5.5 7.5 4.5 4.5 4.5-4.5" />
        </svg>
      </button>

      {open && (
        <div id={panelId} className="wl-board-toolbar-panel">
          <section className="wl-board-toolbar-section" aria-labelledby={`${panelId}-priority-title`}>
            <div className="wl-board-toolbar-section-heading">
              <span id={`${panelId}-priority-title`}>Пріоритет</span>
              <small>Що показувати</small>
            </div>
            <div className="wl-board-filter-grid" role="group" aria-label="Фільтр за вагою мрії">
              {PRIORITY_FILTERS.map((filter) => {
                const active = value.priority === filter.value;
                const count = counts[filter.value];
                return (
                  <button
                    key={filter.value}
                    type="button"
                    className={`wl-board-filter${active ? ' active' : ''}`}
                    data-priority={filter.value}
                    aria-pressed={active}
                    aria-label={`${filter.label}: ${count}`}
                    onClick={() => selectPriority(filter.value)}
                  >
                    <span className="wl-board-filter-icon" aria-hidden="true"><filter.Icon size={18} /></span>
                    <span className="wl-board-filter-label">{filter.label}</span>
                    <small className="wl-board-filter-count">{count}</small>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="wl-board-toolbar-section wl-board-toolbar-section--view" aria-labelledby={`${panelId}-view-title`}>
            <div className="wl-board-toolbar-section-heading">
              <span id={`${panelId}-view-title`}>Вигляд бажань</span>
              <small>Як розмістити мрії</small>
            </div>
            <div className="wl-board-view-grid" role="group" aria-label="Вигляд бажань">
              {VIEW_MODES.map((mode) => {
                const active = value.view === mode.value;
                return (
                  <button
                    key={mode.value}
                    type="button"
                    className={`wl-board-view-option${active ? ' active' : ''}`}
                    data-view={mode.value}
                    aria-pressed={active}
                    onClick={() => selectView(mode.value)}
                  >
                    <span className="wl-board-view-icon" aria-hidden="true"><mode.Icon size={20} /></span>
                    <span className="wl-board-view-copy">
                      <strong>{mode.label}</strong>
                      <small>{mode.description}</small>
                    </span>
                    <span className="wl-board-view-check" aria-hidden="true"><CheckIcon size={14} /></span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
