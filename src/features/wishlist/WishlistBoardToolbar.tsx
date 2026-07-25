import { useId, useState } from 'react';
import type {
  WishlistBoardViewState,
  WishlistPriorityFilter,
  WishlistViewMode,
} from './wishlistBoardView';
import './wishlistBoardToolbar.css';
import './wishlistMobilePolish.css';

interface WishlistBoardToolbarProps {
  value: WishlistBoardViewState;
  counts: Record<WishlistPriorityFilter, number>;
  resultCount: number;
  onChange: (value: WishlistBoardViewState) => void;
}

const PRIORITY_FILTERS: Array<{ value: WishlistPriorityFilter; label: string; icon: string }> = [
  { value: 'all', label: 'Усі', icon: '✦' },
  { value: 'high', label: 'Жадане', icon: '✦' },
  { value: 'medium', label: 'Бажане', icon: '♡' },
  { value: 'low', label: 'Приємне', icon: '❀' },
];

const VIEW_MODES: Array<{
  value: WishlistViewMode;
  label: string;
  description: string;
  icon: string;
}> = [
  {
    value: 'bubbles',
    label: 'Бульбашки',
    description: 'Жива хмара мрій',
    icon: '◯',
  },
  {
    value: 'table',
    label: 'Таблиця',
    description: 'Дві картки в ряд',
    icon: '▦',
  },
  {
    value: 'polaroid',
    label: 'Полароїд',
    description: 'Закріплені фото',
    icon: '▱',
  },
];

const DEFAULT_PRIORITY_FILTER = {
  value: 'all',
  label: 'Усі',
  icon: '✦',
} satisfies { value: WishlistPriorityFilter; label: string; icon: string };

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
  const selectedView = VIEW_MODES.find((mode) => mode.value === value.view) ?? VIEW_MODES[0];

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
          <span className="wl-board-toolbar-summary-icon" aria-hidden="true">
            {selected.icon}
          </span>
          <span className="wl-board-toolbar-summary-copy">
            <small>Вага мрії</small>
            <strong>{selected.label}</strong>
          </span>
        </span>

        <span className="wl-board-toolbar-meta" role="status" aria-live="polite">
          <span>{selectedView.label}</span>
          <strong>{resultCount}</strong>
        </span>

        <svg
          className="wl-board-toolbar-chevron"
          viewBox="0 0 20 20"
          aria-hidden="true"
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        >
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
                    <span className="wl-board-filter-icon" aria-hidden="true">{filter.icon}</span>
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
                    <span className="wl-board-view-icon" aria-hidden="true">{mode.icon}</span>
                    <span className="wl-board-view-copy">
                      <strong>{mode.label}</strong>
                      <small>{mode.description}</small>
                    </span>
                    <span className="wl-board-view-check" aria-hidden="true">✓</span>
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
