import { todayISO } from '@/lib/utils';

// ============================================================
// Чернетка спогаду: що можна зберегти, а що ні.
// ------------------------------------------------------------
// Правила зберігання живуть тут, а не в компоненті, з однієї причини: у
// композера два режими — створення й редагування, — і кнопка «Зберегти»
// в них вимикається за різних умов. Написане двічі в JSX, це вже
// розходилось би при першій же правці.
// ============================================================

/**
 * Скільки вміщає нотатка спогаду.
 *
 * Було 30, і це число стояло не лише тут, а й у самій базі
 * (`memory_moments_note_len`). Тобто композер не міг стати блокнотом
 * жодною розкладкою: скільки місця під текст не дай, писати в нього все
 * одно нíчого.
 *
 * 2000 — стільки ж, скільки вже дозволено опису фото
 * (`memory_photos.description`), тож нового числа тут немає. Обмеження в
 * базі знято міграцією `20260823180000_memory_note_becomes_a_notepad`;
 * ці два числа мусять лишатись однаковими, інакше пара побачить помилку
 * бази замість підказки.
 */
export const NOTE_LIMIT = 2000;

export interface DraftState {
  title: string;
  note: string;
  memoryDate: string;
  /** Скільки фото буде в спогаді ПІСЛЯ збереження. */
  photoCount: number;
}

export type DraftIssue = 'no-photo' | 'no-date' | 'note-too-long' | null;

/**
 * Що заважає зберегти, або `null`.
 *
 * Порядок перевірок — це порядок, у якому пара їх зустріне: спершу
 * найголовніше (фото), потім дата, і лише потім довжина опису.
 *
 * **Назва не обов'язкова.** Тридцять сім спогадів, що мігрували зі старої
 * моделі, ніколи її не мали; вимагати назву означало б, що редагування
 * жодного з них не можна зберегти, поки пара щось не вигадає.
 */
export function draftIssue(draft: DraftState): DraftIssue {
  if (draft.photoCount === 0) return 'no-photo';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.memoryDate)) return 'no-date';
  if (draft.note.trim().length > NOTE_LIMIT) return 'note-too-long';
  return null;
}

export const ISSUE_HINT: Record<Exclude<DraftIssue, null>, string> = {
  'no-photo': 'Додай хоча б одне фото',
  'no-date': 'Обери дату',
  'note-too-long': `Опис — не довше ${NOTE_LIMIT} символів`,
};

/**
 * Дата спогаду за замовчуванням.
 *
 * Сьогодні — і саме тому EXIF має право її перебити мовчки: підставлене
 * значення ще ніхто не обирав. Щойно пара торкнулась календаря, дата стає
 * її рішенням, і жодні метадані більше її не міняють.
 */
export function defaultMemoryDate(): string {
  return todayISO();
}

/**
 * Чи змінилось щось порівняно зі збереженим.
 *
 * Потрібне лише для питання «спитати перед закриттям?». Фото сюди не
 * входять: доданий, але ще не залитий знімок — це завжди зміна, і
 * рахувати його окремо не треба.
 */
export function draftChanged(
  a: { title: string; note: string; memoryDate: string; placePinId: number | null },
  b: { title: string; note: string; memoryDate: string; placePinId: number | null },
): boolean {
  return (
    a.title.trim() !== b.title.trim() ||
    a.note.trim() !== b.note.trim() ||
    a.memoryDate !== b.memoryDate ||
    a.placePinId !== b.placePinId
  );
}
