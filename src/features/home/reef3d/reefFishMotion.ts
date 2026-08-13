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

export const REEF_FISH_TINTS = ['#83b5aa', '#759caf', '#a79b72', '#788b9f'] as const;

function seededUnit(index: number, salt: number): number {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

export function buildReefFish(): ReefFishInstance[] {
  return Array.from({ length: 7 }, (_, index) => ({
    center: [
      THREE.MathUtils.lerp(-1.75, 2.05, seededUnit(index, 21)),
      THREE.MathUtils.lerp(2.45, 3.75, seededUnit(index, 22)),
      THREE.MathUtils.lerp(-8.2, -6.05, seededUnit(index, 23)),
    ],
    radiusX: THREE.MathUtils.lerp(0.9, 1.75, seededUnit(index, 24)),
    radiusZ: THREE.MathUtils.lerp(0.36, 0.78, seededUnit(index, 25)),
    speed: THREE.MathUtils.lerp(0.105, 0.175, seededUnit(index, 26)),
    phase: seededUnit(index, 27) * Math.PI * 2,
    scale: THREE.MathUtils.lerp(0.42, 0.62, seededUnit(index, 28)),
    heightDrift: THREE.MathUtils.lerp(0.07, 0.17, seededUnit(index, 29)),
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
    const x = item.center[0] + Math.cos(angle) * item.radiusX;
    const y = item.center[1] + Math.sin(wave) * item.heightDrift;
    const z = item.center[2] + Math.sin(angle) * item.radiusZ;
    const dx = -Math.sin(angle) * item.radiusX;
    const dz = Math.cos(angle) * item.radiusZ;
    const dy = Math.cos(wave) * item.heightDrift * 1.7;
    const heading = Math.atan2(dx, dz);
    const pitch = Math.atan2(dy, Math.max(0.001, Math.hypot(dx, dz))) * 0.55;
    const wiggle = Math.sin(time * 2.45 + item.phase) * 0.045;
    const bank = THREE.MathUtils.clamp(-dx * 0.025, -0.08, 0.08);

    dummy.position.set(x, y, z);
    dummy.rotation.set(-pitch, heading + wiggle, bank);
    dummy.scale.setScalar(item.scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
}
