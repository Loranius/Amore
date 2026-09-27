// ============================================================
// Детермінований хеш кристала v2 (ADR-0217).
// ------------------------------------------------------------
// Побітово той самий, що в Python-двійнику (`tools/crystal_twin/
// crystal_twin/hashing.py`): FNV-1a 32 по UTF-8 плюс перемішування murmur3.
// Той самий рядок дає те саме число в браузері й у Python — на цьому
// тримається звірка з еталоном.
// ============================================================

const encoder = new TextEncoder();

export function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (const byte of encoder.encode(text)) {
    h ^= byte;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/** Число в [0, 1) з пари (зерно, мітка). */
export function unit(seed: string, tag: string): number {
  return hash32(`${seed}|${tag}`) / 4294967296;
}
