import * as THREE from 'three';

export type ReefFishInstance = {
  speed: number;
  phase: number;
  scale: number;
  cruiseSpeed: number;
  turnResponsiveness: number;
};

export type ReefFishRoamingState = {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  target: THREE.Vector3;
  targetSequence: number;
  nextTargetAt: number;
};

export const REEF_FISH_TINTS = ['#83b5aa', '#759caf', '#b2a675', '#8aa6a2', '#9b82ad'] as const;

const FISH_COUNT = 8;
const FISH_FORWARD_YAW_OFFSET = Math.PI;

function seededUnit(index: number, salt: number): number {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function targetFor(index: number, sequence: number): THREE.Vector3 {
  const salt = sequence * 17;
  const angle = seededUnit(index, 41 + salt) * Math.PI * 2;
  const radius = THREE.MathUtils.lerp(2.45, 4.15, seededUnit(index, 42 + salt));
  return new THREE.Vector3(
    Math.cos(angle) * radius + THREE.MathUtils.lerp(-0.24, 0.24, seededUnit(index, 43 + salt)),
    THREE.MathUtils.lerp(0.62, 2.55, seededUnit(index, 44 + salt)),
    Math.sin(angle) * radius + THREE.MathUtils.lerp(-0.24, 0.24, seededUnit(index, 45 + salt)),
  );
}

function targetLifetime(index: number, sequence: number): number {
  return THREE.MathUtils.lerp(3, 7, seededUnit(index, 70 + sequence * 11));
}

export function buildReefFish(): ReefFishInstance[] {
  return Array.from({ length: FISH_COUNT }, (_, index) => ({
    speed: THREE.MathUtils.lerp(0.12, 0.23, seededUnit(index, 26)),
    phase: (index / FISH_COUNT) * Math.PI * 2 + THREE.MathUtils.lerp(-0.24, 0.24, seededUnit(index, 27)),
    scale: THREE.MathUtils.lerp(0.34, 0.54, seededUnit(index, 28)),
    cruiseSpeed: THREE.MathUtils.lerp(0.38, 0.62, seededUnit(index, 46)),
    turnResponsiveness: THREE.MathUtils.lerp(1.25, 2.05, seededUnit(index, 47)),
  }));
}

export function createReefFishRoamingState(fish: ReefFishInstance[]): ReefFishRoamingState[] {
  return fish.map((item, index) => {
    const position = targetFor(index, 0);
    const target = targetFor(index, 1);
    const velocity = target.clone().sub(position).normalize().multiplyScalar(item.cruiseSpeed);
    return {
      position,
      velocity,
      target,
      targetSequence: 1,
      nextTargetAt: targetLifetime(index, 1),
    };
  });
}

export function writeReefFishRoamingMatrices(
  mesh: THREE.InstancedMesh,
  dummy: THREE.Object3D,
  fish: ReefFishInstance[],
  roaming: ReefFishRoamingState[],
  time: number,
  delta: number,
): void {
  const dt = THREE.MathUtils.clamp(delta, 0, 0.05);

  fish.forEach((item, index) => {
    const state = roaming[index]!;
    if (dt > 0 && (time >= state.nextTargetAt || state.position.distanceToSquared(state.target) < 0.16)) {
      state.targetSequence += 1;
      state.target.copy(targetFor(index, state.targetSequence));
      state.nextTargetAt = time + targetLifetime(index, state.targetSequence);
    }

    const desiredVelocity = state.target.clone().sub(state.position);
    if (desiredVelocity.lengthSq() > 0.0001) {
      desiredVelocity.normalize().multiplyScalar(item.cruiseSpeed);
    }

    if (dt > 0) {
      const steeringAlpha = 1 - Math.exp(-item.turnResponsiveness * dt);
      state.velocity.lerp(desiredVelocity, steeringAlpha);
      const maxSpeed = item.cruiseSpeed * 1.08;
      if (state.velocity.lengthSq() > maxSpeed * maxSpeed) state.velocity.setLength(maxSpeed);
      state.position.addScaledVector(state.velocity, dt);
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
