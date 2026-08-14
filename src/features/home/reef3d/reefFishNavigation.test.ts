import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildArtifactBlueprint } from '@/engine/evolution';
import { buildReefPreviewFromArtifact } from './buildReefPreview';
import {
  buildReefFishTunnelPassages,
  reefFishCollisionDelta,
  sampleReefFishTunnelPassage,
  type ReefFishObstacle,
} from './reefFishNavigation';

function buildFixture() {
  const artifact = buildArtifactBlueprint({
    coupleId: 'amore:reef-fish-navigation-test',
    config: {
      engineVersion: '1.0.0',
      relationshipStartedAt: '2022-12-26',
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
    events: [],
  });
  return buildReefPreviewFromArtifact({ artifact, asOf: '2026-08-14' });
}

describe('reef fish navigation', () => {
  it('routes several fish through the exact centre of available year arches', () => {
    const build = buildFixture();
    const passages = buildReefFishTunnelPassages(build);

    expect(build.structures.arches.length).toBeGreaterThan(0);
    expect(passages).toHaveLength(3);
    expect(new Set(passages.map((passage) => passage.routeId)).size).toBe(3);

    for (const passage of passages) {
      const middlePhase = (passage.phaseStart + passage.phaseEnd) * 0.5;
      const sample = sampleReefFishTunnelPassage(passage, middlePhase);
      expect(sample).not.toBeNull();
      expect(sample?.weight).toBeCloseTo(1, 6);
      expect(sample?.target.distanceTo(passage.center)).toBeLessThan(1e-6);
      expect(passage.entry.distanceTo(passage.exit)).toBeGreaterThan(1.8);
    }
  });

  it('pushes a fish out of structure volume without ever escaping downward', () => {
    const obstacle: ReefFishObstacle = {
      box: new THREE.Box3(
        new THREE.Vector3(-1, 0, -1),
        new THREE.Vector3(1, 2, 1),
      ),
      label: 'test-rock',
    };
    const start = new THREE.Vector3(0.92, 0.2, 0.1);
    const delta = reefFishCollisionDelta(start, [obstacle], 0.2);
    const corrected = start.clone().add(delta);
    const expanded = obstacle.box.clone().expandByScalar(0.2);

    expect(delta.length()).toBeGreaterThan(0);
    expect(delta.y).toBeGreaterThanOrEqual(0);
    expect(expanded.containsPoint(corrected)).toBe(false);
  });

  it('leaves open-water points unchanged', () => {
    const obstacle: ReefFishObstacle = {
      box: new THREE.Box3(
        new THREE.Vector3(-1, 0, -1),
        new THREE.Vector3(1, 2, 1),
      ),
      label: 'test-rock',
    };
    const start = new THREE.Vector3(4, 3, -4);
    const delta = reefFishCollisionDelta(start, [obstacle]);

    expect(delta.lengthSq()).toBe(0);
  });
});
