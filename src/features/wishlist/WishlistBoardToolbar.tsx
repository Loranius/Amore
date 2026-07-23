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
  { value: 'dream', label: 'Мрія', icon: '♥' },
  { value: 'high', label: 'Дуже хочу', icon: '✦' },
  { value: 'medium', label: 'Хочу', icon: '◆' },
  { value: 'low', label: 'Колись', icon: '○' },
];

export function WishlistBoardToolbar({
  value,
  counts,
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
    </div>
  );
}
