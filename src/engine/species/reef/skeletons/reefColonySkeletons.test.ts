import { describe, expect, it } from 'vitest';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../../../evolution';
import { REEF_COLONY_MORPHOTYPES } from '../types';
import { buildReefSpeciesBlueprint } from '../reefSpecies';
import { buildReefColonyLayout } from '../layout';
import { buildReefFoundationMesh } from '../foundation';
import { DEFAULT_REEF_COLONY_SKELETON_CONFIG } from './config';
import { buildReefColonySkeletons } from './reefColonySkeletons';

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
    coupleId: 'amore:reef-skeleton-test-couple',
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
  return { species, layout, foundation, skeletons };
}

function vectorLength(value: { x: number; y: number; z: number }): number {
  return Math.hypot(value.x, value.y, value.z);
}

function dot(
  left: { x: number; y: number; z: number },
  right: { x: number; y: number; z: number },
): number {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

describe('Reef Species Phase 4 Colony Skeletons', () => {
  it('is deterministic, immutable and creates exactly one skeleton per accepted colony', () => {
    const { species, layout, foundation } = buildPipeline();
    const speciesBefore = structuredClone(species);
    const layoutBefore = structuredClone(layout);
    const foundationBefore = structuredClone(foundation);
    const first = buildReefColonySkeletons({ species, layout, foundation });
    const second = buildReefColonySkeletons({ species, layout, foundation });

    expect(second).toEqual(first);
    expect(species).toEqual(speciesBefore);
    expect(layout).toEqual(layoutBefore);
    expect(foundation).toEqual(foundationBefore);
    expect(first.descriptor.id).toBe('reef:colony-skeletons');
    expect(first.skeletons).toHaveLength(layout.colonies.length);
    expect(first.diagnostics.skeletonCount).toBe(layout.colonies.length);
    expect(first.diagnostics.colonyIdsWithoutAttachment).toEqual([]);
    expect(first.diagnostics.attachmentIdsWithoutColony).toEqual([]);
    expect(first.diagnostics.colonyIdsWithoutSkeleton).toEqual([]);
    expect(first.diagnostics.invalidSegmentIds).toEqual([]);
    expect(first.diagnostics.invalidSurfaceIds).toEqual([]);
    expect(first.diagnostics.logicalBudgetExceeded).toBe(false);
    expect(first.diagnostics.rendererVertices).toBe(0);
    expect(first.diagnostics.rendererTriangles).toBe(0);
    expect(first.diagnostics.rendererInstances).toBe(0);
    expect(first.diagnostics.estimatedDrawCalls).toBe(0);
    expect(first.diagnostics.materialSlots).toBe(0);
    expect(first.diagnostics.perFrameUpdates).toBe(0);
  });

  it('publishes all six morphotype grammars with their expected structural primitive', () => {
    const { skeletons } = buildPipeline();
    const byMorphotype = new Map(
      REEF_COLONY_MORPHOTYPES.map((morphotype) => [
        morphotype,
        skeletons.skeletons.find((skeleton) => skeleton.morphotype === morphotype),
      ] as const),
    );

    for (const morphotype of REEF_COLONY_MORPHOTYPES) {
      expect(byMorphotype.get(morphotype), `missing ${morphotype}`).toBeDefined();
      expect(skeletons.diagnostics.morphotypeCounts[morphotype]).toBeGreaterThan(0);
    }
    expect(byMorphotype.get('branching')?.segments.some((segment) => segment.kind === 'branch')).toBe(true);
    expect(byMorphotype.get('massive')?.surfaces.some((surface) => surface.kind === 'massive-envelope')).toBe(true);
    expect(byMorphotype.get('plating')?.surfaces.some((surface) => surface.kind === 'plate-disc')).toBe(true);
    expect(byMorphotype.get('encrusting')?.surfaces.some((surface) => surface.kind === 'encrusting-patch')).toBe(true);
    expect(byMorphotype.get('soft-coral')?.surfaces.some((surface) => surface.kind === 'soft-lobe-envelope')).toBe(true);
    expect(byMorphotype.get('sea-fan')?.surfaces.some((surface) => surface.kind === 'fan-membrane')).toBe(true);
  });

  it('keeps every skeleton rooted in an orthonormal foundation basis with valid local references', () => {
    const { foundation, skeletons } = buildPipeline();
    const attachmentsById = new Map(
      foundation.attachments.map((attachment) => [attachment.id, attachment] as const),
    );

    for (const skeleton of skeletons.skeletons) {
      const attachment = attachmentsById.get(skeleton.attachmentId);
      expect(attachment).toBeDefined();
      expect(skeleton.basis.origin).toEqual(attachment?.position);
      expect(vectorLength(skeleton.basis.up)).toBeCloseTo(1, 5);
      expect(vectorLength(skeleton.basis.right)).toBeCloseTo(1, 5);
      expect(vectorLength(skeleton.basis.forward)).toBeCloseTo(1, 5);
      expect(Math.abs(dot(skeleton.basis.up, skeleton.basis.right))).toBeLessThan(1e-5);
      expect(Math.abs(dot(skeleton.basis.up, skeleton.basis.forward))).toBeLessThan(1e-5);
      expect(Math.abs(dot(skeleton.basis.right, skeleton.basis.forward))).toBeLessThan(1e-5);

      const nodeIds = new Set(skeleton.nodes.map((node) => node.id));
      expect(nodeIds.size).toBe(skeleton.nodes.length);
      expect(skeleton.nodes[0]).toMatchObject({
        kind: 'root',
        parentNodeId: null,
        localPosition: { x: 0, y: 0, z: 0 },
      });
      for (const node of skeleton.nodes) {
        if (node.parentNodeId !== null) expect(nodeIds.has(node.parentNodeId)).toBe(true);
        expect(node.radius).toBeGreaterThan(0);
        expect(node.influence).toBeGreaterThanOrEqual(0);
        expect(node.influence).toBeLessThanOrEqual(1);
      }
      for (const segment of skeleton.segments) {
        expect(nodeIds.has(segment.fromNodeId)).toBe(true);
        expect(nodeIds.has(segment.toNodeId)).toBe(true);
        expect(segment.radiusStart).toBeGreaterThan(0);
        expect(segment.radiusEnd).toBeGreaterThan(0);
      }
      for (const surface of skeleton.surfaces) {
        expect(surface.nodeIds.length).toBeGreaterThanOrEqual(3);
        expect(surface.nodeIds.every((nodeId) => nodeIds.has(nodeId))).toBe(true);
        expect(surface.thickness).toBeGreaterThan(0);
        expect(surface.span).toBeGreaterThan(0);
      }
    }
  });

  it('preserves existing skeletons exactly when later portal history is appended', () => {
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
    const extendedById = new Map(
      extended.skeletons.skeletons.map((skeleton) => [skeleton.id, skeleton] as const),
    );

    for (const skeleton of base.skeletons.skeletons) {
      expect(extendedById.get(skeleton.id)).toEqual(skeleton);
    }
    expect(extended.skeletons.skeletons.length).toBeGreaterThan(base.skeletons.skeletons.length);
  });

  it('reports an explicit logical budget violation without truncating stable skeletons', () => {
    const { species, layout, foundation, skeletons: full } = buildPipeline();
    const constrained = buildReefColonySkeletons({
      species,
      layout,
      foundation,
      config: {
        ...DEFAULT_REEF_COLONY_SKELETON_CONFIG,
        rulesVersion: 'reef-colony-skeletons-test-constrained',
        maximumNodes: 1,
        maximumSegments: 1,
        maximumSurfaces: 1,
      },
    });

    expect(constrained.skeletons).toEqual(full.skeletons);
    expect(constrained.diagnostics.logicalBudgetExceeded).toBe(true);
    expect(constrained.diagnostics.nodeCount).toBeGreaterThan(1);
    expect(constrained.diagnostics.segmentCount).toBeGreaterThan(1);
    expect(constrained.diagnostics.surfaceCount).toBeGreaterThan(1);
  });

  it('rejects invalid configuration and incompatible provenance', () => {
    const { species, layout, foundation } = buildPipeline();
    expect(() => buildReefColonySkeletons({
      species,
      layout,
      foundation,
      config: { ...DEFAULT_REEF_COLONY_SKELETON_CONFIG, rulesVersion: '   ' },
    })).toThrow('non-empty rulesVersion');
    expect(() => buildReefColonySkeletons({
      species,
      layout,
      foundation,
      config: { ...DEFAULT_REEF_COLONY_SKELETON_CONFIG, angularQuantization: 7 },
    })).toThrow('angularQuantization');
    expect(() => buildReefColonySkeletons({
      species,
      layout: { ...layout, artifactSeed: layout.artifactSeed + 1 },
      foundation,
    })).toThrow('incompatible Colony Layout provenance');
    expect(() => buildReefColonySkeletons({
      species,
      layout,
      foundation: { ...foundation, sourceColonyLayoutRulesVersion: 'wrong-version' },
    })).toThrow('incompatible Foundation Mesh provenance');
  });
});
