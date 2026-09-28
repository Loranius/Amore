// ============================================================
// Острів рифу за референсом власника (ADR-0223).
// ------------------------------------------------------------
// Референс: підводний летючий острів — лілово-барвінкова гранчаста скеля
// гострим клином донизу, на верхівці кам'яна арка, круглі валуни й
// бірюзова лагуна, по краю й по скелі — зелені водорості пасмами, дикі
// корали й морські зірки, у глибині — далекі скелі-стовпи.
//
// Ті самі «пензлі», що й острови кристала й дерева (ADR-0221, ADR-0222).
// Корали ПАРИ стоять на верхівці й рахуються моделлю (ADR-0219); дикі
// корали тут — лише на схилах скелі, як плющ у дерева: оздоблення з хешу
// дати початку, що не відповідає ні за що з того, що пара заробила.
//
// Модуль чистий: лише масиви, без three. Одиниці — сцени, земля на y = 0.
// ============================================================
import { unit } from '@/engine/species/crystalV2/hash';
import { Painter, box, chunk, ivy, polar, type IslandMesh, type V3 } from '../../crystal3d/v2/crystalIsland';

/** Індекси палітри острова рифу (ті самі слоти, що й `PAINT` кристала). */
export const REEF_PAINT = { top: 0, cliff: 1, boulder: 2, algae: 3, lagoon: 4, orange: 5, pink: 6, far: 7 } as const;

/** Верхівка — ледь опуклий купол, як у дерева, але нижчий. */
export const REEF_ISLAND_DOME = 0.04;
const RIM_Y = 0.004;
const SEG = 24;

export function reefIslandGround(radius: number, r: number): number {
  const t = Math.min(1, r / Math.max(1e-6, radius));
  return radius * REEF_ISLAND_DOME * (1 - t * t) + RIM_Y;
}

export interface ReefIsland {
  island: IslandMesh;
  /** Уламки довкола: окремо, бо повільно гойдаються. */
  debris: IslandMesh;
  /** Далекі скелі-стовпи в глибині. */
  far: IslandMesh;
  /** Центр і радіус лагуни — щоб бульбашки піднімались із неї. */
  lagoon: { x: number; z: number; r: number };
}

/** Одиничний вектор. */
const unitV = (v: V3): V3 => {
  const l = Math.hypot(...v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const along = (a: V3, d: V3, k: number): V3 => [a[0] + d[0] * k, a[1] + d[1] * k, a[2] + d[2] * k];

/** Гіллястий корал: стовбур і три-чотири гілки вгору-назовні. */
function branchCoral(p: Painter, seed: string, key: string, base: V3, out: V3, size: number, paint: 5 | 6) {
  const up = unitV([out[0] * 0.5, 1, out[2] * 0.5]);
  const w = size * 0.16;
  const top = along(base, up, size * 0.55);
  box(p, base, top, w, w, paint, 1);
  const n = 3 + Math.floor(unit(seed, `${key}:n`) * 2);
  for (let k = 0; k < n; k += 1) {
    const a = unit(seed, `${key}:${k}:a`) * Math.PI * 2;
    const d = unitV([up[0] + Math.cos(a) * 0.7, up[1], up[2] + Math.sin(a) * 0.7]);
    const from = along(base, up, size * (0.25 + 0.3 * unit(seed, `${key}:${k}:h`)));
    box(p, from, along(from, d, size * (0.45 + 0.3 * unit(seed, `${key}:${k}:l`))), w * 0.8, w * 0.8, paint, 0.9 + 0.2 * unit(seed, `${key}:${k}:t`));
  }
}

/** Трубчасті губки: дві-три шестигранні трубки з одного місця. */
function tubes(p: Painter, seed: string, key: string, base: V3, size: number) {
  const n = 2 + Math.floor(unit(seed, `${key}:n`) * 2);
  for (let k = 0; k < n; k += 1) {
    const a = unit(seed, `${key}:${k}:a`) * Math.PI * 2;
    const foot: V3 = [base[0] + Math.cos(a) * size * 0.18, base[1], base[2] + Math.sin(a) * size * 0.18];
    const h = size * (0.5 + 0.5 * unit(seed, `${key}:${k}:h`));
    box(p, foot, [foot[0] + Math.cos(a) * size * 0.1, foot[1] + h, foot[2] + Math.sin(a) * size * 0.1], size * 0.2, size * 0.2, REEF_PAINT.pink, 0.8);
  }
}

/** Морська зірка: п'ять пласких променів, прикладених до скелі. */
function starfish(p: Painter, seed: string, key: string, c: V3, normal: V3, size: number) {
  const n = unitV(normal);
  const ref: V3 = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const x = unitV([n[1] * ref[2] - n[2] * ref[1], n[2] * ref[0] - n[0] * ref[2], n[0] * ref[1] - n[1] * ref[0]]);
  const z: V3 = [n[1] * x[2] - n[2] * x[1], n[2] * x[0] - n[0] * x[2], n[0] * x[1] - n[1] * x[0]];
  const turn = unit(seed, `${key}:turn`) * Math.PI;
  const at = (a: number, r: number, lift: number): V3 => [
    c[0] + (x[0] * Math.cos(a) + z[0] * Math.sin(a)) * r + n[0] * lift,
    c[1] + (x[1] * Math.cos(a) + z[1] * Math.sin(a)) * r + n[1] * lift,
    c[2] + (x[2] * Math.cos(a) + z[2] * Math.sin(a)) * r + n[2] * lift,
  ];
  const mid = at(0, 0, size * 0.25);
  for (let k = 0; k < 5; k += 1) {
    const a = turn + (k / 5) * Math.PI * 2;
    const half = Math.PI / 5;
    p.tri(at(a - half, size * 0.35, size * 0.08), at(a, size, 0.02 * size), mid, REEF_PAINT.orange, 1.05);
    p.tri(at(a, size, 0.02 * size), at(a + half, size * 0.35, size * 0.08), mid, REEF_PAINT.orange, 0.9);
  }
}

export function buildReefIsland(seed: string, radius: number): ReefIsland {
  const R = radius;
  const p = new Painter();
  // Композиція за референсом: арка позаду праворуч, лагуна спереду ліворуч
  // (позаду її ховали корали пари)  // (камера дивиться з +z, екранне «праворуч» — +x). Хеш лише трохи зсуває.
  const archA = -0.95 + (unit(seed, 'reef-isle:arch') - 0.5) * 0.3;
  const lagoonA = Math.PI / 2 + 0.85 + (unit(seed, 'reef-isle:lagoon') - 0.5) * 0.3;
  const front = Math.PI / 2;
  const nearAngle = (a: number, b: number, gap: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < gap;

  // ── Верхівка: купол із двох кілець і центру ───────────────
  const rimR = (j: number) => R * (0.96 + 0.08 * unit(seed, `reef-isle:rim${j % SEG}`));
  const rim = Array.from({ length: SEG }, (_, j) => polar(rimR(j), (j / SEG) * Math.PI * 2, RIM_Y));
  const ring = (t: number, key: string, shift: number) => Array.from({ length: SEG }, (_, j): V3 => {
    const r = rimR(j) * t * (0.94 + 0.12 * unit(seed, `reef-isle:${key}${j}`));
    return polar(r, ((j + shift) / SEG) * Math.PI * 2, reefIslandGround(R, r));
  });
  const outer = ring(0.68, 'out', 0);
  const mid = ring(0.34, 'mid', 0.5);
  const centre: V3 = [0, reefIslandGround(R, 0), 0];
  const topTone = (key: string) => 0.88 + 0.22 * unit(seed, `reef-isle:top:${key}`);
  for (let j = 0; j < SEG; j += 1) {
    const k = (j + 1) % SEG;
    p.tri(centre, mid[k]!, mid[j]!, REEF_PAINT.top, topTone(`c${j}`));
    p.tri(mid[j]!, mid[k]!, outer[k]!, REEF_PAINT.top, topTone(`m${j}a`));
    p.tri(mid[j]!, outer[k]!, outer[j]!, REEF_PAINT.top, topTone(`m${j}b`));
    p.tri(outer[j]!, outer[k]!, rim[k]!, REEF_PAINT.top, topTone(`o${j}a`));
    p.tri(outer[j]!, rim[k]!, rim[j]!, REEF_PAINT.top, topTone(`o${j}b`));
  }

  // ── Скеля: гострий клин донизу, великі грані ──────────────
  const layers = [
    { r: 1.0, y: 0 },
    { r: 1.01, y: -0.1 },
    { r: 0.9, y: -0.36 },
    { r: 0.7, y: -0.66 },
    { r: 0.42, y: -0.98 },
    { r: 0.16, y: -1.24 },
  ] as const;
  const shells = layers.map((L, li) => Array.from({ length: SEG }, (_, j): V3 => {
    // Верхнє кільце скелі — ТІ САМІ вершини, що й край верхівки (без щілини).
    if (li === 0) return rim[j]!;
    const jitter = 0.8 + 0.4 * unit(seed, `reef-isle:cliff${li}:${j}:r`);
    const a = ((j + (li % 2) * 0.5) / SEG) * Math.PI * 2;
    return polar(rimR(j) * L.r * jitter, a, R * L.y * (0.85 + 0.3 * unit(seed, `reef-isle:cliff${li}:${j}:y`)));
  }));
  for (let li = 0; li + 1 < shells.length; li += 1) {
    p.band(shells[li + 1]!, shells[li]!, REEF_PAINT.cliff, (i) => (1 - 0.1 * li) * (0.85 + 0.3 * unit(seed, `reef-isle:cliff${li}:${i}:t`)));
  }
  const tip: V3 = [R * 0.05, -R * 1.45, R * 0.03];
  const last = shells[shells.length - 1]!;
  for (let j = 0; j < SEG; j += 1) p.tri(last[(j + 1) % SEG]!, last[j]!, tip, REEF_PAINT.cliff, 0.5 + 0.1 * unit(seed, `reef-isle:tip${j}`));
  for (let k = 0; k < 10; k += 1) {
    const key = `reef-isle:face${k}`;
    const li = 2 + Math.floor(unit(seed, `${key}:l`) * 3);
    const j = Math.floor(unit(seed, `${key}:j`) * SEG);
    const at = shells[li]![j]!;
    chunk(p, seed, key, [at[0] * 0.96, at[1], at[2] * 0.96], R * (0.08 + 0.05 * unit(seed, `${key}:s`)), REEF_PAINT.cliff);
  }

  // ── Лагуна: бірюзова вода в кам'яній чаші ─────────────────
  const lagoonR = R * 0.24;
  const lc = polar(R * 0.7, lagoonA, 0);
  const lagoonY = reefIslandGround(R, R * 0.7) + R * 0.006;
  const water = Array.from({ length: 10 }, (_, i): V3 => {
    const a = (i / 10) * Math.PI * 2;
    const r = lagoonR * (0.85 + 0.25 * unit(seed, `reef-isle:lagoon${i}`));
    return [lc[0] + Math.cos(a) * r, lagoonY, lc[2] + Math.sin(a) * r];
  });
  p.poly(water, REEF_PAINT.lagoon, 1, 0.45);
  // Бортик лагуни — камінці по колу.
  for (let i = 0; i < 10; i += 1) {
    const w = water[i]!;
    const d: V3 = [w[0] - lc[0], 0, w[2] - lc[2]];
    const l = Math.hypot(d[0], d[2]) || 1;
    chunk(p, seed, `reef-isle:lagoonstone${i}`, [w[0] + (d[0] / l) * R * 0.03, lagoonY, w[2] + (d[2] / l) * R * 0.03], R * (0.035 + 0.02 * unit(seed, `reef-isle:lagoonstone${i}:s`)), REEF_PAINT.top, 0, 0.6);
  }

  // ── Арка: півколо круглих каменів, обвите водоростями ─────
  const archC = polar(R * 0.74, archA, 0);
  const tangent: V3 = [-Math.sin(archA), 0, Math.cos(archA)];
  const half = R * 0.3;
  const height = R * 0.42;
  const STONES = 9;
  for (let s = 0; s <= STONES; s += 1) {
    const t = (s / STONES) * Math.PI;
    const at: V3 = [archC[0] - tangent[0] * Math.cos(t) * half, Math.sin(t) * (height + half * 0.6), archC[2] - tangent[2] * Math.cos(t) * half];
    const size = R * (0.085 + 0.025 * unit(seed, `reef-isle:arch${s}:s`));
    chunk(p, seed, `reef-isle:arch${s}`, at, size, REEF_PAINT.boulder);
    if (s % 2 === 0 && s > 0 && s < STONES) ivy(p, seed, `reef-isle:archivy${s}`, [at[0], at[1] + size * 0.7, at[2]], R * 0.08);
  }
  // Ноги арки: стовпчики з круглих каменів, щоб вона стояла, а не висіла.
  for (const sgn of [-1, 1]) {
    for (let k = 0; k < 2; k += 1) {
      const foot: V3 = [archC[0] + tangent[0] * sgn * half, height * (0.2 + 0.4 * k), archC[2] + tangent[2] * sgn * half];
      chunk(p, seed, `reef-isle:archfoot${sgn}:${k}`, foot, R * 0.085, REEF_PAINT.boulder);
    }
  }

  // ── Круглі валуни по краю ─────────────────────────────────
  for (let k = 0; k < 9; k += 1) {
    const key = `reef-isle:boulder${k}`;
    const a = (k / 9) * Math.PI * 2 + (unit(seed, `${key}:a`) - 0.5) * 0.4;
    if (nearAngle(a, archA, 0.45) || nearAngle(a, lagoonA, 0.4)) continue;
    const big = !nearAngle(a, front, 0.55);
    const size = R * (big ? 0.09 + 0.07 * unit(seed, `${key}:s`) : 0.045 + 0.02 * unit(seed, `${key}:s`));
    chunk(p, seed, key, polar(R * (0.9 + 0.06 * unit(seed, `${key}:r`)), a, size * 0.3), size, REEF_PAINT.boulder, 0, 0.85);
  }

  // ── Водорості: латки на краю й пасма по скелі ─────────────
  for (let k = 0; k < 14; k += 1) {
    const key = `reef-isle:patch${k}`;
    const a = (k / 14) * Math.PI * 2 + unit(seed, `${key}:a`) * 0.4;
    ivy(p, seed, key, polar(R * (0.9 + 0.06 * unit(seed, `${key}:r`)), a, R * 0.02), R * (0.08 + 0.04 * unit(seed, `${key}:s`)));
  }
  for (let k = 0; k < 16; k += 1) {
    const key = `reef-isle:strand${k}`;
    const j = Math.floor(unit(seed, `${key}:j`) * SEG);
    const a = ((j + 0.5) / SEG) * Math.PI * 2;
    const r = rimR(j) * 1.02;
    const length = 3 + Math.floor(unit(seed, `${key}:len`) * 6);
    for (let d = 1; d <= length; d += 1) {
      const rr = r * (1 - 0.05 * d) + R * 0.03;
      ivy(p, seed, `${key}:${d}`, polar(rr, a + (unit(seed, `${key}:${d}:a`) - 0.5) * 0.08, -d * R * 0.07), R * (0.07 - d * 0.004));
    }
  }

  // ── Дика живність на схилах: корали, губки, зірки ─────────
  for (let k = 0; k < 12; k += 1) {
    const key = `reef-isle:wild${k}`;
    const li = 1 + Math.floor(unit(seed, `${key}:l`) * 2);
    const j = Math.floor(unit(seed, `${key}:j`) * SEG);
    const at = shells[li]![j]!;
    const out = unitV([at[0], 0, at[2]]);
    const base: V3 = [at[0] + out[0] * R * 0.02, at[1], at[2] + out[2] * R * 0.02];
    const kind = Math.floor(unit(seed, `${key}:kind`) * 4);
    const size = R * (0.17 + 0.08 * unit(seed, `${key}:s`));
    if (kind === 0) branchCoral(p, seed, key, base, out, size, REEF_PAINT.pink);
    else if (kind === 1) branchCoral(p, seed, key, base, out, size, REEF_PAINT.orange);
    else if (kind === 2) tubes(p, seed, key, base, size * 0.8);
    // Помпон — кругла м'яка колонія, світліша за зірку.
    else chunk(p, seed, key, along(base, out, size * 0.2), size * 0.35, REEF_PAINT.orange, 0, 0.9);
  }
  for (let k = 0; k < 5; k += 1) {
    const key = `reef-isle:star${k}`;
    const li = 2 + Math.floor(unit(seed, `${key}:l`) * 2);
    const j = Math.floor(unit(seed, `${key}:j`) * SEG);
    const at = shells[li]![j]!;
    const out = unitV([at[0], -0.2, at[2]]);
    starfish(p, seed, key, along(at, out, R * 0.06), out, R * (0.05 + 0.02 * unit(seed, `${key}:s`)));
  }

  // ── Уламки довкола ────────────────────────────────────────
  const debris = new Painter();
  for (let k = 0; k < 6; k += 1) {
    const key = `reef-isle:debris${k}`;
    const a = (k / 6) * Math.PI * 2 + unit(seed, `${key}:a`) * 0.6;
    chunk(debris, seed, key, polar(R * (1.35 + 0.55 * unit(seed, `${key}:r`)), a, R * (-0.9 + 1.3 * unit(seed, `${key}:y`))), R * (0.06 + 0.07 * unit(seed, `${key}:s`)), REEF_PAINT.cliff);
  }

  // ── Далекі скелі-стовпи в глибині ─────────────────────────
  const far = new Painter();
  // Далеко й небагато: у першому кадрі стовпи стояли близько й насичено
  // синіми, і глибина читалась стіною, а не простором.
  for (let k = 0; k < 6; k += 1) {
    const key = `reef-far:pillar${k}`;
    const side = k % 2 === 0 ? -1 : 1;
    const z = -12 - 10 * unit(seed, `${key}:z`);
    const x = side * (3 + (2 - z * 0.12) * unit(seed, `${key}:x`));
    const h = 3 + 5 * unit(seed, `${key}:h`);
    const w = 0.3 + 0.35 * unit(seed, `${key}:w`);
    for (let s = 0; s * w * 1.2 < h; s += 1) {
      chunk(far, seed, `${key}:${s}`, [x + (unit(seed, `${key}:${s}:dx`) - 0.5) * w * 0.4, -4 + s * w * 1.2, z], w * (0.9 - 0.3 * (s * w * 1.2) / h), REEF_PAINT.far);
    }
  }

  return { island: p.build(), debris: debris.build(), far: far.build(), lagoon: { x: lc[0], z: lc[2], r: lagoonR } };
}

