import { describe, expect, it } from 'vitest';
import { DEFAULT_CRYSTAL_COMPOSITION_CONFIG, buildCrystalComposition } from '../composition';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../evolution';
import { DEFAULT_CRYSTAL_GEOMETRY_CONFIG, buildCrystalGeometry } from '../geometry';
import { DEFAULT_GROWTH_ENGINE_CONFIG, buildGrowthState } from '../growth';
import { DEFAULT_CRYSTAL_MATERIAL_CONFIG, buildCrystalMaterialState } from '../material';
import { buildCrystalSpeciesBlueprint, crystalToGrowthBlueprint } from '../species/crystal';
import { DEFAULT_CRYSTAL_LIFE_CONFIG } from './config';
import { buildCrystalLifeState } from './engine';
import type { CrystalLifeConfig } from './types';

const EVENTS: EvolutionEventInput[] = [
  {
    id: 'anniversary',
    occurredAt: '2025-02-14T18:00:00Z',
    source: 'calendar@1',
    evidence: 'verified',
    channels: { significance: 0.9, stability: 0.6 },
    portalActivity: 0.4,
  },
  {
    id: 'photo',
    occurredAt: '2025-09-04T12:00:00Z',
    source: 'memories@1',
    evidence: 'verified',
    channels: { remembrance: 0.6 },
    portalActivity: 0.16,
  },
];

function lifeFor(config: Partial<CrystalLifeConfig>) {
  const artifact = buildArtifactBlueprint({
    coupleId: 'life-test-couple',
    config: {
      engineVersion: '1.0.0',
      relationshipStartedAt: '2024-02-14',
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
    events: EVENTS,
  });
  const species = buildCrystalSpeciesBlueprint({
    artifact,
    config: { asOf: '2026-07-29T09:00:00Z', rulesVersion: '1.0.0' },
  });
  const growth = buildGrowthState({
    blueprint: crystalToGrowthBlueprint(species),
    config: DEFAULT_GROWTH_ENGINE_CONFIG,
  });
  const composition = buildCrystalComposition({ growth, config: DEFAULT_CRYSTAL_COMPOSITION_CONFIG });
  const geometry = buildCrystalGeometry({ growth, composition, config: DEFAULT_CRYSTAL_GEOMETRY_CONFIG });
  const material = buildCrystalMaterialState({
    species,
    composition,
    geometry,
    config: { ...DEFAULT_CRYSTAL_MATERIAL_CONFIG, quality: 'high' },
  });

  return buildCrystalLifeState({
    species,
    composition,
    material,
    config: { ...DEFAULT_CRYSTAL_LIFE_CONFIG, quality: 'high', maxSparkles: 64, ...config },
  });
}

describe('Crystal Life inner sparks (ADR-0004, crystal cluster brief §9)', () => {
  it('counts what the couple watched and read, not how many bodies exist', () => {
    // Sparkle count used to be derived from the body count. Since the body
    // count follows the calendar rather than the couple's activity, it had
    // stopped measuring anything a viewer would recognise.
    //
    // The cloud moved inside the monarch (brief §9) and this signal came with
    // it, which is the point of asserting it here: the lights are now a bounded
    // band per quality tier, and what the couple finished decides where in that
    // band they land rather than deciding the count outright.
    const none = lifeFor({ mediaFinishedCount: 0 });
    const some = lifeFor({ mediaFinishedCount: 25 });
    const many = lifeFor({ mediaFinishedCount: 169 });

    expect(none.innerSparks.length).toBeGreaterThan(0);
    expect(some.innerSparks.length).toBeGreaterThan(none.innerSparks.length);
    expect(many.innerSparks.length).toBeGreaterThan(some.innerSparks.length);
  });

  it('respects the device budget rather than the couple`s appetite', () => {
    const highEnd = lifeFor({ mediaFinishedCount: 10_000, quality: 'high', maxSparkles: 64 });
    const lowEnd = lifeFor({ mediaFinishedCount: 10_000, quality: 'low', maxSparkles: 64 });

    // The brief's bands: 24–48 on high, 8–16 on balanced, nothing below.
    expect(highEnd.innerSparks.length).toBeGreaterThanOrEqual(24);
    expect(highEnd.innerSparks.length).toBeLessThanOrEqual(48);
    expect(lowEnd.innerSparks).toHaveLength(0);
  });

  it('keeps the lights but stops them when the viewer asked for reduced motion', () => {
    // **A change of meaning, stated rather than slipped in.** Reduced motion
    // used to set the count to zero, which removed the artifact's dust
    // entirely. The lights are now inside the crystal and are part of what it
    // *is*, so stillness freezes them instead of deleting them — the same
    // treatment the inner flow gets (brief §8). What was asked for was less
    // motion, not less crystal.
    const still = lifeFor({ mediaFinishedCount: 500, reducedMotion: true });
    expect(still.innerSparks.length).toBeGreaterThan(0);
    expect(still.innerSparks.every((spark) => spark.speed === 0)).toBe(true);
    expect(still.breatheAmplitude).toBe(0);
    expect(still.breatheSpeed).toBe(0);
  });

  it('puts every light inside the monarch, never on her surface', () => {
    // A spark is an inclusion. The cloud is drawn additively over an opaque
    // shell, so a point outside the silhouette stops reading as something
    // caught in the crystal and starts reading as dust in front of it.
    for (const spark of lifeFor({ mediaFinishedCount: 400 }).innerSparks) {
      expect(spark.y).toBeGreaterThanOrEqual(0.1);
      expect(spark.y).toBeLessThanOrEqual(0.88);
      // The body narrows both ways from its widest slice, so the ceiling is a
      // function of height rather than a constant — a constant would put every
      // high spark outside the crown.
      const rising = 0.62 + 0.38 * Math.min(1, spark.y / 0.65);
      const falling = (1 - spark.y) / 0.35;
      const ceiling = 0.66 * Math.max(0, Math.min(rising, falling));
      expect(Math.hypot(spark.x, spark.z)).toBeLessThanOrEqual(ceiling + 1e-6);
    }
  });

  it('is deterministic for the same couple and the same inputs', () => {
    expect(lifeFor({ mediaFinishedCount: 169 })).toEqual(lifeFor({ mediaFinishedCount: 169 }));
  });
});
