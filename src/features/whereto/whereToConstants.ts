// ============================================================
// WhereTo — константи + денний кеш (порт OBLASTS/cache з whereto.js)
// ============================================================
import type { WhereToEvent } from '@/types';

// Повна Україна (24 області + АР Крим + міста).
export const OBLASTS = [
  'Вінницька', 'Волинська', 'Дніпропетровська', 'Донецька', 'Житомирська',
  'Закарпатська', 'Запорізька', 'Івано-Франківська', 'Київська', 'Кіровоградська',
  'Луганська', 'Львівська', 'Миколаївська', 'Одеська', 'Полтавська',
  'Рівненська', 'Сумська', 'Тернопільська', 'Харківська', 'Херсонська',
  'Хмельницька', 'Черкаська', 'Чернівецька', 'Чернігівська',
  'АР Крим', 'м. Київ', 'м. Севастополь',
] as const;

const CACHE_PREFIX = 'amore:whereto:';

export function wtDateStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const cacheKey = (city: string) => `${CACHE_PREFIX}${wtDateStr(0)}:${city}`;

/** Кеш дня: щоб «Пошук подій» не палив (платний) веб-пошук повторно. */
export function readWhereToCache(city: string): WhereToEvent[] | null {
  try {
    const raw = localStorage.getItem(cacheKey(city));
    if (!raw) return null;
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) && arr.length ? (arr as WhereToEvent[]) : null;
  } catch {
    return null;
  }
}

export function writeWhereToCache(city: string, events: WhereToEvent[]): void {
  try {
    // Прибираємо вчорашні ключі, щоб не смітити.
    const key = cacheKey(city);
    Object.keys(localStorage)
      .filter((k) => k.startsWith(CACHE_PREFIX) && k !== key)
      .forEach((k) => localStorage.removeItem(k));
    localStorage.setItem(key, JSON.stringify(events));
  } catch {
    /* ignore */
  }
}
