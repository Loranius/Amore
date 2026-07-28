// ============================================================
// Map — константи (порт CATEGORIES / USER_LOCATION_STYLES)
// ============================================================
import type { PinCategory, MapPinRow } from '@/types';

// Значки живуть у components/icons/MapIcon: маркер mapbox — вузол DOM,
// тож той самий шлях потрібен і React-компоненту, і імперативному коду.
export const CATEGORIES: Record<PinCategory, { label: string; color: string }> = {
  visited: { label: 'Були', color: '#E8829C' },
  restaurant: { label: 'Ресторан', color: '#FF6B9D' },
  favorite: { label: 'Улюблене', color: '#F6B9CC' },
};

export const CATEGORY_ORDER: PinCategory[] = ['visited', 'restaurant', 'favorite'];

// Перший user за алфавітом, потім другий. Обидва — серце; людей
// розрізняє колір, а не форма, тож форма лишається однією.
export const USER_LOCATION_STYLES = [
  { color: '#4A90D9', label: 'Дімусік' },
  { color: '#E8829C', label: 'Лєнусік' },
] as const;

export const DEFAULT_CENTER: [number, number] = [30.5234, 50.4501]; // Київ

/**
 * Стиль карти під тему застосунку.
 *
 * До цього стиль був жорстко світлий, тож у темній темі карта лишалась
 * білим прямокутником посеред темної сторінки — єдина річ на екрані, що
 * світила в обличчя.
 */
export const MAP_STYLE = {
  light: 'mapbox://styles/mapbox/streets-v12',
  dark: 'mapbox://styles/mapbox/dark-v11',
} as const;

/**
 * Радіус злипання маркерів у пікселях.
 *
 * Приблизно півтори ширини маркера (32px): менше — і краплі все одно
 * налазять одна на одну, більше — і сусідні заклади на одній вулиці
 * зливаються там, де їх уже видно окремо.
 */
export const CLUSTER_RADIUS_PX = 46;

/**
 * Зсув краплі, щоб її ВІСТРЯ стояло на координаті, а не центр елемента.
 *
 * mapbox за замовчуванням ставить маркер центром на точку. Крапля
 * 32×32 з рамкою 2px — це коробка 36×36, повернута на -45°; її гострий
 * кут (нижній лівий у неповернутому вигляді) після повороту опиняється
 * рівно під центром, на відстані півдіагоналі: 18·√2 ≈ 25px.
 *
 * Доки мітки ставили тапом «десь тут», ці 25px нікого не турбували.
 * Приціл обіцяє точність — і зсув одразу стало видно.
 */
export const PIN_TIP_OFFSET: [number, number] = [0, -25];

export const NO_CITY_LABEL = 'Інші місця';

/** Групування пінів за містом («Інші місця» — завжди в кінці). */
export function groupPinsByCity(pins: MapPinRow[]): { city: string; pins: MapPinRow[] }[] {
  const groups = new Map<string, MapPinRow[]>();
  for (const pin of pins) {
    const key = pin.city || NO_CITY_LABEL;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(pin);
  }
  const order = [...groups.keys()].sort((a, b) => {
    if (a === NO_CITY_LABEL) return 1;
    if (b === NO_CITY_LABEL) return -1;
    return a.localeCompare(b, 'uk');
  });
  return order.map((city) => ({ city, pins: groups.get(city)! }));
}
