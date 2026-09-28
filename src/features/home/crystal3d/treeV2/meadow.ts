// ============================================================
// Дерево v2 — трава на острівці діорами (ADR-0218, ADR-0220).
// ------------------------------------------------------------
// Трава пучками на куполі острова дерева (ADR-0222) — детермінована з хешу
// дати початку, тож пара щоразу бачить ту саму траву. Одиниці — сцени,
// земля на y = 0 (висоту купола додає `TreeV2World`).
// ============================================================
import { unit } from '@/engine/species/crystalV2/hash';

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
export function grassInstances(seed: string, clear: number, reach: number, count = 420): GrassInstance[] {
  // Трава лише на острівці діорами (ADR-0220): `reach` — трохи менше за
  // його радіус, щоб пучки не звисали з краю.
  const out: GrassInstance[] = [];
  for (let k = 0; k < count; k += 1) {
    const u = unit(seed, `grass${k}:r`);
    const r = clear + (reach - clear) * u * u;
    const a = unit(seed, `grass${k}:a`) * Math.PI * 2;
    out.push({
      x: Math.cos(a) * r,
      z: Math.sin(a) * r,
      y: 0.02,
      scale: 0.06 + 0.08 * unit(seed, `grass${k}:s`),
      turn: unit(seed, `grass${k}:t`) * Math.PI * 2,
    });
  }
  return out;
}
