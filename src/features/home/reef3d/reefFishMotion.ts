import * as THREE from 'three';

type Vec3 = readonly [number, number, number];

export type ReefFishInstance = {
  center: Vec3;
  radiusX: number;
  radiusZ: number;
  speed: number;
  phase: number;
  scale: number;
  heightDrift: number;
};

export const REEF_FISH_TINTS = ['#83b5aa', '#759caf', '#b2a675', '#8aa6a2', '#9b82ad'] as const;

const FISH_COUNT = 8;
// The vendored Kenney mesh is visually authored opposite our local +Z travel axis.
// Keep the motion math in velocity space and correct the asset orientation once here.
const FISH_FORWARD_YAW_OFFSET = Math.PI;

function seededUnit(index: number, salt: number): number {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

export function buildReefFish(): ReefFishInstance[] {
  return Array.from({ length: FISH_COUNT }, (_, index) => ({
    center: [
      THREE.MathUtils.lerp(-0.28, 0.28, seededUnit(index, 21)),
      THREE.MathUtils.lerp(0.72, 2.35, seededUnit(index, 22)),
      THREE.MathUtils.lerp(-0.18, 0.18, seededUnit(index, 23)),
    ],
    radiusX: THREE.MathUtils.lerp(2.8, 4.15, seededUnit(index, 24)),
    radiusZ: THREE.MathUtils.lerp(2.25, 3.65, seededUnit(index, 25)),
    speed: THREE.MathUtils.lerp(0.12, 0.23, seededUnit(index, 26)),
    phase:
      (index / FISH_COUNT) * Math.PI * 2
      + THREE.MathUtils.lerp(-0.24, 0.24, seededUnit(index, 27)),
    scale: THREE.MathUtils.lerp(0.34, 0.54, seededUnit(index, 28)),
    heightDrift: THREE.MathUtils.lerp(0.08, 0.26, seededUnit(index, 29)),
  }));
}

export function writeReefFishMatrices(
  mesh: THREE.InstancedMesh,
  dummy: THREE.Object3D,
  fish: ReefFishInstance[],
  time: number,
): void {
  fish.forEach((item, index) => {
    const angle = time * item.speed + item.phase;
    const wave = angle * 1.7 + item.phase;
    const radiusPulse = Math.sin(time * 0.19 + item.phase * 1.37) * 0.16;
    const radiusX = item.radiusX + radiusPulse;
    const radiusZ = item.radiusZ + radiusPulse * 0.7;
    const x = item.center[0] + Math.cos(angle) * radiusX;
    const y = item.center[1] + Math.sin(wave) * item.heightDrift;
    const z = item.center[2] + Math.sin(angle) * radiusZ;
    const dx = -Math.sin(angle) * radiusX;
    const dz = Math.cos(angle) * radiusZ;
    const dy = Math.cos(wave) * item.heightDrift * 1.7;
    const heading = Math.atan2(dx, dz);
    const pitch = Math.atan2(dy, Math.max(0.001, Math.hypot(dx, dz))) * 0.5;
    const wiggle = Math.sin(time * 2.7 + item.phase) * 0.04;
    const bank = THREE.MathUtils.clamp(-dx * 0.04, -0.14, 0.14);

    dummy.position.set(x, y, z);
    dummy.rotation.set(-pitch, heading + FISH_FORWARD_YAW_OFFSET + wiggle, bank);
    dummy.scale.setScalar(item.scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
}
