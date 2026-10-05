// ============================================================
// Підлога святилища (ADR-0242): давня кругла підлога, крізь яку виріс
// кристал.
// ------------------------------------------------------------
// Було: один диск із однакових секторів-«піци» й тонкий брунатний обідок —
// тарілка, а не місце. Тепер підлогу читають три кільця, і кожне каже своє:
//
//   * серце (0.10…0.30 R) — плити, підняті й розламані кристалом: внутрішній
//     край вищий, тож видно, що кристал прорвав підлогу знизу. Під ними —
//     земля й жеода, а не постамент (PRODUCT.md: «єдина дозволена опора
//     артефакта — жеода»);
//   * поле (0.31…0.83 R) — великі плити неоднакової ширини, частина
//     тріснула навпіл, частина осіла чи перекошена, у швах — мох;
//   * бордюр (0.84…0.93 R) — кладка з блоків по краю, з проломами. Саме
//     вона дає краю товщину й робить підлогу збудованою, а не вирізаною.
//
// Великі прості форми: на телефоні плита має читатись плитою, а не
// текстурою.
// ============================================================
import { unit } from '@/engine/species/crystalV2/hash';
import { PAINT, Painter, chunk, flower, leaf, polar, type V3 } from './brushes';

/** Куди не ставити бордюр: там стоять колони (кути в радіанах). */
export interface PlatformOptions {
  columnAngles: readonly number[];
}

/** Край землі під плитами: 24 вершини, нерівні — природна скеля, а не диск. */
export const RIM_SEGMENTS = 24;

export function rimRadius(seed: string, R: number, j: number): number {
  return R * (0.93 + 0.12 * unit(seed, `isle:rim${((j % RIM_SEGMENTS) + RIM_SEGMENTS) % RIM_SEGMENTS}`));
}

interface Ring {
  r0: number;
  r1: number;
  n: number;
  /** Наскільки внутрішній край вищий за зовнішній (у R): підняті кристалом плити. */
  heave: number;
  /** Частка плит, тріснутих навпіл. */
  cracked: number;
  /** Частка вибитих плит (на їхньому місці — мох і земля). */
  gone: number;
}

const RINGS: readonly Ring[] = [
  { r0: 0.1, r1: 0.3, n: 6, heave: 0.05, cracked: 0.5, gone: 0 },
  { r0: 0.31, r1: 0.57, n: 9, heave: 0, cracked: 0.35, gone: 0 },
  { r0: 0.58, r1: 0.83, n: 13, heave: 0, cracked: 0.2, gone: 0.22 },
];

function arc(r: number, a0: number, a1: number, y: number, steps: number): V3[] {
  return Array.from({ length: steps + 1 }, (_, i) => polar(r, a0 + ((a1 - a0) * i) / steps, y));
}

/**
 * Одна плита: контур (внутрішня дуга + зовнішня дуга), стиснутий до свого
 * центру на ширину шва, і пласка кришка з нахилом. Кришка лишається
 * однією площиною — перекіс лише по радіусу (підняття) й по куту (осідання).
 */
function slab(
  p: Painter,
  seed: string,
  key: string,
  R: number,
  ring: Ring,
  a0: number,
  a1: number,
) {
  const steps = ring.r1 > 0.5 ? 2 : 1;
  const inner = arc(ring.r0 * R, a1, a0, 0, steps);
  const outer = arc(ring.r1 * R, a0, a1, 0, steps);
  const outline = [...outer, ...inner];
  const cx = outline.reduce((s, v) => s + v[0], 0) / outline.length;
  const cz = outline.reduce((s, v) => s + v[2], 0) / outline.length;
  // Шви різної ширини: кладка давня, плити не з однієї партії.
  const gap = 0.9 + 0.06 * unit(seed, `${key}:gap`);
  const lower = outline.map((v): V3 => [cx + (v[0] - cx) * gap, 0, cz + (v[2] - cz) * gap]);
  const h = R * (0.022 + 0.016 * unit(seed, `${key}:h`));
  const sink = (unit(seed, `${key}:sink`) - 0.5) * h * 0.9;
  const roll = (unit(seed, `${key}:roll`) - 0.5) * h * 1.1;
  const mid = (a0 + a1) / 2;
  const span = Math.max(1e-6, (a1 - a0) / 2);
  const upper = lower.map((v): V3 => {
    const r = Math.hypot(v[0], v[2]);
    const across = Math.atan2(Math.sin(Math.atan2(v[2], v[0]) - mid), Math.cos(Math.atan2(v[2], v[0]) - mid)) / span;
    const lift = ring.heave > 0 ? R * ring.heave * (1 - (r / R - ring.r0) / (ring.r1 - ring.r0)) : 0;
    return [v[0], h + sink + roll * across + lift, v[2]];
  });
  const tone = 0.84 + 0.26 * unit(seed, `${key}:t`);
  p.band(lower, upper, PAINT.paving, (i) => tone * (i < lower.length ? 0.78 : 0.94), true);
}

/**
 * Будує підлогу й повертає край землі під нею — ті самі вершини, з яких
 * починається підошва острова (між ними не має бути щілини).
 */
export function buildPlatform(p: Painter, seed: string, R: number, options: PlatformOptions): V3[] {
  const dirt = Array.from({ length: RIM_SEGMENTS }, (_, j) => polar(rimRadius(seed, R, j), (j / RIM_SEGMENTS) * Math.PI * 2, 0.004));
  p.poly(dirt, PAINT.dirt, 1);

  RINGS.forEach((ring, ri) => {
    const spin = unit(seed, `isle:ring${ri}`) * Math.PI * 2;
    // Межі плит не рівним кроком: плити різної ширини, як у справжній кладці.
    const bounds = Array.from({ length: ring.n }, (_, k) => spin + ((k + (unit(seed, `isle:ring${ri}:b${k}`) - 0.5) * 0.45) / ring.n) * Math.PI * 2);
    for (let k = 0; k < ring.n; k += 1) {
      const key = `isle:tile${ri}:${k}`;
      const a0 = bounds[k]!;
      const a1 = k + 1 < ring.n ? bounds[k + 1]! : bounds[0]! + Math.PI * 2;
      if (unit(seed, `${key}:gone`) < ring.gone) {
        // Вибита плита: земля, мох і пара квіток — природа забирає своє.
        const c = polar(((ring.r0 + ring.r1) / 2) * R, (a0 + a1) / 2, R * 0.004);
        chunk(p, seed, `${key}:moss`, c, R * (0.06 + 0.025 * unit(seed, `${key}:ms`)), PAINT.ivy, 0, 0.2);
        flower(p, seed, `${key}:f`, [c[0], R * 0.016, c[2]], R * 0.018);
        continue;
      }
      if (unit(seed, `${key}:crack`) < ring.cracked) {
        // Тріщина навпіл: дві половини з власним нахилом і широким швом.
        const cut = a0 + (a1 - a0) * (0.38 + 0.24 * unit(seed, `${key}:cut`));
        slab(p, seed, `${key}:a`, R, ring, a0, cut);
        slab(p, seed, `${key}:b`, R, ring, cut, a1);
        // Мох лише в тріщинах зовнішнього кільця: ближче до кристала зелень
        // тягнула б погляд від нього, а в серці тріщини світить сам кристал.
        if (ring.r0 > 0.5 && unit(seed, `${key}:mossy`) < 0.55) {
          chunk(p, seed, `${key}:seam`, polar(((ring.r0 + ring.r1) / 2) * R, cut, R * 0.006), R * 0.04, PAINT.ivy, 0, 0.18);
        }
        continue;
      }
      slab(p, seed, key, R, ring, a0, a1);
    }
  });

  // ── Бордюр: кладка з блоків по краю, з проломами ────────────
  const CURB = 18;
  const curbSpin = unit(seed, 'isle:curb') * Math.PI * 2;
  const nearColumn = (a: number) => options.columnAngles.some((c) => Math.abs(Math.atan2(Math.sin(a - c), Math.cos(a - c))) < 0.2);
  for (let k = 0; k < CURB; k += 1) {
    const key = `isle:curb${k}`;
    const a0 = curbSpin + (k / CURB) * Math.PI * 2 + 0.012;
    const a1 = curbSpin + ((k + 1) / CURB) * Math.PI * 2 - 0.012;
    const mid = (a0 + a1) / 2;
    if (nearColumn(mid)) continue;
    if (unit(seed, `${key}:gone`) < 0.2) {
      // Пролом: блок випав за край; лишились трава й квітка.
      const c = polar(R * 0.885, mid, R * 0.006);
      leaf(p, seed, `${key}:sprig0`, [c[0], R * 0.02, c[2]], R * 0.035);
      leaf(p, seed, `${key}:sprig1`, [c[0] + R * 0.02, R * 0.025, c[2]], R * 0.03);
      if (unit(seed, `${key}:bloom`) < 0.5) flower(p, seed, `${key}:f`, [c[0], R * 0.03, c[2]], R * 0.016);
      continue;
    }
    const h = R * (0.045 + 0.035 * unit(seed, `${key}:h`));
    const tilt = (unit(seed, `${key}:tilt`) - 0.5) * h * 0.5;
    const lower = [polar(R * 0.84, a0, 0), polar(R * 0.935, a0, 0), polar(R * 0.935, a1, 0), polar(R * 0.84, a1, 0)];
    const upper = lower.map((v, i): V3 => [v[0], h + (i < 2 ? tilt : -tilt), v[2]]);
    const tone = 0.8 + 0.22 * unit(seed, `${key}:t`);
    p.band(lower, upper, PAINT.ruin, (i) => tone * (i === 1 ? 0.82 : 0.95), true);
  }

  return dirt;
}
