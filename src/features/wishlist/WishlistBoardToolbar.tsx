import { useEffect, useId, useRef, useState } from 'react';
import type {
  WishlistBoardViewState,
  WishlistPriorityFilter,
  WishlistViewMode,
} from './wishlistBoardView';
import './wishlistBoardToolbar.css';
import './wishlistMobilePolish.css';
import './wishlistFeedPolish.css';

interface WishlistBoardToolbarProps {
  value: WishlistBoardViewState;
  counts: Record<WishlistPriorityFilter, number>;
  resultCount: number;
  onChange: (value: WishlistBoardViewState) => void;
}

type WishlistTabScope = 'me' | 'partner' | 'shared';
type StoredWishlistViews = Partial<Record<WishlistTabScope, WishlistViewMode>>;

const WISHLIST_VIEW_STORAGE_KEY = 'amore:wishlist:view-modes:v1';

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
    value: 'feed',
    label: 'Стрічка',
    description: 'Фото й деталі в ряд',
    icon: '☷',
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

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function freshPolaroidSeed(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    return value[0] ?? Date.now();
  }

  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

function normalizeStoredView(value: unknown): WishlistViewMode | null {
  if (value === 'table') return 'feed';
  return value === 'bubbles' || value === 'feed' || value === 'polaroid' ? value : null;
}

function readStoredViews(): StoredWishlistViews {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(WISHLIST_VIEW_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      me: normalizeStoredView(parsed.me) ?? undefined,
      partner: normalizeStoredView(parsed.partner) ?? undefined,
      shared: normalizeStoredView(parsed.shared) ?? undefined,
    };
  } catch {
    return {};
  }
}

function writeStoredView(scope: WishlistTabScope, view: WishlistViewMode): void {
  if (typeof window === 'undefined') return;

  try {
    const current = readStoredViews();
    window.localStorage.setItem(
      WISHLIST_VIEW_STORAGE_KEY,
      JSON.stringify({ ...current, [scope]: view }),
    );
  } catch {
    // Storage may be unavailable in private mode; the in-memory view still works.
  }
}

function activeWishlistScope(): WishlistTabScope {
  const tabs = document.querySelectorAll<HTMLButtonElement>(
    '.wl-wishlist-controls .tab-bar-btn[role="tab"]',
  );
  const activeIndex = [...tabs].findIndex((button) => button.getAttribute('aria-selected') === 'true');
  if (activeIndex === 1) return 'partner';
  if (activeIndex === 2) return 'shared';
  return 'me';
}

function wishTitle(button: HTMLButtonElement): string {
  const label = button.getAttribute('aria-label') ?? '';
  return label.match(/«(.+?)»/)?.[1] ?? label;
}

function wishMeta(button: HTMLButtonElement): string {
  const label = button.getAttribute('aria-label') ?? '';
  return label.match(/»\.\s*(.+)$/)?.[1] ?? 'Відкрити мрію';
}

function clearPolaroidVariables(item: HTMLElement): void {
  item.style.removeProperty('--wl-polaroid-rotate');
  item.style.removeProperty('--wl-polaroid-x');
  item.style.removeProperty('--wl-polaroid-y');
  item.style.removeProperty('--wl-polaroid-tape-rotate');
}

export function WishlistBoardToolbar({
  value,
  counts,
  resultCount,
  onChange,
}: WishlistBoardToolbarProps) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [polaroidSeed, setPolaroidSeed] = useState(freshPolaroidSeed);
  const hydratedScopeRef = useRef<WishlistTabScope | null>(null);
  const selected = PRIORITY_FILTERS.find((filter) => filter.value === value.priority)
    ?? DEFAULT_PRIORITY_FILTER;
  const selectedView = VIEW_MODES.find((mode) => mode.value === value.view) ?? VIEW_MODES[0]!;

  // The toolbar stays mounted while tabs change, so resolve the active tab from the
  // tab bar after every render. Each tab keeps its own view across reloads and logins.
  useEffect(() => {
    const scope = activeWishlistScope();

    if (hydratedScopeRef.current !== scope) {
      hydratedScopeRef.current = scope;
      const storedView = readStoredViews()[scope];
      if (storedView && storedView !== value.view) {
        onChange({ ...value, view: storedView });
        return;
      }
    }

    writeStoredView(scope, value.view);
  });

  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.wishlist');
    if (!root) return;

    root.dataset.wishlistView = value.view;

    const syncItems = () => {
      const board = root.querySelector<HTMLElement>('.wishlist-grid');
      if (!board) return;

      [...board.children].forEach((child, index) => {
        if (!(child instanceof HTMLElement)) return;
        const button = child.querySelector<HTMLButtonElement>('.wl-cloud-bubble');
        if (!button) return;

        const title = wishTitle(button);
        button.dataset.wishTitle = title;
        button.dataset.wishMeta = wishMeta(button);

        if (value.view === 'bubbles') {
          child.classList.add('wl-cloud-item');
          child.classList.remove('wl-board-view-item');
          clearPolaroidVariables(child);
          return;
        }

        child.classList.remove('wl-cloud-item');
        child.classList.add('wl-board-view-item');

        if (value.view !== 'polaroid') {
          clearPolaroidVariables(child);
          return;
        }

        const hash = stableHash(`${polaroidSeed}:${title}:${index}`);
        const direction = (hash & 1) === 0 ? -1 : 1;
        const horizontalOffset = direction * (10 + ((hash >>> 4) % 19));

        child.style.setProperty(
          '--wl-polaroid-rotate',
          ((hash >>> 1) & 1) === 0 ? '-4deg' : '4deg',
        );
        child.style.setProperty('--wl-polaroid-x', `${horizontalOffset}px`);
        child.style.setProperty('--wl-polaroid-y', `${((hash >>> 9) % 17) - 8}px`);
        child.style.setProperty('--wl-polaroid-tape-rotate', `${((hash >>> 14) % 7) - 3}deg`);
      });
    };

    syncItems();

    // Bubble physics discovers items through child-list changes. A temporary
    // marker refreshes its body map after returning from feed or polaroid mode.
    if (value.view === 'bubbles') {
      const board = root.querySelector<HTMLElement>('.wishlist-grid');
      const marker = document.createComment('wishlist-view-sync');
      board?.append(marker);
      marker.remove();
    }

    const observer = new MutationObserver(syncItems);
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-label'],
    });

    return () => {
      observer.disconnect();
      root.removeAttribute('data-wishlist-view');
      root.querySelectorAll<HTMLElement>('.wl-board-view-item').forEach((item) => {
        item.classList.remove('wl-board-view-item');
        item.classList.add('wl-cloud-item');
        clearPolaroidVariables(item);
      });
    };
  }, [polaroidSeed, value.view]);

  const selectPriority = (priority: WishlistPriorityFilter) => {
    onChange({ ...value, priority });
  };

  const selectView = (view: WishlistViewMode) => {
    if (view === 'polaroid') setPolaroidSeed(freshPolaroidSeed());
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
