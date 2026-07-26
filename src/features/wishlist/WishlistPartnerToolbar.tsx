import type { PartnerWishFilter } from './partnerWishFilter';
import './wishlistPartnerToolbar.css';

interface WishlistPartnerToolbarProps {
  value: PartnerWishFilter;
  counts: Record<PartnerWishFilter, number>;
  onChange: (value: PartnerWishFilter) => void;
}

const FILTERS: Array<{ value: PartnerWishFilter; label: string }> = [
  { value: 'available', label: 'Доступні' },
  { value: 'mine', label: 'Мої подарунки' },
  { value: 'all', label: 'Усі' },
];

export function WishlistPartnerToolbar({ value, counts, onChange }: WishlistPartnerToolbarProps) {
  return (
    <div className="wl-partner-toolbar" aria-label="Фільтр бажань партнера">
      <div className="wl-partner-toolbar-copy">
        <strong>Обери наступний сюрприз</strong>
        <span>Доступні бажання або подарунки, які ти вже запланував.</span>
      </div>

      <div className="wl-partner-filters" role="group" aria-label="Показати бажання">
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            className={`wl-partner-filter${value === filter.value ? ' active' : ''}`}
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
