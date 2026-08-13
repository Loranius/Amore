import * as THREE from 'three';
import { getReefFishDepthProfile, type ReefFishDepthRole } from './reefFishDepthRoles';
import type { ReefFishInstance, ReefFishRoamingState } from './reefFishRoaming';

export type DepthReefFishInstance = ReefFishInstance & {
  depthRole: ReefFishDepthRole;
};

const FISH_COUNT = 8;

function seededUnit(index: number, salt: number): number {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

export function createDepthTarget(index: number, sequence: number): THREE.Vector3 {
  const profile = getReefFishDepthProfile(index);
  const salt = sequence * 17;
  const angleUnit = seededUnit(index, 41 + salt);
  const angle = profile.angleCenter === null
    ? angleUnit * Math.PI * 2
    : profile.angleCenter + (angleUnit - 0.5) * profile.angleSpread;
  const radius = THREE.MathUtils.lerp(profile.minRadius, profile.maxRadius, seededUnit(index, 42 + salt));

  return new THREE.Vector3(
    Math.cos(angle) * radius,
    THREE.MathUtils.lerp(profile.minY, profile.maxY, seededUnit(index, 44 + salt)),
    Math.sin(angle) * radius,
  );
}

export function depthTargetLifetime(index: number, sequence: number): number {
  return THREE.MathUtils.lerp(3, 7, seededUnit(index, 70 + sequence * 11));
}

export function buildDepthReefFish(): DepthReefFishInstance[] {
  return Array.from({ length: FISH_COUNT }, (_, index) => {
    const profile = getReefFishDepthProfile(index);
    return {
      depthRole: profile.role,
      speed: THREE.MathUtils.lerp(0.12, 0.23, seededUnit(index, 26)),
      phase: (index / FISH_COUNT) * Math.PI * 2 + THREE.MathUtils.lerp(-0.24, 0.24, seededUnit(index, 27)),
      scale: THREE.MathUtils.lerp(profile.minScale, profile.maxScale, seededUnit(index, 28)),
      cruiseSpeed: THREE.MathUtils.lerp(profile.minCruiseSpeed, profile.maxCruiseSpeed, seededUnit(index, 46)),
      turnResponsiveness: THREE.MathUtils.lerp(1.25, 2.05, seededUnit(index, 47)),
    };
  });
}

export function createDepthRoamingState(fish: DepthReefFishInstance[]): ReefFishRoamingState[] {
  return fish.map((item, index) => {
    const position = createDepthTarget(index, 0);
    const target = createDepthTarget(index, 1);
    const velocity = target.clone().sub(position).normalize().multiplyScalar(item.cruiseSpeed);
    return { position, velocity, target, targetSequence: 1, nextTargetAt: depthTargetLifetime(index, 1) };
  });
}
