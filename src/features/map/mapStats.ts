// ============================================================
// Підсумок подорожей і два неґеографічні порядки для міток.
// ------------------------------------------------------------
// Карта відповідає на «де це?». Але в архіву місць є ще два питання, на
// які карта не відповідає взагалі: «коли ми там були?» і «де ми взагалі
// бували?». Звідси хронологія й міста — і звідси ж потреба в чистих
// функціях, які можна перевірити без mapbox.
// ============================================================
import { MONTHS_UA } from '@/features/_shared/month';
import { NO_CITY_LABEL } from './mapConstants';
import type { MapPinRow } from '@/types';

export interface TravelSummary {
  places: number;
  cities: number;
  countries: number;
  /** Середня оцінка серед оцінених, округлена до десятої. */
  avgRating: number | null;
  rated: number;
  firstVisit: string | null;
  lastVisit: string | null;
}

/**
 * Підсумок за всіма мітками.
 *
 * Середня рахується ЛИШЕ по оцінених: підставляти нуль тим, кого не
 * оцінювали, означало б занижувати середню тим сильніше, чим менше
 * оцінок поставили — а це рівно навпаки до того, що людина очікує.
 */
export function travelSummary(pins: readonly MapPinRow[]): TravelSummary {
  const cities = new Set<string>();
  const countries = new Set<string>();
  let ratingSum = 0;
  let rated = 0;
  let first: string | null = null;
  let last: string | null = null;

  for (const pin of pins) {
    if (pin.city) cities.add(pin.city);
    if (pin.country) countries.add(pin.country);
    if (pin.rating) {
      ratingSum += pin.rating;
      rated += 1;
    }
    const visited = pin.visited_at;
    if (visited) {
      if (first === null || visited < first) first = visited;
      if (last === null || visited > last) last = visited;
    }
  }

  return {
    places: pins.length,
    cities: cities.size,
    countries: countries.size,
    avgRating: rated > 0 ? Math.round((ratingSum / rated) * 10) / 10 : null,
    rated,
    firstVisit: first,
    lastVisit: last,
  };
}

export interface MonthGroup {
  /** 'YYYY-MM'; порожній рядок — мітки без дати відвідання. */
  key: string;
  label: string;
  pins: MapPinRow[];
}

/**
 * Мітки по місяцях відвідання, від найновішого.
 *
 * Групуємо місяцями, а не днями: за один день пара ставить одну-дві
 * мітки, і список із заголовком над кожною читався б гірше за сам
 * список. Місяць — це вже поїздка чи період.
 *
 * Мітки без дати відвідання йдуть у кінець власною групою. Підставити
 * їм дату створення було б зручно й неправильно: мітку про давню
 * подорож часто ставлять через місяці.
 */
export function groupPinsByMonth(pins: readonly MapPinRow[]): MonthGroup[] {
  const byMonth = new Map<string, MapPinRow[]>();
  const undated: MapPinRow[] = [];

  for (const pin of pins) {
    const visited = pin.visited_at;
    if (!visited) {
      undated.push(pin);
      continue;
    }
    const key = visited.slice(0, 7);
    const bucket = byMonth.get(key);
    if (bucket) bucket.push(pin);
    else byMonth.set(key, [pin]);
  }

  const groups: MonthGroup[] = [...byMonth.entries()]
    .map(([key, list]) => ({
      key,
      label: monthLabel(key),
      // Усередині місяця — від найновішого; за рівних дат вирішує id,
      // щоб порядок не залежав від того, як прийшов масив.
      pins: list.sort((a, b) => {
        const byDate = (b.visited_at ?? '').localeCompare(a.visited_at ?? '');
        return byDate !== 0 ? byDate : b.id - a.id;
      }),
    }))
    .sort((a, b) => (a.key < b.key ? 1 : -1));

  return undated.length > 0
    ? [...groups, { key: '', label: 'Без дати', pins: undated }]
    : groups;
}

function monthLabel(key: string): string {
  const month = MONTHS_UA[Number(key.slice(5, 7)) - 1];
  return month ? `${month} ${key.slice(0, 4)}` : key;
}

export interface CityStat {
  city: string;
  pins: MapPinRow[];
  avgRating: number | null;
  lastVisit: string | null;
}

/**
 * Міста, від найчастіше відвідуваного.
 *
 * Сортуємо кількістю, а не абеткою: місто, де пара була двічі, і місто,
 * де вона прожила тиждень, — не рівноцінні рядки списку. За рівної
 * кількості вирішує абетка, щоб порядок був сталим.
 */
export function cityStats(pins: readonly MapPinRow[]): CityStat[] {
  const byCity = new Map<string, MapPinRow[]>();
  for (const pin of pins) {
    const key = pin.city || NO_CITY_LABEL;
    const bucket = byCity.get(key);
    if (bucket) bucket.push(pin);
    else byCity.set(key, [pin]);
  }

  return [...byCity.entries()]
    .map(([city, list]) => {
      const summary = travelSummary(list);
      return { city, pins: list, avgRating: summary.avgRating, lastVisit: summary.lastVisit };
    })
    .sort((a, b) => {
      // «Інші місця» — не місто, тож завжди останні.
      if (a.city === NO_CITY_LABEL) return 1;
      if (b.city === NO_CITY_LABEL) return -1;
      if (a.pins.length !== b.pins.length) return b.pins.length - a.pins.length;
      return a.city.localeCompare(b.city, 'uk');
    });
}
