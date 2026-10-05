// ============================================================
// Підошва летючого острова (ADR-0242).
// ------------------------------------------------------------
// Було: темна однотонна брила, що читалась чорною дірою під святилищем.
// Тепер — відламаний шматок землі з пластами породи:
//   * обідок плит → шар ґрунту → скеля: верх острова фізично переходить у
//     низ (той самий край, без щілини);
//   * чотири пояси скелі, по черзі темніший камінь і світліший пласт — шари
//     видно, але кожен пояс лишається небагатьма великими гранями (не
//     густіше 12 вершин на кільце, правило ADR-0227);
//   * природне звуження до вістря, вістря зсунуте від осі;
//   * два менші висячі виступи — силует сильніший, ніж в одного конуса;
//   * кілька уламків, що пливуть нижче краю, з мохом на верхівці.
// ============================================================
import { unit } from '@/engine/species/crystalV2/hash';
import { PAINT, Painter, chunk, polar, type V3 } from './brushes';
import { RIM_SEGMENTS, rimRadius } from './platform';

/** Пояс підошви: радіус і висота кільця (у R), фарба поясу НАД ним. */
const UNDER = 12;
const DEEP = [
  { r: 0.9, y: -0.36, paint: PAINT.cliff },
  { r: 0.7, y: -0.68, paint: PAINT.strata },
  { r: 0.44, y: -1.0, paint: PAINT.cliff },
  { r: 0.2, y: -1.3, paint: PAINT.strata },
] as const;

export interface Underside {
  /** Кільця від краю плит донизу — по ним плющ лягає на справжню скелю. */
  shells: V3[][];
}

/** Радіус поверхні підошви на куті `a` і висоті `y` (лінійно між кільцями). */
export function surfaceRadius(shells: readonly V3[][], a: number, y: number): number {
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
}

/** Висячий виступ: п'ятигранна брила, що звужується донизу. */
function spur(p: Painter, seed: string, key: string, top: V3, width: number, depth: number) {
  const ring = Array.from({ length: 5 }, (_, i): V3 => {
    const a = (i / 5) * Math.PI * 2 + unit(seed, `${key}:a`) * 2;
    const r = width * (0.8 + 0.4 * unit(seed, `${key}:r${i}`));
    return [top[0] + Math.cos(a) * r, top[1] - depth * 0.15 * unit(seed, `${key}:y${i}`), top[2] + Math.sin(a) * r];
  });
  const lid = ring.map((v): V3 => [top[0] + (v[0] - top[0]) * 0.6, top[1] + width * 0.4, top[2] + (v[2] - top[2]) * 0.6]);
  const tip: V3 = [top[0] + (unit(seed, `${key}:tx`) - 0.5) * width, top[1] - depth, top[2] + (unit(seed, `${key}:tz`) - 0.5) * width];
  p.band(ring, lid, PAINT.strata, (i) => 0.8 + 0.25 * unit(seed, `${key}:t${i}`));
  for (let i = 0; i < 5; i += 1) p.tri(ring[(i + 1) % 5]!, ring[i]!, tip, PAINT.strata, 0.62 + 0.2 * unit(seed, `${key}:f${i}`));
}

export function buildUnderside(p: Painter, seed: string, R: number, dirt: readonly V3[]): Underside {
  // ── Обідок: край плит → шар ґрунту → скеля ──────────────────
  const top = [
    { r: 1.0, y: 0, paint: PAINT.ruin },
    { r: 1.01, y: -0.05, paint: PAINT.dirt },
    { r: 0.97, y: -0.12, paint: PAINT.cliff },
  ] as const;
  const topRing = (li: number) => Array.from({ length: RIM_SEGMENTS }, (_, j): V3 => {
    if (li === 0) return dirt[j]!;
    const L = top[li]!;
    return polar(rimRadius(seed, R, j) * L.r, (j / RIM_SEGMENTS) * Math.PI * 2, R * L.y);
  });
  const deep = DEEP.map((L, li) => Array.from({ length: UNDER }, (_, j): V3 => {
    const a = ((j + (li % 2) * 0.5) / UNDER) * Math.PI * 2 + (unit(seed, `isle:u${li}:${j}:a`) - 0.5) * 0.18;
    return polar(R * L.r * (0.84 + 0.32 * unit(seed, `isle:u${li}:${j}:r`)), a, R * L.y * (0.88 + 0.24 * unit(seed, `isle:u${li}:${j}:y`)));
  }));
  const shells: V3[][] = [...top.map((_, li) => topRing(li)), ...deep];
  for (let li = 0; li + 1 < top.length; li += 1) {
    p.band(shells[li + 1]!, shells[li]!, top[li + 1]!.paint, (i) => 0.9 * (0.88 + 0.2 * unit(seed, `isle:lip${li}:${i}`)));
  }
  // Верхні пояси світліші (їх освітлює підлога святилища), нижні глибші.
  const cliffTone = (key: string, depth: number) => (1 - 0.08 * depth) * (0.84 + 0.3 * unit(seed, `isle:ct:${key}`));
  const lip = shells[top.length - 1]!;
  const first = deep[0]!;
  for (let i = 0; i < UNDER; i += 1) {
    const a0 = lip[2 * i]!;
    const a1 = lip[2 * i + 1]!;
    const a2 = lip[(2 * i + 2) % RIM_SEGMENTS]!;
    const b0 = first[i]!;
    const b1 = first[(i + 1) % UNDER]!;
    p.tri(b0, a1, a0, PAINT.cliff, cliffTone(`t${i}a`, 0));
    p.tri(b0, b1, a1, PAINT.cliff, cliffTone(`t${i}b`, 0));
    p.tri(b1, a2, a1, PAINT.cliff, cliffTone(`t${i}c`, 0));
  }
  for (let li = 0; li + 1 < deep.length; li += 1) {
    p.band(deep[li + 1]!, deep[li]!, DEEP[li + 1]!.paint, (i) => cliffTone(`${li}:${i}`, li + 1));
  }
  // Вістря зсунуте від осі: острів відламаний, а не виточений.
  const tip: V3 = [R * (0.08 * unit(seed, 'isle:tipx') - 0.04), -R * 1.55, R * (0.08 * unit(seed, 'isle:tipz') - 0.04)];
  const last = deep[deep.length - 1]!;
  for (let j = 0; j < UNDER; j += 1) p.tri(last[(j + 1) % UNDER]!, last[j]!, tip, PAINT.cliff, 0.58 + 0.12 * unit(seed, `isle:tip${j}`));

  // ── Два менші виступи під боками ───────────────────────────
  for (let k = 0; k < 2; k += 1) {
    const key = `isle:spur${k}`;
    const a = unit(seed, 'isle:turn') * Math.PI * 2 + k * Math.PI + (unit(seed, `${key}:a`) - 0.5) * 0.8;
    const y = -R * (0.55 + 0.15 * unit(seed, `${key}:y`));
    const r = surfaceRadius(shells, a, y) * 0.86;
    spur(p, seed, key, polar(r, a, y), R * (0.12 + 0.05 * unit(seed, `${key}:w`)), R * (0.35 + 0.15 * unit(seed, `${key}:d`)));
  }
  return { shells };
}

/**
 * Уламки довкола: пласти породи з моховою шапкою, що пливуть нижче краю
 * острова (над краєм вони пропливали перед кристалом — регресія).
 */
export function buildDebris(seed: string, R: number): Painter {
  const debris = new Painter();
  for (let k = 0; k < 7; k += 1) {
    const key = `isle:debris${k}`;
    const a = (k / 7) * Math.PI * 2 + unit(seed, `${key}:a`) * 0.6;
    const r = R * (1.3 + 0.55 * unit(seed, `${key}:r`));
    const y = R * (-1.05 + 0.8 * unit(seed, `${key}:y`));
    const size = R * (0.06 + 0.08 * unit(seed, `${key}:s`));
    const c = polar(r, a, y);
    chunk(debris, seed, key, c, size, k % 2 === 0 ? PAINT.cliff : PAINT.strata, 0, 0.7);
    // Пласка верхівка з мохом на більших уламках: шматки того самого острова.
    if (size > R * 0.1) chunk(debris, seed, `${key}:moss`, [c[0], c[1] + size * 0.5, c[2]], size * 0.7, PAINT.ivy, 0, 0.25);
  }
  return debris;
}
