import { describe, expect, it } from 'vitest';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../../../evolution';
import { buildReefSpeciesBlueprint } from '../reefSpecies';
import { buildReefColonyLayout } from '../layout';
import { DEFAULT_REEF_FOUNDATION_MESH_CONFIG } from './config';
import { buildReefFoundationMesh } from './reefFoundationMesh';

const BASE_EVENTS: EvolutionEventInput[] = [
  {
    id: 'calendar:proposal',
    episodeId: 'relationship:proposal',
    occurredAt: '2024-02-14T19:00:00+02:00',
    source: 'calendar@1',
    evidence: 'verified',
    channels: { significance: 0.95, remembrance: 0.6, stability: 0.45 },
    portalActivity: 0.24,
  },
  {
    id: 'achievement:home',
    occurredAt: '2024-05-18',
    source: 'plans@1',
    evidence: 'verified',
    channels: { achievement: 0.86, stability: 0.22 },
    portalActivity: 0.2,
  },
  {
    id: 'memory:first-album',
    occurredAt: '2024-07-02',
    source: 'memories@1',
    evidence: 'verified',
    channels: { remembrance: 0.88, culture: 0.16 },
    portalActivity: 0.28,
  },
  {
    id: 'place:lviv',
    occurredAt: '2024-08-10T12:00:00+03:00',
    source: 'map@1',
    evidence: 'verified',
    channels: { exploration: 0.85, remembrance: 0.3, culture: 0.2 },
    portalActivity: 0.32,
  },
  {
    id: 'culture:concert',
    occurredAt: '2024-10-12',
    source: 'calendar@1',
    evidence: 'verified',
    channels: { culture: 0.9, significance: 0.8 },
    portalActivity: 0.25,
  },
];

function buildPipeline(events: readonly EvolutionEventInput[] = BASE_EVENTS) {
  const artifact = buildArtifactBlueprint({
    coupleId: 'amore:reef-foundation-test-couple',
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
    config: { asOf: '2026-07-01', rulesVersion: 'reef-species-v1.0.0' },
  });
  const layout = buildReefColonyLayout({ species });
  const foundation = buildReefFoundationMesh({ species, layout });
  return { species, layout, foundation };
}

function triangleArea(
  vertices: ReturnType<typeof buildPipeline>['foundation']['vertices'],
  a: number,
  b: number,
  c: number,
): number {
  const first = vertices[a];
  const second = vertices[b];
  const third = vertices[c];
  if (!first || !second || !third) return 0;
  const ab = {
    x: second.position.x - first.position.x,
    y: second.position.y - first.position.y,
    z: second.position.z - first.position.z,
  };
  const ac = {
    x: third.position.x - first.position.x,
    y: third.position.y - first.position.y,
    z: third.position.z - first.position.z,
  };
  const cross = {
    x: ab.y * ac.z - ab.z * ac.y,
    y: ab.z * ac.x - ab.x * ac.z,
    z: ab.x * ac.y - ab.y * ac.x,
  };
  return Math.hypot(cross.x, cross.y, cross.z) * 0.5;
}

describe('Reef Species Phase 3 Foundation Mesh', () => {
  it('builds a deterministic closed indexed shell without mutating Phase 1 or Phase 2', () => {
    const { species, layout } = buildPipeline();
    const speciesBefore = structuredClone(species);
    const layoutBefore = structuredClone(layout);
    const first = buildReefFoundationMesh({ species, layout });
    const second = buildReefFoundationMesh({ species, layout });
    const radialBands = species.grammar.radialBandCount;
    const sectors = 24;
    const expectedVertices = 2 + sectors * (radialBands + 1);
    const expectedTopTriangles = sectors * (1 + (radialBands - 1) * 2);
    const expectedTriangles = expectedTopTriangles + sectors * 3;

    expect(second).toEqual(first);
    expect(species).toEqual(speciesBefore);
    expect(layout).toEqual(layoutBefore);
    expect(first.descriptor.id).toBe('reef:foundation-mesh');
    expect(first.vertices).toHaveLength(expectedVertices);
    expect(first.triangles).toHaveLength(expectedTriangles);
    expect(first.index).toHaveLength(expectedTriangles * 3);
    expect(first.diagnostics.topTriangleCount).toBe(expectedTopTriangles);
    expect(first.diagnostics.sideTriangleCount).toBe(sectors * 2);
    expect(first.diagnostics.bottomTriangleCount).toBe(sectors);
    expect(first.diagnostics.closedShell).toBe(true);
    expect(first.diagnostics.boundaryEdgeCount).toBe(0);
    expect(first.diagnostics.nonManifoldEdgeCount).toBe(0);
    expect(first.diagnostics.degenerateTriangleIds).toEqual([]);
    expect(first.diagnostics.geometryBudgetExceeded).toBe(false);
    expect(first.diagnostics.estimatedDrawCalls).toBe(1);
    expect(first.diagnostics.materialSlots).toBe(1);
    expect(first.diagnostics.perFrameUpdates).toBe(0);
  });

  it('maps every logical substrate cell to a stable top patch', () => {
    const { layout, foundation } = buildPipeline();
    const patchesByCellId = new Map(
      foundation.patches
        .filter((patch) => patch.substrateCellId !== null)
        .map((patch) => [patch.substrateCellId as string, patch] as const),
    );

    expect(foundation.diagnostics.cellPatchCount).toBe(layout.cells.length);
    expect(foundation.diagnostics.cellIdsWithoutPatch).toEqual([]);
    for (const cell of layout.cells) {
      const patch = patchesByCellId.get(cell.id);
      expect(patch).toBeDefined();
      expect(patch?.surface).toBe('top');
      expect(patch?.radialBand).toBe(cell.radialBand);
      expect(patch?.azimuthSectorIndex).toBe(cell.azimuthSectorIndex);
      expect(patch?.triangleIds.length).toBe(cell.radialBand === 0 ? 1 : 2);
    }
  });

  it('publishes renderer-safe indices, normalized normals and non-degenerate triangles', () => {
    const { foundation } = buildPipeline();

    expect(new Set(foundation.vertices.map((vertex) => vertex.id)).size).toBe(
      foundation.vertices.length,
    );
    expect(new Set(foundation.triangles.map((triangle) => triangle.id)).size).toBe(
      foundation.triangles.length,
    );
    for (const vertex of foundation.vertices) {
      expect(Math.hypot(vertex.normal.x, vertex.normal.y, vertex.normal.z)).toBeCloseTo(1, 5);
      expect(vertex.uv.u).toBeGreaterThanOrEqual(0);
      expect(vertex.uv.u).toBeLessThanOrEqual(1);
      expect(vertex.uv.v).toBeGreaterThanOrEqual(0);
      expect(vertex.uv.v).toBeLessThanOrEqual(1);
    }
    for (const triangle of foundation.triangles) {
      expect(triangle.a).toBeGreaterThanOrEqual(0);
      expect(triangle.b).toBeGreaterThanOrEqual(0);
      expect(triangle.c).toBeGreaterThanOrEqual(0);
      expect(triangle.a).toBeLessThan(foundation.vertices.length);
      expect(triangle.b).toBeLessThan(foundation.vertices.length);
      expect(triangle.c).toBeLessThan(foundation.vertices.length);
      expect(triangleArea(
        foundation.vertices,
        triangle.a,
        triangle.b,
        triangle.c,
      )).toBeGreaterThan(1e-9);
    }
  });

  it('keeps every accepted colony attached to the same Phase 2 anchor and patch', () => {
    const { layout, foundation } = buildPipeline();
    const attachmentsByColonyId = new Map(
      foundation.attachments.map((attachment) => [attachment.colonyId, attachment] as const),
    );

    expect(foundation.attachments).toHaveLength(layout.colonies.length);
    expect(foundation.diagnostics.attachmentCount).toBe(layout.colonies.length);
    expect(foundation.diagnostics.colonyIdsWithoutAttachment).toEqual([]);
    for (const colony of layout.colonies) {
      const attachment = attachmentsByColonyId.get(colony.id);
      expect(attachment).toBeDefined();
      expect(attachment?.substrateCellId).toBe(colony.substrateCellId);
      expect(attachment?.position).toEqual(colony.position);
      expect(attachment?.normal).toEqual(colony.normal);
      expect(attachment?.facingRad).toBe(colony.facingRad);
      expect(attachment?.footprintRadius).toBe(colony.footprintRadius);
      expect(attachment?.targetHeight).toBe(colony.targetHeight);
      expect(attachment?.patchId).toContain(
        colony.substrateCellId.slice('reef:substrate-cell:'.length),
      );
    }
  });

  it('preserves existing colony attachments when later history is appended', () => {
    const base = buildPipeline(BASE_EVENTS.slice(0, 3)).foundation;
    const extended = buildPipeline([
      ...BASE_EVENTS.slice(0, 3),
      {
        id: 'memory:summer-2026',
        occurredAt: '2026-06-20',
        source: 'memories@1',
        evidence: 'verified',
        channels: { remembrance: 0.45 },
        portalActivity: 0.12,
      },
    ]).foundation;
    const extendedByColonyId = new Map(
      extended.attachments.map((attachment) => [attachment.colonyId, attachment] as const),
    );

    for (const attachment of base.attachments) {
      expect(extendedByColonyId.get(attachment.colonyId)).toEqual(attachment);
    }
    expect(extended.attachments.length).toBeGreaterThan(base.attachments.length);
  });

  it('rejects incompatible provenance and invalid geometry budgets', () => {
    const { species, layout } = buildPipeline();

    expect(() => buildReefFoundationMesh({
      species,
      layout: { ...layout, artifactSeed: layout.artifactSeed + 1 },
    })).toThrow('artifactSeed');
    expect(() => buildReefFoundationMesh({
      species,
      layout: { ...layout, asOf: '2026-07-02' },
    })).toThrow('asOf');
    expect(() => buildReefFoundationMesh({
      species,
      layout,
      config: { ...DEFAULT_REEF_FOUNDATION_MESH_CONFIG, rulesVersion: '   ' },
    })).toThrow('non-empty rulesVersion');
    expect(() => buildReefFoundationMesh({
      species,
      layout,
      config: { ...DEFAULT_REEF_FOUNDATION_MESH_CONFIG, skirtDepthRatio: 0 },
    })).toThrow('skirtDepthRatio');
  });

  it('reports an exceeded budget without mutating or truncating accepted topology', () => {
    const { species, layout } = buildPipeline();
    const full = buildReefFoundationMesh({ species, layout });
    const constrained = buildReefFoundationMesh({
      species,
      layout,
      config: {
        ...DEFAULT_REEF_FOUNDATION_MESH_CONFIG,
        maximumVertices: 32,
        maximumTriangles: 32,
      },
    });

    expect(constrained.vertices).toEqual(full.vertices);
    expect(constrained.triangles).toEqual(full.triangles);
    expect(constrained.diagnostics.geometryBudgetExceeded).toBe(true);
    expect(constrained.diagnostics.maximumVertices).toBe(32);
    expect(constrained.diagnostics.maximumTriangles).toBe(32);
  });
});
