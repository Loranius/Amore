import { describe, expect, it } from 'vitest';
import { DEFAULT_CRYSTAL_COMPOSITION_CONFIG, buildCrystalComposition } from '../composition';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../evolution';
import { DEFAULT_CRYSTAL_GEOMETRY_CONFIG, buildCrystalGeometry } from '../geometry';
import { DEFAULT_GROWTH_ENGINE_CONFIG, buildGrowthState } from '../growth';
import { buildCrystalSpeciesBlueprint, crystalToGrowthBlueprint } from '../species/crystal';
import { DEFAULT_CRYSTAL_MATERIAL_CONFIG } from './config';
import { buildCrystalMaterialState } from './engine';

/**
 * A couple whose events carry no warm channel — which is not an edge case. The
 * palette derives `secondary` as `mixRgb(primary, warmth, warmth · 0.36)`, so
 * for such a couple `secondary` **is** `primary`, and a role ladder that works
 * by mixing between the two mixes a colour with itself.
 *
 * Measured on three synthetic couples built this way: warmth came out 0 for all
 * three, and the monarch, the current year and every skirt crystal shared one
 * identical RGB — 0.7768, 0.3601, 0.5162.
 */
function pipeline() {
  const events: EvolutionEventInput[] = [];
  const sources = ['media@1', 'memories@1', 'plans@1', 'wishlist@1', 'map@1', 'calendar@1'];
  for (let index = 0; index < 80; index += 1) {
    events.push({
      id: `event-${index}`,
      occurredAt: new Date(Date.UTC(2026, 6, 1) - (index + 1) * 18 * 86400000).toISOString(),
      source: sources[index % sources.length]!,
      evidence: 'verified',
      channels: { remembrance: 0.6, significance: 0.4 },
      portalActivity: 0.3,
    });
  }
  const artifact = buildArtifactBlueprint({
    coupleId: 'colony-rank',
    config: {
      engineVersion: '1.0.0',
      relationshipStartedAt: '2022-07-01',
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
    events,
  });
  const species = buildCrystalSpeciesBlueprint({
    artifact,
    config: { asOf: '2026-07-01T00:00:00Z', rulesVersion: '1.0.0' },
  });
  const growth = buildGrowthState({
    blueprint: crystalToGrowthBlueprint(species),
    config: DEFAULT_GROWTH_ENGINE_CONFIG,
  });
  const composition = buildCrystalComposition({
    growth,
    config: DEFAULT_CRYSTAL_COMPOSITION_CONFIG,
  });
  const geometry = buildCrystalGeometry({
    growth,
    composition,
    config: DEFAULT_CRYSTAL_GEOMETRY_CONFIG,
  });
  const material = buildCrystalMaterialState({
    species,
    composition,
    geometry,
    config: DEFAULT_CRYSTAL_MATERIAL_CONFIG,
  });
  return { species, composition, material };
}

const luma = (color: { r: number; g: number; b: number }): number =>
  0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;

describe('Crystal material — rank in the colony', () => {
  it('separates the monarch from her children even with no warm channel', () => {
    const { species, composition, material } = pipeline();
    // The premise, asserted so the test cannot pass for the wrong reason.
    expect(species.pressures.warmth).toBe(0);

    const roleOf = new Map(composition.bodies.map((body) => [body.sourceBodyId, body.role]));
    const byRole = new Map<string, number[]>();
    for (const body of material.bodies) {
      const role = roleOf.get(body.bodyId);
      if (role === undefined) continue;
      byRole.set(role, [...(byRole.get(role) ?? []), luma(body.baseColor)]);
    }

    expect(byRole.size).toBeGreaterThan(1);
    const focal = byRole.get('focal')![0]!;
    for (const [role, values] of byRole) {
      if (role === 'focal') continue;
      for (const value of values) expect(value).toBeLessThan(focal);
    }
    /*
     * Ранг, а не тінь — і межі беруться з самої драбини ролей.
     *
     * `roleValue`: focal 1 → support 0.95 → family 0.92 → companion 0.88
     * → micro 0.85. Поріг стояв `> 0.08` і був виміряний «між монархом і
     * спідницею», тобто на всій драбині від focal до micro: (1−0.85)/1
     * ≈ 15%.
     *
     * Спідниці більше немає — кристал мусить бути цільним, — і колонія
     * тепер займає лише верх драбини: монарх (focal) плюс роки
     * (support для завершених, family для того, що триває). Найширший
     * можливий розмах став (1−0.92)/1 = рівно 0.08, і `> 0.08` почало
     * падати на 0.0799997 — не через колір, а через те, що зникла
     * найтемніша сходинка.
     *
     * Тож нижня межа — один ПОВНИЙ щабель драбини, а не число з
     * попередньої конфігурації колонії. Верхня лишається: якщо розмах
     * колись перевищить чверть, це вже не ранг, а тінь.
     */
    const all = [...byRole.values()].flat();
    const spread = (Math.max(...all) - Math.min(...all)) / Math.max(...all);
    const FULL_RUNG = 0.08 - 1e-6;
    expect(spread).toBeGreaterThanOrEqual(FULL_RUNG);
    expect(spread).toBeLessThan(0.25);
  });

  it('keeps the albedo cap doing its own job', () => {
    // The cap exists so no body sits in the shoulder of the tone curve, where a
    // difference in illumination stops being a difference in pixels. The rank
    // step descends from it and must never climb above it — which is exactly
    // what went wrong the other way round: the step used to be applied *inside*
    // the cap, and the cap divided it straight back out.
    const { composition, material } = pipeline();
    // The substrate is not a colony member and carries its own recipe.
    const ranked = new Set(composition.bodies.map((body) => body.sourceBodyId));
    const bodies = material.bodies.filter((body) => ranked.has(body.bodyId));
    expect(bodies.length).toBeGreaterThan(1);
    for (const body of bodies) {
      // The published channels are rounded to six places, so the cap holds to
      // that precision and not to float exactness.
      expect(luma(body.baseColor)).toBeLessThanOrEqual(0.46 + 1e-6);
    }
  });
});
