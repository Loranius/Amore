import { describe, expect, it } from 'vitest';
import { buildArtifactBlueprint, type EvolutionEventInput } from '@/engine/evolution';
import { buildReefPreviewFromArtifact } from './buildReefPreview';
import {
  applyReefMaterialColorSpace,
  REEF_MATERIAL_COLOR_SPACE_VERSION,
} from './reefMaterialColorSpace';
import { applyReefMaterialPresentation } from './reefMaterialPresentation';
import { applyReefPresentation } from './reefPresentation';
import {
  createReefThreeScene,
  disposeReefThreeScene,
  sampleReefBatchFrame,
} from './reefThreeAdapter';

const EVENTS: EvolutionEventInput[] = [
  {
    id: 'reef:color-space:stability',
    occurredAt: '2024-02-12',
    source: 'plans@1',
    evidence: 'verified',
    channels: { stability: 0.92 },
    portalActivity: 0.22,
  },
  {
    id: 'reef:color-space:memory',
    occurredAt: '2024-04-14',
    source: 'memories@1',
    evidence: 'verified',
    channels: { remembrance: 0.94, culture: 0.1 },
    portalActivity: 0.24,
  },
  {
    id: 'reef:color-space:achievement',
    occurredAt: '2024-07-18',
    source: 'plans@1',
    evidence: 'verified',
    channels: { achievement: 0.96, significance: 0.32 },
    portalActivity: 0.28,
  },
  {
    id: 'reef:color-space:exploration',
    occurredAt: '2024-10-20',
    source: 'map@1',
    evidence: 'verified',
    channels: { exploration: 0.95, remembrance: 0.12 },
    portalActivity: 0.3,
  },
  {
    id: 'reef:color-space:culture',
    occurredAt: '2025-04-20',
    source: 'calendar@1',
    evidence: 'verified',
    channels: { culture: 0.94, significance: 0.78 },
    portalActivity: 0.34,
  },
];

function buildFixture() {
  const artifact = buildArtifactBlueprint({
    coupleId: 'amore:reef-phase-11-color-space',
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

function snapshot(array: Float32Array): number[] {
  return Array.from(array, (value) => Number(value.toFixed(7)));
}

describe('Reef Phase 11 material color space', () => {
  it('converts authored sRGB palette values into the linear renderer buffers', () => {
    const build = buildFixture();
    const scene = applyReefMaterialPresentation(
      applyReefPresentation(createReefThreeScene(build)),
    );
    const before = scene.batches.map((batch) => Float32Array.from(batch.baseColors));
    const resources = [scene.foundation.material, ...scene.batches.map((batch) => batch.material)];

    applyReefMaterialColorSpace(scene);

    expect([scene.foundation.material, ...scene.batches.map((batch) => batch.material)]).toEqual(
      resources,
    );
    expect(scene.foundation.geometry.userData.reefMaterialColorSpace).toBe(
      REEF_MATERIAL_COLOR_SPACE_VERSION,
    );

    let changedChannels = 0;
    scene.batches.forEach((batch, batchIndex) => {
      expect(batch.geometry.userData.reefMaterialColorSpace).toBe(
        REEF_MATERIAL_COLOR_SPACE_VERSION,
      );
      const source = before[batchIndex] ?? new Float32Array();
      batch.baseColors.forEach((value, index) => {
        const original = source[index] ?? value;
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
        if (original > 0 && original < 1 && Math.abs(value - original) > 1e-6) {
          changedChannels += 1;
          expect(value).toBeLessThan(original);
        }
      });
    });
    expect(changedChannels).toBeGreaterThan(0);

    disposeReefThreeScene(scene);
  });

  it('is idempotent and reduced motion restores the converted base colors', () => {
    const build = buildFixture();
    const scene = applyReefMaterialColorSpace(
      applyReefMaterialPresentation(
        applyReefPresentation(createReefThreeScene(build)),
      ),
    );
    const first = scene.batches.map((batch) => snapshot(batch.baseColors));

    applyReefMaterialColorSpace(scene);
    expect(scene.batches.map((batch) => snapshot(batch.baseColors))).toEqual(first);

    for (const batch of scene.batches) {
      sampleReefBatchFrame(
        batch,
        0,
        true,
        build.life.current.cycleSeconds,
        build.life.current.phaseRadians,
      );
      expect(snapshot(
        batch.geometry.getAttribute('color').array as Float32Array,
      )).toEqual(snapshot(batch.baseColors));
    }

    disposeReefThreeScene(scene);
  });
});
