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
//
// Момент (`memory_moments`) завжди має точний день — точність тут
// потрібна лише для окремих ФОТО (`memories`), які й досі можна прив'язати
// до плану чи цілі зі старою («колись у травні») датою.
// ============================================================
import { localDateFromISO } from '@/lib/utils';
import { MONTHS_UA, MONTHS_UA_GENITIVE } from '@/features/_shared/month';
import type { MemoryPrecision } from '@/types';

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
