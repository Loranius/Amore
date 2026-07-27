// ============================================================
// Чиста частина карти: що показувати в картці й що робити з маркерами.
// ------------------------------------------------------------
// Без mapbox і без DOM — інакше ці два правила перевірялись би тільки
// очима на живій карті, а обидва встигли зламатись саме мовчки.
// ============================================================
import type { MapPinRow } from '@/types';

/**
 * Текст, який картка показує під назвою.
 *
 * Історія бага: `note` заповнювався при створенні мітки, брав участь у
 * пошуку — і НЕ показувався ніде. `review` з'являвся лише пізніше, при
 * редагуванні. У базі знайшлось десять міток, де це два різні тексти,
 * тобто десять нотаток існували, шукались і були невидимі.
 *
 * Порядок такий: враження (пізніше й свідоміше) головніше за нотатку,
 * але якщо враження немає — показуємо нотатку, а не порожнечу.
 */
export function pinPrimaryText(pin: Pick<MapPinRow, 'review' | 'note'>): string | null {
  const review = pin.review?.trim();
  if (review) return review;
  const note = pin.note?.trim();
  return note || null;
}

/** Чи має мітка ще й другий текст, окрім показаного в картці. */
export function pinHasSecondText(pin: Pick<MapPinRow, 'review' | 'note'>): boolean {
  return !!pin.review?.trim() && !!pin.note?.trim();
}

/**
 * Підпис маркера: усе, від чого залежить його вигляд і місце.
 *
 * Якщо підпис не змінився — маркер чіпати не треба. Саме на цьому
 * тримається `planMarkerSync`.
 */
export function markerSignature(pin: MapPinRow): string {
  return `${pin.lat}|${pin.lng}|${pin.category}`;
}

export interface MarkerPlan {
  /** Створити маркер (мітка нова або переїхала/змінила категорію). */
  add: number[];
  /** Прибрати маркер (мітка зникла або буде створена наново). */
  remove: number[];
  /** Лишити як є. */
  keep: number[];
}

/**
 * Що зробити з маркерами, щоб карта збіглася зі списком міток.
 *
 * Було: усі маркери знищувались і створювались наново при кожній зміні
 * `pins`. Оскільки будь-яка мутація робить `invalidate`, після кожного
 * збереження оцінки вся карта перемальовувалась — двадцять шість
 * маркерів блимали заради одного зміненого.
 *
 * `existing` — підписи вже намальованих маркерів (id → markerSignature).
 */
export function planMarkerSync(
  existing: ReadonlyMap<number, string>,
  pins: readonly MapPinRow[],
): MarkerPlan {
  const plan: MarkerPlan = { add: [], remove: [], keep: [] };
  const wanted = new Set<number>();

  for (const pin of pins) {
    wanted.add(pin.id);
    const drawn = existing.get(pin.id);
    if (drawn === undefined) {
      plan.add.push(pin.id);
    } else if (drawn !== markerSignature(pin)) {
      // Переїхала або змінила категорію — простіше перестворити, ніж
      // правити колір, емодзі й координати поокремо.
      plan.remove.push(pin.id);
      plan.add.push(pin.id);
    } else {
      plan.keep.push(pin.id);
    }
  }

  for (const id of existing.keys()) {
    if (!wanted.has(id)) plan.remove.push(id);
  }
  return plan;
}
