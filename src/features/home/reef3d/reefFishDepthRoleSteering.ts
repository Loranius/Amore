import * as THREE from 'three';
import { getReefFishDepthProfile, type ReefFishDepthRole } from './reefFishDepthRoles';

const radial = new THREE.Vector3();
const tangent = new THREE.Vector3();

function wrappedAngle(value: number): number {
  return Math.atan2(Math.sin(value), Math.cos(value));
}

export function applyFishDepthRoleSteering(
  index: number,
  role: ReefFishDepthRole,
  position: THREE.Vector3,
  desiredVelocity: THREE.Vector3,
  cruiseSpeed: number,
): void {
  const profile = getReefFishDepthProfile(index);
  const radius = Math.max(0.0001, Math.hypot(position.x, position.z));
  radial.set(position.x / radius, 0, position.z / radius);

  const radialSoftMargin = 0.2;
  if (radius < profile.minRadius + radialSoftMargin) {
    const threat = THREE.MathUtils.clamp(
      (profile.minRadius + radialSoftMargin - radius) / 0.45,
      0,
      1,
    );
    desiredVelocity.addScaledVector(radial, cruiseSpeed * (0.35 + threat * 0.95));
  } else if (radius > profile.maxRadius - radialSoftMargin) {
    const threat = THREE.MathUtils.clamp(
      (radius - (profile.maxRadius - radialSoftMargin)) / 0.45,
      0,
      1,
    );
    desiredVelocity.addScaledVector(radial, -cruiseSpeed * (0.35 + threat * 0.95));
  }

  const verticalMargin = 0.16;
  if (position.y < profile.minY + verticalMargin) {
    const threat = THREE.MathUtils.clamp(
      (profile.minY + verticalMargin - position.y) / 0.38,
      0,
      1,
    );
    desiredVelocity.y += cruiseSpeed * (0.28 + threat * 0.8);
  } else if (position.y > profile.maxY - verticalMargin) {
    const threat = THREE.MathUtils.clamp(
      (position.y - (profile.maxY - verticalMargin)) / 0.38,
      0,
      1,
    );
    desiredVelocity.y -= cruiseSpeed * (0.28 + threat * 0.8);
  }

  if (profile.angleCenter !== null) {
    const angle = Math.atan2(position.z, position.x);
    const difference = wrappedAngle(angle - profile.angleCenter);
    const softHalfSpread = profile.angleSpread * 0.38;
    const hardHalfSpread = profile.angleSpread * 0.5;
    const excess = Math.abs(difference) - softHalfSpread;

    if (excess > 0) {
      const threat = THREE.MathUtils.clamp(
        excess / Math.max(0.001, hardHalfSpread - softHalfSpread),
        0,
        1,
      );
      const turnDirection = difference > 0 ? -1 : 1;
      tangent.set(-radial.z * turnDirection, 0, radial.x * turnDirection);
      desiredVelocity.addScaledVector(tangent, cruiseSpeed * (0.38 + threat * 1.15));
    }
  }

  if (role === 'near' && position.z < 0.72) {
    const threat = THREE.MathUtils.clamp((0.72 - position.z) / 1.25, 0, 1);
    desiredVelocity.z += cruiseSpeed * (0.4 + threat * 1.25);
  } else if (role === 'far' && position.z > -0.82) {
    const threat = THREE.MathUtils.clamp((position.z + 0.82) / 1.25, 0, 1);
    desiredVelocity.z -= cruiseSpeed * (0.4 + threat * 1.25);
  }
}

export function applyFishDepthRoleSteeringByIndex(
  index: number,
  position: THREE.Vector3,
  desiredVelocity: THREE.Vector3,
  cruiseSpeed: number,
): void {
  const profile = getReefFishDepthProfile(index);
  applyFishDepthRoleSteering(index, profile.role, position, desiredVelocity, cruiseSpeed);
}
