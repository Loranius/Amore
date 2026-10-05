// ============================================================
// Дерево v2 — трава на острівці діорами (ADR-0218, ADR-0220).
// ------------------------------------------------------------
// Трава пучками на куполі острова дерева (ADR-0222) — детермінована з хешу
// дати початку, тож пара щоразу бачить ту саму траву. Одиниці — сцени,
// земля на y = 0 (висоту купола додає `TreeV2World`).
// ============================================================
import { unit } from '@/engine/species/crystalV2/hash';
import type { TreeV2Buttress } from '@/engine/species/treeV2/geometry';

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
export function grassInstances(seed: string, clear: number, reach: number, count = 200): GrassInstance[] {
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

/**
 * Трава під низькою кроною (власник, 2026-10-04: «через ялинку проходять
 * зелені смужки, схожі на траву»). Нижні «спіднички» ялини опускаються майже
 * до землі, і травинка, вища за них, проколює хвою. Тут кожен пучок стає
 * нижчим за найнижчу хвою над своїм радіусом — трава ховається під лапами,
 * а не проходить крізь них. Де крона висока (дуб, сакура), нічого не міняється.
 * `leaves` — у координатах дерева, `scale` — його масштаб у сцені.
 */
export function tuckGrassUnderCanopy(grass: readonly GrassInstance[], leaves: Float32Array, scale: number): GrassInstance[] {
  const BAND = 0.08; // ширина кільця, сцени
  const ceiling = (d: number) => {
    let low = Infinity;
    for (let i = 0; i < leaves.length; i += 3) {
      const r = Math.hypot(leaves[i]!, leaves[i + 2]!) * scale;
      if (r >= d - BAND && r <= d + BAND) low = Math.min(low, leaves[i + 1]! * scale);
    }
    return low;
  };
  return grass.map((g) => {
    const room = ceiling(Math.hypot(g.x, g.z)) * 0.7;
    return room < g.scale ? { ...g, scale: Math.max(0.005, room) } : g;
  });
}

/**
 * Трава не проростає крізь корені (власник, 2026-10-06: «задні корені
 * можна зробити коротшими й частково приховати травою»). Над переднім і
 * боковими коренями трави немає на всю їхню довжину; над задніми — лише на
 * ближчій до стовбура половині, тож їхні кінці тонуть у траві.
 * `scale` — одиниці моделі → сцени; дерево стоїть в осі.
 */
export function clearGrassFromRoots(grass: readonly GrassInstance[], roots: readonly TreeV2Buttress[], scale: number): GrassInstance[] {
  return grass.filter((g) => {
    const x = g.x / scale;
    const z = g.z / scale;
    return !roots.some((b, i) => {
      const along = x * Math.cos(b.azimuth) + z * Math.sin(b.azimuth);
      const across = Math.abs(-x * Math.sin(b.azimuth) + z * Math.cos(b.azimuth));
      const extent = i < 3 ? b.reach * 1.08 : b.reach * 0.5;
      if (along < 0 || along > extent) return false;
      return across < b.width * (1 - 0.55 * Math.min(1, along / b.reach)) * 1.15;
    });
  });
}
