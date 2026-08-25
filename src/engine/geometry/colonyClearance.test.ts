import { describe, expect, it } from 'vitest';
import { DEFAULT_CRYSTAL_COMPOSITION_CONFIG, buildCrystalComposition } from '../composition';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../evolution';
import { DEFAULT_GROWTH_ENGINE_CONFIG, buildGrowthState } from '../growth';
import { buildCrystalSpeciesBlueprint, crystalToGrowthBlueprint } from '../species/crystal';
import { DEFAULT_CRYSTAL_GEOMETRY_CONFIG } from './config';
import { buildCrystalGeometry } from './engine';
import { CRYSTAL_SUBSTRATE_BODY_ID } from './substrate';
import type { CrystalMeshData } from './types';

// ============================================================
// Діти стоять впритул — і саме тому це треба міряти оболонками.
// ------------------------------------------------------------
// Власник: «дочірні кристали підсунь впритул до кристала монарха».
// Просвіт між оболонками звузився з 0.0178 до 0.0036 при радіусі дитини
// близько 0.02 — тобто колонія читається одним зрощеним тілом.
//
// Наявна перевірка в `growthModel.test.ts` цього не стереже, хоч і
// виглядає так. Вона звіряє опубліковану відстань із
// `childClearance(...)` — тобто з ТИМИ САМИМИ константами, з яких ця
// відстань і порахована. Така перевірка лишається зеленою, хай які
// числа підставити, і мовчить рівно тоді, коли константи неправильні.
//
// Цей файл питає інше: чи не заходить оболонка дитини в оболонку
// монарха НАСПРАВДІ. Обидва тіла — опуклі многогранники навколо своїх
// осей, тож радіус монарха береться на висоті кожної вершини дитини, а
// не як одне число: кристал звужується догори, і порівняння з
// найширшим місцем збрехало б на користь.
//
// Історія, через яку це важливо, записана в `CHILD_CORNER_ALLOWANCE`:
// пласкі 0.012 давали 0.0035 на чотирьох роках і **0.0010** на двадцяти
// п'яти — тобто запас танув із віком пари, і помітили це лише виміром.
// ============================================================

function colony(years: number, eventCount: number) {
  const events: EvolutionEventInput[] = Array.from({ length: eventCount }, (_, index) => ({
    id: `clearance-${index}`,
    occurredAt: `${2001 + Math.floor((index / eventCount) * years)}-0${(index % 8) + 1}-14T09:00:00Z`,
    source: index % 3 === 0 ? 'memories@1' : index % 3 === 1 ? 'map@1' : 'plans@1',
    evidence: 'verified' as const,
    channels: { remembrance: 0.6, exploration: 0.4, achievement: 0.5 },
    portalActivity: 0.5,
  }));
  const artifact = buildArtifactBlueprint({
    coupleId: `colony-clearance:${years}:${eventCount}`,
    config: {
      engineVersion: '1.0.0',
      relationshipStartedAt: '2000-01-01',
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
    events,
  });
  const species = buildCrystalSpeciesBlueprint({
    artifact,
    config: { asOf: `${2000 + years}-06-04T09:00:00Z`, rulesVersion: '1.0.0' },
  });
  const growth = buildGrowthState({
    blueprint: crystalToGrowthBlueprint(species),
    config: DEFAULT_GROWTH_ENGINE_CONFIG,
  });
  const composition = buildCrystalComposition({ growth, config: DEFAULT_CRYSTAL_COMPOSITION_CONFIG });
  return buildCrystalGeometry({ growth, composition, config: DEFAULT_CRYSTAL_GEOMETRY_CONFIG });
}

/** Радіус монарха на будь-якій висоті, з її ж вершин, з інтерполяцією. */
function radiusProfile(monarch: CrystalMeshData): (y: number) => number {
  const rows: { y: number; r: number }[] = [];
  for (let index = 0; index < monarch.positions.length; index += 3) {
    const y = monarch.positions[index + 1]!;
    const r = Math.hypot(monarch.positions[index]!, monarch.positions[index + 2]!);
    const row = rows.find((candidate) => Math.abs(candidate.y - y) < 1e-6);
    if (row) row.r = Math.max(row.r, r);
    else rows.push({ y, r });
  }
  rows.sort((a, b) => a.y - b.y);
  return (y: number): number => {
    if (y <= rows[0]!.y) return rows[0]!.r;
    const last = rows[rows.length - 1]!;
    if (y >= last.y) return last.r;
    for (let index = 1; index < rows.length; index += 1) {
      const low = rows[index - 1]!;
      const high = rows[index]!;
      if (y > high.y) continue;
      const t = (y - low.y) / Math.max(1e-9, high.y - low.y);
      return low.r + (high.r - low.r) * t;
    }
    return last.r;
  };
}

const SIZES: readonly (readonly [number, number])[] = [
  [1, 6], [3, 24], [7, 40], [14, 90], [25, 160],
];

describe('кільце років стоїть впритул, але не всередині монарха', () => {
  it.each(SIZES)('на %iy жодна вершина дитини не заходить у монарха', (years, count) => {
    const geometry = colony(years, count);
    const bodies = geometry.meshes.filter((mesh) => mesh.bodyId !== CRYSTAL_SUBSTRATE_BODY_ID);
    const monarch = bodies.reduce((tallest, mesh) => (
      mesh.bounds.max.y > tallest.bounds.max.y ? mesh : tallest
    ));
    const children = bodies.filter((mesh) => mesh !== monarch);
    expect(children.length, `${years}y має бути кільце`).toBeGreaterThan(0);

    const radiusAt = radiusProfile(monarch);
    let closest = Number.POSITIVE_INFINITY;
    let where = '';
    for (const child of children) {
      for (let index = 0; index < child.positions.length; index += 3) {
        const y = child.positions[index + 1]!;
        const gap = Math.hypot(child.positions[index]!, child.positions[index + 2]!) - radiusAt(y);
        if (gap < closest) { closest = gap; where = child.bodyId; }
      }
    }
    // Строго додатний — це і є «не перетинаються».
    expect(closest, `${years}y ${where}`).toBeGreaterThan(0);
    // І з запасом, який лишає місце наступній зміні граней: виміряно
    // 0.0036–0.024 на цих п'яти розмірах.
    expect(closest, `${years}y ${where} без запасу`).toBeGreaterThan(0.002);
  });

  it('впритул — це саме впритул, а не кільце навколо', () => {
    /*
     * Другий бік того самого прохання. Без цієї межі будь-хто міг би
     * «полагодити» тісноту, розсунувши колонію, і всі перевірки вище
     * лишились би зеленими.
     *
     * Міряється на молодій колонії, де відстань задає саме монарх: на
     * старших її диктує вже посадка кільця (скільки тіл влазить у
     * коло), і це геометрія, а не рішення.
     */
    const geometry = colony(3, 24);
    const bodies = geometry.meshes.filter((mesh) => mesh.bodyId !== CRYSTAL_SUBSTRATE_BODY_ID);
    const monarch = bodies.reduce((tallest, mesh) => (
      mesh.bounds.max.y > tallest.bounds.max.y ? mesh : tallest
    ));
    const children = bodies.filter((mesh) => mesh !== monarch);
    const radiusAt = radiusProfile(monarch);

    let closest = Number.POSITIVE_INFINITY;
    let childWidth = 0;
    for (const child of children) {
      for (let index = 0; index < child.positions.length; index += 3) {
        const y = child.positions[index + 1]!;
        const gap = Math.hypot(child.positions[index]!, child.positions[index + 2]!) - radiusAt(y);
        closest = Math.min(closest, gap);
      }
      childWidth = Math.max(childWidth, (child.bounds.max.x - child.bounds.min.x));
    }
    // Просвіт — частка ширини самої дитини. Було 0.0178 при ширині
    // близько 0.042, тобто 42%; стало під 10%.
    expect(closest / childWidth, 'діти відсунулись від монарха').toBeLessThan(0.15);
  });
});
