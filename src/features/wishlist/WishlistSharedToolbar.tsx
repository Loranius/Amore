import { partnerGenitive } from './partnerLabel';
import type { SharedWishFilter } from './sharedWishFilter';
import './wishlistSharedToolbar.css';

interface WishlistSharedToolbarProps {
  value: SharedWishFilter;
  partnerName: string;
  counts: Record<SharedWishFilter, number>;
  onChange: (value: SharedWishFilter) => void;
}

export function WishlistSharedToolbar({
  value,
  partnerName,
  counts,
  onChange,
}: WishlistSharedToolbarProps) {
  const filters: Array<{ value: SharedWishFilter; label: string }> = [
    { value: 'all', label: 'Усі' },
    { value: 'mine', label: 'Мої ідеї' },
    { value: 'partner', label: `Ідеї ${partnerGenitive(partnerName)}` },
  ];

  return (
    <div className="wl-shared-toolbar" aria-label="Фільтр спільних мрій">
      <div className="wl-shared-toolbar-copy">
        <strong>Мрії, створені разом</strong>
        <span>Обидва можуть редагувати та виконувати кожну спільну мрію.</span>
      </div>

      <div className="wl-shared-filters" role="group" aria-label="Показати спільні мрії">
        {filters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            className={`wl-shared-filter${value === filter.value ? ' active' : ''}`}
            aria-pressed={value === filter.value}
            onClick={() => onChange(filter.value)}
          >
            <span>{filter.label}</span>
            <small>{counts[filter.value]}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
