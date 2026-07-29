import { describe, expect, it } from 'vitest';
import { DEFAULT_CRYSTAL_COMPOSITION_CONFIG, buildCrystalComposition } from '../composition';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../evolution';
import { DEFAULT_GROWTH_ENGINE_CONFIG, buildGrowthState } from '../growth';
import { buildCrystalSpeciesBlueprint, crystalToGrowthBlueprint } from '../species/crystal';
import { DEFAULT_CRYSTAL_GEOMETRY_CONFIG } from './config';
import { buildCrystalGeometry } from './engine';
import type { CrystalGeometryConfig } from './types';

const BASE_EVENTS: EvolutionEventInput[] = [
  {
    id: 'proposal',
    occurredAt: '2024-02-14T18:00:00Z',
    source: 'calendar@1',
    evidence: 'verified',
    channels: { significance: 1, stability: 0.72, remembrance: 0.58 },
    portalActivity: 0.5,
  },
  {
    id: 'first-trip',
    occurredAt: '2024-06-10T10:00:00Z',
    source: 'plans@1',
    evidence: 'verified',
    channels: { exploration: 0.92, remembrance: 0.36 },
    portalActivity: 0.3,
  },
  {
    id: 'photo-day',
    occurredAt: '2024-09-04T12:00:00Z',
    source: 'memories@1',
    evidence: 'verified',
    channels: { remembrance: 0.64, culture: 0.22 },
    portalActivity: 0.16,
  },
  {
    id: 'anniversary-one',
    occurredAt: '2025-02-14T18:00:00Z',
    source: 'calendar@1',
    evidence: 'verified',
    channels: { stability: 0.74, significance: 0.6, remembrance: 0.48 },
    portalActivity: 0.22,
  },
];

function pipeline(
  events: readonly EvolutionEventInput[],
  geometryConfig: CrystalGeometryConfig = DEFAULT_CRYSTAL_GEOMETRY_CONFIG,
) {
  const artifact = buildArtifactBlueprint({
    coupleId: 'geometry-couple',
    config: {
      engineVersion: '1.0.0',
      relationshipStartedAt: '2024-02-14',
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
    events,
  });
  const species = buildCrystalSpeciesBlueprint({
    artifact,
    config: { asOf: '2026-07-29T09:00:00Z', rulesVersion: '1.0.0' },
  });
  const growth = buildGrowthState({
    blueprint: crystalToGrowthBlueprint(species),
    config: DEFAULT_GROWTH_ENGINE_CONFIG,
  });
  const composition = buildCrystalComposition({
    growth,
    config: DEFAULT_CRYSTAL_COMPOSITION_CONFIG,
  });
  const geometry = buildCrystalGeometry({ growth, composition, config: geometryConfig });
  return { growth, composition, geometry };
}

describe('Crystal Geometry', () => {
  it('is deterministic and leaves upstream states immutable', () => {
    const firstPipeline = pipeline(BASE_EVENTS);
    const growthBefore = JSON.stringify(firstPipeline.growth);
    const compositionBefore = JSON.stringify(firstPipeline.composition);
    const repeated = buildCrystalGeometry({
      growth: firstPipeline.growth,
      composition: firstPipeline.composition,
      config: DEFAULT_CRYSTAL_GEOMETRY_CONFIG,
    });

    expect(repeated).toEqual(firstPipeline.geometry);
    expect(JSON.stringify(firstPipeline.growth)).toBe(growthBefore);
    expect(JSON.stringify(firstPipeline.composition)).toBe(compositionBefore);
  });

  it('produces valid indexed meshes and one junction per attached body', () => {
    const { growth, geometry } = pipeline(BASE_EVENTS);

    expect(geometry.meshes).toHaveLength(growth.bodies.length);
    expect(geometry.junctions).toHaveLength(growth.bodies.length - 1);
    expect(geometry.diagnostics.budgetOmittedBodyIds).toEqual([]);
    expect(geometry.diagnostics.nonFiniteBodyIds).toEqual([]);
    expect(geometry.diagnostics.meshesWithoutVisibleTriangles).toEqual([]);

    for (const mesh of geometry.meshes) {
      const vertexCount = mesh.positions.length / 3;
      expect(mesh.positions.length % 3).toBe(0);
      expect(mesh.normals).toHaveLength(mesh.positions.length);
      expect(mesh.indices.length % 3).toBe(0);
      expect(mesh.visibleTriangleCount).toBe(mesh.indices.length / 3);
      expect(mesh.visibleTriangleCount).toBeGreaterThan(0);
      expect(mesh.indices.every((index) => index >= 0 && index < vertexCount)).toBe(true);
      expect(mesh.positions.every(Number.isFinite)).toBe(true);
      expect(mesh.normals.every(Number.isFinite)).toBe(true);
      if (mesh.hostBodyId !== null) {
        expect(mesh.baseCapRemoved).toBe(true);
        expect(mesh.removedTriangleCount).toBeGreaterThanOrEqual(mesh.baseCapTriangleCount);
      }
    }
  });

  it('publishes sealed bounded junctions', () => {
    const { geometry } = pipeline(BASE_EVENTS);

    expect(geometry.diagnostics.unsealedJunctionIds).toEqual([]);
    for (const junction of geometry.junctions) {
      expect(junction.sealed).toBe(true);
      expect(junction.contactRadius).toBeGreaterThan(0);
      expect(junction.penetrationDepth).toBeGreaterThan(0);
      expect(junction.clearanceRadius).toBeGreaterThan(junction.contactRadius);
      expect(junction.materialBlendWidth).toBeGreaterThan(0);
    }
  });

  it('keeps old profile signatures and vertex positions stable after append', () => {
    const earlier = pipeline(BASE_EVENTS).geometry;
    const later = pipeline([
      ...BASE_EVENTS,
      {
        id: 'fulfilled-dream',
        occurredAt: '2026-05-20T12:00:00Z',
        source: 'wishlist@1',
        evidence: 'verified',
        channels: { achievement: 0.92, significance: 0.58 },
        portalActivity: 0.28,
      },
    ]).geometry;

    expect(later.meshes).toHaveLength(earlier.meshes.length + 1);
    for (const oldMesh of earlier.meshes) {
      const nextMesh = later.meshes.find((mesh) => mesh.bodyId === oldMesh.bodyId);
      expect(nextMesh).toBeDefined();
      expect(nextMesh?.profile.signature).toBe(oldMesh.profile.signature);
      expect(nextMesh?.positions).toEqual(oldMesh.positions);
      expect(nextMesh?.sourceTriangleCount).toBe(oldMesh.sourceTriangleCount);
      expect(nextMesh?.lod).toBe(oldMesh.lod);
    }
  });

  it('applies the budget append-only by omitting only later bodies', () => {
    const unrestricted = pipeline(BASE_EVENTS).geometry;
    const constrained = pipeline(BASE_EVENTS, {
      ...DEFAULT_CRYSTAL_GEOMETRY_CONFIG,
      maxVertices: 120,
      maxTriangles: 180,
    }).geometry;

    expect(constrained.meshes.length).toBeGreaterThan(0);
    expect(constrained.meshes.length).toBeLessThan(unrestricted.meshes.length);
    expect(constrained.budget.budgetExceeded).toBe(true);
    expect(constrained.diagnostics.budgetOmittedBodyIds.length).toBeGreaterThan(0);
    expect(constrained.meshes[0]?.bodyId).toBe(unrestricted.meshes[0]?.bodyId);
    expect(constrained.meshes[0]?.profile.signature).toBe(
      unrestricted.meshes.find((mesh) => mesh.bodyId === constrained.meshes[0]?.bodyId)?.profile.signature,
    );
  });
});
