import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildArtifactBlueprint, type EvolutionEventInput } from '@/engine/evolution';
import { buildReefPreviewFromArtifact } from './buildReefPreview';
import {
  applyReefCoralSurfacePlacement,
  REEF_CORAL_SURFACE_PLACEMENT_PASS,
} from './reefCoralSurfacePlacement';
import {
  buildReefTerracedFoundationGeometry,
  createReefTerracedFoundationProfile,
} from './reefTerracedFoundation';
import { createReefThreeScene, disposeReefThreeScene } from './reefThreeAdapter';

const EVENTS: EvolutionEventInput[] = [
  {
    id: 'memory:surface-slots',
    occurredAt: '2024-04-12',
    source: 'memories@1',
    evidence: 'verified',
    channels: { remembrance: 0.92, significance: 0.34 },
    portalActivity: 0.24,
  },
  {
    id: 'achievement:surface-slots',
    occurredAt: '2024-09-21',
    source: 'plans@1',
    evidence: 'verified',
    channels: { achievement: 0.9, stability: 0.18 },
    portalActivity: 0.3,
  },
];

function buildFixture() {
  const artifact = buildArtifactBlueprint({
    coupleId: 'amore:reef-surface-slot-test',
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

function makeSupport(build: ReturnType<typeof buildFixture>) {
  const profile = createReefTerracedFoundationProfile({
    radius: build.structures.visibleFoundationRadius,
    verticalScale: build.structures.foundationScaleY,
    seed: build.species.moduleEvolution.identitySeed,
  });
  const mesh = new THREE.Mesh(
    buildReefTerracedFoundationGeometry(profile),
    new THREE.MeshBasicMaterial(),
  );
  mesh.updateMatrixWorld(true);
  return mesh;
}

function makeCoralGroup(): THREE.Group {
  const group = new THREE.Group();
  group.rotation.set(-0.08, -0.18, 0);
  group.position.set(0, 0.02, 0);
  group.scale.set(1, 1.04, 1);
  group.updateMatrixWorld(true);
  return group;
}

function pivots(scene: ReturnType<typeof createReefThreeScene>) {
  return scene.batches.flatMap((batch) => batch.runtimeRanges.map((runtime) => ({
    id: runtime.range.id,
    pivot: { ...runtime.motion.pivot },
  })));
}

describe('reef coral surface placement', () => {
  it('grounds every production range without changing ranges or batch indices', () => {
    const build = buildFixture();
    const scene = createReefThreeScene(build);
    const support = makeSupport(build);
    const sourceRangeCount = scene.batches.reduce(
      (total, batch) => total + batch.source.ranges.length,
      0,
    );

    const diagnostics = applyReefCoralSurfacePlacement({
      build,
      reefScene: scene,
      group: makeCoralGroup(),
      supportMeshes: [support],
    });

    expect(diagnostics.requestedCount).toBe(sourceRangeCount);
    expect(diagnostics.allocatedCount).toBe(sourceRangeCount);
    expect(diagnostics.unresolvedRequestIds).toEqual([]);
    for (const batch of scene.batches) {
      expect(batch.runtimeRanges).toHaveLength(batch.source.ranges.length);
      expect(batch.geometry.index?.count).toBe(batch.source.index.length);
      expect(batch.geometry.userData.reefVisibleRangeCount).toBe(batch.source.ranges.length);
      expect(batch.geometry.userData.reefCoralSurfacePlacementPass)
        .toBe(REEF_CORAL_SURFACE_PLACEMENT_PASS);
    }

    disposeReefThreeScene(scene);
    support.geometry.dispose();
    (support.material as THREE.Material).dispose();
  });

  it('produces the same anchors for the same accepted build', () => {
    const build = buildFixture();
    const support = makeSupport(build);
    const first = createReefThreeScene(build);
    const second = createReefThreeScene(build);

    applyReefCoralSurfacePlacement({
      build,
      reefScene: first,
      group: makeCoralGroup(),
      supportMeshes: [support],
    });
    const firstPassPivots = pivots(first);
    applyReefCoralSurfacePlacement({
      build,
      reefScene: first,
      group: makeCoralGroup(),
      supportMeshes: [support],
    });
    applyReefCoralSurfacePlacement({
      build,
      reefScene: second,
      group: makeCoralGroup(),
      supportMeshes: [support],
    });

    expect(pivots(first)).toEqual(firstPassPivots);
    expect(pivots(second)).toEqual(firstPassPivots);

    disposeReefThreeScene(first);
    disposeReefThreeScene(second);
    support.geometry.dispose();
    (support.material as THREE.Material).dispose();
  });

  it('keeps every source index visible during total support loss', () => {
    const build = buildFixture();
    const scene = createReefThreeScene(build);
    const sourceRangeCount = scene.batches.reduce(
      (total, batch) => total + batch.source.ranges.length,
      0,
    );

    const diagnostics = applyReefCoralSurfacePlacement({
      build,
      reefScene: scene,
      group: makeCoralGroup(),
      supportMeshes: [],
    });

    expect(diagnostics.allocatedCount).toBe(0);
    expect(diagnostics.unresolvedRequestIds).toHaveLength(sourceRangeCount);
    for (const batch of scene.batches) {
      expect(batch.runtimeRanges).toHaveLength(batch.source.ranges.length);
      expect(batch.geometry.index?.count).toBe(batch.source.index.length);
      expect(batch.geometry.userData.reefVisibleRangeCount).toBe(batch.source.ranges.length);
    }

    disposeReefThreeScene(scene);
  });
});
