import { describe, expect, it } from 'vitest';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../../../evolution';
import { REEF_COLONY_MORPHOTYPES } from '../types';
import { buildReefSpeciesBlueprint } from '../reefSpecies';
import { buildReefColonyLayout } from '../layout';
import { buildReefFoundationMesh } from '../foundation';
import { buildReefColonySkeletons } from '../skeletons';
import { DEFAULT_REEF_COLONY_MESH_CONFIG } from './config';
import { buildReefColonyMeshes } from './reefColonyMeshes';
import type { ReefColonyMeshState } from './types';

const MORPHOTYPE_EVENTS: EvolutionEventInput[] = [
  {
    id: 'stability:home',
    occurredAt: '2024-01-12',
    source: 'wishlist@1',
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
    source: 'wishlist@1',
    evidence: 'verified',
    channels: { achievement: 0.92, stability: 0.12 },
    portalActivity: 0.24,
  },
  {
    id: 'exploration:lviv',
    occurredAt: '2024-07-20',
    source: 'media@1',
    evidence: 'verified',
    channels: { exploration: 0.94, remembrance: 0.16 },
    portalActivity: 0.26,
  },
  {
    id: 'culture:quiet-concert',
    occurredAt: '2024-09-10',
    source: 'media@1',
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
    coupleId: 'amore:reef-mesh-test-couple',
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
  return { species, layout, foundation, skeletons, meshes };
}

function vectorLength(value: { x: number; y: number; z: number }): number {
  return Math.hypot(value.x, value.y, value.z);
}

function rangeSnapshot(state: ReefColonyMeshState, colonyId: string) {
  for (const batch of state.batches) {
    const range = batch.ranges.find((candidate) => candidate.colonyId === colonyId);
    if (!range) continue;
    return {
      range,
      vertices: batch.vertices.slice(range.vertexStart, range.vertexStart + range.vertexCount),
      triangles: batch.triangles.slice(
        range.triangleStart,
        range.triangleStart + range.triangleCount,
      ),
      index: batch.index.slice(range.indexStart, range.indexStart + range.indexCount),
    };
  }
  return null;
}

describe('Reef Species Phase 5 Colony Mesh Geometry', () => {
  it('is deterministic, immutable and creates one mesh range per accepted skeleton', () => {
    const { species, layout, foundation, skeletons } = buildPipeline();
    const speciesBefore = structuredClone(species);
    const layoutBefore = structuredClone(layout);
    const foundationBefore = structuredClone(foundation);
    const skeletonsBefore = structuredClone(skeletons);
    const first = buildReefColonyMeshes({ species, layout, foundation, skeletons });
    const second = buildReefColonyMeshes({ species, layout, foundation, skeletons });

    expect(second).toEqual(first);
    expect(species).toEqual(speciesBefore);
    expect(layout).toEqual(layoutBefore);
    expect(foundation).toEqual(foundationBefore);
    expect(skeletons).toEqual(skeletonsBefore);
    expect(first.descriptor.id).toBe('reef:colony-meshes');
    expect(first.batches.flatMap((batch) => batch.ranges)).toHaveLength(skeletons.skeletons.length);
    expect(first.diagnostics.meshedColonyCount).toBe(skeletons.skeletons.length);
    expect(first.diagnostics.colonyIdsWithoutSkeleton).toEqual([]);
    expect(first.diagnostics.skeletonIdsWithoutColony).toEqual([]);
    expect(first.diagnostics.colonyIdsWithoutMesh).toEqual([]);
    expect(first.diagnostics.invalidTriangleIds).toEqual([]);
    expect(first.diagnostics.degenerateTriangleIds).toEqual([]);
    expect(first.diagnostics.nonFiniteVertexIds).toEqual([]);
    expect(first.diagnostics.nonUnitNormalVertexIds).toEqual([]);
    expect(first.diagnostics.geometryBudgetExceeded).toBe(false);
    expect(first.diagnostics.materialSlots).toBe(0);
    expect(first.diagnostics.perFrameUpdates).toBe(0);
  });

  it('publishes non-empty renderer-safe batches for all six morphotypes', () => {
    const { meshes } = buildPipeline();
    const byMorphotype = new Map(meshes.batches.map((batch) => [batch.morphotype, batch] as const));

    expect(meshes.diagnostics.batchCount).toBe(REEF_COLONY_MORPHOTYPES.length);
    expect(meshes.diagnostics.estimatedDrawCalls).toBe(REEF_COLONY_MORPHOTYPES.length);
    for (const morphotype of REEF_COLONY_MORPHOTYPES) {
      const batch = byMorphotype.get(morphotype);
      expect(batch, `missing ${morphotype}`).toBeDefined();
      expect(batch?.vertices.length ?? 0).toBeGreaterThan(0);
      expect(batch?.triangles.length ?? 0).toBeGreaterThan(0);
      expect(batch?.index.length).toBe((batch?.triangles.length ?? 0) * 3);
      expect(meshes.diagnostics.morphotypeVertexCounts[morphotype]).toBe(batch?.vertices.length);
      expect(meshes.diagnostics.morphotypeTriangleCounts[morphotype]).toBe(batch?.triangles.length);
    }
  });

  it('keeps indices, normals, UVs and stable ranges valid', () => {
    const { skeletons, meshes } = buildPipeline();
    const skeletonsById = new Map(skeletons.skeletons.map((skeleton) => [skeleton.id, skeleton] as const));

    for (const batch of meshes.batches) {
      expect(new Set(batch.vertices.map((vertex) => vertex.id)).size).toBe(batch.vertices.length);
      expect(new Set(batch.triangles.map((triangle) => triangle.id)).size).toBe(batch.triangles.length);
      expect(new Set(batch.ranges.map((range) => range.id)).size).toBe(batch.ranges.length);

      for (const triangle of batch.triangles) {
        expect(triangle.a).toBeGreaterThanOrEqual(0);
        expect(triangle.b).toBeGreaterThanOrEqual(0);
        expect(triangle.c).toBeGreaterThanOrEqual(0);
        expect(triangle.a).toBeLessThan(batch.vertices.length);
        expect(triangle.b).toBeLessThan(batch.vertices.length);
        expect(triangle.c).toBeLessThan(batch.vertices.length);
      }
      for (const vertex of batch.vertices) {
        expect(Number.isFinite(vertex.position.x)).toBe(true);
        expect(Number.isFinite(vertex.position.y)).toBe(true);
        expect(Number.isFinite(vertex.position.z)).toBe(true);
        expect(vectorLength(vertex.normal)).toBeCloseTo(1, 4);
        expect(vertex.uv.u).toBeGreaterThanOrEqual(0);
        expect(vertex.uv.u).toBeLessThanOrEqual(1);
        expect(vertex.uv.v).toBeGreaterThanOrEqual(0);
        expect(vertex.uv.v).toBeLessThanOrEqual(1);
      }
      for (const range of batch.ranges) {
        const skeleton = skeletonsById.get(range.skeletonId);
        expect(skeleton).toBeDefined();
        expect(range.colonyId).toBe(skeleton?.colonyId);
        expect(range.morphotype).toBe(batch.morphotype);
        expect(range.vertexCount).toBeGreaterThan(0);
        expect(range.triangleCount).toBeGreaterThan(0);
        expect(range.indexCount).toBe(range.triangleCount * 3);
        expect(range.vertexStart + range.vertexCount).toBeLessThanOrEqual(batch.vertices.length);
        expect(range.triangleStart + range.triangleCount).toBeLessThanOrEqual(batch.triangles.length);
        expect(range.indexStart + range.indexCount).toBeLessThanOrEqual(batch.index.length);
        expect(range.bounds.radius).toBeGreaterThan(0);
      }
    }
  });

  it('keeps geometry bounded around each foundation attachment', () => {
    const { foundation, skeletons, meshes } = buildPipeline();
    const attachmentsById = new Map(
      foundation.attachments.map((attachment) => [attachment.id, attachment] as const),
    );

    for (const skeleton of skeletons.skeletons) {
      const attachment = attachmentsById.get(skeleton.attachmentId);
      const snapshot = rangeSnapshot(meshes, skeleton.colonyId);
      expect(attachment).toBeDefined();
      expect(snapshot).not.toBeNull();
      const maximumDistance = skeleton.footprintRadius * 2.6 + skeleton.targetHeight * 1.8;
      for (const vertex of snapshot?.vertices ?? []) {
        const distance = Math.hypot(
          vertex.position.x - (attachment?.position.x ?? 0),
          vertex.position.y - (attachment?.position.y ?? 0),
          vertex.position.z - (attachment?.position.z ?? 0),
        );
        expect(distance).toBeLessThanOrEqual(maximumDistance);
      }
    }
  });

  it('preserves previous colony geometry byte-for-byte when later history is appended', () => {
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

    for (const skeleton of base.skeletons.skeletons) {
      expect(rangeSnapshot(extended.meshes, skeleton.colonyId)).toEqual(
        rangeSnapshot(base.meshes, skeleton.colonyId),
      );
    }
    expect(extended.meshes.diagnostics.meshedColonyCount).toBeGreaterThan(
      base.meshes.diagnostics.meshedColonyCount,
    );
  });

  it('reports geometry budget violations without truncating stable buffers', () => {
    const { species, layout, foundation, skeletons, meshes: full } = buildPipeline();
    const constrained = buildReefColonyMeshes({
      species,
      layout,
      foundation,
      skeletons,
      config: {
        ...DEFAULT_REEF_COLONY_MESH_CONFIG,
        rulesVersion: 'reef-colony-meshes-test-constrained',
        maximumVertices: 1,
        maximumTriangles: 1,
      },
    });

    expect(constrained.batches).toEqual(full.batches);
    expect(constrained.diagnostics.geometryBudgetExceeded).toBe(true);
    expect(constrained.diagnostics.vertexCount).toBeGreaterThan(1);
    expect(constrained.diagnostics.triangleCount).toBeGreaterThan(1);
  });

  it('rejects invalid configuration and incompatible provenance', () => {
    const { species, layout, foundation, skeletons } = buildPipeline();
    expect(() => buildReefColonyMeshes({
      species,
      layout,
      foundation,
      skeletons,
      config: { ...DEFAULT_REEF_COLONY_MESH_CONFIG, rulesVersion: '   ' },
    })).toThrow('non-empty rulesVersion');
    expect(() => buildReefColonyMeshes({
      species,
      layout,
      foundation,
      skeletons,
      config: { ...DEFAULT_REEF_COLONY_MESH_CONFIG, tubeRadialSegments: 2 },
    })).toThrow('tubeRadialSegments');
    expect(() => buildReefColonyMeshes({
      species,
      layout: { ...layout, artifactSeed: layout.artifactSeed + 1 },
      foundation,
      skeletons,
    })).toThrow('incompatible Colony Layout provenance');
    expect(() => buildReefColonyMeshes({
      species,
      layout,
      foundation,
      skeletons: { ...skeletons, sourceFoundationRulesVersion: 'wrong-version' },
    })).toThrow('incompatible Colony Skeleton provenance');
  });
});
