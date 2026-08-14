import { describe, expect, it } from 'vitest';
import { buildArtifactBlueprint, type EvolutionEventInput } from '@/engine/evolution';
import { REEF_COLONY_MORPHOTYPES } from '@/engine/species/reef';
import { buildReefPreviewFromArtifact } from './buildReefPreview';
import { reefDensityCandidateCounts } from './ReefDensityLayer';
import {
  applyReefPresentation,
  REEF_COLONY_SHAPE_PASS,
  REEF_COLONY_SHAPE_PROFILES,
  REEF_PRESENTATION_PROFILE,
  REEF_PRESENTATION_VERSION,
} from './reefPresentation';
import {
  createReefThreeScene,
  disposeReefThreeScene,
  type ReefBatchRuntimeRange,
} from './reefThreeAdapter';

const EVENTS: EvolutionEventInput[] = [
  {
    id: 'reef:visual:stability',
    occurredAt: '2024-02-12',
    source: 'plans@1',
    evidence: 'verified',
    channels: { stability: 0.92 },
    portalActivity: 0.22,
  },
  {
    id: 'reef:visual:remembrance',
    occurredAt: '2024-04-14',
    source: 'memories@1',
    evidence: 'verified',
    channels: { remembrance: 0.94, culture: 0.1 },
    portalActivity: 0.24,
  },
  {
    id: 'reef:visual:achievement',
    occurredAt: '2024-07-18',
    source: 'plans@1',
    evidence: 'verified',
    channels: { achievement: 0.96, significance: 0.32 },
    portalActivity: 0.28,
  },
  {
    id: 'reef:visual:exploration',
    occurredAt: '2024-10-20',
    source: 'map@1',
    evidence: 'verified',
    channels: { exploration: 0.95, remembrance: 0.12 },
    portalActivity: 0.3,
  },
  {
    id: 'reef:visual:culture-soft',
    occurredAt: '2025-02-16',
    source: 'calendar@1',
    evidence: 'verified',
    channels: { culture: 0.92, significance: 0.18 },
    portalActivity: 0.24,
  },
  {
    id: 'reef:visual:culture-fan',
    occurredAt: '2025-04-20',
    source: 'calendar@1',
    evidence: 'verified',
    channels: { culture: 0.94, significance: 0.78 },
    portalActivity: 0.34,
  },
];

function buildFixture() {
  const artifact = buildArtifactBlueprint({
    coupleId: 'amore:reef-phase-10-shapes',
    config: {
      engineVersion: '1.0.0',
      relationshipStartedAt: '2024-01-01',
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
    events: EVENTS,
  });
  return buildReefPreviewFromArtifact({ artifact, asOf: '2026-07-31' });
}

function rangeHeight(positions: Float32Array, runtime: ReefBatchRuntimeRange): number {
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  for (
    let index = runtime.range.vertexStart;
    index < runtime.range.vertexStart + runtime.range.vertexCount;
    index += 1
  ) {
    const y = positions[index * 3 + 1] ?? 0;
    minimum = Math.min(minimum, y);
    maximum = Math.max(maximum, y);
  }
  return maximum - minimum;
}

function maximumY(positions: Float32Array): number {
  let maximum = Number.NEGATIVE_INFINITY;
  for (let offset = 1; offset < positions.length; offset += 3) {
    maximum = Math.max(maximum, positions[offset] ?? 0);
  }
  return maximum;
}

function unitLength(array: Float32Array, offset: number): number {
  return Math.hypot(array[offset] ?? 0, array[offset + 1] ?? 0, array[offset + 2] ?? 0);
}

describe('Reef Phase 10 colony shape presentation', () => {
  it('derives the secondary canopy from accepted portal colonies', () => {
    const build = buildFixture();
    const counts = reefDensityCandidateCounts(build);

    expect(counts.sourceColonies).toBe(build.layout.colonies.length);
    expect(counts.drawCalls).toBe(1);
    expect(Object.keys(counts.morphotypeCounts)).toEqual(REEF_COLONY_MORPHOTYPES);
    expect(Object.values(counts.morphotypeCounts).reduce((total, count) => total + count, 0))
      .toBe(counts.sourceColonies);
  });

  it('publishes a distinct bounded silhouette profile for every accepted morphotype', () => {
    expect(Object.keys(REEF_COLONY_SHAPE_PROFILES)).toEqual(REEF_COLONY_MORPHOTYPES);

    const signatures = REEF_COLONY_MORPHOTYPES.map((morphotype) => (
      Object.values(REEF_COLONY_SHAPE_PROFILES[morphotype]).join(':')
    ));
    expect(new Set(signatures).size).toBe(REEF_COLONY_MORPHOTYPES.length);

    expect(REEF_COLONY_SHAPE_PROFILES.massive.axialScale).toBeLessThan(1);
    expect(REEF_COLONY_SHAPE_PROFILES.massive.midBulge).toBeGreaterThan(0.4);
    expect(REEF_COLONY_SHAPE_PROFILES.plating.edgeExpansion).toBeGreaterThan(0.4);
    expect(REEF_COLONY_SHAPE_PROFILES.encrusting.axialScale).toBeLessThan(0.4);
    expect(REEF_COLONY_SHAPE_PROFILES['soft-coral'].bend).toBeGreaterThan(0.15);
    expect(REEF_COLONY_SHAPE_PROFILES['sea-fan'].depthScale).toBeLessThan(0.7);
  });

  it('flattens the substrate, reshapes colonies and keeps renderer budgets unchanged', () => {
    const scene = createReefThreeScene(buildFixture());
    const foundationAttribute = scene.foundation.geometry.getAttribute('position');
    const foundationBefore = Float32Array.from(foundationAttribute.array as Float32Array);
    const drawCallsBefore = scene.diagnostics.drawCalls;
    const verticesBefore = scene.diagnostics.vertices;
    const trianglesBefore = scene.diagnostics.triangles;
    const indexBefore = scene.batches.map((batch) => Array.from(batch.geometry.index?.array ?? []));
    const positionsBefore = scene.batches.map((batch) => Float32Array.from(batch.basePositions));

    const candidates = scene.batches.flatMap((batch) => (
      batch.runtimeRanges.map((runtime) => ({
        batch,
        runtime,
        height: rangeHeight(batch.basePositions, runtime),
      }))
    ));
    const tallest = candidates.sort((left, right) => right.height - left.height)[0];
    expect(tallest).toBeDefined();
    if (!tallest) return;
    const sourcePivotY = tallest.runtime.motion.pivot.y;

    applyReefPresentation(scene);

    const foundationAfter = foundationAttribute.array as Float32Array;
    expect(maximumY(foundationAfter)).toBeCloseTo(
      maximumY(foundationBefore) * REEF_PRESENTATION_PROFILE.foundationVerticalScale,
      5,
    );
    expect(tallest.runtime.motion.pivot.y).toBeCloseTo(
      sourcePivotY * REEF_PRESENTATION_PROFILE.foundationVerticalScale
        + REEF_PRESENTATION_PROFILE.colonyRootLift,
      5,
    );
    expect(scene.diagnostics.drawCalls).toBe(drawCallsBefore);
    expect(scene.diagnostics.vertices).toBe(verticesBefore);
    expect(scene.diagnostics.triangles).toBe(trianglesBefore);
    expect(scene.batches.map((batch) => Array.from(batch.geometry.index?.array ?? []))).toEqual(
      indexBefore,
    );
    expect(scene.foundation.geometry.userData.reefPresentationVersion).toBe(
      REEF_PRESENTATION_VERSION,
    );

    let changedBatches = 0;
    scene.batches.forEach((batch, batchIndex) => {
      expect(batch.geometry.userData.reefPresentationVersion).toBe(REEF_PRESENTATION_VERSION);
      expect(batch.geometry.userData.reefShapePass).toBe(REEF_COLONY_SHAPE_PASS);
      if (Array.from(batch.basePositions).some(
        (value, index) => Math.abs(value - (positionsBefore[batchIndex]?.[index] ?? value)) > 1e-6,
      )) {
        changedBatches += 1;
      }
      expect(batch.runtimeRanges.every((runtime) => runtime.maximumAxialDistance > 0)).toBe(true);
      for (let offset = 0; offset < batch.baseNormals.length; offset += 3) {
        expect(unitLength(batch.baseNormals, offset)).toBeCloseTo(1, 4);
      }
    });
    expect(changedBatches).toBe(scene.batches.length);

    disposeReefThreeScene(scene);
  });

  it('uses vertex colors once and remains idempotent', () => {
    const scene = createReefThreeScene(buildFixture());
    applyReefPresentation(scene);

    expect(scene.foundation.material.color.toArray()).toEqual([1, 1, 1]);
    for (const batch of scene.batches) {
      expect(batch.material.color.toArray()).toEqual([1, 1, 1]);
    }

    const firstPositions = scene.batches.map((batch) => Array.from(batch.basePositions));
    const firstNormals = scene.batches.map((batch) => Array.from(batch.baseNormals));
    applyReefPresentation(scene);
    expect(scene.batches.map((batch) => Array.from(batch.basePositions))).toEqual(firstPositions);
    expect(scene.batches.map((batch) => Array.from(batch.baseNormals))).toEqual(firstNormals);

    disposeReefThreeScene(scene);
  });
});
