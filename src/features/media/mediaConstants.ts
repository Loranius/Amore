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
