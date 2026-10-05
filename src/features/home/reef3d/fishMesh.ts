// ============================================================
// Тіло риби з трикутників (власник, 2026-10-05: «покращ модельки риб,
// додай трикутників і полігонів для кожної»).
// ------------------------------------------------------------
// Досі рибка зграї була ромбом і хвостом (3 трикутники), а мешканці
// вулкана — восьмигранним ромбом. Тепер тіло — лофт: сім перерізів від
// носа до хвостового стебла, у кожному вісім вершин, профіль висоти й
// ширини як у справжньої риби (найширше за головою, тонке стебло). До
// тіла — хвіст (роздвоєний у риб, горизонтальні лопаті в кита й дельфіна),
// спинний, грудні й черевний плавці, очі.
//
// Кожна вершина несе «частину» (`part`): 0 — спина, 1 — черевце, 2 —
// плавець, 3 — око. Шейдер зграї й «запечене» світло мешканців фарбують за
// нею: світле черевце, темніші плавці, темне око.
//
// Голова — уздовж +x, верх — +y. Довжина тіла від носа до кінця хвоста ≈ 2
// (x від 1 до −1); масштаб дає той, хто малює.
// ============================================================

export const PART = { back: 0, belly: 1, fin: 2, eye: 3 } as const;

export interface FishShape {
  /** Переріз: x, напіввисота, напівширина. */
  profile: readonly (readonly [number, number, number])[];
  tail: 'forked' | 'flukes';
  dorsal: 'none' | 'sail' | 'hook';
  pectoral: boolean;
  /** Черевний плавець знизу. */
  ventral: boolean;
  /** Вершин у перерізі. */
  sides: number;
}

/** Рибка: обтічна, з високим спинним плавцем і роздвоєним хвостом. */
export const FISH_SHAPE: FishShape = {
  profile: [[1, 0, 0], [0.82, 0.2, 0.12], [0.55, 0.36, 0.19], [0.2, 0.42, 0.21], [-0.15, 0.34, 0.16], [-0.45, 0.18, 0.09], [-0.62, 0.08, 0.04]],
  tail: 'forked', dorsal: 'sail', pectoral: true, ventral: true, sides: 8,
};

/** Кит: масивна голова, товсте тіло, горизонтальні лопаті хвоста. */
export const WHALE_SHAPE: FishShape = {
  profile: [[1, 0, 0], [0.9, 0.2, 0.22], [0.65, 0.32, 0.34], [0.25, 0.34, 0.36], [-0.15, 0.27, 0.28], [-0.45, 0.15, 0.15], [-0.66, 0.06, 0.06]],
  tail: 'flukes', dorsal: 'none', pectoral: true, ventral: false, sides: 10,
};

/** Дельфін: витягнутий дзьоб, гачкуватий спинний плавець, лопаті хвоста. */
export const DOLPHIN_SHAPE: FishShape = {
  profile: [[1, 0, 0], [0.86, 0.05, 0.05], [0.72, 0.16, 0.14], [0.45, 0.27, 0.21], [0.05, 0.26, 0.2], [-0.35, 0.15, 0.11], [-0.62, 0.05, 0.04]],
  tail: 'flukes', dorsal: 'hook', pectoral: true, ventral: false, sides: 10,
};

type V3 = [number, number, number];

export interface FishMesh {
  positions: Float32Array;
  part: Float32Array;
}

export function buildFishMesh(shape: FishShape): FishMesh {
  const pos: number[] = [];
  const part: number[] = [];
  const tri = (a: V3, b: V3, c: V3, p: number) => {
    pos.push(...a, ...b, ...c);
    part.push(p, p, p);
  };
  // Двобічний плавець: той самий трикутник в обидва боки.
  const fin = (a: V3, b: V3, c: V3) => {
    tri(a, b, c, PART.fin);
    tri(a, c, b, PART.fin);
  };

  const { profile, sides } = shape;
  const ring = (i: number): V3[] => {
    const [x, h, w] = profile[i]!;
    return Array.from({ length: sides }, (_, k): V3 => {
      const t = (k / sides) * Math.PI * 2;
      // Спина трохи вища за черевце — силует риби, а не веретена.
      const y = Math.cos(t) * h * (Math.cos(t) > 0 ? 1 : 0.85);
      return [x, y, Math.sin(t) * w];
    });
  };
  const nose: V3 = [profile[0]![0], 0, 0];
  const rings = profile.map((_, i) => ring(i));
  const partOf = (a: V3, b: V3, c: V3) => ((a[1] + b[1] + c[1]) / 3 < -0.02 ? PART.belly : PART.back);

  // Ніс — віяло до першого справжнього перерізу.
  const first = rings[1]!;
  for (let k = 0; k < sides; k += 1) {
    const a = first[k]!;
    const b = first[(k + 1) % sides]!;
    tri(nose, b, a, partOf(nose, a, b));
  }
  // Тіло — смуги між перерізами.
  for (let i = 1; i + 1 < rings.length; i += 1) {
    const r0 = rings[i]!;
    const r1 = rings[i + 1]!;
    for (let k = 0; k < sides; k += 1) {
      const a = r0[k]!;
      const b = r0[(k + 1) % sides]!;
      const c = r1[k]!;
      const d = r1[(k + 1) % sides]!;
      tri(a, b, d, partOf(a, b, d));
      tri(a, d, c, partOf(a, d, c));
    }
  }
  // Стебло хвоста закрите.
  const last = rings.at(-1)!;
  const stem: V3 = [profile.at(-1)![0] - 0.02, 0, 0];
  for (let k = 0; k < sides; k += 1) tri(stem, last[k]!, last[(k + 1) % sides]!, PART.back);

  const sx = profile.at(-1)![0];
  if (shape.tail === 'forked') {
    // Дві лопаті з вирізом посередині, кожна з двох трикутників.
    const root: V3 = [sx, 0, 0];
    const up: V3 = [sx - 0.42, 0.44, 0];
    const down: V3 = [sx - 0.42, -0.4, 0];
    const notch: V3 = [sx - 0.26, 0, 0];
    const upMid: V3 = [sx - 0.18, 0.12, 0];
    const downMid: V3 = [sx - 0.18, -0.11, 0];
    fin(root, upMid, notch);
    fin(upMid, up, notch);
    fin(root, notch, downMid);
    fin(downMid, notch, down);
  } else {
    // Горизонтальні лопаті кита й дельфіна.
    const root: V3 = [sx, 0, 0];
    const notch: V3 = [sx - 0.18, 0, 0];
    for (const s of [-1, 1]) {
      const tip: V3 = [sx - 0.34, 0.02, s * 0.42];
      const lead: V3 = [sx - 0.08, 0, s * 0.14];
      fin(root, lead, tip);
      fin(root, tip, notch);
    }
  }

  // Спинний плавець.
  const top = (x: number) => {
    // Висота спини на x — з профілю.
    for (let i = 0; i + 1 < profile.length; i += 1) {
      const [x0, h0] = profile[i]!;
      const [x1, h1] = profile[i + 1]!;
      if (x <= x0 && x >= x1) return h0 + ((h1 - h0) * (x0 - x)) / (x0 - x1);
    }
    return 0;
  };
  if (shape.dorsal === 'sail') {
    const a: V3 = [0.32, top(0.32) - 0.02, 0];
    const b: V3 = [-0.25, top(-0.25) - 0.02, 0];
    const peak: V3 = [0.02, top(0.02) + 0.3, 0];
    const back: V3 = [-0.18, top(-0.18) + 0.14, 0];
    fin(a, peak, b);
    fin(peak, back, b);
  } else if (shape.dorsal === 'hook') {
    const a: V3 = [0.12, top(0.12) - 0.02, 0];
    const b: V3 = [-0.22, top(-0.22) - 0.02, 0];
    const tip: V3 = [-0.24, top(-0.24) + 0.24, 0];
    fin(a, tip, b);
  }
  // Грудні плавці — з боків за головою, відведені назад і вниз.
  if (shape.pectoral) {
    for (const s of [-1, 1]) {
      const [, h, w] = profile[2]!;
      const root: V3 = [profile[2]![0] - 0.05, -h * 0.35, s * w * 0.95];
      const tip: V3 = [profile[2]![0] - 0.32, -h * 0.85, s * (w + 0.18)];
      const back: V3 = [profile[2]![0] - 0.22, -h * 0.4, s * w * 0.9];
      fin(root, tip, back);
    }
  }
  // Черевний плавець.
  if (shape.ventral) {
    const [x, h] = profile[4]!;
    fin([x + 0.1, -h * 0.82, 0], [x - 0.12, -h * 0.82 - 0.16, 0], [x - 0.12, -h * 0.75, 0]);
  }
  // Очі — темні ромбики з боків голови.
  {
    const [x, h, w] = profile[1]!;
    const [x2, , w2] = profile[2]!;
    const ex = x * 0.4 + x2 * 0.6;
    const ew = (w * 0.4 + w2 * 0.6) * 1.02;
    const ey = h * 0.35;
    const e = 0.045;
    for (const s of [-1, 1]) {
      const c: V3 = [ex, ey, s * ew];
      const pts: V3[] = [[ex + e, ey, s * ew * 0.97], [ex, ey + e, s * ew * 0.97], [ex - e, ey, s * ew * 0.97], [ex, ey - e, s * ew * 0.97]];
      for (let k = 0; k < 4; k += 1) {
        const a = pts[k]!;
        const b = pts[(k + 1) % 4]!;
        if (s > 0) tri(c, a, b, PART.eye);
        else tri(c, b, a, PART.eye);
      }
    }
  }
  return { positions: new Float32Array(pos), part: new Float32Array(part) };
}
