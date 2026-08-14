import * as THREE from 'three';
import type { DepthReefFishInstance } from './reefFishDepthState';
import type { ReefFishRoamingState } from './reefFishRoaming';

const alignment = new THREE.Vector3();
const cohesionCenter = new THREE.Vector3();
const cohesion = new THREE.Vector3();

function neighborRadius(role: DepthReefFishInstance['depthRole']): number {
  if (role === 'near') return 2.05;
  if (role === 'far') return 2.15;
  return 2.55;
}

function schoolingWeights(role: DepthReefFishInstance['depthRole']) {
  if (role === 'near') return { alignment: 0.18, cohesion: 0.13 };
  if (role === 'far') return { alignment: 0.22, cohesion: 0.15 };
  return { alignment: 0.27, cohesion: 0.18 };
}

export function applyDepthSchoolSteering(
  desiredVelocity: THREE.Vector3,
  roaming: ReefFishRoamingState[],
  fish: DepthReefFishInstance[],
  index: number,
  cruiseSpeed: number,
): void {
  const state = roaming[index];
  const item = fish[index];
  if (!state || !item) return;

  alignment.set(0, 0, 0);
  cohesionCenter.set(0, 0, 0);
  let neighbors = 0;
  const radius = neighborRadius(item.depthRole);
  const radiusSq = radius * radius;

  roaming.forEach((otherState, otherIndex) => {
    if (otherIndex === index) return;
    const otherFish = fish[otherIndex];
    if (!otherFish || otherFish.depthRole !== item.depthRole) return;

    const distanceSq = state.position.distanceToSquared(otherState.position);
    if (distanceSq <= 0.0001 || distanceSq > radiusSq) return;

    alignment.add(otherState.velocity);
    cohesionCenter.add(otherState.position);
    neighbors += 1;
  });

  if (neighbors === 0) return;

  alignment.multiplyScalar(1 / neighbors);
  if (alignment.lengthSq() > 0.0001) alignment.setLength(cruiseSpeed);

  cohesionCenter.multiplyScalar(1 / neighbors);
  cohesion.copy(cohesionCenter).sub(state.position);
  if (cohesion.lengthSq() > 0.0001) cohesion.setLength(cruiseSpeed);

  const weights = schoolingWeights(item.depthRole);
  desiredVelocity.addScaledVector(alignment, weights.alignment);
  desiredVelocity.addScaledVector(cohesion, weights.cohesion);
}
