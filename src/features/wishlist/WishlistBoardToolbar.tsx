import type {
  WishlistBoardViewState,
  WishlistPriorityFilter,
  WishlistSort,
} from './wishlistBoardView';
import './wishlistBoardToolbar.css';

interface WishlistBoardToolbarProps {
  value: WishlistBoardViewState;
  counts: Record<WishlistPriorityFilter, number>;
  resultCount: number;
  onChange: (value: WishlistBoardViewState) => void;
}

const PRIORITY_FILTERS: Array<{ value: WishlistPriorityFilter; label: string; icon: string }> = [
  { value: 'all', label: 'Усі', icon: '✦' },
  { value: 'dream', label: 'Dream', icon: '♥' },
  { value: 'high', label: 'Високий', icon: '◆' },
  { value: 'withoutPhoto', label: 'Без фото', icon: '○' },
];

const SORT_OPTIONS: Array<{ value: WishlistSort; label: string }> = [
  { value: 'newest', label: 'Нові спочатку' },
  { value: 'priority', label: 'За пріоритетом' },
  { value: 'price', label: 'За ціною' },
];

export function WishlistBoardToolbar({
  value,
  counts,
  resultCount,
  onChange,
}: WishlistBoardToolbarProps) {
  return (
    <div className="wl-board-toolbar">
      <div className="wl-board-filter-scroll" role="group" aria-label="Фільтр бажань за пріоритетом">
        {PRIORITY_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            className={`wl-board-filter${value.priority === filter.value ? ' active' : ''}`}
            aria-pressed={value.priority === filter.value}
            onClick={() => onChange({ ...value, priority: filter.value })}
          >
            <span aria-hidden="true">{filter.icon}</span>
            {filter.label}
            <small>{counts[filter.value]}</small>
          </button>
        ))}
      </div>

      <div className="wl-board-sort-wrap">
        <label htmlFor="wishlist-board-sort">Сортування</label>
        <select
          id="wishlist-board-sort"
          className="wl-board-sort"
          value={value.sort}
          onChange={(event) => onChange({ ...value, sort: event.target.value as WishlistSort })}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <span className="wl-board-result-count" aria-live="polite">
          {resultCount}
        </span>
      </div>
    </div>
  );
}
