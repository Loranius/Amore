// ============================================================
// Острів кристала: давнє святилище в небі (ADR-0221, ADR-0227, ADR-0242).
// ------------------------------------------------------------
// Летючий острів, на ньому кругла підлога святилища, крізь яку виріс
// кристал пари; по краю — п'ять давніх колон (з боків і позаду, спереду
// жодної), лоза й мох, під ним — пласти породи, довкола — уламки.
//
// Частини — окремі модулі в `sanctuary/`, кожен за свою частину:
//   brushes.ts      — малювальник і прості форми (спільні з деревом і рифом)
//   platform.ts     — підлога: підняте серце, плити, бордюр, мох у швах
//   columns.ts      — колони з плінтом, барабанами, капітеллю й лозою
//   vegetation.ts   — лози з краю, мох і квіти
//   underside.ts    — підошва пластами, виступи, уламки
//   crystalGround.ts — земля кристала: сяйво швів, шпилі, друзи (світиться)
//
// Усе — оздоблення з хешу дати початку: правила росту (ADR-0217) воно не
// чіпає і від подій не залежить, крім друз (спільні вихідні, ADR-0237) і
// пори року. Модуль чистий: лише масиви, без three. Одиниці — сцени, земля
// на y = 0.
// ============================================================
import type { Season } from '@/engine/species/grammar/season';
import { unit } from '@/engine/species/crystalV2/hash';
import { PAINT, Painter, chunk, flower, polar, type IslandMesh } from './sanctuary/brushes';
import { buildColumns, columnAngles } from './sanctuary/columns';
import { buildCrystalGround } from './sanctuary/crystalGround';
import { buildPlatform } from './sanctuary/platform';
import { buildDebris, buildUnderside } from './sanctuary/underside';
import { buildVegetation } from './sanctuary/vegetation';

export {
  EMPTY_MESH,
  PAINT,
  Painter,
  box,
  chunk,
  flower,
  ivy,
  leaf,
  polar,
  vine,
  type IslandMesh,
  type Paint,
  type V3,
} from './sanctuary/brushes';
export { DAYS_PER_DRUSE, MAX_DRUSES, druseAt, druseCount, druseOfDay } from './sanctuary/crystalGround';

export interface CrystalIsland {
  island: IslandMesh;
  /** Уламки довкола: окремо, бо повільно гойдаються. */
  debris: IslandMesh;
  /**
   * Земля кристала — сяйво швів, шпилі й друзи. Окремо, бо світиться
   * кольором колонії, а сам острів не світиться (ADR-0227).
   */
  ground: IslandMesh;
  /** Найвища точка руїн — щоб камера не зрізала колони. */
  ruinTop: number;
}

export function buildCrystalIsland(seed: string, radius: number, druses = 0, season: Season = 'summer'): CrystalIsland {
  const R = radius;
  const p = new Painter();

  const dirt = buildPlatform(p, seed, R, { columnAngles: columnAngles(seed) });
  const { shells } = buildUnderside(p, seed, R, dirt);
  const ruinTop = buildColumns(p, seed, R);
  buildVegetation(p, seed, R, shells);

  // ── Пора року (ADR-0237): іній узимку, квіти навесні ──────
  // Погода, а не ріст: ні кількість, ні місце нічого не кажуть про пару.
  if (season === 'winter') {
    // Сніжні шапки на плитах — пласкі білі кавалки, що лежать на камені.
    for (let k = 0; k < 16; k += 1) {
      const key = `isle:snow${k}`;
      const a = unit(seed, `${key}:a`) * Math.PI * 2;
      const r = R * (0.3 + 0.62 * Math.sqrt(unit(seed, `${key}:r`)));
      chunk(p, seed, key, polar(r, a, R * 0.03), R * (0.05 + 0.05 * unit(seed, `${key}:s`)), PAINT.cloud, 0.25, 0.22);
    }
  } else if (season === 'spring') {
    // Більше квіток — у швах зовнішніх плит і біля бордюру.
    for (let k = 0; k < 18; k += 1) {
      const key = `isle:bloom${k}`;
      const a = unit(seed, `${key}:a`) * Math.PI * 2;
      const r = R * (0.6 + 0.3 * unit(seed, `${key}:r`));
      flower(p, seed, key, polar(r, a, R * 0.04), R * (0.016 + 0.008 * unit(seed, `${key}:s`)));
    }
  }

  return {
    island: p.build(),
    debris: buildDebris(seed, R).build(),
    ground: buildCrystalGround(seed, R, druses),
    ruinTop,
  };
}
