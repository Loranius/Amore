// ============================================================
// Map — константи (порт CATEGORIES / USER_LOCATION_STYLES)
// ============================================================
import type { PinCategory, MapPinRow } from '@/types';

export const CATEGORIES: Record<PinCategory, { label: string; emoji: string; color: string }> = {
  visited: { label: 'Були', emoji: '📍', color: '#E8829C' },
  restaurant: { label: 'Ресторан', emoji: '🍽', color: '#FF6B9D' },
  plan: { label: 'Плануємо', emoji: '✈️', color: '#C45B79' },
  favorite: { label: 'Улюблене', emoji: '⭐', color: '#F6B9CC' },
};

export const CATEGORY_ORDER: PinCategory[] = ['visited', 'restaurant', 'plan', 'favorite'];

// Перший user за алфавітом — Діма 💙, другий — Лєна 💗.
export const USER_LOCATION_STYLES = [
  { emoji: '💙', color: '#4A90D9', label: 'Дімусік' },
  { emoji: '💗', color: '#E8829C', label: 'Лєнусік' },
] as const;

export const DEFAULT_CENTER: [number, number] = [30.5234, 50.4501]; // Київ

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
