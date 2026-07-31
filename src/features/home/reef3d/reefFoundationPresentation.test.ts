import { describe, expect, it } from 'vitest';
import { buildArtifactBlueprint, type EvolutionEventInput } from '@/engine/evolution';
import { buildReefPreviewFromArtifact } from './buildReefPreview';
import {
  applyReefFoundationPresentation,
  REEF_FOUNDATION_PASS,
  REEF_FOUNDATION_PRESENTATION_VERSION,
  REEF_FOUNDATION_PROFILE,
} from './reefFoundationPresentation';
import { applyReefPresentation } from './reefPresentation';
import { createReefThreeScene, disposeReefThreeScene } from './reefThreeAdapter';

const EVENTS: EvolutionEventInput[] = [
  {
    id: 'reef:foundation:stability',
    occurredAt: '2024-02-12',
    source: 'plans@1',
    evidence: 'verified',
    channels: { stability: 0.92 },
    portalActivity: 0.22,
  },
  {
    id: 'reef:foundation:memory',
    occurredAt: '2024-04-14',
    source: 'memories@1',
    evidence: 'verified',
    channels: { remembrance: 0.94, culture: 0.1 },
    portalActivity: 0.24,
  },
  {
    id: 'reef:foundation:achievement',
    occurredAt: '2024-07-18',
    source: 'plans@1',
    evidence: 'verified',
    channels: { achievement: 0.96, significance: 0.32 },
    portalActivity: 0.28,
  },
  {
    id: 'reef:foundation:exploration',
    occurredAt: '2024-10-20',
    source: 'map@1',
    evidence: 'verified',
    channels: { exploration: 0.95, remembrance: 0.12 },
    portalActivity: 0.3,
  },
  {
    id: 'reef:foundation:culture',
    occurredAt: '2025-04-20',
    source: 'calendar@1',
    evidence: 'verified',
    channels: { culture: 0.94, significance: 0.78 },
    portalActivity: 0.34,
  },
];

function buildFixture() {
  const artifact = buildArtifactBlueprint({
    coupleId: 'amore:reef-phase-12-foundation',
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

function snapshot(array: ArrayLike<number>): number[] {
  return Array.from(array, (value) => Number(value.toFixed(6)));
}

function radiusAt(positions: Float32Array, index: number): number {
  const offset = index * 3;
  return Math.hypot(positions[offset] ?? 0, positions[offset + 2] ?? 0);
}

function average(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / Math.max(1, values.length);
}

function spread(values: readonly number[]): number {
  const mean = average(values);
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
}

describe('Reef Phase 12 foundation presentation', () => {
  it('publishes bounded natural-foundation parameters', () => {
    expect(REEF_FOUNDATION_PROFILE.primaryEdgeLobes).toBeGreaterThanOrEqual(3);
    expect(REEF_FOUNDATION_PROFILE.secondaryEdgeLobes).toBeGreaterThan(
      REEF_FOUNDATION_PROFILE.primaryEdgeLobes,
    );
    expect(REEF_FOUNDATION_PROFILE.primaryEdgeAmplitude).toBeGreaterThan(0);
    expect(REEF_FOUNDATION_PROFILE.primaryEdgeAmplitude).toBeLessThan(0.12);
    expect(REEF_FOUNDATION_PROFILE.bottomTaper).toBeGreaterThan(0.8);
    expect(REEF_FOUNDATION_PROFILE.bottomTaper).toBeLessThan(1);
    expect(REEF_FOUNDATION_PROFILE.colonyBedLiftRatio).toBeGreaterThan(0);
  });

  it('breaks the tray silhouette and tapers the stone skirt without changing budgets', () => {
    const build = buildFixture();
    const scene = applyReefPresentation(createReefThreeScene(build));
    const geometry = scene.foundation.geometry;
    const positions = geometry.getAttribute('position').array as Float32Array;
    const positionsBefore = Float32Array.from(positions);
    const indexBefore = snapshot(geometry.index?.array ?? []);
    const batchPositionsBefore = scene.batches.map((batch) => snapshot(batch.basePositions));
    const materialReference = scene.foundation.material;
    const drawCallsBefore = scene.diagnostics.drawCalls;
    const materialsBefore = scene.diagnostics.materials;
    const verticesBefore = scene.diagnostics.vertices;
    const trianglesBefore = scene.diagnostics.triangles;

    const maximumTopRing = Math.max(
      ...build.foundation.vertices
        .filter((vertex) => vertex.surface === 'top')
        .map((vertex) => vertex.ringIndex ?? 0),
    );
    const outerTopIndices = build.foundation.vertices
      .map((vertex, index) => ({ vertex, index }))
      .filter(({ vertex }) => vertex.surface === 'top' && vertex.ringIndex === maximumTopRing)
      .map(({ index }) => index);
    const sideIndices = build.foundation.vertices
      .map((vertex, index) => ({ vertex, index }))
      .filter(({ vertex }) => vertex.surface === 'side')
      .map(({ index }) => index);
    const beforeOuterRadii = outerTopIndices.map((index) => radiusAt(positionsBefore, index));

    applyReefFoundationPresentation(scene, build);

    const afterPositions = geometry.getAttribute('position').array as Float32Array;
    const afterOuterRadii = outerTopIndices.map((index) => radiusAt(afterPositions, index));
    const afterSideRadii = sideIndices.map((index) => radiusAt(afterPositions, index));

    expect(snapshot(afterPositions)).not.toEqual(snapshot(positionsBefore));
    expect(spread(afterOuterRadii)).toBeGreaterThan(spread(beforeOuterRadii) + 0.02);
    expect(average(afterSideRadii)).toBeLessThan(average(afterOuterRadii) * 0.95);
    expect(snapshot(geometry.index?.array ?? [])).toEqual(indexBefore);
    expect(scene.batches.map((batch) => snapshot(batch.basePositions))).toEqual(
      batchPositionsBefore,
    );
    expect(scene.foundation.material).toBe(materialReference);
    expect(scene.diagnostics.drawCalls).toBe(drawCallsBefore);
    expect(scene.diagnostics.materials).toBe(materialsBefore);
    expect(scene.diagnostics.vertices).toBe(verticesBefore);
    expect(scene.diagnostics.triangles).toBe(trianglesBefore);
    expect(geometry.userData.reefFoundationPresentationVersion).toBe(
      REEF_FOUNDATION_PRESENTATION_VERSION,
    );
    expect(geometry.userData.reefFoundationPass).toBe(REEF_FOUNDATION_PASS);

    const normals = geometry.getAttribute('normal').array as Float32Array;
    for (let offset = 0; offset < normals.length; offset += 3) {
      expect(Math.hypot(
        normals[offset] ?? 0,
        normals[offset + 1] ?? 0,
        normals[offset + 2] ?? 0,
      )).toBeCloseTo(1, 4);
    }

    disposeReefThreeScene(scene);
  });

  it('is deterministic and idempotent for the same accepted build', () => {
    const build = buildFixture();
    const first = applyReefFoundationPresentation(
      applyReefPresentation(createReefThreeScene(build)),
      build,
    );
    const repeated = applyReefFoundationPresentation(
      applyReefPresentation(createReefThreeScene(build)),
      build,
    );
    const firstPositions = snapshot(
      first.foundation.geometry.getAttribute('position').array as Float32Array,
    );

    expect(snapshot(
      repeated.foundation.geometry.getAttribute('position').array as Float32Array,
    )).toEqual(firstPositions);

    applyReefFoundationPresentation(first, build);
    expect(snapshot(
      first.foundation.geometry.getAttribute('position').array as Float32Array,
    )).toEqual(firstPositions);

    disposeReefThreeScene(first);
    disposeReefThreeScene(repeated);
  });
});
