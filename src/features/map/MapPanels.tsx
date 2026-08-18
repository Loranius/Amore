// ============================================================
// MapPanels — панель фільтрів + картки пінів (порт renderCatFilterBar/renderPinCards)
// ============================================================
import { CATEGORIES, CATEGORY_ORDER, groupPinsByCity } from './mapConstants';
import { pinHasSecondText, pinPrimaryText } from './mapPinView';
import { directionsUrl } from '@/lib/mapbox';
import { formatDateUA } from '@/features/_shared/month';
import { Photo } from '@/components/ui/Photo';
import { TabBar } from '@/components/ui/TabBar';
import { CompassIcon, MapPinIcon, PinCategoryIcon } from '@/components/icons/MapIcon';
import { SearchIcon, StarIcon } from '@/components/icons/UiIcon';
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
    <TabBar<'all' | PinCategory>
      variant="scroll"
      value={active}
      onChange={onChange}
      items={[
        { value: 'all', label: 'Всі', count: pins.length },
        ...CATEGORY_ORDER.map((key) => ({
          value: key as 'all' | PinCategory,
          label: CATEGORIES[key].label,
          icon: <PinCategoryIcon cat={key} size={14} />,
          count: pins.filter((p) => p.category === key).length,
        })),
      ]}
    />
  );
}

// ── Картки пінів ─────────────────────────────────────────────
export function PinCards({
  allPins,
  visiblePins,
  search,
  focusedId,
  onCardClick,
  flat = false,
}: {
  allPins: MapPinRow[];
  visiblePins: MapPinRow[];
  search: string;
  focusedId: number | null;
  onCardClick: (pin: MapPinRow) => void;
  /** Без групування за містом — коли групує вже той, хто викликає
      (хронологія по місяцях, список міст). */
  flat?: boolean;
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
    return <p className="empty-state">Натисни «+ Місце» на карті, щоб додати перше</p>;
  }
  if (!visiblePins.length) {
    return <p className="empty-state">У цій категорії поки немає місць</p>;
  }
  if (query && !filtered.length) {
    return (
      <p className="empty-state empty-state--icon">
        <SearchIcon size={26} /> Нічого не знайдено
      </p>
    );
  }

  // Без пошуку — групуємо за містом; при пошуку — пласким списком.
  if (query || flat) {
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
            <span className="pin-city-name"><MapPinIcon size={14} /> {group.city}</span>
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

/**
 * Картка місця.
 *
 * Відкриття — це `<button>`, а не `div` з `onClick`: раніше картку не
 * можна було ні сфокусувати, ні натиснути з клавіатури, і читалка не
 * знала, що вона взагалі клікабельна.
 *
 * Кнопка лежить накладкою на всю картку, а не обгортає вміст. Обгортка
 * була б простішою, але «Маршрут» — це `<a>`, а посилання всередині
 * кнопки недійсне; винесення ж його окремим рядком під фото додавало
 * картці цілий порожній ряд. Накладка лишає розкладку компактною, а
 * посилання просто стоїть шаром вище.
 */
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
  const text = pinPrimaryText(pin);
  const visited = pin.visited_at ? formatDateUA(pin.visited_at, { year: false }) : '';

  return (
    <div className={`pin-card${focused ? ' pin-card--active' : ''}`}>
      <button
        type="button"
        className="pin-card-open"
        onClick={() => onClick(pin)}
        aria-label={`Відкрити «${pin.title}»`}
      />
      {pin.photo_url ? (
        // Картка показує кадр 96×96, а в сховищі міток лежать знімки по
        // 900 КБ у середньому — на списку з тридцяти міток це були
        // десятки мегабайтів заради нігтикових прев'ю.
        <Photo className="pin-card-photo" loading="lazy" src={pin.photo_url} cssWidth={96} alt="" />
      ) : (
        <div className="pin-card-photo-placeholder" style={{ color: cat.color }}>
          <PinCategoryIcon cat={pin.category} size={30} />
        </div>
      )}
      <div className="pin-card-body">
        <div className="pin-card-header">
          <p className="pin-card-title">{pin.title}</p>
          <span className="pin-card-cat">
            <PinCategoryIcon cat={pin.category} size={13} /> {cat.label}
          </span>
        </div>
        {(pin.rating || visited) && (
          <div className="pin-card-rating">
            {pin.rating
              ? Array.from({ length: 5 }, (_, i) => (
                  <StarIcon key={i} size={14} filled={i < pin.rating!} className="map-star" />
                ))
              : null}
            {visited && <span className="pin-card-date">{visited}</span>}
          </div>
        )}
        {text && <p className="pin-card-review">{text}</p>}
        {/* Другий текст не влазить у картку, але мовчати про нього не
            можна — саме так нотатки й ставали невидимими. */}
        {pinHasSecondText(pin) && <span className="pin-card-more">+ нотатка</span>}
        <a
          className="pin-route-btn"
          href={directionsUrl(pin.lat, pin.lng)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <CompassIcon size={14} /> Маршрут
        </a>
      </div>
    </div>
  );
}
