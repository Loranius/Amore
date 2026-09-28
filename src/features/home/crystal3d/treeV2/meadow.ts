// ============================================================
// Дерево v2 — луг, пагорби й трава (ADR-0218).
// ------------------------------------------------------------
// «Дерево — луг» (PRODUCT.md). Пагорб лугу — купол із пласких клаптів,
// за ним три кільця далеких пагорбів, що тануть у тумані, і трава
// пучками. Усе детерміноване з хешу дати початку: пара щоразу бачить той
// самий луг. Одиниці — сцени, земля на y = 0 (групу ставить сцена).
// ============================================================
import { unit } from '@/engine/species/crystalV2/hash';

export const MEADOW_RADIUS = 9;

/** Висота купола лугу на відстані r від дерева. */
export function meadowHeight(r: number): number {
  const t = Math.min(1, r / MEADOW_RADIUS);
  return 0.18 * (1 - t * t) - 0.18;
}

export interface ToneMesh {
  positions: Float32Array;
  tone: Float32Array;
}

function pushFace(out: number[], tone: number[], a: number[], b: number[], c: number[], value: number) {
  out.push(...a, ...b, ...c);
  tone.push(value, value, value);
}

/** Купол лугу: кільця клаптів, біля дерева дрібніші. */
export function buildMeadow(seed: string): ToneMesh {
  const RINGS = 9;
  const SEGMENTS = 36;
  const out: number[] = [];
  const tone: number[] = [];
  // За краєм купола луг тягнеться до обрію трьома широкими кільцями й тане
  // в тумані кольору неба: обрій без шва (кільця пагорбів читались стінами).
  const OUTER = [16, 28, 60];
  const radius = (i: number) => (i <= RINGS ? MEADOW_RADIUS * Math.pow(i / RINGS, 1.35) : OUTER[i - RINGS - 1]!);
  const point = (i: number, j: number): number[] => {
    const r = radius(i) * (i === 0 ? 0 : 1 + (unit(seed, `meadow${i}:${j}:r`) - 0.5) * 0.08);
    const a = ((j + (i % 2) * 0.5) / SEGMENTS) * Math.PI * 2;
    const bump = i === 0 || i >= RINGS ? 0 : (unit(seed, `meadow${i}:${j}:y`) - 0.5) * 0.05;
    return [Math.cos(a) * r, meadowHeight(r) + bump, Math.sin(a) * r];
  };
  for (let i = 0; i < RINGS + OUTER.length; i += 1) {
    for (let j = 0; j < SEGMENTS; j += 1) {
      const k = (j + 1) % SEGMENTS;
      const a = point(i, j);
      const b = point(i, k);
      const c = point(i + 1, j);
      const d = point(i + 1, k);
      const t1 = 0.9 + 0.2 * unit(seed, `meadow${i}:${j}:t1`);
      const t2 = 0.9 + 0.2 * unit(seed, `meadow${i}:${j}:t2`);
      pushFace(out, tone, a, c, d, t1);
      if (i > 0) pushFace(out, tone, a, d, b, t2);
    }
  }
  return { positions: new Float32Array(out), tone: new Float32Array(tone) };
}

/** Пучок трави: три травинки-трикутники віялом. Висота 1 — масштаб дає інстанс. */
export function buildGrassTuft(): Float32Array {
  const out: number[] = [];
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI;
    const c = Math.cos(a) * 0.05;
    const s = Math.sin(a) * 0.05;
    const lean = (i - 1) * 0.12;
    out.push(-c, 0, -s, c, 0, s, lean, 1, lean * 0.5);
  }
  return new Float32Array(out);
}

export interface GrassInstance { x: number; z: number; y: number; scale: number; turn: number }

/** Пучки трави: густіше біля дерева, рідше до краю лугу; не на стовбурі. */
export function grassInstances(seed: string, clear: number, count = 1100): GrassInstance[] {
  // Трава лише довкола дерева: камера стоїть приблизно за 5–7 одиниць, і
  // пучок біля неї виходив завбільшки з пів екрана (перший живий кадр).
  const reach = 4.6;
  const out: GrassInstance[] = [];
  for (let k = 0; k < count; k += 1) {
    const u = unit(seed, `grass${k}:r`);
    const r = clear + (reach - clear) * u * u;
    const a = unit(seed, `grass${k}:a`) * Math.PI * 2;
    out.push({
      x: Math.cos(a) * r,
      z: Math.sin(a) * r,
      y: meadowHeight(r),
      scale: 0.06 + 0.08 * unit(seed, `grass${k}:s`),
      turn: unit(seed, `grass${k}:t`) * Math.PI * 2,
    });
  }
  return out;
}
