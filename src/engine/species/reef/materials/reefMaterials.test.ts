import { describe, expect, it } from 'vitest';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../../../evolution';
import { REEF_COLONY_MORPHOTYPES } from '../types';
import { buildReefSpeciesBlueprint } from '../reefSpecies';
import { buildReefColonyLayout } from '../layout';
import { buildReefFoundationMesh } from '../foundation';
import { buildReefColonySkeletons } from '../skeletons';
import { buildReefColonyMeshes } from '../meshes';
import { DEFAULT_REEF_MATERIAL_CONFIG } from './config';
import { buildReefMaterials } from './reefMaterials';
import type { ReefMaterialColor, ReefMaterialState, ReefSurfaceResponse } from './types';

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
    coupleId: 'amore:reef-material-test-couple',
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
  return { species, layout, foundation, skeletons, meshes, materials };
}

function expectColorBounded(color: ReefMaterialColor): void {
  for (const component of [color.r, color.g, color.b]) {
    expect(Number.isFinite(component)).toBe(true);
    expect(component).toBeGreaterThanOrEqual(0);
    expect(component).toBeLessThanOrEqual(1);
  }
}

function expectResponseBounded(response: ReefSurfaceResponse): void {
  for (const value of [
    response.roughness,
    response.metalness,
    response.clearcoat,
    response.clearcoatRoughness,
    response.sheen,
    response.sheenRoughness,
    response.transmission,
    response.opacity,
    response.subsurfaceStrength,
    response.emissiveStrength,
  ]) {
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(1);
  }
  expect(response.thickness).toBeGreaterThanOrEqual(0);
  expect(response.thickness).toBeLessThanOrEqual(2);
  expect(response.ior).toBeGreaterThanOrEqual(1);
  expect(response.ior).toBeLessThanOrEqual(2.5);
}

function bindingSnapshot(state: ReefMaterialState, colonyId: string) {
  for (const material of state.colonies) {
    const binding = material.bindings.find((candidate) => candidate.colonyId === colonyId);
    if (binding) return binding;
  }
  return null;
}

function materialProfileSnapshot(state: ReefMaterialState) {
  return state.colonies.map((material) => ({
    id: material.id,
    slot: material.slot,
    sourceBatchId: material.sourceBatchId,
    morphotype: material.morphotype,
    role: material.role,
    palette: material.palette,
    response: material.response,
  }));
}

describe('Reef Species Phase 6 Materials', () => {
  it('is deterministic, immutable and adds only renderer-independent material data', () => {
    const { species, layout, foundation, skeletons, meshes } = buildPipeline();
    const speciesBefore = structuredClone(species);
    const layoutBefore = structuredClone(layout);
    const foundationBefore = structuredClone(foundation);
    const skeletonsBefore = structuredClone(skeletons);
    const meshesBefore = structuredClone(meshes);
    const first = buildReefMaterials({ species, layout, foundation, skeletons, meshes });
    const second = buildReefMaterials({ species, layout, foundation, skeletons, meshes });

    expect(second).toEqual(first);
    expect(species).toEqual(speciesBefore);
    expect(layout).toEqual(layoutBefore);
    expect(foundation).toEqual(foundationBefore);
    expect(skeletons).toEqual(skeletonsBefore);
    expect(meshes).toEqual(meshesBefore);
    expect(first.descriptor.id).toBe('reef:materials');
    expect(first.diagnostics.missingMorphotypeBatches).toEqual([]);
    expect(first.diagnostics.batchIdsWithoutMaterial).toEqual([]);
    expect(first.diagnostics.rangeIdsWithoutBinding).toEqual([]);
    expect(first.diagnostics.colonyIdsWithoutRange).toEqual([]);
    expect(first.diagnostics.nonFiniteColorIds).toEqual([]);
    expect(first.diagnostics.outOfBoundsResponseIds).toEqual([]);
    expect(first.diagnostics.textureSlots).toBe(0);
    expect(first.diagnostics.shaderPrograms).toBe(0);
    expect(first.diagnostics.perFrameUpdates).toBe(0);
  });

  it('publishes one bounded slot for the foundation and one for every morphotype', () => {
    const { materials } = buildPipeline();

    expect(materials.foundation.slot).toBe(0);
    expect(materials.foundation.role).toBe('substrate-rock');
    expect(materials.colonies).toHaveLength(REEF_COLONY_MORPHOTYPES.length);
    expect(materials.diagnostics.materialSlotCount).toBe(7);
    expect(materials.diagnostics.estimatedDrawCalls).toBe(7);
    expect(materials.diagnostics.materialBudgetExceeded).toBe(false);
    expect(new Set(materials.colonies.map((material) => material.role)).size).toBe(
      REEF_COLONY_MORPHOTYPES.length,
    );

    for (const palette of [
      materials.foundation.palette,
      ...materials.colonies.map((material) => material.palette),
    ]) {
      expectColorBounded(palette.baseColor);
      expectColorBounded(palette.highlightColor);
      expectColorBounded(palette.shadowColor);
      expectColorBounded(palette.subsurfaceColor);
    }
    expectResponseBounded(materials.foundation.response);
    for (const material of materials.colonies) {
      expectResponseBounded(material.response);
      expect(material.slot).toBe(REEF_COLONY_MORPHOTYPES.indexOf(material.morphotype) + 1);
    }
  });

  it('binds every colony range without allocating per-colony material slots', () => {
    const { layout, meshes, materials } = buildPipeline();
    const coloniesById = new Map(layout.colonies.map((colony) => [colony.id, colony] as const));
    const ranges = meshes.batches.flatMap((batch) => batch.ranges);
    const bindings = materials.colonies.flatMap((material) => material.bindings);

    expect(bindings).toHaveLength(ranges.length);
    expect(materials.diagnostics.rangeBindingCount).toBe(ranges.length);
    expect(materials.diagnostics.rangeBindingBudgetExceeded).toBe(false);
    expect(new Set(bindings.map((binding) => binding.id)).size).toBe(bindings.length);
    expect(new Set(bindings.map((binding) => binding.sourceRangeId)).size).toBe(ranges.length);
    for (const binding of bindings) {
      const colony = coloniesById.get(binding.colonyId);
      expect(colony).toBeDefined();
      expect(binding.morphotype).toBe(colony?.morphotype);
      expect(binding.colonyRole).toBe(colony?.role);
      expect(binding.colonyTier).toBe(colony?.tier);
      expect(binding.emphasized).toBe(colony?.emphasized);
      expectColorBounded(binding.tintColor);
      expect(binding.tintStrength).toBeGreaterThanOrEqual(0);
      expect(binding.tintStrength).toBeLessThanOrEqual(1);
    }
  });

  it('preserves previous material profiles and colony bindings when later history is appended', () => {
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

    expect(extended.materials.foundation).toEqual(base.materials.foundation);
    const extendedProfiles = new Map(
      materialProfileSnapshot(extended.materials).map((profile) => [profile.morphotype, profile] as const),
    );
    for (const profile of materialProfileSnapshot(base.materials)) {
      expect(extendedProfiles.get(profile.morphotype)).toEqual(profile);
    }
    for (const colony of base.layout.colonies) {
      expect(bindingSnapshot(extended.materials, colony.id)).toEqual(
        bindingSnapshot(base.materials, colony.id),
      );
    }
    expect(extended.materials.diagnostics.rangeBindingCount).toBeGreaterThan(
      base.materials.diagnostics.rangeBindingCount,
    );
  });

  it('reports material budgets without truncating assignments or bindings', () => {
    const { species, layout, foundation, skeletons, meshes, materials: full } = buildPipeline();
    const constrained = buildReefMaterials({
      species,
      layout,
      foundation,
      skeletons,
      meshes,
      config: {
        ...DEFAULT_REEF_MATERIAL_CONFIG,
        rulesVersion: 'reef-materials-test-constrained',
        maximumMaterialSlots: 1,
        maximumRangeBindings: 1,
      },
    });

    expect(constrained.foundation).toEqual(full.foundation);
    expect(constrained.colonies).toEqual(full.colonies);
    expect(constrained.diagnostics.materialBudgetExceeded).toBe(true);
    expect(constrained.diagnostics.rangeBindingBudgetExceeded).toBe(true);
    expect(constrained.diagnostics.materialSlotCount).toBe(7);
    expect(constrained.diagnostics.rangeBindingCount).toBeGreaterThan(1);
  });

  it('rejects invalid configuration and incompatible provenance', () => {
    const { species, layout, foundation, skeletons, meshes } = buildPipeline();
    expect(() => buildReefMaterials({
      species,
      layout,
      foundation,
      skeletons,
      meshes,
      config: { ...DEFAULT_REEF_MATERIAL_CONFIG, rulesVersion: '   ' },
    })).toThrow('non-empty rulesVersion');
    expect(() => buildReefMaterials({
      species,
      layout,
      foundation,
      skeletons,
      meshes,
      config: { ...DEFAULT_REEF_MATERIAL_CONFIG, maximumMaterialSlots: 0 },
    })).toThrow('maximumMaterialSlots');
    expect(() => buildReefMaterials({
      species,
      layout: { ...layout, artifactSeed: layout.artifactSeed + 1 },
      foundation,
      skeletons,
      meshes,
    })).toThrow('incompatible Colony Layout provenance');
    expect(() => buildReefMaterials({
      species,
      layout,
      foundation,
      skeletons,
      meshes: { ...meshes, sourceColonySkeletonRulesVersion: 'wrong-version' },
    })).toThrow('incompatible Colony Mesh provenance');
  });
});
