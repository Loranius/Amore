// ============================================================
// Острів кристала за референсом власника (ADR-0221, гранчастий — ADR-0227).
// ------------------------------------------------------------
// Референс: летючий острів, верхівка — світлі плити, по краю білі квадратні
// колони з плющем, плющ звисає з краю, підошва — фіолетовий гранчастий клин
// небагатьма великими гранями, довкола висять кавалки. Кристал росте з
// центру.
//
// Усе — оздоблення з хешу дати початку: правила росту (ADR-0217) воно не
// чіпає і від подій не залежить. Кожен трикутник несе «фарбу» — індекс
// кольору палітри, — тож тема міняє кольори без перебудови геометрії.
//
// Модуль чистий: лише масиви, без three. Одиниці — сцени, земля на y = 0.
// ============================================================
import { unit } from '@/engine/species/crystalV2/hash';

export type V3 = [number, number, number];

/** Фарби: бруківка, скеля, камінь руїн, плющ, самоцвіт, земля між плитами. */
/**
 * Фарби острова. Значення — індекс палітри; острів дерева (ADR-0222) читає ті
 * самі індекси як траву, скелю, валуни, плющ, квіти й ґрунт, а 6 і 7 — хмари
 * й далекі острівці.
 */
export const PAINT = { paving: 0, cliff: 1, ruin: 2, ivy: 3, gem: 4, dirt: 5, cloud: 6, far: 7 } as const;
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

/** Коробка вздовж осі від `a` до `b` з квадратним перерізом `w`×`d`. */
export function box(p: Painter, a: V3, b: V3, w: number, d: number, paint: Paint, tone: number) {
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
  // Гранчастий low-poly за референсом власника (ADR-0227): світлі плити,
  // по краю — білі квадратні колони з плющем (частина зламана), підошва —
  // фіолетовий клин небагатьма великими гранями, довкола — фіолетові
  // кавалки. Хеш лише повертає все разом, щоб острів кожної пари був своїм.
  const turn = unit(seed, 'isle:turn') * Math.PI * 2;

  // ── Земля під плитами (видно в щілинах) ───────────────────
  const SEG = 24;
  const rimR = (j: number) => R * (0.97 + 0.07 * unit(seed, `isle:rim${j % SEG}`));
  const dirt = Array.from({ length: SEG }, (_, j) => polar(rimR(j), (j / SEG) * Math.PI * 2, 0.004));
  p.poly(dirt, PAINT.dirt, 1);

  // ── Плити: кільця великих плит із вузькими щілинами ────────
  const rings = [
    { r0: 0, r1: 0.34, n: 5 },
    { r0: 0.34, r1: 0.66, n: 8 },
    { r0: 0.66, r1: 0.96, n: 11 },
  ];
  rings.forEach((ring, ri) => {
    const spin = unit(seed, `isle:ring${ri}`) * Math.PI * 2;
    for (let k = 0; k < ring.n; k += 1) {
      const key = `isle:tile${ri}:${k}`;
      const a0 = spin + (k / ring.n) * Math.PI * 2;
      const a1 = spin + ((k + 1) / ring.n) * Math.PI * 2;
      const outline: V3[] = ring.r0 === 0
        ? [polar(0, 0, 0), polar(ring.r1 * R, a0, 0), polar(ring.r1 * R, (a0 + a1) / 2, 0), polar(ring.r1 * R, a1, 0)]
        : [polar(ring.r0 * R, a0, 0), polar(ring.r1 * R, a0, 0), polar(ring.r1 * R, (a0 + a1) / 2, 0), polar(ring.r1 * R, a1, 0), polar(ring.r0 * R, a1, 0)];
      const cx = outline.reduce((s, v) => s + v[0], 0) / outline.length;
      const cz = outline.reduce((s, v) => s + v[2], 0) / outline.length;
      const gap = 0.95;
      const h = R * (0.016 + 0.012 * unit(seed, `${key}:h`));
      const lower = outline.map((v): V3 => [cx + (v[0] - cx) * gap, 0, cz + (v[2] - cz) * gap]);
      const upper = lower.map((v): V3 => [v[0], h, v[2]]);
      const tone = 0.9 + 0.16 * unit(seed, `${key}:t`);
      p.band(lower, upper, PAINT.paving, () => tone * 0.9, true);
    }
  });

  // ── Підошва: світлий обідок плит, під ним фіолетовий клин ──
  // Як у рифу й дерева (ADR-0225, ADR-0226): під краєм (24 вершини) —
  // дванадцять сегментів із сильним розкидом, небагато широких граней.
  const top = [
    { r: 1.0, y: 0, paint: PAINT.ruin },
    { r: 1.0, y: -0.07, paint: PAINT.ruin },
    { r: 0.98, y: -0.12, paint: PAINT.cliff },
  ] as const;
  const topRing = (li: number) => Array.from({ length: SEG }, (_, j): V3 => {
    // Верхнє кільце — ТІ САМІ вершини, що й край землі під плитами: між
    // ними була щілина, крізь яку видно нутро острова (власник, знімок).
    if (li === 0) return dirt[j]!;
    const L = top[li]!;
    return polar(rimR(j) * L.r, (j / SEG) * Math.PI * 2, R * L.y);
  });
  const UNDER = 12;
  const under = [
    { r: 0.92, y: -0.4 },
    { r: 0.64, y: -0.76 },
    { r: 0.3, y: -1.04 },
  ];
  const deep = under.map((L, li) => Array.from({ length: UNDER }, (_, j): V3 => {
    const a = ((j + (li % 2) * 0.5) / UNDER) * Math.PI * 2 + (unit(seed, `isle:u${li}:${j}:a`) - 0.5) * 0.18;
    return polar(R * L.r * (0.82 + 0.36 * unit(seed, `isle:u${li}:${j}:r`)), a, R * L.y * (0.85 + 0.3 * unit(seed, `isle:u${li}:${j}:y`)));
  }));
  const shells: V3[][] = [...top.map((_, li) => topRing(li)), ...deep];
  for (let li = 0; li + 1 < top.length; li += 1) {
    p.band(shells[li + 1]!, shells[li]!, top[li + 1]!.paint, (i) => 0.9 * (0.88 + 0.2 * unit(seed, `isle:lip${li}:${i}`)));
  }
  const cliffTone = (key: string, depth: number) => (1 - 0.1 * depth) * (0.82 + 0.34 * unit(seed, `isle:ct:${key}`));
  const lip = shells[top.length - 1]!;
  const first = deep[0]!;
  for (let i = 0; i < UNDER; i += 1) {
    const a0 = lip[2 * i]!;
    const a1 = lip[2 * i + 1]!;
    const a2 = lip[(2 * i + 2) % SEG]!;
    const b0 = first[i]!;
    const b1 = first[(i + 1) % UNDER]!;
    p.tri(b0, a1, a0, PAINT.cliff, cliffTone(`t${i}a`, 0));
    p.tri(b0, b1, a1, PAINT.cliff, cliffTone(`t${i}b`, 0));
    p.tri(b1, a2, a1, PAINT.cliff, cliffTone(`t${i}c`, 0));
  }
  for (let li = 0; li + 1 < deep.length; li += 1) {
    p.band(deep[li + 1]!, deep[li]!, PAINT.cliff, (i) => cliffTone(`${li}:${i}`, li + 1));
  }
  const tip: V3 = [R * 0.05, -R * 1.24, -R * 0.04];
  const last = deep[deep.length - 1]!;
  for (let j = 0; j < UNDER; j += 1) p.tri(last[(j + 1) % UNDER]!, last[j]!, tip, PAINT.cliff, 0.6 + 0.12 * unit(seed, `isle:tip${j}`));

  // ── Колони: білі квадратні стовпи по краю, частина зламана ──
  // Референс: п'ять стовпів різної висоти, плющ шапкою згори й пасмами
  // донизу. Арки й сходи попереднього острова (ADR-0221) прибрано.
  let ruinTop = 0;
  // Кути — від камери (вона дивиться з +z, тобто з кута π/2): як у
  // референсі, колони стоять з боків і позаду, а спереду дуга відкрита,
  // щоб жодна не затуляла кристал пари.
  const COLUMNS = [
    { a: 0.52, h: 0.6 },
    { a: 2.62, h: 0.78 },
    { a: 3.75, h: 0.5 },
    { a: 4.71, h: 0.84 },
    { a: 5.67, h: 0.7 },
  ];
  COLUMNS.forEach((col, k) => {
    const key = `isle:column${k}`;
    const a = col.a + (unit(seed, `${key}:a`) - 0.5) * 0.2;
    // Внутрішній бік колони — за 0.74 радіуса: ближче росте кристал пари
    // (`growthFit.test.ts`).
    const base = polar(R * (0.85 + 0.04 * unit(seed, `${key}:r`)), a, 0);
    const h = R * col.h * (0.9 + 0.2 * unit(seed, `${key}:h`));
    const w = R * (0.13 + 0.03 * unit(seed, `${key}:w`));
    const broken = unit(seed, `${key}:broken`) < 0.4;
    box(p, [base[0], -R * 0.02, base[2]], [base[0], R * 0.05, base[2]], w * 1.2, w * 1.2, PAINT.ruin, 0.94);
    box(p, base, [base[0], h, base[2]], w, w, PAINT.ruin, 1);
    if (broken) {
      // Зламаний верх: скошений уламок трохи зсунутий убік.
      const cap: V3 = [base[0] + w * 0.12, h, base[2] - w * 0.1];
      box(p, cap, [cap[0] + w * 0.08, h + w * 0.55, cap[2]], w * 0.8, w * 0.7, PAINT.ruin, 0.9);
    } else {
      box(p, [base[0], h, base[2]], [base[0], h + w * 0.28, base[2]], w * 1.25, w * 1.25, PAINT.ruin, 0.97);
    }
    const crown = h + w * (broken ? 0.55 : 0.28);
    ruinTop = Math.max(ruinTop, crown);
    ivy(p, seed, `${key}:cap`, [base[0], crown + R * 0.01, base[2]], R * 0.12);
    // Пасма з верху колони донизу — по зовнішньому боці, ближче до камери.
    const out: V3 = [Math.cos(a), 0, Math.sin(a)];
    const drops = 2 + Math.floor(unit(seed, `${key}:drops`) * 4);
    for (let d = 1; d <= drops; d += 1) {
      const y = crown - d * R * 0.07;
      if (y < R * 0.06) break;
      ivy(p, seed, `${key}:hang${d}`, [base[0] + out[0] * w * 0.55, y, base[2] + out[2] * w * 0.55], R * (0.07 - d * 0.006));
    }
    // Плющ біля підніжжя — збоку по дузі краю, а не всередину, до кристала.
    const side: V3 = [-Math.sin(a), 0, Math.cos(a)];
    ivy(p, seed, `${key}:foot`, [base[0] + side[0] * w * 0.8, R * 0.04, base[2] + side[2] * w * 0.8], R * 0.08);
  });

  // ── Білі блоки по краю плит ───────────────────────────────
  for (let k = 0; k < 5; k += 1) {
    const key = `isle:block${k}`;
    const a = turn + 0.62 + k * 1.25 + (unit(seed, `${key}:a`) - 0.5) * 0.3;
    const c = polar(R * 0.88, a, 0);
    const s = R * (0.07 + 0.04 * unit(seed, `${key}:s`));
    box(p, c, [c[0], s, c[2]], s * 1.4, s, PAINT.ruin, 0.92);
  }

  // ── Латки плюща по краю плит ──────────────────────────────
  for (let k = 0; k < 12; k += 1) {
    const key = `isle:patch${k}`;
    const a = (k / 12) * Math.PI * 2 + unit(seed, `${key}:a`) * 0.4;
    ivy(p, seed, key, polar(R * (0.84 + 0.1 * unit(seed, `${key}:r`)), a, R * 0.035), R * (0.08 + 0.04 * unit(seed, `${key}:s`)));
  }

  // ── Плющ звисає з краю й лягає на справжню поверхню скелі ──
  // Той самий хід, що в дерева (регресія плюща в повітрі): радіус беремо
  // з кілець підошви на цьому куті й цій висоті.
  const surfaceAt = (a: number, y: number) => {
    const profile = shells.map((ring) => {
      let best = ring[0]!;
      let gap = Infinity;
      for (const v of ring) {
        const d = Math.abs(Math.atan2(Math.sin(Math.atan2(v[2], v[0]) - a), Math.cos(Math.atan2(v[2], v[0]) - a)));
        if (d < gap) { gap = d; best = v; }
      }
      return { r: Math.hypot(best[0], best[2]), y: best[1] };
    });
    for (let li = 0; li + 1 < profile.length; li += 1) {
      const hi = profile[li]!;
      const lo = profile[li + 1]!;
      if (y <= hi.y && y >= lo.y) return hi.r + ((lo.r - hi.r) * (hi.y - y)) / Math.max(1e-6, hi.y - lo.y);
    }
    return profile[profile.length - 1]!.r;
  };
  for (let k = 0; k < 18; k += 1) {
    const key = `isle:strand${k}`;
    const j = Math.floor(unit(seed, `${key}:j`) * SEG);
    const a = ((j + 0.5) / SEG) * Math.PI * 2;
    const length = 2 + Math.floor(unit(seed, `${key}:len`) * 6);
    ivy(p, seed, `${key}:top`, polar(surfaceAt(a, -R * 0.02) + R * 0.02, a, -R * 0.02), R * 0.08);
    for (let d = 1; d <= length; d += 1) {
      const y = -R * 0.04 - d * R * 0.065;
      const ad = a + (unit(seed, `${key}:${d}:a`) - 0.5) * 0.08;
      ivy(p, seed, `${key}:${d}`, polar(surfaceAt(ad, y) + R * 0.015, ad, y), R * (0.065 - d * 0.005));
    }
  }

  // ── Фіолетові кавалки довкола ─────────────────────────────
  const debris = new Painter();
  for (let k = 0; k < 8; k += 1) {
    const key = `isle:debris${k}`;
    const a = (k / 8) * Math.PI * 2 + unit(seed, `${key}:a`) * 0.6;
    const r = R * (1.3 + 0.55 * unit(seed, `${key}:r`));
    // Нижче краю острова: уламок над плитами пропливав перед кристалом.
    const y = R * (-1.0 + 0.8 * unit(seed, `${key}:y`));
    chunk(debris, seed, key, polar(r, a, y), R * (0.06 + 0.08 * unit(seed, `${key}:s`)), PAINT.cliff);
  }

  return { island: p.build(), debris: debris.build(), ruinTop };
}
