import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  WishlistBoardViewState,
  WishlistPriorityFilter,
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
  { value: 'high', label: 'Дуже хочу', icon: '✨' },
  { value: 'medium', label: 'Хочу', icon: '◆' },
  { value: 'low', label: 'Колись', icon: '○' },
];

export function WishlistBoardToolbar({
  value,
  counts,
  resultCount,
  onChange,
}: WishlistBoardToolbarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Partial<Record<WishlistPriorityFilter, HTMLButtonElement>>>({});
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollHints = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;

    const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);
    setCanScrollLeft(container.scrollLeft > 4);
    setCanScrollRight(container.scrollLeft < maxScrollLeft - 4);
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const frame = window.requestAnimationFrame(updateScrollHints);
    const onResize = () => updateScrollHints();
    let resizeObserver: ResizeObserver | null = null;

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => updateScrollHints());
      resizeObserver.observe(container);
    } else {
      window.addEventListener('resize', onResize);
    }

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [updateScrollHints]);

  useEffect(() => {
    const container = scrollRef.current;
    const activeButton = buttonRefs.current[value.priority];
    if (!container || !activeButton) return;

    const frame = window.requestAnimationFrame(() => {
      const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);
      const centeredLeft = activeButton.offsetLeft - (container.clientWidth - activeButton.offsetWidth) / 2;
      const nextLeft = Math.max(0, Math.min(maxScrollLeft, centeredLeft));
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      container.scrollTo({
        left: nextLeft,
        behavior: reduceMotion ? 'auto' : 'smooth',
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [updateScrollHints, value.priority]);

  const viewportClassName = [
    'wl-board-filter-viewport',
    canScrollLeft ? 'has-left-overflow' : '',
    canScrollRight ? 'has-right-overflow' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className="wl-board-toolbar">
      <div className="wl-board-toolbar-head">
        <span className="wl-board-toolbar-label">Пріоритет</span>
        <span className="wl-board-toolbar-result" role="status" aria-live="polite">
          Показано: <strong>{resultCount}</strong>
        </span>
      </div>

      <div className={viewportClassName}>
        <div
          ref={scrollRef}
          className="wl-board-filter-scroll"
          role="group"
          aria-label="Фільтр бажань за пріоритетом"
          onScroll={() => updateScrollHints()}
        >
          {PRIORITY_FILTERS.map((filter) => {
            const active = value.priority === filter.value;
            const count = counts[filter.value];

            return (
              <button
                key={filter.value}
                ref={(element) => {
                  if (element) buttonRefs.current[filter.value] = element;
                  else delete buttonRefs.current[filter.value];
                }}
                type="button"
                className={`wl-board-filter${active ? ' active' : ''}`}
                data-priority={filter.value}
                aria-pressed={active}
                aria-label={`${filter.label}: ${count}`}
                onClick={() => onChange({ ...value, priority: filter.value })}
              >
                <span className="wl-board-filter-icon" aria-hidden="true">{filter.icon}</span>
                <span className="wl-board-filter-label">{filter.label}</span>
                <small className="wl-board-filter-count">{count}</small>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
