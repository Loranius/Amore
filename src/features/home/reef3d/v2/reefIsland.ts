// ============================================================
// Острів рифу — гранчастий low-poly за референсом власника (ADR-0225;
// попередній варіант — ADR-0223).
// ------------------------------------------------------------
// Референс (шість ракурсів): летючий острів із пласкою світлою верхівкою,
// бірюзовим каналом півмісяцем, масивною аркою з великих граней позаду,
// гранчастими стоячими каменями по краю й підошвою — великим гранчастим
// клином із небагатьма широкими гранями. Довкола пливуть фіолетові
// кавалки. На плато — яскраві корали, губки, пластини й водорості.
//
// Корали ПАРИ стоять на камені в центрі й рахуються моделлю (ADR-0219).
// Дика живність острова стоїть лише ЗА цим каменем — на плато довкола, на
// арці й на схилах: оздоблення з хешу дати початку, що не претендує на
// жоден із заробленених кольорів. Тест тримає це правило.
//
// Модуль чистий: лише масиви, без three. Одиниці — сцени, земля на y = 0.
// ============================================================
import { unit } from '@/engine/species/crystalV2/hash';
import { Painter, box, chunk, polar, type IslandMesh, type V3 } from '../../crystal3d/v2/crystalIsland';

/**
 * Індекси палітри острова рифу. Перші вісім — ті самі слоти, що й `PAINT`
 * кристала; 8 — пісок дна (оточення), 9 — бірюза губок, 10 — жовті пластини.
 */
export const REEF_PAINT = {
  top: 0, cliff: 1, boulder: 2, algae: 3, lagoon: 4, orange: 5, pink: 6, far: 7, sand: 8, cyan: 9, yellow: 10,
} as const;

/** Фарби дикої живності — ті, що не можна плутати з коралами пари. */
export const REEF_WILD_PAINTS: readonly number[] = [REEF_PAINT.orange, REEF_PAINT.pink, REEF_PAINT.cyan, REEF_PAINT.yellow];

/**
 * Верхівка ПЛАСКА й ледь нижча за нуль моделі: морські зірки й молюски
 * моделі (ADR-0219) лежать на y = 0, і купол їх ховав (регресійний тест).
 */
export const REEF_ISLAND_DOME = 0;
const RIM_Y = -0.004;
const SEG = 24;
/** Підошва — великими гранями: удвічі менше сегментів, ніж по краю. */
const UNDER = 12;

export function reefIslandGround(radius: number, r: number): number {
  const t = Math.min(1, r / Math.max(1e-6, radius));
  return radius * REEF_ISLAND_DOME * (1 - t * t) + RIM_Y;
}

/** Канал води півмісяцем: кільцевий сектор між `inner` і `outer`. */
export interface ReefWater {
  inner: number;
  outer: number;
  /** Кутовий центр і півширина сектора, радіани. */
  angle: number;
  half: number;
}

/** Чи лежить точка (x, z) у воді каналу. */
export function inReefWater(water: ReefWater, x: number, z: number, margin = 0): boolean {
  const r = Math.hypot(x, z);
  const d = Math.abs(Math.atan2(Math.sin(Math.atan2(z, x) - water.angle), Math.cos(Math.atan2(z, x) - water.angle)));
  return r > water.inner - margin && r < water.outer + margin && d < water.half;
}

export interface ReefIsland {
  island: IslandMesh;
  /** Уламки довкола: окремо, бо повільно гойдаються. */
  debris: IslandMesh;
  water: ReefWater;
  /** Звідки піднімаються бульбашки: середина каналу. */
  lagoon: { x: number; z: number; r: number };
}

/** Одиничний вектор. */
const unitV = (v: V3): V3 => {
  const l = Math.hypot(...v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const along = (a: V3, d: V3, k: number): V3 => [a[0] + d[0] * k, a[1] + d[1] * k, a[2] + d[2] * k];

/** Гіллястий корал: товстий стовбур і три-чотири гілки вгору-назовні. */
function branchCoral(p: Painter, seed: string, key: string, base: V3, out: V3, size: number, paint: number) {
  const up = unitV([out[0] * 0.5, 1, out[2] * 0.5]);
  const w = size * 0.2;
  const top = along(base, up, size * 0.5);
  box(p, base, top, w, w, paint, 1);
  const n = 3 + Math.floor(unit(seed, `${key}:n`) * 2);
  for (let k = 0; k < n; k += 1) {
    const a = unit(seed, `${key}:${k}:a`) * Math.PI * 2;
    const d = unitV([up[0] + Math.cos(a) * 0.7, up[1], up[2] + Math.sin(a) * 0.7]);
    const from = along(base, up, size * (0.25 + 0.3 * unit(seed, `${key}:${k}:h`)));
    box(p, from, along(from, d, size * (0.45 + 0.3 * unit(seed, `${key}:${k}:l`))), w * 0.8, w * 0.8, paint, 0.9 + 0.2 * unit(seed, `${key}:${k}:t`));
  }
}

/** Трубчасті губки: дві-три трубки з одного місця, ростуть від грані. */
function tubes(p: Painter, seed: string, key: string, base: V3, size: number, normal: V3 = [0, 1, 0]) {
  const n = 2 + Math.floor(unit(seed, `${key}:n`) * 2);
  const grow = unitV([normal[0] * 0.6, normal[1] * 0.6 + 1, normal[2] * 0.6]);
  for (let k = 0; k < n; k += 1) {
    const a = unit(seed, `${key}:${k}:a`) * Math.PI * 2;
    // Ніжка — у камені, на пів трубки глибше за грань.
    const foot = along([base[0] + Math.cos(a) * size * 0.12, base[1], base[2] + Math.sin(a) * size * 0.12], normal, -size * 0.1);
    const h = size * (0.5 + 0.5 * unit(seed, `${key}:${k}:h`));
    box(p, foot, along(foot, grow, h), size * 0.22, size * 0.22, REEF_PAINT.cyan, 0.9);
  }
}

/** Жовта пластина: сплющений кавалок на короткій ніжці. */
function yellowPlate(p: Painter, seed: string, key: string, base: V3, size: number) {
  box(p, base, [base[0], base[1] + size * 0.3, base[2]], size * 0.18, size * 0.18, REEF_PAINT.yellow, 0.85);
  chunk(p, seed, `${key}:plate`, [base[0], base[1] + size * 0.36, base[2]], size * 0.55, REEF_PAINT.yellow, 0, 0.28);
}

/** Пучок водоростей: гранчасті леза вгору з однієї точки. */
function seaweed(p: Painter, seed: string, key: string, base: V3, size: number) {
  const n = 4 + Math.floor(unit(seed, `${key}:n`) * 3);
  for (let k = 0; k < n; k += 1) {
    const a = (k / n) * Math.PI * 2 + unit(seed, `${key}:${k}:a`);
    const tilt = 0.15 + 0.35 * unit(seed, `${key}:${k}:t`);
    const len = size * (0.7 + 0.5 * unit(seed, `${key}:${k}:l`));
    const out: V3 = [Math.cos(a), 0, Math.sin(a)];
    const side: V3 = [-Math.sin(a), 0, Math.cos(a)];
    const foot = along(base, out, size * 0.06);
    const tip: V3 = [foot[0] + out[0] * Math.sin(tilt) * len, foot[1] + Math.cos(tilt) * len, foot[2] + out[2] * Math.sin(tilt) * len];
    const at = (t: number): V3 => [foot[0] + (tip[0] - foot[0]) * t, foot[1] + (tip[1] - foot[1]) * t, foot[2] + (tip[2] - foot[2]) * t];
    const w = size * 0.1;
    const l = along(at(0.4), side, w);
    const r = along(at(0.4), side, -w);
    const m = along(at(0.45), out, size * 0.04);
    const tone = 0.85 + 0.3 * unit(seed, `${key}:${k}:tone`);
    p.tri(foot, l, m, REEF_PAINT.algae, tone);
    p.tri(foot, m, r, REEF_PAINT.algae, tone * 0.92);
    p.tri(l, tip, m, REEF_PAINT.algae, tone * 1.05);
    p.tri(m, tip, r, REEF_PAINT.algae, tone * 0.9);
  }
}

/** Морська зірка: п'ять пласких променів, прикладених до поверхні. */
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

/** Стоячий камінь: гранчаста призма з косим верхом. */
function standingStone(p: Painter, seed: string, key: string, base: V3, height: number, radius: number) {
  const sides = 5;
  const turn = unit(seed, `${key}:turn`) * Math.PI;
  const lean: V3 = [(unit(seed, `${key}:lx`) - 0.5) * radius * 0.8, 0, (unit(seed, `${key}:lz`) - 0.5) * radius * 0.8];
  const ring = (y: number, r: number, key2: string) => Array.from({ length: sides }, (_, i): V3 => {
    const a = turn + (i / sides) * Math.PI * 2;
    const rr = r * (0.8 + 0.4 * unit(seed, `${key}:${key2}${i}`));
    const lift = y > 0 ? height * 0.18 * unit(seed, `${key}:cap${i}`) : 0;
    return [base[0] + Math.cos(a) * rr + (y > 0 ? lean[0] : 0), base[1] + y + lift, base[2] + Math.sin(a) * rr + (y > 0 ? lean[2] : 0)];
  });
  p.band(ring(-radius * 0.5, radius * 1.1, 'b'), ring(height, radius * 0.8, 't'), REEF_PAINT.boulder, (i) => 0.85 + 0.3 * unit(seed, `${key}:f${i}`), true, false);
}

/**
 * @param rock радіус каменю рифу в сцені — там ростуть колонії пари; типово
 *   0.65 радіуса острова, як у молодого рифу (`ReefV2Scene`: острів ≥ 1.55
 *   каменю).
 * @param options.arch арка позаду каменю; вулкан (ADR-0235) її не має —
 *   за конусом вона злипалась із ним в одну фіолетову пляму.
 */
export function buildReefIsland(
  seed: string,
  radius: number,
  rock = radius * 0.65,
  options: { arch?: boolean; lagoon?: boolean; stones?: boolean } = {},
): ReefIsland {
  const withArch = options.arch ?? true;
  // Вулкан (ADR-0235, референс власника): суцільне біле плато — без лагуни
  // й без стоячих каменів по краю; на плато стоїть життя пари.
  const withLagoon = options.lagoon ?? true;
  const withStones = options.stones ?? true;
  const R = radius;
  const p = new Painter();
  const front = Math.PI / 2;
  const back = -Math.PI / 2;
  const nearAngle = (a: number, b: number, gap: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < gap;

  // ── Верхівка: пласке світле плато ─────────────────────────
  const rimR = (j: number) => R * (0.96 + 0.08 * unit(seed, `reef-isle:rim${j % SEG}`));
  const rim = Array.from({ length: SEG }, (_, j) => polar(rimR(j), (j / SEG) * Math.PI * 2, RIM_Y));
  const ring = (t: number, key: string, shift: number) => Array.from({ length: SEG }, (_, j): V3 => {
    const r = rimR(j) * t * (0.94 + 0.12 * unit(seed, `reef-isle:${key}${j}`));
    return polar(r, ((j + shift) / SEG) * Math.PI * 2, reefIslandGround(R, r));
  });
  const outer = ring(0.68, 'out', 0);
  const mid = ring(0.34, 'mid', 0.5);
  const centre: V3 = [0, reefIslandGround(R, 0), 0];
  const topTone = (key: string) => 0.9 + 0.16 * unit(seed, `reef-isle:top:${key}`);
  for (let j = 0; j < SEG; j += 1) {
    const k = (j + 1) % SEG;
    p.tri(centre, mid[k]!, mid[j]!, REEF_PAINT.top, topTone(`c${j}`));
    p.tri(mid[j]!, mid[k]!, outer[k]!, REEF_PAINT.top, topTone(`m${j}a`));
    p.tri(mid[j]!, outer[k]!, outer[j]!, REEF_PAINT.top, topTone(`m${j}b`));
    p.tri(outer[j]!, outer[k]!, rim[k]!, REEF_PAINT.top, topTone(`o${j}a`));
    p.tri(outer[j]!, rim[k]!, rim[j]!, REEF_PAINT.top, topTone(`o${j}b`));
  }

  // ── Підошва: великий гранчастий клин ──────────────────────
  // Дванадцять сегментів із сильним розкидом — небагато широких граней, як
  // у референсі, а не дрібна «луска» з горбиками. Верхнє кільце — ТІ САМІ
  // вершини, що й край плато (без щілини); перехід 24 → 12 — віялом.
  const under = [
    { r: 0.97, y: -0.16 },
    { r: 0.76, y: -0.55 },
    { r: 0.42, y: -0.95 },
  ];
  const shells: V3[][] = under.map((L, li) => Array.from({ length: UNDER }, (_, j): V3 => {
    const a = ((j + (li % 2) * 0.5) / UNDER) * Math.PI * 2 + (unit(seed, `reef-isle:u${li}:${j}:a`) - 0.5) * 0.18;
    const r = R * L.r * (0.82 + 0.36 * unit(seed, `reef-isle:u${li}:${j}:r`));
    return polar(r, a, R * L.y * (0.85 + 0.3 * unit(seed, `reef-isle:u${li}:${j}:y`)));
  }));
  const cliffTone = (key: string, depth: number) => (1 - 0.1 * depth) * (0.82 + 0.34 * unit(seed, `reef-isle:ct:${key}`));
  const first = shells[0]!;
  for (let i = 0; i < UNDER; i += 1) {
    const a0 = rim[2 * i]!;
    const a1 = rim[2 * i + 1]!;
    const a2 = rim[(2 * i + 2) % SEG]!;
    const b0 = first[i]!;
    const b1 = first[(i + 1) % UNDER]!;
    p.tri(b0, a1, a0, REEF_PAINT.cliff, cliffTone(`t${i}a`, 0));
    p.tri(b0, b1, a1, REEF_PAINT.cliff, cliffTone(`t${i}b`, 0));
    p.tri(b1, a2, a1, REEF_PAINT.cliff, cliffTone(`t${i}c`, 0));
  }
  for (let li = 0; li + 1 < shells.length; li += 1) {
    p.band(shells[li + 1]!, shells[li]!, REEF_PAINT.cliff, (i) => cliffTone(`${li}:${i}`, li + 1));
  }
  const tip: V3 = [R * 0.06, -R * 1.42, -R * 0.04];
  const last = shells[shells.length - 1]!;
  for (let j = 0; j < UNDER; j += 1) p.tri(last[(j + 1) % UNDER]!, last[j]!, tip, REEF_PAINT.cliff, 0.55 + 0.12 * unit(seed, `reef-isle:tip${j}`));

  // ── Канал: бірюзова вода півмісяцем ЗА каменем рифу ───────
  // Вода й арка стоять за каменем, на якому ростуть колонії пари: голова
  // рифу росте з роками (ADR-0219), і на сталих частках радіуса колонії
  // старшого рифу стали б у воду й під арку.
  const inner = Math.max(R * 0.5, rock + R * 0.05);
  const water: ReefWater = {
    inner,
    outer: Math.min(R * 0.9, inner + R * 0.17),
    angle: front + 0.55 + (unit(seed, 'reef-isle:water') - 0.5) * 0.3,
    // Без лагуни вода має нульову дугу: `inReefWater` завжди «ні».
    half: withLagoon ? 1.05 : 0,
  };
  const WSTEPS = 18;
  const waterY = RIM_Y + R * 0.006;
  const edge = (t: number, side: 0 | 1) => {
    // Кінці півмісяця звужуються: вода — калюжа з круглими краями, а не
    // обрізана смуга.
    const taper = Math.sqrt(Math.sin(Math.PI * t));
    const midR = (water.inner + water.outer) / 2;
    const halfW = ((water.outer - water.inner) / 2) * (0.25 + 0.75 * taper) * (0.9 + 0.2 * unit(seed, `reef-isle:w${side}:${Math.round(t * WSTEPS)}`));
    const a = water.angle - water.half + 2 * water.half * t;
    return polar(midR + (side === 0 ? -halfW : halfW), a, waterY);
  };
  for (let i = 0; i < (withLagoon ? WSTEPS : 0); i += 1) {
    const t0 = i / WSTEPS;
    const t1 = (i + 1) / WSTEPS;
    p.tri(edge(t0, 0), edge(t1, 1), edge(t0, 1), REEF_PAINT.lagoon, 1, 0.4);
    p.tri(edge(t0, 0), edge(t1, 0), edge(t1, 1), REEF_PAINT.lagoon, 1, 0.4);
  }
  const midWater = polar((water.inner + water.outer) / 2, water.angle, 0);

  // ── Арка: масивна, з великих граней, позаду ───────────────
  const archA = back + (unit(seed, 'reef-isle:arch') - 0.5) * 0.3;
  const archR = Math.min(R * 0.8, Math.max(R * 0.58, rock + R * 0.14));
  const archC = polar(archR, archA, 0);
  const tangent: V3 = [-Math.sin(archA), 0, Math.cos(archA)];
  const half = R * 0.34;
  const legTop = R * 0.42;
  // Великі камені, що налягають один на одного: з дрібних арка читалась
  // намистом, а в референсі це масивна дуга з кількох широких граней.
  const archStone = R * 0.16;
  for (const sgn of withArch ? [-1, 1] : []) {
    for (let k = 0; k < 3; k += 1) {
      const foot: V3 = [archC[0] + tangent[0] * sgn * half, legTop * (k / 2.4), archC[2] + tangent[2] * sgn * half];
      chunk(p, seed, `reef-isle:leg${sgn}:${k}`, foot, archStone * (1.1 - 0.06 * k), REEF_PAINT.boulder);
    }
  }
  const ARC = 5;
  const archTopAt = (t: number): V3 => [
    archC[0] - tangent[0] * Math.cos(t) * half,
    legTop + Math.sin(t) * half * 0.9,
    archC[2] - tangent[2] * Math.cos(t) * half,
  ];
  for (let s = 0; s < (withArch ? ARC : 0); s += 1) {
    const t = ((s + 0.5) / ARC) * Math.PI;
    chunk(p, seed, `reef-isle:arc${s}`, archTopAt(t), archStone * (0.95 + 0.1 * unit(seed, `reef-isle:arc${s}:s`)), REEF_PAINT.boulder);
  }
  // На верхівці арки — дика живність, як у референсі.
  if (withArch) {
    seaweed(p, seed, 'reef-isle:archweed0', along(archTopAt(Math.PI * 0.3), [0, 1, 0], archStone * 0.7), R * 0.12);
    branchCoral(p, seed, 'reef-isle:archcoral', along(archTopAt(Math.PI * 0.55), [0, 1, 0], archStone * 0.75), [0, 1, 0], R * 0.16, REEF_PAINT.pink);
    seaweed(p, seed, 'reef-isle:archweed1', along(archTopAt(Math.PI * 0.8), [0, 1, 0], archStone * 0.7), R * 0.1);
  }

  // ── Стоячі камені по краю ─────────────────────────────────
  const busy = (a: number, gap: number) =>
    nearAngle(a, archA, 0.55) || nearAngle(a, water.angle, water.half + gap) || nearAngle(a, front, 0.28);
  for (let k = 0; k < (withStones ? 7 : 0); k += 1) {
    const key = `reef-isle:stone${k}`;
    const a = (k / 7) * Math.PI * 2 + (unit(seed, `${key}:a`) - 0.5) * 0.4;
    if (busy(a, 0.1)) continue;
    const r = R * (0.82 + 0.08 * unit(seed, `${key}:r`));
    standingStone(p, seed, key, polar(r, a, 0), R * (0.16 + 0.2 * unit(seed, `${key}:h`)), R * (0.05 + 0.03 * unit(seed, `${key}:w`)));
  }
  // Кілька круглих валунів біля каменів.
  for (let k = 0; k < 6; k += 1) {
    const key = `reef-isle:boulder${k}`;
    const a = (k / 6) * Math.PI * 2 + 0.3 + (unit(seed, `${key}:a`) - 0.5) * 0.5;
    if (busy(a, 0.05)) continue;
    const size = R * (0.05 + 0.04 * unit(seed, `${key}:s`));
    chunk(p, seed, key, polar(R * (0.9 + 0.05 * unit(seed, `${key}:r`)), a, size * 0.3), size, REEF_PAINT.boulder, 0, 0.85);
  }

  // ── Дика живність плато: між каменем рифу й краєм ────────
  const lifeFrom = Math.max(rock + R * 0.04, R * 0.5);
  for (let k = 0; k < 16; k += 1) {
    const key = `reef-isle:life${k}`;
    const a = (k / 16) * Math.PI * 2 + (unit(seed, `${key}:a`) - 0.5) * 0.3;
    const kind = Math.floor(unit(seed, `${key}:kind`) * 6);
    const size = R * (0.09 + 0.06 * unit(seed, `${key}:s`));
    // Гілки тягнуться на свій розмір у всі боки — тож і відступ від каменю
    // рифу на цей розмір, щоб дика гілка не лягала на колонії пари.
    const from = lifeFrom + size * 1.1;
    if (from > R * 0.92) continue;
    const r = from + (R * 0.92 - from) * unit(seed, `${key}:r`);
    const at = polar(r, a, RIM_Y);
    if (inReefWater(water, at[0], at[2], R * 0.05) || nearAngle(a, archA, 0.3)) continue;
    const up: V3 = [0, 1, 0];
    if (kind === 0) branchCoral(p, seed, key, at, [Math.cos(a), 0, Math.sin(a)], size * 1.3, REEF_PAINT.orange);
    else if (kind === 1) branchCoral(p, seed, key, at, [Math.cos(a), 0, Math.sin(a)], size * 1.2, REEF_PAINT.pink);
    else if (kind === 2) tubes(p, seed, key, at, size, up);
    else if (kind === 3) yellowPlate(p, seed, key, at, size * 1.2);
    else seaweed(p, seed, key, at, size * 1.3);
  }

  // ── Схили: кілька зірок і губок на справжніх гранях ───────
  const onCliff = (li: number, j: number) => {
    const a = shells[li + 1]![j]!;
    const b = shells[li]![(j + 1) % UNDER]!;
    const c = shells[li]![j]!;
    const at: V3 = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    const ab: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = unitV([ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]]);
    if (n[0] * at[0] + n[2] * at[2] < 0) n = [-n[0], -n[1], -n[2]];
    return { at, n };
  };
  for (let k = 0; k < 3; k += 1) {
    const key = `reef-isle:star${k}`;
    const { at, n } = onCliff(Math.floor(unit(seed, `${key}:l`) * 2), Math.floor(unit(seed, `${key}:j`) * UNDER));
    starfish(p, seed, key, along(at, n, R * 0.004), n, R * (0.05 + 0.02 * unit(seed, `${key}:s`)));
  }
  for (let k = 0; k < 3; k += 1) {
    const key = `reef-isle:slope${k}`;
    const { at, n } = onCliff(0, Math.floor(unit(seed, `${key}:j`) * UNDER));
    tubes(p, seed, key, along(at, n, -R * 0.015), R * 0.1, n);
  }
  // Кілька клаптів водоростей звисають з краю.
  for (let k = 0; k < 6; k += 1) {
    const key = `reef-isle:edge${k}`;
    const a = (k / 6) * Math.PI * 2 + unit(seed, `${key}:a`) * 0.5;
    if (nearAngle(a, water.angle, water.half)) continue;
    seaweed(p, seed, key, polar(R * 0.95, a, RIM_Y), R * 0.07);
  }

  // ── Фіолетові кавалки довкола ─────────────────────────────
  const debris = new Painter();
  for (let k = 0; k < 8; k += 1) {
    const key = `reef-isle:debris${k}`;
    const a = (k / 8) * Math.PI * 2 + unit(seed, `${key}:a`) * 0.5;
    const r = R * (1.3 + 0.5 * unit(seed, `${key}:r`));
    const y = R * (-1.1 + 0.9 * unit(seed, `${key}:y`));
    chunk(debris, seed, key, polar(r, a, y), R * (0.06 + 0.07 * unit(seed, `${key}:s`)), REEF_PAINT.boulder);
  }

  return {
    island: p.build(),
    debris: debris.build(),
    water,
    lagoon: { x: midWater[0], z: midWater[2], r: (water.outer - water.inner) / 2 },
  };
}
