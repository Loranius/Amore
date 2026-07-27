// ============================================================
// «Спогади» — дати й точність. Чисті функції, без DOM і без запитів.
// ------------------------------------------------------------
// Старе фото рідко має точний день: буває відомий лише місяць, лише рік,
// або взагалі «десь тоді». Замість трьох гілок скрізь у застосунку тут
// одна домовленість: `memory_date` завжди зберігає ПОЧАТОК періоду
// (травень 2024 → 2024-05-01), а `precision` каже, як це прочитати.
//
// Наслідок, заради якого все й зроблено: сортування хронології однакове
// для точних і неточних спогадів — звичайне порівняння дат.
// ============================================================
import { localDateFromISO } from '@/lib/utils';
import { MONTHS_UA, MONTHS_UA_GENITIVE } from '@/features/_shared/month';
import type { MemoryPrecision, MemoryRow } from '@/types';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Дата, приведена до початку свого періоду.
 *
 * Це саме те, що перевіряє констрейнт `memories_date_matches_precision`
 * у базі: без приведення «травень 2024» міг би зберегтись як 2024-05-17 і
 * показуватись то як травень, то як 17 травня.
 */
export function normalizeMemoryDate(iso: string, precision: MemoryPrecision): string {
  const d = localDateFromISO(iso);
  const y = d.getFullYear();
  if (precision === 'day') return `${y}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (precision === 'month') return `${y}-${pad(d.getMonth() + 1)}-01`;
  return `${y}-01-01`;
}

/** Повний підпис спогаду відповідно до того, що про дату справді відомо. */
export function formatMemoryDate(iso: string, precision: MemoryPrecision): string {
  const d = localDateFromISO(iso);
  const y = d.getFullYear();
  switch (precision) {
    case 'day': return `${d.getDate()} ${MONTHS_UA_GENITIVE[d.getMonth()]} ${y}`;
    case 'month': return `${MONTHS_UA[d.getMonth()]} ${y}`;
    case 'year': return `${y} рік`;
    case 'approx': return `приблизно ${y}`;
  }
}

/** Короткий підпис для заголовка дня у стрічці: «14 липня». */
export function memoryDayLabel(iso: string, precision: MemoryPrecision = 'day'): string {
  if (precision !== 'day') return formatMemoryDate(iso, precision);
  const d = localDateFromISO(iso);
  return `${d.getDate()} ${MONTHS_UA_GENITIVE[d.getMonth()]}`;
}

export type TimeBucket = 'morning' | 'afternoon' | 'evening';

export const TIME_BUCKET_LABEL: Record<TimeBucket, string> = {
  morning: 'Ранок',
  afternoon: 'День',
  evening: 'Вечір',
};

/**
 * Частина доби за часом зйомки. `null`, коли часу немає — такі знімки
 * йдуть окремою групою, а не вигадують собі ранок.
 *
 * UTC-геттери НАВМИСНО. `taken_at` зберігає настінний час камери,
 * записаний так, ніби він UTC (див. exif.ts): «06:12» означає, що на
 * годиннику було 06:12 ТАМ, де знімали. Локальні геттери перевели б це в
 * зону глядача, і фото, зняте на світанку в Одесі, потрапляло б у «День»
 * при перегляді з іншого поясу.
 */
export function timeBucketOf(takenAt: string | null): TimeBucket | null {
  const h = wallHours(takenAt);
  if (h === null) return null;
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function wallHours(takenAt: string | null): number | null {
  if (!takenAt) return null;
  const d = new Date(takenAt);
  return Number.isNaN(d.getTime()) ? null : d.getUTCHours();
}

/** 'HH:MM' настінного часу зйомки або null. */
export function memoryTime(takenAt: string | null): string | null {
  if (!takenAt) return null;
  const d = new Date(takenAt);
  if (Number.isNaN(d.getTime())) return null;
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export interface MemoryDayGroup {
  date: string;
  precision: MemoryPrecision;
  photos: MemoryRow[];
}

/**
 * Групування в хронологію, найновіше зверху.
 *
 * Порядок усередині дня — `sort_order`, далі час зйомки, далі id. Час
 * другим, а не першим: коли власник вручну переставить знімки, його
 * порядок мусить перемагати EXIF, інакше перестановка нічого не дасть.
 */
export function groupMemoriesByDate(rows: readonly MemoryRow[]): MemoryDayGroup[] {
  const map = new Map<string, MemoryRow[]>();
  for (const row of rows) {
    const bucket = map.get(row.memory_date);
    if (bucket) bucket.push(row);
    else map.set(row.memory_date, [row]);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([date, photos]) => ({
      date,
      precision: photos[0]?.date_precision ?? 'day',
      photos: photos.sort(
        (a, b) =>
          a.sort_order - b.sort_order ||
          (a.taken_at ?? '').localeCompare(b.taken_at ?? '') ||
          a.id - b.id,
      ),
    }));
}

/** Спогади дня, розкладені по частинах доби. Порожні частини не повертаються. */
export function splitByTimeOfDay(
  photos: readonly MemoryRow[],
): Array<{ bucket: TimeBucket | null; photos: MemoryRow[] }> {
  const order: Array<TimeBucket | null> = ['morning', 'afternoon', 'evening', null];
  return order
    .map((bucket) => ({
      bucket,
      photos: photos.filter((p) => timeBucketOf(p.taken_at) === bucket),
    }))
    .filter((group) => group.photos.length > 0);
}
