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

describe('Crystal Life sparkles (ADR-0004)', () => {
  it('counts what the couple watched and read, not how many bodies exist', () => {
    // Sparkle count used to be derived from the body count. Since the body
    // count follows the calendar rather than the couple's activity, it had
    // stopped measuring anything a viewer would recognise.
    const none = lifeFor({ mediaFinishedCount: 0 });
    const some = lifeFor({ mediaFinishedCount: 25 });
    const many = lifeFor({ mediaFinishedCount: 169 });

    expect(none.sparkleCount).toBeGreaterThan(0);
    expect(some.sparkleCount).toBeGreaterThan(none.sparkleCount);
    expect(many.sparkleCount).toBeGreaterThan(some.sparkleCount);
  });

  it('respects the device budget rather than the couple`s appetite', () => {
    const highEnd = lifeFor({ mediaFinishedCount: 10_000, quality: 'high', maxSparkles: 64 });
    const lowEnd = lifeFor({ mediaFinishedCount: 10_000, quality: 'low', maxSparkles: 64 });

    expect(highEnd.sparkleCount).toBeLessThanOrEqual(64);
    expect(lowEnd.sparkleCount).toBeLessThan(highEnd.sparkleCount);
  });

  it('stops entirely when the viewer asked for reduced motion', () => {
    const still = lifeFor({ mediaFinishedCount: 500, reducedMotion: true });
    expect(still.sparkleCount).toBe(0);
    expect(still.rotationSpeed).toBe(0);
  });

  it('is deterministic for the same couple and the same inputs', () => {
    expect(lifeFor({ mediaFinishedCount: 169 })).toEqual(lifeFor({ mediaFinishedCount: 169 }));
  });
});
