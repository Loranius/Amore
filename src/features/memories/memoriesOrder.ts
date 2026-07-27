// ============================================================
// Ручний порядок знімків усередині дня (§8, етап 3).
// ------------------------------------------------------------
// EXIF розставляє кадри за часом зйомки, і це майже завжди правильно.
// Але «майже» — не завжди: телефон одного з пари може мати збитий
// годинник, а найкращий кадр дня хочеться бачити першим незалежно від
// того, о котрій його зняли.
//
// `sort_order` перемагає `taken_at` у `groupMemoriesByDate` — тому щойно
// власник переставив знімки, метадані більше не повертають їх на місце.
//
// Тут лише чиста частина: пересунути й порахувати, що саме змінилось.
// Без неї перевіряти порядок довелось би клацанням по живій базі.
// ============================================================
import type { MemoryRow } from '@/types';

/**
 * Пересунути елемент на `delta` позицій.
 *
 * Виходи за межі списку — не помилка, а звичайний край: кнопка «вгору» в
 * першого знімка просто нічого не робить. Кидати виняток тут означало б
 * змусити кожен виклик перевіряти межі самому.
 */
export function moveMemory<T>(list: readonly T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length || delta === 0) {
    return [...list];
  }
  const next = [...list];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved as T);
  return next;
}

/**
 * Які рядки треба записати, щоб база бачила саме такий порядок.
 *
 * Нумерація починається з 1, а не з 0: нуль — це значення за
 * замовчуванням для всіх ще не переставлених знімків, і якби перший у
 * ручному порядку теж отримав нуль, база не відрізнила б «його поставили
 * першим» від «його ніколи не чіпали».
 *
 * Повертаються ЛИШЕ ті рядки, чий `sort_order` справді змінився: інакше
 * кожне збереження дня писало б у базу всі тридцять знімків заради
 * перестановки двох.
 */
export function orderPatch(
  ordered: readonly MemoryRow[],
): Array<{ id: number; sort_order: number }> {
  const patch: Array<{ id: number; sort_order: number }> = [];
  for (let i = 0; i < ordered.length; i += 1) {
    const photo = ordered[i]!;
    const next = i + 1;
    if (photo.sort_order !== next) patch.push({ id: photo.id, sort_order: next });
  }
  return patch;
}

/** Чи відрізняється поточна розкладка від тієї, з якої почали. */
export function orderChanged(
  before: readonly MemoryRow[],
  after: readonly MemoryRow[],
): boolean {
  return before.length !== after.length || before.some((p, i) => p.id !== after[i]?.id);
}
