// ============================================================
// Рослинність святилища (ADR-0242).
// ------------------------------------------------------------
// Було: кілька сотень листочків розсипано латками по краю й цятками
// пасм під ним — зелене конфеті, що тягнуло погляд від кристала і з'їдало
// половину трикутників острова. Тепер рослинність РОСТЕ звідкись:
//   * лози звисають з краю за гравітацією — від плит через обідок по
//     справжній поверхні скелі, тоншаючи донизу, деякі з квіткою на кінці;
//     вони зшивають верх острова з його підошвою;
//   * мох лежить на краю пласкими подушками, а не кулями;
//   * квітки — дрібні рожеві цятки біля моху, у тон кристалу.
// Лоза по колонах і мох у швах — у `columns.ts` і `platform.ts`, де вони
// ростуть. Зелень лишається другою: вона обрамлює рожеве, а не сперечається.
// ============================================================
import { unit } from '@/engine/species/crystalV2/hash';
import { PAINT, Painter, chunk, flower, polar, vine, type V3 } from './brushes';
import { RIM_SEGMENTS } from './platform';
import { surfaceRadius } from './underside';

export function buildVegetation(p: Painter, seed: string, R: number, shells: readonly V3[][]) {
  // ── Лози з краю донизу ──────────────────────────────────────
  const STRANDS = 15;
  for (let k = 0; k < STRANDS; k += 1) {
    const key = `isle:strand${k}`;
    const j = Math.floor(unit(seed, `${key}:j`) * RIM_SEGMENTS);
    const a = ((j + 0.5) / RIM_SEGMENTS) * Math.PI * 2;
    const length = 4 + Math.floor(unit(seed, `${key}:len`) * 7);
    const sway = (unit(seed, `${key}:sway`) - 0.5) * 0.12;
    const path: V3[] = [polar(R * 0.88, a, R * 0.04), polar(surfaceRadius(shells, a, -R * 0.01) + R * 0.02, a, -R * 0.01)];
    for (let d = 1; d <= length; d += 1) {
      const y = -R * 0.03 - d * R * 0.055;
      const ad = a + sway * d * 0.15 + (unit(seed, `${key}:${d}:a`) - 0.5) * 0.04;
      path.push(polar(surfaceRadius(shells, ad, y) + R * 0.018, ad, y));
    }
    vine(p, seed, key, path, R * 0.07, 0.55);
    if (unit(seed, `${key}:bloom`) < 0.35) {
      const end = path[path.length - 1]!;
      flower(p, seed, `${key}:end`, [end[0] * 1.03, end[1], end[2] * 1.03], R * 0.018);
    }
  }

  // ── Мох подушками на краю плит ─────────────────────────────
  for (let k = 0; k < 9; k += 1) {
    const key = `isle:patch${k}`;
    const a = (k / 9) * Math.PI * 2 + unit(seed, `${key}:a`) * 0.5;
    const c = polar(R * (0.87 + 0.08 * unit(seed, `${key}:r`)), a, R * 0.03);
    chunk(p, seed, key, c, R * (0.045 + 0.025 * unit(seed, `${key}:s`)), PAINT.ivy, 0, 0.35);
    if (unit(seed, `${key}:bloom`) < 0.6) {
      const off = (unit(seed, `${key}:fa`) - 0.5) * 0.08;
      flower(p, seed, `${key}:f`, polar(R * 0.86, a + off, R * 0.05), R * 0.018);
    }
  }
}
