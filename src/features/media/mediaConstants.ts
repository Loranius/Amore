// ============================================================
// Media — константи статусів/типів (порт STATUS_CONFIG зі media.js)
// ============================================================
import type { MediaType, MediaStatus } from '@/types';

export const STATUS_CONFIG: Record<MediaType, Record<MediaStatus, string>> = {
  movie: { want: 'В планах', watching: 'Дивимось', done: 'Бачили', dropped: 'Кинули' },
  series: { want: 'В планах', watching: 'Дивимось', done: 'Бачили', dropped: 'Кинули' },
  book: { want: 'Планую', watching: 'Читаю', done: 'Прочитала/в', dropped: 'Кинула/в' },
};

export const STATUS_ORDER: MediaStatus[] = ['watching', 'want', 'done', 'dropped'];

export const TYPE_LABELS: Record<MediaType, string> = {
  movie: 'Фільм',
  series: 'Серіал',
  book: 'Книга',
};

export const MEDIA_TYPES: MediaType[] = ['movie', 'series', 'book'];

/**
 * Якою стає дата завершення після зміни статусу.
 *
 * Три правила, і середнє з них — те, заради чого функція взагалі чиста:
 *
 *  1. статус не `done` — дати немає. Скидання не дрібниця: адаптер читає
 *     лише `done`, тож застаріла дата на кинутому серіалі рушієві не
 *     завадила б, але колонка почала б означати «колись була done», і
 *     наступний читач повірив би підпису;
 *  2. **уже `done` і дата вже є — не чіпаємо.** Перша редакція ставила
 *     `new Date()` щоразу, коли статус лишався `done`, тобто виправлення
 *     ДРУКАРСЬКОЇ ПОМИЛКИ в назві переносило перегляд на сьогодні.
 *     `PRODUCT.md`: минуле не переписується;
 *  3. щойно стало `done` — дата це мить натискання: портал не питає в
 *     пари дати, вона позначає «переглянуто» тоді, коли переглянула.
 *
 * @param now джерело часу параметром, бо в рушії немає годинника, а тест
 *   без нього перевіряв би секунду, а не правило
 */
export function nextFinishedAt(
  status: MediaStatus,
  current: string | null,
  now: () => string,
): string | null {
  if (status !== 'done') return null;
  return current ?? now();
}
