import * as THREE from 'three';
import { createKenneyFishGeometry } from './kenneyFishGeometry';
import { REEF_FISH_TINTS, type ReefFishInstance } from './reefFishRoaming';

export function createReefFishRenderGeometry(fish: ReefFishInstance[]) {
  const geometry = createKenneyFishGeometry();
  geometry.computeVertexNormals();
  geometry.normalizeNormals();
  const params = new Float32Array(fish.length * 3);
  fish.forEach((item, index) => {
    const speedT = THREE.MathUtils.clamp((item.speed - 0.12) / 0.11, 0, 1);
    const scaleT = THREE.MathUtils.clamp((item.scale - 0.34) / 0.2, 0, 1);
    params[index * 3] = item.phase * 1.67 + index * 0.83;
    params[index * 3 + 1] = THREE.MathUtils.lerp(2.2, 3.8, speedT);
    params[index * 3 + 2] = THREE.MathUtils.lerp(0.05, 0.09, scaleT);
  });
  geometry.setAttribute('instanceSwimParams', new THREE.InstancedBufferAttribute(params, 3));
  return geometry;
}

export function applyReefFishColors(mesh: THREE.InstancedMesh, fish: ReefFishInstance[]) {
  const color = new THREE.Color();
  fish.forEach((_, index) => {
    color.set(REEF_FISH_TINTS[index % REEF_FISH_TINTS.length]!);
    mesh.setColorAt(index, color);
  });
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}
