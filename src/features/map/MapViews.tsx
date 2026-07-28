// ============================================================
// Два неґеографічні вигляди архіву місць + підсумок подорожей.
// ------------------------------------------------------------
// Карта відповідає «де це?». Хронологія — «коли ми там були?», міста —
// «де ми взагалі бували?». Останні два питання карта не бере на себе
// взагалі: на ній однаково виглядають місце, куди ходили щотижня, і те,
// де були один раз три роки тому.
//
// Обидва вигляди перевикористовують ту саму картку місця, що й карта —
// щоб тап скрізь означав одне й те саме.
// ============================================================
import { PinCards } from './MapPanels';
import { cityStats, groupPinsByMonth, travelSummary } from './mapStats';
import { formatDateUA } from '@/features/_shared/month';
import { pluralUA } from '@/lib/utils';
import { MapPinIcon } from '@/components/icons/MapIcon';
import { StarIcon } from '@/components/icons/UiIcon';
import type { MapPinRow } from '@/types';

interface ViewProps {
  pins: MapPinRow[];
  focusedId: number | null;
  onCardClick: (pin: MapPinRow) => void;
}

/** Підсумок подорожей — рядок цифр над обома списками. */
export function TravelSummaryBar({ pins }: { pins: MapPinRow[] }) {
  const s = travelSummary(pins);
  if (s.places === 0) return null;

  return (
    <div className="map-summary">
      <div className="map-sum-cell">
        <b>{s.places}</b><span>{pluralUA(s.places, ['місце', 'місця', 'місць'])}</span>
      </div>
      <div className="map-sum-cell">
        <b>{s.cities}</b><span>{pluralUA(s.cities, ['місто', 'міста', 'міст'])}</span>
      </div>
      {s.countries > 1 && (
        <div className="map-sum-cell">
          <b>{s.countries}</b><span>{pluralUA(s.countries, ['країна', 'країни', 'країн'])}</span>
        </div>
      )}
      {/* Середню показуємо, лише коли є що усереднювати: «0.0» на
          неоціненому архіві виглядав би як оцінка, а не як її відсутність. */}
      {s.avgRating !== null && (
        <div className="map-sum-cell"><b>{s.avgRating.toFixed(1)}</b><span>оцінка</span></div>
      )}
      {/* З роком: у комірці про НАЙДАВНІШУ мітку рік і є тим, що
          відповідає на питання, а «3 вересня» без року — ні. */}
      {s.firstVisit && (
        <div className="map-sum-cell map-sum-cell--wide">
          <b>{formatDateUA(s.firstVisit)}</b>
          <span>найдавніше</span>
        </div>
      )}
    </div>
  );
}

/** Хронологія: місяцями відвідання, від найновішого. */
export function MapTimeline({ pins, focusedId, onCardClick }: ViewProps) {
  const groups = groupPinsByMonth(pins);
  if (groups.length === 0) {
    return <p className="empty-state empty-state--icon">
        <MapPinIcon size={26} /> Місць ще немає — постав перше на карті
      </p>;
  }

  return (
    <div className="pin-list">
      {groups.map((group) => (
        <div key={group.key || 'undated'}>
          <div className="pin-city-header">
            <span className="pin-city-name">{group.label}</span>
            <span className="pin-city-count">{group.pins.length}</span>
          </div>
          <PinCards
            allPins={pins}
            visiblePins={group.pins}
            search=""
            focusedId={focusedId}
            onCardClick={onCardClick}
            flat
          />
        </div>
      ))}
    </div>
  );
}

/** Міста: скільки місць у кожному, яка середня й коли були востаннє. */
export function MapCities({ pins, focusedId, onCardClick }: ViewProps) {
  const stats = cityStats(pins);
  if (stats.length === 0) {
    return <p className="empty-state empty-state--icon">
        <MapPinIcon size={26} /> Міст ще немає — постав перше місце на карті
      </p>;
  }

  return (
    <div className="map-cities">
      {stats.map((city) => (
        <section key={city.city} className="map-city">
          <header className="map-city-hd">
            <b>{city.city}</b>
            <span>
              {city.pins.length} {pluralUA(city.pins.length, ['місце', 'місця', 'місць'])}
              {city.avgRating !== null && (
                <> · <StarIcon size={12} filled className="map-star" /> {city.avgRating.toFixed(1)}</>
              )}
              {city.lastVisit && <> · {formatDateUA(city.lastVisit)}</>}
            </span>
          </header>
          <PinCards
            allPins={pins}
            visiblePins={city.pins}
            search=""
            focusedId={focusedId}
            onCardClick={onCardClick}
            flat
          />
        </section>
      ))}
    </div>
  );
}
