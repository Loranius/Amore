import { describe, expect, it } from 'vitest';
import { buildArtifactBlueprint, type EvolutionEventInput } from '@/engine/evolution';
import { REEF_COLONY_MORPHOTYPES } from '@/engine/species/reef';
import { buildReefPreviewFromArtifact } from './buildReefPreview';
import {
  applyReefMaterialPresentation,
  REEF_MATERIAL_PASS,
  REEF_MATERIAL_PRESENTATION_VERSION,
  REEF_MATERIAL_PROFILES,
} from './reefMaterialPresentation';
import { applyReefPresentation } from './reefPresentation';
import {
  createReefThreeScene,
  disposeReefThreeScene,
  sampleReefBatchFrame,
} from './reefThreeAdapter';

const EVENTS: EvolutionEventInput[] = [
  {
    id: 'reef:material:stability',
    occurredAt: '2024-02-12',
    source: 'plans@1',
    evidence: 'verified',
    channels: { stability: 0.92 },
    portalActivity: 0.22,
  },
  {
    id: 'reef:material:remembrance',
    occurredAt: '2024-04-14',
    source: 'memories@1',
    evidence: 'verified',
    channels: { remembrance: 0.94, culture: 0.1 },
    portalActivity: 0.24,
  },
  {
    id: 'reef:material:achievement',
    occurredAt: '2024-07-18',
    source: 'plans@1',
    evidence: 'verified',
    channels: { achievement: 0.96, significance: 0.32 },
    portalActivity: 0.28,
  },
  {
    id: 'reef:material:exploration',
    occurredAt: '2024-10-20',
    source: 'map@1',
    evidence: 'verified',
    channels: { exploration: 0.95, remembrance: 0.12 },
    portalActivity: 0.3,
  },
  {
    id: 'reef:material:culture-soft',
    occurredAt: '2025-02-16',
    source: 'calendar@1',
    evidence: 'verified',
    channels: { culture: 0.92, significance: 0.18 },
    portalActivity: 0.24,
  },
  {
    id: 'reef:material:culture-fan',
    occurredAt: '2025-04-20',
    source: 'calendar@1',
    evidence: 'verified',
    channels: { culture: 0.94, significance: 0.78 },
    portalActivity: 0.34,
  },
];

function buildFixture() {
  const artifact = buildArtifactBlueprint({
    coupleId: 'amore:reef-phase-11-materials',
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

function colorSnapshot(array: Float32Array): number[] {
  return Array.from(array, (value) => Number(value.toFixed(6)));
}

function uniqueColorCount(array: Float32Array): number {
  const colors = new Set<string>();
  for (let offset = 0; offset < array.length; offset += 3) {
    colors.add([
      array[offset]?.toFixed(3),
      array[offset + 1]?.toFixed(3),
      array[offset + 2]?.toFixed(3),
    ].join(':'));
  }
  return colors.size;
}

describe('Reef Phase 11 material presentation', () => {
  it('defines a distinct bounded material language for every morphotype', () => {
    expect(Object.keys(REEF_MATERIAL_PROFILES)).toEqual(REEF_COLONY_MORPHOTYPES);

    const signatures = REEF_COLONY_MORPHOTYPES.map((morphotype) => {
      const profile = REEF_MATERIAL_PROFILES[morphotype];
      return [
        profile.bodyColor.r,
        profile.bodyColor.g,
        profile.bodyColor.b,
        profile.roughness,
        profile.sheen,
      ].join(':');
    });
    expect(new Set(signatures).size).toBe(REEF_COLONY_MORPHOTYPES.length);

    for (const profile of Object.values(REEF_MATERIAL_PROFILES)) {
      expect(profile.roughness).toBeGreaterThanOrEqual(0);
      expect(profile.roughness).toBeLessThanOrEqual(1);
      expect(profile.clearcoat).toBeGreaterThanOrEqual(0);
      expect(profile.clearcoat).toBeLessThanOrEqual(1);
      expect(profile.transmission).toBe(0);
    }
  });

  it('reuses accepted resources while recoloring every visible batch', () => {
    const build = buildFixture();
    const scene = applyReefPresentation(createReefThreeScene(build));
    const drawCallsBefore = scene.diagnostics.drawCalls;
    const materialsBefore = scene.diagnostics.materials;
    const verticesBefore = scene.diagnostics.vertices;
    const trianglesBefore = scene.diagnostics.triangles;
    const materialReferences = [
      scene.foundation.material,
      ...scene.batches.map((batch) => batch.material),
    ];
    const sourceColors = scene.batches.map((batch) => colorSnapshot(batch.baseColors));

    applyReefMaterialPresentation(scene);

    expect(scene.diagnostics.drawCalls).toBe(drawCallsBefore);
    expect(scene.diagnostics.materials).toBe(materialsBefore);
    expect(scene.diagnostics.vertices).toBe(verticesBefore);
    expect(scene.diagnostics.triangles).toBe(trianglesBefore);
    expect([
      scene.foundation.material,
      ...scene.batches.map((batch) => batch.material),
    ]).toEqual(materialReferences);
    expect(scene.foundation.geometry.userData.reefMaterialPresentationVersion).toBe(
      REEF_MATERIAL_PRESENTATION_VERSION,
    );
    expect(scene.foundation.geometry.userData.reefMaterialPass).toBe(REEF_MATERIAL_PASS);
    expect(scene.foundation.material.emissiveIntensity).toBeGreaterThan(0);
    expect(scene.foundation.material.emissive.getHex()).not.toBe(0);

    scene.batches.forEach((batch, index) => {
      expect(batch.geometry.userData.reefMaterialPresentationVersion).toBe(
        REEF_MATERIAL_PRESENTATION_VERSION,
      );
      expect(batch.geometry.userData.reefMaterialPass).toBe(REEF_MATERIAL_PASS);
      expect(colorSnapshot(batch.baseColors)).not.toEqual(sourceColors[index]);
      expect(uniqueColorCount(batch.baseColors)).toBeGreaterThan(1);
      expect(batch.material.color.toArray()).toEqual([1, 1, 1]);
      expect(batch.material.transmission).toBe(0);
      expect(batch.material.emissiveIntensity).toBeGreaterThan(0);
      expect(batch.material.emissive.getHex()).not.toBe(0);
      for (const component of batch.baseColors) {
        expect(Number.isFinite(component)).toBe(true);
        expect(component).toBeGreaterThanOrEqual(0);
        expect(component).toBeLessThanOrEqual(1);
      }
    });

    disposeReefThreeScene(scene);
  });

  it('is idempotent and becomes the exact reduced-motion color source', () => {
    const build = buildFixture();
    const scene = applyReefMaterialPresentation(
      applyReefPresentation(createReefThreeScene(build)),
    );
    const firstColors = scene.batches.map((batch) => colorSnapshot(batch.baseColors));

    applyReefMaterialPresentation(scene);
    expect(scene.batches.map((batch) => colorSnapshot(batch.baseColors))).toEqual(firstColors);

    for (const batch of scene.batches) {
      sampleReefBatchFrame(
        batch,
        0,
        true,
        build.life.current.cycleSeconds,
        build.life.current.phaseRadians,
      );
      expect(colorSnapshot(
        batch.geometry.getAttribute('color').array as Float32Array,
      )).toEqual(colorSnapshot(batch.baseColors));
    }

    disposeReefThreeScene(scene);
  });
});
