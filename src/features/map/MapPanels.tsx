// ============================================================
// MapPanels — панель фільтрів + картки пінів (порт renderCatFilterBar/renderPinCards)
// ============================================================
import { CATEGORIES, CATEGORY_ORDER, groupPinsByCity } from './mapConstants';
import { directionsUrl } from '@/lib/mapbox';
import type { MapPinRow, PinCategory } from '@/types';

// ── Фільтр за категорією ─────────────────────────────────────
export function CatFilterBar({
  pins,
  active,
  onChange,
}: {
  pins: MapPinRow[];
  active: 'all' | PinCategory;
  onChange: (v: 'all' | PinCategory) => void;
}) {
  return (
    <div className="map-cat-filter-bar">
      <button
        type="button"
        className={`map-cat-chip${active === 'all' ? ' active' : ''}`}
        onClick={() => onChange('all')}
      >
        🗺️ Всі <span className="map-cat-chip-count">{pins.length}</span>
      </button>
      {CATEGORY_ORDER.map((key) => {
        const cat = CATEGORIES[key];
        const count = pins.filter((p) => p.category === key).length;
        return (
          <button
            key={key}
            type="button"
            className={`map-cat-chip${active === key ? ' active' : ''}`}
            onClick={() => onChange(key)}
          >
            {cat.emoji} {cat.label} <span className="map-cat-chip-count">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Картки пінів ─────────────────────────────────────────────
export function PinCards({
  allPins,
  visiblePins,
  search,
  focusedId,
  onCardClick,
}: {
  allPins: MapPinRow[];
  visiblePins: MapPinRow[];
  search: string;
  focusedId: number | null;
  onCardClick: (pin: MapPinRow) => void;
}) {
  const query = search.toLowerCase().trim();
  const filtered = query
    ? visiblePins.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          (p.review ?? '').toLowerCase().includes(query) ||
          (p.note ?? '').toLowerCase().includes(query),
      )
    : visiblePins;

  if (!allPins.length) {
    return <p className="empty-state">Натисни на карту, щоб додати місце 📍</p>;
  }
  if (!visiblePins.length) {
    return <p className="empty-state">У цій категорії поки немає місць 🔍</p>;
  }
  if (query && !filtered.length) {
    return <p className="empty-state">Нічого не знайдено 🔍</p>;
  }

  // Без пошуку — групуємо за містом; при пошуку — пласким списком.
  if (query) {
    return (
      <div className="pin-list">
        {filtered.map((pin) => (
          <PinCard key={pin.id} pin={pin} focused={pin.id === focusedId} onClick={onCardClick} />
        ))}
      </div>
    );
  }

  return (
    <div className="pin-list">
      {groupPinsByCity(filtered).map((group) => (
        <div key={group.city}>
          <div className="pin-city-header">
            <span className="pin-city-name">📍 {group.city}</span>
            <span className="pin-city-count">{group.pins.length}</span>
          </div>
          {group.pins.map((pin) => (
            <PinCard key={pin.id} pin={pin} focused={pin.id === focusedId} onClick={onCardClick} />
          ))}
        </div>
      ))}
    </div>
  );
}

function PinCard({
  pin,
  focused,
  onClick,
}: {
  pin: MapPinRow;
  focused: boolean;
  onClick: (pin: MapPinRow) => void;
}) {
  const cat = CATEGORIES[pin.category];
  return (
    <div className={`pin-card${focused ? ' pin-card--active' : ''}`} onClick={() => onClick(pin)}>
      {pin.photo_url ? (
        <img className="pin-card-photo" loading="lazy" src={pin.photo_url} alt={pin.title} />
      ) : (
        <div className="pin-card-photo-placeholder">{cat.emoji}</div>
      )}
      <div className="pin-card-body">
        <div className="pin-card-header">
          <p className="pin-card-title">{pin.title}</p>
          <span className="pin-card-cat">
            {cat.emoji} {cat.label}
          </span>
        </div>
        {pin.rating ? (
          <div className="pin-card-rating">
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} className={i < pin.rating! ? 'map-star filled' : 'map-star'}>
                ★
              </span>
            ))}
          </div>
        ) : null}
        {pin.review && <p className="pin-card-review">{pin.review}</p>}
        <a
          className="pin-route-btn"
          href={directionsUrl(pin.lat, pin.lng)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          🧭 Маршрут
        </a>
      </div>
    </div>
  );
}
