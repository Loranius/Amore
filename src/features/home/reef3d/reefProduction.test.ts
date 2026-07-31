import { describe, expect, it } from 'vitest';
import { buildArtifactBlueprint, type EvolutionEventInput } from '@/engine/evolution';
import { buildReefPreviewFromArtifact, REEF_PRODUCTION_BUDGET } from './buildReefPreview';
import {
  createReefThreeScene,
  disposeReefThreeScene,
  sampleReefBatchFrame,
} from './reefThreeAdapter';

const EVENTS: EvolutionEventInput[] = [
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

function buildFixture() {
  const artifact = buildArtifactBlueprint({
    coupleId: 'amore:reef-production-test',
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

describe('Reef Phase 8 production renderer', () => {
  it('builds deterministic Phase 1–7 state within the production contract', () => {
    const first = buildFixture();
    const second = buildFixture();

    expect(second.species).toEqual(first.species);
    expect(second.layout).toEqual(first.layout);
    expect(second.foundation).toEqual(first.foundation);
    expect(second.meshes).toEqual(first.meshes);
    expect(second.materials).toEqual(first.materials);
    expect(second.life).toEqual(first.life);
    expect(first.diagnostics.staticStatus).toBe('pass');
    expect(first.diagnostics.violations).toEqual([]);
    expect(first.diagnostics.expectedDrawCalls).toBeLessThanOrEqual(
      REEF_PRODUCTION_BUDGET.maximumDrawCalls,
    );
    expect(first.diagnostics.materialCount).toBeLessThanOrEqual(
      REEF_PRODUCTION_BUDGET.maximumMaterials,
    );
    expect(first.diagnostics.vertexCount).toBeLessThanOrEqual(
      REEF_PRODUCTION_BUDGET.maximumVertices,
    );
    expect(first.diagnostics.triangleCount).toBeLessThanOrEqual(
      REEF_PRODUCTION_BUDGET.maximumTriangles,
    );
  });

  it('creates one foundation draw and at most one draw per morphotype', () => {
    const build = buildFixture();
    const scene = createReefThreeScene(build);

    expect(scene.diagnostics.drawCalls).toBe(1 + scene.batches.length);
    expect(scene.diagnostics.drawCalls).toBeLessThanOrEqual(7);
    expect(scene.diagnostics.materials).toBe(scene.diagnostics.drawCalls);
    expect(scene.diagnostics.motionBindings).toBe(build.life.bindings.length);
    expect(scene.foundation.geometry.getAttribute('position').count).toBe(
      build.foundation.vertices.length,
    );
    for (const batch of scene.batches) {
      expect(batch.geometry.getAttribute('position').count).toBe(batch.source.vertices.length);
      expect(batch.geometry.index?.count).toBe(batch.source.index.length);
      expect(batch.runtimeRanges).toHaveLength(batch.source.ranges.length);
    }

    disposeReefThreeScene(scene);
  });

  it('animates in-place and restores exact accepted buffers for reduced motion', () => {
    const build = buildFixture();
    const scene = createReefThreeScene(build);
    const animatedBatch = scene.batches.find((batch) => (
      batch.runtimeRanges.some((range) => range.motion.swayAmplitudeRadians > 0)
    ));
    expect(animatedBatch).toBeDefined();
    if (!animatedBatch) return;

    sampleReefBatchFrame(
      animatedBatch,
      4.25,
      false,
      build.life.current.cycleSeconds,
      build.life.current.phaseRadians,
    );
    const animatedPositions = Array.from(
      animatedBatch.geometry.getAttribute('position').array as Float32Array,
    );
    expect(animatedPositions).not.toEqual(Array.from(animatedBatch.basePositions));

    sampleReefBatchFrame(
      animatedBatch,
      9.5,
      true,
      build.life.current.cycleSeconds,
      build.life.current.phaseRadians,
    );
    expect(Array.from(animatedBatch.geometry.getAttribute('position').array as Float32Array))
      .toEqual(Array.from(animatedBatch.basePositions));
    expect(Array.from(animatedBatch.geometry.getAttribute('normal').array as Float32Array))
      .toEqual(Array.from(animatedBatch.baseNormals));
    expect(Array.from(animatedBatch.geometry.getAttribute('color').array as Float32Array))
      .toEqual(Array.from(animatedBatch.baseColors));

    disposeReefThreeScene(scene);
  });
});
