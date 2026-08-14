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
      `${routeId}head6_10.position`,
      times,
      [-1000, 200, -2000, 0, 800, 0, 1000, 500, 2000],
    ),
    new THREE.VectorKeyframeTrack(
      `${routeId}Spine_018_12.position`,
      times,
      [-980, 190, -1970, 20, 790, 30, 1020, 490, 2030],
    ),
    new THREE.QuaternionKeyframeTrack(
      `${routeId}Spine_018_12.quaternion`,
      times,
      [0, 0, 0, 1, 0, 0.1, 0, 0.995, 0, 0, 0, 1],
    ),
  ]);
  return new THREE.AnimationClip('swimming', 2, tracks);
}

describe('reef fish open-water routes', () => {
  it('splits the school into independently phased broad routes without changing body animation', () => {
    const source = createSourceClip();
    const sourceHead = source.tracks[0]!;
    const sourceSpine = source.tracks[1]!;
    const sourceBody = source.tracks[2]!;
    const sourceValues = Array.from(sourceHead.values);
    const routes = createReefFishRouteClips(source);

    expect(routes).toHaveLength(REEF_FISH_ROUTE_COUNT);
    expect(new Set(routes.map(({ phase }) => phase)).size).toBe(REEF_FISH_ROUTE_COUNT);
    expect(routes.map(({ routeId }) => routeId)).toEqual(REEF_FISH_ROUTE_IDS);

    expect(routes.every(({ clip }) => clip.tracks.length === 3)).toBe(true);

    const routedHead = routes[0]!.clip.tracks.find((track) => track.name.includes('head6_10'));
    const routedSpine = routes[0]!.clip.tracks.find(
      (track) => track.name.endsWith('Spine_018_12.position'),
    );
    const routedBody = routes[0]!.clip.tracks.find(
      (track) => track.name.endsWith('Spine_018_12.quaternion'),
    );
    expect(routedHead).toBeDefined();
    expect(routedSpine).toBeDefined();
    expect(routedBody).toBe(sourceBody);
    expect(Array.from(sourceHead.values)).toEqual(sourceValues);

    expect(componentRange(routedHead!, 0)).toBeGreaterThan(componentRange(sourceHead, 0));
    expect(componentRange(routedHead!, 1)).toBeLessThan(componentRange(sourceHead, 1));
    expect(componentRange(routedHead!, 2)).toBeGreaterThan(componentRange(sourceHead, 2));
    expect(componentMean(routedHead!, 2)).toBeLessThan(0);
    expect(componentRange(routedSpine!, 0)).toBeGreaterThan(componentRange(sourceSpine, 0));
    expect(componentRange(routedSpine!, 2)).toBeGreaterThan(componentRange(sourceSpine, 2));
  });

  it('binds GLTFLoader-style track names and advances a fish rig over time', () => {
    const route = createReefFishRouteClips(createSourceClip())[0]!;
    const rig = new THREE.Group();
    const head = new THREE.Object3D();
    head.name = 'Clown1head6_10';
    const spine = new THREE.Object3D();
    spine.name = 'Clown1Spine_018_12';
    rig.add(head, spine);

    const mixer = new THREE.AnimationMixer(rig);
    mixer.clipAction(route.clip).play();
    mixer.setTime(0);
    const start = head.position.clone();
    mixer.setTime(0.5);
    const halfway = head.position.clone();

    expect(route.clip.tracks).toHaveLength(3);
    expect(halfway.distanceTo(start)).toBeGreaterThan(1);
    expect(spine.position.length()).toBeGreaterThan(1);
  });
});
