// ============================================================
// Кості гри «Дєвочка в городі» (ADR-0239).
// ------------------------------------------------------------
// Гра не кидає `Math.random()`: кожен кидок — функція від зерна сейву й
// назви причини («день 34, урок 2, приклад 5»). Тож той самий день із тим
// самим сейвом дає ті самі приклади й тих самих перехожих, а різні дні —
// різні. Сейв відтворюваний, тести стабільні, а `noRawRandom.test.ts` не
// має чого ловити.
// ============================================================

export type Rng = () => number;

/** FNV-1a: рядок → 32-бітне число. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32 від зерна. */
export function rngFromSeed(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Кості для названої причини: `rngFor(seed, 'day', 34, 'math')`. */
export function rngFor(...keys: (string | number)[]): Rng {
  return rngFromSeed(hashString(keys.join('|')));
}

export function intIn(rng: Rng, lo: number, hi: number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

export function pickOne<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pickOne: порожній список');
  return items[Math.floor(rng() * items.length)]!;
}

/** Перемішування Фішера — Єйтса; оригінал не змінюється. */
export function shuffled<T>(rng: Rng, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** `n` різних елементів (або всі, якщо їх менше). */
export function sample<T>(rng: Rng, items: readonly T[], n: number): T[] {
  return shuffled(rng, items).slice(0, Math.min(n, items.length));
}
