import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  createReefFishRouteClips,
  REEF_FISH_ROUTE_COUNT,
  REEF_FISH_ROUTE_IDS,
} from './reefFishSchoolMotion';

function componentRange(track: THREE.KeyframeTrack, component: number): number {
  const values = track.values;
  let minimum = Infinity;
  let maximum = -Infinity;
  for (let index = component; index < values.length; index += 3) {
    const value = values[index];
    if (value === undefined) continue;
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
  }
  return maximum - minimum;
}

function componentMean(track: THREE.KeyframeTrack, component: number): number {
  const values = track.values;
  let total = 0;
  let count = 0;
  for (let index = component; index < values.length; index += 3) {
    total += values[index] ?? 0;
    count += 1;
  }
  return total / count;
}

function createSourceClip(): THREE.AnimationClip {
  const times = [0, 1, 2];
  const tracks = REEF_FISH_ROUTE_IDS.flatMap((routeId) => [
    new THREE.VectorKeyframeTrack(
      `${routeId}:head.test.position`,
      times,
      [-1000, 200, -2000, 0, 800, 0, 1000, 500, 2000],
    ),
    new THREE.QuaternionKeyframeTrack(
      `${routeId}:Spine.test.quaternion`,
      times,
      [0, 0, 0, 1, 0, 0.1, 0, 0.995, 0, 0, 0, 1],
    ),
  ]);
  return new THREE.AnimationClip('swimming', 2, tracks);
}

describe('reef fish open-water routes', () => {
  it('splits the school into independently phased routes without changing body animation', () => {
    const source = createSourceClip();
    const sourceHead = source.tracks[0]!;
    const sourceBody = source.tracks[1]!;
    const sourceValues = Array.from(sourceHead.values);
    const routes = createReefFishRouteClips(source);

    expect(routes).toHaveLength(REEF_FISH_ROUTE_COUNT);
    expect(new Set(routes.map(({ phase }) => phase)).size).toBe(REEF_FISH_ROUTE_COUNT);
    expect(routes.map(({ routeId }) => routeId)).toEqual(REEF_FISH_ROUTE_IDS);

    const routedHead = routes[0]!.clip.tracks.find((track) => track.name.includes(':head.'));
    const routedBody = routes[0]!.clip.tracks.find((track) => track.name.includes(':Spine.'));
    expect(routedHead).toBeDefined();
    expect(routedBody).toBe(sourceBody);
    expect(Array.from(sourceHead.values)).toEqual(sourceValues);

    expect(componentRange(routedHead!, 0)).toBeGreaterThan(componentRange(sourceHead, 0));
    expect(componentRange(routedHead!, 1)).toBeLessThan(componentRange(sourceHead, 1));
    expect(componentRange(routedHead!, 2)).toBeLessThan(componentRange(sourceHead, 2));
    expect(componentMean(routedHead!, 2)).toBeLessThan(0);
  });
});
