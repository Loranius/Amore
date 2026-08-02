import { describe, expect, it } from 'vitest';
import { DEFAULT_CRYSTAL_COMPOSITION_CONFIG, buildCrystalComposition } from '../composition';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../evolution';
import { DEFAULT_GROWTH_ENGINE_CONFIG, buildGrowthState } from '../growth';
import { buildCrystalSpeciesBlueprint, crystalToGrowthBlueprint } from '../species/crystal';
import { DEFAULT_CRYSTAL_GEOMETRY_CONFIG } from './config';
import { buildCrystalGeometry } from './engine';
import { buildCrystalMesh, splitCrystalMeshFaces } from './mesh';
import { CRYSTAL_SUBSTRATE_BODY_ID } from './substrate';
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
    expect(firstPipeline.geometry.geology).toBeDefined();
    expect(firstPipeline.geometry.geology?.bodyCount).toBe(firstPipeline.growth.bodies.length);
    expect(firstPipeline.geometry.geology?.centers).toHaveLength(
      firstPipeline.growth.growthCenters?.length ?? 0,
    );
  });

  it('resolves host dependencies independently of serialized body array order', () => {
    const canonical = pipeline(BASE_EVENTS);
    const reorderedGrowth = {
      ...canonical.growth,
      bodies: [...canonical.growth.bodies].reverse(),
    };
    const reordered = buildCrystalGeometry({
      growth: reorderedGrowth,
      composition: canonical.composition,
      config: DEFAULT_CRYSTAL_GEOMETRY_CONFIG,
    });

    expect(reordered.diagnostics.missingHostBodyIds).toEqual([]);
    expect(reordered.diagnostics.budgetOmittedBodyIds).toEqual([]);
    expect(reordered.meshes.map((mesh) => mesh.bodyId)).toEqual(
      canonical.geometry.meshes.map((mesh) => mesh.bodyId),
    );
    // One junction per *attached* body. Ground-rooted companions have no host,
    // so they publish no junction (2026-08-02 composition change).
    expect(reordered.junctions).toHaveLength(
      reorderedGrowth.bodies.filter((body) => body.hostBodyId !== null).length,
    );
  });

  it('publishes normalized geological burial and center maturation metadata', () => {
    const { geometry } = pipeline(BASE_EVENTS);
    const geology = geometry.geology;

    expect(geology).toBeDefined();
    expect(geology?.geologyStateVersion).toBe(1);
    expect(geology?.maxBurialRatio).toBeGreaterThanOrEqual(0);
    expect(geology?.maxBurialRatio).toBeLessThanOrEqual(0.82);
    for (const body of geology?.bodies ?? []) {
      expect(body.burialRatio).toBeGreaterThanOrEqual(0);
      expect(body.burialRatio).toBeLessThanOrEqual(0.82);
      expect(body.exposedTipRatio).toBeGreaterThan(0);
      expect(body.exposedTipRatio).toBeLessThanOrEqual(1);
      expect(body.buriedLength + body.exposedLength).toBeGreaterThan(0);
    }
    for (const center of geology?.centers ?? []) {
      expect(center.maturity).toBeGreaterThanOrEqual(0);
      expect(center.maturity).toBeLessThanOrEqual(1);
      expect(center.cohesion).toBeGreaterThanOrEqual(0);
      expect(center.cohesion).toBeLessThanOrEqual(1);
    }
  });

  it('produces valid indexed meshes and one junction per attached body', () => {
    const { growth, geometry } = pipeline(BASE_EVENTS);

    // One mesh per body, plus the substrate the druse stands in (ADR-0003
    // relies on it to occlude the crystals' buried base caps).
    expect(geometry.meshes).toHaveLength(growth.bodies.length + 1);
    expect(geometry.meshes.at(-1)?.bodyId).toBe(CRYSTAL_SUBSTRATE_BODY_ID);
    // One junction per attached body. Crystal bodies all stand in the ground
    // now (ADR-0003), so this count is legitimately zero for this species —
    // the rule still has to hold, and the count still has to match.
    const attachedCount = growth.bodies.filter((body) => body.hostBodyId !== null).length;
    expect(geometry.junctions).toHaveLength(attachedCount);
    expect(attachedCount).toBe(0);
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

  it('keeps a closed year the same shape when a later event is appended', () => {
    // The year in progress is identified by being last: years are emitted in
    // calendar order, so the newest is the one still growing.
    const CURRENT_YEAR_BODY_ID = pipeline(BASE_EVENTS).geometry.meshes
      .map((mesh) => mesh.bodyId)
      .filter((bodyId) => bodyId.startsWith('crystal:year:'))
      .at(-1)!;

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

    expect(earlier.geology).toBeDefined();
    expect(later.geology).toBeDefined();
    // Since ADR-0004 a new event does not add a body: the count follows the
    // couple's years. That is the point — it is what stops a photo album from
    // growing the druse without a ceiling.
    expect(later.geology?.bodyCount ?? 0).toBe(earlier.geology?.bodyCount ?? 0);
    // geology counts growth bodies; meshes additionally carry the substrate.
    expect(later.meshes).toHaveLength((later.geology?.bodyCount ?? 0) + 1);
    for (const oldMesh of earlier.meshes) {
      if (oldMesh.bodyId === CRYSTAL_SUBSTRATE_BODY_ID) continue;
      // The monarch and the year in progress both answer to new activity by
      // design; every closed year keeps its exact mesh.
      if (oldMesh.bodyId === 'crystal:mother') continue;
      if (oldMesh.bodyId === CURRENT_YEAR_BODY_ID) continue;
      const nextMesh = later.meshes.find((mesh) => mesh.bodyId === oldMesh.bodyId);
      expect(nextMesh).toBeDefined();
      // Topology, not coordinates: a closed year keeps its facet count, its
      // profile rows and its level of detail, while its absolute size tracks
      // the monarch so a backfilled early year can still grow (ADR-0004).
      expect(nextMesh?.profile.segments).toBe(oldMesh.profile.segments);
      expect(nextMesh?.profile.rows).toHaveLength(oldMesh.profile.rows.length);
      expect(nextMesh?.positions).toHaveLength(oldMesh.positions.length);
      expect(nextMesh?.sourceTriangleCount).toBe(oldMesh.sourceTriangleCount);
      expect(nextMesh?.lod).toBe(oldMesh.lod);
    }
  });

  it('applies the budget append-only by omitting only later bodies', () => {
    const unrestricted = pipeline(BASE_EVENTS).geometry;
    const constrained = pipeline(BASE_EVENTS, {
      ...DEFAULT_CRYSTAL_GEOMETRY_CONFIG,
      // Lowered with ADR-0003: a couple's crystal is ~5 bodies instead of ~38,
      // so the old ceiling no longer forced any omission and the test stopped
      // exercising the budget at all.
      maxVertices: 120,
      maxTriangles: 220,
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

/** A free-standing crystal, used only to drive splitCrystalMeshFaces directly. */
const TRIM_PROBE_BODY = {
  id: 'probe', instructionId: 'i', sourceId: 's', species: 'crystal',
  kind: 'crystal:mother', tier: 'king' as const,
  attributes: { formationKind: 'mother', archetype: 'massive' },
  sequence: 0, colonyId: 'c', epochIndex: 0, seed: 987_654, emphasized: false,
  generation: 0, hostBodyId: null, attachment: null,
  anchor: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 1, z: 0 },
  skeletonLength: 1, skeletonRadius: 0.2, surfaceRadiusScale: 1,
  renderedLength: 0.9, renderedRadius: 0.18, maturity: 0.8, growthEnergy: 0.7,
  competition: 0.1, crowding: 0.1, growthCenterId: 'g',
  growthCenterRole: 'dominant' as const,
};

describe('crystal faceting — flat normals in the published state', () => {
  it('gives every triangle its own vertices and its own normal', () => {
    // `flatShading: true` on the Three material drew the same picture, but the
    // published geometry still described a smooth surface — so what the
    // couple's crystal *is* depended on a renderer flag. Anything else reading
    // the state (a second renderer, a snapshot, an export) got the smooth one.
    const geometry = pipeline(BASE_EVENTS).geometry;

    for (const mesh of geometry.meshes) {
      expect(mesh.indices).toHaveLength(mesh.visibleTriangleCount * 3);
      expect(mesh.positions).toHaveLength(mesh.indices.length * 3);
      expect(mesh.normals).toHaveLength(mesh.positions.length);
      // Vertices are listed in triangle order and never shared.
      for (let index = 0; index < mesh.indices.length; index += 1) {
        expect(mesh.indices[index]).toBe(index);
      }
    }
  });

  it('makes each normal the true normal of its own triangle', () => {
    const geometry = pipeline(BASE_EVENTS).geometry;

    for (const mesh of geometry.meshes) {
      for (let offset = 0; offset < mesh.indices.length; offset += 3) {
        const corner = (slot: number) => {
          const base = mesh.indices[offset + slot]! * 3;
          return {
            x: mesh.positions[base]!,
            y: mesh.positions[base + 1]!,
            z: mesh.positions[base + 2]!,
          };
        };
        const a = corner(0);
        const b = corner(1);
        const c = corner(2);
        const edge1 = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
        const edge2 = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
        const face = {
          x: edge1.y * edge2.z - edge1.z * edge2.y,
          y: edge1.z * edge2.x - edge1.x * edge2.z,
          z: edge1.x * edge2.y - edge1.y * edge2.x,
        };
        const magnitude = Math.hypot(face.x, face.y, face.z);
        if (magnitude < 1e-9) continue; // degenerate sliver at a tip

        // All three vertices of the triangle carry the same normal, and it is
        // the face normal — not an average with any neighbour.
        for (let slot = 0; slot < 3; slot += 1) {
          const base = mesh.indices[offset + slot]! * 3;
          const dot = mesh.normals[base]! * (face.x / magnitude)
            + mesh.normals[base + 1]! * (face.y / magnitude)
            + mesh.normals[base + 2]! * (face.z / magnitude);
          expect(dot).toBeGreaterThan(0.999);
        }
      }
    }
  });

  it('pays for the split without straining the budget', () => {
    // Roughly 3x the vertices. Stated as a test because the budget is what
    // decides whether a body gets published at all, and a silent 3x would
    // start dropping crystals on the couples with the most to show.
    const geometry = pipeline(BASE_EVENTS).geometry;

    expect(geometry.budget.budgetExceeded).toBe(false);
    expect(geometry.budget.usedVertices).toBeLessThan(geometry.budget.maxVertices * 0.5);
    expect(geometry.budget.usedVertices).toBe(geometry.budget.usedTriangles * 3);
  });

  it('costs nothing for triangles the trim removed', () => {
    // Ordering matters: trimming drops triangles from the index list, so
    // splitting first would leave their vertices stranded in the buffer —
    // geometry nothing draws, counted against the budget that decides which
    // bodies get published at all.
    //
    // Driven directly rather than through the pipeline: since ADR-0003 made
    // every crystal free-standing, the real druse has nothing to trim, and a
    // test that silently exercised zero removals would prove nothing.
    const source = buildCrystalMesh(TRIM_PROBE_BODY, 'high');
    const keptTriangles = source.sourceTriangleCount - 4;
    const trimmed = {
      ...source,
      indices: source.indices.slice(0, keptTriangles * 3),
      visibleTriangleCount: keptTriangles,
      removedTriangleCount: 4,
    };

    const split = splitCrystalMeshFaces(trimmed);

    const untrimmed = splitCrystalMeshFaces(source);

    expect(split.positions.length / 3).toBe(keptTriangles * 3);
    expect(untrimmed.positions.length / 3).toBe(source.sourceTriangleCount * 3);
    // The four removed triangles cost exactly their twelve vertices and no more.
    expect(untrimmed.positions.length - split.positions.length).toBe(4 * 3 * 3);
  });
});
