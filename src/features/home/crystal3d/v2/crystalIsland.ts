// ============================================================
// Острів кристала за референсом власника (ADR-0221).
// ------------------------------------------------------------
// Референс: летючий острів, верхівка — світла бруківка з плит, по краю
// зруйновані арки й колони з плющем, плющ звисає з краю, підошва — темна
// гранчаста скеля з вкрапленими кристалами, що світяться, довкола висять
// уламки. Кристал росте з центру.
//
// Усе — оздоблення з хешу дати початку: правила росту (ADR-0217) воно не
// чіпає і від подій не залежить. Кожен трикутник несе «фарбу» — індекс
// кольору палітри, — тож тема міняє кольори без перебудови геометрії.
//
// Модуль чистий: лише масиви, без three. Одиниці — сцени, земля на y = 0.
// ============================================================
import { unit } from '@/engine/species/crystalV2/hash';

type V3 = [number, number, number];

/** Фарби: бруківка, скеля, камінь руїн, плющ, самоцвіт, земля між плитами. */
export const PAINT = { paving: 0, cliff: 1, ruin: 2, ivy: 3, gem: 4, dirt: 5 } as const;
export type Paint = (typeof PAINT)[keyof typeof PAINT];

export interface IslandMesh {
  positions: Float32Array;
  paint: Float32Array;
  tone: Float32Array;
  /** 1 — світиться сам (самоцвіти в скелі), 0 — ні. */
  glow: Float32Array;
}

class Painter {
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

const polar = (r: number, a: number, y: number): V3 => [Math.cos(a) * r, y, Math.sin(a) * r];

/** Коробка вздовж осі від `a` до `b` з квадратним перерізом `w`×`d`. */
function box(p: Painter, a: V3, b: V3, w: number, d: number, paint: Paint, tone: number) {
  const dir: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...dir);
  const u: V3 = [dir[0] / len, dir[1] / len, dir[2] / len];
  const ref: V3 = Math.abs(u[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0];
  let x: V3 = [u[1] * ref[2] - u[2] * ref[1], u[2] * ref[0] - u[0] * ref[2], u[0] * ref[1] - u[1] * ref[0]];
  const xl = Math.hypot(...x);
  x = [x[0] / xl, x[1] / xl, x[2] / xl];
  const z: V3 = [u[1] * x[2] - u[2] * x[1], u[2] * x[0] - u[0] * x[2], u[0] * x[1] - u[1] * x[0]];
  const corner = (c: V3, sx: number, sz: number): V3 => [
    c[0] + x[0] * sx * w + z[0] * sz * d,
    c[1] + x[1] * sx * w + z[1] * sz * d,
    c[2] + x[2] * sx * w + z[2] * sz * d,
  ];
  const ring = (c: V3) => [corner(c, -0.5, -0.5), corner(c, 0.5, -0.5), corner(c, 0.5, 0.5), corner(c, -0.5, 0.5)];
  p.band(ring(a), ring(b), paint, (i) => tone * (0.88 + 0.06 * (i % 3)), true, true);
}

/** Гранчастий кавалок: ікосаедр із зсунутими вершинами. */
function chunk(p: Painter, seed: string, key: string, c: V3, size: number, paint: Paint, glow = 0, squash = 1) {
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
 * Купа плюща: кілька кавалків листя, що налягають один на одного. Поодинокі
 * кавалки читались зеленим конфеті (перший кадр); у референсі плющ — густі
 * купи й пасма.
 */
function ivy(p: Painter, seed: string, key: string, c: V3, size: number) {
  const n = 3 + Math.floor(unit(seed, `${key}:n`) * 3);
  for (let k = 0; k < n; k += 1) {
    const a = unit(seed, `${key}:${k}:a`) * Math.PI * 2;
    const r = size * 0.55 * unit(seed, `${key}:${k}:r`);
    const at: V3 = [c[0] + Math.cos(a) * r, c[1] + (unit(seed, `${key}:${k}:y`) - 0.5) * size * 0.6, c[2] + Math.sin(a) * r];
    chunk(p, seed, `${key}:${k}`, at, size * (0.55 + 0.35 * unit(seed, `${key}:${k}:s`)), PAINT.ivy, 0, 0.75);
  }
}

/** Маленький кристал, що стирчить зі скелі: шестигранна призма з вістрям. */
function gem(p: Painter, seed: string, key: string, base: V3, dir: V3, size: number) {
  const l = Math.hypot(...dir);
  const u: V3 = [dir[0] / l, dir[1] / l, dir[2] / l];
  const ref: V3 = Math.abs(u[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0];
  let x: V3 = [u[1] * ref[2] - u[2] * ref[1], u[2] * ref[0] - u[0] * ref[2], u[0] * ref[1] - u[1] * ref[0]];
  const xl = Math.hypot(...x);
  x = [x[0] / xl, x[1] / xl, x[2] / xl];
  const z: V3 = [u[1] * x[2] - u[2] * x[1], u[2] * x[0] - u[0] * x[2], u[0] * x[1] - u[1] * x[0]];
  const ring = (along: number, r: number) => Array.from({ length: 6 }, (_, i): V3 => {
    const a = (i / 6) * Math.PI * 2;
    return [
      base[0] + u[0] * along + (x[0] * Math.cos(a) + z[0] * Math.sin(a)) * r,
      base[1] + u[1] * along + (x[1] * Math.cos(a) + z[1] * Math.sin(a)) * r,
      base[2] + u[2] * along + (x[2] * Math.cos(a) + z[2] * Math.sin(a)) * r,
    ];
  });
  const r0 = ring(-size * 0.3, size * 0.28);
  const r1 = ring(size * 0.9, size * 0.3);
  p.band(r0, r1, PAINT.gem, (i) => 0.85 + 0.3 * unit(seed, `${key}:g${i}`), false, false, 1);
  const tip: V3 = [base[0] + u[0] * size * 1.5, base[1] + u[1] * size * 1.5, base[2] + u[2] * size * 1.5];
  for (let i = 0; i < 6; i += 1) p.tri(r1[i]!, r1[(i + 1) % 6]!, tip, PAINT.gem, 0.95 + 0.2 * unit(seed, `${key}:t${i}`), 1);
}

export interface CrystalIsland {
  island: IslandMesh;
  /** Уламки довкола: окремо, бо повільно гойдаються. */
  debris: IslandMesh;
  /** Найвища точка руїн — щоб камера не зрізала арки. */
  ruinTop: number;
}

export function buildCrystalIsland(seed: string, radius: number): CrystalIsland {
  const R = radius;
  const p = new Painter();

  // ── Земля під плитами (видно в щілинах) ───────────────────
  const SEG = 24;
  const rimR = (j: number) => R * (0.97 + 0.07 * unit(seed, `isle:rim${j % SEG}`));
  const dirt = Array.from({ length: SEG }, (_, j) => polar(rimR(j), (j / SEG) * Math.PI * 2, 0.004));
  p.poly(dirt, PAINT.dirt, 1);

  // ── Бруківка: кільця плит із щілинами, деякі плити випали ──
  const rings = [
    { r0: 0, r1: 0.3, n: 5 },
    { r0: 0.3, r1: 0.58, n: 9 },
    { r0: 0.58, r1: 0.82, n: 13 },
    { r0: 0.82, r1: 0.96, n: 19 },
  ];
  rings.forEach((ring, ri) => {
    const turn = unit(seed, `isle:ring${ri}`) * Math.PI * 2;
    for (let k = 0; k < ring.n; k += 1) {
      const key = `isle:tile${ri}:${k}`;
      if (ri > 0 && unit(seed, `${key}:gone`) < 0.07) continue;
      const a0 = turn + (k / ring.n) * Math.PI * 2;
      const a1 = turn + ((k + 1) / ring.n) * Math.PI * 2;
      const outline: V3[] = ring.r0 === 0
        ? [polar(0, 0, 0), polar(ring.r1 * R, a0, 0), polar(ring.r1 * R, (a0 + a1) / 2, 0), polar(ring.r1 * R, a1, 0)]
        : [polar(ring.r0 * R, a0, 0), polar(ring.r1 * R, a0, 0), polar(ring.r1 * R, (a0 + a1) / 2, 0), polar(ring.r1 * R, a1, 0), polar(ring.r0 * R, a1, 0)];
      const cx = outline.reduce((s, v) => s + v[0], 0) / outline.length;
      const cz = outline.reduce((s, v) => s + v[2], 0) / outline.length;
      const gap = 0.9;
      const h = R * (0.018 + 0.02 * unit(seed, `${key}:h`));
      const lower = outline.map((v): V3 => [cx + (v[0] - cx) * gap, 0, cz + (v[2] - cz) * gap]);
      const upper = lower.map((v): V3 => [v[0], h, v[2]]);
      const tone = 0.86 + 0.24 * unit(seed, `${key}:t`);
      p.band(lower, upper, PAINT.paving, () => tone * 0.85, true);
    }
  });

  // ── Скеля: глибока, гранчаста, темнішає донизу ─────────────
  const layers = [
    // Глибина скелі — близько радіуса, як у референсі: 1.6 радіуса не
    // влазило в кадр, і острів читався обрізаним знизу.
    { r: 1.0, y: -0.04 },
    { r: 0.97, y: -0.22 },
    { r: 0.8, y: -0.48 },
    { r: 0.52, y: -0.76 },
    { r: 0.22, y: -0.98 },
  ];
  const cliffRing = (li: number) => Array.from({ length: SEG }, (_, j): V3 => {
    const L = layers[li]!;
    const jitter = li === 0 ? 1 : 0.8 + 0.4 * unit(seed, `isle:cliff${li}:${j}:r`);
    const a = ((j + (li % 2) * 0.5) / SEG) * Math.PI * 2;
    return polar(rimR(j) * L.r * jitter, a, R * L.y * (li === 0 ? 1 : 0.85 + 0.3 * unit(seed, `isle:cliff${li}:${j}:y`)));
  });
  const cliffs = layers.map((_, li) => cliffRing(li));
  for (let li = 0; li + 1 < cliffs.length; li += 1) {
    p.band(cliffs[li + 1]!, cliffs[li]!, PAINT.cliff, (i) => (0.95 - 0.12 * li) * (0.85 + 0.3 * unit(seed, `isle:cliff${li}:${i}:t`)));
  }
  const tip: V3 = [R * 0.05, -R * 1.22, -R * 0.04];
  const last = cliffs[cliffs.length - 1]!;
  for (let j = 0; j < SEG; j += 1) p.tri(last[(j + 1) % SEG]!, last[j]!, tip, PAINT.cliff, 0.45 + 0.1 * unit(seed, `isle:tip${j}`));

  // ── Самоцвіти в скелі ─────────────────────────────────────
  for (let k = 0; k < 6; k += 1) {
    const key = `isle:gem${k}`;
    const li = 1 + Math.floor(unit(seed, `${key}:l`) * 3);
    const j = Math.floor(unit(seed, `${key}:j`) * SEG);
    const at = cliffs[li]![j]!;
    const out: V3 = [at[0], -Math.abs(at[1]) * 0.6 - R * 0.2, at[2]];
    gem(p, seed, key, at, out, R * (0.07 + 0.05 * unit(seed, `${key}:s`)));
  }

  // ── Бортик: брили по краю ─────────────────────────────────
  for (let j = 0; j < SEG; j += 1) {
    if (unit(seed, `isle:rimstone${j}`) < 0.35) continue;
    const a = ((j + 0.5) / SEG) * Math.PI * 2;
    chunk(p, seed, `isle:rimstone${j}`, polar(rimR(j) * 0.98, a, R * 0.015), R * (0.03 + 0.025 * unit(seed, `isle:rimstone${j}:s`)), PAINT.cliff, 0, 0.7);
  }

  // ── Руїни: дві арки й уламки колон ────────────────────────
  const pillarW = R * 0.085;
  let ruinTop = 0;
  const archAt = (a: number, key: string) => {
    const r = R * 0.8;
    const c = polar(r, a, 0);
    const tangent: V3 = [-Math.sin(a), 0, Math.cos(a)];
    const half = R * (0.17 + 0.04 * unit(seed, `${key}:w`));
    const height = R * (0.5 + 0.12 * unit(seed, `${key}:h`));
    const left: V3 = [c[0] - tangent[0] * half, 0, c[2] - tangent[2] * half];
    const right: V3 = [c[0] + tangent[0] * half, 0, c[2] + tangent[2] * half];
    const broken = unit(seed, `${key}:broken`) < 0.5;
    const rightH = broken ? height * 0.55 : height;
    box(p, left, [left[0], height, left[2]], pillarW, pillarW, PAINT.ruin, 1);
    box(p, right, [right[0], rightH, right[2]], pillarW, pillarW, PAINT.ruin, 0.96);
    // Арка — півколо з п'яти каменів; у зламаної лишається лівий бік.
    const segs = 5;
    const keep = broken ? 3 : segs;
    for (let s = 0; s < keep; s += 1) {
      const t0 = (s / segs) * Math.PI;
      const t1 = ((s + 1) / segs) * Math.PI;
      const at = (t: number): V3 => [
        c[0] - tangent[0] * Math.cos(t) * half,
        height + Math.sin(t) * half * 0.85,
        c[2] - tangent[2] * Math.cos(t) * half,
      ];
      box(p, at(t0), at(t1), pillarW * 0.95, pillarW * 1.05, PAINT.ruin, 0.92 + 0.1 * unit(seed, `${key}:s${s}`));
      // Плющ на арці.
      if (unit(seed, `${key}:ivy${s}`) < 0.75) {
        const m = at((t0 + t1) / 2);
        ivy(p, seed, `${key}:leaf${s}`, [m[0], m[1] + pillarW * 0.3, m[2]], R * 0.075);
        // Пасмо, що звисає з арки.
        const drops = 1 + Math.floor(unit(seed, `${key}:drop${s}`) * 3);
        for (let d = 1; d <= drops; d += 1) {
          ivy(p, seed, `${key}:hang${s}:${d}`, [m[0], m[1] - d * R * 0.055, m[2]], R * (0.055 - d * 0.006));
        }
      }
    }
    ruinTop = Math.max(ruinTop, height + half * 0.85 + pillarW);
    // Плющ біля підніжжя колон.
    [left, right].forEach((foot, f) => ivy(p, seed, `${key}:foot${f}`, [foot[0], R * 0.04, foot[2]], R * 0.09));
  };
  const first = unit(seed, 'isle:arch0') * Math.PI * 2;
  archAt(first, 'isle:arch0');
  archAt(first + Math.PI * (0.62 + 0.2 * unit(seed, 'isle:arch1')), 'isle:arch1');
  for (let k = 0; k < 3; k += 1) {
    const key = `isle:column${k}`;
    const a = first + Math.PI * (1.1 + 0.3 * k + 0.1 * unit(seed, `${key}:a`));
    const base = polar(R * (0.78 + 0.1 * unit(seed, `${key}:r`)), a, 0);
    const h = R * (0.12 + 0.2 * unit(seed, `${key}:h`));
    box(p, base, [base[0], h, base[2]], pillarW * 0.9, pillarW * 0.9, PAINT.ruin, 0.95);
    ivy(p, seed, `${key}:ivy`, [base[0], h * 0.7, base[2]], R * 0.075);
  }

  // ── Плющ звисає з краю острова ────────────────────────────
  for (let k = 0; k < 14; k += 1) {
    const key = `isle:strand${k}`;
    const j = Math.floor(unit(seed, `${key}:j`) * SEG);
    const a = ((j + 0.5) / SEG) * Math.PI * 2;
    const r = rimR(j) * 1.0;
    const length = 2 + Math.floor(unit(seed, `${key}:len`) * 5);
    ivy(p, seed, `${key}:top`, polar(r * 0.96, a, R * 0.04), R * 0.08);
    for (let d = 1; d <= length; d += 1) {
      const y = -d * R * 0.065;
      // Пасмо лягає на скелю: чим нижче, тим ближче до осі, як і скеля.
      const rr = r * (1 - 0.05 * d) + R * 0.03;
      ivy(p, seed, `${key}:${d}`, polar(rr, a + (unit(seed, `${key}:${d}:a`) - 0.5) * 0.08, y), R * (0.065 - d * 0.005));
    }
  }

  // ── Уламки довкола ────────────────────────────────────────
  const debris = new Painter();
  for (let k = 0; k < 7; k += 1) {
    const key = `isle:debris${k}`;
    const a = (k / 7) * Math.PI * 2 + unit(seed, `${key}:a`) * 0.6;
    const r = R * (1.35 + 0.6 * unit(seed, `${key}:r`));
    const y = R * (-0.9 + 1.4 * unit(seed, `${key}:y`));
    chunk(debris, seed, key, polar(r, a, y), R * (0.07 + 0.08 * unit(seed, `${key}:s`)), PAINT.cliff);
  }

  return { island: p.build(), debris: debris.build(), ruinTop };
}
