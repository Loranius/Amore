import * as THREE from 'three';

type SeparationState = {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
};

type SeparationFish = {
  scale: number;
};

const SOFT_SEPARATION_RADIUS = 1.05;
const LOOK_AHEAD_SECONDS = 0.72;
const offset = new THREE.Vector3();
const predictedSelf = new THREE.Vector3();
const predictedOther = new THREE.Vector3();
const predictedOffset = new THREE.Vector3();

/**
 * Adds a cheap boids-style separation force without changing target selection.
 * Reef avoidance is applied afterwards so the reef remains the dominant safety rule.
 */
export function applyFishSeparationSteering(
  desiredVelocity: THREE.Vector3,
  states: readonly SeparationState[],
  fish: readonly SeparationFish[],
  index: number,
  cruiseSpeed: number,
): void {
  const state = states[index];
  if (!state) return;

  predictedSelf.copy(state.position).addScaledVector(state.velocity, LOOK_AHEAD_SECONDS);

  for (let otherIndex = 0; otherIndex < states.length; otherIndex += 1) {
    if (otherIndex === index) continue;
    const other = states[otherIndex];
    if (!other) continue;

    offset.copy(state.position).sub(other.position);
    const currentDistance = offset.length();

    predictedOther.copy(other.position).addScaledVector(other.velocity, LOOK_AHEAD_SECONDS);
    predictedOffset.copy(predictedSelf).sub(predictedOther);
    const predictedDistance = predictedOffset.length();
    const effectiveDistance = Math.min(currentDistance, predictedDistance);
    if (effectiveDistance >= SOFT_SEPARATION_RADIUS) continue;

    const ownScale = fish[index]?.scale ?? 0.44;
    const otherScale = fish[otherIndex]?.scale ?? 0.44;
    const personalRadius = THREE.MathUtils.clamp(
      0.48 + (ownScale + otherScale) * 0.28,
      0.68,
      0.82,
    );

    const usePredicted = predictedDistance < currentDistance;
    const away = usePredicted ? predictedOffset : offset;
    if (away.lengthSq() < 0.000001) {
      const angle = ((index + 1) * 2.399963 + (otherIndex + 1) * 0.91) % (Math.PI * 2);
      away.set(Math.cos(angle), 0, Math.sin(angle));
    } else {
      away.normalize();
    }

    const softThreat = THREE.MathUtils.clamp(
      (SOFT_SEPARATION_RADIUS - effectiveDistance) /
        Math.max(0.001, SOFT_SEPARATION_RADIUS - personalRadius),
      0,
      1,
    );
    const hardThreat = THREE.MathUtils.clamp(
      (personalRadius - effectiveDistance) / Math.max(0.001, personalRadius * 0.48),
      0,
      1,
    );
    const strength = cruiseSpeed * (0.42 * softThreat + 1.45 * hardThreat * hardThreat);

    // Favor horizontal separation so fish do not jitter vertically when they cross paths.
    away.y *= 0.42;
    desiredVelocity.addScaledVector(away, strength);
  }
}
