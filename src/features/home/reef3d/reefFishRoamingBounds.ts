import * as THREE from 'three';

export const REEF_FISH_ROAMING_BOUNDS = {
  innerRadius: 2.3,
  avoidRadius: 2.8,
  outerSoftRadius: 4.08,
  outerRadius: 4.4,
  minY: 0.55,
  minSoftY: 0.74,
  maxSoftY: 2.44,
  maxY: 2.62,
  targetMinRadius: 2.66,
  targetMaxRadius: 4.04,
  targetMinY: 0.68,
  targetMaxY: 2.48,
} as const;

const LOOK_AHEAD_SECONDS = 1.4;
const radial = new THREE.Vector3();
const predicted = new THREE.Vector3();
const tangent = new THREE.Vector3();

export function applyReefRoamingSteering(
  position: THREE.Vector3,
  velocity: THREE.Vector3,
  desiredVelocity: THREE.Vector3,
  cruiseSpeed: number,
  fishIndex: number,
  targetSequence: number,
): void {
  const bounds = REEF_FISH_ROAMING_BOUNDS;
  radial.set(position.x, 0, position.z);
  let radius = radial.length();
  if (radius < 0.0001) {
    radial.set(1, 0, 0);
    radius = 0.0001;
  } else {
    radial.multiplyScalar(1 / radius);
  }

  predicted.copy(position).addScaledVector(velocity, LOOK_AHEAD_SECONDS);
  const predictedRadius = Math.hypot(predicted.x, predicted.z);
  const closestRadius = Math.min(radius, predictedRadius);
  const inwardIntent = desiredVelocity.x * radial.x + desiredVelocity.z * radial.z < 0;
  const threat = THREE.MathUtils.clamp(
    (bounds.avoidRadius - closestRadius) / (bounds.avoidRadius - bounds.innerRadius),
    0,
    1,
  );
  const lookAheadThreat = inwardIntent
    ? THREE.MathUtils.clamp((bounds.avoidRadius + 0.45 - predictedRadius) / 0.9, 0, 1)
    : 0;
  const reefThreat = Math.max(threat, lookAheadThreat);

  if (reefThreat > 0) {
    desiredVelocity.addScaledVector(radial, cruiseSpeed * (0.75 + reefThreat * 1.8));
    const side = (fishIndex + targetSequence) % 2 === 0 ? 1 : -1;
    tangent.set(-radial.z * side, 0, radial.x * side);
    desiredVelocity.addScaledVector(tangent, cruiseSpeed * (0.45 + reefThreat * 1.25));
  }

  if (radius > bounds.outerSoftRadius) {
    const outerThreat = THREE.MathUtils.clamp(
      (radius - bounds.outerSoftRadius) / (bounds.outerRadius - bounds.outerSoftRadius),
      0,
      1,
    );
    desiredVelocity.addScaledVector(radial, -cruiseSpeed * (0.65 + outerThreat * 1.6));
  }

  if (position.y < bounds.minSoftY) {
    const lowThreat = THREE.MathUtils.clamp(
      (bounds.minSoftY - position.y) / (bounds.minSoftY - bounds.minY),
      0,
      1,
    );
    desiredVelocity.y += cruiseSpeed * (0.55 + lowThreat * 1.25);
  } else if (position.y > bounds.maxSoftY) {
    const highThreat = THREE.MathUtils.clamp(
      (position.y - bounds.maxSoftY) / (bounds.maxY - bounds.maxSoftY),
      0,
      1,
    );
    desiredVelocity.y -= cruiseSpeed * (0.55 + highThreat * 1.25);
  }
}

export function enforceReefRoamingBounds(
  position: THREE.Vector3,
  velocity: THREE.Vector3,
): void {
  const bounds = REEF_FISH_ROAMING_BOUNDS;
  let radius = Math.hypot(position.x, position.z);

  if (radius < bounds.innerRadius) {
    if (radius < 0.0001) {
      radial.set(velocity.x, 0, velocity.z);
      if (radial.lengthSq() < 0.0001) radial.set(1, 0, 0);
      radial.normalize();
    } else {
      radial.set(position.x / radius, 0, position.z / radius);
    }
    position.x = radial.x * bounds.innerRadius;
    position.z = radial.z * bounds.innerRadius;
    const inwardSpeed = velocity.x * radial.x + velocity.z * radial.z;
    if (inwardSpeed < 0) velocity.addScaledVector(radial, -inwardSpeed);
    radius = bounds.innerRadius;
  }

  if (radius > bounds.outerRadius) {
    radial.set(position.x / radius, 0, position.z / radius);
    position.x = radial.x * bounds.outerRadius;
    position.z = radial.z * bounds.outerRadius;
    const outwardSpeed = velocity.x * radial.x + velocity.z * radial.z;
    if (outwardSpeed > 0) velocity.addScaledVector(radial, -outwardSpeed);
  }

  if (position.y < bounds.minY) {
    position.y = bounds.minY;
    if (velocity.y < 0) velocity.y = 0;
  } else if (position.y > bounds.maxY) {
    position.y = bounds.maxY;
    if (velocity.y > 0) velocity.y = 0;
  }
}
