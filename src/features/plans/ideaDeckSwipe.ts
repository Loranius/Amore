// ============================================================
// Свайп колоди задумів (ADR-0213).
// ------------------------------------------------------------
// Власник: «зроби, щоб у планах "що наступне" свайпалось вверх переходом
// на наступний план, а свайп вниз — на попередній, каруселлю, і прибери
// кнопку "далі"».
//
// Модуль чистий: лише рішення «куди гортати» за зсувом і швидкістю, щоб
// поведінку перевіряв тест, а не око.
// ============================================================

export type DeckMove = 'next' | 'prev' | 'stay';

/** Скільки пікселів руху відрізняє свайп від дотику до кнопки. */
export const DECK_DRAG_SLOP = 8;

/** Частка висоти картки, після якої відпускання гортає. */
export const DECK_COMMIT_SHARE = 0.22;

/** Швидкість, з якої короткий різкий свайп гортає й без довгого ходу, px/мс. */
export const DECK_FLICK_SPEED = 0.45;

/** Скільки триває виліт і в'їзд картки, мс. */
export const DECK_TRANSITION_MS = 240;

/**
 * Куди гортати після відпускання.
 *
 * ВГОРУ — НАСТУПНИЙ. Картка відлітає вгору, з-під неї виїжджає наступна —
 * той самий напрямок, що в стрічці, яку гортають пальцем. Вниз — назад.
 *
 * `dy` — зсув пальця (від'ємний — угору), `velocity` — швидкість у момент
 * відпускання, px/мс, з тим самим знаком.
 */
export function deckMove(dy: number, velocity: number, cardHeight: number, count: number): DeckMove {
  if (count < 2 || !Number.isFinite(dy)) return 'stay';
  const height = Number.isFinite(cardHeight) && cardHeight > 0 ? cardHeight : 200;
  const far = Math.abs(dy) >= height * DECK_COMMIT_SHARE;
  const flick = Number.isFinite(velocity)
    && Math.abs(velocity) >= DECK_FLICK_SPEED
    && Math.abs(dy) >= DECK_DRAG_SLOP
    // Кидок проти ходу пальця (дотягнув угору, а наприкінці смикнув униз)
    // не гортає: вирішує останній напрямок, і він мусить збігатись.
    && Math.sign(velocity) === Math.sign(dy);
  if (!far && !flick) return 'stay';
  return dy < 0 ? 'next' : 'prev';
}

/** Наступна позиція по колу: каруселлю, без кінця й початку. */
export function deckStep(position: number, move: DeckMove, count: number): number {
  if (count <= 0) return 0;
  const shift = move === 'next' ? 1 : move === 'prev' ? -1 : 0;
  return (((position + shift) % count) + count) % count;
}

/**
 * Опір пальцю: картка йде за ним, але дедалі неохочіше. Без нього довгий
 * свайп тягнув би картку через пів екрана поверх лічильників під нею.
 */
export function deckResist(dy: number, cardHeight: number): number {
  const limit = Math.max(40, cardHeight * 0.6);
  return Math.sign(dy) * limit * (1 - Math.exp(-Math.abs(dy) / limit));
}
