import * as THREE from 'three';
import { applyFishSeparationSteering } from './reefFishSeparation';
import { applyReefRoamingSteering, enforceReefRoamingBounds } from './reefFishRoamingBounds';
import type { ReefFishRoamingState } from './reefFishRoaming';
import {
  createDepthTarget,
  depthTargetLifetime,
  type DepthReefFishInstance,
} from './reefFishDepthState';
import { applyFishDepthRoleSteeringByIndex } from './reefFishDepthRoleSteering';
import { applyDepthSchoolSteering } from './reefFishSchooling';

const FISH_FORWARD_YAW_OFFSET = Math.PI;
const depthSteering = new THREE.Vector3();

export function writeDepthReefFishMatrices(
  mesh: THREE.InstancedMesh,
  dummy: THREE.Object3D,
  fish: DepthReefFishInstance[],
  roaming: ReefFishRoamingState[],
  time: number,
  delta: number,
): void {
  const dt = THREE.MathUtils.clamp(delta, 0, 0.05);

  fish.forEach((item, index) => {
    const state = roaming[index]!;
    if (dt > 0 && (time >= state.nextTargetAt || state.position.distanceToSquared(state.target) < 0.16)) {
      state.targetSequence += 1;
      state.target.copy(createDepthTarget(index, state.targetSequence));
      state.nextTargetAt = time + depthTargetLifetime(index, state.targetSequence);
    }

    const desiredVelocity = state.target.clone().sub(state.position);
    if (desiredVelocity.lengthSq() > 0.0001) {
      desiredVelocity.normalize().multiplyScalar(item.cruiseSpeed);
    }

    applyDepthSchoolSteering(desiredVelocity, roaming, fish, index, item.cruiseSpeed);
    applyFishSeparationSteering(desiredVelocity, roaming, fish, index, item.cruiseSpeed);
    applyReefRoamingSteering(
      state.position,
      state.velocity,
      desiredVelocity,
      item.cruiseSpeed,
      index,
      state.targetSequence,
    );

    depthSteering.set(0, 0, 0);
    applyFishDepthRoleSteeringByIndex(index, state.position, depthSteering, item.cruiseSpeed);
    desiredVelocity.add(depthSteering);

    if (desiredVelocity.lengthSq() > 0.0001) {
      desiredVelocity.normalize().multiplyScalar(item.cruiseSpeed);
    }

    if (dt > 0) {
      const steeringAlpha = 1 - Math.exp(-item.turnResponsiveness * dt);
      state.velocity.lerp(desiredVelocity, steeringAlpha);
      const maxSpeed = item.cruiseSpeed * 1.08;
      if (state.velocity.lengthSq() > maxSpeed * maxSpeed) state.velocity.setLength(maxSpeed);
      state.position.addScaledVector(state.velocity, dt);
      enforceReefRoamingBounds(state.position, state.velocity);
    }

    const horizontalSpeed = Math.max(0.001, Math.hypot(state.velocity.x, state.velocity.z));
    const heading = Math.atan2(state.velocity.x, state.velocity.z);
    const pitch = Math.atan2(state.velocity.y, horizontalSpeed) * 0.5;
    const turnCross = state.velocity.x * desiredVelocity.z - state.velocity.z * desiredVelocity.x;
    const bank = THREE.MathUtils.clamp(turnCross * 1.8, -0.16, 0.16);

    dummy.position.copy(state.position);
    dummy.rotation.set(-pitch, heading + FISH_FORWARD_YAW_OFFSET, bank);
    dummy.scale.setScalar(item.scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });

  mesh.instanceMatrix.needsUpdate = true;
}
