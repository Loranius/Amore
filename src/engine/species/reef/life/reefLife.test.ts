import { describe, expect, it } from 'vitest';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../../../evolution';
import { REEF_COLONY_MORPHOTYPES, type ReefColonyMorphotype } from '../types';
import { buildReefSpeciesBlueprint } from '../reefSpecies';
import { buildReefColonyLayout } from '../layout';
import { buildReefFoundationMesh } from '../foundation';
import { buildReefColonySkeletons } from '../skeletons';
import { buildReefColonyMeshes, type ReefColonyMeshBatch } from '../meshes';
import { buildReefMaterials, type ReefColonyMaterialAssignment } from '../materials';
import { DEFAULT_REEF_LIFE_CONFIG } from './config';
import { buildReefLife } from './reefLife';
import type { ReefColonyMotionBinding, ReefLifeState } from './types';

const MORPHOTYPE_EVENTS: EvolutionEventInput[] = [
  {
    id: 'stability:home',
    occurredAt: '2024-01-12',
    source: 'plans@1',
    evidence: 'verified',
    channels: { stability: 0.92 },
    portalActivity: 0.18,
  },
  {
    id: 'memory:album',
    occurredAt: '2024-03-14',
    source: 'memories@1',
    evidence: 'verified',
    channels: { remembrance: 0.9, culture: 0.1 },
    portalActivity: 0.22,
  },
  {
    id: 'achievement:goal',
    occurredAt: '2024-05-18',
    source: 'plans@1',
    evidence: 'verified',
    channels: { achievement: 0.92, stability: 0.12 },
    portalActivity: 0.24,
  },
  {
    id: 'exploration:lviv',
    occurredAt: '2024-07-20',
    source: 'map@1',
    evidence: 'verified',
    channels: { exploration: 0.94, remembrance: 0.16 },
    portalActivity: 0.26,
  },
  {
    id: 'culture:quiet-concert',
    occurredAt: '2024-09-10',
    source: 'calendar@1',
    evidence: 'verified',
    channels: { culture: 0.9, significance: 0.2 },
    portalActivity: 0.2,
  },
  {
    id: 'culture:landmark-concert',
    occurredAt: '2024-11-22',
    source: 'calendar@1',
    evidence: 'verified',
    channels: { culture: 0.94, significance: 0.8 },
    portalActivity: 0.32,
  },
];

function buildPipeline(
  events: readonly EvolutionEventInput[] = MORPHOTYPE_EVENTS,
  asOf = '2026-07-01',
) {
  const artifact = buildArtifactBlueprint({
    coupleId: 'amore:reef-life-test-couple',
    config: {
      engineVersion: '1.0.0',
      relationshipStartedAt: '2024-01-01',
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
    events,
  });
  const species = buildReefSpeciesBlueprint({
    artifact,
    config: { asOf, rulesVersion: 'reef-species-v1.0.0' },
  });
  const layout = buildReefColonyLayout({ species });
  const foundation = buildReefFoundationMesh({ species, layout });
  const skeletons = buildReefColonySkeletons({ species, layout, foundation });
  const meshes = buildReefColonyMeshes({ species, layout, foundation, skeletons });
  const materials = buildReefMaterials({ species, layout, foundation, skeletons, meshes });
  const life = buildReefLife({
    species,
    layout,
    foundation,
    skeletons,
    meshes,
    materials,
  });
  return { species, layout, foundation, skeletons, meshes, materials, life };
}

function vectorLength(value: { x: number; y: number; z: number }): number {
  return Math.hypot(value.x, value.y, value.z);
}

function bindingByColonyId(state: ReefLifeState, colonyId: string) {
  return state.bindings.find((binding) => binding.colonyId === colonyId) ?? null;
}

function expectBindingBounded(binding: ReefColonyMotionBinding): void {
  expect(vectorLength(binding.axis)).toBeCloseTo(1, 4);
  expect(vectorLength(binding.responseDirection)).toBeCloseTo(1, 4);
  expect(binding.currentInfluence).toBeGreaterThanOrEqual(0);
  expect(binding.currentInfluence).toBeLessThanOrEqual(1);
  expect(binding.swayAmplitudeRadians).toBeGreaterThanOrEqual(0);
  expect(binding.swayAmplitudeRadians).toBeLessThanOrEqual(
    DEFAULT_REEF_LIFE_CONFIG.maximumSwayRadians,
  );
  expect(binding.swayFrequencyHz).toBeGreaterThan(0);
  expect(binding.polyp.coverage).toBeGreaterThanOrEqual(0);
  expect(binding.polyp.coverage).toBeLessThanOrEqual(1);
  expect(binding.polyp.extension).toBeGreaterThanOrEqual(0);
  expect(binding.polyp.extension).toBeLessThanOrEqual(1);
  expect(binding.polyp.pulseAmplitude).toBeGreaterThanOrEqual(0);
  expect(binding.polyp.pulseAmplitude).toBeLessThanOrEqual(
    DEFAULT_REEF_LIFE_CONFIG.maximumPolypPulseAmplitude,
  );
}

describe('Reef Species Phase 7 Reef Life', () => {
  it('is deterministic, immutable and publishes motion intent without renderer side effects', () => {
    const { species, layout, foundation, skeletons, meshes, materials } = buildPipeline();
    const speciesBefore = structuredClone(species);
    const layoutBefore = structuredClone(layout);
    const foundationBefore = structuredClone(foundation);
    const skeletonsBefore = structuredClone(skeletons);
    const meshesBefore = structuredClone(meshes);
    const materialsBefore = structuredClone(materials);
    const first = buildReefLife({ species, layout, foundation, skeletons, meshes, materials });
    const second = buildReefLife({ species, layout, foundation, skeletons, meshes, materials });

    expect(second).toEqual(first);
    expect(species).toEqual(speciesBefore);
    expect(layout).toEqual(layoutBefore);
    expect(foundation).toEqual(foundationBefore);
    expect(skeletons).toEqual(skeletonsBefore);
    expect(meshes).toEqual(meshesBefore);
    expect(materials).toEqual(materialsBefore);
    expect(first.descriptor.id).toBe('reef:life');
    expect(first.diagnostics.missingRangeIds).toEqual([]);
    expect(first.diagnostics.missingMaterialBindingIds).toEqual([]);
    expect(first.diagnostics.orphanMaterialBindingIds).toEqual([]);
    expect(first.diagnostics.invalidBindingIds).toEqual([]);
    expect(first.diagnostics.newDrawCalls).toBe(0);
    expect(first.diagnostics.geometryMutations).toBe(0);
    expect(first.diagnostics.materialIdentityMutations).toBe(0);
    expect(first.diagnostics.rendererCallbacks).toBe(0);
    expect(first.diagnostics.databaseReads).toBe(0);
    expect(first.diagnostics.databaseWrites).toBe(0);
  });

  it('binds every mesh range and material binding exactly once', () => {
    const { meshes, materials, life } = buildPipeline();
    const ranges = meshes.batches.flatMap((batch: ReefColonyMeshBatch) => batch.ranges);
    const materialBindings = materials.colonies.flatMap(
      (material: ReefColonyMaterialAssignment) => material.bindings,
    );

    expect(life.bindings).toHaveLength(ranges.length);
    expect(life.bindings).toHaveLength(materialBindings.length);
    expect(life.diagnostics.motionBindingCount).toBe(ranges.length);
    expect(life.diagnostics.motionBindingBudgetExceeded).toBe(false);
    expect(new Set(life.bindings.map((binding) => binding.id)).size).toBe(life.bindings.length);
    expect(new Set(life.bindings.map((binding) => binding.sourceRangeId)).size).toBe(ranges.length);
    expect(new Set(life.bindings.map((binding) => binding.sourceMaterialBindingId)).size)
      .toBe(materialBindings.length);
    expect(vectorLength(life.current.direction)).toBeCloseTo(1, 4);
    expect(life.current.strength).toBeGreaterThanOrEqual(0);
    expect(life.current.strength).toBeLessThanOrEqual(1);
    for (const binding of life.bindings) expectBindingBounded(binding);
  });

  it('keeps rigid colonies restrained while flexible tissue responds visibly to current', () => {
    const { life } = buildPipeline();
    const byMorphotype = new Map(
      REEF_COLONY_MORPHOTYPES.map((morphotype) => [
        morphotype,
        life.bindings.filter((binding) => binding.morphotype === morphotype),
      ] as const),
    );

    for (const morphotype of REEF_COLONY_MORPHOTYPES) {
      expect(byMorphotype.get(morphotype)?.length ?? 0).toBeGreaterThan(0);
    }
    const maximumAmplitude = (morphotype: ReefColonyMorphotype): number =>
      Math.max(...(byMorphotype.get(morphotype) ?? []).map((binding) => binding.swayAmplitudeRadians));

    expect(maximumAmplitude('soft-coral')).toBeGreaterThan(maximumAmplitude('branching'));
    expect(maximumAmplitude('sea-fan')).toBeGreaterThan(maximumAmplitude('plating'));
    expect(maximumAmplitude('massive')).toBeLessThan(0.01);
    expect(maximumAmplitude('encrusting')).toBeLessThan(0.01);
  });

  it('publishes an explicit fully static reduced-motion profile for every colony', () => {
    const { life } = buildPipeline();

    expect(life.diagnostics.reducedMotionStaticBindingCount).toBe(life.bindings.length);
    for (const binding of life.bindings) {
      expect(binding.reducedMotion).toEqual({
        mode: 'static',
        swayAmplitudeRadians: 0,
        polypPulseAmplitude: 0,
        timeScale: 0,
        staticPhaseRadians: binding.phaseRadians,
      });
    }
  });

  it('preserves current and previous colony motion byte-for-byte when history is appended', () => {
    const base = buildPipeline(MORPHOTYPE_EVENTS.slice(0, 4));
    const extended = buildPipeline([
      ...MORPHOTYPE_EVENTS.slice(0, 4),
      {
        id: 'culture:later-memory',
        occurredAt: '2026-06-10',
        source: 'memories@1',
        evidence: 'verified',
        channels: { culture: 0.62, remembrance: 0.18 },
        portalActivity: 0.12,
      },
    ]);

    expect(extended.life.current).toEqual(base.life.current);
    for (const colony of base.layout.colonies) {
      expect(bindingByColonyId(extended.life, colony.id)).toEqual(
        bindingByColonyId(base.life, colony.id),
      );
    }
    expect(extended.life.bindings.length).toBeGreaterThan(base.life.bindings.length);
  });

  it('reports motion budgets without truncating stable bindings', () => {
    const { species, layout, foundation, skeletons, meshes, materials, life: full } = buildPipeline();
    const constrained = buildReefLife({
      species,
      layout,
      foundation,
      skeletons,
      meshes,
      materials,
      config: {
        ...DEFAULT_REEF_LIFE_CONFIG,
        rulesVersion: 'reef-life-test-constrained',
        maximumMotionBindings: 1,
      },
    });

    expect(constrained.current).toEqual(full.current);
    expect(constrained.bindings).toEqual(full.bindings);
    expect(constrained.diagnostics.motionBindingBudgetExceeded).toBe(true);
    expect(constrained.diagnostics.motionBindingCount).toBeGreaterThan(1);
  });

  it('rejects invalid configuration and incompatible provenance', () => {
    const { species, layout, foundation, skeletons, meshes, materials } = buildPipeline();
    expect(() => buildReefLife({
      species,
      layout,
      foundation,
      skeletons,
      meshes,
      materials,
      config: { ...DEFAULT_REEF_LIFE_CONFIG, rulesVersion: '   ' },
    })).toThrow('non-empty rulesVersion');
    expect(() => buildReefLife({
      species,
      layout,
      foundation,
      skeletons,
      meshes,
      materials,
      config: { ...DEFAULT_REEF_LIFE_CONFIG, maximumMotionBindings: 0 },
    })).toThrow('maximumMotionBindings');
    expect(() => buildReefLife({
      species,
      layout: { ...layout, artifactSeed: layout.artifactSeed + 1 },
      foundation,
      skeletons,
      meshes,
      materials,
    })).toThrow('incompatible Colony Layout provenance');
    expect(() => buildReefLife({
      species,
      layout,
      foundation,
      skeletons,
      meshes,
      materials: { ...materials, sourceColonyMeshRulesVersion: 'wrong-version' },
    })).toThrow('incompatible Material provenance');
  });
});
