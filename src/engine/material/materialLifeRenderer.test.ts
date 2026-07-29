import { describe, expect, it } from 'vitest';
import { DEFAULT_CRYSTAL_COMPOSITION_CONFIG, buildCrystalComposition } from '../composition';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../evolution';
import { DEFAULT_CRYSTAL_GEOMETRY_CONFIG, buildCrystalGeometry } from '../geometry';
import { DEFAULT_GROWTH_ENGINE_CONFIG, buildGrowthState } from '../growth';
import { DEFAULT_CRYSTAL_LIFE_CONFIG, buildCrystalLifeState, sampleCrystalLife } from '../life';
import { createThreeCrystalRenderBundle, applyCrystalLifeFrame } from '../renderer/three';
import { buildCrystalSpeciesBlueprint, crystalToGrowthBlueprint } from '../species/crystal';
import { DEFAULT_CRYSTAL_MATERIAL_CONFIG } from './config';
import { buildCrystalMaterialState } from './engine';

const EVENTS: EvolutionEventInput[] = [
  {
    id: 'proposal',
    occurredAt: '2024-02-14T18:00:00Z',
    source: 'calendar@1',
    evidence: 'verified',
    channels: { significance: 1, stability: 0.72, remembrance: 0.58 },
    portalActivity: 0.5,
  },
  {
    id: 'trip',
    occurredAt: '2024-06-10T10:00:00Z',
    source: 'plans@1',
    evidence: 'verified',
    channels: { exploration: 0.92, remembrance: 0.36 },
    portalActivity: 0.3,
  },
  ...Array.from({ length: 7 }, (_, index): EvolutionEventInput => ({
    id: `photo-day-${index + 1}`,
    occurredAt: `2025-0${(index % 7) + 1}-04T12:00:00Z`,
    source: 'memories@1',
    evidence: 'verified',
    channels: { remembrance: 0.64, culture: 0.22 },
    portalActivity: 0.16,
  })),
];

function pipeline(options?: { reducedMotion?: boolean; quality?: 'high' | 'balanced' | 'low' | 'fallback' }) {
  const artifact = buildArtifactBlueprint({
    coupleId: 'material-life-couple',
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
    config: { asOf: '2026-07-29T12:00:00Z', rulesVersion: '1.0.0' },
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
  const quality = options?.quality ?? 'balanced';
  const material = buildCrystalMaterialState({
    species,
    composition,
    geometry,
    config: { ...DEFAULT_CRYSTAL_MATERIAL_CONFIG, quality },
  });
  const life = buildCrystalLifeState({
    species,
    composition,
    material,
    config: {
      ...DEFAULT_CRYSTAL_LIFE_CONFIG,
      quality,
      reducedMotion: options?.reducedMotion ?? false,
    },
  });
  return { species, growth, composition, geometry, material, life };
}

describe('Crystal Material, Life and Three renderer bridge', () => {
  it('is deterministic and never enables transmission or transparent shells', () => {
    const first = pipeline();
    const second = pipeline();

    expect(second.material).toEqual(first.material);
    expect(second.life).toEqual(first.life);
    expect(first.material.diagnostics.transmissionForcedOff).toBe(true);
    expect(first.material.bodies).toHaveLength(first.geometry.meshes.length);
    expect(first.material.diagnostics.uniqueMaterialCount).toBeLessThan(first.material.bodies.length);
    for (const body of first.material.bodies) {
      expect(body.transmission).toBe(0);
      expect(body.opacity).toBe(1);
      expect(body.transparent).toBe(false);
      expect(body.depthWrite).toBe(true);
      expect(body.signature.length).toBeGreaterThan(20);
    }
  });

  it('degrades expensive optics and ambient motion through quality tiers', () => {
    const high = pipeline({ quality: 'high' });
    const fallback = pipeline({ quality: 'fallback' });

    expect(high.material.bodies.some((body) => body.iridescence > 0)).toBe(true);
    expect(high.life.sparkleCount).toBeGreaterThan(0);
    for (const body of fallback.material.bodies) {
      expect(body.iridescence).toBe(0);
      expect(body.shader.rimStrength).toBe(0);
      expect(body.shader.skyStrength).toBe(0);
      expect(body.shader.inclusionDensity).toBe(0);
    }
    expect(fallback.life.sparkleCount).toBe(0);
    expect(fallback.life.rotationSpeed).toBe(0);
  });

  it('freezes continuous motion under reduced-motion while preserving a subtle glow response', () => {
    const { life } = pipeline({ reducedMotion: true });
    const first = sampleCrystalLife({ life, elapsedSeconds: 0, interactionPulse: 0 });
    const later = sampleCrystalLife({ life, elapsedSeconds: 100, interactionPulse: 0 });
    const touched = sampleCrystalLife({ life, elapsedSeconds: 100, interactionPulse: 1 });

    expect(later).toEqual(first);
    expect(first.rotationY).toBe(0);
    expect(first.positionY).toBe(0);
    expect(first.groupScale).toBe(1);
    expect(touched.rotationY).toBe(0);
    expect(touched.positionY).toBe(0);
    expect(touched.groupScale).toBe(1);
    expect(Object.values(touched.bodyGlowMultiplier).some((value) => value > 1)).toBe(true);
  });

  it('batches different geometries by optical signature', () => {
    const { geometry, material, life } = pipeline();
    const bundle = createThreeCrystalRenderBundle(geometry, material);
    const frame = sampleCrystalLife({ life, elapsedSeconds: 12.5, interactionPulse: 0.4 });
    applyCrystalLifeFrame(bundle, frame);

    expect(bundle.meshes.size).toBe(geometry.meshes.length);
    expect(bundle.materials.size).toBe(material.bodies.length);
    expect(bundle.drawCallCount).toBe(material.diagnostics.uniqueMaterialCount);
    expect(bundle.drawCallCount).toBe(bundle.batches.length);
    expect(bundle.drawCallCount).toBeLessThan(geometry.meshes.length);
    expect(bundle.group.children).toHaveLength(bundle.drawCallCount);
    expect(bundle.group.rotation.y).toBeCloseTo(frame.rotationY, 6);
    expect(bundle.group.position.y).toBeCloseTo(frame.positionY, 6);

    const uniqueMeshes = new Set(bundle.meshes.values());
    const uniqueMaterials = new Set(bundle.materials.values());
    expect(uniqueMeshes.size).toBe(bundle.drawCallCount);
    expect(uniqueMaterials.size).toBe(bundle.drawCallCount);

    for (const batch of bundle.batches) {
      expect(batch.bodyIds.length).toBeGreaterThan(0);
      expect(batch.material.transmission).toBe(0);
      expect(batch.material.transparent).toBe(false);
      expect(batch.mesh.userData['evolutionBodyIds']).toEqual(batch.bodyIds);
    }

    bundle.dispose();
    expect(bundle.group.children).toHaveLength(0);
  });

  it('does not mutate species, composition or geometry states', () => {
    const current = pipeline();
    const speciesBefore = JSON.stringify(current.species);
    const compositionBefore = JSON.stringify(current.composition);
    const geometryBefore = JSON.stringify(current.geometry);

    buildCrystalMaterialState({
      species: current.species,
      composition: current.composition,
      geometry: current.geometry,
      config: DEFAULT_CRYSTAL_MATERIAL_CONFIG,
    });

    expect(JSON.stringify(current.species)).toBe(speciesBefore);
    expect(JSON.stringify(current.composition)).toBe(compositionBefore);
    expect(JSON.stringify(current.geometry)).toBe(geometryBefore);
  });
});
