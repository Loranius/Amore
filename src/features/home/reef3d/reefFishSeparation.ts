import * as THREE from 'three';
import { writeSymmetricFishSeparationForces } from './reefFishSeparationV2';

type SeparationState = {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
};

type SeparationFish = {
  scale: number;
  cruiseSpeed: number;
};

const frameForces: THREE.Vector3[] = [];

/**
 * Compatibility entry point used by the roaming motion loop.
 * The complete pairwise snapshot is computed once at index 0, before any fish
 * is advanced, then each fish consumes its equal-and-opposite cached force.
 */
export function applyFishSeparationSteering(
  desiredVelocity: THREE.Vector3,
  states: readonly SeparationState[],
  fish: readonly SeparationFish[],
  index: number,
  _cruiseSpeed: number,
): void {
  if (index === 0) {
    writeSymmetricFishSeparationForces(states, fish, frameForces);
  }

  const force = frameForces[index];
  if (force) desiredVelocity.add(force);
}
