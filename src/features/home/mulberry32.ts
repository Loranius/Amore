// ============================================================
// mulberry32 — детермінований 32-бітний PRNG, без нової залежності.
// Спільний для SVG- і 3D-геометрії кристала.
// ============================================================
export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return function rand() {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * FNV-1a рядок → 32-бітне число. Перетворює персистентний couple-seed
 * (напр. "8264-3607-EEA8") на офсет для mulberry32 — це і є «генетика»
 * кристала: дві пари з ідентичною ДНК все одно ростуть по-різному.
 */
export function hashSeedString(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
