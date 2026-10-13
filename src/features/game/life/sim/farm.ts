// ============================================================
// Заняття на садибі з міні-грою (ADR-0239, власник 2026-10-13): сад,
// город, курник і ставок. Гра лише рахує, що Лєна зібрала (`tally`), а що
// це дає — гроші, тепло з мамою, настрій — вирішує тут, чиста функція.
// ============================================================

/** Ігри садиби: id заняття (`activities.ts`) — це й id гри (`games/farm.ts`). */
export type FarmGameId = 'orchard' | 'garden' | 'eggs' | 'fishing';
export const FARM_GAMES: readonly FarmGameId[] = ['orchard', 'garden', 'eggs', 'fishing'];

export function isFarmGame(id: string): id is FarmGameId {
  return (FARM_GAMES as readonly string[]).includes(id);
}

// ── Сад ──────────────────────────────────────────────────────
/** Ціна на продаж (власник: «1 яблуко на продаж коштує 1 гривню, слива — 2, груша — 3»). */
export const FRUIT_PRICE = { apple: 1, plum: 2, pear: 3 } as const;
export type Fruit = keyof typeof FRUIT_PRICE;
export const FRUITS: readonly Fruit[] = ['apple', 'plum', 'pear'];
/** Власник: «за одну гру можна зібрати максимум 15 фруктів в кошик». */
export const BASKET_MAX = 15;
export const FRUIT_NAME: Record<Fruit, string> = { apple: 'яблука', plum: 'сливи', pear: 'груші' };

/** Скільки коштує зібране. */
export function fruitEarnings(tally: Readonly<Record<string, number>>): number {
  return FRUITS.reduce((sum, f) => sum + (tally[f] ?? 0) * FRUIT_PRICE[f], 0);
}

// ── Город ────────────────────────────────────────────────────
export const CROPS = ['potato', 'cabbage', 'carrot', 'beet', 'corn'] as const;
export type Crop = (typeof CROPS)[number];
export const CROP_NAME: Record<Crop, string> = { potato: 'картопля', cabbage: 'капуста', carrot: 'морква', beet: 'буряк', corn: 'кукурудза' };

// ── Курник ───────────────────────────────────────────────────
/** Власник: «максимум за раунд 20 яєць, які починаються котитись швидше з кожним 5 яйцем». */
export const EGGS_PER_ROUND = 20;
export const EGG_SPEEDUP_EVERY = 5;

// ── Ставок ───────────────────────────────────────────────────
export const FISH = ['karas', 'okun', 'korop'] as const;
export type Fish = (typeof FISH)[number];
export const FISH_NAME: Record<Fish, string> = { karas: 'карась', okun: 'окунь', korop: 'короп' };
/** Як часто бере: карась — найчастіше, короп — рідко. */
export const FISH_ODDS: Record<Fish, number> = { karas: 0.55, okun: 0.3, korop: 0.15 };

/** Яка риба взяла: кидок 0..1 → вид за `FISH_ODDS`. */
export function fishFor(roll: number): Fish {
  let acc = 0;
  for (const f of FISH) {
    acc += FISH_ODDS[f];
    if (roll < acc) return f;
  }
  return 'korop';
}

// ── Нагорода ─────────────────────────────────────────────────
export interface FarmReward {
  /** Гривні за продане. */
  earned: number;
  /** Тепло з мамою (серця) понад звичайне заняття. */
  mom: number;
  /** Настрій понад звичайне заняття. */
  mood: number;
  /** Рядок для сповіщення. */
  note: string;
}

const n = (tally: Readonly<Record<string, number>>, k: string) => tally[k] ?? 0;

/**
 * Що дає зіграна гра. `score` — 0..1, як гра сама себе оцінила; `tally` —
 * що зібрано (фрукти, урожай, яйця, риба).
 */
export function farmReward(id: FarmGameId, tally: Readonly<Record<string, number>>, score: number): FarmReward {
  const s = Math.max(0, Math.min(1, score));
  switch (id) {
    case 'orchard': {
      const earned = fruitEarnings(tally);
      const parts = FRUITS.filter((f) => n(tally, f) > 0).map((f) => `${FRUIT_NAME[f]} ${n(tally, f)}`);
      return { earned, mom: 0, mood: Math.round(s * 4), note: parts.length ? `Сад: ${parts.join(', ')} — +${earned} ₴` : 'Сад: цього разу кошик порожній' };
    }
    case 'garden': {
      const crops = CROPS.reduce((sum, c) => sum + n(tally, c), 0);
      return { earned: 0, mom: Math.round(s * 5) / 10, mood: Math.round(s * 4), note: `Город: урожаю ${crops}, кротів прогнано ${n(tally, 'moles')}, бур'янів ${n(tally, 'weeds')} — мама задоволена` };
    }
    case 'eggs': {
      const eggs = n(tally, 'eggs');
      return { earned: 0, mom: Math.round((eggs / EGGS_PER_ROUND) * 4) / 10, mood: Math.round(s * 3), note: eggs ? `Курник: ${eggs} яєць мамі в кошик` : 'Курник: усі яйця побились…' };
    }
    case 'fishing': {
      const parts = FISH.filter((f) => n(tally, f) > 0).map((f) => `${FISH_NAME[f]} ${n(tally, f)}`);
      return { earned: 0, mom: parts.length ? 0.2 : 0, mood: Math.round(s * 5), note: parts.length ? `Рибалка: ${parts.join(', ')} — мама засмажить` : 'Рибалка: сьогодні не клювало' };
    }
  }
}

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

/** Рядки картки після гри: що зібрано й скільки це. */
export function farmSummary(id: string, tally: Readonly<Record<string, number>>): string[] {
  if (!isFarmGame(id)) throw new Error(`Заняття «${id}» без міні-гри`);
  switch (id) {
    case 'orchard': {
      const lines = FRUITS.filter((f) => n(tally, f) > 0).map((f) => `${cap(FRUIT_NAME[f])}: ${n(tally, f)} × ${FRUIT_PRICE[f]} ₴ = ${n(tally, f) * FRUIT_PRICE[f]} ₴`);
      return [...(lines.length ? lines : ['Кошик порожній']), `Разом на продаж: ${fruitEarnings(tally)} ₴`];
    }
    case 'garden': {
      const lines = CROPS.filter((c) => n(tally, c) > 0).map((c) => `${cap(CROP_NAME[c])}: ${n(tally, c)}`);
      return [...(lines.length ? lines : ['Урожаю цього разу нема']), `Кротів прогнано: ${n(tally, 'moles')}`, `Бур'янів вирвано: ${n(tally, 'weeds')}`];
    }
    case 'eggs':
      return [`Яєць у кошику: ${n(tally, 'eggs')} з ${EGGS_PER_ROUND}`, `Розбилось: ${n(tally, 'broken')}`];
    case 'fishing': {
      const lines = FISH.map((f) => `${cap(FISH_NAME[f])}: ${n(tally, f)}`);
      return [...lines, `Зірвалось: ${n(tally, 'missed')}`];
    }
  }
}
