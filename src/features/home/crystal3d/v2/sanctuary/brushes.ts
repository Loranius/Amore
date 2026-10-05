// ============================================================
// Пензлі святилища кристала: малювальник трикутників і прості форми.
// ------------------------------------------------------------
// Спільні для островів усіх трьох видів (дерево й риф будують ними свої
// острови). Кожен трикутник несе «фарбу» — індекс кольору палітри, — тож
// тема міняє кольори без перебудови геометрії. Модуль чистий: лише масиви,
// без three; усе детерміноване хешем дати початку.
// ============================================================
import { unit } from '@/engine/species/crystalV2/hash';

export type V3 = [number, number, number];

/** Фарби: бруківка, скеля, камінь руїн, плющ, самоцвіт, земля між плитами. */
/**
 * Фарби острова. Значення — індекс палітри; острів дерева (ADR-0222) читає ті
 * самі індекси як траву, скелю, валуни, плющ, квіти й ґрунт, а 6 і 7 — хмари
 * й далекі острівці. 8 і 9 — лише святилище кристала (ADR-0242): дрібні
 * рожеві квіти й світліші пласти породи в підошві.
 */
export const PAINT = { paving: 0, cliff: 1, ruin: 2, ivy: 3, gem: 4, dirt: 5, cloud: 6, far: 7, bloom: 8, strata: 9 } as const;
/**
 * Індекс фарби. Кристал має вісім слотів (`PAINT`), але палітра матеріалу
 * острова будь-якої довжини: риф має ще пісок, бірюзу й жовтий (ADR-0225).
 */
export type Paint = number;

export interface IslandMesh {
  positions: Float32Array;
  paint: Float32Array;
  tone: Float32Array;
  /** 1 — світиться сам (самоцвіти в скелі), 0 — ні. */
  glow: Float32Array;
}

/** Порожня сітка: для частин сцени, яких у «голому» режимі немає. */
export const EMPTY_MESH: IslandMesh = {
  positions: new Float32Array(0),
  paint: new Float32Array(0),
  tone: new Float32Array(0),
  glow: new Float32Array(0),
};

export class Painter {
  readonly positions: number[] = [];
  readonly paint: number[] = [];
  readonly tone: number[] = [];
  readonly glow: number[] = [];

  tri(a: V3, b: V3, c: V3, paint: Paint, tone: number, glow = 0) {
    this.positions.push(...a, ...b, ...c);
    for (let k = 0; k < 3; k += 1) {
      this.paint.push(paint);
      this.tone.push(tone);
      this.glow.push(glow);
    }
  }

  /** Опуклий багатокутник віялом від першої вершини. */
  poly(points: V3[], paint: Paint, tone: number, glow = 0) {
    for (let i = 1; i + 1 < points.length; i += 1) this.tri(points[0]!, points[i]!, points[i + 1]!, paint, tone, glow);
  }

  /** Призма між двома кільцями (кільця однакової довжини), з кришками за бажанням. */
  band(lower: V3[], upper: V3[], paint: Paint, tone: (i: number) => number, capTop = false, capBottom = false, glow = 0) {
    const n = lower.length;
    for (let i = 0; i < n; i += 1) {
      const j = (i + 1) % n;
      const t = tone(i);
      this.tri(lower[i]!, lower[j]!, upper[j]!, paint, t, glow);
      this.tri(lower[i]!, upper[j]!, upper[i]!, paint, t, glow);
    }
    if (capTop) this.poly(upper, paint, tone(n), glow);
    if (capBottom) this.poly([...lower].reverse(), paint, tone(n + 1) * 0.8, glow);
  }

  build(): IslandMesh {
    return {
      positions: new Float32Array(this.positions),
      paint: new Float32Array(this.paint),
      tone: new Float32Array(this.tone),
      glow: new Float32Array(this.glow),
    };
  }
}

export const polar = (r: number, a: number, y: number): V3 => [Math.cos(a) * r, y, Math.sin(a) * r];

/**
 * Коробка вздовж осі від `a` до `b` з квадратним перерізом `w`×`d`.
 * `turn` повертає переріз навколо осі (рад): колони святилища стоять кожна
 * під своїм кутом, а не всі по сітці.
 */
export function box(p: Painter, a: V3, b: V3, w: number, d: number, paint: Paint, tone: number, turn = 0) {
  const dir: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...dir);
  const u: V3 = [dir[0] / len, dir[1] / len, dir[2] / len];
  const ref: V3 = Math.abs(u[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0];
  let x: V3 = [u[1] * ref[2] - u[2] * ref[1], u[2] * ref[0] - u[0] * ref[2], u[0] * ref[1] - u[1] * ref[0]];
  const xl = Math.hypot(...x);
  x = [x[0] / xl, x[1] / xl, x[2] / xl];
  let z: V3 = [u[1] * x[2] - u[2] * x[1], u[2] * x[0] - u[0] * x[2], u[0] * x[1] - u[1] * x[0]];
  if (turn !== 0) {
    const c = Math.cos(turn);
    const s = Math.sin(turn);
    const xr: V3 = [x[0] * c + z[0] * s, x[1] * c + z[1] * s, x[2] * c + z[2] * s];
    z = [z[0] * c - x[0] * s, z[1] * c - x[1] * s, z[2] * c - x[2] * s];
    x = xr;
  }
  const corner = (c: V3, sx: number, sz: number): V3 => [
    c[0] + x[0] * sx * w + z[0] * sz * d,
    c[1] + x[1] * sx * w + z[1] * sz * d,
    c[2] + x[2] * sx * w + z[2] * sz * d,
  ];
  const ring = (c: V3) => [corner(c, -0.5, -0.5), corner(c, 0.5, -0.5), corner(c, 0.5, 0.5), corner(c, -0.5, 0.5)];
  p.band(ring(a), ring(b), paint, (i) => tone * (0.88 + 0.06 * (i % 3)), true, true);
}

/** Гранчастий кавалок: ікосаедр із зсунутими вершинами. */
export function chunk(p: Painter, seed: string, key: string, c: V3, size: number, paint: Paint, glow = 0, squash = 1) {
  const t = (1 + Math.sqrt(5)) / 2;
  const base: V3[] = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t],
    [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ];
  const faces: [number, number, number][] = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2],
    [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5],
    [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  const pts = base.map((v, i): V3 => {
    const l = Math.hypot(...v);
    const k = (size * (0.75 + 0.5 * unit(seed, `${key}:v${i}`))) / l;
    return [c[0] + v[0] * k, c[1] + v[1] * k * squash, c[2] + v[2] * k];
  });
  faces.forEach(([a, b, d], i) => p.tri(pts[a]!, pts[b]!, pts[d]!, paint, 0.82 + 0.3 * unit(seed, `${key}:f${i}`), glow));
}

/**
 * Листочок плюща: сплющений октаедр із нахилом — вісім пласких граней.
 * Дрібний і дешевий, тож купу можна скласти з десятка, а не з трьох
 * великих кавалків (власник: «дрібніший плющ, як у референсі»).
 */
export function leaf(p: Painter, seed: string, key: string, c: V3, size: number) {
  const a = unit(seed, `${key}:turn`) * Math.PI * 2;
  const tilt = (unit(seed, `${key}:tilt`) - 0.5) * 1.2;
  const along: V3 = [Math.cos(a) * size, Math.sin(tilt) * size * 0.6, Math.sin(a) * size];
  const across: V3 = [-Math.sin(a) * size * 0.62, 0, Math.cos(a) * size * 0.62];
  const up: V3 = [0, size * 0.28, 0];
  const at = (v: V3, k: number): V3 => [c[0] + v[0] * k, c[1] + v[1] * k, c[2] + v[2] * k];
  const tip = at(along, 1);
  const back = at(along, -0.55);
  const l = at(across, 1);
  const r = at(across, -1);
  const t = at(up, 1);
  const b = at(up, -1);
  const tone = () => 0.78 + 0.4 * unit(seed, `${key}:${p.positions.length}`);
  for (const [x, y] of [[tip, l], [l, back], [back, r], [r, tip]] as [V3, V3][]) {
    p.tri(x, y, t, PAINT.ivy, tone());
    p.tri(y, x, b, PAINT.ivy, tone() * 0.85);
  }
}

/**
 * Купа плюща: десяток дрібних листочків, що налягають один на одного. Великі
 * кавалки читались зеленим конфеті, потім — крупною капустою; у референсі
 * плющ дрібнолистий.
 */
export function ivy(p: Painter, seed: string, key: string, c: V3, size: number) {
  // 10–16 листочків середнього розміру: надто дрібні читались цятками.
  const n = 10 + Math.floor(unit(seed, `${key}:n`) * 7);
  for (let k = 0; k < n; k += 1) {
    const a = unit(seed, `${key}:${k}:a`) * Math.PI * 2;
    const r = size * 0.65 * Math.sqrt(unit(seed, `${key}:${k}:r`));
    const at: V3 = [c[0] + Math.cos(a) * r, c[1] + (unit(seed, `${key}:${k}:y`) - 0.5) * size * 0.8, c[2] + Math.sin(a) * r];
    leaf(p, seed, `${key}:${k}`, at, size * (0.38 + 0.2 * unit(seed, `${key}:${k}:s`)));
  }
}


/**
 * Дрібна квітка: п'ять пелюсток-трикутників довкола серцевини, майже
 * пласко на землі чи листі. Шість трикутників — рожева цятка, яку око
 * читає квіткою лише поруч із зеленню.
 */
export function flower(p: Painter, seed: string, key: string, c: V3, size: number) {
  const turn = unit(seed, `${key}:turn`) * Math.PI * 2;
  const centre: V3 = [c[0], c[1] + size * 0.12, c[2]];
  for (let k = 0; k < 5; k += 1) {
    const a0 = turn + (k / 5) * Math.PI * 2 - 0.42;
    const a1 = turn + (k / 5) * Math.PI * 2 + 0.42;
    const tone = 0.9 + 0.2 * unit(seed, `${key}:p${k}`);
    p.tri(centre, [c[0] + Math.cos(a1) * size, c[1] + size * 0.2, c[2] + Math.sin(a1) * size],
      [c[0] + Math.cos(a0) * size, c[1] + size * 0.2, c[2] + Math.sin(a0) * size], PAINT.bloom, tone);
  }
  const h = size * 0.3;
  p.tri([c[0] - h, centre[1] + h * 0.3, c[2]], [c[0] + h, centre[1] + h * 0.3, c[2] - h * 0.5], [c[0], centre[1] + h * 0.3, c[2] + h], PAINT.cloud, 1.05);
}

/**
 * Лоза вздовж шляху: листочки, що меншають до кінця, по черзі ліворуч і
 * праворуч від шляху. Лоза читається однією живою лінією, яка росте звідкись
 * кудись, а не купою окремих кавалків (власник, 2026-10-05: «рослинність —
 * частина середовища, а не прикраси, розставлені довкола»).
 */
export function vine(p: Painter, seed: string, key: string, path: readonly V3[], size: number, taper = 0.45) {
  for (let i = 0; i < path.length; i += 1) {
    const t = path.length > 1 ? i / (path.length - 1) : 0;
    const at = path[i]!;
    const next = path[Math.min(path.length - 1, i + 1)]!;
    const prev = path[Math.max(0, i - 1)]!;
    const d: V3 = [next[0] - prev[0], next[1] - prev[1], next[2] - prev[2]];
    const side: V3 = [-d[2], 0, d[0]];
    const sl = Math.hypot(side[0], side[2]) || 1;
    const k = (i % 2 === 0 ? 1 : -1) * size * 0.35 / sl;
    leaf(p, seed, `${key}:${i}`, [at[0] + side[0] * k, at[1], at[2] + side[2] * k], size * (1 - taper * t));
  }
}
