import { describe, expect, it } from 'vitest';
import { buildArtifactBlueprint, type EvolutionEventInput } from '@/engine/evolution';
import { buildReefPreviewFromArtifact } from './buildReefPreview';
import {
  applyReefPresentation,
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
    id: 'reef:visual:achievement',
    occurredAt: '2024-07-18',
    source: 'plans@1',
    evidence: 'verified',
    channels: { achievement: 0.96, significance: 0.32 },
    portalActivity: 0.28,
  },
  {
    id: 'reef:visual:culture',
    occurredAt: '2025-04-20',
    source: 'calendar@1',
    evidence: 'verified',
    channels: { culture: 0.94, significance: 0.78 },
    portalActivity: 0.34,
  },
];

function buildFixture() {
  const artifact = buildArtifactBlueprint({
    coupleId: 'amore:reef-visual-repair',
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

describe('Reef production visual repair', () => {
  it('flattens the substrate, enlarges colonies and keeps renderer budgets unchanged', () => {
    const scene = createReefThreeScene(buildFixture());
    const foundationAttribute = scene.foundation.geometry.getAttribute('position');
    const foundationBefore = Float32Array.from(foundationAttribute.array as Float32Array);
    const drawCallsBefore = scene.diagnostics.drawCalls;
    const trianglesBefore = scene.diagnostics.triangles;

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
    expect(rangeHeight(tallest.batch.basePositions, tallest.runtime)).toBeCloseTo(
      tallest.height * REEF_PRESENTATION_PROFILE.colonyVerticalScale,
      5,
    );
    expect(tallest.runtime.motion.pivot.y).toBeCloseTo(
      sourcePivotY * REEF_PRESENTATION_PROFILE.foundationVerticalScale
        + REEF_PRESENTATION_PROFILE.colonyRootLift,
      5,
    );
    expect(scene.diagnostics.drawCalls).toBe(drawCallsBefore);
    expect(scene.diagnostics.triangles).toBe(trianglesBefore);
    expect(scene.foundation.geometry.userData.reefPresentationVersion).toBe(
      REEF_PRESENTATION_VERSION,
    );

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
    applyReefPresentation(scene);
    expect(scene.batches.map((batch) => Array.from(batch.basePositions))).toEqual(firstPositions);

    disposeReefThreeScene(scene);
  });
});
