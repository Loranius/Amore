import * as THREE from 'three';

type SeparationState = {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
};

type SeparationFish = {
  scale: number;
  cruiseSpeed: number;
};

const SOFT_SEPARATION_RADIUS = 1.08;
const LOOK_AHEAD_SECONDS = 0.76;
const currentOffset = new THREE.Vector3();
const predictedOffset = new THREE.Vector3();
const pairForce = new THREE.Vector3();

function ensureForces(outForces: THREE.Vector3[], count: number): void {
  while (outForces.length < count) outForces.push(new THREE.Vector3());
  if (outForces.length > count) outForces.length = count;
  outForces.forEach((force) => force.set(0, 0, 0));
}

/**
 * Computes all pairwise separation forces from one immutable frame snapshot.
 * Each pair contributes equal and opposite steering, avoiding update-order bias.
 */
export function writeSymmetricFishSeparationForces(
  states: readonly SeparationState[],
  fish: readonly SeparationFish[],
  outForces: THREE.Vector3[],
): void {
  ensureForces(outForces, states.length);

  for (let i = 0; i < states.length; i += 1) {
    const a = states[i];
    if (!a) continue;

    for (let j = i + 1; j < states.length; j += 1) {
      const b = states[j];
      if (!b) continue;

      currentOffset.copy(a.position).sub(b.position);
      const currentDistance = currentOffset.length();

      predictedOffset
        .copy(a.position)
        .addScaledVector(a.velocity, LOOK_AHEAD_SECONDS)
        .sub(b.position)
        .addScaledVector(b.velocity, -LOOK_AHEAD_SECONDS);
      const predictedDistance = predictedOffset.length();
      const effectiveDistance = Math.min(currentDistance, predictedDistance);
      if (effectiveDistance >= SOFT_SEPARATION_RADIUS) continue;

      const scaleA = fish[i]?.scale ?? 0.44;
      const scaleB = fish[j]?.scale ?? 0.44;
      const personalRadius = THREE.MathUtils.clamp(
        0.48 + (scaleA + scaleB) * 0.28,
        0.67,
        0.84,
      );

      pairForce.copy(predictedDistance < currentDistance ? predictedOffset : currentOffset);
      if (pairForce.lengthSq() < 0.000001) {
        const angle = ((i + 1) * 2.399963 + (j + 1) * 0.91) % (Math.PI * 2);
        pairForce.set(Math.cos(angle), 0, Math.sin(angle));
      } else {
        pairForce.normalize();
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
      const pairCruise = Math.min(
        fish[i]?.cruiseSpeed ?? 0.46,
        fish[j]?.cruiseSpeed ?? 0.46,
      );
      const strength = pairCruise * (0.4 * softThreat + 1.5 * hardThreat * hardThreat);

      // Horizontal avoidance dominates so crossing fish do not bounce vertically.
      pairForce.y *= 0.38;
      pairForce.multiplyScalar(strength);
      outForces[i]!.add(pairForce);
      outForces[j]!.sub(pairForce);
    }
  }
}
